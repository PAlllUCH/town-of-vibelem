# Session Report — Town of Vibelm

Date: 8/11/2026
Purpose: handoff so the next session (possibly on a different machine) can pick up exactly where this one left off. Read `AGENTS.md` for repo conventions and `docs/GDD.md` for the rules. `docs/interface.md` is the engine/UI API contract.

## What the project is

**Town of Vibelm** (formerly "Village Pub") — a zero-dependency, mobile-first **moderator companion web app** for an in-person hybrid Town of Salem x Blood on the Clocktower game. One human moderator runs the app on a phone; players never touch it. It is deliberately NOT a game: it assists setup, seat assignment, the night wizard, morning announcements, trials, and the end-of-session recap. Player-provided content (last wills, whispers) is never stored or shown — wills live on paper cards.

Architecture: vanilla HTML/CSS/JS, no build step, no ES modules (must work by double-clicking `index.html`). Engine parts (`js/engine/00-10` + `07b`) are DOM-free and Node-testable via the barrel `js/engine.js`. UI parts (`js/ui/`) attach to `window.UI`; app wiring (`js/app/`) to `window.APP`. `index.html` is the load-order manifest.

## Commands

```bash
node --test --test-reporter=dot tests/engine.test.js   # full suite (currently 119 tests, all green)
node scripts/simulate.js                                # random-play crash/error simulation (30 games: 6 presets x 8-12 players)
node scripts/agentic.js                                 # ONE game with heuristic-AI players + transcript (balance analysis)
python -m http.server 8000                              # phone testing on same Wi-Fi
```

## Work delivered this session

1. **Rename** to "Town of Vibelm" everywhere (index.html, manifest "ToV", sw.js cache, bundle output, README, AGENTS, docs). `SAVE_KEY` intentionally stays `villagepub-save` so existing saves survive.
2. **Companion mode**: all last-will content removed (will window, will inputs, morning will display, Jailor will-reading, Forger will text). Forger keeps target-only; morning shows a "will forged for X" reminder — the will is read from the player's card.
3. **Per-seat role dropdowns**: moderator assigns each seat a role from the deck manually (engine: `E.assignRoles`, with multiset validation), plus Auto-fill and Lock Roles. `E.swapRoles`/`E.redeal` kept.
4. **Deck Builder**: each role row shows its description (`blurb`), add-role dropdowns have tooltips.
5. **Role Reference screen**: searchable 30-role overlay, "Roles" button in the header (`js/ui/reference.js` + `styles/reference.css`).
6. **Day discussion timer**: centered circular progress ring (conic-gradient via `--p` CSS var, `timer-danger` class under 30s), 60/120/180s buttons.
7. **Session recap**: `state.deathLog` timeline on the end screen.
8. **Night steps split**: every role now wakes individually (Sheriff, Undertaker, Tracker, Lookout, Consigliere, Escort, Consort, Janitor, Forger, Retributionist, Amnesiac each have their own step) — only Mafia (GF+Mafioso) and Medium/Ghosts stay grouped, so woken players never learn each other's identities. Positions reused as resolution keys; resolution engine untouched.
9. **Targeting rules**: no self-targeting except Doctor (self-heal) and the Mafia kill (may hit any other player incl. own members — the old "Mafia-aligned kill fails" block was removed). Jailor has NO execute option on Night 1 (SPARE only). Mafia phase is a single kill pick via `E.mafiaKillActor`.
10. **Companion wording**: Start Session / Session Over etc.
11. **Design overhaul**: two MiMo-V2.5 passes — vibe theme (warm ember-on-charcoal tokens in `base.css`) and implementation of all 12 items from `docs/design-suggestions.md` (wizard prompt size, flow strip, tags, bottom bar, tactile tiles, ghost-voter rows, timer urgency, toast variants, stepper pulse, reference search, layout transitions, new clocktower `icon.svg`).
12. **Bug found by simulation**: revived players kept stale graveyard entries (corpse pickers could target living players). Fixed with a permanent `diedBefore` flag; graveyard entry removed on revival; re-death grants no second ghost token. 2 new tests.
13. **Simulation tooling**: `scripts/simulate.js` (random-play crash test with per-night invariants + serialize/deserialize round-trips) and `scripts/agentic.js` (one full game with heuristic-AI policies and a readable transcript).

## Current status

- **Tests: 119 pass, 0 fail.**
- **Random simulations: 90 games (3 passes x 6 presets x 8-12 players), 0 crashes, 0 invariant violations.** This suite is for ERROR-checking, not balance.
- **Agentic simulator: 6/6 games won by MAFIA** (7-8 days each). See the balance section — this is the open question to resolve next session.

## OPEN: balance investigation (the main next task)

The user flagged the game as "very not balanced" after the random sim showed MAFIA 74/90. Two caveats before touching rules:

1. **Random-play bias**: the random sim cannot judge balance — random lynches/shots hit the Town majority, town info (Sheriff/Tracker/etc.) is never used, and random votes rarely convict. Mafia dominance there is expected.
2. **Agentic sim also Mafia-favored (6/6)**: the heuristic policies in `scripts/agentic.js` need scrutiny before concluding the game is unbalanced — possible policy artifacts: town never votes guilty without sheriff intel (too passive), doctor permanently shields the sheriff (mafia adapts by killing the doctor — fine), mayor reveals day 2, vigilante only shoots sheriff-flagged players.

Suggested next steps:
1. Run `node scripts/agentic.js` in a loop (e.g. 20-50 games) and tally wins by team and player count — get a real balance signal with the current policies.
2. Review the agentic policies for town passivity; possibly add: town lynches on consigliere-style info via Undertaker, tracker/lookout evidence feeding suspicion, jailor executes on tracked visitors, medium ghost-info sharing.
3. Only then decide if actual game-rule tuning is needed (candidate levers: default `noKillN1`, lynch threshold, ratio table tweaks in `docs/GDD.md` first — GDD is the source of truth, then engine, then tests).
4. A proper balance target: roughly 40-50% Mafia, 35-45% Town, remainder Neutral under agentic play, per player count.

## Known minor notes

- `CONCEPT.md` is the historical concept dump (mangled); ignore for implementation.
- `docs/design-suggestions.md` is the designer audit — all 12 items are implemented; can be re-read for future polish ideas.
- Git history still contains the old "Village Pub" name (fine).
- `dist/` is not kept in the repo (build artifact via `node scripts/bundle.js`); the old `dist/village-pub-offline.html` was deleted this session.
