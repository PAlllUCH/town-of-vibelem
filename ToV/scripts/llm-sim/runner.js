'use strict';

/*
 * runner.js - game loop + LLM spawn pool for the LLM-agentic simulator.
 * Plays a full Town of Vibelm game; night decisions run in parallel through a
 * concurrency pool over the crush CLI (opencode-go paid Flash; crush holds the
 * credentials). --dry-run uses the heuristic fallbacks instead of calling the
 * model, printing [FALLBACK] markers. LLM_DEBUG=1 also skips spawning and
 * prints every prompt instead. The runner owns the per-player memory journal:
 * stateless prompts, persistent agent behavior, no provider-side sessions.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const engine = require('../../js/engine.js');
const knowledge = require('./knowledge.js');
const fallback = require('./fallback.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODEL = 'opencode-go/deepseek-v4-flash';
const MAX_DAYS = 30;
const CONCURRENCY = 4;
const TIMEOUT_MS = 90000;

const NO_TARGET_OK = { doctor: true, janitor: true, undertaker: true, retributionist: true, amnesiac: true };
const CORPSE_ROLES = { janitor: true, undertaker: true, retributionist: true, amnesiac: true };

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr.length ? arr[randInt(arr.length)] : null; }
function living(state) { return state.players.filter(function (p) { return p.isAlive; }); }

function findCrush() {
  if (process.env.CRUSH_BIN && fs.existsSync(process.env.CRUSH_BIN)) return process.env.CRUSH_BIN;
  const name = process.platform === 'win32' ? 'crush.exe' : 'crush';
  const dirs = String(process.env.PATH || '').split(path.delimiter);
  for (const d of dirs) {
    const p = path.join(d, name);
    try { if (fs.existsSync(p)) return p; } catch (e) { /* keep looking */ }
  }
  return name;
}

const CRUSH_EXE = findCrush();

function spawnOnce(prompt) {
  return new Promise(function (resolve) {
    const child = spawn(CRUSH_EXE,
      ['run', prompt, '-m', MODEL, '--cwd', REPO_ROOT, '-q'],
      {
        cwd: REPO_ROOT,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: Object.assign({}, process.env, { TERM: 'xterm-256color', NO_COLOR: '1' })
      });
    let out = '';
    child.stdout.on('data', function (d) { out += d; });
    child.stderr.on('data', function (d) { out += d; });
    const timer = setTimeout(function () { child.kill(); }, TIMEOUT_MS);
    child.on('error', function (e) {
      clearTimeout(timer);
      resolve({ err: e, out: String(e.message) });
    });
    child.on('close', function (code) {
      clearTimeout(timer);
      resolve({ err: code === 0 ? null : new Error('crush exit ' + code), out: out });
    });
  });
}

function isRateLimited(out) {
  return /\b(429|rate limit|quota|too many requests|temporarily unavailable)\b/i.test(out);
}

async function spawnLLM(prompt) {
  const delays = [1500, 3500, 7000];
  let r = null;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    r = await spawnOnce(prompt);
    if (!r.err || !isRateLimited(r.out)) break;
    await new Promise(function (res) { setTimeout(res, delays[attempt] + randInt(800)); });
  }
  if (r.err) return null;
  return (r.out || '').trim() || null;
}

function extractJson(text) {
  if (!text) return null;
  const t = String(text).replace(/```[a-zA-Z]*/g, '');
  const opens = [];
  const closes = [];
  for (let i = 0; i < t.length; i += 1) {
    if (t[i] === '{') opens.push(i);
    else if (t[i] === '}') closes.push(i);
  }
  for (let o = 0; o < opens.length; o += 1) {
    for (let c = closes.length - 1; c >= 0; c -= 1) {
      if (closes[c] <= opens[o]) continue;
      try { return JSON.parse(t.slice(opens[o], closes[c] + 1)); } catch (e) { /* keep trying */ }
    }
  }
  return null;
}

async function ask(prompt, parseFn, fallbackFn, dryRun) {
  if (dryRun) return { value: fallbackFn(), usedFallback: true };
  const out = await spawnLLM(prompt);
  const json = extractJson(out);
  if (json != null) {
    const v = parseFn(json);
    if (v != null) return { value: v, usedFallback: false };
  }
  return { value: fallbackFn(), usedFallback: true };
}

function runPool(taskFns, concurrency) {
  return new Promise(function (resolve) {
    const n = taskFns.length;
    const results = new Array(n);
    let next = 0;
    let active = 0;
    let done = 0;
    if (n === 0) { resolve(results); return; }
    function complete(i, v) {
      results[i] = v;
      active -= 1;
      done += 1;
      if (done === n) resolve(results);
      else if (next < n) {
        start(next);
        next += 1;
      }
    }
    function start(i) {
      active += 1;
      Promise.resolve().then(taskFns[i]).then(
        function (v) { complete(i, v); },
        function (err) { complete(i, { error: err }); });
    }
    while (next < n && active < concurrency) {
      start(next);
      next += 1;
    }
  });
}

function buildNightTasks(state) {
  const tasks = [];
  const steps = engine.getNightSteps(state);
  for (let si = 0; si < steps.length; si += 1) {
    const step = steps[si];
    const pos = step.position;
    if (pos >= 14) continue;
    if (pos === 6) {
      const leader = engine.mafiaKillActor(state);
      if (leader) tasks.push({ kind: 'kill', playerId: leader.id, role: 'mafia', roleId: leader.assignedRole, position: 6 });
      continue;
    }
    for (let ri = 0; ri < step.roles.length; ri += 1) {
      const role = step.roles[ri];
      const actors = state.players.filter(function (p) {
        if (p.assignedRole !== role) return false;
        if (pos === 0 && role === 'jester') {
          return !p.isAlive && state.jester.haunted && state.jester.hauntTarget === null;
        }
        if (pos === 13 && role === 'medium') return true;
        return p.isAlive;
      });
      for (let ai = 0; ai < actors.length; ai += 1) {
        tasks.push({ kind: 'night', playerId: actors[ai].id, role: role, position: pos });
      }
    }
  }
  return tasks;
}

function nameToId(state, name) {
  if (name == null) return null;
  const raw = String(name).trim();
  const san = knowledge.sanitize(raw);
  for (let i = 0; i < state.players.length; i += 1) {
    const p = state.players[i];
    if (p.name === raw || knowledge.sanitize(p.name) === san) return p.id;
  }
  const nid = Number(raw);
  if (raw !== '' && String(nid) === raw && nid >= 1 && nid <= state.players.length) return nid;
  return null;
}

function nightActionFromJson(state, task, json) {
  if (!json || typeof json !== 'object') return null;
  const pid = task.playerId;
  const aliveOk = function (id) { return id != null && engine._byId(state, id).isAlive; };
  switch (task.role) {
    case 'veteran':
      return { position: 0, roleId: 'veteran', playerId: pid, extra: { alert: !!json.alert } };
    case 'witch': {
      const ctrl = nameToId(state, json.control);
      if (ctrl == null || ctrl === pid || !aliveOk(ctrl)) return null;
      let redir = null;
      if (json.redirect) {
        const r = nameToId(state, json.redirect);
        if (r != null && r !== pid && r !== ctrl && aliveOk(r)) redir = r;
      }
      return { position: 2, roleId: 'witch', playerId: pid, targetId: ctrl, extra: redir ? { controlRedirect: redir } : null };
    }
    case 'jailor': {
      const t = nameToId(state, json.jail);
      if (t == null || t === pid || !aliveOk(t)) return null;
      let decision = json.decision === 'EXECUTE' ? 'EXECUTE' : 'SPARE';
      if (state.night.number === 1) decision = 'SPARE';
      return { position: 3, roleId: 'jailor', playerId: pid, targetId: t, extra: { jailorDecision: decision } };
    }
    case 'mafia': {
      const leader = engine.mafiaKillActor(state);
      if (!leader) return null;
      const t = nameToId(state, json.kill);
      if (t == null || t === leader.id || !aliveOk(t)) return null;
      return { position: 6, roleId: leader.assignedRole, playerId: leader.id, targetId: t };
    }
    case 'medium': {
      const actor = engine._byId(state, pid);
      if (actor.isAlive) return { position: 13, roleId: 'medium', playerId: pid };
      const t = nameToId(state, json.whisper);
      if (t == null || !aliveOk(t)) return null;
      return { position: 13, roleId: 'medium', playerId: pid, targetId: t };
    }
    case 'jester': {
      const t = nameToId(state, json.haunt);
      if (t == null || !aliveOk(t)) return null;
      return { position: 0, roleId: 'jester', playerId: pid, targetId: t };
    }
    default: {
      const t = nameToId(state, json.target);
      if (t == null) {
        return NO_TARGET_OK[task.role]
          ? { position: task.position, roleId: task.role, playerId: pid }
          : null;
      }
      if (t === pid && task.role !== 'doctor') return null;
      if (CORPSE_ROLES[task.role]) {
        if (aliveOk(t)) return null;
      } else if (!aliveOk(t)) {
        return null;
      }
      return { position: task.position, roleId: task.role, playerId: pid, targetId: t };
    }
  }
}

function describeAction(state, action) {
  const role = engine.ROLES[action.roleId];
  const p = engine._byId(state, action.playerId);
  const t = action.targetId != null ? engine._byId(state, action.targetId) : null;
  const base = (role ? role.name : action.roleId) + ' ' + (p ? p.name : action.playerId);
  if (action.roleId === 'veteran') return base + (action.extra && action.extra.alert ? ' alert' : ' no alert');
  if (action.roleId === 'witch') {
    const redirId = action.extra && action.extra.controlRedirect;
    const rp = redirId != null ? engine._byId(state, redirId) : null;
    return base + ' controls ' + (t ? t.name : '?') +
      (rp ? ' redirect to ' + rp.name : '');
  }
  if (action.roleId === 'jailor') {
    return base + ' jails ' + (t ? t.name : '?') + ' (' + ((action.extra && action.extra.jailorDecision) || 'SPARE') + ')';
  }
  if (action.roleId === 'medium') {
    return base + (action.targetId == null ? ' reads the Ghost Ledger' : ' whispers to ' + (t ? t.name : '?'));
  }
  return base + (t ? ' targets ' + t.name : ' (no target)');
}

function rememberAction(ctx, action, nightNum) {
  const store = ctx.store;
  const pid = action.playerId;
  store[pid].actions.push('Night ' + nightNum + ': ' + describeAction(ctx.state, action));
  if (action.position === 6) {
    const tn = action.targetId != null ? engine._byId(ctx.state, action.targetId).name : '?';
    ctx.state.players.forEach(function (q) {
      const isFaction = engine.ROLES[q.assignedRole].team === 'MAFIA' ||
        (q.assignedRole === 'witch' && ctx.state.witchSide === 'MAFIA');
      if (q.id !== pid && isFaction) {
        store[q.id].actions.push('Night ' + nightNum + ': Mafia killed ' + tn);
      }
    });
  }
}

function ownActionText(state, action) {
  const t = action.targetId != null ? engine._byId(state, action.targetId) : null;
  const tn = t ? knowledge.sanitize(t.name) : 'nobody';
  switch (action.roleId) {
    case 'veteran':
      return action.extra && action.extra.alert ? 'You went on alert.' : 'You stayed off alert.';
    case 'witch': {
      const rp = action.extra && action.extra.controlRedirect ? engine._byId(state, action.extra.controlRedirect) : null;
      return 'You controlled ' + tn + (rp ? ' and redirected them to ' + knowledge.sanitize(rp.name) : '') + '.';
    }
    case 'jailor':
      return 'You jailed ' + tn + ' (' + ((action.extra && action.extra.jailorDecision) || 'SPARE') + ').';
    case 'mafia':
      return 'You ordered the Mafia to kill ' + tn + '.';
    case 'medium':
      return action.targetId == null ? 'You read the Ghost Ledger.' : 'You whispered to ' + tn + '.';
    default:
      return action.targetId == null ? 'You used your ability with no target.' : 'You targeted ' + tn + '.';
  }
}

function memAppend(ctx, playerId, text) {
  const m = ctx.memories[playerId];
  if (!m) return;
  m.turn = ctx.turn;
  knowledge.append(m, text);
  knowledge.rollup(m);
}

function identityFor(ctx, roleId) {
  if (!Object.prototype.hasOwnProperty.call(ctx.identityCache, roleId)) {
    ctx.identityCache[roleId] = knowledge.buildIdentity(roleId);
  }
  return ctx.identityCache[roleId];
}

function composeNews(ctx, playerId, situation) {
  const state = ctx.state;
  const aliveNames = living(state).map(function (q) { return knowledge.sanitize(q.name); }).join(', ') || 'none';
  const deadNames = state.graveyard.map(function (e) { return knowledge.sanitize(e.name); }).join(', ') || 'none';
  const lines = [];
  lines.push('Situation: ' + situation + '.');
  lines.push('Alive: ' + aliveNames + '.');
  lines.push('Dead: ' + deadNames + '.');
  (ctx.news || []).forEach(function (l) { lines.push(l); });
  return lines.join('\n');
}

function seedMemories(ctx) {
  const state = ctx.state;
  state.players.forEach(function (p) {
    const m = ctx.memories[p.id];
    m.turn = 0;
    knowledge.append(m, 'Your name is ' + knowledge.sanitize(p.name));
  });
  state.players.forEach(function (p) {
    const m = ctx.memories[p.id];
    const isFaction = engine.ROLES[p.assignedRole].team === 'MAFIA' ||
      (p.assignedRole === 'witch' && state.witchSide === 'MAFIA');
    if (isFaction) {
      const mates = state.players.filter(function (q) {
        return q.id !== p.id &&
          (engine.ROLES[q.assignedRole].team === 'MAFIA' || (q.assignedRole === 'witch' && state.witchSide === 'MAFIA'));
      }).map(function (q) { return knowledge.sanitize(q.name); });
      if (p.assignedRole === 'godfather' && state.gfBluffs && state.gfBluffs.length) {
        mates.push('bluffs: ' + state.gfBluffs.map(function (rid) { return engine.ROLES[rid].name; }).join(', '));
      }
      knowledge.append(m, 'Your side partners: ' + (mates.length ? mates.join(', ') : 'none'));
    }
    if (p.assignedRole === 'witch') knowledge.append(m, 'You side with: ' + state.witchSide + '.');
    if (p.assignedRole === 'executioner' && !state.executionerConverted) {
      const t = engine._byId(state, state.executionerTarget);
      knowledge.append(m, 'Your lynch target: ' + knowledge.sanitize(t ? t.name : '?') + '. You win when they are lynched.');
    }
  });
}

function showPrompt(ctx, prompt, label) {
  if (ctx.debugPrompts) {
    console.log('[' + label + ' PROMPT]\n' + prompt + '\n[END PROMPT]');
  } else if (ctx.showPrompts) {
    if (label === 'NIGHT' && ctx.nightPromptsShown < 1) {
      ctx.nightPromptsShown += 1;
      console.log('[SAMPLE NIGHT PROMPT]\n' + prompt + '\n[END PROMPT]');
    } else if (label === 'DAY' && ctx.dayPromptsShown < 1) {
      ctx.dayPromptsShown += 1;
      console.log('[SAMPLE DAY PROMPT]\n' + prompt + '\n[END PROMPT]');
    }
  }
}

async function runNightTask(ctx, task, news) {
  const state = ctx.state;
  const identity = identityFor(ctx, task.role);
  const meta = knowledge.nightMeta(state, task.playerId, task.role);
  const prompt = knowledge.buildNightPrompt(identity, ctx.memories[task.playerId], news, meta.decision, meta.schema);
  showPrompt(ctx, prompt, 'NIGHT');
  const res = await ctx.ask(prompt,
    function (json) { return nightActionFromJson(state, task, json); },
    function () { return fallback.fallbackNight(state, task.playerId, task.role); });
  return { action: res.value, usedFallback: res.usedFallback };
}

async function runNight(ctx) {
  const state = ctx.state;
  const tasks = buildNightTasks(state);
  const nightNum = state.night.number;
  ctx.transcript.push('=== Night ' + nightNum + ' ===');
  const nightNews = tasks.map(function (task) {
    const me = engine._byId(state, task.playerId);
    return composeNews(ctx, task.playerId,
      'Night ' + nightNum + (me.isAlive ? '' : ' (you are dead and act as a ghost)'));
  });
  ctx.news = [];
  const jobFns = tasks.map(function (task, i) { return function () { return runNightTask(ctx, task, nightNews[i]); }; });
  const decisions = await runPool(jobFns, CONCURRENCY);
  const prevLogCount = state.logs.length;
  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i];
    let action = decisions[i] ? decisions[i].action : null;
    let fb = decisions[i] ? decisions[i].usedFallback : true;
    if (action && !engine.recordNightAction(state, action)) action = null;
    if (!action) {
      action = fallback.fallbackNight(state, task.playerId, task.role);
      fb = true;
      if (action && !engine.recordNightAction(state, action)) action = null;
    }
    if (!action) continue;
    rememberAction(ctx, action, nightNum);
    memAppend(ctx, action.playerId, ownActionText(state, action));
    console.log('  ' + (fb ? '[FALLBACK] ' : '[LLM] ') + describeAction(state, action));
  }
  ctx.prevLogCount = prevLogCount;
}

function morningLine(state, ann) {
  const parts = [];
  ann.deaths.forEach(function (d) {
    parts.push(d.name + ' died during the night (' + (d.roleShown === '?? UNKNOWN ??' ? 'role hidden' : d.roleShown) + ')');
  });
  ann.revivals.forEach(function (n) {
    const p = state.players.find(function (x) { return x.name === n; });
    parts.push(n + ' revived (' + (p ? engine.ROLES[p.assignedRole].name : '?') + ')');
  });
  if (ann.inheritanceNote) {
    const dep = state.players.find(function (p) { return p.assignedRole === 'deputy' && p.inheritedRole === 'sheriff'; });
    parts.push(dep ? dep.name + ' (Deputy) inherited the Sheriff badge' : ann.inheritanceNote);
  }
  if (ann.forgedWills && ann.forgedWills.length) {
    parts.push(ann.forgedWills.map(function (f) { return f.targetName + '\'s will was forged'; }).join(', '));
  }
  return '=== Morning ' + (state.night.number - 1) + ': ' + (parts.length ? parts.join('; ') : 'no deaths') + ' ===';
}

function morningMemoryLines(state, ann) {
  const lines = [];
  ann.deaths.forEach(function (d) { lines.push(knowledge.sanitize(d.name) + ' died during the night'); });
  ann.revivals.forEach(function (n) { lines.push(knowledge.sanitize(n) + ' revived'); });
  if (ann.inheritanceNote) {
    const dep = state.players.find(function (p) { return p.assignedRole === 'deputy' && p.inheritedRole === 'sheriff'; });
    lines.push(dep ? knowledge.sanitize(dep.name) + ' (Deputy) inherited the Sheriff badge' : ann.inheritanceNote);
  }
  if (ann.forgedWills && ann.forgedWills.length) {
    lines.push(ann.forgedWills.map(function (f) { return knowledge.sanitize(f.targetName) + '\'s will was forged'; }).join(', '));
  }
  if (!lines.length) lines.push('No one died during the night.');
  return lines;
}

function abilitiesOf(state, id) {
  const p = engine._byId(state, id);
  return {
    vigilanteShots: p.assignedRole === 'vigilante' ? 3 - p.shotsFired : 0,
    deputyShot: p.assignedRole === 'deputy' && !p.usedOncePerGame,
    mayorReveal: p.assignedRole === 'mayor' && !p.revealed
  };
}

function parseVoteJson(state, voter, json) {
  if (!json || typeof json !== 'object') return null;
  const out = { verdict: null, shootId: null, reveal: false, nominateId: null };
  if (voter.isGhost) {
    if (json.vote === 'GUILTY' || json.vote === 'INNOCENT') out.verdict = json.vote;
  } else {
    if (json.vote === 'GUILTY' || json.vote === 'INNOCENT' || json.vote === 'ABSTAIN') out.verdict = json.vote;
    const shooter = engine._byId(state, voter.id);
    if (json.shoot && typeof json.shoot === 'string') {
      const t = nameToId(state, json.shoot);
      if (t != null && t !== voter.id && engine._byId(state, t).isAlive) {
        if (shooter.assignedRole === 'vigilante' && shooter.shotsFired < 3) out.shootId = t;
        else if (shooter.assignedRole === 'deputy' && !shooter.usedOncePerGame) out.shootId = t;
      }
    }
    if (json.reveal === true && shooter.assignedRole === 'mayor' && !shooter.revealed) out.reveal = true;
    if (json.nominate && typeof json.nominate === 'string') {
      const t = nameToId(state, json.nominate);
      if (t != null && t !== voter.id && engine._byId(state, t).isAlive) out.nominateId = t;
    }
  }
  if (out.verdict != null || out.nominateId != null) return out;
  return null;
}

function fallbackVoteDecision(state, voter, dayInfo, accusedId) {
  const ver = accusedId != null
    ? (voter.isGhost ? fallback.ghostFallbackVote(state, voter.id, accusedId, dayInfo)
      : fallback.fallbackVote(state, voter.id, accusedId, dayInfo))
    : null;
  return {
    verdict: ver,
    shootId: fallback.fallbackShoot(state, voter.id, dayInfo),
    reveal: fallback.fallbackReveal(state, voter.id, dayInfo),
    nominateId: accusedId != null ? null : fallback.fallbackNomination(state, voter.id, dayInfo)
  };
}

async function runStatements(ctx, dayInfo) {
  const state = ctx.state;
  const round = ctx.dayRound;
  const speakers = living(state).filter(function (p) { return !p.blackmailed; });
  const jobFns = speakers.map(function (p) {
    return function () {
      const identity = identityFor(ctx, p.assignedRole);
      const meta = knowledge.dayMeta(state, p.id, 'statement', {});
      const news = composeNews(ctx, p.id, 'Day ' + state.dayNumber);
      const prompt = knowledge.buildDayPrompt('statement', identity, ctx.memories[p.id], news, meta.decision, meta.schema);
      showPrompt(ctx, prompt, 'DAY');
      return ctx.ask(prompt,
        function (json) {
          return json && typeof json.statement === 'string' ? { statement: json.statement } : null;
        },
        function () { return { statement: fallback.fallbackStatement(state, p.id, dayInfo) }; });
    };
  });
  const results = await runPool(jobFns, CONCURRENCY);
  for (let i = 0; i < speakers.length; i += 1) {
    const p = speakers[i];
    const text = String((results[i] || {}).value ? results[i].value.statement || '' : '').trim().replace(/\s+/g, ' ').slice(0, 300);
    const fb = results[i] ? results[i].usedFallback : false;
    if (text) {
      ctx.transcript.push(p.name + ': ' + text);
      const line = knowledge.sanitize(p.name) + ' said: "' + text + '"';
      state.players.forEach(function (q) { memAppend(ctx, q.id, line); });
      ctx.news.push(line);
      console.log('  [Day ' + state.dayNumber + ' R' + round + ']' + (fb ? ' [FALLBACK]' : '') + ' ' + p.name + ': ' + text);
    }
  }
}

async function collectVoteBatch(ctx, dayInfo, accusedId, includeGhosts) {
  const state = ctx.state;
  const voters = [];
  living(state).forEach(function (p) { voters.push({ id: p.id, isGhost: false }); });
  if (includeGhosts) {
    state.players.forEach(function (p) {
      if (!p.isAlive && p.hasGhostVote && !p.ghostVoteSpent) voters.push({ id: p.id, isGhost: true });
    });
  }
  const jobFns = voters.map(function (v) {
    return function () {
      const extra = { accusedId: accusedId, isGhost: v.isGhost, dayAbilities: abilitiesOf(state, v.id) };
      const meta = knowledge.dayMeta(state, v.id, 'vote', extra);
      const identity = identityFor(ctx, engine._byId(state, v.id).assignedRole);
      const news = composeNews(ctx, v.id, 'Day ' + state.dayNumber + (v.isGhost ? ' (you are a ghost)' : ''));
      const prompt = knowledge.buildDayPrompt('vote', identity, ctx.memories[v.id], news, meta.decision, meta.schema);
      showPrompt(ctx, prompt, 'DAY');
      return ctx.ask(prompt,
        function (json) { return parseVoteJson(state, v, json); },
        function () { return fallbackVoteDecision(state, v, dayInfo, accusedId); });
    };
  });
  const results = await runPool(jobFns, CONCURRENCY);
  return voters.map(function (v, i) {
    return { voterId: v.id, isGhost: v.isGhost, decision: results[i].value, usedFallback: results[i].usedFallback };
  });
}

function applyDayReveals(ctx, decisions) {
  const state = ctx.state;
  decisions.forEach(function (r) {
    const p = engine._byId(state, r.voterId);
    if (p && p.isAlive && r.decision.reveal) {
      engine.mayorReveal(state, r.voterId);
      ctx.transcript.push(p.name + ' (Mayor) revealed');
      const line = knowledge.sanitize(p.name) + ' (Mayor) revealed';
      state.players.forEach(function (q) { memAppend(ctx, q.id, line); });
      ctx.news.push(line);
      console.log('  ' + (r.usedFallback ? '[FALLBACK] ' : '[LLM] ') + p.name + ' (Mayor) revealed');
    }
  });
}

function applyDayShots(ctx, decisions) {
  const state = ctx.state;
  for (let i = 0; i < decisions.length; i += 1) {
    const r = decisions[i];
    if (!r.decision.shootId) continue;
    const p = engine._byId(state, r.voterId);
    const target = engine._byId(state, r.decision.shootId);
    if (!p || !target) continue;
    const res = p.assignedRole === 'vigilante'
      ? engine.vigilanteShoot(state, r.voterId, r.decision.shootId)
      : engine.deputyShoot(state, r.voterId, r.decision.shootId);
    if (res) {
      ctx.transcript.push(target.name + ' was shot during the day.');
      memAppend(ctx, p.id, 'You shot ' + knowledge.sanitize(target.name) + '.');
      const line = knowledge.sanitize(target.name) + ' was shot during the day.';
      state.players.forEach(function (q) { if (q.id !== p.id) memAppend(ctx, q.id, line); });
      ctx.news.push(line);
      console.log('  ' + (r.usedFallback ? '[FALLBACK] ' : '[LLM] ') + target.name + ' was shot by ' + p.name + '.');
    }
  }
}

async function runVotes(ctx, dayInfo) {
  const state = ctx.state;
  let accusedId = state.trial.active ? state.trial.accusedId : null;
  if (accusedId == null) {
    const batch = await collectVoteBatch(ctx, dayInfo, null, false);
    applyDayReveals(ctx, batch);
    applyDayShots(ctx, batch);
    if (state.phase === 'END') return;
    for (let i = 0; i < batch.length; i += 1) {
      const r = batch[i];
      const voter = engine._byId(state, r.voterId);
      if (voter && voter.isAlive && r.decision.nominateId) {
        if (engine.startTrial(state, r.decision.nominateId, r.voterId)) {
          ctx.transcript.push(voter.name + ' nominates ' + engine._byId(state, r.decision.nominateId).name + ' for trial.');
          const line = knowledge.sanitize(voter.name) + ' nominated ' +
            knowledge.sanitize(engine._byId(state, r.decision.nominateId).name) + ' for trial.';
          state.players.forEach(function (q) { memAppend(ctx, q.id, line); });
          ctx.news.push(line);
          console.log('  ' + (r.usedFallback ? '[FALLBACK] ' : '[LLM] ') + voter.name + ' nominates ' +
            engine._byId(state, r.decision.nominateId).name + ' for trial.');
          break;
        }
      }
    }
    if (!state.trial.active) return;
    accusedId = state.trial.accusedId;
  }
  const batch = await collectVoteBatch(ctx, dayInfo, accusedId, true);
  applyDayReveals(ctx, batch);
  if (state.phase === 'END') return;
  castVotesAndResolve(ctx, batch, accusedId, dayInfo);
  if (state.phase === 'END') return;
  applyDayShots(ctx, batch);
}

function castVotesAndResolve(ctx, decisions, accusedId, dayInfo) {
  const state = ctx.state;
  const accused = engine._byId(state, accusedId);
  for (let i = 0; i < decisions.length; i += 1) {
    const r = decisions[i];
    const verdict = r.decision.verdict;
    if (verdict == null) continue;
    const voter = engine._byId(state, r.voterId);
    let ok;
    if (r.isGhost) {
      if (verdict === 'ABSTAIN') continue;
      ok = engine.castVote(state, { voterId: r.voterId, verdict: verdict, ghostToken: true });
    } else {
      ok = engine.castVote(state, { voterId: r.voterId, verdict: verdict, ghostToken: false });
    }
    if (!ok) continue;
    memAppend(ctx, r.voterId, 'You voted ' + verdict + ' on ' + (accused ? knowledge.sanitize(accused.name) : '?') + '.');
    if (r.usedFallback) {
      console.log('  [FALLBACK] vote ' + (r.isGhost ? 'ghost ' : '') + (voter ? voter.name : r.voterId) + ': ' + verdict);
    }
  }
  const res = engine.resolveTrial(state);
  let line = '=== Day ' + state.dayNumber + ': ' + (accused ? accused.name : '?') + ' accused; ';
  if (res && res.lynchedId) {
    const lynched = engine._byId(state, res.lynchedId);
    const classic = !!(state.houseRules || {}).classicReveal;
    const shown = classic ? engine.ROLES[lynched.assignedRole].name : '?? UNKNOWN ??';
    line += lynched.name + ' lynched (' + shown + ')';
    ctx.transcript.push(lynched.name + ' was lynched (' + shown + ').');
    dayInfo.lastLynched = res.lynchedId;
    if (res.jesterWin) line += ' - Jester wins!';
    if (res.executionerWin) line += ' - Executioner wins!';
    const mLine = knowledge.sanitize(lynched.name) + ' was lynched' +
      (classic ? ' (' + engine.ROLES[lynched.assignedRole].name + ')' : '') + '.';
    state.players.forEach(function (q) { memAppend(ctx, q.id, mLine); });
    ctx.news.push(mLine);
  } else {
    line += (accused ? accused.name + ' survived' : 'no trial') + ' (no lynch)';
    if (accused) {
      const mLine = knowledge.sanitize(accused.name) + ' survived the trial (no lynch).';
      state.players.forEach(function (q) { memAppend(ctx, q.id, mLine); });
      ctx.news.push(mLine);
    }
  }
  console.log(line + ' ===');
}

async function runNomination(ctx, dayInfo) {
  const state = ctx.state;
  let nominator = null;
  state.players.forEach(function (p) {
    if (nominator) return;
    if (p.isAlive && p.assignedRole === 'sheriff') nominator = p;
  });
  if (!nominator) {
    state.players.forEach(function (p) {
      if (nominator) return;
      if (p.isAlive && p.assignedRole === 'deputy' && p.inheritedRole === 'sheriff') nominator = p;
    });
  }
  if (!nominator) nominator = pick(living(state));
  if (!nominator) return;
  const meta = knowledge.dayMeta(state, nominator.id, 'nomination', {});
  const identity = identityFor(ctx, nominator.assignedRole);
  const news = composeNews(ctx, nominator.id, 'Day ' + state.dayNumber);
  const prompt = knowledge.buildDayPrompt('nomination', identity, ctx.memories[nominator.id], news, meta.decision, meta.schema);
  showPrompt(ctx, prompt, 'DAY');
  const res = await ctx.ask(prompt,
    function (json) { return json && (json.nominate == null || typeof json.nominate === 'string') ? { nominate: json.nominate } : null; },
    function () { return { nominate: fallback.fallbackNomination(state, nominator.id, dayInfo) }; });
  const accusedId = nameToId(state, res.value.nominate);
  if (accusedId != null && accusedId !== nominator.id && engine._byId(state, accusedId).isAlive) {
    if (engine.startTrial(state, accusedId, nominator.id)) {
      ctx.transcript.push(nominator.name + ' nominates ' + engine._byId(state, accusedId).name + ' for trial.');
      const line = knowledge.sanitize(nominator.name) + ' nominated ' + knowledge.sanitize(engine._byId(state, accusedId).name) + ' for trial.';
      state.players.forEach(function (q) { memAppend(ctx, q.id, line); });
      ctx.news.push(line);
      console.log('  ' + (res.usedFallback ? '[FALLBACK] ' : '[LLM] ') + nominator.name + ' nominates ' +
        engine._byId(state, accusedId).name + ' for trial.');
    }
  } else {
    const src = res.usedFallback ? 'FALLBACK' : 'LLM';
    const target = res.value.nominate == null || res.value.nominate === '' ? 'passes' :
      ' nominated an invalid target: ' + res.value.nominate;
    console.log('  [' + src + '] nomination: ' + nominator.name + ' ' + target);
  }
}

async function runDay(ctx) {
  const state = ctx.state;
  ctx.dayInfo.dayNumber = state.dayNumber;
  ctx.dayInfo.lastLynched = ctx.dayInfo.lastLynched || null;
  ctx.dayRound = 1;
  await runStatements(ctx, ctx.dayInfo);
  ctx.dayRound = 2;
  await runStatements(ctx, ctx.dayInfo);
  if (state.phase === 'END') return;
  await runNomination(ctx, ctx.dayInfo);
  if (state.phase === 'END') return;
  await runVotes(ctx, ctx.dayInfo);
}

function checkInvariants(state, ctxLabel) {
  const n = state.playerCount;
  if (!state.players || state.players.length !== n) throw new Error(ctxLabel + ': player count mismatch');
  const alive = living(state).length;
  const dead = state.players.length - alive;
  if (state.graveyard.length !== dead) {
    throw new Error(ctxLabel + ': graveyard length ' + state.graveyard.length + ' != dead ' + dead);
  }
  state.players.forEach(function (p) {
    if (!engine.ROLES[p.assignedRole]) throw new Error(ctxLabel + ': unknown role ' + p.assignedRole + ' for ' + p.name);
    if (!p.name) throw new Error(ctxLabel + ': player ' + p.id + ' has no name');
  });
  const gyIds = state.graveyard.map(function (g) { return g.playerId; });
  state.players.forEach(function (p) {
    if (!p.isAlive && gyIds.indexOf(p.id) === -1) {
      throw new Error(ctxLabel + ': dead player ' + p.name + ' missing from graveyard');
    }
  });
}

function roundTrip(state, ctxLabel) {
  const json = engine.serialize(state);
  const s2 = engine.deserialize(json);
  if (s2.phase !== state.phase) throw new Error(ctxLabel + ': round-trip phase mismatch');
  if (s2.players.length !== state.players.length) throw new Error(ctxLabel + ': round-trip player count mismatch');
  s2.players.forEach(function (p, i) {
    const o = state.players[i];
    if (p.assignedRole !== o.assignedRole || p.isAlive !== o.isAlive || p.name !== o.name) {
      throw new Error(ctxLabel + ': round-trip player ' + p.id + ' mismatch');
    }
  });
  if (s2.graveyard.length !== state.graveyard.length) throw new Error(ctxLabel + ': round-trip graveyard mismatch');
  if (s2.night.number !== state.night.number) throw new Error(ctxLabel + ': round-trip night mismatch');
}

function pad(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}

function printFinal(state) {
  const w = state.winner;
  console.log('=== GAME OVER ===');
  if (w) console.log('Winner: ' + w.winner + ' (' + w.reason + ')');
  console.log(pad('Name', 8) + pad('Role', 18) + pad('Team', 9) + 'Status');
  state.players.forEach(function (p) {
    const r = engine.ROLES[p.assignedRole];
    console.log(pad(p.name, 8) + pad(r.name, 18) + pad(r.team, 9) + (p.isAlive ? 'alive' : 'dead'));
  });
}

function parseArgs(argv) {
  const opts = { preset: null, players: 10, dryRun: false, showPrompts: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--preset') opts.preset = argv[i + 1];
    else if (a === '--players') opts.players = parseInt(argv[i + 1], 10);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--llm') opts.dryRun = false;
    else if (a === '--show-prompts') opts.showPrompts = true;
  }
  opts.debugPrompts = !!(process.env.LLM_DEBUG && String(process.env.LLM_DEBUG) !== '0');
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const presetKeys = Object.keys(engine.PRESETS);
  const presetId = opts.preset && engine.PRESETS[opts.preset] ? opts.preset : pick(presetKeys);
  const state = engine.createGame({ playerCount: opts.players, presetId: presetId });
  const names = [];
  for (let s = 1; s <= opts.players; s += 1) names.push({ seat: s, name: 'P' + s });
  engine.setPlayerNames(state, names);
  engine.dealRoles(state);
  fallback.initFallback(state);
  const memories = {};
  state.players.forEach(function (p) { memories[p.id] = knowledge.createMemory(p.id); });
  const identityCache = {};
  const ctx = {
    state: state,
    store: knowledge.newStore(state),
    memories: memories,
    identityCache: identityCache,
    turn: 1,
    news: [],
    transcript: [],
    dayInfo: { store: null, dayNumber: 0, lastLynched: null },
    ask: function (prompt, parseFn, fb) { return ask(prompt, parseFn, fb, opts.dryRun || opts.debugPrompts); },
    showPrompts: opts.showPrompts,
    debugPrompts: opts.debugPrompts,
    nightPromptsShown: 0,
    dayPromptsShown: 0
  };
  ctx.dayInfo.store = ctx.store;
  seedMemories(ctx);
  console.log('=== Town of Vibelm: ' + opts.players + ' players, preset ' + presetId + ' (' +
    engine.PRESETS[presetId].name + ') ===');
  let days = 0;
  while (state.phase !== 'END' && days < MAX_DAYS) {
    if (state.phase !== 'NIGHT') state.phase = 'NIGHT';
    await runNight(ctx);
    engine.resolveNight(state);
    ctx.turn += 1;
    knowledge.derivePrivateResults(state, ctx.store, ctx.memories, ctx.prevLogCount);
    fallback.syncFromStore(state, ctx.store, ctx.prevLogCount);
    roundTrip(state, 'after night ' + state.night.number);
    checkInvariants(state, 'after night ' + state.night.number);
    const ann = engine.getMorningAnnouncement(state);
    const mline = morningLine(state, ann);
    ctx.transcript.push(mline);
    console.log(mline);
    const mLines = morningMemoryLines(state, ann);
    ctx.news = mLines.slice();
    state.players.forEach(function (p) { mLines.forEach(function (l) { memAppend(ctx, p.id, l); }); });
    engine.beginDay(state);
    if (state.phase === 'END') break;
    await runDay(ctx);
    if (state.phase === 'END') break;
    ctx.turn += 1;
    days += 1;
  }
  if (state.phase !== 'END') engine.endGame(state);
  roundTrip(state, 'final');
  checkInvariants(state, 'final');
  printFinal(state);
  const winner = state.winner ? state.winner.winner : 'NONE';
  console.log('=== GAME OVER: ' + winner + ' wins after ' + state.dayNumber + ' days ===');
  console.log('RESULT: preset=' + presetId + ' players=' + opts.players + ' days=' + days + ' winner=' + winner);
}

main().catch(function (e) {
  console.error('FATAL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
