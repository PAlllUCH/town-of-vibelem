'use strict';

// Build stamp: bump BUILD on every deploy so clients pick up new code.
var BUILD = '2026-09-03-1';
var CACHE_NAME = 'tov-' + BUILD;
var CACHE_PREFIX = 'tov-';
var CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './styles/base.css',
  './styles/setup.css',
  './styles/seats.css',
  './styles/sheets.css',
  './styles/game.css',
  './styles/clock.css',
  './styles/end.css',
  './styles/reference.css',
  './styles/helper.css',
  './js/engine/00-namespace.js',
  './js/engine/01-roles.js',
  './js/engine/01b-strings.js',
  './js/engine/02-presets.js',
  './js/engine/03-deck.js',
  './js/engine/04-state.js',
  './js/engine/04b-start-knowing.js',
  './js/engine/05-night-steps.js',
  './js/engine/06-night-actions.js',
  './js/engine/06b-night-actions.js',
  './js/engine/07-night-resolution.js',
  './js/engine/07b-night-resolution.js',
  './js/engine/08-ghosts.js',
  './js/engine/09-day.js',
  './js/engine/09b-day-actions.js',
  './js/engine/10-victory.js',
  './js/ui/common.js',
  './js/ui/panels.js',
  './js/ui/claims.js',
  './js/ui/setup.js',
  './js/ui/seats.js',
  './js/ui/wizard.js',
  './js/ui/day.js',
  './js/ui/day-trial.js',
  './js/ui/end.js',
  './js/ui/reference.js',
  './js/ui/helper.js',
  './js/app/config.js',
  './js/app/persistence.js',
  './js/app/router.js',
  './js/app/actions-setup.js',
  './js/app/actions-seats.js',
  './js/app/actions-wizard.js',
  './js/app/actions-day.js',
  './js/app/actions-game.js',
  './js/app/actions-panels.js',
  './js/app/actions.js',
  './js/app/actions-reference.js',
  './js/app/actions-sheets.js',
  './js/app.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(CORE_ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') { return; }
  if (request.url.indexOf(self.location.origin) !== 0) { return; }
  var path = request.url.slice(self.location.origin.length).split('?')[0].split('#')[0];
  var isCode = request.mode === 'navigate' || /\.(html|js|css)$/.test(path);
  var isAsset = /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$/.test(path) || /manifest\.webmanifest$/.test(path);
  if (isCode && !isAsset) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          if (cached) { return cached; }
          if (request.mode === 'navigate') { return caches.match('./index.html'); }
          throw new Error('offline');
        });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) { return cached; }
      return fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        if (request.mode === 'navigate') { return caches.match('./index.html'); }
        return caches.match(request);
      });
    })
  );
});
