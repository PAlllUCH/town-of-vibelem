# Town of Vibelm

## Game Design Document (Authoritative)

**Version 1.0**

This document supersedes CONCEPT.md and is the single source of truth for the rules of Town of Vibelm, a hybrid social deduction game played in person by a group of friends with one human moderator assisted by a web app. All resolution rules in this document are unambiguous and internally consistent.

**Table of contents**

1. [Game Overview and Philosophy](#1-game-overview-and-philosophy)
2. [Role Catalog](#2-role-catalog)
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

Town of Vibelm layers the social engagement engine of *Blood on the Clocktower* on top of the mechanical engine of *Town of Salem*:

- **The Town of Salem layer** supplies the sharp, fair, mechanical spine: a fixed role catalog with exact night and day abilities, a mathematically balanced alignment ratio for every player count, a fixed nightly action order, and exact, countable victory conditions.
- **The Blood on the Clocktower layer** supplies the soul: players sit around one table, talk openly, whisper in corners, and argue; the dead become ghosts who haunt the living; deaths are announced as mysteries; and a human moderator runs the show with a scripted night wizard.

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

**Team names**: Town, Mafia, Neutral.

**Category conventions** (Town of Salem): Town Investigative, Town Protective, Town Killing, Town Support, Mafia Killing, Mafia Support, Mafia Deception, Neutral Killing, Neutral Evil, Neutral Benign.

General rules that apply to every role:

- No player may target themselves unless the ability is explicitly self-directed (Doctor may protect themselves; the Veteran's alert and the Mayor's reveal are self-declarations; the Mafia kill is a single pick by the kill leader and may target any other player, including fellow Mafia members, but never the leader themselves).
- Dead players (ghosts) cannot be targeted by night actions except by corpse-targeting abilities (Undertaker, Janitor, Retributionist, Amnesiac).
- A roleblocked player's night action fails. A Drunk player's ability behaves per Section 6.

### 2.1 Town roles

| Role | Category | Ability |
|---|---|---|
| **Jailor** | Town Killing | Each night, choose a living player to jail. The jailed player is roleblocked for the night, the Jailor reads the jailed player's last will from their card, then the Jailor chooses EXECUTE (thumbs down) or SPARE (thumbs up). Execution is an Unstoppable kill. The Jailor has a maximum of three executions per game and cannot execute on Night 1; jailing and reading the will still work on Night 1. The Jailor cannot jail the same player on two consecutive nights. |
| **Undertaker** | Town Investigative | Each night, choose one corpse; the moderator privately reveals its true role to you (shown on the app). Cannot inspect a corpse cleaned by the Janitor. |
| **Medium** | Town Support | Alive: each night, during the Medium and Ghosts step, read the Ghost Ledger for 30 seconds. Dead: each night, during the Medium and Ghosts step, whisper with one living player of your choice for 60 seconds. |
| **Doctor** | Town Protective | Each night, choose a living player (including yourself) to protect. Protection blocks the first Basic attack against them that night. Fails if the Doctor is Drunk or roleblocked. |
| **Sheriff** | Town Investigative | Each night, choose a living player and learn INNOCENT or SUSPICIOUS. Suspicious: Mafia-aligned players except the Godfather (who always reads INNOCENT), and the Serial Killer. Everyone else reads INNOCENT. The result inverts if the Sheriff is Drunk. |
| **Deputy** | Town Killing | Once per game, during the day, publicly shoot one living player; they die immediately. If the victim was Town-aligned, the Deputy dies of guilt at the start of the following night. Inheritance: when the Sheriff dies while the Deputy is alive, the Deputy permanently inherits the Sheriff's badge and gains the nightly Sheriff check (in addition to the day shot, if unused). |
| **Tracker** | Town Investigative | Each night, choose a living player and learn which player, if any, they targeted with a night action that night. If they targeted no one, the Tracker learns "no one". |
| **Lookout** | Town Investigative | Each night, choose a living player and learn which players targeted them with a night action that night. If nobody visited them, the Lookout learns "no one". |
| **Escort** | Town Support | Each night, choose a living player to roleblock: their night action fails that night. |
| **Retributionist** | Town Support | Once per game, at night, choose a dead player to revive. The revived player returns to life at the next morning with their role, abilities, and vote intact, and the revival is announced publicly. Cleaned corpses may be revived. See Section 8 for the ghost vote token. |
| **Veteran** | Town Killing | Up to three times per game, at the start of a night, declare ALERT. While alert, every player who visits the Veteran with a night action dies (Unstoppable) and their action is void, and the Veteran cannot be killed that night. The alert cannot be roleblocked and is not corrupted by drunkenness. |
| **Vigilante** | Town Killing | Up to three times per game, during the day, secretly choose one living player to shoot; the moderator announces the death publicly without revealing the shooter. If the victim was Town-aligned, the Vigilante dies of guilt at the start of the following night. |
| **Mayor** | Town Support | Once per game, during the day, publicly reveal. From then on, each of the Mayor's votes counts as 3 votes in every trial. |
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
| **Blackmailer** | Mafia Deception | Each night, choose one living player to blackmail. That player cannot speak during the next day: no table talk, no whisper window, no trial defense. They may still vote by hand gesture and may still use gesture-based day abilities. A player cannot be blackmailed on consecutive nights. |
| **Framer** | Mafia Deception | Each night, choose one living player to frame. A framed player reads SUSPICIOUS to the Sheriff or the inherited Deputy for that night. The frame sets the base result to SUSPICIOUS; a Drunk Sheriff then inverts that result (Section 6). |
| **Forger** | Mafia Deception | Each night, choose one player and forge a false last will for them. If that player dies before the next morning, the moderator reads the forged will from the player's card instead of their true will. |

### 2.3 Neutral roles

| Role | Category | Ability |
|---|---|---|
| **Serial Killer** | Neutral Killing | Each night, choose a living player to kill (Basic attack). Night immune: Basic defense blocks Basic attacks. Reads SUSPICIOUS to the Sheriff. Wins when last standing or holding majority (Section 9). |
| **Survivor** | Neutral Benign | No ability. Wins if alive at game end. |
| **Jester** | Neutral Evil | No ability. Wins immediately when lynched: the Jester wins their personal victory on the spot, but the game continues for everyone else. The Jester becomes a taunting ghost: a ghost that may speak to and mock living players at any time, an exception to the normal ghost rules (Section 8), and receives no ghost vote token (Section 8.4) because they have already won. Haunt: at the start of the night following the lynch, the Jester ghost may choose one player who voted Guilty in the lynch trial; that player dies by an Unstoppable attack at the start of that night, and the death is announced at the next morning as haunted by the Jester. The haunt fires only if the game continues to the next night. |
| **Witch** | Neutral Evil | Each night, after the Poisoner, choose a living player to control and a target: the controlled player's targeting night action is redirected to that target. May control any living player except a player who is currently jailed (the Jailor's jail target for the night; if the Jailor jails the Witch's controlled player, the control fails). On a successful control, the Witch learns the exact role of the controlled player. Controlling the Godfather redirects the Mafia kill target to her chosen target, and the Mafia kill still resolves per the Mafia kill rules (Section 5.4). Controlling the Serial Killer redirects his kill to her chosen target. Controlling the Jailor redirects only the jail target; the EXECUTE or SPARE decision stays with the Jailor. If the controlled player has no targeting night ability (or their action fails), the control does nothing but still reveals the role. Victory: sides with a faction (Mafia by default, Town if declared); wins when that faction wins (Section 9). |
| **The Drunk** | Neutral Benign | No ability. Permanently Drunk: all abilities are disabled (Section 6). Wins if alive at game end. |
| **Amnesiac** | Neutral Benign | Once per game, at night, choose a dead player and remember their role: the Amnesiac permanently becomes that role, gaining its abilities, alignment, and win condition. Until then, no ability. If the game ends before remembering, wins if alive at game end. |
| **Executioner** | Neutral Evil | No ability. At setup, the app assigns a Town-aligned target, revealed privately to the Executioner. Wins when that target is lynched by the town, whether the Executioner is alive or dead. If the target dies by any other means (a night kill, a day kill, a haunt, or any death other than a town lynch), the Executioner becomes a Jester and their win condition becomes the Jester's win condition (win when lynched). |

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

---

## 4. Scenario Presets

### 4.1 How to use a preset

1. Look up the player count in the Ratio Table (Section 3) to get the required number of Town, Mafia, and Neutral slots.
2. Fill each team's slots by drawing down that team's priority list from the chosen preset, top to bottom.
3. If extra Town slots are needed beyond the listed Town roles, fill them with **Civilians**.
4. Every Mafia list contains exactly 4 roles and every Neutral list exactly 2 roles, so no team list ever runs short in the supported 6 to 15 player range.
5. The app shuffles the resulting deck and assigns seat numbers; priority order determines which roles are included, not who sits where.

### 4.2 Preset 1: "Whispers from the Morgue"

The town gathers its information from the dead; the Mafia buries the truth.

- **Town priority**: Jailor, Undertaker, Medium, Doctor, Sheriff, Tracker, Retributionist, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Janitor, Consigliere.
- **Neutral priority**: Amnesiac, Jester.

### 4.3 Preset 2: "The Poisoned Pint"

Sabotage: the Mafia cripples the town's power roles one drink at a time.

- **Town priority**: Jailor, Doctor, Sheriff, Lookout, Escort, Tracker, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Poisoner, Consort.
- **Neutral priority**: The Drunk, Witch.

### 4.4 Preset 3: "The Gunpowder Plot"

Firepower on both sides: town guns and an unsuppressible night killer.

- **Town priority**: Jailor, Deputy, Veteran, Vigilante, Doctor, Escort, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Consort, Forger.
- **Neutral priority**: Serial Killer, Survivor.

### 4.5 Preset 4: "The Imposter at the Altar"

A wedding party where the guest of honor (the Mayor) is a target for both the knife and the noose. The Executioner schemes to hang the guest of honor; the town must shield them.

- **Town priority**: Jailor, Mayor, Doctor, Sheriff, Lookout, Tracker, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Framer, Consigliere.
- **Neutral priority**: Jester, Executioner.

### 4.6 Preset 5: "The Widow's Vigil"

Mourning and espionage: the Witch and the Poisoner turn knowledge against the town while the dead keep watching.

- **Town priority**: Jailor, Sheriff, Undertaker, Medium, Doctor, Retributionist, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Poisoner, Blackmailer.
- **Neutral priority**: Witch, Survivor.

### 4.7 Preset 6: "The Clock Strikes Thirteen"

Chaos at midnight: two night killers and heavy town firepower make every night decisive.

- **Town priority**: Jailor, Vigilante, Veteran, Deputy, Doctor, Escort, then Civilians.
- **Mafia priority**: Godfather, Mafioso, Consort, Forger.
- **Neutral priority**: Serial Killer, The Drunk.

### 4.8 Worked example

10 players, Preset 1: the table gives 6 Town, 3 Mafia, 1 Neutral. The deck is Jailor, Undertaker, Medium, Doctor, Sheriff, Tracker (Town); Godfather, Mafioso, Janitor (Mafia); Amnesiac (Neutral). 8 players, Preset 4: 5 Town, 2 Mafia, 1 Neutral: Jailor, Mayor, Doctor, Sheriff, Lookout (Town); Godfather, Mafioso (Mafia); Jester (Neutral).

---

## 5. Night Resolution Engine

### 5.1 The action order

Actions are recorded in the scripted night wizard order (the moderator wakes players exactly in this sequence) and resolve in the same order. Each step is a phase: within a phase the moderator may wake each relevant player one at a time and take their input privately.

| Position | Roles acting | What resolves |
|---|---|---|
| 0 | **Veteran** (pre-night) | Declares ALERT (max 3 per game); while alert, visitors die (Unstoppable) and the Veteran cannot be killed (Section 5.3). |
| 1 | **Poisoner** | Poisons the target: Drunk for one cycle (Section 6). |
| 2 | **Witch** | Chooses a living player to control and a redirect target. Cannot control a player who is currently jailed (the jail voids the control). On a successful control, learns the controlled player's exact role. The controlled player's targeting night action is redirected (a controlled Poisoner has already acted and is unaffected). Controlling the Godfather redirects the Mafia kill target (resolved per 5.4); controlling the Serial Killer redirects his kill; controlling the Jailor redirects only the jail target, and the EXECUTE or SPARE decision stays with the Jailor. |
| 3 | **Jailor** | Jails a player: roleblocked, the Jailor reads the jailed player's will from their card, then EXECUTE (Unstoppable kill, resolves immediately) or SPARE. Max 3 executions per game; on Night 1 the Jailor jails and reads the will but cannot execute. |
| 4 | **Escort** | Roleblocks the chosen player. |
| 4 | **Consort** | Roleblocks the chosen player. |
| 5 | **Doctor** | Protects the chosen player (fails if Drunk or roleblocked). |
| 6 | **Mafia** | The Mafia makes a single kill pick per night, chosen by the kill leader (the living Godfather, or the living Mafioso if the Godfather is dead); the kill is carried out per 5.4 (redirected if the Godfather is controlled by the Witch). |
| 7 | **Janitor** | Cleans a corpse (fails if Drunk or roleblocked). |
| 7 | **Forger** | Forges a will for one player. |
| 8 | **Blackmailer** | Blackmails the chosen player: cannot speak during the next day (no table talk, no whisper window, no trial defense); may still vote by hand gesture (Section 2.2). |
| 9 | **Serial Killer** | Kills the chosen player (Basic attack; fails if roleblocked; redirected if controlled by the Witch). |
| 10 | **Framer** | Frames the chosen player: reads SUSPICIOUS to the Sheriff or inherited Deputy for that night (a Drunk Sheriff then inverts the result). |
| 11 | **Sheriff** | Checks one player: SUSPICIOUS if Mafia-aligned (except the Godfather) or the Serial Killer, INNOCENT otherwise; inverted if the Sheriff is Drunk. The Deputy with the inherited badge performs this check from the night after the Sheriff dies. |
| 11 | **Tracker** | Follows one player and learns which player, if any, they targeted that night. |
| 11 | **Lookout** | Watches one player and learns which players targeted them that night. |
| 11 | **Consigliere** | Inspects one player and learns their exact role (a false role if Drunk). |
| 11 | **Undertaker** | Inspects one corpse and learns its true role (unaffected by drunkenness; fails on Janitor-cleaned corpses). |
| 12 | **Retributionist** | Records the corpse to revive (once per game); the revival takes effect at morning. |
| 12 | **Amnesiac** | Once per game, records the corpse whose role is remembered; permanently becomes that role. |
| 13 | **Medium and Ghosts** | Ghosts write in the Ghost Ledger; the alive Medium reads it for 30 seconds; a dead Medium whispers with one living target for 60 seconds (Section 8). |
| 14 | **Morning** | Revivals take effect, deaths are applied in order, and the morning announcement is prepared (Section 7). |

Notes on order:

- The **Veteran's alert** is declared before the night begins (a pre-night step, position 0). It is a defensive state, not an action in the order.
- The **Jester's haunt** also resolves at the start of the night, at the same point as the Veteran's alert: if the Jester was lynched the previous day, the Jester ghost may choose one player who voted Guilty in that lynch trial, and that player dies by an Unstoppable attack (Section 2.3). The haunt fires only if the game continued to this night.
- **Day abilities** (Vigilante shot, Deputy shot, Mayor reveal) are used during the day phase, never at night.
- Deaths resolve immediately at their position: a player who dies at position 3 is dead for every later step, and their recorded later actions are void.

### 5.2 Attack and defense model

Every kill in the game is one of two attack types; every target has one of two defense states:

| Attack type | Sources | Notes |
|---|---|---|
| **Basic** | Mafia kill, Serial Killer kill | Blocked by Doctor protection and by Basic defense. |
| **Unstoppable** | Jailor execution, Veteran alert, Jester haunt | Ignores Doctor protection and Basic defense. Cannot be healed or blocked. |

| Defense | Holders | Notes |
|---|---|---|
| **None** | Most roles | A Basic attack kills them. |
| **Basic** | Godfather, Serial Killer, and a Mafioso promoted to Godfather | Blocks Basic attacks. Does not block Unstoppable attacks. |

**Doctor protection**: protects one player from the first Basic attack against them that night. The protection is consumed when it blocks an attack; if the protected player is hit by a second Basic attack in the same night, they die. Fails entirely if the Doctor is Drunk or roleblocked. Protection does nothing against Unstoppable attacks.

### 5.3 Who dies when multiple effects target one player

| Situation | Outcome |
|---|---|
| Any Unstoppable kill (Jailor execution, Veteran alert, Jester haunt) | Target dies. Doctor protection and Basic defense do not apply. |
| One Basic kill, no protection, no Basic defense | Target dies. |
| Basic kill vs Basic defense | Target survives. |
| Basic kill vs Doctor protection | Target survives; protection consumed. |
| Two Basic kills in one night, Doctor protection present | Target survives the first and dies to the second. |
| Two Basic kills in one night, no protection | Target dies to the first; the second is void. |
| Target is roleblocked and also killed | Roleblock does not save them; they die if the kill lands. |

**Roleblock versus kills** (explicit): roleblocking a player does not prevent them from being killed and does not cancel kills targeting them. It only cancels their own night action.

**Jailor execution versus Basic defense**: the execution is Unstoppable, so the Godfather, the Serial Killer, and a promoted Mafioso can be executed despite their immunity. Spared players simply survive the jail.

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

---

## 6. Drunk Status Engine

### 6.1 What "Drunk" is

Drunk is a status effect that corrupts specific abilities. It has exactly two sources and exactly four effects.

**Sources**

| Source | Duration |
|---|---|
| **Poisoner** | One cycle. A player poisoned on night N is Drunk through night N's resolution and the entire following day, and becomes sober when night N + 1 begins. |
| **The Drunk role** | Permanent. Never expires, can never be removed. |

**Effects** (apply only while the affected player is Drunk)

| Drunk player | Effect |
|---|---|
| Sheriff | The check result is inverted: INNOCENT becomes SUSPICIOUS and vice versa. |
| Consigliere | The learned role is false: a random role of a different alignment is shown instead. |
| Janitor | The clean action fails: the corpse is not cleaned. |
| Doctor | The protection fails: the chosen player is not protected. |

No other ability is affected by drunkenness. A Drunk Tracker, Lookout, Escort, Jailor, Poisoner, Witch, Framer, Blackmailer, Undertaker, Medium, or Retributionist acts normally. Drunkenness does not disable voting or speaking.

### 6.2 The Drunk role

A player holding **The Drunk** role is permanently Drunk, which means **all of their abilities are disabled, for the entire game**:

- The Drunk has no night action and no day action.
- The Drunk cannot gain or use any ability from any source, and no rule or ability can restore them.
- The four corruption effects above describe what happens when specific roles are Drunk; a Drunk-role player never has those roles' abilities, so nothing to corrupt exists.

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
- During any single day trial, a ghost may spend their token to cast **one extra vote** (Guilty or Innocent). The token is spent forever.
- A revived player returns to life and votes normally; they lose their token while alive (spent or unspent). If they die again, they do **not** receive a second token.

---

## 9. Victory Conditions

### 9.1 Alignment counting

Victory is computed from living players only. Each living player belongs to exactly one bucket:

| Bucket | Members |
|---|---|
| **Town-aligned** | All Town roles; an Amnesiac who remembered a Town role; a Witch who declared she sides with Town. |
| **Mafia-aligned** | Godfather; Mafioso; an Amnesiac who remembered a Mafia role; a Witch who sides with Mafia (including a Witch who never declared, since the default is Mafia). |
| **Neutral** | Serial Killer; Jester; Executioner; Survivor; The Drunk; an Amnesiac who has not yet remembered. Neutrals count toward no faction's majority. |

### 9.2 Individual victory conditions

Checked at the moment the triggering event occurs. Whether the game ends depends on the winner (Section 9.5).

| Winner | Condition |
|---|---|
| **Jester** | Wins immediately when lynched, but the game continues for everyone else; the Jester becomes a taunting ghost and may haunt one Guilty voter on the following night (Section 2.3). |
| **Executioner** | Wins when their assigned target is lynched by the town, whether the Executioner is alive or dead. If the target dies by any other means, the Executioner becomes a Jester and their win condition becomes the Jester's win condition (win when lynched). |

### 9.3 Faction victory conditions

Checked (a) immediately after a lynch resolves, (b) immediately after the morning death announcements, and (c) immediately after any day kill (a Vigilante shot or a Deputy shot).

| Faction | Condition |
|---|---|
| **Town** | Every Mafia-aligned player is dead **and** the Serial Killer is dead. A living Serial Killer always retains a path to victory, so Town requires the SK dead. |
| **Mafia** | Living Mafia-aligned players >= living Town-aligned players (the Mafia holds majority; ties favor the Mafia). |
| **Serial Killer** | The SK is alive and the number of living players other than the SK is 0 (last standing) or 1 (holds majority). |

### 9.4 Other winners at game end

| Role | Condition |
|---|---|
| **Survivor** | Wins if alive when the game ends (shares the win with whoever triggered the end). |
| **The Drunk** | Wins if alive when the game ends (shares the win with whoever triggered the end). |
| **Witch** | Wins when the faction she sides with wins: Mafia by default, Town if she declared Town. If she sides with Mafia, she counts as Mafia-aligned; if Town, as Town-aligned. |
| **Amnesiac** | Wins with the team of the remembered role. If the game ends before the Amnesiac remembers, the Amnesiac wins if alive at game end. |

### 9.5 Simultaneous victory priority

When two or more conditions would trigger in the same resolution (the same lynch, the same morning announcement, or the same day kill), they are evaluated in this exact order, and the **first condition satisfied wins and ends the game immediately**:

1. **Individual conditions**: Jester, then Executioner. A lynched Jester wins their personal victory on the spot, but the game continues for everyone else and faction checks still run. If the Executioner's condition triggers, the Executioner wins on the spot and the game ends immediately.
2. **Faction conditions**, in this order: **Serial Killer**, then **Mafia**, then **Town**.

Examples:

- SK and one other player remain (say, the Godfather): the SK holds majority and the Mafia holds a tie. The SK is checked first and wins.
- All Mafia-aligned players are dead but the SK lives: Town's condition is not met; the game continues.
- Mafia count >= Town count and the SK is dead: the Mafia condition is checked before Town and wins.

Living Survivors and The Drunk share the win in every case.

---

## 10. House Rule Toggles

The moderator app offers three toggles, selectable at setup:

| Toggle | Effect |
|---|---|
| **No Kill on Night One** | All night kills on night 1 are void: the Mafia kill, the Serial Killer's kill, the Jailor's execution, and the Veteran's alert kills resolve to nothing (an alerted Veteran is still safe). Poisoning, roleblocking, blackmailing, framing, protection, investigation, cleaning, forging, controlling, reviving, and the seance resolve normally. Day kills (Vigilante, Deputy) are unaffected. |
| **No Lynch on Day One** | No trial may end in a lynch on day 1. The town may still discuss and hold informational votes, and day abilities still work. |
| **Classic Reveal Mode** | Replaces mystery deaths: the morning announcement shows each victim's **true role**; the moderator reads their last will from the player's card. A Janitor-cleaned corpse still shows as unknown and still cannot be inspected by the Undertaker. The Undertaker's private inspection remains available. |

---

## 11. End of Game Flow

When a victory condition (Section 9) triggers, the moderator app runs the end-of-game sequence:

1. **Announce the winner(s)** immediately: the winning faction or the winning individual, plus any living Survivors and The Drunk who share the win.
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
| **Role dealing** | The moderator deals one role per player in private (face-down cards or a one-at-a-time app reveal). Each player knows only their own role. The moderator records names and seat numbers. The Executioner is told their target privately; the Godfather is whispered their three Town bluff roles; the Witch is asked (in private) whether she sides with Town or stays with Mafia by default. |
| **Night wizard** | The scripted sequence below. The app records every target, resolves the night (Section 5), and prepares the morning announcement. |
| **Seat grid** | One tile per player, showing name and moderator-only role, with status tags: [ALIVE], [GHOST], [DRUNK], [INHERITED SHERIFF], plus [JAILED], [PROTECTED], [POISONED], [ALERT], [REVEALED] (Mayor), and [CLEANED] as applicable. |
| **Day phase** | Morning announcements (deaths, with wills read from the players' cards, revivals, badge inheritance); open discussion; whisper windows (Section 12.3); day abilities (Vigilante secret shot, max 3 per game, Deputy public shot, Mayor reveal); trials and voting as described in 12.3; victory checks after the lynch, after any day kill, and after the morning announcements. |
| **End of game** | Full reveal and winner announcement (Section 11). |

### 12.2 Table protocol

- At night, all players close their eyes. When woken, each player **looks only at the moderator** and answers by pointing, nodding, or whispering. Players never look at other players while woken.
- The moderator wakes one player at a time within each step unless the step says otherwise, and stations themselves so that woken players face the moderator, not the table.
- The app displays exactly which players to wake and what to ask, in order.

### 12.3 Day phase and trials

- The day begins with the morning announcement: the moderator announces the dead and reads each victim's last will from their card. Players keep their own last wills privately on paper cards; the app never records or shows them.
- Open discussion follows. Day abilities may be used at any point: the Vigilante signals a secret shot to the moderator (max 3 shots per game); the Deputy's shot is public; the Mayor may reveal. **Victory is checked immediately after any day kill**, such as a Vigilante shot or a Deputy shot.
- At any point during the day, the moderator may call a **two-minute whisper window**: any two living players may pair up and talk privately, roaming the room. Ghosts may not join, and blackmailed players may not join.
- A **blackmailed player** cannot speak during the day: no table talk, no whisper window, no trial defense. They may still vote by hand gesture and may still use gesture-based day abilities (Section 2.2).
- **Trial**: a living player nominates another living player. The accused may defend (unless blackmailed). Then every living player votes **Guilty**, **Innocent**, or **Abstain** by raised hand or voice. Ghosts may spend their ghost vote token to add one extra Guilty or Innocent vote (Section 8). A revealed Mayor's vote counts as 3.
- **Majority counting** (the app does this automatically): a player is lynched if the number of Guilty votes strictly exceeds the number of all other votes (Innocent + Abstain, including ghost votes). Otherwise the accused is acquitted.
- At most **one lynch per day**. After a lynch, or if the town votes to abstain as a whole, or when the moderator calls time, the day ends and night begins. Victory is checked after every lynch, after any day kill, and after the morning death announcements.

### 12.4 The night wizard script

The moderator reads this aloud every night. Bracketed instructions are for the moderator and are handled by the app; the wizard is generated from the living roles, so empty steps are skipped.

**Position 0. Veteran alert** (pre-night): "Veteran, open your eyes. Are you on alert tonight? Signal yes or no." Record the choice (max 3 alerts per game). (If the Jester was lynched yesterday and the game continued, resolve the haunt now: the Jester ghost may point to one player who voted Guilty in that lynch trial; that player dies by an Unstoppable attack at the start of the night.) "Veteran, close your eyes."

**Position 1. Poisoner**: "Everyone, close your eyes. Night falls. Poisoner, open your eyes. Point to your target." (Record target: Drunk for one cycle.) "Poisoner, close your eyes."

**Position 2. Witch**: "Witch, open your eyes. Point to the player you control, then point to your target." (Record; reveal the controlled player's exact role to the Witch. The control fails if the controlled player is currently jailed: if the Jailor later jails the Witch's controlled player, the control is void.) "Witch, close your eyes."

**Position 3. Jailor**: "Jailor, open your eyes. Point to your target." (Record: target roleblocked. The Jailor reads the target's last will from their card.) "Do you EXECUTE, thumbs down, or SPARE, thumbs up?" (Record the choice; execution is Unstoppable. On Night 1 there is no execution: the Jailor only jails and reads the will.) "Jailor, close your eyes."

**Position 4. Escort**: "Escort, open your eyes. Point to your roleblock target." (Record.) "Escort, close your eyes."

**Position 4. Consort**: "Consort, open your eyes. Point to your roleblock target." (Record.) "Consort, close your eyes."

**Position 5. Doctor**: "Doctor, open your eyes. Point to the player you protect." (Record. Fails if the Doctor is Drunk.) "Doctor, close your eyes."

**Position 6. Mafia**: "Mafia: Godfather and Mafioso, open your eyes. Godfather, point to your kill target." (Record. Resolve per 5.4; the kill target is the Witch's chosen target if the Witch controls the Godfather.) "Mafia, close your eyes."

**Position 7. Janitor**: "Janitor, open your eyes. Point to the corpse you clean." (Record. The clean fails if the Janitor is Drunk.) "Janitor, close your eyes."

**Position 7. Forger**: "Forger, open your eyes. Point to the player whose will you forge." (Record.) "Forger, close your eyes."

**Position 8. Blackmailer**: "Blackmailer, open your eyes. Point to the player you blackmail." (Record: that player cannot speak during the next day; no consecutive-night blackmail.) "Blackmailer, close your eyes."

**Position 9. Serial Killer**: "Serial Killer, open your eyes. Point to your kill target." (Record.) "Serial Killer, close your eyes."

**Position 10. Framer**: "Framer, open your eyes. Point to the player you frame." (Record: that player reads SUSPICIOUS to the Sheriff or inherited Deputy tonight; a Drunk Sheriff inverts that result.) "Framer, close your eyes."

**Position 11. Sheriff**: "Sheriff, open your eyes. Point to the player you check." (Record; deliver the result by gesture or app display: INNOCENT or SUSPICIOUS. The result inverts if the Sheriff is Drunk. If the Sheriff is dead, the Deputy with the inherited badge wakes here instead.) "Sheriff, close your eyes."

**Position 11. Tracker**: "Tracker, open your eyes. Point to the player you follow." (Record; deliver the result by gesture or app display.) "Tracker, close your eyes."

**Position 11. Lookout**: "Lookout, open your eyes. Point to the player you watch." (Record; deliver the result by gesture or app display.) "Lookout, close your eyes."

**Position 11. Consigliere**: "Consigliere, open your eyes. Point to the player you inspect." (Record; deliver the exact role by gesture or app display. A false role is delivered if the Consigliere is Drunk.) "Consigliere, close your eyes."

**Position 11. Undertaker**: "Undertaker, open your eyes. Point to the corpse you inspect." (Record; deliver the true role by gesture or app display. Unaffected by drunkenness; fails on Janitor-cleaned corpses.) "Undertaker, close your eyes."

**Position 12. Retributionist**: "Retributionist, open your eyes. Point to the corpse you revive." (Record; once per game.) "Retributionist, close your eyes."

**Position 12. Amnesiac**: "Amnesiac, if you choose to remember, open your eyes. Point to the corpse whose role you remember." (Record; once per game. The Amnesiac permanently becomes that role.) "Amnesiac, close your eyes."

**Position 13. Medium and Ghosts**: "Medium, open your eyes. Ghost Council, open your eyes." (Alive Medium: allow 30 seconds to read the Ghost Ledger. Dead Medium: wake the dead Medium plus one living target and allow 60 seconds of whispered seance. Ghosts write in the ledger.) "Medium and Ghosts, close your eyes."

**Position 14. Morning**: "Everyone, open your eyes. Morning has broken."

---

*End of document.*
