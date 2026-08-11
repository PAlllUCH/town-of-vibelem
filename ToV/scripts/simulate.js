'use strict';

const engine = require('../js/engine.js');

const PRESETS = Object.keys(engine.PRESETS).filter(function (p) { return engine.PRESETS[p]; });
const COUNTS = [8, 9, 10, 11, 12];
const MAX_DAYS = 30;

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr.length ? arr[randInt(arr.length)] : null; }
function living(state) { return state.players.filter(function (p) { return p.isAlive; }); }
function corpseIds(state) { return state.graveyard.map(function (g) { return g.playerId; }); }

function record(state, action) {
  if (!engine.recordNightAction(state, action)) {
    throw new Error('recordNightAction rejected ' + JSON.stringify(action));
  }
}

function guiltyVoterIds(state) {
  return (state.trial.votes || [])
    .filter(function (v) { return v.verdict === 'GUILTY'; })
    .map(function (v) { return v.voterId; })
    .filter(function (id) { var p = engine._byId ? engine._byId(state, id) : null; return p && p.isAlive; });
}

function runNight(state) {
  const steps = engine.getNightSteps(state);
  for (const step of steps) {
    const pos = step.position;
    if (pos >= 14) continue;
    if (pos === 6) {
      const leader = engine.mafiaKillActor(state);
      if (leader) {
        const t = pick(living(state).filter(function (p) { return p.id !== leader.id; }));
        if (t) record(state, { position: 6, roleId: leader.assignedRole, playerId: leader.id, targetId: t.id });
      }
      continue;
    }
    for (const role of step.roles) {
      const actors = state.players.filter(function (p) {
        if (p.assignedRole !== role) return false;
        if (pos === 0 && role === 'jester') {
          return !p.isAlive && state.jester && state.jester.haunted && state.jester.hauntTarget === null;
        }
        if (pos === 13 && role === 'medium') return true;
        return p.isAlive;
      });
      for (const actor of actors) {
        if (pos === 0 && role === 'veteran') {
          record(state, { position: 0, roleId: 'veteran', playerId: actor.id, extra: { alert: Math.random() < 0.3 } });
          continue;
        }
        if (pos === 0 && role === 'jester') {
          const gv = guiltyVoterIds(state);
          const t = pick(gv);
          if (t) record(state, { position: 0, roleId: 'jester', playerId: actor.id, targetId: t });
          continue;
        }
        if (pos === 13 && role === 'medium') {
          if (!actor.isAlive) {
            const t = pick(living(state));
            if (t) record(state, { position: 13, roleId: 'medium', playerId: actor.id, targetId: t.id });
          }
          continue;
        }
        const others = living(state).filter(function (p) { return p.id !== actor.id; });
        const corpses = corpseIds(state);
        if (pos === 2 && role === 'witch') {
          const ctrl = pick(others);
          if (ctrl) {
            const redir = Math.random() < 0.5
              ? pick(living(state).filter(function (p) { return p.id !== actor.id && p.id !== ctrl.id; }))
              : null;
            record(state, {
              position: 2, roleId: 'witch', playerId: actor.id, targetId: ctrl.id,
              extra: redir ? { controlRedirect: redir.id } : null
            });
          }
          continue;
        }
        if (pos === 3 && role === 'jailor') {
          const t = pick(others);
          if (t) {
            record(state, {
              position: 3, roleId: 'jailor', playerId: actor.id, targetId: t.id,
              extra: { jailorDecision: state.night.number === 1 ? 'SPARE' : (Math.random() < 0.4 ? 'EXECUTE' : 'SPARE') }
            });
          }
          continue;
        }
        if (pos === 5 && role === 'doctor') {
          const canSelf = Math.random() < 0.15;
          const t = canSelf ? actor : pick(others);
          if (t) record(state, { position: 5, roleId: 'doctor', playerId: actor.id, targetId: t.id });
          continue;
        }
        if (role === 'undertaker' || role === 'janitor' || role === 'retributionist' || role === 'amnesiac') {
          const t = pick(corpses);
          if (t) record(state, { position: pos, roleId: role, playerId: actor.id, targetId: t });
          continue;
        }
        const t = pick(others);
        if (t) record(state, { position: pos, roleId: role, playerId: actor.id, targetId: t.id });
      }
    }
  }
}

function runDay(state) {
  const shoot = function (p) {
    if (p.assignedRole === 'vigilante' && p.shotsFired < 3 && Math.random() < 0.4) {
      const t = pick(living(state).filter(function (x) { return x.id !== p.id; }));
      if (t) engine.vigilanteShoot(state, p.id, t.id);
    } else if (p.assignedRole === 'deputy' && !p.usedOncePerGame && Math.random() < 0.4) {
      const t = pick(living(state).filter(function (x) { return x.id !== p.id; }));
      if (t) engine.deputyShoot(state, p.id, t.id);
    } else if (p.assignedRole === 'mayor' && !p.revealed && Math.random() < 0.3) {
      engine.mayorReveal(state, p.id);
    }
  };
  living(state).slice().forEach(shoot);
  if (state.phase === 'END') return;
  if (Math.random() < 0.7) {
    const alive = living(state);
    if (alive.length >= 2) {
      const nom = pick(alive);
      const acc = pick(alive.filter(function (x) { return x.id !== nom.id; }));
      if (nom && acc && engine.startTrial(state, acc.id, nom.id)) {
        const voters = [];
        state.players.forEach(function (p) {
          if (p.isAlive) voters.push({ voterId: p.id, verdict: pick(['GUILTY', 'INNOCENT', 'ABSTAIN']), ghostToken: false });
          else if (p.hasGhostVote && !p.ghostVoteSpent) voters.push({ voterId: p.id, verdict: pick(['GUILTY', 'INNOCENT']), ghostToken: true });
        });
        voters.forEach(function (v) { engine.castVote(state, v); });
        engine.resolveTrial(state);
      }
    }
  }
}

function checkInvariants(state, ctx) {
  const n = state.playerCount;
  if (!state.players || state.players.length !== n) throw new Error(ctx + ': player count mismatch');
  const alive = living(state).length;
  const dead = state.players.length - alive;
  if (state.graveyard.length !== dead) throw new Error(ctx + ': graveyard length ' + state.graveyard.length + ' != dead ' + dead);
  state.players.forEach(function (p) {
    if (!engine.ROLES[p.assignedRole]) throw new Error(ctx + ': unknown role ' + p.assignedRole + ' for ' + p.name);
    if (!p.name) throw new Error(ctx + ': player ' + p.id + ' has no name');
  });
  const gyIds = state.graveyard.map(function (g) { return g.playerId; });
  state.players.forEach(function (p) {
    if (!p.isAlive && gyIds.indexOf(p.id) === -1) throw new Error(ctx + ': dead player ' + p.name + ' missing from graveyard');
  });
}

function roundTrip(state, ctx) {
  const json = engine.serialize(state);
  const s2 = engine.deserialize(json);
  if (s2.phase !== state.phase) throw new Error(ctx + ': round-trip phase mismatch');
  if (s2.players.length !== state.players.length) throw new Error(ctx + ': round-trip player count mismatch');
  s2.players.forEach(function (p, i) {
    const o = state.players[i];
    if (p.assignedRole !== o.assignedRole || p.isAlive !== o.isAlive || p.name !== o.name) {
      throw new Error(ctx + ': round-trip player ' + p.id + ' mismatch');
    }
  });
  if (s2.graveyard.length !== state.graveyard.length) throw new Error(ctx + ': round-trip graveyard mismatch');
  if (s2.night.number !== state.night.number) throw new Error(ctx + ': round-trip night mismatch');
}

function simulate(presetId, count) {
  const state = engine.createGame({ playerCount: count, presetId: presetId });
  const names = [];
  for (let s = 1; s <= count; s += 1) names.push({ seat: s, name: 'P' + s });
  engine.setPlayerNames(state, names);
  engine.dealRoles(state);
  let days = 0;
  while (state.phase !== 'END' && days < MAX_DAYS) {
    if (state.phase !== 'NIGHT') state.phase = 'NIGHT';
    runNight(state);
    engine.resolveNight(state);
    roundTrip(state, 'after night ' + state.night.number);
    checkInvariants(state, 'after night ' + state.night.number);
    engine.getMorningAnnouncement(state);
    engine.beginDay(state);
    if (state.phase === 'END') break;
    runDay(state);
    if (state.phase === 'END') break;
    days += 1;
  }
  if (state.phase !== 'END') engine.endGame(state);
  roundTrip(state, 'final');
  checkInvariants(state, 'final');
  return {
    preset: presetId,
    count: count,
    days: days,
    winner: state.winner ? state.winner.winner : 'NONE',
    phase: state.phase,
    deck: state.deck.slice()
  };
}

let failures = 0;
let runs = 0;
const results = [];
for (const preset of PRESETS) {
  for (const count of COUNTS) {
    runs += 1;
    try {
      const r = simulate(preset, count);
      results.push(r);
      console.log('OK  ' + preset + ' n=' + count + ' days=' + r.days + ' winner=' + r.winner + ' deck=' + r.deck.length);
    } catch (e) {
      failures += 1;
      console.log('FAIL ' + preset + ' n=' + count + ' ' + e.message);
      console.log(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : '');
    }
  }
}

console.log('---');
console.log(runs + ' runs, ' + failures + ' failures');
const winners = {};
results.forEach(function (r) { winners[r.winner] = (winners[r.winner] || 0) + 1; });
console.log('winner distribution: ' + JSON.stringify(winners));
process.exit(failures ? 1 : 0);
