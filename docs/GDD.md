# Town of VibeLem

## Game Design Document (Authoritative)

**Version 1.0**

This document is the single source of truth for the rules of Town of VibeLem, a hybrid social deduction game played in person by a group of friends with one human moderator assisted by a web app. All resolution rules in this document are unambiguous and internally consistent.

**Table of contents**

1. [Game Overview and Philosophy](#1-game-overview-and-philosophy)
2. [Role Catalog — see ROLES_REVISITED.md](./ROLES_REVISITED.md)
3. [Alignment Ratio Table (6 to 15 Players)](#3-alignment-ratio-table-6-to-15-players)
4. [Scenario Presets](#4-scenario-presets)
5. [Night Resolution Engine](#5-night-resolution-engine)
6. [Drunk Status Engine](#6-drunk-status-engine)
7. [Death and Mystery Deaths](#7-death-and-mystery-deaths)
8. [Ghost Rules](#8-ghost-rules)
9. [Victory Conditions](#9-victory-conditions)
10. [House Rule Toggles](#10-house-rule-toggles)
11. [End of Game Flow](#11-end-of-game-flow)
12. [Moderator Flow](#12-moderator-flow)

---

## 1. Game Overview and Philosophy

### 1.1 The hybrid premise

Town of VibeLem layers the social engagement engine of *Blood on the Clocktower* on top of the mechanical engine of *Town of Salem*:

- **The Town of Salem layer** supplies the sharp, fair, mechanical spine: a fixed role catalog with exact night and day abilities, a mathematically balanced alignment ratio for every player count, a fixed nightly action order, and exact, countable victory conditions.
- **The Blood on the Clocktower layer** supplies the soul: players sit around one table, talk openly, and argue; hidden information is relayed by the moderator with tokens or other silent signals; the dead become ghosts who haunt the living; deaths are announced as mysteries; and a human moderator runs the show with a scripted night wizard.

### 1.2 Who runs the game

- **One human moderator** runs the entire game. The moderator reads the night wizard aloud, wakes players, records their gestures, enforces table protocol, and announces the day's events.
- **The assistant app** is a single-page web application used only by the moderator. It handles every piece of bookkeeping: alignment ratio lookup, deck generation, role dealing, target recording, night resolution, morning announcements, vote counting, victory detection, and the end-of-game reveal. The app never plays the game; it is a tool.
- Players never touch the app. They sit at the table, close their eyes at night, and respond to the moderator with points, nods, and whispered answers.

### 1.3 The core loop

Every game day is one cycle of four phases:

1. **Night**: everyone closes their eyes; the moderator walks the night wizard; players act by gesture; the app records and resolves all actions.
2. **Morning**: the dead are announced with their last wills read from the players' cards, their true roles unknown (mystery deaths).
3. **Day**: open discussion, day abilities, trials, voting, and at most one lynch.
4. **Night** begins again, and the cycle repeats until a victory condition triggers.

### 1.4 Design intent

- **Fairness by construction**: every role has an exact, bounded ability; every night resolves in a fixed order; victory is decided by counting alignments, never by moderator fiat.
- **Social engagement by design**: roles are hidden, deaths are mysteries, ghosts keep whispering, and the moderator narrates. Information is scarce, so conversation is everything.
- **Low friction**: no screens in players' hands, no hidden ballots except where the rules say so, one moderator, one app, one table.
- **Guiding invariant**: no role appears twice in a single game. Every role in the deck is unique.

---

## 2. Role Catalog

The role catalog is the authoritative source for role names, categories, and abilities, and lives in **[`ROLES_REVISITED.md`](./ROLES_REVISITED.md)**. This document describes the mechanical systems (night resolution, victory, ghosts, house rules) that act on those roles; for any role-specific rule, defer to `ROLES_REVISITED.md`.

General rules that apply to every role:

- No player may target themselves unless the ability is explicitly self-directed (Doctor may protect themselves; the Veteran's alert and the Mayor's reveal are self-declarations; the Mafia kill is a single pick by the kill leader and may target any other player, including fellow Mafia members, but never the leader themselves).
- Dead players (ghosts) cannot be targeted by night actions except by corpse-targeting abilities (Undertaker, Janitor, Retributionist, Amnesiac).
- A roleblocked player's night action fails. A Drunk player's ability behaves per Section 6.

### 2.1 Town roles

| Role | Category | Ability |
|---|---|---|
| **Jailor** | Town Killing | Each night, choose a living player to jail. The jailed player is roleblocked for the night, the Jailor reads the jailed player's last will from their card, then the Jailor chooses EXECUTE (thumbs down) or SPARE (thumbs up). Execution is an Unstoppable kill. Subject to the **No Jailor Execution on Night One** house rule, the Jailor cannot execute on Night 1, but jailing and reading the will still work; when the rule is off, execution is allowed every night. The Jailor cannot jail the same player on two consecutive nights. |
| **Undertaker** | Town Investigative | Each night, choose one corpse; the moderator privately reveals its true role to you (shown on the app). Cannot inspect a corpse cleaned by the Janitor. |
| **Medium** | Town Support | Alive: each night, during the Medium and Ghosts step, read the Ghost Ledger for 30 seconds. Dead: each night, during the Medium and Ghosts step, whisper with one living player of your choice for 60 seconds. |
| **Doctor** | Town Protective | Each night, choose a living player (including yourself) to protect. Protection blocks all Basic attacks against them that night. Fails if the Doctor is Drunk or roleblocked. |
| **Sheriff** | Town Investigative | Each night, choose a living player and learn INNOCENT or SUSPICIOUS. Matches `_sheriffSuspicious` (js/engine/07-night-resolution.js): SUSPICIOUS is the Serial Killer, the Imp, the Possessed, the Succubus, the Necromant, the Outcast, and Mafia-aligned players except Godfather-likes (the Godfather, a Mafioso promoted to Godfather, and a Godfather-remembering Amnesiac always read INNOCENT). The Demon always reads INNOCENT. A framed player's base result is SUSPICIOUS. Everyone else reads INNOCENT. The result inverts if the Sheriff is Drunk. |
| **Deputy** | Town Killing | Once per game, during the day, publicly shoot one living player; they die immediately. If the victim was Town-aligned, the Deputy dies of guilt at the start of the following night. Inheritance: when the Sheriff dies while the Deputy is alive, the Deputy permanently inherits the Sheriff's badge and gains the nightly Sheriff check (in addition to the day shot, if unused). |
| **Tracker** | Town Investigative | Each night, choose a living player and learn which player, if any, they targeted with a night action that night. If they targeted no one, the Tracker learns "no one". |
| **Lookout** | Town Investigative | Each night, choose a living player and learn which players targeted them with a night action that night. If nobody visited them, the Lookout learns "no one". |
| **Witness** | Town Investigative | Each night, choose **two living players** and learn whether they share an alignment: "Both Town", "Both Mafia", "Both Neutral", or "Different alignments". The comparison uses threat-membership triage (`_witnessTeam` in js/engine/06b-night-actions.js): Town-team roles count as Town, Mafia-team roles count as Mafia, and the Serial Killer also counts as Mafia. Every other role lands in the Neutral bucket, including the Evil-team roles (Demon, Imp, Succubus, Necromant, Possessed), the Witch (regardless of her declared side), and the Neutrals (Spy, Jester, Executioner, Survivor, Leper, Outcast, The Drunk, Amnesiac). Dead players can still be compared: the check reads their last assigned role, so a corpse's alignment is the alignment they held at death. The result inverts if the Witness is Drunk (Section 6.1). The Witch may control the Witness: only the first pick is redirected, the second pick stays, and the Witness learns the pair (redirected target, second pick). |
| **Oracle** | Town Investigative | Each night, choose a living player: learn whether they are **TOWN** or **NOT TOWN** (the alignment of their team: Town vs non-Town). The result inverts if the Oracle is Drunk. The Witch may control the pick: the read is redirected to the Witch's chosen target. |
| **Washerwoman** | Town Support | **Start-knowing, no night action.** You start knowing that one of two specified players is a particular Townsfolk role. At deal time the app computes a pair of players and a named (non-Civilian) Town role in the deck that one of them holds, and relays the claim privately during the prep phase (Night Zero); the claim is written to the Washerwoman's player log as an info entry at SETUP. The Washerwoman never wakes at night. If the deck holds no named Town role besides the Washerwoman's own, the app still relays a claim (the Blood on the Clocktower misregistration fallback): it picks the first player among the named Town players when any exist (otherwise two random players) and claims a named Town role present in the deck, preferring one the first player does not hold; if no such role exists the claim defaults to a Civilian. The claim always sounds like a plausible townsfolk claim and never names a Mafia or Neutral role as the claimed role. The claim is a snapshot of the deal: it never changes when roles are swapped, and it is recomputed only when the roles are dealt again (Section 4.1). |
| **Chef** | Town Support | **Start-knowing, no night action.** You start knowing how many pairs of adjacent evil players there are in the seat circle. At deal time the app counts the adjacent seat pairs (seat i and seat i+1, including the wrap-around seat n and seat 1) in which **both** players are evil, and relays the count privately during the prep phase (Night Zero); the count is written to the Chef's player log as an info entry at SETUP. **Evil** is the Mafia-aligned bucket (js/engine/04b-start-knowing.js, including a Witch who sides with Mafia and an Amnesiac who remembered a Mafia role) plus the Serial Killer; the Demon, the Imp, and the other Evil-team roles are not counted. The Chef never wakes at night. The count is a snapshot of the deal: it never changes when roles are swapped, and it is recomputed only when the roles are dealt again (Section 4.1). |
| **Escort** | Town Support | Each night, choose a living player to roleblock: their night action fails that night. |
| **Retributionist** | Town Support | Once per game, at night, choose a dead player to revive. The revived player returns to life at the next morning with their role, abilities, and vote intact, and the revival is announced publicly. Cleaned corpses may be revived. See Section 8 for the ghost vote token. |
| **Veteran** | Town Killing | Up to three times per game, at the start of a night, declare ALERT. While alert, every player who visits the Veteran with a night action dies (Unstoppable) and their action is void, and the Veteran cannot be killed that night. The alert cannot be roleblocked and is not corrupted by drunkenness. |
| **Vigilante** | Town Killing | Up to three times per game, during the day, secretly choose one living player to shoot; the moderator announces the death publicly without revealing the shooter. If the victim was Town-aligned, the Vigilante dies of guilt at the start of the following night. |
| **Mayor** | Town Support | Once per game, during the day, publicly reveal. From then on, each of the Mayor's votes counts as 3 votes in every trial (while the Mayor is alive; a dead Mayor's ghost-token vote in the verdict stage weighs 1, not 3). |
| **Innkeeper** | Town Protective | Each night, choose a living player to share a drink with. Both the Innkeeper and the guest gain Basic defense for the night; the guest is also roleblocked. Fails entirely if the Innkeeper is Drunk or roleblocked. Targeting a killer (Mafioso, Serial Killer, Imp, Demon) blocks their attack for the night. Does not block Unstoppable attacks. |
| **Civilian** | Town Support | No ability. Votes and speaks normally. |

### 2.2 Mafia roles

| Role | Category | Ability |
|---|---|---|
| **Godfather** | Mafia Killing | Leads the Mafia kill and chooses the night's target. Night immune: Basic defense blocks Basic attacks. Reads INNOCENT to the Sheriff. If the Mafioso is dead, performs the kill alone. If roleblocked, the Mafioso performs the kill. The Mafia kill may target any living player other than the kill leader, including fellow Mafia members. At setup, the Godfather is privately given three Town bluff roles, chosen from Town roles that are NOT in the current game deck, and may claim any of them during the game; the app shows the bluffs to the moderator at setup so the moderator can whisper them to the Godfather. |
| **Mafioso** | Mafia Killing | Carries out the Mafia kill at the Godfather's chosen target. If the Godfather is dead or roleblocked, performs the kill alone. When the Godfather dies, the Mafioso becomes the new Godfather: night immune and reads INNOCENT to the Sheriff. |
| **Janitor** | Mafia Deception | Each night, choose one corpse to clean. A cleaned corpse's true role can never be learned by the Undertaker (and in Classic Reveal Mode its role stays hidden on the morning announcement). Fails if the Janitor is Drunk or roleblocked. |
| **Consigliere** | Mafia Support | Each night, choose a living player and learn their exact role. If Drunk, receives a false role (selected at random from roles of a different alignment). |
| **Consort** | Mafia Support | Each night, choose a living player to roleblock: their night action fails that night. |
| **Poisoner** | Mafia Deception | Each night, choose a living player to poison: the target is Drunk for one cycle (Section 6). |
| **Blackmailer** | Mafia Deception | Each night, choose one living player to blackmail. That player cannot speak during the next day: no table talk, no trial defense. They may still vote by hand gesture and may still use gesture-based day abilities. A player cannot be blackmailed on consecutive nights. |
| **Framer** | Mafia Deception | Each night, choose one living player to frame. A framed player reads SUSPICIOUS to the Sheriff or the inherited Deputy for that night. The frame sets the base result to SUSPICIOUS; a Drunk Sheriff then inverts that result (Section 6). |
| **Forger** | Mafia Deception | Each night, choose one player and forge a false last will for them. If that player dies before the next morning, the moderator reads the forged will from the player's card instead of their true will. |

### 2.3 Neutral roles

| Role | Category | Ability |
|---|---|---|
| **Serial Killer** | Neutral Killing | Each night, choose a living player to kill (Basic attack). Night immune: Basic defense blocks Basic attacks. Reads SUSPICIOUS to the Sheriff. Wins when last standing or holding majority (Section 9). |
| **Survivor** | Neutral Benign | No ability. Wins if alive at game end. |
| **Spy** | Neutral Benign | Each night, choose a living player and learn the team (Town / Mafia / Neutral / Evil) of every player who visited them that night; if nobody visited them, you learn "no one". If the Spy is Drunk, the learned teams are random. Wins if alive at game end (shares the win with whoever triggered the end). |
| **Leper** | Neutral Benign | No ability. Any player who visits you with a night action becomes Drunk for the following night (one cycle, Section 6). Wins if alive at game end (shares the win with whoever triggered the end). |
| **Outcast** | Neutral Benign | No ability. Reads SUSPICIOUS to the Sheriff (per `_sheriffSuspicious`) and NOT TOWN to the Oracle; for the Witness it lands in the Neutral triage bucket, and a Drunk Consigliere inspecting it is offered a false role from a different-alignment pool (Town, Mafia, or Evil). Wins if alive at game end (shares the win with whoever triggered the end). |
| **Jester** | Neutral Evil | No ability. Wins immediately when lynched: the Jester wins their personal victory on the spot, but the game continues for everyone else. The Jester becomes a taunting ghost: a ghost that may speak to and mock living players at any time, an exception to the normal ghost rules (Section 8), and receives no ghost vote token (Section 8.4) because they have already won. Haunt: at the start of the night following the lynch, the Jester ghost may choose one player who voted Guilty in the lynch trial; that player dies by an Unstoppable attack at the start of that night, and the death is announced at the next morning as haunted by the Jester. The haunt fires only if the game continues to the next night. |
| **Witch** | Neutral Evil | Each night, after the Poisoner, choose a living player to control and a redirect target: the controlled player's targeting night action is redirected to that target. May control any living player except a player who is currently jailed (the jail voids the control). On a successful control, the Witch learns the exact role of the controlled player. Controlling the Godfather redirects the Mafia kill target to her chosen target, and the Mafia kill still resolves per the Mafia kill rules (Section 5.4). Controlling the Serial Killer or the Demon redirects their kill. Controlling the Jailor redirects only the jail target; the EXECUTE or SPARE decision stays with the Jailor. Controlling the Witness redirects only its first pick. A control has no effect on a role without a redirectable targeting action (the Poisoner has already acted; role-blockers, revivers, and the Medium do not consume it), but the role is still revealed. Victory: `witchSide` is editable pre-game (seats screen, Night Zero checklist), default MAFIA — the Witch counts as Mafia-aligned and wins when Mafia wins, or as Town-aligned winning with Town if declared (Section 9). |
| **The Drunk** | Neutral Benign | No ability. Permanently Drunk: all abilities are disabled (Section 6). Wins if alive at game end. |
| **Amnesiac** | Neutral Benign | Once per game, at night, choose a dead player and remember their role: the Amnesiac permanently becomes that role, gaining its abilities, alignment, and win condition. Until then, no ability. If the game ends before remembering, wins if alive at game end. |
| **Executioner** | Neutral Evil | No ability. At setup, the app assigns a Town-aligned target, revealed privately to the Executioner. Wins when that target is lynched by the town, whether the Executioner is alive or dead. If the target dies by any other means (a night kill, a day kill, a haunt, or any death other than a town lynch), the Executioner becomes a Jester and their win condition becomes the Jester's win condition (win when lynched). |

### 2.4 Evil roles

The Evil team (`team: 'EVIL'` in the engine) counts toward the Evil-side total in the one-versus-one settlement and in the Demon's own majority rule (Section 9.3). Evil roles are not part of the Mafia faction.

| Role | Category | Ability |
|---|---|---|
| **Demon** | Evil Killing | Each night, choose a living player to kill (Basic attack; redirected if the Witch controls the Demon). Night immune: Basic defense blocks Basic attacks. Reads INNOCENT to the Sheriff. Wins when the Demon is the only living player or holds its own majority (Section 9.3). |
| **Serial Killer** | Neutral Killing | Each night, choose a living player to kill (Basic attack; failed if roleblocked; redirected if controlled by the Witch). Night immune: Basic defense blocks Basic attacks. Reads SUSPICIOUS to the Sheriff. Wins when the SK is the only living player or exactly one other player remains (Section 9.3). |
| **Imp** | Evil Support | Successor only: no night action while a Demon is alive. When the Demon dies (any cause), the Imp becomes the new Demon: gains Basic defense, reads INNOCENT to the Sheriff, and performs the nightly kill at the position-9 step. The Imp is Evil-aligned for team counts and win conditions. If the Demon dies with no Imp in the game, no succession. |
| **Succubus** | Evil Support | Each night, choose a living player to enchant. That player cannot vote Guilty against the Succubus during any trial the following day (flags clear when the next night begins). If the Succubus is not on trial, the enchantment has no day effect. Evil-aligned for team counts and win conditions. |
| **Necromant** | Evil Support | Once per game, at night, choose a corpse plus a living target and use the corpse's night ability on that target (see the borrowable-list and refusal rules in ROLES_REVISITED.md; the power resolves through the corpse role's own resolver). Evil-aligned for team counts and win conditions. |
| **Possessed** | Evil Support | Townsfolk disguise: no wake at night, no active ability. Reads SUSPICIOUS to the Sheriff and NOT TOWN to the Oracle; for the Witness the Possessed lands in the Neutral triage bucket. The role name stays hidden until the end-of-game reveal. Evil-aligned for team counts and win conditions. |

---

## 3. Alignment Ratio Table (6 to 15 Players)

Active players only (the moderator is excluded). For every row, Town + Mafia + Neutral = player count.

| Players | Town | Mafia | Neutral |
|---|---|---|---|
| 6 | 4 | 2 | 0 |
| 7 | 5 | 2 | 0 |
| 8 | 5 | 2 | 1 |
| 9 | 6 | 2 | 1 |
| 10 | 6 | 3 | 1 |
| 11 | 7 | 3 | 1 |
| 12 | 7 | 3 | 2 |
| 13 | 8 | 3 | 2 |
| 14 | 9 | 4 | 1 |
| 15 | 9 | 4 | 2 |

Equivalent rules:

- 6 and 7 players: Town = N - 2, Mafia = 2, Neutral = 0.
- 8 and 9 players: Town = N - 3, Mafia = 2, Neutral = 1.
- 10 and 11 players: Town = N - 4, Mafia = 3, Neutral = 1.
- 12 and 13 players: Town = N - 5, Mafia = 3, Neutral = 2.
- 14 players: Town = 9, Mafia = 4, Neutral = 1.
- 15 players: Town = 9, Mafia = 4, Neutral = 2.

### 3.1 Balance Data Snapshot

Simulation data recorded 2026-08-23 from two sources: neural network self-play agents trained per player count (`js/sim/training.js`, evaluated with `js/sim/evaluate.js`) and heuristic archetype baselines (`scripts/run-sim-archetypes.js`).

Neural self-play, 40 games per player count:

| Players | Town wins | Mafia wins | Draws |
|---|---|---|---|
| 6 | 2 | 37 | 1 |
| 8 | 3 | 36 | 1 |
| 10 | 4 | 34 | 2 |
| 11 | 3 | 30 | 7 |
| 12 | 5 | 28 | 7 |
| 15 | 12 | 27 | 1 |

Heuristic archetype baselines show the same Mafia dominance pattern, with stale draws clustering at 11-12 players.

Verdicts:

- **Keep the current ratio curve.** Flattening Mafia upward would worsen the already dominant Mafia result.
- **Keep void-the-pick after Mafioso death.**
- **Keep the strict-majority sentence spare bar.**
- **Park for human playtest:** Oracle nerf, Open Graves, Bodyguard placement.

Caveat: both heuristic and neural simulations measure population-level win rates across many games, not single-mechanic effects; they cannot isolate why one rule helps or hurts.

---

## 4. Scenario Presets

### 4.1 How to use a preset

1. Look up the player count in the Ratio Table (Section 3) to get the required number of Town, Mafia, and Neutral slots.
2. Fill each team's slots by drawing down that team's priority list from the chosen preset, top to bottom.
3. If extra Town slots are needed beyond the listed Town roles, fill them with **Civilians**.
4. Every Mafia list contains exactly 4 roles and every Neutral list exactly 3 roles, so no team list ever runs short in the supported 6 to 15 player range.
5. The app shuffles the resulting deck and assigns seat numbers; priority order determines which roles are included, not who sits where.

### 4.2 Preset 1: "Whispers from the Morgue"

The town gathers its information from the dead; the Mafia buries the truth.

- **Town priority**: Jailor, Undertaker, Medium, Doctor, Sheriff, Tracker, Retributionist, Oracle, Witness, Washerwoman, Chef, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Janitor, Consigliere.
- **Neutral priority**: Amnesiac, Jester, Spy.

### 4.3 Preset 2: "The Poisoned Pint"

Sabotage: the Mafia cripples the town's power roles one drink at a time.

- **Town priority**: Jailor, Doctor, Sheriff, Lookout, Escort, Tracker, Oracle, Witness, Washerwoman, Chef, Innkeeper, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Poisoner, Consort.
- **Neutral priority**: The Drunk, Witch, Spy.

### 4.4 Preset 3: "The Gunpowder Plot"

Firepower on both sides: town guns and an unsuppressible night killer.

- **Town priority**: Jailor, Deputy, Veteran, Vigilante, Doctor, Escort, Oracle, Witness, Washerwoman, Chef, Innkeeper, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Consort, Forger.
- **Neutral priority**: Serial Killer, Survivor, Spy.

### 4.5 Preset 4: "The Imposter at the Altar"

A wedding party where the guest of honor (the Mayor) is a target for both the knife and the noose. The Executioner schemes to hang the guest of honor; the town must shield them.

- **Town priority**: Jailor, Mayor, Doctor, Sheriff, Lookout, Tracker, Oracle, Witness, Washerwoman, Chef, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Framer, Consigliere.
- **Neutral priority**: Jester, Executioner, Spy.

### 4.6 Preset 5: "The Widow's Vigil"

Mourning and espionage: the Witch and the Poisoner turn knowledge against the town while the dead keep watching.

- **Town priority**: Jailor, Sheriff, Undertaker, Medium, Doctor, Retributionist, Oracle, Witness, Washerwoman, Chef, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Poisoner, Blackmailer.
- **Neutral priority**: Witch, Survivor, Spy.

### 4.7 Preset 6: "The Clock Strikes Thirteen"

Chaos at midnight: two night killers and heavy town firepower make every night decisive.

- **Town priority**: Jailor, Vigilante, Veteran, Deputy, Doctor, Escort, Oracle, Witness, Washerwoman, Chef, Innkeeper, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Consort, Forger.
- **Neutral priority**: Serial Killer, The Drunk, Spy.

### 4.8 Deck reach

The Oracle is a recurring nightly investigator: every night it reads one living player as TOWN or NOT TOWN, so a deck slot spent on it keeps paying off for the whole game. Each preset therefore places it directly after its core roles so it reaches the biggest preset games: the Oracle enters every 13+ player game, and Presets 2-6 also field it from 11 players. The nightly Witness sits directly behind it: the Witness enters every 14+ player game (Presets 2-6 also from 13 players), giving the biggest games a second pair-comparison investigator. The start-knowing roles (Washerwoman, Chef) sit behind the Witness: the Washerwoman enters Presets 2-6 from 14 players and is override-only in Preset 1, and the Chef is override-only in every preset. The Spy sits third in every Neutral list behind the 2-slot Neutral cap and is override-only in every preset. In short, the priority order is deliberate: the recurring nightly Oracle first, the recurring nightly Witness next, the start-knowing roles last, so the rarest information never rots in an unused deck slot.

| Role | Preset reach |
|---|---|
| Oracle | Every preset from 13 players; Presets 2-6 also from 11 |
| Witness | Every preset from 14 players; Presets 2-6 also from 13 |
| Washerwoman | Presets 2-6 from 14 players; Preset 1 override-only |
| Chef | Override-only in every preset |
| Spy | Override-only in every preset |

### 4.9 Worked example

10 players, Preset 1: the table gives 6 Town, 3 Mafia, 1 Neutral. The deck is Jailor, Undertaker, Medium, Doctor, Sheriff, Tracker (Town); Godfather, Mafioso, Janitor (Mafia); Amnesiac (Neutral). 8 players, Preset 4: 5 Town, 2 Mafia, 1 Neutral: Jailor, Mayor, Doctor, Sheriff, Lookout (Town); Godfather, Mafioso (Mafia); Jester (Neutral).

---

## 5. Night Resolution Engine

### 5.1 The action order

Actions are recorded in the scripted night wizard order (the moderator wakes players exactly in this sequence) and resolve in the same order. Each step is a phase: within a phase the moderator may wake each relevant player one at a time and take their input privately.

| Position | Roles acting | What resolves |
|---|---|---|
| 0 | **Veteran** (pre-night) | Declares ALERT (max 3 per game); while alert, visitors die (Unstoppable) and the Veteran cannot be killed (Section 5.3). |
| 1 | **Poisoner** | Poisons the target: Drunk for one cycle (Section 6). |
| 2 | **Witch** | Chooses a living player to control and a redirect target. Cannot control a player who is currently jailed (the jail voids the control). On a successful control, learns the controlled player's exact role. The controlled player's targeting night action is redirected (a controlled Poisoner has already acted and is unaffected). Controlling the Godfather redirects the Mafia kill target (resolved per 5.4); controlling the Serial Killer or the Demon redirects their kill; controlling the Jailor redirects only the jail target, and the EXECUTE or SPARE decision stays with the Jailor. |
| 3 | **Jailor** | Jails a player: roleblocked, the Jailor reads the jailed player's will from their card, then EXECUTE (Unstoppable kill, resolves immediately) or SPARE. Under the **No Jailor Execution on Night One** house rule, on Night 1 the Jailor jails and reads the will but cannot execute; otherwise the choice is available every night. |
| 4 | **Escort** | Roleblocks the chosen player. |
| 4 | **Consort** | Roleblocks the chosen player. |
| 4 | **Innkeeper** | Shares a drink with the chosen player. Both the Innkeeper and the guest gain Basic defense for the night; the guest is also roleblocked. Fails entirely if the Innkeeper is Drunk or roleblocked. |
| 5 | **Doctor** | Protects the chosen player (fails if Drunk or roleblocked). |
| 6 | **Mafia** | The Mafia makes a single kill pick per night, chosen by the kill leader (the living Godfather, or the living Mafioso if the Godfather is dead); the kill is carried out per 5.4 (redirected if the Godfather is controlled by the Witch). |
| 7 | **Janitor** | Cleans a corpse (fails if Drunk or roleblocked). |
| 7 | **Forger** | Forges a will for one player. |
| 8 | **Blackmailer** | Blackmails the chosen player: cannot speak during the next day (no table talk, no trial defense); may still vote by hand gesture (Section 2.2). |
| 9 | **Demon** | Kills the chosen player (Basic attack; Basic defense applies). If the Demon is dead, the Imp (if alive) becomes the new Demon and performs the kill instead. |
| 9 | **Serial Killer** | Kills the chosen player (Basic attack; fails if roleblocked; redirected if controlled by the Witch). |
| 9 | **Imp** | Successor only: does nothing while the Demon is alive. When the Demon dies, the Imp gains Basic defense and reads INNOCENT to the Sheriff, and from the next night performs the nightly kill. |
| 10 | **Framer** | Frames the chosen player: reads SUSPICIOUS to the Sheriff or inherited Deputy for that night (a Drunk Sheriff then inverts the result). |
| 11 | **Sheriff** | Checks one player: SUSPICIOUS if the Serial Killer, the Imp, the Possessed, the Succubus, the Necromant, the Outcast, or Mafia-aligned (except Godfather-likes, who always read INNOCENT); the Demon reads INNOCENT; a framed player's base result is SUSPICIOUS; inverted if the Sheriff is Drunk. The Deputy with the inherited badge performs this check from the night after the Sheriff dies. |
| 11 | **Tracker** | Follows one player and learns which player, if any, they targeted that night. |
| 11 | **Lookout** | Watches one player and learns which players targeted them that night. |
| 11 | **Witness** | Compares two chosen players and learns whether they share an alignment: "Both Town", "Both Mafia", "Both Neutral", or "Different alignments" (threat-membership triage, Section 2.1). The result inverts if the Witness is Drunk. Dead targets are compared by their last assigned role. |
| 11 | **Consigliere** | Inspects one player and learns their exact role (a false role if Drunk). |
| 11 | **Undertaker** | Inspects one corpse and learns its true role (unaffected by drunkenness; fails on Janitor-cleaned corpses). |
| 11 | **Oracle** | Reads one player: learns TOWN or NOT TOWN (the alignment of their team). Inverted if the Oracle is Drunk. |
| 11 | **Spy** | Watches one player: learns the team (Town / Mafia / Neutral / Evil) of every player who visited them that night (random teams if the Spy is Drunk). |
| 11 | **Succubus** | Enchants the chosen player: that player cannot vote Guilty against the Succubus during any trial the following day. |
| 12 | **Necromant** | Once per game, chooses a corpse plus a living target and uses the corpse's night ability on that target (per the borrowable-list and refusal rules in ROLES_REVISITED.md). |
| 12 | **Retributionist** | Records the corpse to revive (once per game); the revival takes effect at morning. |
| 12 | **Amnesiac** | Once per game, records the corpse whose role is remembered; permanently becomes that role. |
| 13 | **Medium and Ghosts** | Ghosts write in the Ghost Ledger; the alive Medium reads it for 30 seconds; a dead Medium whispers with one living target for 60 seconds (Section 8). |
| 14 | **Morning** | Revivals take effect, deaths are applied in order, and the morning announcement is prepared (Section 7). |

Notes on order:

- The **Veteran's alert** is declared before the night begins (a pre-night step, position 0). It is a defensive state, not an action in the order.
- The **Jester's haunt** also resolves at the start of the night, at the same point as the Veteran's alert: if the Jester was lynched the previous day, the Jester ghost may choose one player who voted Guilty in that lynch trial, and that player dies by an Unstoppable attack (Section 2.3). The haunt fires only if the game continued to this night.
- **Day abilities** (Vigilante shot, Deputy shot, Mayor reveal) are used during the day phase, never at night.
- **No role is Night-1-only**: the Oracle wakes every night at its position-11 step like the other investigators. The start-knowing roles (Washerwoman, Chef) have no step in any night: their information was already relayed at the prep phase.
- Deaths resolve immediately at their position: a player who dies at position 3 is dead for every later step, and their recorded later actions are void.

### 5.2 Attack and defense model

Every kill in the game is one of two attack types; every target has one of two defense states:

| Attack type | Sources | Notes |
|---|---|---|
| **Basic** | Mafia kill, Serial Killer kill, Demon kill | Blocked by Doctor protection and by Basic defense. |
| **Unstoppable** | Jailor execution, Veteran alert, Jester haunt | Ignores Doctor protection and Basic defense. Cannot be healed or blocked. |

| Defense | Holders | Notes |
|---|---|---|
| **None** | Most roles | A Basic attack kills them. |
| **Basic** | Godfather, a Mafioso promoted to Godfather, the Serial Killer, the Demon, and an Imp who has become the new Demon | Blocks Basic attacks. Does not block Unstoppable attacks. |

**Doctor protection**: protects one player from all Basic attacks against them that night. Fails entirely if the Doctor is Drunk or roleblocked. Protection does nothing against Unstoppable attacks.

### 5.3 Who dies when multiple effects target one player

| Situation | Outcome |
|---|---|
| Any Unstoppable kill (Jailor execution, Veteran alert, Jester haunt) | Target dies. Doctor protection and Basic defense do not apply. |
| One Basic kill, no protection, no Basic defense | Target dies. |
| Basic kill vs Basic defense | Target survives. |
| Basic kill vs Doctor protection | Target survives. |
| Two Basic kills in one night, Doctor protection present | Target survives both attacks. |
| Two Basic kills in one night, no protection | Target dies to the first; the second is void. |
| Target is roleblocked and also killed | Roleblock does not save them; they die if the kill lands. |

**Roleblock versus kills** (explicit): roleblocking a player does not prevent them from being killed and does not cancel kills targeting them. It only cancels their own night action.

**Jailor execution versus Basic defense**: the execution is Unstoppable, so the Godfather, the Serial Killer, the Demon, and a promoted Mafioso can be executed despite their immunity. Spared players simply survive the jail.

**Veteran alert** (explicit): while alert, any player whose recorded night action targets the Veteran is a "visitor". Visitors die immediately by Unstoppable attack and their action is void (no protection granted, no roleblock applied, no result received, no kill performed). The Jailor jailing an alerted Veteran is a visit: the Jailor dies and the jail does not resolve. The alert cannot be roleblocked and is not corrupted by drunkenness. The Veteran cannot be killed while alert.

### 5.4 The Mafia kill (Godfather and Mafioso)

- The Mafia night action is a **single kill pick**: one target per night, chosen by the kill leader (the living Godfather, or the living Mafioso when the Godfather is dead or roleblocked).
- The target is chosen by the Godfather; the Mafioso carries the kill out. If the Godfather is dead, the Mafioso chooses the target and carries the kill out alone.
- **If the Mafioso dies, the Godfather performs the kill alone.**
- **If the Godfather is roleblocked, the Mafioso performs the kill.**
- If the Mafioso is roleblocked, the Godfather performs the kill himself.
- If both are roleblocked, or the only living killer is roleblocked, the Mafia kill fails that night.
- When the Godfather dies, the Mafioso becomes the new Godfather: night immune (Basic defense) and reads INNOCENT to the Sheriff.
- The Mafia kill is a Basic attack: it is blocked by Doctor protection and by the target's Basic defense, and it is cancelled if the town kills the only available killer before the Mafia step resolves.
- If the **Witch controls the Godfather**, the kill target becomes the Witch's chosen target; every other Mafia kill rule above still applies (Section 2.3).
- The Mafia kill may target any living player other than the kill leader, including fellow Mafia members (a target redirected by the Witch is subject to the same rule).

### 5.5 Edge cases and exceptional rules

**D. Innkeeper edge cases.**
1. **Combined status**: the chosen guest receives both `ROLEBLOCKED` and `PROTECTED` (Basic defense) at the same time. The Innkeeper themselves also gains `PROTECTED` (Basic defense) for the night — the two are drinking together at the inn. The Innkeeper's own night action is part of position 4 (with Escort and Consort).
2. **Drunk and roleblocked**: the Innkeeper's entire effect fails if the Innkeeper is Drunk or roleblocked — neither character gains protection and the guest is not roleblocked.
3. **Innkeeper vs killer**: targeting a killer (Mafioso, Serial Killer, Imp, Demon) with the Innkeeper blocks the killer's attack for the night (their roleblock cancels their action). Basic defense also applies to the killer for any *other* Basic attack that night.
4. **No protection against Unstoppable**: Unstoppable attacks (Jailor execute, Veteran alert, Jester haunt) ignore Innkeeper protection on both characters.

**E. Tie-breakers and deadlock engine (1v1 cases).**
When exactly two players remain and neither can kill or lynch the other, the game ends in favor of the first matching condition below (this matches the settlement order in `js/engine/10-victory.js`; the full evaluation order is Section 9.3):
1. **Serial Killer + any single other player** → Serial Killer wins (the SK holds its own majority in a one-versus-one, even against a Town player).
2. **Demon + any single other player** → Demon wins (the Demon holds its own majority, even against a Town player).
3. **Mafia-aligned + Town-aligned** → Mafia wins (living Mafia >= living Town; ties favor the Mafia per Section 9.3).
4. **Evil-aligned + Town-aligned, with no Mafia alive** → Evil wins (the last Evil-aligned player outlasts the final Town-aligned player).
5. **All other 1v1s** → no automatic victory; the game continues if possible, otherwise the game is a draw (no winner declared). In particular, a one-versus-one between two Neutrals or between two Evil-aligned players never declares a winner.

These rules are checked at the same three moments as faction victories (after lynch, after morning announcement, after day kill).

**G. Executioner target rule.**
The target assigned to an Executioner at setup **must** be Town-aligned. The app must never assign a Mafia, Neutral, Evil, Witch-on-Mafia, or non-Town target to an Executioner. If the deck holds no eligible Town-aligned target (theoretically impossible given the ratio table, but checked defensively), the Executioner is replaced with a Jester at setup.

**H. Witch control versus the jail (ordering).**
The Witch acts at position 2, but the control is only validated after the Jailor's provisional jail target is fixed at position 3. If the Witch's controlled player is the player the Jailor jails that night, the control is void: the Witch learns no role and nothing is redirected. The jail therefore always wins the ordering fight — a jailed player can never be controlled that night.

**I. Investigators versus a blocked or voided target.**
A Tracker whose followed player's night action failed (roleblocked, Drunk-cancelled, or voided by an alerting Veteran) learns "no one": the effective-target list holds no entry for that player. The same holds for the Lookout's watch and the Spy's watch: a voided action leaves no visit entry behind, so it is never reported as a visitor.

---

## 6. Drunk Status Engine

### 6.1 What "Drunk" is

Drunk is a status effect that corrupts specific abilities. It has exactly three sources and exactly seven effects.

**Sources**

| Source | Duration |
|---|---|
| **Poisoner** | One cycle. A player poisoned on night N is Drunk through night N's resolution and the entire following day, and becomes sober when night N + 1 begins. |
| **The Drunk role** | Permanent. Never expires, can never be removed. |
| **Leper visit** | One cycle, delayed. A player who visited the Leper during night N is Drunk through night N + 1's resolution and the entire following day, and becomes sober when night N + 2 begins (the Leper's visit is detected during night N's resolution, so the effect lands on the *following* night). |

**Effects** (apply only while the affected player is Drunk)

| Drunk player | Effect |
|---|---|
| Sheriff | The check result is inverted: INNOCENT becomes SUSPICIOUS and vice versa. |
| Oracle | The read is inverted: TOWN becomes NOT TOWN and vice versa. |
| Spy | The learned teams are random (one random team per visitor). |
| Consigliere | The learned role is false: a random role of a different alignment is shown instead. |
| Witness | The comparison result inverts: "Both Town" / "Both Mafia" / "Both Neutral" become "Different alignments", and a "Different alignments" result becomes one of "Both Town", "Both Mafia", or "Both Neutral" chosen at random. |
| Janitor | The clean action fails: the corpse is not cleaned. |
| Doctor | The protection fails: the chosen player is not protected. |

No other ability is affected by drunkenness. A Drunk Tracker, Lookout, Escort, Jailor, Poisoner, Witch, Framer, Blackmailer, Undertaker, Medium, Retributionist, Washerwoman, or Chef acts normally; the Doctor and the Innkeeper fail while Drunk per their own ability text above. Drunkenness does not disable voting or speaking.

### 6.2 The Drunk role

A player holding **The Drunk** role is permanently Drunk, which means **all of their abilities are disabled, for the entire game**:

- The Drunk has no night action and no day action.
- The Drunk cannot gain or use any ability from any source, and no rule or ability can restore them.
- The corruption effects above describe what happens when specific roles are Drunk; a Drunk-role player never has those roles' abilities, so nothing to corrupt exists.

**What this means for the game**: The Drunk is a purely social role. They talk, bluff, argue, and vote like anyone else, and their only path to victory is surviving until the game ends (Section 9). Every other player should know that the Drunk has no powers, and the moderator enforces that the Drunk never acts.

---

## 7. Death and Mystery Deaths

### 7.1 Morning announcements (mystery mode)

- The morning announcement lists the dead from the night, in death order. For each victim the moderator announces **their name and reads their last will from the player's card**, and the true role is shown as **"?? UNKNOWN ??"**.
- A player's **last will** is a short written note they keep on their paper card. On death, the moderator reads it exactly as written. The app never records or displays wills.
- The cause of death may be described in flavor ("shot", "found in the night"), but the role is never revealed.
- Deaths are final and public: every player sees who died and what their will says.

### 7.2 Last wills

- Every living player maintains a last will.
- The Jailor reads the jailed player's will from their card during the jail (position 3 of the night order).
- The **Forger** may, each night, choose one player and forge a false last will. If that player dies before the next morning, the moderator reads the forged will from the player's card instead of their true will; the true will is lost. The app only reminds the moderator that a will was forged.

### 7.3 The Undertaker

- Each night, the Undertaker chooses one corpse. The moderator (via the app) privately reveals that corpse's **true role** to the Undertaker. No other player learns it.
- **A corpse cleaned by the Janitor can never be inspected by the Undertaker.** The clean is permanent; the app refuses the inspection.
- The Undertaker may inspect one corpse per night and may not inspect the same corpse twice.

### 7.4 Deputy inheritance

- The Deputy's base ability is a single-use day execution (Section 2.1).
- **When the Sheriff dies while the Deputy is alive, the Deputy permanently inherits the Sheriff's badge.** From the next night, the Deputy performs the Sheriff's nightly check, and is woken in the Sheriff step (position 11).
- The inheritance is checked at the end of every night resolution and after every lynch, and is **announced publicly** at the next morning: "The Deputy has inherited the Sheriff's badge."
- If the Deputy is dead when the Sheriff dies, there is no inheritance.

---

## 8. Ghost Rules

### 8.1 Becoming a ghost

- When a player dies, they become a **ghost**. Their seat tile is tagged [GHOST] (Section 12).
- Ghosts may **whisper among themselves at any time**, during the night and during the day, without restriction.
- Ghosts may **not** speak to living players, and living players may not speak to ghosts, except through the Medium's seance below. **Exception (taunting ghost)**: a Jester who was lynched has already won and becomes a taunting ghost, which may speak to and mock living players at any time (Section 2.3).

### 8.2 The Ghost Ledger

- A **Ghost Ledger** is a shared notebook that stays at the table.
- At night, during the Medium and Ghosts step, all ghosts may write messages in the ledger. Ghosts may read what other ghosts have written at any time.
- Living players may never open the ledger, except the Medium during an alive seance.

### 8.3 The Medium seance

- **Alive Medium**: during the Medium and Ghosts step, the Medium reads the Ghost Ledger for **30 seconds**.
- **Dead Medium**: during the Medium and Ghosts step, the dead Medium is woken together with **one living target of their choice**, and the two whisper together for **60 seconds**. No other player hears them.
- A roleblocked Medium has no seance that night.

### 8.4 Ghost vote tokens

- Each player receives **exactly one ghost vote token**, granted at their first death, and the app tracks it. The Jester receives no ghost vote token: a lynched Jester has already won (Section 2.3).
- During the **vote stage of a day trial**, a ghost may spend their token to cast **one extra vote** (Guilty or Innocent). Ghosts may never second a nomination: they are dead (Section 12.3). The token is spent forever.
- A revived player returns to life and votes normally; they lose their token while alive (spent or unspent). If they die again, they do **not** receive a second token.

---

## 9. Victory Conditions

### 9.1 Alignment counting

Victory is computed from living players only. Each living player belongs to exactly one bucket:

| Bucket | Members |
|---|---|
| **Town-aligned** | All Town roles; an Amnesiac who remembered a Town role; a Witch who declared she sides with Town. |
| **Mafia-aligned** | Godfather; Mafioso; an Amnesiac who remembered a Mafia role; a Witch who sides with Mafia (including a Witch who never declared, since the default is Mafia). |
| **Evil** | Demon; Imp (Evil-aligned even before succession); Succubus; Necromant; Possessed (`team: 'EVIL'`). Evil roles are not part of the Mafia faction; they count toward the one-versus-one Evil settlement and the Demon's own majority rule (Section 9.3). |
| **Serial Killer** | Tracked separately from the buckets: `team: 'NEUTRAL'` in the engine, so it never counts toward the Evil or Mafia totals; it holds its own majority rule and blocks the Town win until it is dead (Section 9.3). |
| **Neutral** | Jester; Executioner; Survivor; The Drunk; Spy; Leper; Outcast; an Amnesiac who has not yet remembered. Neutrals count toward no faction's majority. |

### 9.2 Individual victory conditions

Checked at the moment the triggering event occurs. Whether the game ends depends on the winner (Section 9.5).

| Winner | Condition |
|---|---|
| **Jester** | Wins immediately when lynched, but the game continues for everyone else; the Jester becomes a taunting ghost and may haunt one Guilty voter on the following night (Section 2.3). |
| **Executioner** | Wins when their assigned target is lynched by the town, whether the Executioner is alive or dead. If the target dies by any other means, the Executioner becomes a Jester and their win condition becomes the Jester's win condition (win when lynched). |

### 9.3 Faction victory conditions

Checked (a) immediately after a lynch resolves, (b) immediately after the morning death announcements, and (c) immediately after any day kill (a Vigilante shot or a Deputy shot). `checkVictory` (js/engine/10-victory.js) evaluates the settlement rules below in this exact order; the **first condition that matches ends the game**. `mafia` counts living Mafia-aligned players, `town` living Town-aligned players, `evil` living Evil-aligned players (Succubus, Necromant, Possessed, Imp, and the Demon); living Neutrals count toward none of the three.

|| Condition | Notes |
|---|---|---|
| **No living players** | `living === 0` | No winner is declared (null); the game ends without a declared winner. |
| **Last standing** | Exactly one living player | That player's side wins, checked in this priority: Serial Killer → SERIAL_KILLER; Demon → DEMON; Mafia-aligned → MAFIA; Evil-aligned → EVIL; Town-aligned → TOWN. |
| **Serial Killer majority** | SK alive and `living - 1 <= 1` | The SK wins when it is the only living player or exactly one other player remains — even when that other player is Town-aligned. |
| **Demon majority** | Demon alive and `living - 1 <= 1` | The Demon holds its own majority exactly like the SK: last standing or one-on-one, even against a single Town-aligned player (a living Demon never lets the game settle any other way short of a full 1v1). |
| **Evil versus Town (one-versus-one)** | `living === 2 && evil === 1 && town === 1 && mafia === 0` | The last Evil-aligned player outlasts the final Town-aligned player. |
| **Mafia majority** | `mafia > 0 && mafia >= town` | Compares **Mafia-aligned versus Town-aligned only**: living Neutrals and Evil-aligned players count toward neither side, so they do not dilute the Mafia's majority (e.g. one Mafia member plus any non-Town survivor beats one Town player). Ties favor the Mafia. |
| **No Town remains** | `mafia > 0 && town === 0` | With at least one Mafia-aligned player alive and zero Town-aligned players alive, the Mafia wins regardless of any Neutrals or Evil-aligned survivors. |
| **Town** | `mafia === 0 && !sk && !demon && town > 0` | Every Mafia-aligned player is dead **and** the Serial Killer is dead **and** no living Demon (an Imp turned Demon counts as a Demon) **and** at least one Town-aligned player is alive. A living SK, a living Demon, or a game with zero living Town-aligned players never yields a Town win. |

If none of the settlement branches match, `checkVictory` returns `null` and the game continues — but only until the stale-cycle draw rule (Section 9.6) fires.

### 9.4 Other winners at game end

| Role | Condition |
|---|---|
| **Survivor** | Wins if alive when the game ends (shares the win with whoever triggered the end). |
| **Spy** | Wins if alive when the game ends (shares the win with whoever triggered the end). |
| **Leper** | Wins if alive when the game ends (shares the win with whoever triggered the end). |
| **Outcast** | Wins if alive when the game ends (shares the win with whoever triggered the end). |
| **The Drunk** | Wins if alive when the game ends (shares the win with whoever triggered the end). |
| **Witch** | Wins when the faction she sides with wins: Mafia by default, Town if she declared Town. If she sides with Mafia, she counts as Mafia-aligned; if Town, as Town-aligned. |
| **Amnesiac** | Wins with the team of the remembered role. If the game ends before the Amnesiac remembers, the Amnesiac wins if alive at game end. |
| **Evil roles** | The Succubus, the Necromant, the Possessed, the Imp, and the Demon win when the game settles in an Evil result (last standing or the one-versus-one Evil settlement, Section 9.3). They share no faction with the Mafia and never share a Mafia win. |

### 9.5 Simultaneous victory priority

When two or more conditions would trigger in the same resolution (the same lynch, the same morning announcement, or the same day kill), they are evaluated in this exact order, and the **first condition satisfied wins and ends the game immediately**:

1. **Individual conditions**: Jester, then Executioner. A lynched Jester wins their personal victory on the spot, but the game continues for everyone else and faction checks still run. If the Executioner's condition triggers, the Executioner wins on the spot and the game ends immediately.
2. **Settlement conditions**, in this exact order (mirroring `checkVictory`, Section 9.3): Serial Killer majority, then Demon majority, then the Evil-versus-Town one-versus-one, then the Mafia majority, then "no Town remains", then Town.

Examples:

- SK and one other player remain (say, the Godfather): the SK holds majority and the Mafia holds a tie. The SK is checked first and wins.
- The Demon and one Town player remain: the Demon's own majority is checked before the Mafia and Town branches, so the Demon wins the one-versus-one.
- All Mafia-aligned players are dead but the SK lives: Town's condition is not met; the game continues.
- All Mafia-aligned players and the SK are dead but the Demon (or an Imp turned Demon) lives: Town's condition is still not met until the Demon is dead.
- Mafia count >= Town count and the SK is dead: the Mafia condition is checked before Town and wins.

Living Survivors, The Drunk, the Spy, the Leper, and the Outcast share the win in every case.

### 9.6 Stale cycles and draws

When no faction or individual condition has matched after a full day-night cycle, the engine tracks how stale the game is:

- A **cycle is stale** when the day ended with **no lynch executed** AND the following night caused **zero deaths**.
- Consecutive stale cycles are counted in `state.staleDays`. The counter resets to zero on **any lynch** and on **any night death** (`state.staleNightSeen` records which cycle was last evaluated so each cycle is counted exactly once).
- `state.maxStaleDays` caps the streak; it defaults to **5** (settable at `createGame`, defaulted for old saves by `deserialize`).
- When `staleDays >= maxStaleDays` and no other victory condition matched, `checkVictory` declares `winner: 'DRAW'` and ends the game.

This is checked last, after every settlement branch of Section 9.3 fails: a single surviving Neutral (Survivor, The Drunk, Spy, Leper, Outcast) or an Evil-versus-Neutral standoff therefore resolves as a **draw** instead of returning `null` forever. Survivors share the draw per Section 9.4.

---

## 10. House Rule Toggles

The moderator app offers four toggles, selectable at setup. The default values are: **No Kill on Night One ON**, **No Lynch on Day One ON**, **Classic Reveal Mode OFF**, **No Jailor Execution on Night One OFF**.

| Toggle | Default | Effect |
|---|---|---|
| **No Kill on Night One** | ON | All night kills on night 1 are void: the Mafia kill, the Serial Killer's kill, the Demon's kill, the Jailor's execution, and the Veteran's alert kills resolve to nothing (an alerted Veteran is still safe). Poisoning, roleblocking, blackmailing, framing, protection, investigation, cleaning, forging, controlling, reviving, and the seance resolve normally. Day kills (Vigilante, Deputy) are unaffected. |
| **No Lynch on Day One** | ON | No trial may end in a lynch on day 1. The town may still discuss, nominate, second, and hold informational votes, and day abilities still work. |
| **Classic Reveal Mode** | OFF | Replaces mystery deaths: the morning announcement shows each victim's **true role**; the moderator reads their last will from the player's card. A Janitor-cleaned corpse still shows as unknown and still cannot be inspected by the Undertaker. The Undertaker's private inspection remains available. |
| **No Jailor Execution on Night One** | OFF | Restores the classic Night 1 restriction: the Jailor jails and reads the will on Night 1 but cannot execute. When OFF, the Jailor may execute on Night 1 like any other night. |

---

## 11. End of Game Flow

When a victory condition (Section 9) triggers, the moderator app runs the end-of-game sequence:

1. **Announce the winner(s)** immediately: the winning faction or the winning individual, plus any living Survivors, The Drunk, the Spy, the Leper, and the Outcast who share the win (Section 9.5).
2. **Full reveal**: every player's true role is revealed, living and dead, including cleaned corpses and victims of mystery deaths. The app displays the complete role grid. Mystery deaths and Janitor cleaning are void at this point.
3. **Summary** (optional): the app may show a brief recap of key night actions for the table to review.
4. **The game is over.** The deck is collected and shuffled for the next game.

There is no post-game play: victory ends the game on the spot. The one exception is the Jester's personal victory: a lynched Jester wins immediately, but the game continues for everyone else (Sections 2.3 and 9.5).

---

## 12. Moderator Flow

### 12.1 The app screens

| Screen | Purpose |
|---|---|
| **Setup** | Select player count (6 to 15) and preset (1 to 6); toggle house rules (Section 10). The app shows the computed alignment ratio and a deck preview. |
| **Deck generation** | The app fills team slots from the preset's priority lists (Section 4), appends Civilians to fill Town overflow, ensures no duplicate roles, and shuffles the deck. If the deck contains the Executioner, the app secretly assigns a Town-aligned target. If it contains the Godfather, the app shows the moderator three Town bluff roles, chosen from Town roles NOT in the deck, to whisper to the Godfather at role dealing. If it contains the Witch, her victory side defaults to Mafia (editable before the game starts). |
| **Role dealing** | The moderator deals one role per player in private (face-down cards or a one-at-a-time app reveal). Each player knows only their own role. The moderator records names and seat numbers. The Executioner is told their target privately; the Godfather is whispered their three Town bluff roles; the Witch is asked (in private) whether she sides with Town or stays with Mafia by default. If the deck contains the Washerwoman or the Chef, the moderator relays their start-knowing claim or count privately during the prep phase (Night Zero), from the player's log (Section 2.1). |
| **Night wizard** | The scripted sequence below. The app records every target, resolves the night (Section 5), and prepares the morning announcement. |
| **Seat grid** | One tile per player, showing name and moderator-only role, with status tags: [ALIVE], [GHOST], [DRUNK], [INHERITED <ROLE>], plus [JAILED], [PROTECTED], [POISONED], [ALERT], [REVEALED] (Mayor), [BLACKMAILED], and [ENCHANTED] as applicable. |
| **Day phase** | Morning announcements (deaths, with wills read from the players' cards, revivals, badge inheritance); open discussion; day abilities (Vigilante secret shot, max 3 per game, Deputy public shot, Mayor reveal); trials and voting as described in 12.3; victory checks after the lynch, after any day kill, and after the morning announcements. |
| **End of game** | Full reveal and winner announcement (Section 11). |

### 12.2 Table protocol

- At night, all players close their eyes. When woken, each player **looks only at the moderator** and answers by pointing, nodding, or whispering. Players never look at other players while woken.
- The moderator wakes one player at a time within each step unless the step says otherwise, and stations themselves so that woken players face the moderator, not the table.
- The app displays exactly which players to wake and what to ask, in order.

### 12.3 Day phase and trials

- The day begins with the morning announcement: the moderator announces the dead and reads each victim's last will from their card. Players keep their own last wills privately on paper cards; the app never records or shows them.
- Open discussion follows. Day abilities may be used at any point: the Vigilante signals a secret shot to the moderator (max 3 shots per game); the Deputy's shot is public; the Mayor may reveal. **Victory is checked immediately after any day kill**, such as a Vigilante shot or a Deputy shot.
- **Hidden information is relayed by the moderator with tokens** (or another silent signal): each private result is shown to the moderator in the app, who shows the matching token to the player before they wake at night. Players never whisper during the game; the information is never shown in-game otherwise.
- A **blackmailed player** cannot speak during the day: no table talk, no trial defense. They may still vote by hand gesture and may still use gesture-based day abilities (Section 2.2).
- **Trial (two stages plus a sentence round)**: a living player nominates another living player; trials are allowed from Day 1. The accused may defend (unless blackmailed). **Seconding**: every living player except the accused, including the nominator, is asked whether they agree with the nomination. The nomination proceeds to a vote iff the agree count is a **strict majority of all living players** (agree >= floor(living / 2) + 1: 6 living need 4, 5 living need 3). If the nomination is not accepted, it is cancelled, nobody dies, and the day continues; a new nomination may be made. **Vote**: after a successful seconding, every living player except the accused votes **Guilty**, **Innocent**, or **Abstain** by raised hand or voice; the accused may not vote in their own trial. Ghosts may spend their ghost vote token to add one extra Guilty or Innocent vote in the vote stage (Section 8.4). A revealed Mayor's vote counts as 3.
- **Verdict counting** (the app does this automatically): only **Guilty** and **Innocent** votes count; **Abstain** votes are recorded but ignored (a revealed Mayor's vote still counts as 3, and ghost tokens still apply in the verdict stage only). If Guilty strictly outnumbers Innocent, the accused is declared **guilty** and the trial moves to the sentence stage; there is no immediate lynch. If Innocent equals or outnumbers Guilty, the accused is acquitted and the day continues.
- **Sentence stage** (after a guilty verdict): the accused may give a last speech, then every living player except the accused votes again: **Guilty**, **Innocent**, or **Abstain** (Abstain ignored; ghosts cannot vote in the sentence round). If Innocent (spare) votes reach a **strict majority of living players** (innocent >= floor(living / 2) + 1), the accused is **spared** and the day continues. Otherwise the accused is **lynched** with all the normal consequences: the one-lynch-per-day limit is consumed, the Jester wins and may haunt a Guilty voter, the Executioner wins if the lynched player was its target, and victory checks run (Section 9).
- **Moderator override**: the moderator may always kill any player (Kill Player) or undo any kill, including a lynch (Undo Last Kill), during the day phase.
- **Per-player action log**: the app keeps a per-player log (`state.playerLog`) for the moderator's detail sheet: role assignment and swaps, night actions, status changes (poison, jail, blackmail, inheritance, promotion, haunt, revival), trial nominations, verdicts, and lynches. Every privately relayed information result is logged too, as an `info` entry on the actor: Sheriff checks, Tracker follows, Lookout watches, Witness comparisons, Consigliere inspections, Undertaker corpse inspections, the Witch's learned roles, Spy watchers, and Oracle reads. The Washerwoman's and Chef's start-knowing claims are logged as `info` entries at SETUP on their own players during the prep phase. A result that was voided by a roleblock is logged with "no result (roleblocked)"; a result corrupted by drunkenness is logged with the corrupted wording (Section 6).
- At most **one lynch per day**. After a lynch, or if the town votes to abstain as a whole, or when the moderator calls time, the day ends and night begins. Victory is checked after every lynch, after any day kill, and after the morning death announcements.

### 12.4 The night wizard script

The moderator reads this aloud every night. Bracketed instructions are for the moderator and are handled by the app; the wizard is generated from the living roles, so empty steps are skipped.

**Position 0. Veteran alert** (pre-night): "Veteran, open your eyes. Are you on alert tonight? Signal yes or no." Record the choice (max 3 alerts per game). (If the Jester was lynched yesterday and the game continued, resolve the haunt now: the Jester ghost may point to one player who voted Guilty in that lynch trial; that player dies by an Unstoppable attack at the start of the night.) "Veteran, close your eyes."

**Position 1. Poisoner**: "Everyone, close your eyes. Night falls. Poisoner, open your eyes. Point to your target." (Record target: Drunk for one cycle.) "Poisoner, close your eyes."

**Position 2. Witch**: "Witch, open your eyes. Point to the player you control, then point to your target." (Record; reveal the controlled player's exact role to the Witch. The control fails if the controlled player is currently jailed: if the Jailor later jails the Witch's controlled player, the control is void.) "Witch, close your eyes."

**Position 3. Jailor**: "Jailor, open your eyes. Point to your target." (Record: target roleblocked. The Jailor reads the target's last will from their card.) "Do you EXECUTE, thumbs down, or SPARE, thumbs up?" (Record the choice; execution is Unstoppable. Under the **No Jailor Execution on Night One** house rule, on Night 1 the Jailor only jails and reads the will.) "Jailor, close your eyes."

**Position 4. Escort**: "Escort, open your eyes. Point to your roleblock target." (Record.) "Escort, close your eyes."

**Position 4. Consort**: "Consort, open your eyes. Point to your roleblock target." (Record.) "Consort, close your eyes."

**Position 4. Innkeeper**: "Innkeeper, open your eyes. Point to the player drinking with you tonight." (Record: both gain Basic defense for the night; the guest is also roleblocked. Fails if the Innkeeper is Drunk or roleblocked.) "Innkeeper, close your eyes."

**Position 5. Doctor**: "Doctor, open your eyes. Point to the player you protect." (Record. Fails if the Doctor is Drunk.) "Doctor, close your eyes."

**Position 6. Mafia**: "Mafia: Godfather and Mafioso, open your eyes. Godfather, point to your kill target." (Record. Resolve per 5.4; the kill target is the Witch's chosen target if the Witch controls the Godfather.) "Mafia, close your eyes."

**Position 7. Janitor**: "Janitor, open your eyes. Point to the corpse you clean." (Record. The clean fails if the Janitor is Drunk.) "Janitor, close your eyes."

**Position 7. Forger**: "Forger, open your eyes. Point to the player whose will you forge." (Record.) "Forger, close your eyes."

**Position 8. Blackmailer**: "Blackmailer, open your eyes. Point to the player you blackmail." (Record: that player cannot speak during the next day; no consecutive-night blackmail.) "Blackmailer, close your eyes."

**Position 9. Demon**: "Demon, open your eyes. Point to your kill target." (Record; Basic attack, redirected if the Witch controls the Demon.) "Demon, close your eyes."

**Position 9. Serial Killer**: "Serial Killer, open your eyes. Point to your kill target." (Record.) "Serial Killer, close your eyes."

**Position 9. Imp**: the Imp wakes here only as the new Demon. While a Demon lives, the Imp has no step; if the Demon died the previous night, wake the Imp in the Demon's place: "Imp, you are now the Demon. Open your eyes. Point to your kill target." (Record.) "Imp, close your eyes."

**Position 10. Framer**: "Framer, open your eyes. Point to the player you frame." (Record: that player reads SUSPICIOUS to the Sheriff or inherited Deputy tonight; a Drunk Sheriff inverts that result.) "Framer, close your eyes."

**Position 11. Sheriff**: "Sheriff, open your eyes. Point to the player you check." (Record; deliver the result by gesture or app display: INNOCENT or SUSPICIOUS. The result inverts if the Sheriff is Drunk. If the Sheriff is dead, the Deputy with the inherited badge wakes here instead.) "Sheriff, close your eyes."

**Position 11. Tracker**: "Tracker, open your eyes. Point to the player you follow." (Record; deliver the result by gesture or app display.) "Tracker, close your eyes."

**Position 11. Lookout**: "Lookout, open your eyes. Point to the player you watch." (Record; deliver the result by gesture or app display.) "Lookout, close your eyes."

**Position 11. Witness**: "Witness, open your eyes. Point to the first player you compare, then point to the second." (Record both targets; deliver the result by gesture or app display: Both Town, Both Mafia, Both Neutral, or Different alignments. Dead targets may be pointed to; the comparison uses their last assigned role. The result inverts if the Witness is Drunk. If the Witch controls the Witness, only the first pick is redirected; the second pick stays.) "Witness, close your eyes."

**Position 11. Consigliere**: "Consigliere, open your eyes. Point to the player you inspect." (Record; deliver the exact role by gesture or app display. A false role is delivered if the Consigliere is Drunk.) "Consigliere, close your eyes."

**Position 11. Undertaker**: "Undertaker, open your eyes. Point to the corpse you inspect." (Record; deliver the true role by gesture or app display. Unaffected by drunkenness; fails on Janitor-cleaned corpses.) "Undertaker, close your eyes."

**Position 11. Spy**: "Spy, open your eyes. Point to the player you watch." (Record; deliver the result by gesture or app display: the team of every player who visited them, or no one. Random teams if the Spy is Drunk.) "Spy, close your eyes."

**Position 11. Oracle**: "Oracle, open your eyes. Point to the player you read." (Record; deliver the result by gesture or app display: TOWN or NOT TOWN. The result inverts if the Oracle is Drunk.) "Oracle, close your eyes."

**Position 11. Succubus**: "Succubus, open your eyes. Point to the player you enchant tonight." (Record: that player cannot vote Guilty against the Succubus during any trial the following day.) "Succubus, close your eyes."

**Position 12. Necromant**: "Necromant, open your eyes. Point to the corpse whose power you borrow tonight, then point to a living target." (Record both; once per game. Not every corpse is borrowable — see the catalog.) "Necromant, close your eyes."

**Position 12. Retributionist**: "Retributionist, open your eyes. Point to the corpse you revive." (Record; once per game.) "Retributionist, close your eyes."

**Position 12. Amnesiac**: "Amnesiac, if you choose to remember, open your eyes. Point to the corpse whose role you remember." (Record; once per game. The Amnesiac permanently becomes that role.) "Amnesiac, close your eyes."

**Position 13. Medium and Ghosts**: "Medium, open your eyes. Ghost Council, open your eyes." (Alive Medium: allow 30 seconds to read the Ghost Ledger. Dead Medium: wake the dead Medium plus one living target and allow 60 seconds of whispered seance. Ghosts write in the ledger.) "Medium and Ghosts, close your eyes."

**Position 14. Morning**: "Everyone, open your eyes. Morning has broken."

---

*End of document.*
