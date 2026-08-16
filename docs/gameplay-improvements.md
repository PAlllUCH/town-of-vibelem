# Town of Vibelm — Gameplay Improvement Proposals

**Date:** 8/13/2026
**Status:** PROPOSAL — requires discussion before implementation
**Source of truth:** `docs/GDD.md` (rules), `docs/IMPROVEMENTS-STATUS.md` (status), `docs/audit-unimplemented.md` (evidence)
**Scope:** design document only; no code changes.

---

## 1. Balance snapshot

### 1.1 Fresh simulation data (this session)

| Tool | Command | Result |
|---|---|---|
| Random-play crash/invariant sim | `node scripts/simulate.js` | 30 runs (presets p1-p6 × counts 8-12), 0 failures. Winner distribution: **MAFIA 24 (80%), TOWN 3 (10%), SERIAL_KILLER 3 (10%)** |
| Archetype-AI sim | `node scripts/run-sim-archetypes.js p1 11 20` | 20 games (preset p1, 11 players). **TOWN 2 (10%), MAFIA 17 (85%), NEUTRAL 0, nobody 1 (5%)** |
| Neural-net self-play (prior session) | `python python/train.py ...` | **Town 40% / Mafia 60%** after 5 generations |

Archetype-sim detail: Town loses 4-6 players per game while Mafia loses 0-2; games run 3-7 days; 1 of 20 games ended with **no declared winner after 25 days** (a living configuration where no faction can reach majority — worth an engine investigation).

### 1.2 Reading the numbers

- The Mafia-heavy trend documented earlier (84-96%) **persists**: 80-85% Mafia in both fresh sims. The three implemented changes (no-kill Night 1 default, Jailor execution cap removed, Doctor blocks all Basic attacks) did not flip the trend in simulation.
- **Caveat (required):** the sims call `engine.createGame({ playerCount, presetId })` without house rules, so **noKillN1 is OFF in sims** (`noKillN1:false`, `noLynchD1:true`, `classicReveal:false` — verified at runtime) while the app defaults it **ON**. Sim games start with a Night 1 kill; real app games get a full setup day. The sim Mafia share is therefore a pessimistic estimate, but the direction matches every documented data point.
- The death-rate asymmetry is the core mechanic: Mafia kills once a night, guaranteed; Town must assemble a strict-majority trial (or the Jailor) to kill back. The nightly Oracle and the new trial flow have not changed this in the sims — information roles help only if Town can act on them, and random/archetype Town cannot.
- The 40% neural-net Town result is the counterpoint: when Town actually plays well, the rules support a balanced game. The lever to pull is Town's kill/parity math, not more Town information.

---

## 2. Prioritized proposals

Priorities: **P0 = do now, P1 = next, P2 = later.** Every proposal is written to be internally consistent with the GDD (roles, victory conditions, attack/defense model, house-rule toggles).

### P0-1 — Rebalance the alignment ratio table (balance-proposal Change 3)

**Problem:** Mafia reaches parity too fast. At 11 players (7T/3M/1N), Mafia needs only 4 Town deaths; with a guaranteed nightly kill that is a 4-day win timer while Town's kill tools are limited. The ratio is the single highest-leverage structural lever and it is still unimplemented.

**Rule change (GDD-ready, replaces §3):**

| Players | Town | Mafia | Neutral |
|---|---|---|---|
| 6 | 4 | 2 | 0 |
| 7 | 5 | 2 | 0 |
| 8 | 5 | 2 | 1 |
| 9 | 6 | 2 | 1 |
| 10 | 7 | 2 | 1 |
| 11 | 8 | 2 | 1 |
| 12 | 8 | 3 | 1 |
| 13 | 9 | 3 | 1 |
| 14 | 9 | 3 | 2 |
| 15 | 10 | 3 | 2 |

Equivalent rules: 6-7 players: Town = N-2, Mafia = 2, Neutral = 0. 8-11: Town = N-3, Mafia = 2, Neutral = 1. 12-13: Town = N-4, Mafia = 3, Neutral = 1. 14: Town = 9, Mafia = 3, Neutral = 2. 15: Town = 10, Mafia = 3, Neutral = 2. Mafia is 2 at 6-11 players and 3 at 12-15; Neutral grows only at the top.

**Files:** `docs/GDD.md` §3; `js/engine/02-presets.js` (RATIO_TABLE) and `js/engine/03-deck.js` (fill logic); ratio tests in `tests/engine-core.test.js`. Note: **§4.8 deck-reach claims must be re-derived** — the extra Town slots pull the Oracle and Witness into smaller games (e.g. the Oracle reaches 10 players in Preset 2).

**Impact:** at 11 players Mafia now needs 6 Town deaths instead of 4, stretching games to 5-7 days and giving Town time to assemble evidence. **Risk:** LOW-MEDIUM. 2-Mafia games make each Mafia member precious and force better bluffing; if playtesting shows Mafia too weak, the 10-11 rows can revert while keeping 14-15.

### P0-2 — Guarantee one protective role in every deck (balance-proposal Change 5)

**Problem:** every preset lists Doctor in its Town priority, but reach is not guaranteed. At **6 players (4 Town slots) Presets 3, 5 and 6** fill Jailor/Vigilante/Veteran/Deputy-type cores and field **no Doctor at all** — a game with zero protection while the Mafia kills nightly. This is the degenerate state Change 5 was meant to prevent.

**Rule change (GDD-ready, appended to §4.1):**

> Every game of 6 or more players contains exactly one protective role (Doctor). After the deck is filled from the preset's Town priority list, if the Doctor is absent, the lowest-priority non-Civilian Town role in the list is replaced by the Doctor; if the list holds only Civilians, the first Civilian slot is replaced instead.

**Files:** `docs/GDD.md` §4.1; `js/engine/03-deck.js` (post-fill guarantee); deck-composition tests in `tests/engine-core.test.js`. **Impact:** structural floor, no gameplay change for 8+ players. **Risk:** LOW — the replacement is always the tail role, so preset identity is preserved.

### P1-1 — Make the Mafia kill die with the Mafioso (balance-proposal Change 6, deterministic alternative)

**Problem:** the Mafia's nightly kill is currently unkillable: if the Mafioso dies, the Godfather kills alone; if the Godfather is roleblocked, the Mafioso kills. Town has no mechanical way to shut the kill down except killing both, which is why the sim shows 0-2 Mafia deaths per game. The documented Change 6 (20% silent random failure) is rejected (Section 3): the GDD is built on "fairness by construction" with no RNG in resolution.

**Rule change (GDD-ready, replaces the relevant lines of §5.4 and the Mafioso entry of §2.2):**

> The Mafioso is the Mafia's only killer. Each night the Godfather (or the Mafioso himself, if the Godfather is dead or roleblocked) chooses the kill target; the kill resolves only if the Mafioso is alive and unroleblocked. If the Mafioso is dead or roleblocked, the night's kill pick is void: the target survives and no announcement is made. The Godfather never carries out the kill himself. Godfather promotion (§2.2) is unchanged: a promoted Mafioso is still the killer.

**Files:** `docs/GDD.md` §2.2, §5.4, §12.4 wizard wording (when the Mafioso is dead/blocked the Mafia step asks nothing and records no pick); `js/engine/05-night-steps.js` (`mafiaKillActor`), `js/engine/06-night-actions.js` / `07b-night-resolution.js` (void the pick), `js/engine/05-night-steps.js` (wizard step generation); tests in `tests/engine-night.test.js`.

**Impact:** the Mafioso becomes the highest-value Town kill; the Witch's control of the kill leader gains meaning; Town gets a real "shut down the night" objective. **Risk:** HIGH — with the P0-1 ratio (2 Mafia) the Mafioso's death ends the Mafia's kill for the rest of the game; one wrong Mafioso lynch is game-over for Mafia. Ship after P0-1 and only if playtesting still shows Mafia dominance; a softer interim is the existing "kill fails if all living killers are roleblocked" rule plus making the Godfather's fallback kill fail when the Mafioso is merely roleblocked.

### P1-2 — Trial sentence stage: clarify the stakes, tune the spare bar

**Problem:** the sentence stage's effect on lynching rates is mostly *drama, not decisions*. After a guilty verdict (Guilty strictly outnumbers Innocent, Abstains ignored), sparing requires a strict majority of **all** living players to vote Innocent — e.g. at 8 living, a 4-2-2 verdict needs 5 Innocent sentence votes, two more than the verdict's Innocent camp. The last speech must flip at least two people who just voted to convict, so sparing rarely fires; meanwhile "Abstain" in the verdict is effectively a silent conviction, which feels accidental. The stage does hand the Mafia one real tool (3 Mafia + 2 misled townies can spare a member), which is good and should stay.

**Rule change (GDD-ready, replaces the sentence-stage bullet of §12.3):**

> Sentence stage: the accused gives a last speech, then every living player except the accused votes **Spare or Condemn** (the Abstain option is removed — declining to vote counts as Condemn). The accused is spared iff Spare votes reach a strict majority of living players (Spare >= floor(living / 2) + 1); otherwise lynched. Ghosts never vote in the sentence stage; a revealed Mayor's vote still counts as 3.

This is the zero-math half (explicit Condemn default, no ambiguous abstains). The tunable half: **playtest two spare bars** — (a) strict majority of living (current, lynch-favorable) and (b) Spare strictly outnumbers Condemn (reversal-friendly: a 1-2 vote flip after the last speech saves the accused). Recommend keeping (a) while Mafia dominance persists, since Town needs every lynch it can get; switch to (b) if post-P0 playtests show the town over-lynching.

**Files:** `docs/GDD.md` §12.3; `js/engine/09-day.js` (`resolveSentence` threshold and counting); `js/ui/day.js` (stage wording); trial tests in `tests/engine-trial.test.js`. **Impact:** low-moderate; the change is mostly clarity plus one measured knob. **Risk:** LOW.

### P2-1 — Oracle: hold, but shelf a concrete nerf

**Problem:** the now-nightly Oracle is the Town's most direct counter to the Godfather's Sheriff immunity (Godfather reads NOT TOWN to the Oracle; the Witness can out the Godfather too, but only through a correct pairing). In presets 2-6 it wakes from 11 players. That is very strong — but Town is the losing side at 80-85% Mafia, so nerfing the Oracle today moves balance the wrong way. Recommendation: **do not nerf now; shelf this for the day Town exceeds ~55%.**

**Rule change (GDD-ready, on-shelf):**

> The Oracle may not read on two consecutive nights: after a night in which the Oracle used their read, the Oracle rests the following night and is not woken in the Oracle step.

**Files:** `docs/GDD.md` §2.1 and §5.1 (position-11 note); `js/engine/06b-night-actions.js` (Oracle read), `js/engine/05-night-steps.js` (skip the wake), `js/engine/04-state.js` (`state.oracle.lastReadNight` + deserialize default); tests in `tests/engine-night.test.js`. **Impact:** caps the Oracle at roughly half the reads of a game and creates a rhythm the table can reason about. **Risk:** LOW. Flavor alternative (if the group dislikes a cooldown): "after reading, the Oracle is Drunk for the following night's resolution" — effectively the same cadence with a Poisoner-flavored cost; it is strictly worse than the cooldown because the Oracle knows the next read is inverted.

### P2-2 — New role: Bodyguard (Town Protective)

**Problem:** the Doctor is the only protective role; one roleblock or poison on the Doctor leaves Town with zero protection. Both the earlier balance analysis (open question 4) and the BotC comparison flagged the gap.

**Rule change (GDD-ready, new §2.1 entry + §5.3 table row):**

> **Bodyguard** (Town Protective): each night, choose a living player other than yourself to guard. If the guarded player would die from a Basic attack that night, the Bodyguard is killed instead and the guarded player survives; the attack is considered to have resolved against the Bodyguard. Unstoppable attacks ignore the guard. The guard triggers only if the target would otherwise die (after Doctor protection and Basic defense are checked).

**Files:** `docs/GDD.md` §2.1, §4 (append to preset Town lists behind Doctor where reach permits), §4.8 (deck reach), §5.2/5.3; `js/engine/01-roles.js`, `02-presets.js`, `05-night-steps.js` (new wake step), `07b-night-resolution.js` (guard resolution); tests in `tests/engine-core.test.js` / `tests/engine-night.test.js`. **Impact:** a second protective layer at the cost of a life — protection with consequences. **Risk:** MEDIUM; adds a new kill-adjacent interaction, so it needs its own night-step slot and resolution order written down before implementation.

### P2-3 — New role: Physician (Town Support, Poisoner counter)

**Problem:** the Poisoner's one-cycle Drunk has zero Town counterplay; an inverted Sheriff/Oracle read or a failed Doctor protection can decide a game with no response available.

**Rule change (GDD-ready, new §2.1 entry + §6 note):**

> **Physician** (Town Support): once per game, during the day, choose a living player: if that player is Drunk from the Poisoner, they become sober immediately and the current Drunk cycle ends. The cure has no effect on The Drunk role (whose condition is permanent, §6.2) and no effect on a player who is not Drunk.

**Files:** `docs/GDD.md` §2.1, §6 (add a "Curing" subsection), §4 presets; `js/engine/01-roles.js`, `09-day.js` (day ability), `02-presets.js`; tests in `tests/engine-night.test.js` / `tests/game-loop.test.js`. **Impact:** gives Town a decision point against the Poisoner and makes the Drunk economy a real tug-of-war. **Risk:** LOW-MEDIUM; the §6.2 permanence of The Drunk role is explicitly preserved, so no contradiction with existing rules.

### P2-4 — New house rule: Open Graves (dead speak in the day)

**Problem:** ToV's strict ghost protocol (ghosts never speak to the living, §8.1) is the largest divergence from BotC, where the dead form a second social layer. The group may want that lever — as an option, not a change to the default experience.

**Rule change (GDD-ready, new §10 toggle, default OFF):**

> **Open Graves** (default OFF): from the start of Day 2, ghosts may speak publicly during the day like living players. Ghosts still cannot be nominated, cannot second or vote in trials, and still hold only their one ghost vote token (§8.4). On Day 1 ghosts remain silent; night behavior is unchanged.

**Files:** `docs/GDD.md` §8, §10; `js/app/config.js` (toggle), `js/ui/day.js` (wording); app tests in `tests/app-ui.test.js`. **Impact:** accelerates information for everyone — dead players usually share Town's goal, but dead evil players get a voice too, which is the balancing cost. **Risk:** MEDIUM socially, LOW mechanically (victory still counts living players only).

### P2-5 — Moderator QoL: Balance Check on the setup screen

**Problem:** the moderator cannot know whether the current preset/count/toggle combination is fair before dealing. The handoff status (`docs/IMPROVEMENTS-STATUS.md`) and `docs/audit-unimplemented.md` both list this feature.

**Feature (no GDD rule change; one §12.1 line):**

> The Setup screen gains a "Balance Check" button: it runs a quick AI preview (the heuristic archetypes from `scripts/ai-archetypes.js`, or the trained neural-net weights from `js/sim/` + `weights/` when present) over the current player count, preset, and toggles, plays N games in the browser, and shows an estimated win distribution before roles are dealt. Purely informational; it never modifies the deck.

**Files:** `js/app/actions-setup.js` (wiring), `js/sim/` + `weights/` (fallback to heuristic sim if weights are absent — the weights are gitignored), `styles/setup.css`; no engine change. **Impact:** setup becomes a pre-game balance moment. **Risk:** LOW; purely additive moderator tooling.

---

## 3. Explicitly rejected

Ideas documented elsewhere that the design should **not** adopt:

- **Night Watcher** (added and deleted 8/12): a strictly weaker Lookout; redundant with the existing Lookout and adds nothing to the design space.
- **Informer / Informant** (added and deleted 8/12): disliked by the owner; their start-knowing evil-info niche overlaps the Washerwoman/Chef start-knowing slot and the Consigliere, and the group found them confusing.
- **Mafia kill failure as written in Change 6** (20% random silent failure, from the earlier balance proposal): random resolution contradicts the GDD's "fairness by construction" (no RNG in the engine), feels bad for the Mafia, and a silently-voided night kill breaks the moderator's narration (the app would show a pick that produced nothing with no explanation). Use the deterministic P1-1 alternative instead.
- **`scripts/llm-sim/`** (experimental): never produced reliable results; superseded by the archetype + neural-net pipeline. Preserve the files but do not reactivate.

---

## 4. Open questions for the playtesting group (max 6)

1. **Ratio table:** adopt the full flat table from P0-1 (Mafia 2 at 6-11, 3 at 12-15), or keep 3 Mafia at 10-11 and only trim 14-15? The flat table is cleaner but swings 10-11 player games harder.
2. **Mafia kill:** is the Mafioso-centric rule (P1-1, the kill dies with the Mafioso) the right determinism, or would the group prefer the softer "kill fails when the Mafioso is roleblocked" interim while keeping the Godfather's fallback?
3. **Sentence stage:** after a few real games, which spare bar feels right — strict majority of living (lynch-favorable) or Spare strictly outnumbers Condemn (reversal-friendly)? Does the Mafia rescue vector (3 Mafia + 2 misled townies) feel good or frustrating?
4. **Oracle:** if a nerf is ever needed, is the every-other-night cooldown (P2-1) acceptable, or would the group rather see the self-drunk cost, or leave the Oracle as the Town's flagship counter to the Godfather?
5. **Open Graves:** does anyone want the dead speaking in the day, or is the strict ghost protocol part of the fun? The toggle exists only if at least a few players want it.
6. **Bodyguard:** if added, which presets should field it, and should it replace a Civilian or squeeze out a lower-priority role? (This determines whether it reaches small games.)

---

*This document is a proposal, not a final decision. All changes must be discussed and approved before implementation, and rules changes are written to `docs/GDD.md` first.*
