# Sidebar Implementation — Single Pass

## CRITICAL RULES (from previous failure)
1. DO NOT break the existing panel mechanism. Panels STILL render into `#panel-root`. The sidebar is ADDITIONAL.
2. `UI.renderGameHeader()` must STILL return the same HTML structure. Add the hamburger button AFTER the existing buttons, not instead of them.
3. `afterMutation()` must still work — do not change how the game body/header is rendered.
4. `UI.renderGame()` must still return the same HTML. Do not remove or reorder existing elements.

## What the sidebar IS
A right-sliding drawer that provides quick access to navigation items. It does NOT replace the existing panel system — it supplements it.

## Files to edit (ONLY these 3)
1. `styles/base.css` — add sidebar CSS classes
2. `index.html` — add sidebar container div
3. `js/ui/day.js` — add hamburger button to header + sidebar content rendering

## DO NOT edit
- `js/ui/panels.js` — panels stay as-is
- `js/app/actions-panels.js` — panel logic stays as-is
- `js/app/actions.js` — actions stay as-is

## 1. CSS: `styles/base.css`
Append these rules at the end of the file:

```css
.sidebar-backdrop{position:fixed;inset:0;z-index:30;background:var(--scrim);display:none}
.sidebar-backdrop.open{display:block}
.sidebar{position:fixed;top:0;bottom:0;right:0;z-index:31;width:min(300px,85vw);background:var(--bg);border-left:1px solid var(--line);transform:translateX(100%);transition:transform .2s ease;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column}
.sidebar.open{transform:translateX(0)}
.sidebar-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:1}
.sidebar-head h3{margin:0;font-size:1rem}
.sidebar-body{flex:1;overflow-y:auto;padding:8px 0}
.sidebar-item{display:flex;align-items:center;gap:10px;padding:12px 16px;min-height:48px;border-bottom:1px solid var(--line);font-size:.95rem;cursor:pointer}
.sidebar-item:active{background:var(--hover)}
.sidebar-event-log{max-height:40vh;overflow-y:auto;padding:8px 16px;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted)}
.sidebar-event-log p{margin:4px 0}
```

## 2. HTML: `index.html`
After the `<nav id="game-bar" ...>` line, add:

```html
<div id="sidebar-backdrop" class="sidebar-backdrop" data-action="close-sidebar"></div>
<div id="sidebar" class="sidebar">
  <div class="sidebar-head"><h3>Menu</h3><button class="btn btn-sm" data-action="close-sidebar">✕</button></div>
  <div class="sidebar-body" id="sidebar-body"></div>
  <div class="sidebar-event-log" id="sidebar-event-log"></div>
</div>
```

## 3. JS: `js/ui/day.js`
In `UI.renderGameHeader`, AFTER the existing buttons row, add a hamburger button:

Change this line:
```
'<button class="btn btn-sm" data-action="toggle-mod">Mod</button></div></div>';
```
To this:
```
'<button class="btn btn-sm" data-action="toggle-mod">Mod</button>' +
'<button class="btn btn-sm sidebar-toggle" data-action="toggle-sidebar" aria-label="Menu" style="margin-left:auto">☰</button></div></div>';
```

Also add a new function `UI.renderSidebar` that builds the sidebar body content:

```javascript
UI.renderSidebar = function (state, app) {
  var items = [
    { label: 'Tokens', action: 'toggle-tokens' },
    { label: 'Claims', action: 'toggle-claims' },
    { label: 'Seats', action: 'toggle-seat-overlay' },
    { label: 'Log', action: 'toggle-logs' },
    { label: 'Mod', action: 'toggle-mod' },
    { label: 'Roles', action: 'goto-reference' }
  ];
  var html = '';
  items.forEach(function (item) {
    html += '<div class="sidebar-item" data-action="' + item.action + '">' + UI.esc(item.label) + '</div>';
  });
  return html;
};

UI.renderSidebarLog = function (state) {
  var logs = (state.logs || []).slice(-20);
  return logs.map(function (l) { return '<p>' + UI.esc(l) + '</p>'; }).join('');
};
```

In `UI.renderGame`, at the very END of the function (after building `body` and `bar`), add sidebar rendering:

```javascript
  // After body += ... and bar += ...
  var sidebarBody = document.getElementById('sidebar-body');
  var sidebarLog = document.getElementById('sidebar-event-log');
  if (sidebarBody) sidebarBody.innerHTML = UI.renderSidebar(state, app);
  if (sidebarLog) sidebarLog.innerHTML = UI.renderSidebarLog(state);
```

## 4. Sidebar toggle actions: `js/ui/day.js`
Add event listener for sidebar toggle. At the end of the IIFE in day.js, add:

```javascript
document.addEventListener('click', function (e) {
  var action = e.target.closest('[data-action]');
  if (!action) return;
  var act = action.getAttribute('data-action');
  if (act === 'toggle-sidebar') {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-backdrop').classList.toggle('open');
    e.preventDefault();
  } else if (act === 'close-sidebar') {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
    e.preventDefault();
  } else if (act === 'goto-reference') {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
    // Trigger reference screen via existing mechanism
    if (APP && APP.showReference) APP.showReference();
  }
});
```

## Verification
After editing, run: `node --test tests/helpers.js tests/engine-core.test.js tests/engine-night.test.js tests/engine-roles.test.js tests/engine-trial.test.js tests/engine-victory.test.js tests/game-loop.test.js tests/app-ui.test.js`

All existing tests must pass. The sidebar is purely additive — no existing behavior changes.
