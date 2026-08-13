'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  UI.renderGameHeader = function (state, cfg, app) {
    var label = 'Session';
    if (state.phase === 'NIGHT') label = 'Night ' + Math.max(1, state.night.number || 1);
    else if (state.phase === 'MORNING') label = 'Morning ' + Math.max(1, state.dayNumber || 1);
    else if (state.phase === 'DAY') label = 'Day ' + Math.max(1, state.dayNumber || 1);
    else if (state.phase === 'END') label = 'Session Over';
    return '<div class="card card-head">' +
      '<strong>' + label + '</strong>' +
      '<button class="btn btn-sm' + (app.whispersOpen ? ' on' : '') + '" data-action="toggle-whispers">Whispers</button>' +
      '<button class="btn btn-sm' + (app.claimsOpen ? ' on' : '') + '" data-action="toggle-claims">Claims</button>' +
      '<button class="btn btn-sm" data-action="toggle-seat-overlay">Seats</button>' +
      '<button class="btn btn-sm" data-action="toggle-logs">Log</button></div>' +
      UI.flowStrip(state.phase);
  };

  UI.renderGame = function (state, cfg, app) {
    var body = '';
    var bar = '';
    if (app.seatOverlay) {
      body += '<div class="card"><div class="card-head"><h2>Seat Grid</h2>' +
        '<button class="btn btn-sm" data-action="toggle-seat-overlay">Close</button></div>' +
        UI.seatTiles(state, app.rolesHidden, cfg) + '</div>';
    }
    if (state.phase === 'NIGHT') {
      body += UI.nightWizard(state, cfg, app);
      bar = '<button class="btn btn-primary btn-bar" data-action="resolve-night">Resolve Night</button>';
    } else if (state.phase === 'MORNING') {
      body += morningView(state, cfg, app);
      bar = '<button class="btn btn-primary btn-bar" data-action="begin-day">Begin Day</button>';
    } else if (state.phase === 'DAY') {
      body += dayView(state, cfg, app);
      bar = dayBar(state, app);
    } else {
      body += '<p class="muted">Session over.</p>';
    }
    body += logsCard(state, app);
    return { body: body, bar: bar };
  };

  function morningView(state, cfg, app) {
    var ann;
    try { ann = E.getMorningAnnouncement(state); } catch (e) { ann = {}; }
    ann = ann || {};
    var html = '<div class="card"><h2>Morning Announcement</h2>';
    if (ann.forgedWills && ann.forgedWills.length) {
      ann.forgedWills.forEach(function (f) {
        html += '<div class="notice accent">A will was forged for ' + UI.esc(f.targetName) + '.</div>';
      });
    }
    if (ann.revivals && ann.revivals.length) {
      html += '<div class="notice ok"><strong>Revived:</strong> ' + ann.revivals.map(UI.esc).join(', ') + '</div>';
    }
    if (ann.inheritanceNote) {
      html += '<div class="notice accent">' + UI.esc(ann.inheritanceNote) + '</div>';
    }
    if (ann.deaths && ann.deaths.length) {
      ann.deaths.forEach(function (d) {
        html += '<div class="death-card"><div class="death-head">' +
          '<strong>' + UI.esc(d.name) + '</strong><span class="tag tag-bad">DEAD</span></div>' +
          '<div class="death-role">' + UI.esc(d.roleShown || '?? UNKNOWN ??') + '</div>' +
          '<div class="death-cause">' + UI.esc(d.cause || '') + '</div></div>';
      });
    } else {
      html += '<div class="notice ok">No deaths last night.</div>';
    }
    var freshNight = Math.max(1, (state.night && state.night.number || 1) - 1);
    html += UI.whisperResultCard(state, app, freshNight);
    html += '<div class="notice">Read the announcements above to the table, then tap <strong>Begin Day</strong>.</div>';
    html += '</div>';
    return html;
  }

  function dayAbilities(state) {
    var html = '<div class="btn-col">';
    var vig = null, dep = null, may = null;
    (state.players || []).forEach(function (p) {
      if (!p.isAlive) return;
      if (p.assignedRole === 'vigilante') vig = p;
      if (p.assignedRole === 'deputy') dep = p;
      if (p.assignedRole === 'mayor') may = p;
    });
    if (vig) {
      var maxUses = (E.ROLES && E.ROLES.vigilante && E.ROLES.vigilante.maxUses) || 3;
      var left = Math.max(0, maxUses - (vig.shotsFired || 0));
      html += '<button class="btn" data-action="day-ability" data-ability="vigilante" ' +
        (left > 0 ? '' : 'disabled') + '>Vigilante Shot (' + left + ' left)</button>';
    }
    if (dep && !dep.usedOncePerGame) {
      html += '<button class="btn" data-action="day-ability" data-ability="deputy">Deputy Shoot (once)</button>';
    }
    if (may && !may.revealed) {
      html += '<button class="btn" data-action="day-ability" data-ability="mayor">Mayor Reveal</button>';
    }
    if (!vig && !dep && !may) {
      html += '<p class="muted">No day abilities available.</p>';
    }
    html += '</div>';
    return html;
  }

  function tallyChips(state) {
    var votes = (state.trial && state.trial.votes) || [];
    var g = 0, i = 0, a = 0;
    votes.forEach(function (v) {
      var voter = UI.findPlayer(state, v.voterId);
      var weight = 1;
      if (voter && voter.isAlive && voter.revealed && voter.assignedRole === 'mayor') weight = 3;
      if (v.verdict === 'GUILTY') g += weight;
      else if (v.verdict === 'INNOCENT') i += weight;
      else a += weight;
    });
    return '<div class="tally">' +
      '<span class="tally-chip g">GUILTY ' + g + '</span>' +
      '<span class="tally-chip i">INNOCENT ' + i + '</span>' +
      '<span class="tally-chip a">ABSTAIN ' + a + '</span></div>';
  }

  function ghostTokens(state) {
    var holders = UI.dead(state.players).filter(function (p) {
      return p.hasGhostVote && !p.ghostVoteSpent;
    });
    if (!holders.length) return '';
    return '<p class="muted small">Ghost tokens: ' +
      holders.map(function (p) { return UI.esc(p.name); }).join(', ') +
      '. Ghost votes spend the token; a revealed Mayor counts as 3.</p>';
  }

  function secondsTally(state) {
    var tr = state.trial || {};
    var needed = Math.floor(UI.living(state.players).length / 2) + 1;
    var agree = 1;
    (tr.seconds || []).forEach(function (s) {
      if (String(s.voterId) === String(tr.accusedId) || String(s.voterId) === String(tr.nominatorId)) return;
      if (s.agree) agree += 1;
    });
    return { agree: agree, needed: needed };
  }

  function trialView(state, cfg, app) {
    var tr = state.trial;
    var html = '<div class="card"><div class="card-head"><h2>Trial</h2></div>';
    if (app.lastTrialResult) {
      var r = app.lastTrialResult;
      var msg;
      if (r.result === 'CANCELLED') {
        msg = '<strong>Not enough support</strong> &mdash; nomination fell.';
      } else if (r.result === 'SURVIVES') {
        msg = '<strong>Not enough guilty votes</strong> - the accused survives.';
      } else if (r.lynchedId) {
        msg = '<strong>Lynched:</strong> ' + UI.esc(UI.nameOf(state, r.lynchedId));
      } else {
        msg = '<strong>Acquitted:</strong> no one was lynched';
      }
      html += '<div class="notice' + (r.result === 'LYNCHED' ? ' notice-critical' : ' ok') + '">' + msg +
        (r.jesterWin ? '<br><strong>The Jester wins!</strong>' : '') +
        (r.executionerWin ? '<br><strong>The Executioner wins!</strong>' : '') +
        (r.victory ? '<br>' + UI.esc(r.victory.winner || 'Victory!') : '') +
        '</div>';
      html += '<button class="btn btn-block" data-action="clear-trial">OK</button>';
      html += '</div>';
      return html;
    }
    if (!tr || !tr.active) {
      if (app.trialStage === 'nominator') {
        html += '<p class="wizard-label">Who nominates?</p>' + livingBtns(state, 'pick-nom');
      } else if (app.trialStage === 'accused') {
        html += '<p class="wizard-label">Who is accused?</p>' + livingBtns(state, 'pick-acc', app.trialNom);
      } else {
        html += '<button class="btn btn-block" data-action="start-trial">Start Trial</button>';
        html += '<p class="muted small">At most one lynch per day. A nomination needs a majority of living players to second it.</p>';
      }
    } else if (tr.stage === 'SECONDS') {
      html += '<p><strong>Accused:</strong> ' + UI.esc(UI.nameOf(state, tr.accusedId)) +
        ' &nbsp;<strong>Nominated by:</strong> ' + UI.esc(UI.nameOf(state, tr.nominatorId)) + '</p>';
      var tally = secondsTally(state);
      var pct = tally.needed > 0 ? Math.round((tally.agree / tally.needed) * 100) : 0;
      html += '<div class="tally tally-progress" style="--p:' + pct + '">' +
        '<span class="tally-chip g">SECONDS ' + tally.agree + ' of ' +
        tally.needed + '</span></div>';
      html += '<p class="muted small">The nominator counts as agreeing. The nomination needs ' + tally.needed +
        ' agreeing votes to proceed.</p>';
      UI.living(state.players).forEach(function (p) {
        if (String(p.id) === String(tr.accusedId)) return;
        var isNom = String(p.id) === String(tr.nominatorId);
        var rec = null;
        (tr.seconds || []).forEach(function (s) {
          if (String(s.voterId) === String(p.id)) rec = s;
        });
        var agree = isNom ? true : !!(rec && rec.agree);
        var disagree = !isNom && !!rec && !rec.agree;
        html += '<div class="voter-row">' +
          '<span class="voter-name">' + UI.esc(p.name) +
          (isNom ? ' <span class="muted">(nominator)</span>' : '') + '</span><span class="vote-btns">';
        if (isNom) {
          html += '<button class="btn btn-vote on" disabled>Agree</button>';
        } else {
          html += '<button class="btn btn-vote' + (agree ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
            UI.esc(p.id) + '" data-verdict="AGREE" data-ghost="0">Agree</button>' +
            '<button class="btn btn-vote' + (disagree ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
            UI.esc(p.id) + '" data-verdict="DISAGREE" data-ghost="0">Disagree</button>';
        }
        html += '</span></div>';
      });
      html += '<button class="btn btn-primary btn-block" data-action="resolve-trial">Resolve Nomination</button>';
    } else {
      html += '<div class="notice ok">Nomination accepted &mdash; voting begins.</div>';
      html += '<p><strong>Accused:</strong> ' + UI.esc(UI.nameOf(state, tr.accusedId)) +
        ' &nbsp;<strong>Nominated by:</strong> ' + UI.esc(UI.nameOf(state, tr.nominatorId)) + '</p>';
      var t2 = secondsTally(state);
      html += '<p class="muted small">Nomination seconded (' + t2.agree + ' of ' + t2.needed +
        ') - the trial proceeds to a vote.</p>';
      html += tallyChips(state);
      html += ghostTokens(state);
      var voters = [];
      UI.living(state.players).forEach(function (p) {
        voters.push({ p: p, ghost: false });
      });
      UI.dead(state.players).forEach(function (p) {
        if (p.hasGhostVote && !p.ghostVoteSpent) voters.push({ p: p, ghost: true });
      });
      var votesBy = {};
      (tr.votes || []).forEach(function (v) {
        votesBy[String(v.voterId) + (v.ghostToken ? 'g' : 'l')] = v.verdict;
      });
      voters.forEach(function (v) {
        var key = String(v.p.id) + (v.ghost ? 'g' : 'l');
        var cur = votesBy[key];
        html += '<div class="voter-row' + (v.ghost ? ' ghost-voter' : '') + '">' +
          '<span class="voter-name">' + UI.esc(v.p.name) + (v.ghost ? ' <span class="muted small">(ghost &middot; G/I only)</span>' : '') + '</span>' +
          '<span class="vote-btns">' +
          '<button class="btn btn-vote' + (cur === 'GUILTY' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(v.p.id) + '" data-verdict="GUILTY" data-ghost="' + (v.ghost ? '1' : '0') + '">Guilty</button>' +
          '<button class="btn btn-vote' + (cur === 'INNOCENT' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(v.p.id) + '" data-verdict="INNOCENT" data-ghost="' + (v.ghost ? '1' : '0') + '">Innocent</button>' +
          (v.ghost ? '' :
            '<button class="btn btn-vote' + (cur === 'ABSTAIN' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
            UI.esc(v.p.id) + '" data-verdict="ABSTAIN" data-ghost="0">Abstain</button>') +
          '</span></div>';
      });
    }
    html += '</div>';
    return html;
  }

  function dayTimerView(app) {
    var running = !!app.dayTimerEnds;
    var html = '<div class="card"><h2>Discussion Timer</h2>' +
      '<div class="timer-wrap">' +
      '<div class="timer-ring' + (running ? '' : ' idle') + '"' +
      (running ? ' data-timer-seconds="180" data-timer-kind="day"' : '') +
      ' style="--p:100">' +
      '<span class="timer-count">' + (running ? '' : '--') + '</span></div>' +
      '<div class="btn-row timer-btns">' +
      '<button class="btn" data-action="start-day-timer" data-seconds="60">60s</button>' +
      '<button class="btn" data-action="start-day-timer" data-seconds="120">120s</button>' +
      '<button class="btn" data-action="start-day-timer" data-seconds="180">180s</button>' +
      (running ? '<button class="btn" data-action="stop-day-timer">Stop</button>' : '') +
      '</div></div></div>';
    return html;
  }

  function dayView(state, cfg, app) {
    if (!app.claimRound && (state.dayNumber || 1) === 1) {
      var savedCR = null;
      try {
        var saved = window.APP.loadSave ? window.APP.loadSave() : null;
        savedCR = saved && saved.ui && saved.ui.claimRound ? saved.ui.claimRound : null;
      } catch (e) { savedCR = null; }
      app.claimRound = savedCR || { active: true, idx: 0, picker: null };
    }
    var html = '';
    html += UI.renderClaimRound(state, app);
    html += dayTimerView(app);
    html += '<div class="card"><h2>Day Abilities</h2>' + dayAbilities(state) + '</div>';
    if (app.picker) {
      var holder = null;
      if (app.picker.ability === 'vigilante' || app.picker.ability === 'deputy') {
        (state.players || []).forEach(function (pl) {
          if (pl.isAlive && pl.assignedRole === app.picker.ability) holder = pl;
        });
      }
      html += '<div class="card picker-card"><h2>' + UI.esc(app.picker.title) + '</h2>' +
        '<p class="muted small">' + UI.esc(app.picker.sub || '') + '</p>' +
        livingBtns(state, 'pick-day-target', holder ? holder.id : null, app.picker.ability) +
        '<button class="btn btn-block" data-action="picker-cancel">Cancel</button></div>';
    }
    html += trialView(state, cfg, app);
    return html;
  }

  function dayBar(state, app) {
    var b = '';
    if (app.picker) {
      b += '<button class="btn btn-bar" data-action="picker-cancel">Cancel</button>';
    }
    if (state.trial && state.trial.active && !app.lastTrialResult) {
      var lbl = state.trial.stage === 'SECONDS' ? 'Resolve Nomination' : 'Resolve Trial';
      b += '<button class="btn btn-primary btn-bar" data-action="resolve-trial">' + lbl + '</button>';
    }
    b += '<button class="btn btn-primary btn-bar" data-action="end-day">End Day</button>';
    return b;
  }

  function logsCard(state, app) {
    var logs = state.logs || [];
    var html = '<div class="card">' +
      '<button class="btn btn-sm" data-action="toggle-logs">Event Log (' + logs.length + ')</button>' +
      '<div class="logs' + (app.logsOpen ? ' open' : '') + '">' +
      (logs.length ? '<ul>' + logs.slice().reverse().map(function (l) {
        return '<li>' + UI.esc(l) + '</li>';
      }).join('') + '</ul>' : '<p class="muted small">No events yet.</p>') +
      '</div></div>';
    return html;
  }

  function livingBtns(state, action, exclude, ability) {
    var html = '<div class="btn-col">';
    UI.living(state.players).forEach(function (p) {
      if (exclude != null && String(exclude) === String(p.id)) return;
      html += '<button class="btn btn-actor" data-action="' + action + '" data-target="' + UI.esc(p.id) + '"' +
        (ability ? ' data-ability="' + UI.esc(ability) + '"' : '') + '>' +
        UI.esc(p.name) + ' \u00B7 ' + (p.assignedRole ? UI.roleName(p.assignedRole) : '?') + '</button>';
    });
    html += '</div>';
    return html;
  }
})();
