# Session Report — Town of Vibelm

Date: 8/12/2026 (updated at session wrap)
Purpose: handoff so the next session can pick up exactly where this one left off. Read `AGENTS.md` for repo conventions and `docs/GDD.md` for the rules. `docs/interface.md` is the engine/UI API contract.

## What the project is

**Town of Vibelm** (formerly "Village Pub") — a zero-dependency, mobile-first **moderator companion web app** for an in-person hybrid Town of Salem x Blood on the Clocktower game. One human moderator runs the app on a phone; players never touch it. It is deliberately NOT a game: it assists setup, seat assignment, the night wizard, morning announcements, trials, and the end-of-session recap. Player-provided content (last wills, whispers) is never stored or shown — wills live on paper cards.

Architecture: vanilla HTML/CSS/JS, no build step, no ES modules (must work by double-clicking `index.html`). Engine parts (`js/engine/00-10` + `07b`) are DOM-free and Node-testable via the barrel `js/engine.js`. UI parts (`js/ui/`) attach to `window.UI`; app wiring (`js/app/`) to `window.APP`. `index.html` is the load-order manifest. Scripts in `scripts/` are dev tools only.

## Commands

```bash
node --test --test-reporter=dot tests/engine.test.js   # full suite (currently 119 tests, all green)
node scripts/simulate.js                                # random-play crash/error sim (30 games: 6 presets x 8-12 players)
node scripts/agentic.js                                 # one game with heuristic-AI players + transcript
node scripts/llm-sim/runner.js --dry-run                # one game, heuristic fallbacks only (no cost)
node scripts/llm-sim/runner.js                          # one game with real LLM agents (paid flash via crush)
LLM_DEBUG=1 node scripts/llm-sim/runner.js --dry-run    # print sample prompts instead of running
python -m http.server 8000                              # phone testing on same Wi-Fi
```

## Work delivered so far (both sessions)

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
11. **Simulation tooling**: `scripts/simulate.js` (random-play crash test with invariants + serialize/deserialize round-trips), `scripts/agentic.js` (heuristic-AI game with transcript), `scripts/llm-sim/` (real LLM agents).
12. **Bug found by simulation**: revived players kept stale graveyard entries → fixed with a permanent `diedBefore` flag; re-death grants no second ghost token.
13. **LLM simulator** (`scripts/llm-sim/`): knowledge.js (prompt builders + per-player memory journal), fallback.js (heuristics), runner.js (game loop + parallel spawn pool over `crush run` on **opencode-go paid flash**). Night actions run in parallel; day = 2 discussion rounds + nomination + parallel votes (ghost tokens); day abilities folded into vote calls.
14. **Per-player memory journal** (latest rebuild): agents are stateless spawns, but the runner maintains a per-player journal (own actions + results + public news), rolled up into a digest when >12 entries, so prompts stay bounded (~identity + memory + news diff) for the whole game. No provider-side sessions — the engine stays Crush-independent.

## Current status

- **Tests: 119 pass, 0 fail.**
- **Random sims: 90 games, 0 crashes, 0 invariant violations** (error-checking only, NOT a balance signal).
- **Agentic sim: Mafia 6/6.** **LLM sim live game: Mafia won** (Godfather outlasted after power roles died). **Balance is still an open question** — see below.

## OPEN: balance investigation (the main next task)

The game looks Mafia-favored under both heuristic and LLM play. Caveats before touching rules:

1. Random-play bias: the random sim cannot judge balance (info roles unused, random lynches hit the Town majority).
2. Heuristic policies may be town-passive (lynch only on sheriff intel, no pressure-lynching, no role-claim meta).
3. The LLM sim (with the memory journal) is the most realistic signal available — run several games and tally winners before concluding anything.

Suggested next steps:
1. Run `node scripts/llm-sim/runner.js` a few times (or loop it with different presets/counts) and tally wins by team. One game ≈ 2-5 min on paid flash.
2. Check the day-playground realism: agents should claim roles, pressure silent players, and react to counter-claims (the last live game did this well — Sheriff claimed, fake counter-claim happened, Doctor vouched).
3. Only then decide on rule tuning: candidate levers are default `noKillN1`, lynch threshold, ratio table (change `docs/GDD.md` first, then engine, then tests).
4. Balance target: roughly 40-50% Mafia, 35-45% Town, remainder Neutral under LLM play, per player count.

## Known notes

- `CONCEPT.md` is the historical concept dump (mangled); ignore for implementation.
- `docs/design-suggestions.md` is the designer audit — all 12 items are implemented; re-read for future polish ideas.
- `docs/tasks/` is transient (task specs) — deleted at session end each time.
- Git history still contains the old "Village Pub" name (fine). Two commits pushed to `origin/main` (rename/companion pass + this session's wrap).
- `dist/` is a build artifact (`node scripts/bundle.js`); not kept in the repo.
- The free opencode-zen tier rate-limits parallel calls heavily; the sim runs on opencode-go paid flash (`crush run -m opencode-go/deepseek-v4-flash`), which is fast and reliable. Crush holds the credentials; `scripts/llm-sim/runner.js` resolves `crush.exe` from PATH on Windows.
- Windows spawn gotcha (fixed): `execFile('crush')` hangs because Crush waits on the stdin pipe — the runner uses `spawn` with `stdio: ['ignore','pipe','pipe']` + `TERM` env.
