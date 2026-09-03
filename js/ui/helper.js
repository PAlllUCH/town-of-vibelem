'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  var SHEET_FLAGS = ['drunk', 'poisoned', 'jailed', 'protected', 'alert', 'revealed', 'blackmailed', 'enchanted', 'cleaned', 'necro_used', 'succubus_target', 'ghost'];
  var LEGEND = [
    ['DRUNK', 'Role actions fail, results invert, protection fails'],
    ['POISONED', 'Will be drunk for one full cycle starting next night'],
    ['JAILED', 'Jailed by the Jailor, cannot act or vote'],
    ['PROTECTED', 'Got Doctor or Innkeeper protection last night'],
    ['ALERT', 'Veteran is armed, visitors die'],
    ['REVEALED', 'Mayor or role publicly revealed'],
    ['BLACKMAILED', 'Cannot speak today'],
    ['ENCHANTED', 'Succubus target, cannot vote guilty against the Succubus'],
    ['CLEANED', 'Janitor cleaned the role at death'],
    ['NECRO USED', 'Necromant already borrowed a dead role'],
    ['SUCCUBUS TARGET', 'Current enchant target of the Succubus'],
    ['GHOST', 'Dead, haunts or votes from the grave']
  ];
  var CORPSE_TARGETS = ['undertaker', 'janitor', 'retributionist', 'amnesiac', 'necromant'];

  function nightOrderCard(state, app) {
    var dealt = {};
    (state.players || []).forEach(function (p) {
      if (p.assignedRole) dealt[p.assignedRole] = true;
    });
    var collapsed = !!(app && app.collapsed && app.collapsed['helper-night-order']);
    var html = '<div class="helper-card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="helper-card-head"><h2>' + UI.str('nightOrderTitle') + '</h2>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="helper-night-order"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-helper-night-order">' +
      (collapsed ? '+' : '-') + '</button></div>';
    html += '<div class="helper-card-body" id="card-body-helper-night-order">';
    html += '<div class="helper-list">';
    (E.NIGHT_STEPS || []).forEach(function (step) {
      if (!step.roles || !step.roles.length) return;
      var hit = false;
      step.roles.forEach(function (rid) { if (dealt[rid]) hit = true; });
      if (!hit) return;
      html += '<div class="helper-step">' +
        '<span class="helper-step-pos">' + step.position + '</span>' +
        '<strong class="helper-step-title">' + UI.esc(step.title) + '</strong>' +
        '<p class="helper-step-prompt">' + UI.esc(step.prompt) + '</p></div>';
    });
    html += '</div></div></div>';
    return html;
  }

  function livingCast(state) {
    var roles = {};
    (state.players || []).forEach(function (p) {
      if (!p.isAlive) return;
      if (p.assignedRole) roles[p.assignedRole] = true;
      if (p.inheritedRole) roles[p.inheritedRole] = true;
    });
    return { roles: roles };
  }

  function helperNightSteps(state) {
    var cast = livingCast(state);
    var steps = [];
    (E.NIGHT_STEPS || []).forEach(function (tpl) {
      if (!tpl.roles || !tpl.roles.length) {
        steps.push({ position: tpl.position, title: tpl.title, roles: [], prompt: tpl.prompt });
        return;
      }
      if (tpl.position === 3 && !cast.roles['jailor']) return;
      var hit = tpl.roles.some(function (rid) { return !!cast.roles[rid]; });
      if (!hit) return;
      steps.push({ position: tpl.position, title: tpl.title, roles: tpl.roles.slice(), prompt: tpl.prompt });
    });
    return steps;
  }

  function clampStepIdx(app, steps) {
    var maxIdx = Math.max(0, steps.length - 1);
    return Math.max(0, Math.min(Number(app && app.helperStepIdx) || 0, maxIdx));
  }

  function stepActors(state, step) {
    var out = [];
    var roles = step.roles || [];
    if (!roles.length) return out;
    (state.players || []).forEach(function (p) {
      if (!p.isAlive) return;
      var rid = null;
      if (roles.indexOf(p.assignedRole) !== -1) rid = p.assignedRole;
      else if (p.inheritedRole && p.inheritedRole !== p.assignedRole && roles.indexOf(p.inheritedRole) !== -1) rid = p.inheritedRole;
      if (!rid) return;
      out.push({
        pid: p.id,
        name: p.name != null ? p.name : 'Player ' + (p.seat != null ? p.seat : ''),
        role: rid,
        inherited: rid === p.inheritedRole
      });
    });
    return out;
  }

  function targetReminder(step) {
    if (!step.roles || !step.roles.length) return UI.str('reminderNone');
    if (step.position === 0) return UI.str('reminderThumbs');
    var corpse = step.roles.some(function (rid) { return CORPSE_TARGETS.indexOf(rid) !== -1; });
    return corpse ? UI.str('reminderCorpse') : UI.str('reminderLiving');
  }

  function nightStepCard(state, app) {
    var steps = helperNightSteps(state);
    if (!steps.length) return '';
    var idx = clampStepIdx(app, steps);
    var step = steps[idx];
    var actors = stepActors(state, step);
    var actorTxt = actors.length ? actors.map(function (a) {
      return UI.esc(a.name) + ' \u00B7 ' + UI.roleNameInline(a.role) +
        (a.inherited ? ' <span class="tag tag-warn">INHERITED</span>' : '');
    }).join(', ') : '<span class="muted small">' + UI.str('noLivingActor') + '</span>';
    var collapsed = !!(app && app.collapsed && app.collapsed['helper-night-step']);
    var html = '<div class="helper-card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="helper-card-head"><h2>' + UI.esc(UI.str('nightStepOf', idx + 1, steps.length)) + '</h2>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="helper-night-step"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-helper-night-step">' +
      (collapsed ? '+' : '-') + '</button></div>';
    html += '<div class="helper-card-body" id="card-body-helper-night-step">';
    html += '<div class="helper-step">' +
      '<span class="helper-step-pos">' + UI.esc(step.position) + '</span>' +
      '<strong class="helper-step-title">' + UI.esc(step.title) + '</strong></div>';
    html += '<p class="helper-step-prompt">' + actorTxt + '</p>';
    html += '<p class="helper-step-prompt">' + UI.esc(targetReminder(step)) + '</p>';
    html += '<p class="helper-step-prompt">' + UI.esc(step.prompt) + '</p>';
    html += '</div></div>';
    return html;
  }

  function nightOutstandingCard(state, app) {
    var steps = helperNightSteps(state);
    var actions = (state.night && state.night.actions) || [];
    var skips = (app && app.nightSkips) || {};
    var rows = [];
    var seen = {};
    steps.forEach(function (step) {
      if (!step.roles || !step.roles.length) return;
      stepActors(state, step).forEach(function (a) {
        var key = step.position + '|' + a.role + '|' + a.pid;
        if (seen[key]) return;
        seen[key] = true;
        var done = actions.some(function (ac) {
          return ac.position === step.position && ac.roleId === a.role && String(ac.playerId) === String(a.pid);
        });
        rows.push({
          pos: step.position,
          pid: a.pid,
          name: a.name,
          role: a.role,
          inherited: a.inherited,
          status: done ? 'done' : (skips[key] ? 'skipped' : 'pending')
        });
      });
    });
    if (!rows.length) return '';
    var collapsed = !!(app && app.collapsed && app.collapsed['helper-night-actions']);
    var html = '<div class="helper-card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="helper-card-head"><h2>' + UI.str('outstandingTitle') + '</h2>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="helper-night-actions"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-helper-night-actions">' +
      (collapsed ? '+' : '-') + '</button></div>';
    html += '<div class="helper-card-body" id="card-body-helper-night-actions">';
    html += '<div class="helper-list">';
    rows.forEach(function (r) {
      var tag = r.status === 'done'
        ? '<span class="tag tag-ok">' + UI.str('statusDone') + '</span>'
        : (r.status === 'skipped'
          ? '<span class="tag">' + UI.str('statusSkipped') + '</span>'
          : '<span class="tag tag-warn">' + UI.str('statusPending') + '</span>');
      html += '<div class="helper-step">' +
        '<span class="helper-step-pos">' + UI.esc(r.pos) + '</span>' +
        '<strong class="helper-step-title">' + UI.esc(r.name) + ' \u00B7 ' + UI.roleNameInline(r.role) +
        (r.inherited ? '</strong> <span class="tag tag-warn">INHERITED</span>' : '</strong>') +
        ' ' + tag + '</div>';
    });
    html += '</div></div></div>';
    return html;
  }

  function statusFlags(app, pid) {
    var statuses = (app && app.statuses) || {};
    return statuses[String(pid)] || {};
  }

  function chip(flag, flags) {
    if (!flags[flag]) return '';
    var cls = 'helper-chip';
    if (flag === 'ghost') cls += ' helper-chip-dead';
    if (flag === 'poisoned') cls += ' helper-chip-warn';
    return '<span class="' + cls + '">' + String(flag).toUpperCase().replace(/_/g, ' ') + '</span>';
  }

  function rosterCard(state, app) {
    var collapsed = !!(app && app.collapsed && app.collapsed['helper-players']);
    var html = '<div class="helper-card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="helper-card-head"><h2>' + UI.str('playersTitle') + '</h2>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="helper-players"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-helper-players">' +
      (collapsed ? '+' : '-') + '</button></div>';
    html += '<div class="helper-card-body" id="card-body-helper-players">';
    (state.players || []).forEach(function (p) {
      var flags = statusFlags(app, p.id);
      var name = p.name != null ? p.name : ('Player ' + (p.seat != null ? p.seat : ''));
      var roleTxt = p.assignedRole ? UI.roleNameInline(p.assignedRole) : UI.str('unassignedLabel');
      html += '<button type="button" class="helper-player" data-helper-pid="' + UI.esc(p.id) + '" data-action="open-helper-sheet">' +
        '<span class="helper-player-name">' + UI.esc(name) + '</span>' +
        '<span class="helper-player-role">' + roleTxt + '</span></button>';
      html += '<div class="helper-player-tags">';
      if (!p.isAlive) html += '<span class="helper-chip helper-chip-dead">GHOST</span>';
      SHEET_FLAGS.forEach(function (f) { html += chip(f, flags); });
      Object.keys(flags).filter(function (k) {
        return SHEET_FLAGS.indexOf(k) === -1 && flags[k];
      }).sort().forEach(function (k) { html += chip(k, flags); });
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function legendCard(app) {
    var collapsed = !!(app && app.collapsed && app.collapsed['helper-statuses']);
    var html = '<div class="helper-card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="helper-card-head"><h2>' + UI.str('statusesTitle') + '</h2>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="helper-statuses"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-helper-statuses">' +
      (collapsed ? '+' : '-') + '</button></div>';
    html += '<div class="helper-card-body" id="card-body-helper-statuses">';
    LEGEND.forEach(function (it) {
      html += '<div class="helper-status-legend">' +
        '<strong>' + UI.esc(it[0]) + '</strong>' +
        '<small>' + UI.esc(it[1]) + '</small></div>';
    });
    html += '</div></div>';
    return html;
  }

  UI.helperNightSteps = helperNightSteps;

  UI.renderHelperNightBar = function (state, app) {
    var steps = helperNightSteps(state);
    if (!steps.length) return '';
    var idx = clampStepIdx(app, steps);
    var last = idx >= steps.length - 1;
    return '<button type="button" class="btn btn-bar" data-action="helper-step-prev"' +
      (idx <= 0 ? ' disabled aria-disabled="true"' : '') + ' aria-label="Previous night step">&larr; ' + UI.str('prev') + '</button>' +
      '<span class="muted small helper-step-counter">' + UI.esc((idx + 1) + ' / ' + steps.length) + '</span>' +
      '<button type="button" class="btn btn-bar btn-primary" data-action="helper-step-next"' +
      (last ? ' disabled aria-disabled="true" aria-label="Night complete"' : '') + '>' +
      (last ? UI.str('done') : UI.str('next')) + '</button>' +
      '<button type="button" class="btn btn-bar" data-action="toggle-card" data-card="helper-night-actions"' +
      ' aria-label="' + UI.esc(UI.str('outstandingTitle')) + '">' + UI.str('outstandingBtn') + '</button>' +
      '<button type="button" class="btn btn-bar" data-action="resolve-night" aria-label="Resolve night">' + UI.str('resolveNight') + '</button>';
  };

  function morningRecapCard(state, app) {
    var ann;
    try { ann = E.getMorningAnnouncement(state); } catch (e) { ann = {}; }
    ann = ann || {};
    var body = '';
    var freshNight = Math.max(1, ((state.night && state.night.number) || 1) - 1);
    var nightKey = 'N' + freshNight;
    var deaths = ann.deaths || [];
    if (deaths.length) {
      deaths.forEach(function (d) {
        body += '<div class="helper-recap-death"><strong>' + UI.esc(d.name) + '</strong>' +
          ' <span class="helper-chip helper-chip-dead">DEAD</span>' +
          '<div class="muted small">' + UI.esc(d.roleShown || '?? UNKNOWN ??') +
          (d.cause ? ' \u00B7 ' + UI.esc(d.cause) : '') + '</div></div>';
      });
    } else {
      body += '<p class="muted small">' + UI.str('noDeathsLastNight') + '</p>';
    }
    if (ann.revivals && ann.revivals.length) {
      body += '<p class="muted small"><strong>' + UI.esc(UI.str('revivedLabel')) + ':</strong> ' + ann.revivals.map(UI.esc).join(', ') + '</p>';
    }
    if (ann.inheritanceNote) {
      body += '<p class="muted small">' + UI.esc(ann.inheritanceNote) + '</p>';
    }
    if (ann.forgedWills && ann.forgedWills.length) {
      ann.forgedWills.forEach(function (f) {
        body += '<p class="muted small">' + UI.esc(UI.str('forgedWillLine', f.targetName)) + '</p>';
      });
    }
    var announcedPids = {};
    (state.morning && state.morning.deaths || []).forEach(function (d) {
      announcedPids[String(d.playerId)] = true;
    });
    (state.players || []).forEach(function (p) {
      if (announcedPids[String(p.id)]) return;
      var log = (state.playerLog && state.playerLog[String(p.id)]) || [];
      var hits = log.filter(function (e) {
        return e.at === nightKey && (e.kind === 'death' || e.kind === 'haunted');
      });
      hits.forEach(function (e) {
        body += '<p class="muted small">' + UI.esc(p.name) + ': ' + UI.esc(e.text) + '</p>';
      });
    });
    return UI.card(UI.str('morningRecapTitle'), body, 'helper-recap', app);
  }

  UI.renderHelperBar = function (state, app) {
    if (state && state.phase === 'MORNING') {
      return '<button type="button" class="btn btn-bar btn-primary" data-action="begin-day" aria-label="Begin the day">' + UI.str('beginDay') + '</button>';
    }
    if (state && state.phase === 'DAY') {
      return '<button type="button" class="btn btn-bar btn-primary" data-action="end-day" aria-label="End the day">' + UI.str('endDay') + '</button>';
    }
    return UI.renderHelperNightBar(state, app);
  };

  UI.renderHelper = function (state, cfg, app) {
    var top;
    if (state.phase === 'NIGHT') {
      top = nightStepCard(state, app) + nightOutstandingCard(state, app);
    } else {
      top = nightOrderCard(state, app);
    }
    var recap = state.phase === 'MORNING' ? morningRecapCard(state, app) : '';
    return recap + top + rosterCard(state, app) + legendCard(app);
  };

  UI.renderHelperSheet = function (state, pid, app) {
    var p = UI.findPlayer(state, pid);
    var name = p && p.name != null ? p.name : String(pid);
    var flags = statusFlags(app, pid);
    var grave = state.graveyard || [];
    var lastGrave = grave.length ? grave[grave.length - 1] : null;
    var html = '<div class="helper-sheet-backdrop open" data-action="close-helper-sheet"></div>';
    html += '<div class="helper-sheet open" role="dialog" aria-label="Status sheet">';
    html += '<div class="helper-sheet-head"><h3>' + UI.esc(name) + '</h3>' +
      '<button type="button" class="btn btn-icon" data-action="close-helper-sheet" aria-label="Close">&times;</button></div>';
    html += '<div class="helper-sheet-grid">';
    SHEET_FLAGS.forEach(function (fl) {
      var on = !!flags[fl];
      html += '<button type="button" class="btn btn-sm helper-status-btn' + (on ? ' on' : '') + '"' +
        ' data-action="set-helper-status" data-helper-pid="' + UI.esc(pid) + '" data-helper-status="' + fl + '">' +
        fl.toUpperCase().replace(/_/g, ' ') + '</button>';
    });
    html += '</div>';
    html += '<div class="btn-col">';
    html += '<button type="button" class="btn btn-danger" data-action="helper-kill-player"' +
      ' data-helper-pid="' + UI.esc(pid) + '"' + (p && p.isAlive ? '' : ' disabled') + '>' + UI.str('killPlayerLabel') + '</button>';
    html += '<button type="button" class="btn" data-action="helper-undo-kill"' +
      (lastGrave ? '' : ' disabled') + '>' + UI.str('undoLastKill') +
      (lastGrave ? ' (' + UI.esc(lastGrave.name) + ')' : '') + '</button>';
    html += '</div>';
    html += '<button type="button" class="btn btn-block" data-action="close-helper-sheet">' + UI.str('done') + '</button>';
    html += '</div>';
    return html;
  };
})();
