# AGENTS.md — Town of VibeLem

Town of VibeLem is a **moderator assistant web app** for a hybrid Town of Salem + Blood on the Clocktower social deduction game, played in person by a group of friends. One human moderator runs the game from a **phone** (mobile-first, portrait); players never touch the app — they sit at a table, close their eyes at night, and respond to the moderator with gestures.

## Source of truth

| File | Role |
|---|---|
| `docs/ROLES_REVISITED.md` | **Authoritative role catalog.** 43 unique roles (Polish + English names, category, ability). The Engine/UI must use these role IDs and names. If code disagrees with ROLES_REVISITED, code is wrong. |
| `docs/REVISION_1.md` | **Authoritative mechanic spec.** Night order 0–14 with the new role slots (Innkeeper at pos 4, Imp + Demon at pos 9, Succubus at pos 11, Necromant at pos 12), Edge Cases (D Innkeeper, E tie-breakers, G Executioner target rule). The mechanical systems (night resolution, victory, ghost rules, house rules) live in `docs/GDD.md`; REVISION_1 is the per-role mechanic brief that complements it. |
| `docs/GDD.md` | Mechanical systems: attack/defense model, drunk engine, ghost rules, victory conditions, house rules, moderator flow. **No role descriptions live here** — for any role definition, defer to `ROLES_REVISITED.md`. Section 5 mirrors REVISION_1's night order; Section 9 has the alignment buckets and tie-breakers. |
| `docs/interface.md` | Engine↔UI API contract. Exact function signatures, state shape, screen structure. |
| `docs/IMPROVEMENTS-STATUS.md` | Session handoff: everything implemented vs everything left to do. Read this first when starting a new work session. |
| `docs/gameplay-improvements.md` | Balance/feature proposals with GDD-ready rule text (P0/P1/P2 priorities). |
| `docs/audit-unimplemented.md` | File:line evidence for improvements written down but never executed. |

**Rule of thumb**: when adding or changing a role, edit `docs/ROLES_REVISITED.md` first (canonical definition), then `docs/REVISION_1.md` if the change touches night order or mechanics, then `docs/GDD.md` if Section 5/9 need to mirror it, then code, then tests.

## Architecture

Zero-dependency vanilla HTML/CSS/JS. No build step, no package.json, **no ES modules** (browsers block `import` on `file://` — the app must keep working by double-clicking `index.html`). Split into small part files that attach to globals; `index.html` is the load-order manifest.

```
index.html              # App shell + MANIFEST: 8 css links, one <script> per part (order matters)
styles/base.css         # CSS custom properties, typography, buttons, tags, bottom bar
styles/setup.css seats.css sheets.css game.css clock.css end.css reference.css   # per-screen styles (mechanical split, no build)
js/engine/00-namespace.js … 10-victory.js   # PURE LOGIC, DOM-free, 13 small parts (06 splits into 06+06b, 07 into 07+07b, 09 into 09+09b)
js/engine.js            # Node-only barrel: requires parts 00-10, exports VillageEngine (browser no-op)
js/ui/common.js panels.js claims.js setup.js seats.js wizard.js day.js day-trial.js end.js reference.js   # renderers → window.UI
js/app/config.js persistence.js router.js actions(-setup|-seats|-wizard|-day|-game|-panels|-reference).js actions.js actions-sheets.js   # wiring → window.APP
js/app.js               # 7-line bootstrap (APP.init)
tests/helpers.js        # shared test helpers: assignRoles + DOM stub + full-app driver
tests/engine-core.test.js engine-night.test.js engine-roles.test.js engine-trial.test.js engine-victory.test.js  # node:test suites, require ./helpers.js + ../js/engine.js
tests/game-loop.test.js  # node:test suite, drives the full app layer in Node with a stubbed DOM
tests/app-ui.test.js     # node:test suite, UI-layer tests (same stubbed-DOM driver)
```

**Global namespace pattern:** every part file is an IIFE that attaches to a root global — `root = window` in the browser, `globalThis` in Node. Engine parts attach to `root.VillageEngine`, UI parts to `root.UI`, app parts to `root.APP`. Shared internal helpers live as underscored members (`E._hasBasicDefense`, `E._recordDeath`). No code comments by convention.

**Hard rules:**
- Engine parts stay **DOM-free** — no `document`, `window`, `localStorage`, timers except the namespace guard. Must run identically in Node and browser.
- **Never add a script tag in the wrong order.** `index.html` is the manifest: engine 00-10, then ui common→end, then app config→actions, then app.js. The Node barrel (`js/engine.js`) must require engine parts in the same order.
- **No part file over ~350 lines.** If one grows past it, split it and update BOTH `index.html` and the barrel.
- The `E.<fn>` alias is UI convention (`var E = window.VillageEngine || {}`); app code uses it too. Don't rename to `engine` inside ui/app files.

## Commands

```bash
# Run tests (works on Windows Node 26):
cd <project-root>
node --test --test-reporter=dot tests/helpers.js tests/engine-core.test.js tests/engine-night.test.js tests/engine-roles.test.js tests/engine-trial.test.js tests/engine-victory.test.js tests/game-loop.test.js tests/app-ui.test.js
# or plain:  node --test tests/helpers.js tests/engine-core.test.js tests/engine-night.test.js tests/engine-roles.test.js tests/engine-trial.test.js tests/engine-victory.test.js tests/game-loop.test.js tests/app-ui.test.js

# Run the app (phone testing on same Wi-Fi):
python -m http.server 8000    # then open http://<your-ip>:8000 on the phone
# or just double-click index.html (works, but localStorage is per-origin)

# Simulation tools (dev only, not part of the app):
node scripts/simulate.js                       # 30 random-play games: crash/invariant checks
node scripts/agentic.js                        # one game with heuristic-AI players + transcript
node scripts/run-sim-archetypes.js p1 11 50    # 50 games with archetype AI
```

**Gotcha:** `node --test tests/` (directory form) fails on Windows Node 26 with "Cannot find module". Always target the file explicitly. `--test-reporter=dot` keeps output small.

**Gotcha:** this shell environment has no `sed`, `tail`, `wc`, `head`, or `grep` binaries. Use the built-in grep/glob/view tools instead of shell equivalents.

## Conventions

- **Engine API** is exactly what `docs/interface.md` documents — 24 functions (`createGame`, `getDeckPreview`, `setPlayerNames`, `dealRoles`, `redeal`, `swapRoles`, `getNightSteps`, `recordNightAction`, `resolveNight`, `getMorningAnnouncement`, `beginDay`, `startTrial`, `castVote`, `resolveTrial`, `resolveSentence`, `killPlayer`, `undoKill`, `vigilanteShoot`, `deputyShoot`, `mayorReveal`, `checkVictory`, `serialize`, `deserialize`, `endGame`) plus `E.assignRoles` and `E.mafiaKillActor`. UI calls them via `E.<fn>`. `recordNightAction` rejects self-targets except Doctor and the Mafia kill.
- **Night steps are 0-14** (`engine.NIGHT_STEPS`): 0 Veteran alert (+ Jester haunt), 1 Poisoner, 2 Witch, 3 Jailor, 4 Escort/Consort/Innkeeper (separate steps), 5 Doctor, 6 Mafia (grouped), 7 Janitor/Forger (separate steps), 8 Blackmailer, 9 Demon/Serial Killer/Imp (separate steps; Imp is dormant while the Demon lives), 10 Framer, 11 Sheriff/Tracker/Lookout/Witness/Consigliere/Undertaker/Spy/Oracle/Succubus (separate steps), 12 Necromant/Retributionist/Amnesiac (separate steps), 13 Medium/Ghosts (grouped), 14 Morning. Morning is the last step. Only Mafia and ghosts are ever woken as a group — every other role wakes in its own step so woken players never learn each other's identities. No will window: players keep wills on paper cards, the app never stores or shows them.
- **State fields** beyond the interface doc exist: `morning`, `executionerConverted`, `pendingInheritanceNote`, `lastJailTarget`, `lastBlackmailTarget`, `jester`, `retributionist`, `amnesiac`, `playerLog`. Trial state uses `state.trial.stage` (`null|'SECONDS'|'VOTE'|'SENTENCE'`), `state.trial.seconds`, `state.trial.sentenceVotes`, and `state.trial.dayTrialsDone`. `deserialize` must default them for old saves.
- **All user-derived strings** (names, wills) must pass through `esc()` (ui.js) before `innerHTML`; prefer `textContent`. Never inject raw.
- **Touch targets ≥ 44px** (`.btn-sm` was 40px once; don't regress). No hover-only interactions. Seat positions in the circle layout are clamped 12-88%.
- **Status tags** the seat grid can render: `[ALIVE][GHOST][DRUNK][INHERITED SHERIFF][JAILED][PROTECTED][POISONED][ALERT][REVEALED][CLEANED][BLACKMAILED][ENCHANTED][NECRO_USED][SUCCUBUS_TARGET]`. The jailed/poisoned/alerted/cleaned/enchanted flags are per-player and set during a night, so they only appear while fresh.
- **Localization**: the app shows role names in Polish and English simultaneously (PL above EN in PL locale, EN above PL in EN locale). Locale state lives at `app.locale` (`'pl'` default, `'en'` fallback) and is persisted in `localStorage['tov.locale']`. Use `E.roleName(id, locale)` and `E.roleBlurb(id, locale)` instead of `E.ROLES[id].name` directly. New role defs must include `namePl`.

## Game rules cheat-sheet (the non-obvious ones)

- **Deck building:** ratio table (6→4/2/0 … 15→9/4/2 Town/Mafia/Neutral). Preset priority lists fill slots top-down; **only Civilians may repeat** (Civilian overflow fills Town). Mafia/Neutral overrides shorter than the ratio are padded deterministically (regression: short overrides used to crash `dealRoles`).
- **Night resolution:** attacks are Basic (Mafia/SK, blocked by Doctor protection once + Basic defense) or Unstoppable (Jailor execute, Veteran alert, Jester haunt). Deaths resolve immediately at their position — a player who dies at position 6 is dead for positions 7-13. Roleblock only cancels the target's own action, never saves them from a kill.
- **Drunk:** Poisoner makes a target Drunk for one cycle; The Drunk role is permanently disabled. Drunk effects: Sheriff/Consigliere results invert, Janitor clean fails, Doctor protection fails. Everything else acts normally.
- **Mystery deaths:** morning shows will + "?? UNKNOWN ??". Janitor cleaning permanently blocks the Undertaker's inspection. `classicReveal` house rule shows true roles instead.
- **Deputy inheritance:** on Sheriff death, an alive Deputy permanently gets the Sheriff check (woken in the Sheriff step, position 11). Announced publicly.
- **Roles (43 unique):** 19 Town + 9 Mafia + 8 Neutral + 7 Evil (SK, Demon, Imp, Succubus, Necromant, Possessed, plus the Witch which keeps `team: 'NEUTRAL'` for now). New since the last revision: **Innkeeper** (Town Protective, pos 4), **Leper** (Neutral Benign), **Outcast** (Neutral Benign, reads Evil to checks), **Succubus** (Evil Support, enchants → vote restriction), **Necromant** (Evil Support, uses any dead role once), **Demon** (Evil Killing, primary night killer, reads INNOCENT), **Imp** (Evil Support, becomes Demon on Demon death), **Possessed** (Evil Support, no ability, reads Evil). The Outcast is the inverse: reads Evil but wins by surviving (Neutral Benign). The Possessed is the inverse: aligned Evil but has no ability (Townsfolk disguise). All 8 new roles are reachable via override or via presets that include them; presets keep Innkeeper-only insertion (Escort slot) for now.
- **Tie-breakers (1v1):** Serial Killer and Demon each hold their own majority and win their 1v1; Mafia wins its 1v1 vs Town (ties favor Mafia per §9.3); Evil role wins 1v1 vs Town-aligned. See GDD §5.5 E for full rules.
- **Trials (BotC-style, three stages):** a living player nominates an accused; every living player except the accused, including the nominator, must second (AGREE/DISAGREE). The nomination is accepted only with a STRICT majority of living players (>= floor(living/2)+1). Verdict vote: only GUILTY vs INNOCENT counts (ABSTAIN recorded but ignored; Mayor weight 3; ghost tokens vote only in the verdict stage, never to second; the accused may not vote). A guilty majority does not lynch immediately: the accused gives a last speech, then a SENTENCE round follows in which every living player except the accused votes again (no ghosts); INNOCENT (spare) votes reaching a strict majority of living players (>= floor(living/2)+1) spare the accused, otherwise they are lynched. At most ONE lynch per day (surviving/cancelled trials don't consume it). The moderator has a Kill Player / Undo Last Kill override in the top-menu Mod panel. Trials are allowed from Day 1. Day 1 comes FIRST: the flow is seats (prep) → Begin Day 1 → Night 1 → Morning → Day 2 … (`night.number` starts at 1 and the header labels NIGHT by it, not by dayNumber+1).
- **Seat sheets:** the naming screen is a tap-to-edit grid of `.seat-btn`s opening a bottom sheet (name + role picker with a Clear Role button, civilian offered only while deck capacity remains). The dealt view and the mid-game Seats overlay open a player-detail sheet showing role, status tags, blurb, and the per-player `state.playerLog` action history (newest first).
- **Day UI:** the game header shows a `div.cycle-clock` phase clock (`data-phase`/`data-cycle`, styled by `styles/clock.css`) plus Tokens / Claims / Seats / Log / Mod buttons; the Mod panel (kill-player / undo-kill, undo disabled on an empty graveyard) holds the moderator overrides, and claims are recorded only in the top-menu Claims panel (chips shown on the seat-overlay tiles). Day/morning cards are collapsible via `UI.card` (`data-action="toggle-card"`); collapsed state lives in `APP.app.collapsed` and persists in the save payload. The discussion timer has 60/120/180 presets plus −10s/+10s nudges.
- **Witch (ToS canon, no bans):** controls anyone except a currently-jailed player; learns the controlled player's exact role; controlling GF/SK redirects their kill; controlling Jailor redirects only the jail target (EXECUTE/SPARE stays with the Jailor). `witchSide` (MAFIA default, TOWN optional) is editable pre-game via the seats screen.
- **Caps:** Jailor executions unlimited (none N1), Vigilante 3 shots, Veteran 3 alerts. GF gets 3 Town bluff roles *not in the deck* at setup (whispered by moderator).
- **Victory checks** run after a lynch, after morning announcements, AND immediately after any day kill. Priority: individual (Jester, Executioner) → SK → Mafia → Town. Town requires the SK dead.
- **Jester:** wins when lynched → taunting ghost (speaks to the living, no ghost vote token); game continues; haunt one Guilty voter to death (Unstoppable) at the start of the next night if the game continued. **Executioner** converts to Jester when the target dies by any non-lynch means.
- **Days run before nights:** after roles are dealt the seats screen is the prep phase, then Day 1 (discussion/trials) starts, then Night 1 (noKillN1 + Jailor no-execute still apply), then Morning → Day 2.

## Testing approach

`node:test` (built into Node 18+; this repo runs Node 26). The suite builds deterministic games with an `assignRoles(...)` helper that injects an exact role array (player i gets roles[i-1]) instead of relying on the shuffled deck — this is the pattern to follow for new tests. 248 tests cover ratio table, preset composition, overrides, night resolution, all special roles, victory scenarios, the regression set, the BotC three-stage trial (seconding, strict-majority acceptance, guilty-majority verdict with sentence/spare round, tie-acquit, re-nomination after survive), `playerLog` recording, and (in `game-loop.test.js` + `app-ui.test.js`) full-app edge cases: wizard-back re-recording, legacy-save deserialization, hostile names, corrupted saves, seat-sheet civilian gating, clear-role, detail-sheet logs, the phase clock, the Mod panel, timer nudges, collapsible cards, and full games from setup to victory against a stubbed DOM.

## Working in this repo (orchestration notes)

- This project is built and maintained via the **orchestrator workflow**: plan → dispatch workers via `node C:/Users/Kamil/AppData/Local/crush/tools/worker.js -m <provider>/<model>` → mandatory review pass → fix loop → `node --test` until green.
- **Worker model defaults (per owner override)**: code workers on `opencode-go/gpt-5.6-luna`, design/visual workers on `opencode-go/mimo-v2.5`, research on `opencode-go/mimo-v2.5`. The historical Flash default no longer applies; escalate to heavier Luna for large engine specs.
- Worker prompts must be **shell-safe** (no backticks, parentheses, `&&`, `<`, `>`). Long specs live in `docs/` and workers are told to read them first.
- `docs/ROLES_REVISITED.md` is the canonical role catalog; `docs/REVISION_1.md` is the canonical mechanic brief; `docs/GDD.md` is the canonical system doc. Update docs first, then code, then tests — never the reverse.
- `docs/IMPROVEMENTS-STATUS.md` is the handoff: read it when starting a new work session, especially the left-to-do list and the open balance investigation.
