# Town of Vibelm

A **moderator assistant web app** for a social deduction game that blends the mechanical spine of *Town of Salem* with the social tabletop soul of *Blood on the Clocktower*.

Played in person by a group of friends. One human moderator runs the game from a phone; players never touch the app. They sit at the table, close their eyes at night, and answer the moderator with points and whispers.

## Features

- **Dynamic setup**: 6 to 15 players, 6 themed scenario presets, editable team priority lists, Town/Mafia/Neutral count steppers, and a Civilian counter with a built-in deck-size failsafe.
- **House-rule toggles**: no kill on night one, no lynch on day one, classic role reveal on death.
- **Seat layouts**: circle, two rows, U-shape, or rectangular table; per-seat role dropdowns (the moderator assigns each role manually), auto-fill, and tap-to-tap role swaps.
- **Automated night wizard**: a scripted 0-14 step walk the moderator reads aloud, with target pickers, timers, and private result reveals (Sheriff checks, Consigliere IDs, Undertaker inspection). Each role wakes in its own step — only Mafia and ghosts share a phase, so no two roles ever see each other.
- **Full day phase**: morning announcements with mystery deaths (roles hidden), a day discussion timer, trials with ghost votes, Mayor 3-vote weight, and Vigilante/Deputy/Mayor day abilities.
- **Role reference**: a searchable overlay of all 30 roles with descriptions, reachable from any screen.
- **Session recap**: a death timeline on the end screen for the moderator's debrief.
- **Companion mode**: wills and other player-provided content never enter the app — players keep wills on paper cards.
- **Ghost mechanics**: whispering ghosts, Ghost Ledger, Medium seances, one ghost vote token per dead player, Jester haunt, Executioner conversion.
- **Victory engine**: Town of Salem win conditions with the correct priority order (individual wins first, then SK, Mafia, Town), checked after lynches, morning announcements, and day kills.
- **Resilient state**: the whole game state auto-saves to localStorage and resumes after reloads or call drops.
- **Zero dependencies**: no build step, no frameworks, no package manager, runs by opening `index.html`.

## Quick start

**On your PC:** open `index.html` in any browser. That's it.

**On your phone (same Wi-Fi):**

```bash
python -m http.server 8000
# open http://<your-pc-ip>:8000 on the phone
```

**Run the test suite:**

```bash
node --test --test-reporter=dot tests/engine.test.js
```

## Offline and phone usage

**Option 1 — GitHub Pages.** Push the repo, enable Pages in your repository settings with *Source: GitHub Actions*, and open the deployed URL. On your phone, use *Add to Home Screen* so it installs like an app and works fully offline after the first visit.

**Option 2 — fully offline, no internet.** Run `node scripts/bundle.js`, copy `dist/town-of-vibelm-offline.html` to your phone, and open it from the Files app or Downloads. Android handles this well; iOS file saves can be flaky, so test first.

**Option 3 — Android zip.** Download the repo as a zip, extract it, and open `index.html` in Chrome.

Game saves live in the browser on the device and are **not** synced between devices.

## How a game flows

1. **Setup** — pick player count, preset, team structure, house rules, and seat layout.
2. **Seats** — name your players (defaults to Player N), assign each seat a role from a dropdown, optionally auto-fill and swap.
3. **Night** — the wizard walks the moderator through every acting role in order; resolve the night.
4. **Morning → Day** — deaths are announced (roles hidden), discussion with the day timer, trials with voting and lynching.
5. **End** — victory triggers a full role reveal plus a session recap.

## Project structure

```
index.html              # App shell + load-order manifest (no build step)
styles/                 # base.css + per-screen styles
js/engine/              # Pure game logic, DOM-free, Node-testable (00-10 parts)
js/ui/                  # Screen renderers
js/app/                 # Configuration, persistence, routing, tap handlers
scripts/                # Dev tools: bundle.js, simulate.js, agentic.js, llm-sim/
tests/                  # node:test suite (no dependencies)
docs/GDD.md             # Authoritative game rules
docs/interface.md       # Engine/UI interface contract
AGENTS.md               # Agent guide: conventions, gotchas, commands
SESSION-REPORT.md       # Session handoff report for the next work session
```

The engine is deliberately separated from the UI: it runs identically in the browser and Node, which is what makes the 119-test suite possible. See `docs/GDD.md` for the full rules and `AGENTS.md` for development conventions.

## Simulation tooling (balance & error testing)

```bash
node scripts/simulate.js                       # 30 random-play games: crash/invariant checks
node scripts/agentic.js                        # one game with heuristic-AI players + transcript
node scripts/llm-sim/runner.js --dry-run       # one game with heuristic fallbacks only
node scripts/llm-sim/runner.js                 # one game with real LLM agents (paid flash via crush)
```

`scripts/llm-sim/` plays a full game with stateless LLM agents that get runner-side memory (per-player journal): identity + memory + news-diff prompts, parallel night actions, a day discussion playground, and knowledge isolation per player. See `SESSION-REPORT.md` for the open balance investigation.
