'use strict';

(function () {
  var UI = window.UI || {};
  var APP = window.APP;

  function nzToggle(id) {
    if (!id) return;
    var done = APP.app.nightZeroDone || (APP.app.nightZeroDone = {});
    done[id] = !done[id];
    APP.afterMutation();
  }

  function panelRoot() {
    var host = document.getElementById('panel-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'panel-root';
      if (document.body && document.body.appendChild) document.body.appendChild(host);
    }
    return host;
  }

  function updatePanels() {
    var app = APP.app;
    var open = app.whispersOpen || app.claimsOpen || app.claimPicker != null;
    var host = panelRoot();
    if (app.whispersOpen) {
      host.innerHTML = UI.renderWhispers(APP.state, app);
    } else if (app.claimsOpen) {
      var html = UI.renderClaimsPanel(APP.state, APP.cfg, app);
      if (app.claimPicker != null) html += UI.renderClaimPicker(APP.state, app);
      host.innerHTML = html;
    } else {
      host.innerHTML = '';
    }
    if (document.body) document.body.classList.toggle('panel-open', open);
  }

  function toggleWhispers() {
    var app = APP.app;
    app.whispersOpen = !app.whispersOpen;
    if (app.whispersOpen) app.claimsOpen = false;
    app.claimPicker = null;
    APP.afterMutation();
    updatePanels();
  }

  function toggleClaims() {
    var app = APP.app;
    app.claimsOpen = !app.claimsOpen;
    if (app.claimsOpen) app.whispersOpen = false;
    app.claimPicker = null;
    APP.afterMutation();
    updatePanels();
  }

  function claimOpen(seat) {
    APP.app.claimPicker = Number(seat);
    APP.afterMutation();
    updatePanels();
  }

  function claimPick(seat, roleId) {
    APP.app.claims[Number(seat)] = roleId;
    APP.app.claimPicker = null;
    APP.afterMutation();
    updatePanels();
  }

  function claimClear(seat) {
    delete APP.app.claims[Number(seat)];
    APP.app.claimPicker = null;
    APP.afterMutation();
    updatePanels();
  }

  function claimClose() {
    APP.app.claimPicker = null;
    APP.afterMutation();
    updatePanels();
  }

  APP.nzToggle = nzToggle;
  APP.toggleWhispers = toggleWhispers;
  APP.toggleClaims = toggleClaims;
  APP.claimOpen = claimOpen;
  APP.claimPick = claimPick;
  APP.claimClear = claimClear;
  APP.claimClose = claimClose;
  APP.updatePanels = updatePanels;
})();
