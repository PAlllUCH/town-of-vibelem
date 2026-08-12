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
      if (t) t.blackmailed = true;
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
    state.trial.accusedId = accusedId;
    state.trial.nominatorId = nominatorId;
    state.trial.votes = [];
    state.logs.push(nominator.name + ' nominates ' + accused.name + ' for trial.');
    return true;
  };

  E.castVote = function (state, vote) {
    vote = vote || {};
    if (!state.trial.active) return false;
    var voter = E._byId(state, vote.voterId);
    if (!voter) return false;
    var verdict = vote.verdict;
    if (verdict !== 'GUILTY' && verdict !== 'INNOCENT' && verdict !== 'ABSTAIN') return false;
    var isGhost = !voter.isAlive;
    if (isGhost) {
      if (!E._spendGhostVote(voter, verdict, vote.ghostToken)) return false;
    }
    var record = { voterId: vote.voterId, verdict: verdict, ghostToken: !!vote.ghostToken };
    var idx = state.trial.votes.findIndex(function (v) { return v.voterId === vote.voterId; });
    if (idx >= 0) state.trial.votes[idx] = record;
    else state.trial.votes.push(record);
    return true;
  };

  E.resolveTrial = function (state) {
    if (!state.trial.active) return null;
    var accused = E._byId(state, state.trial.accusedId);
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
      var isJesterLike = accused.assignedRole === 'jester' ||
        (accused.assignedRole === 'executioner' && state.executionerConverted);
      if (isJesterLike) jesterWin = true;
      E._recordDeath(state, accused.id, 'lynched by the town', true, jesterWin);
      state.logs.push(accused.name + ' was lynched by the town.');
      if (accused.id === state.executionerTarget) executionerWin = true;
    }
    state.trial.active = false;
    state.trial.dayTrialsDone += 1;
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
    }
    return { lynchedId: lynchedId, jesterWin: jesterWin, executionerWin: executionerWin, victory: victory };
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
    return { revealed: true };
  };
})(typeof window !== 'undefined' ? window : globalThis);
