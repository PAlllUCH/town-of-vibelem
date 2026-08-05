'use strict';

(function () {
  var UI = window.UI || {};
  var APP = window.APP;

  function el(id) { return document.getElementById(id); }

  function renderSetupOnly() {
    el('setup-body').innerHTML = UI.renderSetup(APP.cfg);
    APP.renderResumeBanner();
  }

  function renderGame() {
    var out = UI.renderGame(APP.state, APP.cfg, APP.app);
    el('game-header').innerHTML = UI.renderGameHeader(APP.state, APP.cfg, APP.app);
    el('game-body').innerHTML = out.body;
    el('game-bar').innerHTML = out.bar;
    startTimers();
  }

  function renderScreen(name) {
    if (!APP.state) {
      renderSetupOnly();
      return;
    }
    if (name === 'setup') renderSetupOnly();
    else if (name === 'seats') el('seats-body').innerHTML = UI.renderSeats(APP.state, APP.cfg, APP.app);
    else if (name === 'game') renderGame();
    else if (name === 'end') el('end-body').innerHTML = UI.renderEnd(APP.state, APP.cfg, APP.app);
  }

  function goto(name) {
    APP.app.screen = name;
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('active', s.getAttribute('data-screen') === name);
    });
    renderScreen(name);
    window.scrollTo(0, 0);
  }

  function refreshSetup() {
    APP.save();
    renderSetupOnly();
  }

  var timerId = null;

  function clearTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function onTimerDone(kind) {
    APP.app.timerDeadline = null;
    if (kind === 'will') {
      APP.app.willOpen = false;
      UI.toast('Pencils down! Wills are locked.');
      APP.afterMutation();
    } else {
      UI.toast('Time is up.');
    }
  }

  function startTimers() {
    clearTimer();
    var t = document.querySelector('[data-timer-seconds]');
    if (!t) { APP.app.timerDeadline = null; return; }
    var total = Number(t.getAttribute('data-timer-seconds')) || 0;
    var kind = t.getAttribute('data-timer-kind') || 'step';
    if (APP.app.timerDeadline == null) APP.app.timerDeadline = Date.now() + total * 1000;
    var tick = function () {
      var remain = Math.max(0, Math.round((APP.app.timerDeadline - Date.now()) / 1000));
      t.textContent = remain + 's';
      if (remain <= 0) {
        clearTimer();
        APP.app.timerDeadline = null;
        onTimerDone(kind);
      }
    };
    tick();
    if (t.textContent !== '0s') timerId = setInterval(tick, 1000);
  }

  APP.el = el;
  APP.goto = goto;
  APP.renderScreen = renderScreen;
  APP.renderSetupOnly = renderSetupOnly;
  APP.renderGame = renderGame;
  APP.refreshSetup = refreshSetup;
  APP.startTimers = startTimers;
  APP.clearTimer = clearTimer;
  APP.onTimerDone = onTimerDone;
})();
