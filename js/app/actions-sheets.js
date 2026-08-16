'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI || {};
  var APP = window.APP;

  function dispatch(action, btn) {
    switch (action) {
      case 'open-naming-sheet':
        APP.openNamingSheet(btn.getAttribute('data-seat'));
        break;
      case 'open-detail-sheet':
        APP.openDetailSheet(btn.getAttribute('data-seat'));
        break;
      case 'pick-role':
        APP.pickRole(btn);
        break;
      case 'clear-role':
        APP.clearRole();
        break;
      case 'save-seat':
        APP.saveSeat();
        break;
      case 'close-sheet':
        APP.closeSheet();
        break;
      default:
        break;
    }
  }

  function pickRole(btn) {
    var app = APP.app;
    if (!app || !app.sheet) return;
    var role = btn.getAttribute('data-role');
    if (!role) return;
    app.sheet.role = role;
    app.sheet.focusFirst = false;
    var host = document.getElementById('sheet-root');
    if (!host || !host.querySelectorAll) return;
    var btns = host.querySelectorAll('.seat-sheet-role-btn');
    for (var i = 0; i < btns.length; i += 1) {
      var b = btns[i];
      var on = b.getAttribute('data-role') === role;
      if (on) b.classList.add('on');
      else b.classList.remove('on');
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    var cur = host.querySelector('.seat-sheet-current strong');
    if (cur) cur.textContent = UI.roleName(role);
  }

  function clearRole() {
    var app = APP.app;
    if (!app || !app.sheet || app.sheet.kind !== 'naming') return;
    app.sheet.role = '';
    app.sheet.focusFirst = false;
    UI.mountSheet(APP.state, APP.cfg, app);
  }

  function playerBySeat(seat) {
    var out = null;
    (APP.state.players || []).forEach(function (p) {
      if (String(p.seat) === String(seat)) out = p;
    });
    return out;
  }

  function openNamingSheet(seat) {
    var s = Number(seat);
    var pr = APP.app.pendingRoles && APP.app.pendingRoles[s];
    var role = pr != null && pr !== '' ? pr : '';
    if (!role) {
      var p = playerBySeat(s);
      if (p && p.assignedRole) role = p.assignedRole;
    }
    APP.app.sheet = { kind: 'naming', seat: s, role: role || null };
    APP.app.sheetFocusSeat = s;
    UI.mountSheet(APP.state, APP.cfg, APP.app);
  }

  function openDetailSheet(seat) {
    var p = playerBySeat(seat);
    if (!p) return;
    APP.app.sheet = { kind: 'detail', id: p.id };
    APP.app.sheetFocusSeat = Number(seat);
    UI.mountSheet(APP.state, APP.cfg, APP.app);
  }

  function updateSheetDom() {
    UI.mountSheet(APP.state, APP.cfg, APP.app);
  }

  function saveSeat() {
    var app = APP.app;
    var sh = app.sheet;
    if (!sh || sh.kind !== 'naming') return;
    var seat = Number(sh.seat);
    var input = document.getElementById('seat-name-input');
    var name = input && input.value != null ? input.value : (sh.name != null ? sh.name : '');
    app.names[seat] = name;
    if (sh.role) app.pendingRoles[seat] = sh.role;
    else delete app.pendingRoles[seat];
    app.sheet = null;
    var focusSeat = app.sheetFocusSeat;
    app.sheetFocusSeat = null;
    UI.unmountSheet();
    APP.afterMutation();
    if (focusSeat != null) {
      var b = document.querySelector('[data-seat="' + focusSeat + '"]');
      if (b && b.focus) b.focus();
    }
  }

  function closeSheet() {
    var app = APP.app;
    if (!app.sheet) return;
    var focusSeat = app.sheetFocusSeat;
    app.sheet = null;
    app.sheetFocusSeat = null;
    UI.unmountSheet();
    APP.afterMutation();
    if (focusSeat != null) {
      var b = document.querySelector('[data-seat="' + focusSeat + '"]');
      if (b && b.focus) b.focus();
    }
  }

  function trapFocus(ev) {
    var sheet = document.querySelector('.seat-sheet.open');
    if (!sheet) return;
    var focusables = sheet.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var inside = sheet.contains(document.activeElement);
    if (ev.shiftKey) {
      if (!inside || document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      }
    } else if (!inside || document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!btn) return;
    dispatch(btn.getAttribute('data-action'), btn);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Tab') {
      trapFocus(ev);
      return;
    }
    if (ev.key !== 'Escape') return;
    if (APP.app.sheet) closeSheet();
  });

  APP.openNamingSheet = openNamingSheet;
  APP.openDetailSheet = openDetailSheet;
  APP.updateSheetDom = updateSheetDom;
  APP.pickRole = pickRole;
  APP.clearRole = clearRole;
  APP.saveSeat = saveSeat;
  APP.closeSheet = closeSheet;
})();
