# Town of Vibelm — Engine/UI Interface Contract

Single source of truth for how `js/engine.js` (pure logic, no DOM) and the UI layer
(`index.html`, `js/app.js`, `js/ui.js`) talk to each other. The game rules live in
`docs/GDD.md`; this file only defines the API shape.

## Engine module contract

`js/engine.js` is **100% DOM-free**. It must run identically in the browser and Node:

```js
// browser
window.VillageEngine = engine;
// node
if (typeof module !== 'undefined') module.exports = engine;
```

No `document`, `window`, `localStorage`, `fetch`, or timers inside `engine.js`
except the export guard line above.

## Data (read-only constants)

| Symbol | Shape | Notes |
|---|---|---|
| `engine.ROLES` | `{ roleId: { id, name, team, category, blurb, nightAction, dayAction, oncePerGame, maxUses, n1Only?, startKnowing? } }` | All 35 roles (18 Town, 9 Mafia, 8 Neutral) incl. Framer, Blackmailer, Forger, Spy, Oracle, Washerwoman, Chef, Witness. `team` is `TOWN`/`MAFIA`/`NEUTRAL`. `n1Only: true` marks the role that wakes on Night 1 only (Oracle); `startKnowing: true` marks roles whose information is computed at deal time (Washerwoman, Chef). |
| `engine.RATIO_TABLE` | `{ 6:{town:4,mafia:2,neutral:0}, 7:{town:5,mafia:2,neutral:0}, 8:{town:5,mafia:2,neutral:1}, 9:{town:6,mafia:2,neutral:1}, 10:{town:6,mafia:3,neutral:1}, 11:{town:7,mafia:3,neutral:1}, 12:{town:7,mafia:3,neutral:2}, 13:{town:8,mafia:3,neutral:2}, 14:{town:9,mafia:4,neutral:1}, 15:{town:9,mafia:4,neutral:2} }` | Exact GDD table. |
| `engine.PRESETS` | `{ 'p1'..'p6': { id, name, tagline, town:[...], mafia:[...], neutral:[...] } }` | Priority lists, top to bottom. Names: Whispers from the Morgue, The Poisoned Pint, The Gunpowder Plot, The Imposter at the Altar, The Widow's Vigil, The Clock Strikes Thirteen. |
| `engine.SEAT_LAYOUTS` | `['circle','two_rows','u_shape','rectangular']` | Layout choice for the seat grid. |
| `engine.NIGHT_STEPS` | array of `{ position, title, roles, prompt, timerSeconds? }` | Positions 0-14 exactly per GDD §5/§12.4 (Morning is the last step). Each role wakes in its own step: Escort and Consort separate (4), Janitor and Forger separate (7), Sheriff/Tracker/Lookout/Witness/Consigliere/Undertaker/Spy/Oracle each separate (11), Retributionist and Amnesiac separate (12). Only Mafia (godfather+mafioso, position 6) and Medium/Ghosts (13) stay grouped. The Oracle step is generated on Night 1 only (`n1Only`); Washerwoman and Chef have no step in any night (`startKnowing`). |

## Game state (plain JSON, serializable)

```
state = {
  version, playerCount, presetId,
  houseRules: { noKillN1, noLynchD1, classicReveal },
  deck: [roleId],                      // built, not yet dealt
  players: [{ id, name, seat, assignedRole, inheritedRole, isAlive, isDrunk,
              hasGhostVote, ghostVoteSpent, nightTarget, jailorDecision,
              isRoleblocked, isProtected, framed, blackmailed, revealed(Mayor),
              shotsFired, executionsUsed, alertsUsed, usedOncePerGame, guiltPending }],
  graveyard: [{ playerId, name, trueRole, inspectedByUndertaker, wasCleaned, deathCause }],
  ghosts: { ledgerEnabled },
  playerLog: { '<playerId>': [{ at: 'N1'|'D2'|'SETUP'|'DAY', kind, text }] },
  trial: { active, stage: null|'SECONDS'|'VOTE', accusedId, nominatorId,
           seconds: [{ voterId, agree }], votes: [{ voterId, verdict, ghostToken }], dayTrialsDone },
  night: { number, actions:[{position, roleId, playerId, targetId, extra}] },
  phase: 'SETUP'|'SEATS'|'NIGHT'|'MORNING'|'DAY'|'END',
  dayNumber, logs: [], winner: null, executionerTarget, gfBluffs, witchSide,
  jester: { haunted: false, hauntTarget: null },
  retributionist: { used: false },
  amnesiac: { used: false, rememberedRole: null }
}
```

### state.playerLog

Per-player detail log for the moderator's sheet: `state.playerLog[String(playerId)]` is an array of `{ at, kind, text }` entries. `at` is `'SETUP'`, `'N<number>'`, `'D<number>'`, or `'DAY'`. Kinds:

| kind | written when |
|---|---|
| `set` / `swap` | role assigned (`assignRoles`) / roles swapped (`swapRoles`) |
| `night-action` | an action recorded via `recordNightAction` (deduped on re-record) |
| `death` / `lynched` / `shot` / `revealed` | died (cause wording like deathLog) / lynched / shot by Vigilante or Deputy / Mayor revealed |
| `poisoned` / `jailed` / `blackmailed` / `silenced` | status change at night / silencing applied at `beginDay` |
| `protected` / `haunted` / `revive` | survived via Doctor protection / haunted by the Jester / revived |
| `remembered` / `converted` / `inherited` / `promoted` | Amnesiac remembered / Executioner converted / Deputy inherited / Mafioso promoted |
| `info` | an information result relayed to the actor at night resolution: Sheriff checks, Tracker follows, Lookout watches, Witness comparisons, Consigliere inspections, Undertaker corpse inspections, Witch-learned roles, Spy watchers, and Oracle reads (voided wording when roleblocked or corrupted by drunkenness). The Washerwoman's and Chef's start-knowing claims are also `info` entries, written at `'SETUP'` on their own player ids during the prep phase. |
| `nominated` / `verdict` / `acquitted` | trial opened / vote or second cast / trial ended without a lynch |

## Engine API (all pure functions; state is passed in and mutated/returned)

| Function | Signature | Behavior |
|---|---|---|
| `createGame` | `(opts) -> state` | `opts = { playerCount, presetId, houseRules, town, mafia, neutral, teamCounts }` where `town/mafia/neutral` are optional **overrides** for the preset priority lists and `teamCounts = { town, mafia, neutral }` optionally overrides the ratio table (must sum to `playerCount`; throws otherwise). Town slots = named roles taken top-down from the list capped at `teamCounts.town - civilians`, then `civilians` (an optional `opts.civilians` count, default = leftover) fill the rest; long lists are truncated, short Mafia/Neutral lists are padded. Deck always equals `playerCount`. |
| `swapRoles` | `(state, aId, bId)` | Swaps `assignedRole` between two players. If the Executioner target was one of them and is no longer a living Town player, re-assign the target to another living Town player. Logs the swap. |
| `getDeckPreview` | `(state) -> { town:[], mafia:[], neutral:[] }` | Team-split deck for display. |
| `setPlayerNames` | `(state, [{ seat, name }])` | Names by seat. |
| `dealRoles` | `(state)` | Shuffles deck onto seats; sets `executionerTarget` (living Town player), `gfBluffs` (3 Town roles not in deck), `witchSide` default MAFIA. Computes the Washerwoman and Chef start-knowing claims (written to `state.playerLog` as `info` entries at `'SETUP'`). Logs. |
| `assignRoles` | `(state, seatToRole)` | Manually assigns roles per seat: `seatToRole` maps seat numbers to role ids. Throws if a seat is missing, a role id is unknown, a role is not in the deck, or the assigned multiset does not match the deck (only `civilian` repeats). On success: assigns `assignedRole`, resets transient state, assigns setup info (`executionerTarget`, `gfBluffs`, `witchSide`), computes the Washerwoman/Chef start-knowing claims, sets phase `SEATS`, logs 'Roles assigned.'. |
| `redeal` | `(state)` | Re-shuffles roles onto seats; recomputes the Washerwoman/Chef start-knowing claims (they are a snapshot of the deal and are only recomputed on `dealRoles`/`redeal`, never on `swapRoles`). |
| `getNightSteps` | `(state) -> [step]` | Steps 0-14, filtered to living roles + current night rules (Night 1: jailor execute unavailable; `n1Only` roles appear only on Night 1). Split templates yield one step per present role; the position-11 Sheriff step includes the inherited Deputy (roles `['deputy']` when only the Deputy holds the badge). Witness, Oracle, and Spy each wake in their own position-11 step. |
| `mafiaKillActor` | `(state) -> player \| null` | The Mafia kill leader: the living Godfather if any, else the living Mafioso, else `null`. Block status is ignored (resolution decides who actually carries the kill). |
| `recordNightAction` | `(state, { position, roleId, playerId, targetId, extra })` | Records wizard input. `extra` carries e.g. jailorDecision, controlRedirect, and for the Witness the second pick as `secondTarget`. Rejects self-targets (`targetId === playerId`, and `extra.secondTarget === playerId` for the Witness) unless `roleId === 'doctor'` or a Mafia kill at position 6; returns `false` and records nothing otherwise. Appends a `'night-action'` playerLog entry when the action is new (re-records are deduped). |
| `resolveNight` | `(state) -> { deaths, revived, inheritedSheriff, logs }` | Applies GDD §5 resolution order, §6 drunk, §7 deaths, Jester haunt, Witch redirects, Framer/Blackmailer effects, Retributionist revival, GF bluffs are setup-only. Respects `houseRules.noKillN1` for kills. Writes `info` playerLog entries for every relayed information result (Sheriff, Tracker, Lookout, Witness, Consigliere, Undertaker, Witch, Spy, Oracle). |
| `getMorningAnnouncement` | `(state) -> { deaths:[{name,roleShown,cause}], revivals, inheritanceNote, forgedWills }` | `roleShown` is `'?? UNKNOWN ??'` unless classicReveal; cleaned corpses always unknown. `forgedWills` is `[{ targetId, targetName }]`, present only when the Forger acted the previous night. |
| `beginDay` | `(state)` | Phase MORNING→DAY, resets blackmailed flags for the day. |
| `startTrial` | `(state, accusedId, nominatorId)` | Opens a trial in the **SECONDS** stage; one trial per day (gated by `dayTrialsDone`), accused must be living. The nominator auto-counts as agreeing; every other living player except the accused may second via `castVote` with AGREE/DISAGREE. Logs `'nominated'` entries for both players. |
| `castVote` | `(state, { voterId, verdict, ghostToken })` | **Stage-aware.** SECONDS stage: `verdict` AGREE/DISAGREE, accepted only from living non-accused players (ghosts may not second). VOTE stage: `verdict` GUILTY/INNOCENT/ABSTAIN; `ghostToken` spends a dead voter's token; a revealed Mayor's vote counts 3. Logs a `'verdict'` entry per voter. |
| `resolveTrial` | `(state) -> { result, lynchedId, guilty, others, jesterWin, executionerWin, victory }` | SECONDS stage: `result: 'ACCEPTED'` when agree >= floor(living / 2) + 1 (nominator auto-counted; trial moves to VOTE), else `result: 'CANCELLED'` (trial closes, no death, day continues). VOTE stage: `result: 'LYNCHED'` when GUILTY strictly outnumbers all other votes (applies Jester/Executioner rules, conversion, haunt scheduling, victory check), else `result: 'SURVIVES'` on ties or `noLynchD1` (no lynch, no victory check). `guilty`/`others` are the weighted tally (Mayor weight 3). |
| `vigilanteShoot` | `(state, shooterId, targetId)` | Day kill; max 3 shots; guilt if Town target. Victory checked immediately. |
| `deputyShoot` | `(state, deputyId, targetId)` | Once per game; guilt if Town target. Victory checked. |
| `mayorReveal` | `(state, mayorId)` | Vote weight 3. |
| `checkVictory` | `(state) -> { winner, survivors, reason } \| null` | GDD §9, checked after lynch, after morning, after day kills. |
| `serialize` | `(state) -> jsonString` | For localStorage. |
| `deserialize` | `(jsonString) -> state` | With shape validation. |
| `endGame` | `(state)` | Full role reveal (GDD §11). |

## UI layer contract

`index.html` — mobile-first, single column, `<meta name="viewport" content="width=device-width, initial-scale=1">`, screens as `<section data-screen="...">`: `setup`, `seats`, `game`, `end`. No frameworks, no build step, no ES modules (browser blocks `import` on `file://`). The page is the **load-order manifest**: 6 stylesheet links (`styles/base.css` first, then setup/seats/game/end/reference) and one `<script>` per part file, in order: `js/engine/00-namespace.js` … `js/engine/10-victory.js` (with `js/engine/06b-night-actions.js` between 06 and 07 and `js/engine/07b-night-resolution.js` between 07 and 08), then `js/ui/common.js` … `js/ui/reference.js`, then `js/app/config.js` … `js/app/actions.js` (with `js/app/actions-panels.js` after `actions-game.js`), then `js/app.js`. Every part attaches to a global namespace (`VillageEngine` / `UI` / `APP`); nothing uses ES modules. Convention: no part file exceeds ~350 lines.

Screens:
- **setup**: player count stepper 6-15, preset cards (tap to select), editable team lists (add/remove/reorder per team from role pool, live deck preview), **team structure steppers (Town/Mafia/Neutral counts, defaulted from the ratio table, total must equal player count)**, **Civilian count as a +/− stepper in the Town editor (never added to the list)**, house rule toggles, seat layout picker, Start button.
- **seats**: layout-rendered seat grid (circle/two rows/u-shape/rectangular), **name inputs pre-filled with "Player N" for seat N**, Deal/Redeal button, then the **dealt view rendered in the chosen seat layout** (each seat shows name + role, moderator-only, tap to hide/show, team color, status tags), a **Swap mode to exchange two players' roles**, and a game flow strip (Night → Morning → Day → End) plus a Begin Night 1 button. The dealt view ends with a **Night Zero prep checklist** card: rows derived from state (`bluffs` when `state.gfBluffs` is set, `witch` when the deck has a Witch, `executioner` when `state.executionerTarget` is set, `relays` when the deck has any `n1Only` or `startKnowing` role, `n1` when it has any `n1Only` role, `deal` always), each toggled via `data-action="nz-toggle"` with a `data-nz` row id, stored in `APP.app.nightZeroDone`, with a live `X/Y done` summary.
  - **Seat tap sheets**: the naming grid renders one tappable `.seat-btn` per seat (`data-action="open-naming-sheet"`, `data-seat`), each showing the player name plus a `.seat-btn-role` line with the pending/assigned role (team-colored) or a muted "–". Tapping opens a bottom sheet (name input + a "Currently: Role / No role yet" header line + role pill list + Save/Cancel, data-actions `pick-role` / `save-seat` / `close-sheet`). The role list shows every role in the deck, ordered by team (Town/Mafia/Neutral) then alphabetically with the current seat's role pinned first; roles already held by another seat render as disabled pills with a `TAKEN` tag, while the current seat's own role stays enabled and marked `.on` (`aria-selected="true"` only on it). Dealt tiles and the mid-game "Seats" overlay tiles (`data-action="open-detail-sheet"`, `data-seat`) open a player detail sheet showing name, team-color role card, `UI.statusTags` row, role blurb, and the player's **`state.playerLog`** entries rendered newest-first, each with a kind tag (`INFO`/`DEATH`/`NIGHT`/`DAY`/…) colored via `data-kind` and a `log-kind-tag` span. Sheets mount into a `#sheet-root` element appended to `<body>`, lock body scroll with `body.sheet-open`, and close on backdrop tap, Escape, X, or Cancel. After a `pick-role` re-render, focus stays on the role list instead of returning to the name input.
- **game**: wizard step view (prompt, target picker, timers), morning announcement, day view (trial/voting UI, day abilities), persistent status. The header (`renderGameHeader`) exposes **Seats / Log / Whispers / Claims** buttons; `toggle-whispers` opens a "Tonight's Whispers" overlay listing every `kind === 'info'` `playerLog` entry (newest first, grouped by actor) so the moderator can relay it, and `toggle-claims` opens a **Public Claims** grid (one row per living player, sorted by seat; tapping a row via `claim-open` opens a picker with every role in the game grouped by team plus `claim-pick`/`claim-clear`/`claim-close`). Claims live in `APP.app.claims` (keyed by seat) and are pure moderator records, never engine state. Both overlays mount into a dynamic `#panel-root`, use `.panel-backdrop`/`.panel-overlay` (z 30/31, below the toast at 50), and close on X, backdrop tap, or Escape.
  - **Guided claim round** (Day 1 only): after `Begin Day 1` the day view opens with a `claim-round-card` (driven by `APP.app.claimRound = { active, idx, picker }`, persisted in the save payload) that walks every living player in seat order. Each row shows seat number, name, and the moderator-only role; `claim-round-open` swaps in the same team-grouped role picker (`claim-round-pick` records the claim into `APP.app.claims` and advances), `claim-round-cancel` backs out, and once `idx` passes the last player the card lists all living players' claims with a "Tap a claim to edit" hint (`claim-round-edit` re-opens the picker for a seat, `claim-round-done` closes the round). The claim picker is rendered by `UI.claimRoleButtons` (shared with the static Claims panel). On Day 2+ the header Claims button opens only the static grid.
  - **Whisper result cards**: the morning view renders a `whisper-results` card listing every fresh `kind === 'info'` `playerLog` entry for the night that just resolved (`at === 'N' + (night.number - 1)`), each a `.notice.info` row with a "🔊 Whisper done" button (`whisper-done`, keyed by player and night) that marks the relay in `APP.app.relayedWhispers` (persisted) and swaps the row to a `RELAYED` tag; a Drunk Consigliere's row additionally shows a `[INVERTED]` tag. The night wizard shows the same card for the current night's position-11 / Witch steps when fresh results exist (normally a no-op, since results are written at `resolveNight`). The header Whispers button still opens the static panel for day use.
  - **Wizard polish**: the first wizard step always shows a disabled "Previous step" button; the final step shows a `wizard-summary` card ("Night Actions Summary") listing every recorded action (role → target + a kind tag such as protect/kill/alert); corpse pickers tag Janitor-cleaned corpses `[CLEANED]`; the Forger confirm step shows a disabled "Will forge: [name] · [role]" row; a Veteran on their last alert shows a `tag-bad` `LAST ALERT` chip; the Consigliere pick branch warns `[INVERTED]` when the Consigliere is Drunk; the Witness step is a two-pick flow (first pick → "Pick the second player" → "Witness: [A] and [B] → Both Mafia/Different alignments" + `wizard-witness-confirm`) that records `extra.secondTarget`.
- **end**: winner(s) + full role grid reveal.

Persistence: `app.js` auto-saves `serialize(state)` to localStorage on every mutation, key `villagepub-save`; auto-restores on load (with a Resume/New Game choice on the setup screen).

Design language: clean dark dashboard, CSS custom properties, team colors Town steel-blue / Mafia crimson / Neutral gold, status tags `[ALIVE][GHOST][DRUNK][INHERITED SHERIFF][JAILED][PROTECTED][POISONED][ALERT][REVEALED][CLEANED][BLACKMAILED]`, min 44px touch targets, system font stack.

## Tests

`tests/engine.test.js` runs under Node's built-in test runner (`node --test tests/`), requires `../js/engine.js`. Covers: ratio table 6-15, preset deck composition incl. overrides, night resolution order, Deputy inheritance, drunk inversions, jailor execute/spare + caps, Witch redirects, Framer/Blackmailer, mystery deaths vs classic reveal, victory scenarios incl. post-day-kill checks, Jester haunt, Executioner conversion.
