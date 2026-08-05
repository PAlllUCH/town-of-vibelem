'use strict';

(function () {
  var APP = window.APP;
  if ('serviceWorker' in navigator && location.protocol.indexOf('https') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  APP.init();
  APP.goto('setup');
})();
