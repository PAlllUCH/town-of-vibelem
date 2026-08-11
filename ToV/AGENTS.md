# AGENTS.md — Town of Vibelm

Town of Vibelm is a **moderator assistant web app** for a hybrid Town of Salem + Blood on the Clocktower social deduction game, played in person by a group of friends. One human moderator runs the game from a **phone** (mobile-first, portrait); players never touch the app — they sit at a table, close their eyes at night, and respond to the moderator with gestures.

## Source of truth

| File | Role |
|---|---|
| `docs/GDD.md` | **Authoritative game rules.** 30 roles, 6 presets, night order 0-16, attack/defense model, drunk engine, ghost rules, victory conditions, house rules. If code disagrees with GDD, code is wrong. |
| `docs/interface.md` | Engine↔UI API contract. Exact function signatures, state shape, screen structure. |
| `CONCEPT.md` | Historical concept dump (mangled). Ignore for implementation; GDD supersedes it. |

## Architecture

Zero-dependency vanilla HTML/CSS/JS. No build step, no package.json, **no ES modules** (browsers block `import` on `file://` — the app must keep working by double-clicking `index.html`). Split into small part files that attach to globals; `index.html` is the load-order manifest.

```
index.html              # App shell + MANIFEST: 6 css links, one <script> per part (order matters)
styles/base.css         # CSS custom properties, typography, buttons, tags, bottom bar
styles/setup.css seats.css game.css end.css reference.css   # per-screen styles (mechanical split, no build)
js/engine/00-namespace.js … 10-victory.js   # PURE LOGIC, DOM-free, ~10 small parts
js/engine.js            # Node-only barrel: requires parts 00-10, exports VillageEngine (browser no-op)
js/ui/common.js setup.js seats.js wizard.js day.js end.js reference.js   # renderers → window.UI
js/app/config.js persistence.js router.js actions(-setup|-seats|-game).js   # wiring → window.APP
js/app.js               # 7-line bootstrap (APP.init)
tests/engine.test.js    # node:test suite, requires ../js/engine.js (the barrel)
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
node --test --test-reporter=dot tests/engine.test.js
# or plain:  node --test tests/engine.test.js

# Run the app (phone testing on same Wi-Fi):
python -m http.server 8000    # then open http://<your-ip>:8000 on the phone
# or just double-click index.html (works, but localStorage is per-origin)
```

**Gotcha:** `node --test tests/` (directory form) fails on Windows Node 26 with "Cannot find module". Always target the file explicitly. `--test-reporter=dot` keeps output small.

**Gotcha:** this shell environment has no `sed`, `tail`, `wc`, `head`, or `grep` binaries. Use the built-in grep/glob/view tools instead of shell equivalents.

## Conventions

- **Engine API** is exactly what `docs/interface.md` documents — 21 functions (`createGame`, `getDeckPreview`, `setPlayerNames`, `dealRoles`, `redeal`, `swapRoles`, `getNightSteps`, `recordNightAction`, `resolveNight`, `getMorningAnnouncement`, `beginDay`, `startTrial`, `castVote`, `resolveTrial`, `vigilanteShoot`, `deputyShoot`, `mayorReveal`, `checkVictory`, `serialize`, `deserialize`, `endGame`). UI calls them via `E.<fn>`.
- **Night steps are 0-14** (`engine.NIGHT_STEPS`): 0 Veteran alert, 1 Poisoner, 2 Witch, 3 Jailor, 4 Escort and Consort (separate steps), 5 Doctor, 6 Mafia (grouped), 7 Janitor and Forger (separate steps), 8 Blackmailer, 9 SK, 10 Framer, 11 Sheriff/Tracker/Lookout/Consigliere/Undertaker (separate steps), 12 Retributionist and Amnesiac (separate steps), 13 Medium/Ghosts (grouped), 14 Morning. Morning is the last step; the will window and pencils-down steps were removed (players keep wills on paper cards, the app never stores or shows them).
- **State fields** beyond the interface doc exist: `morning`, `executionerConverted`, `pendingInheritanceNote`, `lastJailTarget`, `lastBlackmailTarget`, `jester`, `retributionist`, `amnesiac`. `deserialize` must default them for old saves.
- **All user-derived strings** (names, wills) must pass through `esc()` (ui.js) before `innerHTML`; prefer `textContent`. Never inject raw.
- **Touch targets ≥ 44px** (`.btn-sm` was 40px once; don't regress). No hover-only interactions. Seat positions in the circle layout are clamped 12-88%.
- **Status tags** the seat grid can render: `[ALIVE][GHOST][DRUNK][INHERITED SHERIFF][JAILED][PROTECTED][POISONED][ALERT][REVEALED][CLEANED][BLACKMAILED]`. The jailed/poisoned/alerted/cleaned flags are per-player and set during a night, so they only appear while fresh.

## Game rules cheat-sheet (the non-obvious ones)

- **Deck building:** ratio table (6→4/2/0 … 15→9/4/2 Town/Mafia/Neutral). Preset priority lists fill slots top-down; **only Civilians may repeat** (Civilian overflow fills Town). Mafia/Neutral overrides shorter than the ratio are padded deterministically (regression: short overrides used to crash `dealRoles`).
- **Night resolution:** attacks are Basic (Mafia/SK, blocked by Doctor protection once + Basic defense) or Unstoppable (Jailor execute, Veteran alert, Jester haunt). Deaths resolve immediately at their position — a player who dies at position 6 is dead for positions 7-13. Roleblock only cancels the target's own action, never saves them from a kill.
- **Drunk:** Poisoner makes a target Drunk for one cycle; The Drunk role is permanently disabled. Drunk effects: Sheriff/Consigliere results invert, Janitor clean fails, Doctor protection fails. Everything else acts normally.
- **Mystery deaths:** morning shows will + "?? UNKNOWN ??". Janitor cleaning permanently blocks the Undertaker's inspection. `classicReveal` house rule shows true roles instead.
- **Deputy inheritance:** on Sheriff death, an alive Deputy permanently gets the Sheriff check (woken in the Sheriff step, position 11). Announced publicly.
- **Jester:** wins when lynched → taunting ghost (speaks to the living, no ghost vote token); game continues; haunt one Guilty voter to death (Unstoppable) at the start of the next night if the game continued. **Executioner** converts to Jester when the target dies by any non-lynch means.
- **Witch (ToS canon, no bans):** controls anyone except a currently-jailed player; learns the controlled player's exact role; controlling GF/SK redirects their kill; controlling Jailor redirects only the jail target (EXECUTE/SPARE stays with the Jailor). `witchSide` (MAFIA default, TOWN optional) is editable pre-game via the seats screen.
- **Caps:** Jailor 3 executions (none N1), Vigilante 3 shots, Veteran 3 alerts. GF gets 3 Town bluff roles *not in the deck* at setup (whispered by moderator).
- **Victory checks** run after a lynch, after morning announcements, AND immediately after any day kill. Priority: individual (Jester, Executioner) → SK → Mafia → Town. Town requires the SK dead.
- **Ghosts:** whisper among themselves freely; Ghost Ledger at the Medium step; alive Medium reads it 30s, dead Medium whispers 60s with one living target; each ghost holds exactly one vote token (Guilty/Innocent only, never Abstain). Revived players lose tokens permanently.

## Testing approach

`node:test` (built into Node 18+; this repo runs Node 26). The suite builds deterministic games with an `assignRoles(...)` helper that injects an exact role array (player i gets roles[i-1]) instead of relying on the shuffled deck — this is the pattern to follow for new tests. 93 tests cover ratio table, preset composition, overrides, night resolution, all special roles, victory scenarios, and the regression set.

## Working in this repo (orchestration notes)

- This project is built and maintained via the **orchestrator workflow**: plan → dispatch workers via `crush run "..." -m opencode-go/deepseek-v4-flash --cwd "<project-root>"` (user constraint: Flash workers only, no free tier, no MiMo) → mandatory review pass → fix loop → `node --test` until green.
- Worker prompts must be **shell-safe** (no backticks, parentheses, `&&`, `<`, `>`). Long specs live in `docs/` and workers are told to read them first.
- The GDD is deliberately the single source of truth — change rules in `docs/GDD.md` first, then update `docs/interface.md` if the API shape changes, then code + tests.
