'use strict';
(function (root) {
  var E = root.VillageEngine;

  E._byId = function (state, id) {
    return state.players[id - 1] || null;
  };

  function resetTransient(state) {
    state.graveyard = [];
    state.deathLog = [];
    state.ghosts = { ledgerEnabled: true };
    state.trial = { active: false, stage: null, accusedId: null, nominatorId: null, seconds: [], votes: [], sentenceVotes: [], dayTrialsDone: 0 };
    state.night = { number: 1, actions: [], lastJailTarget: null, lastBlackmailTarget: null, nightZeroDone: false };
    state.dayNumber = 0;
    state.winner = null;
    state.logs = [];
    state.playerLog = {};
    state.executionerConverted = false;
    state.jester = { haunted: false, hauntTarget: null };
    state.retributionist = { used: false };
    state.amnesiac = { used: false, rememberedRole: null };
    state.pendingInheritanceNote = '';
    state.morning = { deaths: [], revivals: [], inheritanceNote: '', blackmailTarget: null, forgedWills: [] };
    state.players.forEach(function (p) {
      p.inheritedRole = null;
      p.isAlive = true;
      p.isDrunk = false;
      p.diedBefore = false;
      p.hasGhostVote = false;
      p.ghostVoteSpent = false;
      p.nightTarget = null;
      p.jailorDecision = null;
      p.isRoleblocked = false;
      p.isProtected = false;
      p.framed = false;
      p.blackmailed = false;
      p.jailed = false;
      p.poisoned = false;
      p.alerted = false;
      p.cleaned = false;
      p.revealed = false;
      p.shotsFired = 0;
      p.executionsUsed = 0;
      p.alertsUsed = 0;
      p.usedOncePerGame = false;
      p.guiltPending = false;
    });
  }

  function assignSetupInfo(state) {
    state.executionerTarget = null;
    var exeIdx = state.deck.indexOf('executioner');
    if (exeIdx !== -1) {
      var townPlayers = state.players.filter(function (p) { return E.ROLES[p.assignedRole].team === 'TOWN'; });
      if (townPlayers.length > 0) {
        state.executionerTarget = townPlayers[E._randInt(townPlayers.length)].id;
      } else {
        var exe = state.players.find(function (p) { return p.assignedRole === 'executioner'; });
        if (exe) exe.assignedRole = 'jester';
        if (state.deck[exeIdx] === 'executioner') state.deck[exeIdx] = 'jester';
        state.logs.push('The Executioner had no eligible target, so they became a Jester.');
        if (exe) E._logPlayer(state, exe.id, 'SETUP', 'converted', 'Became a Jester: no eligible Executioner target existed.');
      }
    }
    state.gfBluffs = [];
    if (state.deck.indexOf('godfather') !== -1) {
      var pool = Object.keys(E.ROLES).filter(function (id) {
        return E.ROLES[id].team === 'TOWN' && state.deck.indexOf(id) === -1;
      });
      state.gfBluffs = E._shuffle(pool).slice(0, 3);
    }
    state.witchSide = 'MAFIA';
    E._computeStartKnowing(state);
  }

  function dealCommon(state, label) {
    state.deck = E._shuffle(state.deck.slice());
    state.players.forEach(function (p, i) { p.assignedRole = state.deck[i]; });
    resetTransient(state);
    assignSetupInfo(state);
    state.phase = 'SEATS';
    state.logs.push(label);
    return state;
  }

  E.createGame = function (opts) {
    opts = opts || {};
    var playerCount = opts.playerCount || 8;
    if (!Number.isInteger(playerCount) || playerCount < 6 || playerCount > 15) {
      throw new Error('playerCount must be an integer between 6 and 15');
    }
    var presetId = opts.presetId || 'p1';
    if (!E.PRESETS[presetId]) throw new Error('Unknown preset: ' + presetId);
    var hrOpts = opts.houseRules || {};
    var houseRules = {
      noKillN1: !!hrOpts.noKillN1,
      noLynchD1: hrOpts.noLynchD1 !== false,
      classicReveal: !!hrOpts.classicReveal,
      jailorNoExecN1: !!hrOpts.jailorNoExecN1
    };
    var teamCounts = null;
    if (opts.teamCounts != null) {
      var tc = opts.teamCounts;
      if (!tc || typeof tc.town !== 'number' || typeof tc.mafia !== 'number' ||
          typeof tc.neutral !== 'number' ||
          !Number.isInteger(tc.town) || !Number.isInteger(tc.mafia) || !Number.isInteger(tc.neutral) ||
          tc.town < 0 || tc.mafia < 0 || tc.neutral < 0) {
        throw new Error('teamCounts must be an object { town, mafia, neutral } of non-negative integers');
      }
      if (tc.town + tc.mafia + tc.neutral !== playerCount) {
        throw new Error('teamCounts must sum to the player count (' + playerCount +
          '), got ' + (tc.town + tc.mafia + tc.neutral));
      }
      teamCounts = { town: tc.town, mafia: tc.mafia, neutral: tc.neutral };
    }
    var deck = E._buildDeck(playerCount, presetId, teamCounts
      ? { town: opts.town, mafia: opts.mafia, neutral: opts.neutral, evil: opts.evil, civilians: opts.civilians, teamCounts: teamCounts }
      : opts);
    var players = [];
    for (var i = 1; i <= playerCount; i += 1) {
      players.push({
        id: i, name: '', seat: i,
        assignedRole: null, inheritedRole: null,
        isAlive: true, isDrunk: false, diedBefore: false,
        hasGhostVote: false, ghostVoteSpent: false,
        nightTarget: null, jailorDecision: null,
        isRoleblocked: false, isProtected: false, framed: false, blackmailed: false,
        jailed: false, poisoned: false, alerted: false, cleaned: false,
        revealed: false,
        shotsFired: 0, executionsUsed: 0, alertsUsed: 0,
        usedOncePerGame: false, guiltPending: false
      });
    }
    var state = {
      version: 1,
      playerCount: playerCount,
      presetId: presetId,
      houseRules: houseRules,
      deck: deck,
      players: players,
      graveyard: [],
      deathLog: [],
      ghosts: { ledgerEnabled: true },
      trial: { active: false, stage: null, accusedId: null, nominatorId: null, seconds: [], votes: [], sentenceVotes: [], dayTrialsDone: 0 },
      night: { number: 1, actions: [], lastJailTarget: null, lastBlackmailTarget: null, nightZeroDone: false },
      phase: 'SETUP',
      dayNumber: 0,
      logs: [],
      playerLog: {},
      winner: null,
      executionerTarget: null,
      executionerConverted: false,
      gfBluffs: [],
      witchSide: 'MAFIA',
      jester: { haunted: false, hauntTarget: null },
      retributionist: { used: false },
      amnesiac: { used: false, rememberedRole: null },
      pendingInheritanceNote: '',
      morning: { deaths: [], revivals: [], inheritanceNote: '', blackmailTarget: null, forgedWills: [] },
      staleDays: 0,
      maxStaleDays: Number.isInteger(opts.maxStaleDays) && opts.maxStaleDays >= 1 ? opts.maxStaleDays : 5,
      staleLynchSeen: 0,
      staleCycleLynches: 0,
      staleNightSeen: 0
    };
    state.logs.push('Game created: ' + playerCount + ' players, preset ' + presetId + '.');
    return state;
  };

  E.swapRoles = function (state, aId, bId) {
    var a = E._byId(state, aId);
    var b = E._byId(state, bId);
    if (!a || !b) throw new Error('swapRoles: unknown player id ' + aId + ' or ' + bId);
    if (String(aId) === String(bId)) throw new Error('swapRoles: cannot swap a player with themself');
    var tmp = a.assignedRole;
    a.assignedRole = b.assignedRole;
    b.assignedRole = tmp;
    var oldTarget = state.executionerTarget;
    if (oldTarget != null && (String(oldTarget) === String(aId) || String(oldTarget) === String(bId))) {
      var target = E._byId(state, oldTarget);
      var isLivingTown = target && target.isAlive &&
        E.ROLES[target.assignedRole] && E.ROLES[target.assignedRole].team === 'TOWN';
      if (!isLivingTown) {
        var next = state.players.find(function (p) {
          return p.isAlive && String(p.id) !== String(oldTarget) &&
            E.ROLES[p.assignedRole] && E.ROLES[p.assignedRole].team === 'TOWN';
        });
        if (next) {
          state.executionerTarget = next.id;
          state.logs.push('The Executioner\'s target was reassigned to ' + next.name + ' after a role swap.');
        } else {
          state.executionerTarget = null;
        }
      }
    }
    var ra = E.ROLES[a.assignedRole] || { name: a.assignedRole };
    var rb = E.ROLES[b.assignedRole] || { name: b.assignedRole };
    state.logs.push(a.name + ' and ' + b.name + ' swapped roles (' + ra.name + ' / ' + rb.name + ').');
    E._logPlayer(state, aId, 'SETUP', 'swap', 'Swapped roles with ' + b.name + '; now ' + ra.name + '.');
    E._logPlayer(state, bId, 'SETUP', 'swap', 'Swapped roles with ' + a.name + '; now ' + rb.name + '.');
    return state;
  };

  E._logPlayer = function (state, pid, at, kind, text) {
    if (!state.playerLog || typeof state.playerLog !== 'object') state.playerLog = {};
    var key = String(pid);
    if (!state.playerLog[key]) state.playerLog[key] = [];
    state.playerLog[key].push({ at: at, kind: kind, text: text });
  };

  E._logAt = function (state) {
    return state.phase === 'NIGHT' ? 'N' + state.night.number : 'D' + (state.dayNumber || 1);
  };

  E.setPlayerNames = function (state, entries) {
    if (!entries) return state;
    for (var i = 0; i < entries.length; i += 1) {
      var e = entries[i];
      var p = state.players.find(function (pl) { return pl.seat === e.seat; });
      if (p && typeof e.name === 'string') p.name = e.name;
    }
    state.logs.push('Player names recorded.');
    return state;
  };

  E.dealRoles = function (state) {
    return dealCommon(state, 'Roles dealt. The game is ready to begin.');
  };

  E.redeal = function (state) {
    return dealCommon(state, 'Roles redealt.');
  };

  E.assignRoles = function (state, seatToRole) {
    var n = state.playerCount;
    for (var s = 1; s <= n; s += 1) {
      if (!seatToRole || seatToRole[s] == null) {
        throw new Error('assignRoles: seat ' + s + ' is missing');
      }
    }
    var deckCounts = {};
    for (var i = 0; i < state.deck.length; i += 1) {
      var did = state.deck[i];
      deckCounts[did] = (deckCounts[did] || 0) + 1;
    }
    var assignedCounts = {};
    for (var j = 1; j <= n; j += 1) {
      var rid = seatToRole[j];
      if (!E.ROLES[rid]) throw new Error('assignRoles: unknown role ' + rid);
      assignedCounts[rid] = (assignedCounts[rid] || 0) + 1;
    }
    var allKeys = {};
    Object.keys(assignedCounts).forEach(function (k) { allKeys[k] = true; });
    Object.keys(deckCounts).forEach(function (k) { allKeys[k] = true; });
    var allMatch = true;
    var firstAbsent = null;
    Object.keys(allKeys).forEach(function (k) {
      var a = assignedCounts[k] || 0;
      var d = deckCounts[k] || 0;
      if (a !== d) {
        allMatch = false;
        if (d === 0 && firstAbsent === null) firstAbsent = k;
      }
    });
    if (!allMatch) {
      if (firstAbsent !== null) {
        throw new Error('assignRoles: role ' + firstAbsent + ' is not in the deck');
      }
      throw new Error('assignRoles: assigned roles do not match the deck');
    }
    state.players.forEach(function (p) { p.assignedRole = seatToRole[p.seat]; });
    resetTransient(state);
    assignSetupInfo(state);
    state.phase = 'SEATS';
    state.logs.push('Roles assigned.');
    state.players.forEach(function (p) {
      var rn = E.ROLES[p.assignedRole] ? E.ROLES[p.assignedRole].name : p.assignedRole;
      E._logPlayer(state, p.id, 'SETUP', 'set', rn + ' assigned.');
    });
    return state;
  };

  E.serialize = function (state) {
    return JSON.stringify(state);
  };

  E.deserialize = function (jsonString) {
    var data;
    try {
      data = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Invalid save data: not valid JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('Invalid save data: not an object');
    if (!Number.isInteger(data.playerCount) || data.playerCount < 6 || data.playerCount > 15) {
      throw new Error('Invalid save data: playerCount');
    }
    if (!Array.isArray(data.players) || data.players.length !== data.playerCount) {
      throw new Error('Invalid save data: players');
    }
    if (!Array.isArray(data.deck)) throw new Error('Invalid save data: deck');
    for (var i = 0; i < data.players.length; i += 1) {
      var p = data.players[i];
      if (!p || !Number.isInteger(p.id) || p.id < 1 || p.id > data.playerCount) {
        throw new Error('Invalid save data: player id');
      }
      if (typeof p.name !== 'string') throw new Error('Invalid save data: player name');
      if (typeof p.isAlive !== 'boolean') throw new Error('Invalid save data: player isAlive');
      if (typeof p.assignedRole !== 'string' || !E.ROLES[p.assignedRole]) p.assignedRole = 'civilian';
      if (!Number.isInteger(p.seat) || p.seat < 1 || p.seat > data.playerCount) p.seat = p.id;
      ['jailed', 'poisoned', 'alerted', 'cleaned'].forEach(function (flag) {
        if (typeof p[flag] !== 'boolean') p[flag] = false;
      });
      ['hasGhostVote', 'ghostVoteSpent', 'revealed', 'usedOncePerGame', 'guiltPending',
        'isRoleblocked', 'isProtected', 'framed', 'blackmailed', 'isDrunk'].forEach(function (flag) {
        if (typeof p[flag] !== 'boolean') p[flag] = false;
      });
      ['shotsFired', 'executionsUsed', 'alertsUsed'].forEach(function (field) {
        if (!Number.isInteger(p[field])) p[field] = 0;
      });
      if (p.inheritedRole == null) p.inheritedRole = null;
      if (p.nightTarget == null) p.nightTarget = null;
      if (p.jailorDecision == null) p.jailorDecision = null;
    }
    if (!data.houseRules || typeof data.houseRules !== 'object') data.houseRules = {};
    if (typeof data.houseRules.jailorNoExecN1 !== 'boolean') data.houseRules.jailorNoExecN1 = false;
    if (!Array.isArray(data.graveyard)) data.graveyard = [];
    data.players.forEach(function (pl) {
      if (typeof pl.diedBefore !== 'boolean') {
        pl.diedBefore = data.graveyard.some(function (e) { return e.playerId === pl.id; });
      }
    });
    if (!Array.isArray(data.deathLog)) data.deathLog = [];
    if (!data.trial || typeof data.trial !== 'object') {
      data.trial = { active: false, stage: null, accusedId: null, nominatorId: null, seconds: [], votes: [], sentenceVotes: [], dayTrialsDone: 0 };
    }
    if (data.trial.stage !== 'SECONDS' && data.trial.stage !== 'VOTE' && data.trial.stage !== 'SENTENCE') data.trial.stage = null;
    if (!Array.isArray(data.trial.seconds)) data.trial.seconds = [];
    if (!Array.isArray(data.trial.votes)) data.trial.votes = [];
    if (!Array.isArray(data.trial.sentenceVotes)) data.trial.sentenceVotes = [];
    if (!Number.isInteger(data.trial.dayTrialsDone)) data.trial.dayTrialsDone = 0;
    if (!data.ghosts || typeof data.ghosts !== 'object' || Array.isArray(data.ghosts)) data.ghosts = { ledgerEnabled: false };
    else if (typeof data.ghosts.ledgerEnabled !== 'boolean') data.ghosts.ledgerEnabled = false;
    if (!data.night || typeof data.night !== 'object') data.night = { number: 1, actions: [], lastJailTarget: null, lastBlackmailTarget: null, nightZeroDone: false };
    if (!Array.isArray(data.night.actions)) data.night.actions = [];
    if (data.night.number == null) data.night.number = 1;
    if (data.night.nightZeroDone == null) data.night.nightZeroDone = false;
    if (data.night.lastJailTarget == null) data.night.lastJailTarget = null;
    if (data.night.lastBlackmailTarget == null) data.night.lastBlackmailTarget = null;
    if (!data.jester || typeof data.jester !== 'object') data.jester = { haunted: false, hauntTarget: null };
    if (!data.retributionist || typeof data.retributionist !== 'object') data.retributionist = { used: false };
    if (!data.amnesiac || typeof data.amnesiac !== 'object') data.amnesiac = { used: false, rememberedRole: null };
    if (!Array.isArray(data.logs)) data.logs = [];
    if (!data.playerLog || typeof data.playerLog !== 'object' || Array.isArray(data.playerLog)) data.playerLog = {};
    if (!data.morning || typeof data.morning !== 'object') data.morning = { deaths: [], revivals: [], inheritanceNote: '', blackmailTarget: null, forgedWills: [] };
    if (!Array.isArray(data.morning.deaths)) data.morning.deaths = [];
    if (!Array.isArray(data.morning.revivals)) data.morning.revivals = [];
    if (data.morning.blackmailTarget == null) data.morning.blackmailTarget = null;
    if (!Array.isArray(data.morning.forgedWills)) data.morning.forgedWills = [];
    if (typeof data.executionerConverted !== 'boolean') data.executionerConverted = false;
    if (data.pendingInheritanceNote == null) data.pendingInheritanceNote = '';
    if (typeof data.phase !== 'string' || !data.phase) data.phase = 'SETUP';
    if (!Number.isInteger(data.dayNumber)) data.dayNumber = 0;
    if (typeof data.presetId !== 'string' || !E.PRESETS[data.presetId]) data.presetId = 'p1';
    if (data.executionerTarget == null) data.executionerTarget = null;
    if (!Array.isArray(data.gfBluffs)) data.gfBluffs = [];
    if (data.witchSide !== 'TOWN' && data.witchSide !== 'MAFIA') data.witchSide = 'MAFIA';
    if (!Number.isInteger(data.maxStaleDays) || data.maxStaleDays < 1) data.maxStaleDays = 5;
    if (!Number.isInteger(data.staleDays) || data.staleDays < 0) data.staleDays = 0;
    var staleLynches = 0;
    for (var sl = 0; sl < data.graveyard.length; sl += 1) {
      if (data.graveyard[sl] && data.graveyard[sl].deathCause === 'lynched by the town') staleLynches += 1;
    }
    if (!Number.isInteger(data.staleLynchSeen)) data.staleLynchSeen = staleLynches;
    if (!Number.isInteger(data.staleCycleLynches)) data.staleCycleLynches = staleLynches;
    if (!Number.isInteger(data.staleNightSeen)) {
      data.staleNightSeen = Math.max(0, (Number.isInteger(data.night.number) ? data.night.number : 1) - 1);
    }
    if (data.version == null) data.version = 1;
    return data;
  };
})(typeof window !== 'undefined' ? window : globalThis);
