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
| `engine.ROLES` | `{ roleId: { id, name, team, category, blurb, nightAction, dayAction, oncePerGame, maxUses } }` | All 30 roles (14 Town, 9 Mafia, 7 Neutral) incl. Framer, Blackmailer, Forger. `team` is `TOWN`/`MAFIA`/`NEUTRAL`. |
| `engine.RATIO_TABLE` | `{ 6:{town:4,mafia:2,neutral:0}, 7:{town:5,mafia:2,neutral:0}, 8:{town:5,mafia:2,neutral:1}, 9:{town:6,mafia:2,neutral:1}, 10:{town:6,mafia:3,neutral:1}, 11:{town:7,mafia:3,neutral:1}, 12:{town:7,mafia:3,neutral:2}, 13:{town:8,mafia:3,neutral:2}, 14:{town:9,mafia:4,neutral:1}, 15:{town:9,mafia:4,neutral:2} }` | Exact GDD table. |
| `engine.PRESETS` | `{ 'p1'..'p6': { id, name, tagline, town:[...], mafia:[...], neutral:[...] } }` | Priority lists, top to bottom. Names: Whispers from the Morgue, The Poisoned Pint, The Gunpowder Plot, The Imposter at the Altar, The Widow's Vigil, The Clock Strikes Thirteen. |
| `engine.SEAT_LAYOUTS` | `['circle','two_rows','u_shape','rectangular']` | Layout choice for the seat grid. |
| `engine.NIGHT_STEPS` | array of `{ position, title, roles, prompt, timerSeconds? }` | Positions 0-14 exactly per GDD §5/§12.4 (Morning is the last step). Each role wakes in its own step: Escort and Consort separate (4), Janitor and Forger separate (7), Sheriff/Tracker/Lookout/Consigliere/Undertaker each separate (11), Retributionist and Amnesiac separate (12). Only Mafia (godfather+mafioso, position 6) and Medium/Ghosts (13) stay grouped. |

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
  trial: { active, accusedId, nominatorId, votes:[{voterId, verdict, ghostToken}], dayTrialsDone },
  night: { number, actions:[{position, roleId, playerId, targetId, extra}] },
  phase: 'SETUP'|'SEATS'|'NIGHT'|'MORNING'|'DAY'|'END',
  dayNumber, logs: [], winner: null, executionerTarget, gfBluffs, witchSide,
  jester: { haunted: false, hauntTarget: null },
  retributionist: { used: false },
  amnesiac: { used: false, rememberedRole: null }
}
```

## Engine API (all pure functions; state is passed in and mutated/returned)

| Function | Signature | Behavior |
|---|---|---|
| `createGame` | `(opts) -> state` | `opts = { playerCount, presetId, houseRules, town, mafia, neutral, teamCounts }` where `town/mafia/neutral` are optional **overrides** for the preset priority lists and `teamCounts = { town, mafia, neutral }` optionally overrides the ratio table (must sum to `playerCount`; throws otherwise). Town slots = named roles taken top-down from the list capped at `teamCounts.town - civilians`, then `civilians` (an optional `opts.civilians` count, default = leftover) fill the rest; long lists are truncated, short Mafia/Neutral lists are padded. Deck always equals `playerCount`. |
| `swapRoles` | `(state, aId, bId)` | Swaps `assignedRole` between two players. If the Executioner target was one of them and is no longer a living Town player, re-assign the target to another living Town player. Logs the swap. |
| `getDeckPreview` | `(state) -> { town:[], mafia:[], neutral:[] }` | Team-split deck for display. |
| `setPlayerNames` | `(state, [{ seat, name }])` | Names by seat. |
| `dealRoles` | `(state)` | Shuffles deck onto seats; sets `executionerTarget` (living Town player), `gfBluffs` (3 Town roles not in deck), `witchSide` default MAFIA. Logs. |
| `assignRoles` | `(state, seatToRole)` | Manually assigns roles per seat: `seatToRole` maps seat numbers to role ids. Throws if a seat is missing, a role id is unknown, a role is not in the deck, or the assigned multiset does not match the deck (only `civilian` repeats). On success: assigns `assignedRole`, resets transient state, assigns setup info (`executionerTarget`, `gfBluffs`, `witchSide`), sets phase `SEATS`, logs 'Roles assigned.'. |
| `redeal` | `(state)` | Re-shuffles roles onto seats. |
| `getNightSteps` | `(state) -> [step]` | Steps 0-14, filtered to living roles + current night rules (Night 1: jailor execute unavailable). Split templates yield one step per present role; the position-11 Sheriff step includes the inherited Deputy (roles `['deputy']` when only the Deputy holds the badge). |
| `mafiaKillActor` | `(state) -> player \| null` | The Mafia kill leader: the living Godfather if any, else the living Mafioso, else `null`. Block status is ignored (resolution decides who actually carries the kill). |
| `recordNightAction` | `(state, { position, roleId, playerId, targetId, extra })` | Records wizard input. `extra` carries e.g. jailorDecision, controlRedirect. Rejects self-targets (`targetId === playerId`) unless `roleId === 'doctor'` or a Mafia kill at position 6; returns `false` and records nothing otherwise. |
| `resolveNight` | `(state) -> { deaths, revived, inheritedSheriff, logs }` | Applies GDD §5 resolution order, §6 drunk, §7 deaths, Jester haunt, Witch redirects, Framer/Blackmailer effects, Retributionist revival, GF bluffs are setup-only. Respects `houseRules.noKillN1` for kills. |
| `getMorningAnnouncement` | `(state) -> { deaths:[{name,roleShown,cause}], revivals, inheritanceNote, forgedWills }` | `roleShown` is `'?? UNKNOWN ??'` unless classicReveal; cleaned corpses always unknown. `forgedWills` is `[{ targetId, targetName }]`, present only when the Forger acted the previous night. |
| `beginDay` | `(state)` | Phase MORNING→DAY, resets blackmailed flags for the day. |
| `startTrial` | `(state, accusedId, nominatorId)` | One trial per day; accused must be living. |
| `castVote` | `(state, { voterId, verdict, ghostToken })` | `verdict` GUILTY/INNOCENT/ABSTAIN; ghostToken spends a dead voter's token; Mayor vote counts 3. |
| `resolveTrial` | `(state) -> { lynchedId, jesterWin, executionerWin, victory }` | Lynch if GUILTY strictly exceeds all other votes. Applies Jester/Executioner rules, conversion, haunt scheduling, victory check. |
| `vigilanteShoot` | `(state, shooterId, targetId)` | Day kill; max 3 shots; guilt if Town target. Victory checked immediately. |
| `deputyShoot` | `(state, deputyId, targetId)` | Once per game; guilt if Town target. Victory checked. |
| `mayorReveal` | `(state, mayorId)` | Vote weight 3. |
| `checkVictory` | `(state) -> { winner, survivors, reason } \| null` | GDD §9, checked after lynch, after morning, after day kills. |
| `serialize` | `(state) -> jsonString` | For localStorage. |
| `deserialize` | `(jsonString) -> state` | With shape validation. |
| `endGame` | `(state)` | Full role reveal (GDD §11). |

## UI layer contract

`index.html` — mobile-first, single column, `<meta name="viewport" content="width=device-width, initial-scale=1">`, screens as `<section data-screen="...">`: `setup`, `seats`, `game`, `end`. No frameworks, no build step, no ES modules (browser blocks `import` on `file://`). The page is the **load-order manifest**: 6 stylesheet links (`styles/base.css` first, then setup/seats/game/end/reference) and one `<script>` per part file, in order: `js/engine/00-namespace.js` … `js/engine/10-victory.js` (with `js/engine/07b-night-resolution.js` between 07 and 08), then `js/ui/common.js` … `js/ui/reference.js`, then `js/app/config.js` … `js/app/actions.js`, then `js/app.js`. Every part attaches to a global namespace (`VillageEngine` / `UI` / `APP`); nothing uses ES modules. Convention: no part file exceeds ~350 lines.

Screens:
- **setup**: player count stepper 6-15, preset cards (tap to select), editable team lists (add/remove/reorder per team from role pool, live deck preview), **team structure steppers (Town/Mafia/Neutral counts, defaulted from the ratio table, total must equal player count)**, **Civilian count as a +/− stepper in the Town editor (never added to the list)**, house rule toggles, seat layout picker, Start button.
- **seats**: layout-rendered seat grid (circle/two rows/u-shape/rectangular), **name inputs pre-filled with "Player N" for seat N**, Deal/Redeal button, then the **dealt view rendered in the chosen seat layout** (each seat shows name + role, moderator-only, tap to hide/show, team color, status tags), a **Swap mode to exchange two players' roles**, and a game flow strip (Night → Morning → Day → End) plus a Begin Night 1 button.
- **game**: wizard step view (prompt, target picker, timers), morning announcement, day view (trial/voting UI, day abilities), persistent status.
- **end**: winner(s) + full role grid reveal.

Persistence: `app.js` auto-saves `serialize(state)` to localStorage on every mutation, key `villagepub-save`; auto-restores on load (with a Resume/New Game choice on the setup screen).

Design language: clean dark dashboard, CSS custom properties, team colors Town steel-blue / Mafia crimson / Neutral gold, status tags `[ALIVE][GHOST][DRUNK][INHERITED SHERIFF][JAILED][PROTECTED][POISONED][ALERT][REVEALED][CLEANED][BLACKMAILED]`, min 44px touch targets, system font stack.

## Tests

`tests/engine.test.js` runs under Node's built-in test runner (`node --test tests/`), requires `../js/engine.js`. Covers: ratio table 6-15, preset deck composition incl. overrides, night resolution order, Deputy inheritance, drunk inversions, jailor execute/spare + caps, Witch redirects, Framer/Blackmailer, mystery deaths vs classic reveal, victory scenarios incl. post-day-kill checks, Jester haunt, Executioner conversion.
