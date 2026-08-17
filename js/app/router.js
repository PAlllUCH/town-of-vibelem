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
    var body;
    var bar;
    if (APP.app.mode === 'helper') {
      body = UI.renderHelper(APP.state, APP.cfg, APP.app);
      if (APP.app.helperSheetPid != null) {
        body += UI.renderHelperSheet(APP.state, APP.app.helperSheetPid, APP.app);
      }
      bar = '';
    } else {
      var out = UI.renderGame(APP.state, APP.cfg, APP.app);
      body = out.body;
      bar = out.bar;
    }
    el('game-header').innerHTML = UI.renderGameHeader(APP.state, APP.cfg, APP.app);
    el('game-body').innerHTML = body;
    el('game-bar').innerHTML = bar;
    var sb = document.getElementById('sidebar-body');
    if (sb) sb.innerHTML = UI.renderSidebar(APP.state, APP.app);
    var sl = document.getElementById('sidebar-event-log');
    if (sl) sl.innerHTML = UI.renderSidebarLog(APP.state);
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
    var t = document.querySelector('[data-timer-seconds]');
    if (t) t.classList.remove('timer-danger');
  }

  function onTimerDone(kind) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(200); } catch (e) {}
    }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        var ctx = new Ctx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.42);
      }
    } catch (e) {}
    if (kind === 'day') {
      APP.app.timerDeadline = null;
      APP.app.dayTimerEnds = null;
      APP.app.dayTimerTotal = null;
      UI.toast('Time\'s up!');
      APP.afterMutation();
      return;
    }
    APP.app.timerDeadline = null;
    UI.toast('Time is up.');
  }

  function startTimers() {
    clearTimer();
    var t = document.querySelector('[data-timer-seconds]');
    if (!t) { APP.app.timerDeadline = null; return; }
    var total = Number(t.getAttribute('data-timer-seconds')) || 0;
    var kind = t.getAttribute('data-timer-kind') || 'step';
    if (kind === 'day') {
      var ends = APP.app.dayTimerEnds;
      if (ends == null) { APP.app.timerDeadline = null; return; }
      if (ends <= Date.now()) { APP.app.dayTimerEnds = null; APP.app.timerDeadline = null; return; }
      APP.app.timerDeadline = ends;
    } else if (APP.app.timerDeadline == null) {
      APP.app.timerDeadline = Date.now() + total * 1000;
    }
    var tick = function () {
      var remain = Math.max(0, Math.round((APP.app.timerDeadline - Date.now()) / 1000));
      var count = t.querySelector('.timer-count');
      if (count) count.textContent = remain + 's';
      else t.textContent = remain + 's';
      if (kind === 'day') {
        var full = APP.app.dayTimerTotal || total;
        var pct = full > 0 ? Math.max(0, Math.min(100, (remain / full) * 100)) : 0;
        t.style.setProperty('--p', pct);
        if (remain <= 30) t.classList.add('timer-danger');
        else t.classList.remove('timer-danger');
      }
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
