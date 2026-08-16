'use strict';

(function () {
  var UI = window.UI || {};
  var APP = window.APP;

  function updateReferenceList() {
    var list = document.querySelector('#reference-panel .reference-list');
    if (!list || !APP.app.referenceOpen) return;
    list.innerHTML = UI.renderReferenceList(APP.app);
  }

  function updateReferencePanel() {
    var panel = document.getElementById('reference-panel');
    if (!panel) return;
    var rb = document.querySelector('.app-header [data-action="toggle-reference"]');
    if (APP.app.referenceOpen) {
      panel.innerHTML = UI.renderRoleReference(APP.state, APP.app);
      panel.classList.add('open');
      document.body.classList.add('reference-open');
    } else {
      panel.classList.remove('open');
      panel.innerHTML = '';
      document.body.classList.remove('reference-open');
    }
    if (rb && rb.classList) rb.classList.toggle('on', !!APP.app.referenceOpen);
  }

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-action') === 'reference-search') {
      APP.app.referenceQuery = t.value || '';
      APP.updateReferenceList();
    }
  });

  APP.updateReferencePanel = updateReferencePanel;
  APP.updateReferenceList = updateReferenceList;
})();
