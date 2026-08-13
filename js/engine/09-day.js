'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.getMorningAnnouncement = function (state) {
    var m = state.morning || { deaths: [], revivals: [], inheritanceNote: '' };
    var classic = !!state.houseRules.classicReveal;
    return {
      deaths: m.deaths.map(function (d) {
        var roleShown = '?? UNKNOWN ??';
        if (classic && !d.wasCleaned && E.ROLES[d.trueRole]) roleShown = E.ROLES[d.trueRole].name;
        return { name: d.name, roleShown: roleShown, cause: d.cause };
      }),
      revivals: m.revivals.map(function (id) {
        var p = E._byId(state, id);
        return p ? p.name : String(id);
      }),
      inheritanceNote: m.inheritanceNote || '',
      forgedWills: m.forgedWills || []
    };
  };

  E.beginDay = function (state) {
    state.dayNumber += 1;
    state.phase = 'DAY';
    var bm = state.morning ? state.morning.blackmailTarget : null;
    state.players.forEach(function (p) { p.blackmailed = false; });
    if (bm) {
      var t = E._byId(state, bm);
      if (t) {
        t.blackmailed = true;
        E._logPlayer(state, t.id, 'D' + state.dayNumber, 'silenced', t.name + ' was silenced by blackmail for the day.');
      }
    }
    state.trial.dayTrialsDone = 0;
    var victory = E.checkVictory(state);
    return victory;
  };

  E.startTrial = function (state, accusedId, nominatorId) {
    var accused = E._byId(state, accusedId);
    var nominator = E._byId(state, nominatorId);
    if (state.trial.active) return false;
    if (!accused || !accused.isAlive) return false;
    if (!nominator || !nominator.isAlive) return false;
    if (accusedId === nominatorId) return false;
    if (state.trial.dayTrialsDone >= 1) return false;
    state.trial.active = true;
    state.trial.stage = 'SECONDS';
    state.trial.accusedId = accusedId;
    state.trial.nominatorId = nominatorId;
    state.trial.seconds = [];
    state.trial.votes = [];
    state.logs.push(nominator.name + ' nominates ' + accused.name + ' for trial.');
    var at = 'D' + (state.dayNumber || 1);
    E._logPlayer(state, nominatorId, at, 'nominated', 'Nominated ' + accused.name + ' for trial.');
    E._logPlayer(state, accusedId, at, 'nominated', 'Was nominated for trial by ' + nominator.name + '.');
    return true;
  };

  E.castVote = function (state, vote) {
    vote = vote || {};
    if (!state.trial.active) return false;
    var voter = E._byId(state, vote.voterId);
    if (!voter) return false;
    var at = 'D' + (state.dayNumber || 1);
    if (state.trial.stage === 'SECONDS') {
      if (vote.verdict !== 'AGREE' && vote.verdict !== 'DISAGREE') return false;
      if (!voter.isAlive) return false;
      if (vote.voterId === state.trial.accusedId) return false;
      var rec = { voterId: vote.voterId, agree: vote.verdict === 'AGREE' };
      var idx = state.trial.seconds.findIndex(function (s) { return s.voterId === vote.voterId; });
      var changed = idx < 0 || state.trial.seconds[idx].agree !== rec.agree;
      if (idx >= 0) state.trial.seconds[idx] = rec;
      else state.trial.seconds.push(rec);
      var acc = E._byId(state, state.trial.accusedId);
      if (changed) {
        E._logPlayer(state, vote.voterId, at, 'verdict', (rec.agree ? 'Seconded' : 'Opposed') + ' the nomination of ' +
          (acc ? acc.name : 'the accused') + '.');
      }
      return true;
    }
    if (state.trial.stage !== 'VOTE') return false;
    var verdict = vote.verdict;
    if (verdict !== 'GUILTY' && verdict !== 'INNOCENT' && verdict !== 'ABSTAIN') return false;
    var isGhost = !voter.isAlive;
    if (isGhost) {
      if (!E._spendGhostVote(voter, verdict, vote.ghostToken)) return false;
    }
    var record = { voterId: vote.voterId, verdict: verdict, ghostToken: !!vote.ghostToken };
    var ridx = state.trial.votes.findIndex(function (v) { return v.voterId === vote.voterId; });
    var vChanged = ridx < 0 || state.trial.votes[ridx].verdict !== verdict ||
      state.trial.votes[ridx].ghostToken !== record.ghostToken;
    if (ridx >= 0) state.trial.votes[ridx] = record;
    else state.trial.votes.push(record);
    var acc2 = E._byId(state, state.trial.accusedId);
    if (vChanged) {
      E._logPlayer(state, vote.voterId, at, 'verdict', 'Voted ' + verdict.toLowerCase() +
        (record.ghostToken ? ' (ghost token)' : '') + ' in the trial of ' + (acc2 ? acc2.name : 'the accused') + '.');
    }
    return true;
  };

  E.resolveTrial = function (state) {
    if (!state.trial.active) return null;
    var accused = E._byId(state, state.trial.accusedId);
    if (state.trial.stage === 'SECONDS') {
      var livingCount = state.players.filter(function (p) { return p.isAlive; }).length;
      var needed = Math.floor(livingCount / 2) + 1;
      var agree = 1;
      var secs = state.trial.seconds || [];
      for (var si = 0; si < secs.length; si += 1) {
        var s = secs[si];
        if (s.voterId === state.trial.accusedId || s.voterId === state.trial.nominatorId) continue;
        if (s.agree) agree += 1;
      }
      if (agree >= needed) {
        state.trial.stage = 'VOTE';
        state.trial.votes = [];
        return {
          result: 'ACCEPTED', stage: 'VOTE', agree: agree, needed: needed,
          lynchedId: null, jesterWin: false, executionerWin: false, victory: null
        };
      }
      state.trial.active = false;
      state.trial.stage = null;
      state.logs.push('The nomination of ' + (accused ? accused.name : 'the accused') +
        ' failed to gather enough seconds.');
      if (accused) {
        E._logPlayer(state, accused.id, E._logAt(state), 'acquitted', 'The trial ended without a lynch; the day continues.');
      }
      return {
        result: 'CANCELLED', agree: agree, needed: needed,
        lynchedId: null, jesterWin: false, executionerWin: false, victory: null
      };
    }
    var guilty = 0;
    var others = 0;
    for (var i = 0; i < state.trial.votes.length; i += 1) {
      var v = state.trial.votes[i];
      var voter = E._byId(state, v.voterId);
      var weight = 1;
      if (voter && voter.isAlive && voter.revealed && voter.assignedRole === 'mayor') weight = 3;
      if (v.verdict === 'GUILTY') guilty += weight;
      else others += weight;
    }
    var noLynchD1 = !!state.houseRules.noLynchD1 && state.dayNumber === 1;
    var lynch = guilty > others && !noLynchD1;
    var lynchedId = null;
    var jesterWin = false;
    var executionerWin = false;
    if (lynch && accused && accused.isAlive) {
      lynchedId = accused.id;
      state.trial.dayTrialsDone += 1;
      var isJesterLike = accused.assignedRole === 'jester' ||
        (accused.assignedRole === 'executioner' && state.executionerConverted);
      if (isJesterLike) jesterWin = true;
      E._recordDeath(state, accused.id, 'lynched by the town', true, jesterWin);
      state.logs.push(accused.name + ' was lynched by the town.');
      E._logPlayer(state, accused.id, E._logAt(state), 'lynched', 'Was lynched by the town.');
      if (accused.id === state.executionerTarget) executionerWin = true;
    }
    state.trial.active = false;
    state.trial.stage = null;
    E._updateInheritance(state);
    var victory = null;
    if (executionerWin) {
      victory = {
        winner: 'EXECUTIONER',
        survivors: E._livingSharers(state),
        reason: 'The Executioner\'s target was lynched by the town.'
      };
      state.winner = victory;
      state.phase = 'END';
      state.logs.push('The Executioner wins!');
    } else if (lynchedId) {
      victory = E.checkVictory(state);
      if (!victory && jesterWin) {
        state.jester.haunted = true;
        state.jester.hauntTarget = null;
        state.logs.push('The Jester wins and becomes a taunting ghost!');
      }
    } else if (accused) {
      E._logPlayer(state, accused.id, E._logAt(state), 'acquitted', 'The trial ended without a lynch; the day continues.');
    }
    var result = {
      result: lynchedId ? 'LYNCHED' : 'SURVIVES',
      lynchedId: lynchedId,
      guilty: guilty,
      others: others,
      jesterWin: jesterWin,
      executionerWin: executionerWin,
      victory: victory
    };
    return result;
  };

  E.vigilanteShoot = function (state, shooterId, targetId) {
    var shooter = E._byId(state, shooterId);
    var target = E._byId(state, targetId);
    if (!shooter || !target) return null;
    if (shooter.assignedRole !== 'vigilante' || !shooter.isAlive) return null;
    if (!target.isAlive || targetId === shooterId) return null;
    if (shooter.shotsFired >= 3) return null;
    shooter.shotsFired += 1;
    var guilty = E._alignmentOf(state, target) === 'TOWN';
    if (guilty) shooter.guiltPending = true;
    E._recordDeath(state, targetId, 'shot during the day', false, false);
    state.logs.push(target.name + ' was shot during the day.');
    E._logPlayer(state, shooterId, E._logAt(state), 'shot', shooter.name + ' shot ' + target.name + '.');
    E._logPlayer(state, targetId, E._logAt(state), 'shot', 'Was shot during the day.');
    E._updateInheritance(state);
    var victory = E.checkVictory(state);
    return { killedId: targetId, guilty: guilty, victory: victory };
  };

  E.deputyShoot = function (state, deputyId, targetId) {
    var deputy = E._byId(state, deputyId);
    var target = E._byId(state, targetId);
    if (!deputy || !target) return null;
    if (deputy.assignedRole !== 'deputy' || !deputy.isAlive) return null;
    if (deputy.usedOncePerGame) return null;
    if (!target.isAlive || targetId === deputyId) return null;
    deputy.usedOncePerGame = true;
    var guilty = E._alignmentOf(state, target) === 'TOWN';
    if (guilty) deputy.guiltPending = true;
    E._recordDeath(state, targetId, 'shot by the Deputy', false, false);
    state.logs.push('The Deputy publicly shot ' + target.name + '.');
    E._logPlayer(state, deputyId, E._logAt(state), 'shot', deputy.name + ' shot ' + target.name + '.');
    E._logPlayer(state, targetId, E._logAt(state), 'shot', 'Was shot by the Deputy.');
    E._updateInheritance(state);
    var victory = E.checkVictory(state);
    return { killedId: targetId, guilty: guilty, victory: victory };
  };

  E.mayorReveal = function (state, mayorId) {
    var mayor = E._byId(state, mayorId);
    if (!mayor) return null;
    if (mayor.assignedRole !== 'mayor' || !mayor.isAlive || mayor.revealed) return null;
    mayor.revealed = true;
    mayor.usedOncePerGame = true;
    state.logs.push('The Mayor has revealed!');
    E._logPlayer(state, mayorId, E._logAt(state), 'revealed', mayor.name + ' revealed as the Mayor (votes count 3).');
    return { revealed: true };
  };
})(typeof window !== 'undefined' ? window : globalThis);
