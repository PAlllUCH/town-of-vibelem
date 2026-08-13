# Session Report — Town of Vibelm

Date: 8/12/2026 (updated at session wrap)
Purpose: handoff so the next session can pick up exactly where this one left off. Read `AGENTS.md` for repo conventions and `docs/GDD.md` for the rules. `docs/interface.md` is the engine/UI API contract.

## What the project is

**Town of Vibelm** (formerly "Village Pub") — a zero-dependency, mobile-first **moderator companion web app** for an in-person hybrid Town of Salem x Blood on the Clocktower game. One human moderator runs the app on a phone; players never touch it. It is deliberately NOT a game: it assists setup, seat assignment, the night wizard, morning announcements, trials, and the end-of-session recap. Player-provided content (last wills, whispers) is never stored or shown — wills live on paper cards.

Architecture: vanilla HTML/CSS/JS, no build step, no ES modules (must work by double-clicking `index.html`). Engine parts (`js/engine/00-10` + `07b`) are DOM-free and Node-testable via the barrel `js/engine.js`. UI parts (`js/ui/`) attach to `window.UI`; app wiring (`js/app/`) to `window.APP`. `index.html` is the load-order manifest. Scripts in `scripts/` are dev tools only.

## Commands

```bash
# Run tests (works on Windows Node 26):
cd <project-root>
node --test --test-reporter=dot tests/engine.test.js
# or plain:  node --test tests/engine.test.js

# Run the app (phone testing on same Wi-Fi):
python -m http.server 8000    # then open http://<your-ip>:8000 on the phone
# or just double-click index.html (works, but localStorage is per-origin)

# Simulation tools (dev only, not part of the app):
node scripts/simulate.js                       # 30 random-play games: crash/invariant checks
node scripts/agentic.js                        # one game with heuristic-AI players + transcript
node scripts/run-sim-archetypes.js p1 11 50    # 50 games with archetype AI

# Neural net training (Python):
python python/train.py --population-size 20 --generations 10 --player-count 11 --preset-id p1

# Neural net evaluation (JS):
node -e "const loader = require('./js/sim/agent-loader.js'); ..."
```

## Work delivered so far (all sessions)

1. **Rename** to "Town of Vibelm" (index.html, manifest "ToV", sw.js cache, bundle output, docs). `SAVE_KEY` stays `villagepub-save` so existing saves survive.
2. **Companion mode**: all last-will content removed. Forger keeps target-only; morning shows a "will forged for X" reminder — the will is read from the player's card.
3. **Per-seat role dropdowns** (`E.assignRoles`, multiset validation, Auto-fill, Lock Roles).
4. **Deck Builder** role descriptions (blurbs), tooltips.
5. **Role Reference screen** (`js/ui/reference.js` + `styles/reference.css`, header "Roles" button).
6. **Day discussion timer** (circular progress ring via `--p`, `timer-danger` under 30s).
7. **Session recap** (`state.deathLog` timeline on the end screen).
8. **Night steps split**: every role wakes individually; only Mafia and Medium/Ghosts stay grouped. Positions reused as resolution keys.
9. **Targeting rules**: no self-target except Doctor and the Mafia kill; Mafia may kill its own members; Jailor has no EXECUTE on Night 1; Mafia phase is a single kill pick (`E.mafiaKillActor`).
10. **Companion wording** (Start Session / Session Over), **design overhaul** (two MiMo passes: vibe theme tokens + all 12 items from `docs/design-suggestions.md`), **new clocktower icon**.
11. **Simulation tooling**: `scripts/simulate.js` (random-play crash test with invariants + serialize/deserialize round-trips), `scripts/agentic.js` (heuristic-AI game with transcript), `scripts/run-sim-archetypes.js` (archetype-based AI with memory).
12. **Bug found by simulation**: revived players kept stale graveyard entries → fixed with a permanent `diedBefore` flag; re-death grants no second ghost token.
13. **Balance changes** (this session):
    - No Kill Night 1 by default (config.js)
    - Remove Jailor execution cap (06-night-actions.js)
    - Doctor blocks ALL Basic attacks (07b-night-resolution.js)
14. **Code review fixes** (this session):
    - End screen "[object Object] Wins" bug
    - Roleblocks now tracked on player objects
    - Witch redirect applied to killer's effective target
    - recordNightAction validates roleId and alive status
    - Silent save failure now logs warning
    - deserialize validates assignedRole and seat
    - __proto__ pollution prevention in config merge
    - ROLES uses null-prototype object
    - Seat values escaped in innerHTML
15. **AI simulation system** (this session):
    - `scripts/ai-archetypes.js` — 10 archetypes with memory-based information asymmetry
    - `scripts/run-sim-archetypes.js` — Simulation using archetypes
    - `python/` — Neural net training pipeline (6 files)
    - `js/sim/` — Neural net inference module (4 files)
    - `weights/` — Trained weights directory (gitignored)

## Current status

- **Tests: 119 pass, 0 fail.**
- **Neural net AI: 40% Town win rate** (up from 0-8% with heuristic AI)
- **Balance changes implemented**: noKillN1 default, unlimited Jailor executes, Doctor blocks all Basic attacks

## Neural net training results

| Training | Town Win | Mafia Win | Notes |
|----------|----------|-----------|-------|
| Heuristic AI | 0-8% | 90-100% | No learning, passive Town |
| Neural net (5 gen) | 40% | 60% | Significant improvement |

Training command: `python python/train.py --population-size 10 --generations 5 --player-count 11 --preset-id p1`

Trained weights saved to `weights/` directory (gitignored).

## Known notes

- `CONCEPT.md` is the historical concept dump (mangled); ignore for implementation.
- `docs/design-suggestions.md` is the designer audit — all 12 items are implemented; re-read for future polish ideas.
- `docs/tasks/` is transient (task specs) — deleted at session end each time.
- Git history still contains the old "Village Pub" name (fine). Two commits pushed to `origin/main` (rename/companion pass + this session's wrap).
- `dist/` is a build artifact (`node scripts/bundle.js`); not kept in the repo.
- `scripts/llm-sim/` was an experimental approach that did not yield reliable results. Files are preserved but should not be used unless explicitly reactivated.
- `weights/` directory contains trained neural net weights. These are gitignored and should not be committed.

## Next steps (for next session)

1. **Scale up neural net training** — More generations = stronger AI
2. **Test different presets** — p2, p3, p4 with neural nets
3. **Test different player counts** — 10, 12, 14 players
4. **Integrate into companion app** — Add "Balance Check" feature to setup screen
5. **Consider multiplayer** — AI runs server-side, sends actions via API


## Session: UI readability, edge-case playthrough, BotC rules (latest)

- Readability hygiene: 0.72rem font floor, ~20 hardcoded colors tokenized (17 new :root tokens incl. --scrim), spacing scale --space-1..5, ellipsis/overflow on circle tiles and chips, color-mix fallback, theme-color aligned, dead .toast-warn removed.
- New suite tests/game-loop.test.js (15 tests): full-app Node driver with a stubbed DOM playing real games (setup to victory). Exposed + fixed 3 app bugs: endReveal never populated, wizard-back duplicate night actions, deserialize missing executionerConverted + lastJail/lastBlackmail backfills.
- Flow change: Day 1 now comes FIRST. Seats dealt view is the prep phase -> Begin Day 1 -> Night 1 wizard (N1 rules apply) -> Morning -> Day 2. Header labels NIGHT by state.night.number.
- Trials are now BotC-style two-stage: nomination -> SECONDS round -> strict-majority acceptance (floor(living/2)+1, nominator auto-agrees) -> verdict vote where GUILTY must strictly outnumber INNOCENT; ties acquit; at most one lynch per day (survives/cancels don't consume it); trials allowed Day 1 onward.
- New state.playerLog: structured per-player action history appended by the engine (role set, night actions, deaths, swaps, verdicts, etc.), rendered newest-first in the new player-detail sheet. deserialize defaults it.
- Seats screen: naming mode is now a tappable .seat-btn grid opening a bottom sheet (name + role picker); civilian is offered only while deck capacity remains (fixes the civilian-without-sheriff lockout). Dealt view + mid-game Seats overlay open a player-detail sheet (role/tags/blurb/log).
- Scenario/preset cards fixed: .preset-card stretches, names ellipsize, taglines wrap inside the card.
- New part js/app/actions-sheets.js (seats-sheet handlers, focus trap). New styles/sheets.css (sheet styles, z 30/31). Registered in index.html + sw.js CORE_ASSETS.
- Sims fixed for two-stage trials: scripts + js/sim second before verdicts; simulate.js now produces real lynches.
- Tests: 213 pass / 0 fail. Docs: GDD + interface.md updated (trial stages, playerLog, result shapes).

## Session 2 addendum: roles + moderator toolbox + audit wave 1

- 4 new roles (34 total): Spy (Neutral Benign, shared win), N1-only Oracle, start-knowing Washerwoman / Chef. Deck-reach table per preset in GDD §4.8. Night Watcher, Informer, and Informant were added and then DELETED at the owner's request (Night Watcher = weaker Lookout, Informer/Informant disliked).
- Moderator toolbox: Night Zero prep checklist (bluffs / Witch side / Executioner target / N1 relays / deal), Tonight's Whispers info panel (all kind 'info' playerLog rows), public Claims grid (day view, zero engine impact).
- UI audit Wave 1 (docs/reports/ui-audit.md, 44 findings) implemented: flow-strip legibility, sticky wizard Step counter + Resolve Night banner, SECONDS→VOTE transition banners, team-grouped role picker, playerLog kind tags, Back-vs-Skip weighting, toast replace, :focus-visible, dead-code cleanup.
- ToS/BotC comparison (docs/reports/tos-botc-comparison.md) and N1-only role designs (docs/reports/first-night-roles.md) live in docs/reports/.
- noLynchD1 house rule now defaults ON (Day 1 = discussion/claims; lynches from Day 2) with the flag toggleable.
- New parts: js/engine/04b-start-knowing.js, js/engine/06b-night-actions.js, js/app/actions-panels.js (all registered in index.html + sw.js CORE_ASSETS + barrel).
- Tests: 213 pass / 0 fail. Sims: 30 runs / 0 failures (MAFIA ~22-27 / TOWN 3-8 — balance still Mafia-heavy, see open balance investigation).
35 roles total (Witness added for pairwise info). Final polish wave: tally chips, death cause, ghost SVG, end-screen grouping, timer, toast, circle scaling, exit animation, claim round, whispers step integration, 6 wizard fixes (cleaned tags, summary card, veteran chip, forged note, drunk consul, prev step always). ready for NN training.
