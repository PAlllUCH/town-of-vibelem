'use strict';

/*
 * knowledge.js - prompt building + per-player memory journal for the
 * LLM-agentic simulator. Pure functions, no IO. Player names are sanitized
 * (non-alphanumeric -> '_') everywhere an LLM can see them; engine
 * identifiers (role ids, positions, state fields) never appear in prompts.
 *
 * Every prompt is three small blocks: cached identity (static per role) +
 * bounded memory journal (per player) + short public news diff. The runner
 * owns the journals; this file only knows how to build and roll them up.
 * The structured store kept alongside is an internal channel for the
 * heuristic fallback layer, never part of any prompt.
 *
 * JSON contracts per role (the exact schemas shown to the LLM):
 *   veteran:          {"alert":true|false}
 *   poisoner, janitor, forger, blackmailer, framer, serialkiller, tracker,
 *   lookout, consigliere, undertaker, retributionist, amnesiac, escort,
 *   consort, doctor, sheriff:  {"target":"NAME"|null}
 *   witch:            {"control":"NAME","redirect":"NAME"|null}
 *   jailor:           {"jail":"NAME","decision":"EXECUTE"|"SPARE"}
 *   mafia kill:       {"kill":"NAME"}
 *   medium alive:     {"ledger":true}
 *   medium dead:      {"whisper":"NAME"}
 *   jester:           {"haunt":"NAME"}
 *   statement:        {"statement":"text"}
 *   vote:             {"vote":"GUILTY"|"INNOCENT"|"ABSTAIN","shoot":"NAME"|null,
 *                       "reveal":true|false,"nominate":"NAME"|null}
 */

const engine = require('../../js/engine.js');

const NAME_TO_ROLE_ID = {};
Object.keys(engine.ROLES).forEach(function (id) { NAME_TO_ROLE_ID[engine.ROLES[id].name] = id; });

function sanitize(name) {
  return String(name == null ? '' : name).replace(/[^A-Za-z0-9]/g, '_');
}

function roleIdByName(name) {
  return NAME_TO_ROLE_ID[name] || null;
}

function idByName(state, name) {
  if (name == null) return null;
  const raw = String(name).trim();
  const san = sanitize(raw);
  for (let i = 0; i < state.players.length; i += 1) {
    const p = state.players[i];
    if (p.name === raw || sanitize(p.name) === san) return p.id;
  }
  return null;
}

function living(state) {
  return state.players.filter(function (p) { return p.isAlive; });
}

function newPlayerStore() {
  return {
    checks: [], consigliere: [], tracks: [], watches: [], undertaker: [],
    witchLearned: [], jailed: [], mafiaKills: [], rememberedRole: null, actions: []
  };
}

function newStore(state) {
  const store = {};
  state.players.forEach(function (p) { store[p.id] = newPlayerStore(); });
  return store;
}

function createMemory(playerId) {
  return { id: playerId, turn: 0, digest: '', entries: [] };
}

function append(memory, text) {
  if (!memory) return memory;
  memory.entries.push({ turn: memory.turn || 0, text: String(text) });
  return memory;
}

function rollup(memory) {
  if (!memory || memory.entries.length <= 12) return memory;
  const dropped = memory.entries.splice(0, 6);
  const line = dropped.map(function (e) { return e.text; }).join(' | ');
  memory.digest = memory.digest ? memory.digest + ' | ' + line : line;
  return memory;
}

function memoryBlock(memory) {
  if (!memory) return 'Your memory so far: nothing yet.';
  const lines = ['Your memory so far:'];
  if (memory.digest) lines.push(memory.digest);
  const tail = memory.entries.slice(-10);
  tail.forEach(function (e) { lines.push('[T' + e.turn + '] ' + e.text); });
  if (lines.length === 1) lines.push('nothing yet.');
  while (lines.length > 16) lines.shift();
  return lines.join('\n');
}

function buildIdentity(role) {
  if (role === 'mafia') {
    return 'You are playing as the Mafia. The Mafia kills one player each night (Basic attack). The Godfather leads the kill and reads INNOCENT to the Sheriff.';
  }
  const r = engine.ROLES[role];
  if (!r) return 'You are playing a social deduction game.';
  return 'You are playing as ' + r.name + '. ' + r.name + ': ' + r.blurb;
}

function parseNightLine(line) {
  const m = /^\[Night (\d+)\] (.*)$/.exec(line);
  return m ? { night: Number(m[1]), text: m[2] } : null;
}

function stripDot(s) { return String(s).replace(/\.$/, ''); }

function sanitizeList(s) {
  return String(s).split(',').map(function (x) {
    const t = x.trim();
    const v = sanitize(/^no one\.?$/i.test(t) ? 'nobody' : t);
    return v === 'no_one' ? 'nobody' : v;
  }).join(', ');
}

function push(store, id, key, value) {
  if (!store[id]) store[id] = newPlayerStore();
  store[id][key].push(value);
}

const ACTOR_MARKERS = [
  { marker: ' (Sheriff) checks ', key: 'checks', map: function (rest) {
    const pp = split2(rest, ': '); return pp ? { target: sanitize(pp[0]), result: stripDot(pp[1]) } : null;
  } },
  { marker: ' (Consigliere) learns the role of ', key: 'consigliere', map: function (rest) {
    const pp = split2(rest, ': '); return pp ? { target: sanitize(pp[0]), role: stripDot(pp[1]) } : null;
  } },
  { marker: ' (Tracker) tracks ', key: 'tracks', map: function (rest) {
    const pp = split2(rest, ': '); return pp ? { target: sanitize(pp[0]), visited: sanitizeList(pp[1]) } : null;
  } },
  { marker: ' (Lookout) watches ', key: 'watches', map: function (rest) {
    const pp = split2(rest, ': '); return pp ? { target: sanitize(pp[0]), visitors: sanitizeList(pp[1]) } : null;
  } },
  { marker: ' (Undertaker) inspects the corpse of ', key: 'undertaker', map: function (rest) {
    const pp = split2(rest, ': '); return pp ? { target: sanitize(pp[0]), role: stripDot(pp[1]) } : null;
  } }
];

function split2(s, sep) {
  const idx = s.indexOf(sep);
  if (idx === -1) return null;
  return [s.slice(0, idx), s.slice(idx + sep.length)];
}

function appendMemory(memories, id, turn, text) {
  if (!memories || !memories[id]) return;
  memories[id].turn = turn;
  append(memories[id], text);
  rollup(memories[id]);
}

function resultLine(key, night, v) {
  const p = 'Night ' + night + ': ';
  switch (key) {
    case 'checks': return p + 'you checked ' + v.target + ': ' + v.result + '.';
    case 'consigliere': return p + 'you learned ' + v.target + ' is ' + v.role + '.';
    case 'tracks': return p + v.target + ' visited ' + v.visited + '.';
    case 'watches': return p + 'visitors to ' + v.target + ': ' + v.visitors + '.';
    case 'undertaker': return p + v.target + '\'s role was ' + v.role + '.';
    default: return p + v.target + '.';
  }
}

function derivePrivateResults(state, store, memories, prevLogCount) {
  const lines = state.logs.slice(prevLogCount || 0);
  for (let li = 0; li < lines.length; li += 1) {
    const t = parseNightLine(lines[li]);
    if (!t) continue;
    const text = t.text;
    try {
      if (text.indexOf('The Witch controls ') === 0) {
        const rest = text.slice('The Witch controls '.length);
        const parts = split2(rest, ' and learns their role: ');
        if (parts) {
          const witch = state.players.find(function (q) { return q.assignedRole === 'witch'; });
          if (witch) {
            push(store, witch.id, 'witchLearned', { night: t.night, target: sanitize(parts[0]), role: stripDot(parts[1]) });
            appendMemory(memories, witch.id, t.night, 'Night ' + t.night + ': you controlled ' + sanitize(parts[0]) + ' and learned they are ' + stripDot(parts[1]) + '.');
          }
        }
        continue;
      }
      if (text.indexOf('The Mafia killed ') === 0) {
        const target = sanitize(stripDot(text.slice('The Mafia killed '.length)));
        state.players.forEach(function (q) {
          const isFaction = engine.ROLES[q.assignedRole].team === 'MAFIA' ||
            (q.assignedRole === 'witch' && state.witchSide === 'MAFIA');
          if (isFaction) {
            push(store, q.id, 'mafiaKills', target);
            appendMemory(memories, q.id, t.night, 'Night ' + t.night + ': the Mafia killed ' + target + '.');
          }
        });
        continue;
      }
      if (text.indexOf('The Mafia kill is void') === 0) continue;
      let matched = false;
      for (let mi = 0; mi < ACTOR_MARKERS.length; mi += 1) {
        const mk = ACTOR_MARKERS[mi];
        const idx = text.indexOf(mk.marker);
        if (idx === -1) continue;
        const actor = text.slice(0, idx);
        const rest = text.slice(idx + mk.marker.length);
        const v = mk.map(rest);
        const id = idByName(state, actor);
        if (v && id != null) {
          v.night = t.night;
          push(store, id, mk.key, v);
          appendMemory(memories, id, t.night, resultLine(mk.key, t.night, v));
        }
        matched = true;
        break;
      }
      if (matched) continue;
      const jm = /^(.+) jailed (.+)\.$/.exec(text);
      if (jm) {
        const id = idByName(state, jm[1]);
        if (id != null) {
          push(store, id, 'jailed', sanitize(jm[2]));
          appendMemory(memories, id, t.night, 'Night ' + t.night + ': you jailed ' + sanitize(jm[2]) + '.');
        }
        continue;
      }
      const am = /^(.+) \(Amnesiac\) remembered the role of (.+): (.+)\.$/.exec(text);
      if (am) {
        const id = idByName(state, am[1]);
        if (id != null) {
          if (!store[id]) store[id] = newPlayerStore();
          store[id].rememberedRole = stripDot(am[3]);
          appendMemory(memories, id, t.night, 'Night ' + t.night + ': you remembered the role of ' + sanitize(am[2]) + ': ' + stripDot(am[3]) + '. You are now the ' + stripDot(am[3]) + '.');
        }
      }
    } catch (e) { /* un-routable result line: ignore silently */ }
  }
  return store;
}

function nightMeta(state, playerId, role) {
  const p = engine._byId(state, playerId);
  const r = engine.ROLES[role];
  const base = function (decision, schema) { return { name: r.name, blurb: r.blurb, decision: decision, schema: schema }; };
  switch (role) {
    case 'mafia':
      return {
        name: 'the Mafia',
        blurb: 'The Mafia kills one player each night (Basic attack). The Godfather leads the kill and reads INNOCENT to the Sheriff.',
        decision: 'Choose one living player for the Mafia to kill tonight.',
        schema: '{"kill":"NAME"}'
      };
    case 'veteran':
      return { name: r.name, blurb: r.blurb, decision: 'Do you go on alert? You have ' + (3 - p.alertsUsed) + ' alerts left.', schema: '{"alert":true|false}' };
    case 'witch':
      return base('Choose one living player to control, and optionally a redirect target (or null to keep their choice). You learn the controlled player\'s exact role.',
        '{"control":"NAME","redirect":"NAME"|null}');
    case 'jailor':
      return base('Choose one living player to jail and decide EXECUTE or SPARE' + (state.night.number === 1 ? ' (Night 1: you cannot execute, so decision must be SPARE)' : '') + '.',
        '{"jail":"NAME","decision":"EXECUTE"|"SPARE"}');
    case 'medium':
      if (p.isAlive) return { name: 'Medium (alive)', blurb: r.blurb, decision: 'Read the Ghost Ledger.', schema: '{"ledger":true}' };
      return { name: 'Medium (ghost)', blurb: r.blurb, decision: 'Choose one living player to whisper with tonight.', schema: '{"whisper":"NAME"}' };
    case 'jester':
      return {
        name: 'Jester (ghost)',
        blurb: 'You were lynched and won. You may haunt one player who voted GUILTY in your lynch trial to death tonight (Unstoppable).',
        decision: 'Choose one living player who voted GUILTY against you to haunt.',
        schema: '{"haunt":"NAME"}'
      };
    case 'deputy':
      return {
        name: 'Deputy (Sheriff badge)',
        blurb: 'You inherited the Sheriff badge. Each night, check one player: SUSPICIOUS for Mafia (except the Godfather) and the Serial Killer. Result inverts if you are Drunk.',
        decision: 'Choose one living player to check.',
        schema: '{"target":"NAME"}'
      };
    case 'doctor':
      return base('Choose one living player to protect from the first Basic attack against them. You may choose yourself.', '{"target":"NAME"|null}');
    case 'janitor':
      return base('Choose one dead player whose corpse you clean (its true role can then never be learned), or null.', '{"target":"NAME"|null}');
    case 'undertaker':
      return base('Choose one dead player whose corpse you inspect to learn their true role, or null.', '{"target":"NAME"|null}');
    case 'retributionist':
      return base('Choose one dead player to revive at morning (once per game), or null.', '{"target":"NAME"|null}');
    case 'amnesiac':
      return base('Choose one dead player whose role you permanently remember and become, or null.', '{"target":"NAME"|null}');
    default:
      return base('Choose one living player.', '{"target":"NAME"}');
  }
}

function dayMeta(state, playerId, kind, extra) {
  extra = extra || {};
  if (kind === 'statement') {
    return {
      decision: 'The town is discussing in rounds. You may say something or stay silent. Post a short public statement, or an empty string to stay silent.',
      schema: '{"statement":"one or two sentences (max 40 words) or empty string"}'
    };
  }
  if (kind === 'nomination') {
    return {
      decision: 'Nominate one living player to put on trial for lynching, or pass with null.',
      schema: '{"nominate":"NAME"|null}'
    };
  }
  const accused = extra.accusedId != null ? engine._byId(state, extra.accusedId) : null;
  const decision = [];
  if (accused) {
    decision.push('A trial is underway: ' + sanitize(accused.name) + ' has been nominated for lynching.');
    decision.push('Decision: vote GUILTY, INNOCENT or ABSTAIN.');
  } else {
    decision.push('No trial is underway. You may nominate one living player in the nominate field, or pass with null.');
  }
  if (!extra.isGhost) {
    const ab = extra.dayAbilities || {};
    if (ab.vigilanteShots > 0) {
      decision.push('You are the Vigilante with ' + ab.vigilanteShots + ' shot(s) left: you may shoot one living player today (shoot:"NAME") or null.');
    }
    if (ab.deputyShot) decision.push('You are the Deputy: once per game you may publicly shoot one living player (shoot:"NAME") or null.');
    if (ab.mayorReveal) decision.push('You are the Mayor: you may reveal yourself (reveal:true) to triple your vote weight, or reveal:false.');
  } else {
    decision.push('You are a ghost holding exactly one vote token. Your verdict must be GUILTY or INNOCENT (never ABSTAIN); voting spends your token.');
  }
  return {
    decision: decision.join(' '),
    schema: '{"vote":"GUILTY"|"INNOCENT"|"ABSTAIN","shoot":"NAME"|null,"reveal":true|false,"nominate":"NAME"|null}'
  };
}

function buildNightPrompt(identity, memory, news, decision, schema) {
  const parts = [];
  parts.push(identity || '');
  parts.push(memoryBlock(memory));
  parts.push('Public news since your last turn:\n' + (news || 'No new public news.'));
  parts.push('Decision: ' + decision);
  parts.push('Reply with ONLY JSON: ' + schema);
  return parts.join('\n\n');
}

function buildDayPrompt(kind, identity, memory, news, decision, schema) {
  const parts = [];
  parts.push(identity || '');
  parts.push(memoryBlock(memory));
  parts.push('Public news since your last turn:\n' + (news || 'No new public news.'));
  parts.push('Decision: ' + decision);
  parts.push('Reply with ONLY JSON: ' + schema);
  return parts.join('\n\n');
}

module.exports = {
  sanitize: sanitize,
  idByName: idByName,
  roleIdByName: roleIdByName,
  newStore: newStore,
  createMemory: createMemory,
  append: append,
  rollup: rollup,
  memoryBlock: memoryBlock,
  buildIdentity: buildIdentity,
  nightMeta: nightMeta,
  dayMeta: dayMeta,
  derivePrivateResults: derivePrivateResults,
  buildNightPrompt: buildNightPrompt,
  buildDayPrompt: buildDayPrompt
};
