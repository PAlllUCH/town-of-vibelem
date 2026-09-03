'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  UI.renderGameHeader = function (state, cfg, app) {
    var word = UI.str('phaseOver');
    var phaseAttr = 'END';
    var num = Math.max(1, state.dayNumber || 1);
    if (state.phase === 'NIGHT') { word = UI.str('phaseNight'); phaseAttr = 'NIGHT'; num = Math.max(1, state.night.number || 1); }
    else if (state.phase === 'MORNING') { word = UI.str('phaseMorning'); phaseAttr = 'MORNING'; num = Math.max(1, state.dayNumber || 1); }
    else if (state.phase === 'DAY') { word = UI.str('phaseDay'); phaseAttr = 'DAY'; num = Math.max(1, state.dayNumber || 1); }
    else if (state.phase === 'SEATS' || state.phase === 'SETUP') { word = UI.str('phasePrep'); phaseAttr = 'PREP'; num = 1; }
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
      '</div>';
  };

  UI.renderGame = function (state, cfg, app) {
    var body = '';
    var bar = '';
    if (app.seatOverlay) {
      var sgCollapsed = !!(app.collapsed && app.collapsed['seat-grid']);
      body += '<div class="card card-collapsible' + (sgCollapsed ? ' collapsed' : '') + '">' +
        '<div class="card-head"><h2>' + UI.str('seatGridTitle') + '</h2>' +
        '<button class="btn btn-sm" data-action="toggle-seat-overlay">' + UI.str('closeLabel') + '</button>' +
        '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="seat-grid"' +
        ' aria-expanded="' + (sgCollapsed ? 'false' : 'true') + '" aria-controls="card-body-seat-grid">' +
        (sgCollapsed ? '+' : '-') + '</button></div>' +
        '<div class="card-body" id="card-body-seat-grid">' +
        UI.seatTiles(state, app.rolesHidden, cfg, undefined, app.claims) + '</div></div>';
    }
    if (state.phase === 'NIGHT') {
      body += UI.nightWizard(state, cfg, app);
      bar = '<button class="btn btn-primary btn-bar" data-action="resolve-night">' + UI.str('resolveNight') + '</button>';
    } else if (state.phase === 'MORNING') {
      body += morningView(state, cfg, app);
      bar = '<button class="btn btn-primary btn-bar" data-action="begin-day">' + UI.str('beginDay') + '</button>';
    } else if (state.phase === 'DAY') {
      body += dayView(state, cfg, app);
      bar = dayBar(state, app);
    } else {
      body += '<p class="muted">' + UI.str('sessionOver') + '</p>';
    }
    if (app.picker) {
      var holder = null;
      if (app.picker.ability === 'vigilante' || app.picker.ability === 'deputy') {
        (state.players || []).forEach(function (pl) {
          if (pl.isAlive && pl.assignedRole === app.picker.ability) holder = pl;
        });
      }
      var pkCollapsed = !!(app.collapsed && app.collapsed['picker']);
      body += '<div class="card picker-card card-collapsible' + (pkCollapsed ? ' collapsed' : '') + '">' +
        '<div class="card-head"><h2>' + UI.esc(app.picker.title) + '</h2>' +
        '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="picker"' +
        ' aria-expanded="' + (pkCollapsed ? 'false' : 'true') + '" aria-controls="card-body-picker">' +
        (pkCollapsed ? '+' : '-') + '</button></div>' +
        '<div class="card-body" id="card-body-picker">' +
        '<p class="muted small">' + UI.esc(app.picker.sub || '') + '</p>' +
        livingBtns(state, 'pick-day-target', holder ? holder.id : null, app.picker.ability) +
        '<button class="btn btn-block" data-action="picker-cancel">' + UI.str('cancelLabel') + '</button></div></div>';
    }
    body += logsCard(state, app);
    return { body: body, bar: bar };
  };

  UI.renderSidebar = function (state, app) {
    var sOpen = app.tokensOpen || app.claimsOpen || app.seatOverlay || app.modOpen || app.referenceOpen;
    var sidebarOnly = !state || !state.players || state.players.length === 0;
    var h = '';
    h += '<div class="sidebar-item" data-action="toggle-mode">' +
      UI.esc(app.mode === 'helper' ? UI.str('switchToApp') : UI.str('switchToHelper')) + '</div>';
    if (!sidebarOnly) {
      h += '<div class="sidebar-item" data-action="toggle-tokens">' + UI.esc(UI.str('tokensLabel')) + '</div>';
      h += '<div class="sidebar-item" data-action="toggle-claims">' + UI.esc(UI.str('claimsLabel')) + '</div>';
      h += '<div class="sidebar-item' + (sOpen ? ' on' : '') + '" data-action="toggle-seat-overlay">' + UI.esc(UI.str('seatsLabel')) + '</div>';
      h += '<div class="sidebar-item" data-action="toggle-logs">' + UI.esc(UI.str('logLabel')) + '</div>';
      h += '<div class="sidebar-item" data-action="toggle-mod">' + UI.esc(UI.str('modLabel')) + '</div>';
      h += '<div class="sidebar-item" data-action="toggle-reference">' + UI.esc(UI.str('rolesLabel')) + '</div>';
    }
    h += '<div class="sidebar-group-label">' + UI.str('languageLabel') + '</div>';
    h += '<div class="sidebar-item sidebar-item-language" data-action="toggle-locale">' +
      UI.localeToggleButton() + '</div>';
    return h;
  };

  UI.renderSidebarLog = function (state) {
    var logs = ((state && state.logs) || []).slice(-20);
    return logs.map(function (l) { return '<p>' + UI.esc(l) + '</p>'; }).join('');
  };

  function morningView(state, cfg, app) {
    var ann;
    try { ann = E.getMorningAnnouncement(state); } catch (e) { ann = {}; }
    ann = ann || {};
    var body = '';
    if (ann.forgedWills && ann.forgedWills.length) {
      ann.forgedWills.forEach(function (f) {
        body += '<div class="notice accent">' + UI.esc(UI.str('forgedWillLine', f.targetName)) + '</div>';
      });
    }
    if (ann.revivals && ann.revivals.length) {
      body += '<div class="notice ok"><strong>' + UI.esc(UI.str('revivedLabel')) + ':</strong> ' + ann.revivals.map(UI.esc).join(', ') + '</div>';
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
      body += '<div class="notice ok">' + UI.str('noDeathsLastNight') + '</div>';
    }
    var freshNight = Math.max(1, (state.night && state.night.number || 1) - 1);
    body += UI.whisperResultCard(state, app, freshNight);
    body += '<div class="notice">' + UI.str('readThenBeginDay') + '</div>';
    return UI.card(UI.str('morningAnnouncementTitle'), body, 'morning', app);
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
        (left > 0 ? '' : 'disabled') + '>' + UI.esc(UI.str('vigilanteShot', left)) + '</button>';
    }
    if (dep && !dep.usedOncePerGame) {
      html += '<button class="btn" data-action="day-ability" data-ability="deputy">' + UI.esc(UI.str('deputyShoot')) + '</button>';
    }
    if (may && !may.revealed) {
      html += '<button class="btn" data-action="day-ability" data-ability="mayor">' + UI.esc(UI.str('mayorReveal')) + '</button>';
    }
    if (!vig && !dep && !may) {
      html += '<p class="muted">' + UI.str('noDayAbilities') + '</p>';
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
        '<button class="btn" data-action="stop-day-timer">' + UI.str('stopTimer') + '</button>' : '') +
      '</div></div>';
    return UI.card(UI.str('timerTitle'), body, 'timer', app);
  }

  function dayView(state, cfg, app) {
    var html = '';
    html += dayTimerView(app);
    html += UI.card(UI.str('dayAbilitiesTitle'), dayAbilities(state), 'abilities', app);
    html += UI.trialView(state, cfg, app);
    return html;
  }

  function dayBar(state, app) {
    var b = '';
    var resolvePending = false;
    if (state.trial && state.trial.active && !app.lastTrialResult) {
      resolvePending = true;
      var action = 'resolve-trial';
      var lbl = UI.str('verdictStage');
      if (state.trial.stage === 'SECONDS') {
        action = 'resolve-trial';
        lbl = UI.str('nominationStage');
      } else if (state.trial.stage === 'SENTENCE') {
        action = 'resolve-sentence';
        lbl = UI.str('sentenceStage');
      }
      b += '<button class="btn btn-primary btn-bar" data-action="' + action + '">' + lbl + '</button>';
    }
    b += '<button class="btn btn-bar' + (resolvePending ? '' : ' btn-primary') + '" data-action="end-day">' + UI.str('endDay') + '</button>';
    return b;
  }

  function logsCard(state, app) {
    var logs = state.logs || [];
    var body = logs.length
      ? '<ul>' + logs.slice().reverse().map(function (l) {
        return '<li>' + UI.esc(l) + '</li>';
      }).join('') + '</ul>'
      : '<p class="muted small">' + UI.str('noEventsYet') + '</p>';
    return UI.card(UI.str('eventLogTitle', logs.length), body, 'log', app);
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
