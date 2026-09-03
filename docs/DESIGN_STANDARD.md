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

## Palette Tokens

Team colors are the four tokens below; consumable tint tokens (`--accent-faint`, `--accent-dim`, `--accent-mid`, `--glow`, `--ring-glow`) are all derived from `--accent`. Never hardcode a color value in component CSS.

| Token | Value | Used by |
|---|---|---|
| `--town` | `#7a9ab5` | Town steel-blue; `.team-TOWN { --tc: var(--town); }` |
| `--mafia` | `#c45050` | Mafia crimson; `.team-MAFIA { --tc: var(--mafia); }` |
| `--neutral` | `#c99a2e` | Neutral gold; `.team-NEUTRAL { --tc: var(--neutral); }` |
| `--evil` | `#8a5a8a` | **Evil plum**; `.team-EVIL { --tc: var(--evil); }` and `.team-EVIL-text { color: var(--evil); }`. The `team-dot` fallback (`--tc, var(--muted)`) and the EVIL seat/row accent border (`border-top: var(--accent-bar) solid var(--tc, var(--line))`) pick up the plum through `--tc`. |

The `--tc` mapping is the single hook every team-colored component reads (`team-dot`, seat tiles, end reveal grid, reference/claims rows, setup deck chips).

## Approved Variants and Exceptions

These are the standing exceptions to the rules above; new work must follow the standard unless it matches one of these patterns.

### The clock header variant

The app header (`header.app-header`) carries only the hamburger (`toggle-sidebar`) and the title. The game header band (`#game-header`, rendered by `UI.renderGameHeader`) is the one approved full-bleed card surface in the header row: a `.card.card-head` wrapper containing the `div.cycle-clock` phase clock (`data-phase` + `data-cycle` on the same element, styled by `styles/clock.css`). Menu items (Switch to App/Helper, Tokens, Claims, Seats, Log, Mod, Roles) live in the sidebar, never in the header card.

### Row density: the ten-by-twelve standard and the dense-log exception

The standard row density for every panel/listing row is `10px 12px` — written as `padding: 10px var(--space-3);` (rows: `.reference-row`, `.claim-row`, `.whisper-entry`, `.helper-player`, `.toggle-row`, `.notice`, seats/setup rows). The **dense exception** is log-style micro-rows where vertical rhythm matters more than touch size: `.player-log-row` (6px 10px) in the player detail sheet and inline chip/flag rows (`.role-pill`, `.tally-chip`, `.seat-btn`). Buttons keep the 44px touch minimum regardless of row density (the `10px 12px` rows are raised to 44px min-height).

### Accent-bar exceptions for notices and log rows

"No left-border accents on panel rows" has two approved exceptions, both carrying semantic color:

- `.notice` rows (game.css): `border-left: 4px solid var(--accent)` with `.notice.ok` / `.notice.accent` / `.notice.bad` / `.notice.info` switching the bar color. These are announcement surfaces, not interactive rows.
- `.player-log-row` (sheets.css): `border-left` colored by `log-ok` / `log-bad` / `log-accent` per entry kind, plus the `.log-bold` emphasis row.

### Structural hook classes

The overlay panels expose a semantic class on top of the shared `.panel-overlay`/`.panel-backdrop` (z 30/31) so CSS and tests can address them without matching `.panel-overlay` broadly:

- `.claims-panel` — the Public Claims overlay (`js/ui/claims.js`)
- `.whispers-panel` (id `whispers-panel`) — the Info Tokens relay overlay (`js/ui/panels.js`)

Both render `role="dialog"` and close on X, backdrop tap, or Escape.

### The helper step counter

`styles/helper.css` defines `.helper-step-counter { align-self: center; }` for the night bar's `N / M` index span (`js/ui/helper.js`). The counter is a passive element: it never carries an inline `style=` attribute and never acts as a button.
