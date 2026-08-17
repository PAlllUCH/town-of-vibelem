# Town of VibeLem — Engine/UI Interface Contract

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
| `engine.ROLES` | `{ roleId: { id, name, team, category, blurb, nightAction, dayAction, oncePerGame, maxUses, startKnowing? } }` | All 35 roles (18 Town, 9 Mafia, 8 Neutral) incl. Framer, Blackmailer, Forger, Spy, Oracle, Washerwoman, Chef, Witness. `team` is `TOWN`/`MAFIA`/`NEUTRAL`. No role is Night-1-only: the Oracle is a nightly role and wakes every night; `startKnowing: true` marks roles whose information is computed at deal time (Washerwoman, Chef). |
| `engine.RATIO_TABLE` | `{ 6:{town:4,mafia:2,neutral:0}, 7:{town:5,mafia:2,neutral:0}, 8:{town:5,mafia:2,neutral:1}, 9:{town:6,mafia:2,neutral:1}, 10:{town:6,mafia:3,neutral:1}, 11:{town:7,mafia:3,neutral:1}, 12:{town:7,mafia:3,neutral:2}, 13:{town:8,mafia:3,neutral:2}, 14:{town:9,mafia:4,neutral:1}, 15:{town:9,mafia:4,neutral:2} }` | Exact GDD table. |
| `engine.PRESETS` | `{ 'p1'..'p6': { id, name, tagline, town:[...], mafia:[...], neutral:[...] } }` | Priority lists, top to bottom. Names: Whispers from the Morgue, The Poisoned Pint, The Gunpowder Plot, The Imposter at the Altar, The Widow's Vigil, The Clock Strikes Thirteen. |
| `engine.SEAT_LAYOUTS` | `['circle','u_shape']` | Layout choice for the seat grid. |
| `engine.NIGHT_STEPS` | array of `{ position, title, roles, prompt, timerSeconds? }` | Positions 0-14 exactly per GDD §5/§12.4 (Morning is the last step). Each role wakes in its own step: Escort and Consort separate (4), Janitor and Forger separate (7), Sheriff/Tracker/Lookout/Witness/Consigliere/Undertaker/Spy/Oracle each separate (11), Retributionist and Amnesiac separate (12). Only Mafia (godfather+mafioso, position 6) and Medium/Ghosts (13) stay grouped. The Oracle wakes every night in its own position-11 step; Washerwoman and Chef have no step in any night (`startKnowing`). |

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
  trial: { active, stage: null|'SECONDS'|'VOTE'|'SENTENCE', accusedId, nominatorId,
           seconds: [{ voterId, agree }], votes: [{ voterId, verdict, ghostToken }],
           sentenceVotes: [{ voterId, verdict }], dayTrialsDone },
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
| `getNightSteps` | `(state) -> [step]` | Steps 0-14, filtered to living roles + current night rules (Night 1: jailor execute unavailable). Split templates yield one step per present role; the position-11 Sheriff step includes the inherited Deputy (roles `['deputy']` when only the Deputy holds the badge). Witness, Oracle, and Spy each wake in their own position-11 step. |
| `mafiaKillActor` | `(state) -> player \| null` | The Mafia kill leader: the living Godfather if any, else the living Mafioso, else `null`. Block status is ignored (resolution decides who actually carries the kill). |
| `recordNightAction` | `(state, { position, roleId, playerId, targetId, extra })` | Records wizard input. `extra` carries e.g. jailorDecision, controlRedirect, and for the Witness the second pick as `secondTarget`. Rejects self-targets (`targetId === playerId`, and `extra.secondTarget === playerId` for the Witness) unless `roleId === 'doctor'` or a Mafia kill at position 6; returns `false` and records nothing otherwise. Appends a `'night-action'` playerLog entry when the action is new (re-records are deduped). |
| `resolveNight` | `(state) -> { deaths, revived, inheritedSheriff, logs }` | Applies GDD §5 resolution order, §6 drunk, §7 deaths, Jester haunt, Witch redirects, Framer/Blackmailer effects, Retributionist revival, GF bluffs are setup-only. Respects `houseRules.noKillN1` for kills. Writes `info` playerLog entries for every relayed information result (Sheriff, Tracker, Lookout, Witness, Consigliere, Undertaker, Witch, Spy, Oracle). |
| `getMorningAnnouncement` | `(state) -> { deaths:[{name,roleShown,cause}], revivals, inheritanceNote, forgedWills }` | `roleShown` is `'?? UNKNOWN ??'` unless classicReveal; cleaned corpses always unknown. `forgedWills` is `[{ targetId, targetName }]`, present only when the Forger acted the previous night. |
| `beginDay` | `(state)` | Phase MORNING→DAY, resets blackmailed flags for the day; closes any unresolved active trial (clears `active`, `stage`, `seconds`, `votes`, `sentenceVotes`) and resets `dayTrialsDone`. |
| `startTrial` | `(state, accusedId, nominatorId)` | Opens a trial in the **SECONDS** stage; multiple trials per day are allowed, but at most one lynch occurs per day (`dayTrialsDone` increments only on a lynch), accused must be living. The nominator does not auto-count: every living player except the accused, including the nominator, must second via `castVote` with AGREE/DISAGREE. Logs `'nominated'` entries for both players. |
| `castVote` | `(state, { voterId, verdict, ghostToken })` | **Stage-aware.** SECONDS stage: `verdict` AGREE/DISAGREE, accepted only from living non-accused players (ghosts may not second; the accused may not second). VOTE stage: `verdict` GUILTY/INNOCENT/ABSTAIN; the accused may not vote; `ghostToken` spends a dead voter's token; a revealed Mayor's vote counts 3. SENTENCE stage: `verdict` GUILTY/INNOCENT/ABSTAIN, accepted only from living non-accused players (ghosts may not vote in the sentence round); Abstain is recorded but ignored. Logs a `'verdict'` entry per voter. |
| `resolveTrial` | `(state) -> { result, lynchedId, guilty, innocent, jesterWin, executionerWin, victory, reason? }` | SECONDS stage: `result: 'ACCEPTED'` when agree >= floor(living / 2) + 1 (trial moves to VOTE), else `result: 'CANCELLED'` (trial closes, no death, day continues). VOTE stage: only GUILTY and INNOCENT votes count (ABSTAIN ignored; Mayor weight 3 still applies). `result: 'SENTENCED'` with `reason: 'guilty-majority'` when GUILTY > INNOCENT (trial moves to SENTENCE; no immediate lynch), else `result: 'SURVIVES'` with `reason: 'no-lynch-day-1'` (house rule on day 1), `'tie'` (guilty === innocent), or `'not-guilty'` (innocent > guilty); a surviving trial closes, nobody dies, the day continues. `guilty`/`innocent` are the weighted tallies. |
| `resolveSentence` | `(state) -> { result, lynchedId, guilty, innocent, jesterWin, executionerWin, victory, reason }` | SENTENCE stage only (else `null`). Counts GUILTY vs INNOCENT (ABSTAIN ignored; Mayor weight 3; no ghost votes). Returns `result: 'SURVIVES'` with `reason: 'accused-dead'` if the accused is no longer alive. Returns `result: 'SPARED'` with `reason: 'spared'` when Innocent (spare) votes reach a strict majority of living players (innocent >= floor(living / 2) + 1); the accused lives and the day continues. Otherwise returns `result: 'LYNCHED'` with `reason: 'guilty-stands'`: consumes the day's lynch, records the death, applies Jester win (haunt scheduling) / Executioner win / inheritance, and runs victory checks. |
| `killPlayer` | `(state, playerId, cause?) -> victory \| null` | Moderator override during the day: kills any living player by moderator fiat (`cause` defaults to `'killed by the moderator'`). No-op for unknown/dead players and in the END phase. Victory is checked immediately. |
| `undoKill` | `(state, playerId) -> { revivedId } \| null` | Moderator override: revives a dead player, removing their graveyard entry, deathLog entry, and `'death'` playerLog entry; resets `hasGhostVote` and `nightTarget`; closes an active trial whose accused was the revived player (refunding the day's lynch); cancels a pending Jester haunt; clears `winner` and returns `phase` to DAY. |
| `vigilanteShoot` | `(state, shooterId, targetId)` | Day kill; max 3 shots; guilt if Town target. Victory checked immediately. |
| `deputyShoot` | `(state, deputyId, targetId)` | Once per game; guilt if Town target. Victory checked. |
| `mayorReveal` | `(state, mayorId)` | Vote weight 3. |
| `checkVictory` | `(state) -> { winner, survivors, reason } \| null` | GDD §9, checked after lynch, after morning, after day kills. |
| `serialize` | `(state) -> jsonString` | For localStorage. |
| `deserialize` | `(jsonString) -> state` | With shape validation. |
| `endGame` | `(state)` | Full role reveal (GDD §11). |

## UI layer contract

`index.html` — mobile-first, single column, `<meta name="viewport" content="width=device-width, initial-scale=1">`, screens as `<section data-screen="...">`: `setup`, `seats`, `game`, `end`. No frameworks, no build step, no ES modules (browser blocks `import` on `file://`). The page is the **load-order manifest**: 8 stylesheet links (`styles/base.css` first, then setup/seats/sheets/game/clock/end/reference) and one `<script>` per part file, in order: `js/engine/00-namespace.js` … `js/engine/10-victory.js` (with `js/engine/06b-night-actions.js` between 06 and 07, `js/engine/07b-night-resolution.js` between 07 and 08, and `js/engine/09b-day-actions.js` between 09 and 10), then `js/ui/common.js`, `js/ui/panels.js`, `js/ui/claims.js`, then `js/ui/setup.js` … `js/ui/reference.js` (with `js/ui/day-trial.js` right after `js/ui/day.js`), then `js/app/config.js` … `js/app/actions.js` (with `js/app/actions-wizard.js`, `js/app/actions-day.js`, `js/app/actions-game.js`, and `js/app/actions-panels.js` in that order after `actions-seats.js`), then `js/app.js`. Every part attaches to a global namespace (`VillageEngine` / `UI` / `APP`); nothing uses ES modules. Convention: no part file exceeds ~350 lines.

Screens:
- **setup**: player count stepper 6-15, preset cards (tap to select), editable team lists (add/remove/reorder per team from role pool, live deck preview), **team structure steppers (Town/Mafia/Neutral counts, defaulted from the ratio table, total must equal player count)**, **Civilian count as a +/− stepper in the Town editor (never added to the list)**, house rule toggles, seat layout picker, Start button.
- **seats**: layout-rendered seat grid (circle/u-shape), **name inputs pre-filled with "Player N" for seat N**, Deal/Redeal button, then the **dealt view rendered in the chosen seat layout** (each seat shows name + role, moderator-only, tap to hide/show, team color, status tags), a **Swap mode to exchange two players' roles**, and a game flow strip (Night → Morning → Day → End) plus a Begin Night 1 button. The dealt view ends with a **Night Zero prep checklist** card: rows derived from state (`bluffs` when `state.gfBluffs` is set, `witch` when the deck has a Witch, `executioner` when `state.executionerTarget` is set, `relays` when the deck has any `startKnowing` role, `deal` always), each toggled via `data-action="nz-toggle"` with a `data-nz` row id, stored in `APP.app.nightZeroDone`, with a live `X/Y done` summary.
  - **Seat tap sheets**: the naming grid renders one tappable `.seat-btn` per seat (`data-action="open-naming-sheet"`, `data-seat`), each showing the player name plus a `.seat-btn-role` line with the pending/assigned role (team-colored) or a muted "–". Tapping opens a bottom sheet (name input + a "Currently: Role / No role yet" header line + role pill list + Save/Cancel plus a **Clear Role** button shown while a role is selected, data-actions `pick-role` / `clear-role` / `save-seat` / `close-sheet`). The role list shows every role in the deck, ordered by team (Town/Mafia/Neutral) then alphabetically with the current seat's role pinned first; roles already held by another seat render as disabled pills with a `TAKEN` tag, while the current seat's own role stays enabled and marked `.on` (`aria-selected="true"` only on it). Dealt tiles and the mid-game "Seats" overlay tiles (`data-action="open-detail-sheet"`, `data-seat`) open a player detail sheet showing name, team-color role card, `UI.statusTags` row, role blurb, and the player's **`state.playerLog`** entries rendered newest-first, each with a kind tag (`INFO`/`DEATH`/`NIGHT`/`DAY`/…) colored via `data-kind` and a `log-kind-tag` span. Sheets mount into a `#sheet-root` element appended to `<body>`, lock body scroll with `body.sheet-open`, and close on backdrop tap, Escape, X, or Cancel. After a `pick-role` re-render, focus stays on the role list instead of returning to the name input.
- **game**: wizard step view (prompt, target picker, timers), morning announcement, day view (trial/voting UI, day abilities, discussion timer with 60/120/180 presets plus -10s / +10s nudges while running), persistent status. The header (`renderGameHeader`) exposes **Seats / Log / Tokens / Claims / Mod** buttons and a `div.cycle-clock` phase clock with `data-phase` + `data-cycle` (styled by `styles/clock.css`) that replaces the old phase label and flow strip there (the flow strip survives on the seats dealt view). `toggle-tokens` opens an **Info Tokens** overlay listing every `kind === 'info'` `playerLog` entry (newest first, grouped by actor) so the moderator can relay each player's hidden information with a token before they wake, and `toggle-claims` opens a **Public Claims** grid (one row per living player, sorted by seat; tapping a row via `claim-open` opens a picker with every role in the game grouped by team plus `claim-pick`/`claim-clear`/`claim-close`). Claims live in `APP.app.claims` (keyed by seat) and are pure moderator records, never engine state; the seat overlay tiles (Seats button) show each player's public claim chip in the seat layout. Day and morning cards are collapsible: `UI.card(title, body, key, app)` renders a card-collapsible wrapper with a toggle button (`data-action="toggle-card"`, `data-card` key); the collapsed state lives in `APP.app.collapsed` and persists in the save payload (converted cards: timer, abilities, trial, morning, log). All three panels mount into a dynamic `#panel-root`, use `.panel-backdrop`/`.panel-overlay` (z 30/31, below the toast at 50), and close on X, backdrop tap, or Escape.
  - **Moderator panel**: `toggle-mod` opens a left-anchored full-height **Moderator** side drawer with **Kill Player** (`kill-player`), **Undo Last Kill** (`undo-kill`, disabled on an empty graveyard), and **Setup** (`goto-setup`, moved from the seats screen). The first two map to the engine `killPlayer` / `undoKill` moderator overrides.
  - **Info to Show cards**: the morning view renders a `whisper-results` card headed **Info to Show** listing every fresh `kind === 'info'` `playerLog` entry for the night that just resolved (`at === 'N' + (night.number - 1)`), each a `.notice.info` row with a **Token shown** button (`token-shown`, keyed by player and night) that marks the relay in `APP.app.relayedWhispers` (persisted) and swaps the row to a `RELAYED` tag; a Drunk Consigliere's row additionally shows a `[INVERTED]` tag. The night wizard shows the same card for the current night's position-11 / Witch steps when fresh results exist (normally a no-op, since results are written at `resolveNight`). The header Tokens button still opens the static panel for day use.
  - **Wizard polish**: the first wizard step always shows a disabled "Previous step" button; the final step shows a `wizard-summary` card ("Night Actions Summary") listing every recorded action (role → target + a kind tag such as protect/kill/alert); corpse pickers tag Janitor-cleaned corpses `[CLEANED]`; the Forger confirm step shows a disabled "Will forge: [name] · [role]" row; a Veteran on their last alert shows a `tag-bad` `LAST ALERT` chip; the Consigliere pick branch warns `[INVERTED]` when the Consigliere is Drunk; the Witness step is a two-pick flow (first pick → "Pick the second player" → "Witness: [A] and [B] → Both Mafia/Different alignments" + `wizard-witness-confirm`) that records `extra.secondTarget`.
- **end**: winner(s) + full role grid reveal.

Persistence: `app.js` auto-saves `serialize(state)` to localStorage on every mutation, key `villagepub-save`; auto-restores on load (with a Resume/New Game choice on the setup screen).

Design language: clean dark dashboard, CSS custom properties, team colors Town steel-blue / Mafia crimson / Neutral gold, status tags `[ALIVE][GHOST][DRUNK][INHERITED SHERIFF][JAILED][PROTECTED][POISONED][ALERT][REVEALED][CLEANED][BLACKMAILED]`, min 44px touch targets, system font stack.

## Tests

`tests/engine-core.test.js`, `tests/engine-night.test.js`, `tests/engine-trial.test.js`, `tests/engine-victory.test.js` run under Node's built-in test runner (explicit file list, requires `../js/engine.js` and `tests/helpers.js`); `tests/game-loop.test.js` and `tests/app-ui.test.js` drive the full app layer in Node with a stubbed DOM. Covers: ratio table 6-15, preset deck composition incl. overrides, night resolution order, Deputy inheritance, drunk inversions, jailor execute/spare + caps, Witch redirects, Framer/Blackmailer, mystery deaths vs classic reveal, victory scenarios incl. post-day-kill checks, Jester haunt, Executioner conversion.
