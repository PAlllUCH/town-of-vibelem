# Town of Vibelm — Balance Analysis & Proposed Changes

**Date:** 8/12/2026
**Status:** PROPOSAL — requires discussion before implementation
**Source of truth:** `docs/GDD.md` (rules), `docs/interface.md` (API), SESSION-REPORT.md (simulation data)

---

## 1. Problem Analysis

### 1.1 The core imbalance

Mafia wins **84–96% of games** across all presets. This is not a minor tilt; it is a near-guaranteed Mafia victory. The game is fundamentally broken at the mechanical level.

### 1.2 Why Mafia wins so reliably

| Factor | Town | Mafia |
|--------|------|-------|
| **Nightly kill** | Rare (Jailor: 3 uses, Vet: 3 alerts, Vig: 3 shots, Dep: 1 shot) | Guaranteed every night |
| **Information** | Must deduce roles through discussion | Know each other instantly |
| **Coordination** | Must convince 6+ people to agree | 2–3 people coordinate silently |
| **Defense** | Doctor protects 1 player from 1 Basic attack | Godfather has Basic defense |
| **Death rate** | 3.5–4.9 deaths per game | 0.5–0.7 deaths per game |

The math is brutal: Mafia kills one Town member every night while Town can kill back only a handful of times across the entire game. In a 2–5 day game, Mafia bleeds Town dry before Town can assemble enough information to strike.

### 1.3 The information gap

Town's investigative roles (Sheriff, Tracker, Lookout, Undertaker) each learn one fact per night. But:

- Sheriff cannot find the Godfather (reads INNOCENT)
- Framer can invert Sheriff results
- Janitor can permanently block Undertaker
- Tracker/Lookout only see actions, not roles

Meanwhile, the Mafia has the Consigliere (learns exact roles) and the Godfather (3 free Town bluff roles). The information asymmetry heavily favors Mafia.

### 1.4 The "no kill Night 1" problem

Currently, "No Kill on Night One" is a house rule toggle, not the default. This means:

- Night 1: Mafia kills a Town member with zero information
- Day 1: Town discusses with one fewer member and zero confirmed data
- Night 2: Mafia kills another Town member
- By Day 2, Town has lost 2 members and has almost no leads

This starting position is nearly unwinnable for Town.

---

## 2. Proposed Changes

### Change 1: Make "No Kill Night 1" the default rule

**What:** Remove the house rule toggle. Night 1 kills are always void.

**Why:** This gives Town one full day of discussion before any deaths. Players can claim roles, the Sheriff gets one check, and the Jailor can jail + read a will. This single change adds a crucial "setup day" where Town can build information.

**Implementation:**
- `docs/GDD.md`: Remove "No Kill on Night One" from Section 10 (House Rule Toggles). Add a new rule in Section 5: "On Night 1, all kills are void: Mafia kill, SK kill, Jailor execution, Veteran alert. Non-kill actions resolve normally."
- `js/engine/05-night-resolution.js`: Add `state.night === 1` check to kill resolution
- `js/engine/10-victory.js`: No change needed (victory checks run after kills, which are void)
- Tests: Add test cases for Night 1 kill voiding

**Risk:** LOW. This is the single most impactful change with the least controversy. Every social deduction game benefits from a "setup day."

---

### Change 2: Remove the Jailor execution cap

**What:** The Jailor may execute every night (except Night 1, which is already voided by Change 1). Remove the "maximum of three executions per game" limit.

**Why:** The 3-execution cap is a legacy from Town of Salem where the Jailor is the strongest Town role. In ToV, the Jailor is the Town's primary kill threat. Capping it at 3 in a game lasting 2–5 days means the Jailor can execute on at most 3 of those nights. Removing the cap lets the Jailor be a consistent nightly threat, which Town desperately needs.

**The Jailor already has natural limitations:**
- Cannot execute on Night 1 (now voided by Change 1)
- Cannot jail the same player two consecutive nights
- Must choose between jailing a suspect (for information) and executing (for kills)
- The Mafia can roleblock the Jailor (Escort/Consort)
- The Witch can redirect the Jailor's jail target
- The Veteran can kill the Jailor if the Jailor jails an alerted Veteran

**Implementation:**
- `docs/GDD.md`: Remove "The Jailor has a maximum of three executions per game" from Section 2.1 and Section 5.1
- `js/engine/05-night-resolution.js`: Remove the `jailorExecutions` counter check
- `js/engine/00-namespace.js`: Remove `jailorMaxExecutions` constant
- Tests: Update all Jailor tests that reference the execution cap

**Risk:** MEDIUM. The Jailor becomes significantly stronger. However, the Mafia has multiple counters (roleblock, Witch redirect, Veteran trap), and the Jailor must still choose wisely each night. The social deduction element — players must figure out who is worth executing — remains the core gameplay.

---

### Change 3: Adjust the ratio table

**What:** Give Town one additional member at every player count from 8–15.

**Current table:**

| Players | Town | Mafia | Neutral |
|---------|------|-------|---------|
| 8 | 5 | 2 | 1 |
| 9 | 6 | 2 | 1 |
| 10 | 6 | 3 | 1 |
| 11 | 7 | 3 | 1 |
| 12 | 7 | 3 | 2 |
| 13 | 8 | 3 | 2 |
| 14 | 9 | 4 | 1 |
| 15 | 9 | 4 | 2 |

**Proposed table:**

| Players | Town | Mafia | Neutral |
|---------|------|-------|---------|
| 8 | 5 | 2 | 1 |
| 9 | 6 | 2 | 1 |
| 10 | 7 | 2 | 1 |
| 11 | 8 | 2 | 1 |
| 12 | 8 | 3 | 1 |
| 13 | 9 | 3 | 1 |
| 14 | 9 | 3 | 2 |
| 15 | 10 | 3 | 2 |

**Key changes:**
- 10 players: 7/2/1 (was 6/3/1) — reducing Mafia from 3 to 2 at 10 players
- 11 players: 8/2/1 (was 7/3/1) — reducing Mafia from 3 to 2 at 11 players
- 12 players: 8/3/1 (was 7/3/2) — reducing Neutral from 2 to 1
- 13 players: 9/3/1 (was 8/3/2) — reducing Neutral from 2 to 1
- 14 players: 9/3/2 (was 9/4/1) — reducing Mafia from 4 to 3
- 15 players: 10/3/2 (was 9/4/2) — reducing Mafia from 4 to 3

**Why:** The current ratio gives Mafia too many members relative to Town. At 11 players, 3 Mafia means Mafia needs to kill only 4 Town members to reach parity (7 Town → 3 Mafia wins when 4 Town die). With 2 Mafia, Town has more breathing room.

**Implementation:**
- `docs/GDD.md`: Update Section 3 (Alignment Ratio Table)
- `js/engine/02-deck.js`: Update the ratio lookup table
- Tests: Update all ratio table tests

**Risk:** MEDIUM. Fewer Mafia means Mafia must be more careful with kills and more aggressive with social manipulation. This is actually *better* for social deduction — Mafia players have to work harder to blend in.

---

### Change 4: Doctor protection blocks ALL Basic attacks in one night

**What:** The Doctor's protection blocks every Basic attack against the protected player that night, not just the first.

**Why:** Currently, if Mafia and SK both target the same player, the Doctor's protection blocks only the first attack. This is overly punishing for the Doctor and makes protection feel unreliable. In a game where Town is already at a severe disadvantage, the Doctor should be a reliable defensive tool.

**Implementation:**
- `docs/GDD.md`: Update Section 2.1 (Doctor) and Section 5.2 (Doctor protection)
- `js/engine/05-night-resolution.js`: Change the protection logic to block all Basic attacks, not just the first
- Tests: Update Doctor protection tests

**Risk:** LOW. The Doctor already protects one player. Making that protection more reliable is a small buff that helps Town survive longer. Mafia still has Unstoppable kills (Jailor execute, Veteran alert) and roleblocks to counter the Doctor.

---

### Change 5: Guarantee one Town protective role in every preset

**What:** Every preset must include at least one Town protective role (Doctor) in the Town priority list.

**Why:** Some presets might not include a Doctor if the priority list runs out of Town slots before reaching the Doctor. This means some games have NO Town protection at all, which is catastrophic for balance.

**Current presets that lack a guaranteed Doctor:**
- Preset 6 "The Clock Strikes Thirteen": priority is Jailor, Vigilante, Veteran, Deputy, Doctor, Escort — Doctor is 5th, so it appears only when there are enough Town slots

**Implementation:**
- `docs/GDD.md`: Add a rule in Section 4: "Every preset must include at least one Town protective role in the Town priority list. If the preset's priority list does not include a protective role, append Doctor immediately after the last listed role."
- Verify all 6 presets include Doctor in their Town priority

**Risk:** LOW. This is a structural guarantee that prevents degenerate game states.

---

### Change 6: Mafia kill should be slightly weaker — add a "Mafia kill failure" chance

**What:** When the Mafia makes their kill pick, there is a 20% chance the kill fails silently (the target survives, Mafia is not notified of the failure).

**Why:** A guaranteed nightly kill is too strong. Adding a small failure chance creates variance that helps Town survive longer on average. The Mafia still kills most nights, but occasionally gets unlucky.

**Implementation:**
- `docs/GDD.md`: Add a rule in Section 5.4: "The Mafia kill has a 20% chance of failure each night. On failure, the target survives and the Mafia is not notified. The kill leader still chooses a target; the failure is silent."
- `js/engine/05-night-resolution.js`: Add a random failure check in the Mafia kill resolution
- Tests: Add tests for Mafia kill failure

**Risk:** HIGH. This is the most controversial change. Random failure can feel unfair to Mafia players. However, it creates dramatic moments ("I swear I killed them!") and gives Town a small mechanical advantage. The 20% rate means Mafia kills ~4 out of 5 nights, which is still strong.

**Alternative:** Instead of random failure, make the Mafia kill require both the Godfather AND Mafioso to be alive and unblocked. If either is dead or roleblocked, the kill fails. This is a deterministic mechanic that rewards Town for eliminating Mafia members.

---

## 3. Expected Impact

### 3.1 Win rate projection

| Change | Mafia win rate (estimated) | Town win rate (estimated) |
|--------|---------------------------|--------------------------|
| Current state | 84–96% | 4–16% |
| + Change 1 (No Kill N1) | 70–80% | 20–30% |
| + Change 2 (Remove Jailor cap) | 55–70% | 30–45% |
| + Change 3 (Ratio adjustment) | 45–60% | 40–55% |
| + Change 4 (Doctor buff) | 40–55% | 45–55% |
| + Change 5 (Guaranteed Doctor) | 40–55% | 45–55% |
| + Change 6 (Mafia kill failure) | 35–50% | 50–65% |

**Target balance:** 40–50% Mafia, 40–50% Town, 5–15% Neutral (per SESSION-REPORT.md).

### 3.2 Game length

With these changes, games should last **4–7 days** instead of 2–5. This is ideal for a social deduction game — enough time for information to develop, but not so long that the game drags.

### 3.3 Social deduction impact

The changes shift the game from "Mafia kills Town fast" to "Town and Mafia maneuver for information and position." This is exactly what makes social deduction games fun:

- Town has time to investigate, discuss, and build cases
- Mafia must be more careful with kills (can't just eliminate threats randomly)
- The Jailor becomes a high-value target for Mafia (must decide: kill the Jailor or let them execute?)
- The Doctor becomes a priority保护 target
- Players have more meaningful decisions each night and day

---

## 4. Risk Assessment

### 4.1 Implementation risk

| Change | Complexity | Files affected | Test impact |
|--------|------------|----------------|-------------|
| Change 1 | LOW | GDD, 05-night-resolution.js | Add 2–3 tests |
| Change 2 | LOW | GDD, 05-night-resolution.js, 00-namespace.js | Update 5–10 tests |
| Change 3 | LOW | GDD, 02-deck.js | Update ratio table tests |
| Change 4 | LOW | GDD, 05-night-resolution.js | Update 2–3 tests |
| Change 5 | LOW | GDD | Verify presets |
| Change 6 | MEDIUM | GDD, 05-night-resolution.js | Add 3–5 tests |

**Total estimated effort:** 2–3 hours for a developer familiar with the codebase.

### 4.2 Gameplay risk

| Change | Risk level | Mitigation |
|--------|------------|------------|
| Change 1 | LOW | Standard in social deduction games |
| Change 2 | MEDIUM | Jailor is strong but has multiple counters |
| Change 3 | MEDIUM | Test with different presets and player counts |
| Change 4 | LOW | Doctor is already limited to one player |
| Change 5 | LOW | Structural guarantee, no gameplay change |
| Change 6 | HIGH | Consider the alternative (deterministic failure) |

### 4.3 Social risk

The biggest risk is **overcorrecting** and making Town too strong. If Town wins 80% of games, Mafia players will feel powerless and stop enjoying the game.

**Mitigation:** Implement changes incrementally:
1. First: Changes 1 + 2 + 3 + 4 + 5 (all low/medium risk)
2. Playtest 10–20 games
3. If Mafia is still too weak: add Change 6 (high risk)
4. If Town is now too strong: revert Change 3 or adjust ratios

---

## 5. Implementation Order

1. **Phase 1 (immediate):** Changes 1 + 2 + 4 + 5
   - No Kill Night 1 (default)
   - Remove Jailor execution cap
   - Doctor blocks all Basic attacks
   - Guaranteed Doctor in every preset

2. **Phase 2 (after playtesting):** Change 3
   - Adjust ratio table
   - Requires updating deck generation logic

3. **Phase 3 (if needed):** Change 6
   - Mafia kill failure chance
   - Only if Phase 1 + 2 don't achieve balance

---

## 6. Open Questions

1. **Should the SK kill also be voided on Night 1?** Currently, the SK is a Neutral role that kills nightly. Voiding their Night 1 kill makes sense for consistency, but the SK is already a弱势 role.

2. **Should the Veteran's alert be voided on Night 1?** The Veteran's alert is defensive (they can't be killed) + offensive (visitors die). Voiding the kill part but keeping the defense part seems right.

3. **Should the Mafia kill require both GF and Mafioso to be alive?** This is the alternative to Change 6 — a deterministic mechanic instead of random failure.

4. **Should we add a new Town protective role (Bodyguard)?** A Bodyguard that dies if their target is attacked would add another layer of defense, but also another Town killing role to balance.

5. **Should the ratio table change based on preset?** Different presets have different role compositions. Maybe some presets need different ratios?

---

## 7. Next Steps

1. **Discuss this proposal** with the playtesting group
2. **Implement Phase 1 changes** (Changes 1 + 2 + 4 + 5)
3. **Run 20 simulation games** with the new rules
4. **Adjust Phase 2** based on simulation results
5. **Playtest in person** with the full group
6. **Iterate** based on feedback

---

*This document is a proposal, not a final decision. All changes must be discussed and approved before implementation.*
