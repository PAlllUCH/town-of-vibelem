# Collapsible Panel Design Standard

All panels in the main view must be collapsible and follow the tile language defined by the Roles side-menu panel in `styles/reference.css`.

## Reference Panel Tile Language

The visual standard for every panel row and container:

| Property | Value |
|---|---|
| Background | `var(--panel)` |
| Border | `1px solid var(--line)` |
| Border radius | `var(--radius-sm)` (10px) |
| Min height | 44px (touch target) |
| Padding | `10px 12px` for rows, `var(--space-4)` for card padding |
| Row margin | `8px 0` between rows |
| Inner dividers | `1px solid var(--line-dim)` or `1px solid var(--line)` |
| No heavy chrome | No box-shadow, no 2px borders, no left-border accents on panel rows |

The card header is a full-bleed `var(--panel2)` band with `1px solid var(--line)` bottom border and `var(--radius-sm) var(--radius-sm) 0 0` top corners, giving the card a clean two-zone layout: header band + body.

## Collapsible Panel Pattern

Every panel uses a wrapper div with the `card-collapsible` class (or `helper-card` with `card-collapsible`). The header contains an `<h2>` and a `.btn.btn-sm.btn-collapse` toggle button. The body is wrapped in a div with class `card-body` (or `helper-card-body`).

When collapsed, the `.collapsed` class on the wrapper hides the body via `display: none`.

### Class names and data-card keys

| Panel | Wrapper classes | Body class | data-card key |
|---|---|---|---|
| Helper: Night Order | `helper-card card-collapsible` | `helper-card-body` | `helper-night-order` |
| Helper: Players | `helper-card card-collapsible` | `helper-card-body` | `helper-players` |
| Helper: Statuses | `helper-card card-collapsible` | `helper-card-body` | `helper-statuses` |
| Night Wizard | `card night-card card-collapsible` | `card-body` | `night-wizard` |
| Seat Grid Overlay | `card card-collapsible` | `card-body` | `seat-grid` |
| Picker | `card picker-card card-collapsible` | `card-body` | `picker` |
| Whisper Results | `card whisper-results card-collapsible` | `card-body` | `whisper` |

### Markup template (card variant)

```html
<div class="card card-collapsible collapsed">
  <div class="card-head">
    <h2>Title</h2>
    <button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="..."
            aria-expanded="false" aria-controls="card-body-...">+</button>
  </div>
  <div class="card-body" id="card-body-...">
    <!-- panel content -->
  </div>
</div>
```

### Markup template (helper variant)

```html
<div class="helper-card card-collapsible collapsed">
  <div class="helper-card-head">
    <h2>Title</h2>
    <button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="..."
            aria-expanded="false" aria-controls="card-body-...">+</button>
  </div>
  <div class="helper-card-body" id="card-body-...">
    <!-- panel content -->
  </div>
</div>
```

## Rules for Future Panels

1. Every panel in the main view (game screen, morning, day, night) must use the collapsible pattern above.
2. Use `UI.card(title, body, key, app)` where possible; it generates the correct structure.
3. For helper panels, wrap content in `helper-card card-collapsible` with a `helper-card-body` wrapper.
4. Never use `var(--radius)` (14px) on card containers; always `var(--radius-sm)` (10px).
5. Never use `box-shadow: var(--shadow)` on cards.
6. The collapse button is always `.btn.btn-sm.btn-collapse`: 44px square, `+` when collapsed, `-` when expanded.
7. Collapsed state is persisted in `app.collapsed[key]` and serialized in the save payload.
8. Use only design tokens: `--panel`, `--panel2`, `--bg2`, `--line`, `--line-dim`, `--text`, `--muted`, `--accent`, `--accent-dim`, `--warn`, `--bad`, `--radius`, `--radius-sm`, `--space-1` through `--space-5`, `--shadow`.
