'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  UI.renderGameHeader = function (state, cfg, app) {
    var word = 'Over';
    var phaseAttr = 'END';
    var num = Math.max(1, state.dayNumber || 1);
    if (state.phase === 'NIGHT') { word = 'Night'; phaseAttr = 'NIGHT'; num = Math.max(1, state.night.number || 1); }
    else if (state.phase === 'MORNING') { word = 'Morning'; phaseAttr = 'MORNING'; num = Math.max(1, state.dayNumber || 1); }
    else if (state.phase === 'DAY') { word = 'Day'; phaseAttr = 'DAY'; num = Math.max(1, state.dayNumber || 1); }
    else if (state.phase === 'SEATS' || state.phase === 'SETUP') { word = 'Prep'; phaseAttr = 'PREP'; num = 1; }
    var label = word + (num !== '' ? ' ' + num : '');
    return '<div class="card card-head">' +
      '<div class="cycle-clock" data-phase="' + phaseAttr + '" data-cycle="' + num + '" aria-label="' + label + '">' +
      '<div class="cycle-clock-face">' +
      '<div class="cycle-clock-arc arc-prep"></div>' +
      '<div class="cycle-clock-arc arc-morning"></div>' +
      '<div class="cycle-clock-arc arc-day"></div>' +
      '<div class="cycle-clock-arc arc-night"></div>' +
      '<div class="cycle-clock-hand"></div>' +
      '</div>' +
      '<div class="cycle-clock-center">' +
      '<strong class="cycle-clock-num">' + num + '</strong>' +
      '<span class="cycle-clock-phase">' + word + '</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';
  };

  UI.renderGame = function (state, cfg, app) {
    var body = '';
    var bar = '';
    if (app.seatOverlay) {
      body += '<div class="card"><div class="card-head"><h2>Seat Grid</h2>' +
        '<button class="btn btn-sm" data-action="toggle-seat-overlay">Close</button></div>' +
        UI.seatTiles(state, app.rolesHidden, cfg, undefined, app.claims) + '</div>';
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
    if (app.picker) {
      var holder = null;
      if (app.picker.ability === 'vigilante' || app.picker.ability === 'deputy') {
        (state.players || []).forEach(function (pl) {
          if (pl.isAlive && pl.assignedRole === app.picker.ability) holder = pl;
        });
      }
      body += '<div class="card picker-card"><h2>' + UI.esc(app.picker.title) + '</h2>' +
        '<p class="muted small">' + UI.esc(app.picker.sub || '') + '</p>' +
        livingBtns(state, 'pick-day-target', holder ? holder.id : null, app.picker.ability) +
        '<button class="btn btn-block" data-action="picker-cancel">Cancel</button></div>';
    }
    body += logsCard(state, app);
    return { body: body, bar: bar };
  };

  UI.renderSidebar = function (state, app) {
    var items = [
      { label: app.mode === 'helper' ? 'Switch to App' : 'Switch to Helper', action: 'toggle-mode' },
      { label: 'Tokens', action: 'toggle-tokens' },
      { label: 'Claims', action: 'toggle-claims' },
      { label: 'Seats', action: 'toggle-seat-overlay' },
      { label: 'Log', action: 'toggle-logs' },
      { label: 'Mod', action: 'toggle-mod' },
      { label: 'Roles', action: 'toggle-reference' }
    ];
    var h = '';
    items.forEach(function (item) {
      h += '<div class="sidebar-item" data-action="' + item.action + '">' + UI.esc(item.label) + '</div>';
    });
    return h;
  };

  UI.renderSidebarLog = function (state) {
    var logs = (state.logs || []).slice(-20);
    return logs.map(function (l) { return '<p>' + UI.esc(l) + '</p>'; }).join('');
  };

  function morningView(state, cfg, app) {
    var ann;
    try { ann = E.getMorningAnnouncement(state); } catch (e) { ann = {}; }
    ann = ann || {};
    var body = '';
    if (ann.forgedWills && ann.forgedWills.length) {
      ann.forgedWills.forEach(function (f) {
        body += '<div class="notice accent">A will was forged for ' + UI.esc(f.targetName) + '.</div>';
      });
    }
    if (ann.revivals && ann.revivals.length) {
      body += '<div class="notice ok"><strong>Revived:</strong> ' + ann.revivals.map(UI.esc).join(', ') + '</div>';
    }
    if (ann.inheritanceNote) {
      body += '<div class="notice accent">' + UI.esc(ann.inheritanceNote) + '</div>';
    }
    if (ann.deaths && ann.deaths.length) {
      ann.deaths.forEach(function (d) {
        body += '<div class="death-card"><div class="death-head">' +
          '<strong>' + UI.esc(d.name) + '</strong><span class="tag tag-bad">DEAD</span></div>' +
          '<div class="death-role">' + UI.esc(d.roleShown || '?? UNKNOWN ??') + '</div>' +
          '<div class="death-cause">' + UI.esc(d.cause || '') + '</div></div>';
      });
    } else {
      body += '<div class="notice ok">No deaths last night.</div>';
    }
    var freshNight = Math.max(1, (state.night && state.night.number || 1) - 1);
    body += UI.whisperResultCard(state, app, freshNight);
    body += '<div class="notice">Read the announcements above to the table, then tap <strong>Begin Day</strong>.</div>';
    return UI.card('Morning Announcement', body, 'morning', app);
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

  function dayTimerView(app) {
    var running = !!app.dayTimerEnds;
    var remain = running ? Math.max(0, Math.round((app.dayTimerEnds - Date.now()) / 1000)) : '';
    var body = '<div class="timer-wrap">' +
      '<div class="timer-ring' + (running ? '' : ' idle') + '"' +
      (running ? ' data-timer-seconds="' + remain + '" data-timer-kind="day"' : '') +
      ' style="--p:100">' +
      '<span class="timer-count">' + (running ? '' : '--') + '</span></div>' +
      '<div class="btn-row timer-btns">' +
      '<button class="btn" data-action="start-day-timer" data-seconds="60">60s</button>' +
      '<button class="btn" data-action="start-day-timer" data-seconds="120">120s</button>' +
      '<button class="btn" data-action="start-day-timer" data-seconds="180">180s</button>' +
      (running ? '<button class="btn" data-action="adjust-day-timer" data-delta="-10">-10s</button>' +
        '<button class="btn" data-action="adjust-day-timer" data-delta="10">+10s</button>' +
        '<button class="btn" data-action="stop-day-timer">Stop</button>' : '') +
      '</div></div>';
    return UI.card('Discussion Timer', body, 'timer', app);
  }

  function dayView(state, cfg, app) {
    var html = '';
    html += dayTimerView(app);
    html += UI.card('Day Abilities', dayAbilities(state), 'abilities', app);
    html += UI.trialView(state, cfg, app);
    return html;
  }

  function dayBar(state, app) {
    var b = '';
    if (app.picker) {
      b += '<button class="btn btn-bar" data-action="picker-cancel">Cancel</button>';
    }
    if (state.trial && state.trial.active && !app.lastTrialResult) {
      var action = 'resolve-trial';
      var lbl = 'Resolve Trial';
      if (state.trial.stage === 'SECONDS') {
        action = 'resolve-trial';
        lbl = 'Resolve Nomination';
      } else if (state.trial.stage === 'SENTENCE') {
        action = 'resolve-sentence';
        lbl = 'Resolve Sentence';
      }
      b += '<button class="btn btn-primary btn-bar" data-action="' + action + '">' + lbl + '</button>';
    }
    b += '<button class="btn btn-primary btn-bar" data-action="end-day">End Day</button>';
    return b;
  }

  function logsCard(state, app) {
    var logs = state.logs || [];
    var collapsed = !!(app.collapsed && app.collapsed['log']);
    var html = '<div class="card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="card-head">' +
      '<button class="btn btn-sm" data-action="toggle-logs">Event Log (' + logs.length + ')</button>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="log"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-log">' +
      (collapsed ? '+' : '-') + '</button></div>' +
      '<div class="card-body" id="card-body-log">' +
      '<div class="logs' + (app.logsOpen ? ' open' : '') + '">' +
      (logs.length ? '<ul>' + logs.slice().reverse().map(function (l) {
        return '<li>' + UI.esc(l) + '</li>';
      }).join('') + '</ul>' : '<p class="muted small">No events yet.</p>') +
      '</div></div></div>';
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

  UI.livingBtns = livingBtns;

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var act = el.getAttribute('data-action');
    if (act === 'toggle-sidebar') {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-backdrop').classList.toggle('open');
      e.preventDefault();
    } else if (act === 'close-sidebar') {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-backdrop').classList.remove('open');
      e.preventDefault();
    } else if (el.closest('.sidebar-item')) {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-backdrop').classList.remove('open');
    }
  });
})();
