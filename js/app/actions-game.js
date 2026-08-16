'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI || {};
  var APP = window.APP;

  function resolveNight() {
    try {
      E.resolveNight(APP.state);
      APP.state.phase = 'MORNING';
      APP.app.wizard = null;
      APP.app.timerDeadline = null;
      APP.afterMutation();
      checkEnd();
    } catch (e) {
      UI.toast('Night error: ' + e.message, 'error');
    }
  }

  function beginDay() {
    try {
      E.beginDay(APP.state);
      APP.afterMutation();
      checkEnd();
    } catch (e) {
      UI.toast('Day error: ' + e.message, 'error');
    }
  }

  function checkEnd() {
    if (APP.state.phase === 'END' || APP.state.winner) {
      finish(APP.app.lastVictory);
      return true;
    }
    var v = E.checkVictory(APP.state);
    if (v) {
      finish(v);
      return true;
    }
    return false;
  }

  function finish(v) {
    APP.app.lastVictory = v || APP.app.lastVictory;
    if (v && v.winner) APP.state.winner = v.winner;
    else if (APP.state.winner && typeof APP.state.winner === 'object' && APP.state.winner.winner) APP.state.winner = APP.state.winner.winner;
    try {
      if (APP.app.endReveal == null) {
        var er = E.endGame(APP.state);
        APP.app.endReveal = er && er.reveal ? er.reveal : null;
      }
    } catch (e) { }
    APP.state.phase = 'END';
    APP.app.wizard = null;
    APP.afterMutation();
    APP.goto('end');
  }
  APP.resolveNight = resolveNight;
  APP.beginDay = beginDay;
  APP.checkEnd = checkEnd;
  APP.finish = finish;
})();
