'use strict';

(function () {
  var E = window.VillageEngine || {};
  var APP = window.APP;

  function save() {
    var app = APP.app;
    var ui = {
      rolesHidden: app.rolesHidden,
      namingMode: app.namingMode,
      wizardIdx: app.wizard ? app.wizard.idx : 0,
      pendingRoles: app.pendingRoles || {},
      names: app.names || {},
      dayTimerEnds: app.dayTimerEnds || null,
      dayTimerTotal: app.dayTimerTotal || null
    };
    var payload = { cfg: APP.cfg, ui: ui, game: APP.state ? E.serialize(APP.state) : null };
    try {
      localStorage.setItem(APP.SAVE_KEY, JSON.stringify(payload));
    } catch (e) { }
  }

  function renderResumeBanner() {
    var host = APP.el('resume-banner');
    var data = null;
    try { data = JSON.parse(localStorage.getItem(APP.SAVE_KEY) || 'null'); } catch (e) { data = null; }
    if (data && data.game) {
      host.innerHTML = '<div class="resume-banner"><strong>Saved game found</strong>' +
        '<span class="muted small">A game is in progress. Resume it or start fresh.</span>' +
        '<div class="btn-row"><button class="btn btn-primary" data-action="resume-game">Resume</button>' +
        '<button class="btn" data-action="new-game">New Game</button></div></div>';
    } else {
      host.innerHTML = '';
    }
  }

  function afterMutation() {
    save();
    APP.renderScreen(APP.app.screen);
  }

  function loadSave() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(APP.SAVE_KEY) || 'null'); } catch (e) { data = null; }
    return data;
  }

  function clearSave() {
    try { localStorage.removeItem(APP.SAVE_KEY); } catch (e) { }
  }

  APP.save = save;
  APP.renderResumeBanner = renderResumeBanner;
  APP.afterMutation = afterMutation;
  APP.loadSave = loadSave;
  APP.clearSave = clearSave;
})();
