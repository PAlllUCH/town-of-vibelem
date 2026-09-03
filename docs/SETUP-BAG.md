# SETUP-BAG.md — Bag Composer + Manual Setup Flow

Source-of-truth supplement for the physical-token play style. Read this before
touching engine, UI, or app code for the setup-bag work. Reconcile against
`docs/interface.md` and `docs/GDD.md`; this file wins for anything it specifies.

## Goal

Support a table where roles are randomized **physically**: the moderator loads a
bag with one token per role, players draw blindly, and the moderator types each
drawn role into the app. The app does not generate the shuffle; it records it.

## Core insight: the bag IS `state.deck`

`js/engine/03-deck.js` builds `state.deck` as the exact multiset of role ids for
the chosen player count, preset, and overrides. `js/ui/seats.js`
`availableRoles` (line 40) already gates the seat role picker off `state.deck`,
so the picker only ever offers roles still "in the bag". Manual entry therefore
needs **no new gating logic** — it falls out of the existing deck.

Consequence: building the bag = building the deck. The composer UI just *shows*
`state.deck` as a printable checklist. Players draw, moderator assigns via the
existing picker, app enforces the bag automatically.

## Flow

1. Moderator picks player count + preset (or override) on the setup screen.
2. App builds `state.deck`. Bag Composer shows the full token list.
3. Moderator packs the physical bag to match, ticks "packed".
4. Players draw. Moderator opens each seat sheet and picks the drawn role.
   Picker offers only unassigned deck roles (civilian repeats allowed).
5. Moderator taps Lock Roles, then reviews the Confirm step, then Begin Day 1.
6. Each morning, app reminds which newly dead players get a ghost vote token.

## Engine changes

File: `js/engine/03-deck.js` (add helpers; keep part under ~350 lines, split to
`03b` only if needed and update `index.html` + `js/engine.js` barrel).

- `E.getBagContents(state)` — returns a printable view of `state.deck`:
  an array (or `{town, mafia, neutral, evil}`) of role ids, each with its team.
  Pure, DOM-free, deterministic. Reuses `E.ROLES[id].team`.
- `E.getNewGhosts(state)` — returns the list of players in
  `state.morning.deaths` who died this cycle and have not yet been marked as
  handed a token. `state.morning.deaths` already exists (`04-state.js:24`).
  Returns `[{ id, name, seat, role }]`. No new state field required for the
  engine side; the "handed" flag lives in app state (see below).

No change to `dealRoles` / `redeal` / `swapRoles`. The bag composer reads the
deck the existing build produced.

## UI changes

### Setup — Bag Composer
File: `js/ui/setup.js`.
- New card toggled by a "Bag" button (`data-action="toggle-bag"`).
- Body: one row per token from `E.getBagContents` — team dot + role name
  (PL/EN via `UI.roleName`), grouped by team. A "packed" checkbox per token or
  one global "Bag packed" toggle. Optional "Shuffle order" button (visual only,
  for the moderator to randomize the packing sequence — does not touch deck).
- Hint: "Put exactly these tokens in the bag, then have players draw."

### Setup — Manual entry hint
File: `js/ui/seats.js` (`renderSeatsNaming`).
- Add a one-line hint that roles are assigned from the bag draw; the picker
  already enforces the deck. No gating change.
- Keep "Auto-fill rest" and "Lock Roles" working for bag play.

### Setup — Confirm step
File: `js/ui/seats.js`.
- After "Lock Roles", render a Confirm card: each seat → role name + team dot
  (reuse the dealt-seat rendering style). Button "Confirm & Begin Day 1"
  (`data-action="confirm-setup"`). Do not call `beginDay` until confirmed.
- A "Back to edit" button returns to naming.

### Morning — Ghost token reminder
Files: `js/ui/day.js` (`morningView`) and `js/ui/helper.js` (`morningRecapCard`).
- Add a card "Ghost tokens to hand out" listing `E.getNewGhosts(state)` names,
  each with a "Handed" toggle (`data-action="toggle-ghost-token"
  data-player="<id>"`). Uses `UI.card` so it collapses like other cards.
- Empty when no new deaths (Day 1 morning, or a deathless night).

## App changes

File: `js/app/config.js` — add to `APP.app` defaults:
- `bagOpen: false`
- `bagPacked: false`
- `setupConfirmed: false`
- `ghostTokensGiven: {}` (map playerId -> true)

Files: `js/app/actions.js` (`toggle-bag`), `js/app/actions-seats.js`
(`confirm-setup`, reset `setupConfirmed` when re-editing),
`js/app/actions-day.js` (`toggle-ghost-token`).

Persistence: all four fields are plain JSON and serialize with the existing save
payload. `deserialize` must default them for old saves (see `04-state.js`
deserialize defaults pattern). `setupConfirmed` resets to false on any role
edit or redeal.

Gate: `beginDay` (or the Day-1 entry path) must require `setupConfirmed === true`.

## Strings

Add to `js/engine/01b-strings.js` (Polish + English):
- `bagLabel` / `bagTitle`
- `bagPackedBtn` / `bagPackedHint`
- `bagShuffleBtn`
- `confirmSetupTitle` / `confirmSetupBtn` / `confirmSetupBack`
- `ghostTokensTitle` / `ghostTokenHanded` / `ghostTokenHandBtn`
- `manualEntryHint`

## Tests

- `tests/engine-core.test.js` or `tests/engine-roles.test.js`:
  `getBagContents` returns the full deck multiset matching the ratio table;
  `getNewGhosts` returns exactly `state.morning.deaths` entries, empty on Day 1.
- `tests/app-ui.test.js`:
  - Bag card renders one row per deck role; "packed" toggle persists.
  - Seat picker rejects a role not present in `state.deck`.
  - Confirm screen lists every seat/role; Day 1 is blocked until confirmed.
  - Morning card lists newly dead; `toggle-ghost-token` marks handed + persists.
  - Legacy/corrupted save deserializes with the four new fields defaulted.

Use the `assignRoles(...)` helper from `tests/helpers.js` to inject exact decks.

## Orchestration

1. This doc (done).
2. Engine worker (`opencode-go/gpt-5.6-luna`): `getBagContents`,
   `getNewGhosts` + engine tests. Green `node --test`.
3. UI + app workers (setup composer/confirm `mimo-v2.5`; morning ghost card
   `mimo-v2.5`; app wiring `luna`) — independent screens, run in parallel.
4. Review pass, fix loop, `node --test tests/*.test.js` until green.

Worker prompt rules: shell-safe (no backticks, `()`, `&&`, `<`, `>`); long
detail stays in this doc, not the prompt.
