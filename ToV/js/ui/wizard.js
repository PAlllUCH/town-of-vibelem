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
      if (exclude != null && String(exclude) === String(p.id)) return;
      html += '<button class="btn btn-actor" data-action="' + action + '" data-target="' + UI.esc(p.id) + '">' +
        UI.esc(p.name) + '</button>';
    });
    html += '</div>';
    return html;
  }

  function corpseBtns(state) {
    var g = state.graveyard || [];
    if (!g.length) return '<p class="muted">No corpses yet.</p>';
    var html = '<div class="btn-col">';
    g.forEach(function (x) {
      html += '<button class="btn btn-actor" data-action="wizard-target" data-target="' + UI.esc(x.playerId) + '">' +
        UI.esc(x.name) + '</button>';
    });
    html += '</div>';
    return html;
  }

  function actorControls(state, step, w) {
    var role = w.actor.role;
    var pid = w.actor.player;
    if (pid && typeof pid === 'object') pid = pid.id;
    var p = UI.findPlayer(state, pid);
    var selfAllowed = role === 'doctor' || corpseRoles().indexOf(role) !== -1;
    var exclude = selfAllowed ? null : pid;
    var html = '';
    html += '<p class="wizard-label">Acting: ' + UI.esc(p && p.name ? p.name : pid) + ' - ' + UI.roleName(role) +
      (w.actor.inherited ? ' (inherited)' : '') + '</p>';

    if (role === 'veteran') {
      html += '<div class="btn-col">' +
        '<button class="btn btn-primary" data-action="wizard-alert" data-alert="true">Yes, Alert</button>' +
        '<button class="btn" data-action="wizard-alert" data-alert="false">No Alert</button></div>';
    } else if (role === 'witch') {
      if (!w.pending || !w.pending.control) {
        html += '<p class="wizard-label">Point to the player you control</p>' + livingBtns(state, 'wizard-target', exclude);
      } else {
        html += '<p class="wizard-label">Controlled: ' + UI.esc(UI.nameOf(state, w.pending.control)) +
          '. Now point to the redirect target</p>' + livingBtns(state, 'wizard-target', exclude);
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
        html += '<p class="wizard-label">Forging a will for: ' + UI.esc(UI.nameOf(state, w.pending.forge)) + '</p>' +
          '<p class="muted small">The forged will is read from the player\'s card.</p>' +
          '<button class="btn btn-primary btn-block" data-action="wizard-decision" data-decision="FORGE">Confirm Forge</button>';
      }
    } else if (role === 'medium') {
      if (p.isAlive) {
        html += '<button class="btn btn-block" data-action="wizard-target" data-target="__none__">' +
          'Medium read the Ghost Ledger (no target)</button>';
      } else {
        html += '<p class="wizard-label">Dead Medium: pick a living player to whisper with</p>' +
          livingBtns(state, 'wizard-target', exclude);
      }
    } else if (role === 'jester') {
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
            UI.esc(gp.name) + '</button>';
        });
        html += '</div>';
      }
    } else {
      var corpses = corpseRoles().indexOf(role) !== -1;
      html += '<p class="wizard-label">' + (corpses ? 'Point to a corpse' : 'Point to your target') + '</p>';
      html += corpses ? corpseBtns(state) : livingBtns(state, 'wizard-target', exclude);
    }

    html += '<div class="btn-row">' +
      '<button class="btn btn-sm" data-action="wizard-actor-back">Back</button>' +
      '<button class="btn btn-sm" data-action="wizard-skip">Skip</button></div>';
    return html;
  }

  function nightWizard(state, cfg, app) {
    var w = app.wizard;
    var steps = w.steps || [];
    var idx = Math.min(w.idx, Math.max(0, steps.length - 1));
    var html = '<div class="card night-card">';
    if (!steps.length) {
      html += '<h2>No night steps</h2><p class="muted">Tap Resolve Night to continue.</p>';
      html += '</div>';
      return html;
    }
    var step = steps[idx];
    html += '<div class="wizard-progress">Step ' + (idx + 1) + ' of ' + steps.length + '</div>';
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
        html += '<p class="muted">No eligible actors this night.</p>';
        html += '<button class="btn btn-block" data-action="wizard-next">Continue</button>';
      } else if (!w.actor) {
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
    if (idx > 0) {
      html += '<button class="btn btn-sm" data-action="wizard-back" style="margin-top:10px;">Previous step</button>';
    }
    html += '</div>';
    return html;
  }

  UI.nightWizard = nightWizard;
})();
