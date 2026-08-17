'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  function corpseRoles() {
    return ['undertaker', 'janitor', 'retributionist', 'amnesiac'];
  }

  function wizardActors(state, step) {
    var out = [];
    var roles = step.roles || [];
    roles.forEach(function (role) {
      (state.players || []).forEach(function (p) {
        if (p.assignedRole !== role) return;
        var allowDead = (role === 'medium' && step.position === 13) ||
          (role === 'jester' && step.position === 0 && state.jester &&
            state.jester.haunted && state.jester.hauntTarget === null);
        if (!p.isAlive && !allowDead) return;
        var done = ((state.night && state.night.actions) || []).some(function (ac) {
          return ac.position === step.position && ac.roleId === role && String(ac.playerId) === String(p.id);
        });
        out.push({
          role: role,
          player: p,
          name: p.name,
          done: done,
          inherited: role === 'deputy' && p.inheritedRole === 'sheriff'
        });
      });
    });
    return out;
  }

  function livingBtns(state, action, exclude) {
    var html = '<div class="btn-col">';
    UI.living(state.players).forEach(function (p) {
      if (exclude != null && (String(exclude) === String(p.id) ||
          (Array.isArray(exclude) && exclude.some(function (e) { return String(e) === String(p.id); })))) return;
      html += '<button class="btn btn-actor" data-action="' + action + '" data-target="' + UI.esc(p.id) + '">' +
        UI.esc(p.name) + ' \u00B7 ' + (p.assignedRole ? UI.roleName(p.assignedRole) : '?') + '</button>';
    });
    html += '</div>';
    return html;
  }

  function corpseBtns(state) {
    var g = state.graveyard || [];
    if (!g.length) return '<p class="muted">No corpses yet.</p>';
    var html = '<div class="btn-col">';
    g.forEach(function (x) {
      var roleId = x.trueRole;
      if (!roleId) {
        var pl = UI.findPlayer(state, x.playerId);
        if (pl && pl.assignedRole) roleId = pl.assignedRole;
      }
      var cleaned = !!x.wasCleaned;
      if (!cleaned) {
        var jp = UI.findPlayer(state, x.playerId);
        cleaned = !!(jp && jp.cleaned);
      }
      html += '<button class="btn btn-actor" data-action="wizard-target" data-target="' + UI.esc(x.playerId) + '">' +
        UI.esc(x.name) + ' \u00B7 ' + (roleId ? UI.roleName(roleId) : '<span class="muted">?</span>') +
        (cleaned ? ' <span class="tag tag-bad">CLEANED</span>' : '') + '</button>';
    });
    html += '</div>';
    return html;
  }

  function witnessResult(state, a, b) {
    var ta = E._witnessTeam ? E._witnessTeam(state, a) : 'NEUTRAL';
    var tb = E._witnessTeam ? E._witnessTeam(state, b) : 'NEUTRAL';
    if (ta === tb) {
      return ta === 'TOWN' ? 'Both Town' : (ta === 'MAFIA' ? 'Both Mafia' : 'Both Neutral');
    }
    return 'Different alignments';
  }

  function actorControls(state, step, w) {
    var role = w.actor.role;
    var pid = w.actor.player;
    if (pid && typeof pid === 'object') pid = pid.id;
    var p = UI.findPlayer(state, pid);
    var selfAllowed = role === 'doctor' || corpseRoles().indexOf(role) !== -1;
    var exclude = selfAllowed ? null : pid;
    var html = '';
    var label = '<p class="wizard-label">Acting: ' + UI.esc(p && p.name ? p.name : pid) + ' - ' + UI.roleName(role) +
      (w.actor.inherited ? ' (inherited)' : '') + '</p>';
    if (role === 'veteran' && p) {
      var maxVet = (E.ROLES && E.ROLES.veteran && E.ROLES.veteran.maxUses) || 3;
      if ((p.alertsUsed || 0) >= maxVet - 1) {
        label = '<p class="wizard-label">Acting: ' + UI.esc(p.name) + ' - ' + UI.roleName(role) +
          ' <span class="tag tag-bad">LAST ALERT</span></p>';
      }
    }
    html += label;

    if (role === 'veteran') {
      html += '<div class="btn-col">' +
        '<button class="btn btn-primary" data-action="wizard-alert" data-alert="true">Yes, Alert</button>' +
        '<button class="btn" data-action="wizard-alert" data-alert="false">No Alert</button></div>';
    } else if (role === 'witch') {
      if (!w.pending || !w.pending.control) {
        html += '<p class="wizard-label">Point to the player you control</p>' + livingBtns(state, 'wizard-target', exclude);
      } else {
        html += '<p class="wizard-label">Point to the redirect target</p>' +
          '<div class="btn-col">' +
          '<button class="btn btn-actor actor-done" disabled>' +
          UI.esc(UI.nameOf(state, w.pending.control)) + ' \u00B7 controlled</button></div>' +
          livingBtns(state, 'wizard-target', exclude);
      }
    } else if (role === 'jailor') {
      if (!w.pending || !w.pending.jail) {
        html += '<p class="wizard-label">Point to your jail target</p>' + livingBtns(state, 'wizard-target', exclude);
      } else {
        html += '<p class="wizard-label">Jailed: ' + UI.esc(UI.nameOf(state, w.pending.jail)) + '. Execute or spare?</p>';
        if (state.night && state.night.number === 1) {
          html += '<p class="muted small">Night 1: no execution allowed.</p>' +
            '<div class="btn-col">' +
            '<button class="btn btn-ok" data-action="wizard-decision" data-decision="SPARE">SPARE</button></div>';
        } else {
          html += '<div class="btn-col">' +
            '<button class="btn btn-danger" data-action="wizard-decision" data-decision="EXECUTE">EXECUTE</button>' +
            '<button class="btn btn-ok" data-action="wizard-decision" data-decision="SPARE">SPARE</button></div>';
        }
      }
    } else if (role === 'forger') {
      if (!w.pending || !w.pending.forge) {
        html += '<p class="wizard-label">Point to the player whose will you forge</p>' + livingBtns(state, 'wizard-target', exclude);
      } else {
        var forgeTarget = UI.findPlayer(state, w.pending.forge);
        html += '<p class="wizard-label">Forging a will for: ' + UI.esc(UI.nameOf(state, w.pending.forge)) + '</p>' +
          '<div class="btn-col"><button class="btn btn-actor actor-done" disabled>Will forge: ' +
          UI.esc(forgeTarget ? forgeTarget.name : String(w.pending.forge)) + ' \u00B7 ' +
          (forgeTarget && forgeTarget.assignedRole ? UI.roleName(forgeTarget.assignedRole) : '?') + '</button></div>' +
          '<p class="muted small">The forged will is read from the player\'s card.</p>' +
          '<button class="btn btn-primary btn-block" data-action="wizard-decision" data-decision="FORGE">FORGE</button>';
      }
    } else if (role === 'witness') {
      if (!w.pending || !w.pending.witness || w.pending.witness.length < 1) {
        html += '<p class="wizard-label">Point to the first player you compare</p>' + livingBtns(state, 'wizard-target', exclude);
      } else if (w.pending.witness.length < 2) {
        var firstPick = w.pending.witness[0];
        html += '<p class="wizard-label">Point to the second player you compare</p>' +
          '<div class="btn-col">' +
          '<button class="btn btn-actor actor-done" disabled>' +
          UI.esc(UI.nameOf(state, firstPick)) + ' \u00B7 first pick</button></div>' +
          livingBtns(state, 'wizard-target', [pid, firstPick]);
      } else {
        var wa = UI.findPlayer(state, w.pending.witness[0]);
        var wb = UI.findPlayer(state, w.pending.witness[1]);
        html += '<p class="wizard-label">Witness: ' + UI.esc(wa ? wa.name : w.pending.witness[0]) + ' and ' +
          UI.esc(wb ? wb.name : w.pending.witness[1]) + ' \u2192 ' + witnessResult(state, wa, wb) + '</p>';
        if (p && p.isDrunk) html += '<p class="notice bad">Witness is Drunk \u2014 the comparison is unreliable.</p>';
        html += '<button class="btn btn-primary btn-block" data-action="wizard-witness-confirm">Confirm compare</button>';
      }
    } else if (role === 'consigliere') {
      html += '<p class="wizard-label">Point to the player you inspect</p>';
      if (p && p.isDrunk) {
        html += '<p class="notice bad">Consigliere is Drunk \u2014 the learned role is inverted. <span class="tag tag-bad">INVERTED</span></p>';
      }
      html += livingBtns(state, 'wizard-target', exclude);
    } else if (role === 'medium') {
      if (p.isAlive) {
        html += '<button class="btn btn-block" data-action="wizard-target" data-target="__none__">' +
          'Medium read the Ghost Ledger (no target)</button>';
      } else {
        html += '<p class="wizard-label">Dead Medium: pick a living player to whisper with</p>' +
          livingBtns(state, 'wizard-target', exclude);
      }
    } else if (role === 'jester') {
      html += '<div class="notice bad"><strong>Jester Haunt:</strong> The Jester ghost may haunt one Guilty voter.</div>';
      html += '<h3 class="wizard-title">Jester Haunt</h3>';
      var guiltyVoters = ((state.trial && state.trial.votes) || []).filter(function (v) {
        return v.verdict === 'GUILTY';
      }).map(function (v) {
        return UI.findPlayer(state, v.voterId);
      }).filter(function (gp) {
        return gp && gp.isAlive;
      });
      if (!guiltyVoters.length) {
        html += '<p class="wizard-label">No living Guilty voters from the lynch trial.</p>' +
          '<p class="muted small">The haunt may only target someone who voted Guilty.</p>';
      } else {
        html += '<p class="wizard-label">Pick one player who voted Guilty in the lynch trial</p>' +
          '<div class="btn-col">';
        guiltyVoters.forEach(function (gp) {
          html += '<button class="btn btn-actor" data-action="wizard-target" data-target="' + UI.esc(gp.id) + '">' +
            UI.esc(gp.name) + ' \u00B7 ' + (gp.assignedRole ? UI.roleName(gp.assignedRole) : '?') + '</button>';
        });
        html += '</div>';
      }
    } else {
      var corpses = corpseRoles().indexOf(role) !== -1;
      html += '<p class="wizard-label">' + (corpses ? 'Point to a corpse' : 'Point to your target') + '</p>';
      html += corpses ? corpseBtns(state) : livingBtns(state, 'wizard-target', exclude);
    }

    html += '<div class="btn-row">' +
      '<button class="btn btn-sm btn-ok" data-action="wizard-actor-back">Back</button>' +
      '<button class="btn btn-sm" data-action="wizard-skip">Skip</button></div>';
    return html;
  }

  function actionSummary(state) {
    var actions = (state.night && state.night.actions) || [];
    if (!actions.length) return '<p class="muted small">No actions recorded for this night yet.</p>';
    var html = '<div class="wizard-summary"><div class="card-head"><h3>Night Actions Summary</h3></div>';
    actions.forEach(function (a) {
      var role = E.ROLES && E.ROLES[a.roleId];
      var rn = role ? role.name : a.roleId;
      var tgt = a.targetId != null ? UI.nameOf(state, a.targetId) : null;
      var label;
      if (a.roleId === 'veteran') label = a.extra && a.extra.alert ? 'alert' : 'no alert';
      else if (a.roleId === 'doctor') label = 'protect';
      else if (a.roleId === 'jailor') label = 'jail ' + ((a.extra && a.extra.jailorDecision) || 'SPARE');
      else if (a.roleId === 'godfather' || a.roleId === 'mafioso') label = 'kill';
      else if (a.roleId === 'witch') label = a.extra && a.extra.controlRedirect != null ? 'control + redirect' : 'control';
      else if (a.roleId === 'medium') label = tgt ? 'seance' : 'ledger';
      else if (a.roleId === 'witness') label = 'compare 2';
      else label = a.roleId;
      html += '<div class="summary-row"><span class="summary-role">' + UI.esc(rn) + '</span>' +
        '<span class="summary-arrow">\u2192</span>' +
        '<span class="summary-target">' + (tgt ? UI.esc(tgt) : '<span class="muted">\u2013</span>') + '</span>' +
        '<span class="tag tag-accent">' + UI.esc(label) + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  function infoRoleSet() {
    return ['sheriff', 'deputy', 'tracker', 'lookout', 'undertaker', 'consigliere', 'witness', 'spy', 'oracle', 'witch'];
  }

  function nightZeroWizard(state, cfg, app) {
    var w = app.wizard;
    var steps = w.steps || [];
    var idx = Math.min(w.idx, Math.max(0, steps.length - 1));
    var html = '<div class="card night-card night-zero-card">';
    if (!steps.length) {
      html += '<h2>Night Zero</h2><p class="muted">Tap Complete Night Zero to continue.</p>';
      html += '</div>';
      return html;
    }
    var step = steps[idx];
    var isFinal = !step.roles || step.roles.length === 0;
    html += '<div class="wizard-progress">Step ' + (idx + 1) + ' of ' + steps.length + '</div>';
    html += '<h2 class="wizard-title">' + UI.esc(step.title) + '</h2>';
    html += '<p class="wizard-prompt">' + UI.esc(step.prompt) + '</p>';
    if (isFinal) {
      html += '<p class="muted">All start-knowing roles have been informed. Complete Night Zero to advance to Day 1.</p>';
      html += '<button class="btn btn-primary btn-block" data-action="resolve-night-zero">Complete Night Zero</button>';
    } else {
      var roleId = step.roles[0];
      var actor = state.players.find(function (p) { return p.assignedRole === roleId; });
      if (actor) {
        html += '<p class="wizard-label">Wake <strong>' + UI.esc(actor.name) + '</strong> (' + UI.roleName(actor.assignedRole) + ').</p>';
        var log = (state.playerLog && state.playerLog[String(actor.id)]) || [];
        var infos = log.filter(function (e) { return e.kind === 'info' && e.at === 'SETUP'; });
        if (infos.length) {
          html += '<div class="whisper-group"><div class="whisper-actor">Starting info</div>';
          infos.forEach(function (e) {
            html += '<div class="whisper-entry"><span class="tag tag-accent">' + UI.esc(e.at) + '</span>' +
              '<span class="whisper-text">' + UI.esc(e.text) + '</span></div>';
          });
          html += '</div>';
        } else {
          html += '<p class="muted small">No start-knowing info recorded.</p>';
        }
      }
      html += '<button class="btn btn-primary btn-block" data-action="wizard-next">Next Step</button>';
    }
    html += '<button class="btn btn-sm wizard-nav"' + (idx === 0 ? ' disabled' : '') +
      ' data-action="wizard-back">Previous step</button>';
    html += '</div>';
    return html;
  }

  function nightWizard(state, cfg, app) {
    var w = app.wizard;
    if (w && w.nightZero) return nightZeroWizard(state, cfg, app);
    var steps = w.steps || [];
    var idx = Math.min(w.idx, Math.max(0, steps.length - 1));
    var html = '<div class="card night-card">';
    if (!steps.length) {
      html += '<h2>No night steps</h2><p class="muted">Tap Resolve Night to continue.</p>';
      html += '</div>';
      return html;
    }
    var step = steps[idx];
    var posCount = 0;
    steps.forEach(function (s) { if (s.position === step.position) posCount += 1; });
    html += '<div class="wizard-progress">Step ' + (idx + 1) + ' of ' + steps.length +
      (posCount > 1 && step.position < 14 ? ' <span class="tag tag-accent">Pos ' + step.position + ' \u00B7 group</span>' : '') + '</div>';
    if (idx === steps.length - 1 && step.position < 14) {
      html += '<div class="notice ok">Night recording complete &mdash; tap <strong>Resolve Night</strong> below to process it.</div>';
    }
    if (idx === steps.length - 1) {
      html += actionSummary(state);
    }
    html += '<h2 class="wizard-title">' + UI.esc(step.title) + '</h2>';
    html += '<p class="wizard-prompt">' + UI.esc(step.prompt) + '</p>';
    if (step.timerSeconds) {
      html += '<div class="timer" data-timer-seconds="' + step.timerSeconds + '" data-timer-kind="step"></div>';
    }
    if (step.position >= 14) {
      html += '<p class="muted">Morning has broken. Night recording is complete: tap <strong>Resolve Night</strong> below to process it.</p>';
    } else if (step.position === 6) {
      var mafiaDone = ((state.night && state.night.actions) || []).some(function (ac) {
        return ac.position === 6 && (ac.roleId === 'godfather' || ac.roleId === 'mafioso');
      });
      if (mafiaDone) {
        html += '<div class="actor-done"><span class="tag tag-ok">RECORDED</span> Mafia kill target</div>' +
          '<button class="btn btn-primary btn-block" data-action="wizard-next">Next Step</button>';
      } else {
        var leader = E.mafiaKillActor(state);
        html += '<p class="wizard-label">Mafia, point to your kill target.</p>';
        if (leader) {
          html += '<p class="wizard-label">Kill leader: ' + UI.esc(leader.name) + ' (' + UI.roleName(leader.assignedRole) + ')</p>';
          html += livingBtns(state, 'wizard-mafia-target', leader.id);
        } else {
          html += '<p class="muted small">No Mafia killer is available.</p>';
        }
        html += '<button class="btn btn-block" data-action="wizard-next">Skip to next step</button>';
      }
    } else {
      var actors = wizardActors(state, step);
      var remaining = actors.filter(function (a) { return !a.done; });
      if (!actors.length) {
        var roleList = (step.roles || []).map(function (rid) { return UI.roleName(rid); }).join(' / ');
        var inDeck = (step.roles || []).some(function (rid) { return (state.deck || []).indexOf(rid) !== -1; });
        html += '<p class="muted">' + (inDeck ? 'No living ' + roleList + ' players this night.' : roleList + ' is not in the current deck.') + '</p>';
        html += '<button class="btn btn-block" data-action="wizard-next">Continue</button>';
      } else if (!w.actor) {
        var infoSet = infoRoleSet();
        var stepInfoActors = actors.filter(function (a) { return infoSet.indexOf(a.role) !== -1; });
        if (stepInfoActors.length && state.night && state.night.number) {
          var fresh = UI.whisperResultCard(state, app, state.night.number,
            stepInfoActors.map(function (a) { return a.player.id; }));
          if (fresh) html += fresh;
        }
        actors.filter(function (a) { return a.done; }).forEach(function (a) {
          html += '<div class="actor-done"><span class="tag tag-ok">RECORDED</span> ' +
            UI.esc(a.name) + ' - ' + UI.roleName(a.role) + '</div>';
        });
        if (!remaining.length) {
          html += '<p class="muted small">All actors recorded. Continue to the next step.</p>';
          html += '<button class="btn btn-primary btn-block" data-action="wizard-next">Next Step</button>';
        } else {
          html += '<p class="wizard-label">Who acts?</p><div class="btn-col">';
          remaining.forEach(function (a) {
            html += '<button class="btn btn-actor" data-action="wizard-actor" data-role="' + UI.esc(a.role) +
              '" data-player="' + UI.esc(a.player.id) + '">' + UI.esc(a.name) + ' - ' + UI.roleName(a.role) + '</button>';
          });
          html += '</div>';
          html += '<button class="btn btn-block" data-action="wizard-next">Skip to next step</button>';
        }
      } else {
        html += actorControls(state, step, w);
      }
    }
    html += '<button class="btn btn-sm wizard-nav"' + (idx === 0 ? ' disabled' : '') +
      ' data-action="wizard-back">Previous step</button>';
    html += '</div>';
    return html;
  }

  UI.nightWizard = nightWizard;
})();
