'use strict';

const engine = require('../../js/engine.js');
const { Population, Agent } = require('./agent.js');
const fs = require('fs');

const PRESET = process.argv[2] || 'p1';
const PLAYER_COUNT = parseInt(process.argv[3]) || 11;
const POPULATION_SIZE = parseInt(process.argv[4]) || 20;
const GENERATIONS = parseInt(process.argv[5]) || 10;
const GAMES_PER_EVAL = parseInt(process.argv[6]) || 10;
const MAX_DAYS = 25;
const OUTPUT_FILE = process.argv[7] || 'training-result.json';

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr.length ? arr[randInt(arr.length)] : null; }
function living(state) { return state.players.filter(function (p) { return p.isAlive; }); }
function byId(state, id) { return state.players[id - 1] || null; }
function teamOfRole(roleId) { const r = engine.ROLES[roleId]; return r ? r.team : 'NEUTRAL'; }

function createMemory() {
  return {
    suspicions: {},
    confirmedTown: {},
    confirmedMafia: {},
    deadRoles: {},
    visitedBy: {},
    trackedTargets: {},
    lookoutVisitors: {},
    lastLynchTarget: null,
    lastLynchVotes: null,
    dayCount: 0,
    claims: {},
    roleId: null,
    team: null,
    side: null,
    isMafia: false,
    inheritedSheriff: false,
    ownSheriffResults: {},
    sheriffPublic: {},
    consigliereResults: {},
    learnedRoles: {},
    attacked: {},
    avoid: {},
    cleanedCorpses: {},
    inspectedCorpses: {},
    voteHistory: {},
    mafiaMembers: {},
    killTarget: null,
    lastKillTarget: null,
    lastJailed: null,
    lastBlackmail: null,
    lastLynchAccusedId: null,
    lastLynchAccusedKnownSuspicious: false,
    lastLynchAccusedKnownTown: false,
    announced: {},
    bluffPool: null
  };
}

function makeMemories(state) {
  const memories = {};
  const mafiaIds = {};
  state.players.forEach(function (p) {
    if (engine.ROLES[p.assignedRole].team === 'MAFIA') mafiaIds[p.id] = true;
  });
  state.players.forEach(function (p) {
    const role = engine.ROLES[p.assignedRole];
    const mem = createMemory();
    mem.roleId = p.assignedRole;
    mem.team = role.team;
    mem.isMafia = role.team === 'MAFIA';
    mem.side = p.assignedRole === 'witch' ? (state.witchSide === 'TOWN' ? 'TOWN' : 'MAFIA') : role.team;
    if (mem.isMafia) {
      Object.keys(mafiaIds).forEach(function (k) { mem.mafiaMembers[Number(k)] = true; });
    }
    memories[p.id] = mem;
  });
  return memories;
}

function checkSuspicious(state, player) {
  if (!player) return false;
  const gfLike = player.assignedRole === 'godfather';
  if (gfLike) return false;
  const skLike = player.assignedRole === 'serialkiller';
  if (skLike) return true;
  return teamOfRole(player.assignedRole) === 'MAFIA';
}

function morningUpdate(state, memories, recorded, notes) {
  const strip = function (note) { if (note) note.text = note.text.replace(/:$/, ''); };
  
  const effTargets = [];
  const voided = [];
  recorded.forEach(function (a) {
    if (a.position === 0 && a.roleId === 'veteran' && a.extra && a.extra.alert) {
      recorded.forEach(function (x) {
        if (x.targetId === a.playerId && x.position !== 0) voided.push(x.playerId);
      });
    }
  });
  
  const witchAction = recorded.find(function (a) { return a.position === 2 && a.roleId === 'witch'; });
  const witchControl = witchAction && witchAction.extra && witchAction.extra.controlRedirect ? {
    controlledId: witchAction.targetId,
    redirect: witchAction.extra.controlRedirect
  } : null;
  
  recorded.forEach(function (a) {
    if (a.position === 13) return;
    const actor = byId(state, a.playerId);
    if (!actor || !actor.isAlive || actor.isRoleblocked || actor.jailed) return;
    if (voided.indexOf(a.playerId) !== -1) return;
    const target = a.targetId != null ? byId(state, a.targetId) : null;
    if (!target || !target.isAlive) return;
    let effTid = a.targetId;
    if (witchControl && a.playerId === witchControl.controlledId) {
      effTid = witchControl.redirect;
    } else if (a.extra && a.extra.controlRedirect) {
      effTid = a.extra.controlRedirect;
    }
    effTargets.push({ playerId: a.playerId, targetId: effTid });
  });
  
  const getEff = function (pid) {
    for (var i = 0; i < effTargets.length; i += 1) {
      if (effTargets[i].playerId === pid) return effTargets[i].targetId;
    }
    return null;
  };
  
  recorded.forEach(function (a) {
    if (a.position !== 11) return;
    const actor = byId(state, a.playerId);
    const t = a.targetId != null ? byId(state, a.targetId) : null;
    const note = notes.find(function (n) { return n.kind && n.playerId === a.playerId && n.targetId === a.targetId; });
    const acted = !!actor && actor.isAlive && !!t && t.isAlive && !actor.isRoleblocked && !actor.jailed;
    const amem = memories[a.playerId];
    if (!amem) return;
    const isSheriffLike = amem.roleId === 'sheriff' || amem.inheritedSheriff;
    if (isSheriffLike && (a.roleId === 'sheriff' || a.roleId === 'deputy')) {
      if (acted) {
        let r = t.framed ? 'SUSPICIOUS' : (checkSuspicious(state, t) ? 'SUSPICIOUS' : 'INNOCENT');
        if (actor.isDrunk) r = r === 'SUSPICIOUS' ? 'INNOCENT' : 'SUSPICIOUS';
        amem.ownSheriffResults[a.targetId] = r;
        if (note) note.text += ' ' + r;
      } else strip(note);
    } else if (a.roleId === 'consigliere') {
      if (acted) {
        let learned = t.assignedRole;
        if (actor.isDrunk) {
          const aligned = teamOfRole(t.assignedRole);
          const pool = Object.keys(engine.ROLES).filter(function (id) { return engine.ROLES[id].team !== aligned; });
          learned = pool[randInt(pool.length)];
        }
        state.players.forEach(function (p) {
          const pm = memories[p.id];
          if (pm && pm.isMafia) pm.consigliereResults[a.targetId] = learned;
        });
        if (note) note.text += ' ' + engine.ROLES[learned].name;
      } else strip(note);
    } else if (a.roleId === 'undertaker') {
      const entry = state.graveyard.find(function (e) { return e.playerId === a.targetId; });
      if (entry && entry.inspectedByUndertaker && !amem.inspectedCorpses[a.targetId]) {
        amem.inspectedCorpses[a.targetId] = true;
        amem.deadRoles[a.targetId] = entry.trueRole;
        if (note) note.text += ' ' + engine.ROLES[entry.trueRole].name;
      } else strip(note);
    } else if (a.roleId === 'tracker') {
      if (acted) {
        const eff = getEff(a.targetId);
        amem.trackedTargets[a.targetId] = eff;
        const m = state.morning || { deaths: [] };
        if (eff != null && m.deaths.some(function (d) { return d.playerId === eff; })) {
          amem.suspicions[a.targetId] = 'SUSPICIOUS';
        }
        if (note) note.text += eff != null ? ': visited ' + byId(state, eff).name : ': visited no one';
      } else strip(note);
    } else if (a.roleId === 'lookout') {
      if (acted) {
        const visitors = effTargets.filter(function (x) {
          return x.targetId === a.targetId && x.playerId !== a.playerId;
        }).map(function (x) { return x.playerId; });
        amem.lookoutVisitors[a.targetId] = visitors;
        if (note) note.text += visitors.length ? ': ' + visitors.map(function (x) { return byId(state, x).name; }).join(', ') + ' visited' : ': no visitors';
      } else strip(note);
    }
  });
  
  recorded.forEach(function (a) {
    if (a.position !== 9 || a.roleId !== 'serialkiller') return;
    const sk = byId(state, a.playerId);
    if (!sk || !sk.isAlive) return;
    const sm = memories[sk.id];
    const target = a.targetId != null ? byId(state, a.targetId) : null;
    if (!target || !sm) return;
    sm.attacked[target.id] = true;
    if (target.isAlive) sm.suspicions[target.id] = 'SUSPICIOUS';
  });
  
  const m = state.morning || { deaths: [], revivals: [] };
  (m.deaths || []).forEach(function (d) {
    state.players.forEach(function (p) {
      const pm = memories[p.id];
      if (d.wasCleaned) pm.cleanedCorpses[d.playerId] = true;
      else pm.deadRoles[d.playerId] = d.trueRole;
    });
  });
  (m.revivals || []).forEach(function (id) {
    state.players.forEach(function (p) { memories[p.id].confirmedTown[id] = true; });
  });
  
  if (m.inheritanceNote) {
    const dep = state.players.find(function (p) { return p.assignedRole === 'deputy' && p.inheritedRole === 'sheriff'; });
    if (dep && memories[dep.id]) memories[dep.id].inheritedSheriff = true;
  }
}

function dayClaims(state, memories) {
  state.players.forEach(function (p) {
    if (!p.isAlive) return;
    const mem = memories[p.id];
    let claim;
    if (mem.team === 'TOWN') claim = mem.roleId;
    else if (mem.team === 'MAFIA') {
      const townRoles = ['sheriff', 'doctor', 'veteran', 'civilian'];
      claim = townRoles[randInt(townRoles.length)];
    } else claim = 'civilian';
    mem.claims[p.id] = claim;
    state.players.forEach(function (q) { memories[q.id].claims[p.id] = claim; });
  });
}

function sheriffReport(state, memories) {
  state.players.forEach(function (p) {
    const mem = memories[p.id];
    const isSheriff = mem.roleId === 'sheriff' || mem.inheritedSheriff;
    if (!p.isAlive || !isSheriff) return;
    Object.keys(mem.ownSheriffResults).forEach(function (k) {
      const tid = Number(k);
      if (mem.announced[tid]) return;
      mem.announced[tid] = true;
      const res = mem.ownSheriffResults[k];
      state.players.forEach(function (q) { memories[q.id].sheriffPublic[tid] = res; });
    });
  });
}

function runGame(population, preset, playerCount) {
  const state = engine.createGame({ playerCount: playerCount, presetId: preset });
  const names = [];
  for (let s = 1; s <= playerCount; s += 1) names.push({ seat: s, name: 'P' + s });
  engine.setPlayerNames(state, names);
  engine.dealRoles(state);
  
  const memories = makeMemories(state);
  const agents = {};
  
  state.players.forEach(function (p) {
    agents[p.id] = new Agent(playerCount, p.assignedRole);
  });
  
  let days = 0;
  while (state.phase !== 'END' && days < MAX_DAYS) {
    if (state.phase !== 'NIGHT') state.phase = 'NIGHT';
    const recorded = [], notes = [];
    
    const steps = engine.getNightSteps(state);
    for (const step of steps) {
      const pos = step.position;
      if (pos >= 14) continue;
      
      if (pos === 6) {
        const leader = engine.mafiaKillActor(state);
        if (leader) {
          const mem = memories[leader.id];
          const cands = living(state).filter(function (p) {
            return !mem.mafiaMembers[p.id] && !mem.avoid[p.id];
          });
          if (cands.length) {
            const target = agents[leader.id].decideNightTarget(state, memories, leader.id, cands.map(function (p) { return p.id; }));
            if (target) {
              engine.recordNightAction(state, {
                position: 6, roleId: leader.assignedRole, playerId: leader.id, targetId: target
              });
              recorded.push({ position: 6, roleId: leader.assignedRole, playerId: leader.id, targetId: target });
              notes.push({ pos: 6, text: 'Mafia killed ' + byId(state, target).name });
              mem.killTarget = target;
            }
          }
        }
        continue;
      }
      
      for (const role of step.roles) {
        const actors = state.players.filter(function (p) {
          if (p.assignedRole !== role) return false;
          if (pos === 0 && role === 'jester') return !p.isAlive && state.jester.haunted && state.jester.hauntTarget === null;
          if (pos === 13 && role === 'medium') return true;
          return p.isAlive;
        });
        
        for (const actor of actors) {
          const agent = agents[actor.id];
          const mem = memories[actor.id];
          
          if (pos === 0 && role === 'veteran') {
            const alert = Math.random() < 0.3;
            engine.recordNightAction(state, { position: 0, roleId: 'veteran', playerId: actor.id, extra: { alert: alert } });
            recorded.push({ position: 0, roleId: 'veteran', playerId: actor.id, extra: { alert: alert } });
            if (alert) notes.push({ pos: 0, text: actor.name + ' (Veteran) went on alert' });
          } else if (pos === 0 && role === 'jester') {
            const guiltyVoters = (state.trial.votes || []).filter(function (v) {
              return v.verdict === 'GUILTY' && byId(state, v.voterId) && byId(state, v.voterId).isAlive;
            }).map(function (v) { return v.voterId; });
            if (guiltyVoters.length) {
              const target = pick(guiltyVoters);
              engine.recordNightAction(state, { position: 0, roleId: 'jester', playerId: actor.id, targetId: target });
              recorded.push({ position: 0, roleId: 'jester', playerId: actor.id, targetId: target });
            }
          } else if (pos === 3 && role === 'jailor') {
            const ex = [actor.id];
            if (mem.lastJailed != null) ex.push(mem.lastJailed);
            const cands = living(state).filter(function (p) {
              return ex.indexOf(p.id) === -1;
            });
            if (cands.length) {
              const target = agent.decideNightTarget(state, memories, actor.id, cands.map(function (p) { return p.id; }));
              if (target) {
                const canExecute = state.night.number > 1;
                const decision = canExecute && Math.random() < 0.5 ? 'EXECUTE' : 'SPARE';
                engine.recordNightAction(state, {
                  position: 3, roleId: 'jailor', playerId: actor.id, targetId: target,
                  extra: { jailorDecision: decision }
                });
                recorded.push({
                  position: 3, roleId: 'jailor', playerId: actor.id, targetId: target,
                  extra: { jailorDecision: decision }
                });
                notes.push({ pos: 3, text: actor.name + ' (Jailor) jailed ' + byId(state, target).name + ', ' + decision.toLowerCase() });
                mem.lastJailed = target;
              }
            }
          } else if (pos === 5 && role === 'doctor') {
            const cands = living(state).filter(function (p) { return p.id !== actor.id; });
            const target = agent.decideNightTarget(state, memories, actor.id, cands.map(function (p) { return p.id; }).concat([actor.id]));
            if (target) {
              engine.recordNightAction(state, { position: 5, roleId: 'doctor', playerId: actor.id, targetId: target });
              recorded.push({ position: 5, roleId: 'doctor', playerId: actor.id, targetId: target });
              notes.push({ pos: 5, text: actor.name + ' (Doctor) protected ' + byId(state, target).name });
            }
          } else if (pos === 9 && role === 'serialkiller') {
            const cands = living(state).filter(function (p) { return p.id !== actor.id; });
            if (cands.length) {
              const target = agent.decideNightTarget(state, memories, actor.id, cands.map(function (p) { return p.id; }));
              if (target) {
                engine.recordNightAction(state, { position: 9, roleId: 'serialkiller', playerId: actor.id, targetId: target });
                recorded.push({ position: 9, roleId: 'serialkiller', playerId: actor.id, targetId: target });
                notes.push({ pos: 9, text: actor.name + ' (Serial Killer) attacked ' + byId(state, target).name });
              }
            }
          } else if (pos === 11) {
            if (role === 'sheriff' || (role === 'deputy' && mem.inheritedSheriff)) {
              const checked = Object.keys(mem.ownSheriffResults).map(Number);
              const ex = [actor.id].concat(checked);
              const cands = living(state).filter(function (p) {
                return ex.indexOf(p.id) === -1;
              });
              if (cands.length) {
                const target = agent.decideNightTarget(state, memories, actor.id, cands.map(function (p) { return p.id; }));
                if (target) {
                  engine.recordNightAction(state, { position: 11, roleId: role, playerId: actor.id, targetId: target });
                  recorded.push({ position: 11, roleId: role, playerId: actor.id, targetId: target });
                }
              }
            }
          }
        }
      }
    }
    
    engine.resolveNight(state);
    
    state.players.forEach(function (p) {
      const m = memories[p.id];
      if (m.roleId === 'jailor') m.lastJailed = state.night.lastJailTarget;
      if (m.roleId === 'blackmailer') m.lastBlackmail = state.night.lastBlackmailTarget;
    });
    
    if (state.jester.hauntTarget) {
      notes.push({ pos: 0, text: 'Jester haunted ' + byId(state, state.jester.hauntTarget).name });
    }
    
    morningUpdate(state, memories, recorded, notes);
    engine.beginDay(state);
    
    if (state.phase === 'END') break;
    
    dayClaims(state, memories);
    sheriffReport(state, memories);
    
    const mayor = state.players.find(function (p) {
      return p.isAlive && memories[p.id].roleId === 'mayor' && !p.revealed;
    });
    if (mayor && state.dayNumber >= 2) {
      engine.mayorReveal(state, mayor.id);
      state.players.forEach(function (p) { memories[p.id].confirmedTown[mayor.id] = true; });
    }
    
    const townAlive = living(state).filter(function (p) {
      return memories[p.id].side === 'TOWN';
    });
    
    if (townAlive.length > 1) {
      const sheriff = townAlive.find(function (p) {
        const m = memories[p.id];
        return m.roleId === 'sheriff' || m.inheritedSheriff;
      });
      const nominator = sheriff || pick(townAlive);
      
      if (nominator) {
        let accused = null;
        let bestScore = -1;
        
        living(state).forEach(function (p) {
          if (p.id === nominator.id) return;
          const mem = memories[nominator.id];
          let score = 0;
          if (mem.ownSheriffResults[p.id] === 'SUSPICIOUS') score += 4;
          if (mem.sheriffPublic[p.id] === 'SUSPICIOUS') score += 3;
          if (!mem.claims[p.id]) score += 1;
          
          if (score > bestScore) {
            bestScore = score;
            accused = p;
          }
        });
        
        if (accused && engine.startTrial(state, accused.id, nominator.id)) {
          state.players.forEach(function (p) {
            if (p.isAlive) {
              const agent = agents[p.id];
              const verdict = agent.getVoteVerdict(state, memories, p.id, accused.id);
              engine.castVote(state, { voterId: p.id, verdict: verdict, ghostToken: false });
            } else if (p.hasGhostVote && !p.ghostVoteSpent) {
              const mem = memories[p.id];
              let verdict = 'ABSTAIN';
              if (mem.ownSheriffResults[accused.id] === 'SUSPICIOUS') verdict = 'GUILTY';
              else if (mem.sheriffPublic[accused.id] === 'SUSPICIOUS') verdict = 'GUILTY';
              else if (mem.confirmedTown[accused.id]) verdict = 'INNOCENT';
              
              if (verdict !== 'ABSTAIN') {
                engine.castVote(state, { voterId: p.id, verdict: verdict, ghostToken: true });
              }
            }
          });
          
          const res = engine.resolveTrial(state);
          
          state.players.forEach(function (p) {
            const m = memories[p.id];
            const vote = (state.trial.votes || []).find(function (v) { return v.voterId === p.id; });
            m.voteHistory[p.id] = vote ? vote.verdict : 'ABSTAIN';
            m.lastLynchAccusedId = accused.id;
          });
        }
      }
    }
    
    if (state.phase === 'END') break;
    days += 1;
  }
  
  if (state.phase !== 'END') engine.endGame(state);
  
  const winner = state.winner ? state.winner.winner : 'nobody';
  
  state.players.forEach(function (p) {
    const agent = agents[p.id];
    const mem = memories[p.id];
    
    if (winner === 'TOWN' && mem.team === 'TOWN') {
      agent.fitness += 10;
    } else if (winner === 'MAFIA' && mem.team === 'MAFIA') {
      agent.fitness += 10;
    } else if (winner === 'SERIAL_KILLER' && mem.roleId === 'serialkiller') {
      agent.fitness += 10;
    }
    
    if (mem.roleId === 'sheriff' || mem.inheritedSheriff) {
      let correctChecks = 0;
      Object.keys(mem.ownSheriffResults).forEach(function (k) {
        const p = byId(state, Number(k));
        if (p && mem.ownSheriffResults[k] === 'SUSPICIOUS' && checkSuspicious(state, p)) {
          correctChecks++;
        }
      });
      agent.fitness += correctChecks * 2;
    }
    
    if (mem.roleId === 'doctor') {
      const protected = living(state).filter(function (p) {
        return p.isAlive && !state.graveyard.some(function (e) {
          return e.playerId === p.id && e.cause.includes('killed');
        });
      });
      agent.fitness += protected.length;
    }
    
    agent.gamesPlayed++;
  });
  
  return { winner: winner, days: days };
}

function train() {
  const population = new Population(POPULATION_SIZE, PLAYER_COUNT);
  const results = { generations: [], bestFitness: [], avgFitness: [] };
  
  console.log('Starting training: ' + GENERATIONS + ' generations, ' + POPULATION_SIZE + ' agents, ' + GAMES_PER_EVAL + ' games per eval');
  
  for (let gen = 0; gen < GENERATIONS; gen++) {
    console.log('Generation ' + (gen + 1) + '/' + GENERATIONS);
    
    population.agents.forEach(function (agent) {
      agent.resetFitness();
      
      for (let g = 0; g < GAMES_PER_EVAL; g++) {
        runGame(population, PRESET, PLAYER_COUNT);
      }
    });
    
    const best = population.getBest();
    const avg = population.getAverage();
    
    console.log('  Best fitness: ' + best.getFitness() + ', Average: ' + avg.toFixed(2));
    
    results.generations.push(gen + 1);
    results.bestFitness.push(best.getFitness());
    results.avgFitness.push(avg);
    
    if (gen < GENERATIONS - 1) {
      population.select();
    }
  }
  
  const bestAgent = population.getBest();
  results.bestAgent = bestAgent.serialize();
  results.finalGeneration = population.generation;
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log('Training complete. Results saved to ' + OUTPUT_FILE);
  
  return results;
}

train();
