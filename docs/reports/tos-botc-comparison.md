# Town of Vibelm vs Town of Salem and Blood on the Clocktower — Deep Design Comparison

*Designer report. Repo: `G:/Mój dysk/Projekty/Town of Vajbelem`. Source of truth: `docs/GDD.md` (rules) and `docs/interface.md` (API). Every Vibelm claim has a `file:line` reference. Recommendations section is tagged CODE / DESIGN / RULE and sized S/M/L.*

---

## 0. The two reference models in one paragraph each

**Town of Salem (ToS)** is a *computerised* social deduction game. The "engine" is the *server*: it knows every role, runs every action, and resolves conflicts instantly. There is no moderator. Players see a *role card* (their own) and a *last will* (a free-text box they edit any time). Day is run by a *majority vote*: any player can vote, you can vote yourself, simple majority wins. Night is run by a *fixed order* (Investigator → Escort → Transporter → Veteran → Mafia → Serial Killer → etc.). There is no seconding, no ghost vote, no nominator. The game is *claim-driven*: by Day 2 everyone has to publicly announce their "role" and then the Town puzzles out who is lying. Death reveals the role; Janitor/Forger hide specific information. Bluffing is open and unlimited.

**Blood on the Clocktower (BotC)** is a *storyteller-driven* social deduction game. There is one human (the Storyteller) who *runs everything*: nights (in small clusters, "wake X, show Y"), deaths (announced one by one), and day nominations. Players close their eyes at night, learn calibrated or *false* private info (e.g. the Washerwoman learns "one of these two is the Investigator", but one of those two is wrong), and may publicly *state* their claimed role when the Storyteller asks. Days are *BotC's signature mechanic*: a living player nominates another; every other living player either *seconds* or opposes; the nomination only proceeds if a **strict majority** of living players second it; then a *public* up/down vote happens. Ghosts vote with tokens. The game is *conversation-driven*: it generates speeches, not claims. The Storyteller may lie to players about who they are (the "Drunk" is a Townsfolk who thinks they're a Fortune Teller but actually has no ability; the "Recluse" may register as a Demon to the Empath).

---

## 1. Role-by-role map

| # | Vibelm role | Town of Salem analog | BotC analog | Vibelm does differently |
|---|---|---|---|---|
| 1 | **Jailor** (§2.1, engine `01-roles.js:7`, night step 3) | Jailor (ToS) — same mechanic | none (closest is a Slayer-like day kill wrapped in a night jail) | No "jail the same player back-to-back" cap (that's actually a Vibelm rule). Reads will from the *paper card* when the player is jailed. No execute on N1. |
| 2 | **Undertaker** (GDD §2.1, night step 11) | Undertaker (ToS, learned role of last executed) | BotC Undertaker learns the role of the *last executed* (not the corpse pool) | Vibelm lets the Undertaker see *any* corpse, not just the last executed. Inspection is *corpse-target* (not a meta-pick). |
| 3 | **Medium** (GDD §2.1, night step 13) | Medium (ToS, 1 question per night to a dead player) | BotC has no Medium; the "Oracle" reads a yes/no at night | Vibelm's Medium is essentially *two* roles stapled: alive medium reads *Ghost Ledger for 30s* (BotC-flavour), dead medium *whispers with one living for 60s* (ToS-flavour). |
| 4 | **Doctor** (GDD §2.1, night step 5) | Doctor (ToS, self-protect allowed) | BotC has the Monk (cannot self-protect; can protect) | Same as ToS. The Doctor's protection is *one-shot per night* (blocks the first Basic attack on the target). |
| 5 | **Sheriff** (GDD §2.1, night step 11) | Sheriff (ToS, "Mafia or not") | BotC has no Sheriff; closest is the Investigator (one of two players is a Minion, one of those is wrong) | Vibelm Sheriff is to the ToS Sheriff, not BotC. Returns 2-valued SUSPICIOUS/INNOCENT. |
| 6 | **Deputy** (GDD §2.1, `day.js:74-99`) | Deputy (ToS, single day execute + inherits if Sheriff dies) | BotC has no Deputy; closest is the **Slayer** (one-shot "kill the demon" but fails on non-Demon) | Vibelm's Deputy is *exactly* the ToS Deputy. Inherits Sheriff on the Sheriff's death and *permanently* reads SUSPICIOUS/INNOCENT each night thereafter. |
| 7 | **Tracker** (GDD §2.1, night step 11) | Tracker (ToS — the player they target) | none (closest is the Dreamer — sees a specific player but not who they visited) | Identical to ToS. |
| 8 | **Lookout** (GDD §2.1, night step 11) | Lookout (ToS — visitors) | none (closest is the Empath — but it's neighbours, not visitors) | Identical to ToS. |
| 9 | **Escort** (GDD §2.1, night step 4) | Escort (ToS — roleblock) | BotC has no Escort; the roleblock mechanic is folded into the Witch (Minion) | Vibelm keeps the Escort + Consort *as separate steps* even though they're mechanically identical to roleblock — matches ToS exactly. |
| 10 | **Retributionist** (GDD §2.1, night step 12) | Retributionist (ToS — revive a dead Town) | BotC has no retrain mechanic; the Storyteller just gives an extra night to a Saint-like role | Identical to ToS. Revived player loses ghost vote while alive; if they die again, no second token (engine `07-night-resolution.js:56-83`). |
| 11 | **Veteran** (GDD §2.1, night step 0) | Veteran (ToS — alert=kill visitors) | none (closest is the Soldier — Demon kills fail on them) | Vibelm Veteran is *both* ToS Veteran and Soldier. Three alerts only. |
| 12 | **Vigilante** (GDD §2.1, `day.js:74-99`) | Vigilante (ToS — day shoot, guilt) | BotC has no day kill; closest is the Assassin (Minion) or Slayer (Townsfolk) | Identical to ToS. Three shots. Guilt kills the Vigilante at the *start of the following night* (engine `07-night-resolution.js:140-145`). |
| 13 | **Mayor** (GDD §2.1, `day.js:74-99`) | Mayor (ToS — vote x3 after reveal) | BotC Mayor cannot be executed if revealed (different mechanic) | Vibelm is to the ToS Mayor, not BotC. |
| 14 | **Civilian** (GDD §2.1) | Civilian (ToS) | Townsfolk (BotC — has no ability) | Identical. |
| 15 | **Godfather** (GDD §2.2, night step 6) | Godfather (ToS) | none (BotC has no Godfather; the Demon is just a Demon) | Vibelm is to the ToS Godfather. The key ToS/BotC-flavour move: *bluffs* (3 Town roles not in deck) — see §3 below. |
| 16 | **Mafioso** (GDD §2.2) | Mafioso (ToS) | none | ToS-Vibelm, becomes the new Godfather if the GF dies. |
| 17 | **Janitor** (GDD §2.2, night step 7) | Janitor (ToS — clean corpse) | none directly (BotC has no corpse cleanup; the Storyteller simply doesn't reveal) | Identical to ToS. Permanent cleanup (GDD §2.2). |
| 18 | **Consigliere** (GDD §2.2, night step 11) | Consigliere (ToS) | BotC has the Spy (Minion) — learns a blurb about a player | ToS, not BotC. |
| 19 | **Consort** (GDD §2.2, night step 4) | Consort (ToS — roleblock) | none | ToS. |
| 20 | **Poisoner** (GDD §2.2, night step 1) | Poisoner (ToS) | BotC has the Poisoner (Minion) — makes a player Drunk for a day+night cycle | Almost identical to BotC. The Vibelm Poisoner sets the target *Drunk* for the cycle (ToS / BotC agree). |
| 21 | **Blackmailer** (GDD §2.2, night step 8) | Blackmailer (ToS) | none (closest is the Wretch — an Outsider who affects speech) | Identical to ToS. No consecutive-night blackmail. |
| 22 | **Framer** (GDD §2.2, night step 10) | Framer (ToS) | none (closest is the Recluse — registers as a Demon to the Empath) | Identical to ToS. |
| 23 | **Forger** (GDD §2.2, night step 7) | Forger (ToS) | none | Identical to ToS. The forged will is read from the *paper card* (GDD §2.2; "companion mode" — the app does not store the will). |
| 24 | **Serial Killer** (GDD §2.3, night step 9) | Serial Killer (ToS — kills each night) | none (BotC Demons are aligned, not solo) | ToS. Night immune (Basic defense). Reads SUSPICIOUS to Sheriff. |
| 25 | **Survivor** (GDD §2.3) | Survivor (ToS) | none (BotC has no equivalent; closest is the Saint — wins if alive but only because they can't be executed) | ToS. |
| 26 | **Jester** (GDD §2.3, night step 0 haunt) | Jester (ToS — wins when lynched) | BotC has no Jester; closest is the **Saint** (who *dies* if executed but doesn't win) | Combines ToS Jester + BotC's "out-of-band haunt" mechanic. The haunt is fired at the start of the *next* night, not the next morning (engine `08-ghosts.js:5-21`). |
| 27 | **Witch** (GDD §2.3, night step 2) | Witch (ToS — control + redirect) | BotC has the **Witch** (Minion — control + redirect) | Identical to both. *Sides with Mafia by default, Town if declared* (GDD §2.3) — this is *exactly* how BotC runs the Witch in many editions. |
| 28 | **The Drunk** (GDD §2.3, `04-state.js` — `isDrunk = true` always) | none (ToS has no Drunk) | BotC has the **Drunk** (Townsfolk — thinks they're a Townsfolk but actually has no ability) | The Vibelm implementation is *BotC*, not ToS: the role is *permanently Drunk* and has *no ability*. |
| 29 | **Amnesiac** (GDD §2.3, night step 12) | Amnesiac (ToS — remember) | BotC has no Amnesiac; closest is the **Balloonist** — learns another outsider role each night | Vibelm is to the ToS Amnesiac. |
| 30 | **Executioner** (GDD §2.3, setup) | Executioner (ToS — get target lynched; if Town loses you become a Jester) | BotC has no Executioner; closest is the **Politician** — but they target any player, not pre-assigned | ToS. Target is *randomly assigned at setup* by the engine (`assignRoles` in `06-night-actions.js` and the `dealRoles`/`assignRoles` family). |

**Coverage gaps vibelm-vs-ToS** (8 strong ToS roles that vibelm omits): `Investigator` (learns 2-of-3 roles — *no BotC analog either*), `Bodyguard` (reflect on attack), `Transporter` (swap two players), `Disguiser`, `Hypnotist`, `Arsonist`, `Werewolf`, `Plaguebearer` / `Pestilence`. None of these are *required* to ship the moderator app, but the absence of `Investigator` is the most felt — it's ToS's #1 info role and the engine has no inferable replacement in vibelm's catalog.

**Coverage gaps vibelm-vs-BotC** (BotC roles vibelm omits): `Washerwoman` / `Librarian` / `Investigator` (the "you get one true + one false" townsfolk), `Empath` / `Chef` (neighbour counts), `Monk` (nightly protection), `Ravenkeeper` (learn on death), `Virgin` (executable), `Soldier` (Demon-immune), `Slayer` (one-shot kill), `Recluse` (false alignment registration), `Saint` (dies if executed), `Spy` (every-night blurb), `Scarlet Woman` (becomes Demon if Demon dies), `Baron` (extra Outsiders), `Assassin` (day kill). Vibelm's *missing* BotC flavour is the calibrated false-info mechanic (Washerwoman/Librarian/Investigator/Empath).

**Trial / lynch / win structures** (GDD §12.3):

| Vibelm mechanic | ToS | BotC | Vibelm differs |
|---|---|---|---|
| **Vote = BotC seconding** | ToS has no seconding — anyone votes. | BotC seconding is a *strict majority of living* (≈ floor(living/2) + 1) | Vibelm matches BotC exactly: `floor(living/2)+1` (`09-day.js:108-109`). |
| **Nominator auto-agrees** | not applicable | nominator auto-counts toward the majority | matches BotC. |
| **Ghost vote timing** | not applicable (no ghosts) | ghost votes only in the verdict stage, never to second | matches BotC (`09-day.js:83-90`, GDD §8.4). |
| **Day 1 executable** | ToS Day 1: votes still allow execution | BotC Day 1: no execution (house rule: first day is purely informational) | Vibelm has a `noLynchD1` house-rule toggle (`03-deck.js` / `config.js:42`) — *default is off*, so D1 lynch is allowed. |
| **Jailor cannot execute on N1** | ToS Jailor can execute N1 | BotC has no Jailor | Vibelm blocks N1 execution via the wizard prompt (`wizard.js:86-94`) and via `resolveNight` (`06-night-actions.js:47`). |
| **Jester haunt** | ToS Jester haunts one Guilty voter N+1 | not applicable | Vibelm matches. |
| **Forged will** | ToS: stored digitally, never read | not applicable | Vibelm: app surfaces *only* "a will was forged for X" (`day.js:50-53`); the actual will is read from the paper card. |
| **Mayor weight × 3** | ToS Mayor is vote × 3 | BotC Mayor is "cannot be executed" | Vibelm is to ToS. |
| **Mafia kill = single pick by leader** | ToS has the Godfather pick the target | not applicable | Vibelm matches. |
| **Witch sides with Mafia by default** | ToS Witch counts as Neutral Evil | BotC Witch is a Minion (counted as evil) | Vibelm's `witchSide` defaults to MAFIA (`config.js` / `interface.md`); the seats screen has a toggle for the Witch to *declare Town* (GDD §2.3). |
| **Drunk = permanently no ability** | ToS has no Drunk | BotC Drunk = Townsfolk who thinks they're a Townsfolk | Vibelm matches BotC. |

---

## 2. The 10 most impactful differences

A "real-world" impact analysis: how does a person running Vibelm at a table of 11 friends (the most common preset, "Whispers from the Morgue") experience the game differently than a ToS-private-server game or a BotC-Trouble-Brewing game?

### 2.1 The moderator IS the state
- **ToS:** the server is the state. Everyone gets an instant death reveal, instant role reveal, instant win detection. No latency, no ambiguity.
- **BotC:** the Storyteller is the state. The Storyteller decides *who learned what* (calibration), *when* to announce deaths, and *who* knows which deaths. The Storyteller is also a *player* — they can lie, withhold, or misalign info.
- **Vibelm:** the moderator is the state. The app stores the truth; the moderator whispers it. *The app never broadcasts to players* — even the role card is on paper (`SESSION-REPORT.md:39` "companion mode").
- **Consequence:** the moderator is a single point of failure. Ask a wrong question, whisper the wrong bluffs, and the next 30 minutes of investigative work is poisoned. The app's *only* job is to make sure the moderator never has to rely on memory for *what info belongs to whom*.
- **Recommendation (L, DESIGN):** add a per-player *known-info* panel (see §3) that the moderator can swipe to before whispering. This is the single largest UX win.

### 2.2 One human moderator, eleven simultaneous inputs
- **ToS:** every player has a *mouse* and a *screen*. The engine polls them. The bottleneck is each player's typing speed.
- **BotC:** one Storyteller walks the table. The bottleneck is the Storyteller's *stamina* — every night step is "wake X, show Y", with X differing each night.
- **Vibelm:** the moderator wakes the same X each night (the role-specific player). The app shows *who to wake* and *what to ask* (`wizard.js:144-212`). The moderator just *records* the gesture.
- **Consequence:** a Vibelm moderator can run 11-player nights in ~5 minutes — about half a BotC Troupers game. The bottleneck becomes *walking back to the table* between wakeups.
- **Recommendation (M, DESIGN):** add a "Whisper to next player" hint that times out after a configurable window (e.g. 30s), so the moderator doesn't have to tap through wizard steps that trivially resolve.

### 2.3 Day 1 with no kill on Night 1 = no first signal
- **ToS:** Night 1 usually has a kill. The morning always reveals a role (ToS "All Roles" mode). The town wakes up with a *body* and a *role*, and the deduction starts from there.
- **BotC:** Night 1 is *information-only*. The Demon may not kill (storyteller-calibrated). The town wakes up with no death and instead has *fifteen roles' worth of info*.
- **Vibelm:** Day 1 *comes first* now (`SESSION-REPORT.md:111`), with `noKillN1: true` as the default (`config.js:42`). Day 1 is a *purely informational* discussion with no deaths yet.
- **Consequence:** there is *nothing to investigate* on Day 1. The town has no corpse, no will, no role to identify. The only signal is the seating arrangement and who *didn't* speak at the briefing. The first real investigative night is Night 1.
- **Recommendation (M, DESIGN):** see the "Night Zero / prep ritual" scaffold in §5 — the *highest-value single recommendation* in this report.

### 2.4 ToS claim-driven vs BotC conversation-driven (Vibelm has neither)
- **ToS:** Day 2, the Town assembles. Trackers say "I followed X, they visited Y". Sheriffs say "I checked A, they were SUSPICIOUS". Most Town players *claim* their role (because the town must coordinate). Mafia *bluff* by claiming Town roles.
- **BotC:** the Storyteller asks questions publicly. "Do you have a Townsfolk ability?" "Do you have an Outsider ability?" "Do you have a Minion ability?" Players answer truthfully. The game is *conversation-driven*: making a claim is automatic; the question is *whose claim contradicts whose*. The Storyteller owns the calibration: a Town player who lies about their ability is identified.
- **Vibelm:** there's no in-game mechanism for *public claims*. The app's *only* "claim" is the role already on the paper card. The voting screen shows who is accused and who is guilty. The town is forced to speak for itself.
- **Consequence:** Vibelm plays more like BotC than ToS — but it lacks BotC's *calibrated questions*. There's no Storyteller asking "what is your ability?", so the *only* way to find out is to argue with other players about who they are.
- **Recommendation (L, RULE):** consider a "Day 1 public claim" step (one voluntary statement per player per day, written via the app and shown anonymously) — see §6 and §7.4 polish list.

### 2.5 No town position / no Bodyguard / no Investigator
- **ToS:** the Investigator is the *most informative* Town role. They learn a *pair* of roles (e.g. "one of A and B is the Framer"). The Town can narrow a target by naming the combination.
- **BotC:** the Investigator (Townsfolk) learns a *Minion* and an *irrelevant* player. The story is in the calibration.
- **Vibelm:** no Investigator. The closest roles are Tracker (1 person visited X), Lookout (who visited X), Consigliere (Mafia-only — learns exact role). The Town has *no "between two players" info role*.
- **Consequence:** the Town has fewer deduction points. The first night only produces *one* check (Sheriff) and *one* Mafia inspection (Consigliere) — three useful info bits max. BotC generates 6-7 info bits every night (Washerwoman, Librarian, Investigator, Chef, Empath, Fortune Teller, Undertaker, Spy, etc.).
- **Recommendation (L, DESIGN):** add a stub `town-informant` role inspired by the BotC Investigator: each night, learn "one of {A, B} is the ToS Investigator, the other is irrelevant" — see §7 polish list.

### 2.6 The "bluff" mechanic is one-sided
- **ToS:** no bluffs. The Mafia can claim any role.
- **BotC:** the Demon is *given* 3 Townsfolk bluffs (registration info) by the Storyteller at setup. The Demon knows exactly which 3 non-existent Townsfolk are "plausible" to claim.
- **Vibelm:** the Godfather is *given* 3 Town bluff roles at setup (GDD §2.2). The engine provides them in `state.gfBluffs` (interface.md, `seats.js:112-114`).
- **Consequence:** this is the *single best Vibelm mechanic from BotC*. The Godfather knows exactly which 3 Town roles are *not* in the deck and can claim them in town. The Town has to *verify* claims against the bar.
- **Recommendation (S, DESIGN):** the app already shows the bluffs on the seats screen (`seats.js:113`), but only after deal. Show a *persistent* GF-bluffs panel on the game screen that the moderator can glance at while the Godfather is being questioned. The bluff list is *gold* during the late game.

### 2.7 The Executioner target is a small dark alliance
- **ToS:** the Executioner (Neutral Evil) has a Town target. If the target is lynched, the Executioner wins. If the target is killed by any other means, the Executioner becomes a Jester.
- **BotC:** no exact analog. The **Politician** (in some editions) targets a player who must be executed; failure converts them to a Demonshire role.
- **Vibelm:** identical to ToS. The target is shown to the moderator (`seats.js:115-116`) and is *not* shown to the Executioner player's app record (correctly — the moderator whispers it).
- **Consequence:** when the target is *alive* on Day 2 and the Executioner is alive, the Town is suddenly diverging. A successful target push is a *single great speech by the Executioner*. The app shows the target on the seats screen *now* — but it's easy to miss if the moderator is in the middle of the night wizard.
- **Recommendation (M, DESIGN):** add a "Tonight's agenda" panel to the seats screen and the game screen that shows the Executioner's target name with a `TARGET` tag, so the moderator can whisper it at any time.

### 2.8 The Mafia kill is a single pick, not a decision
- **ToS:** the Godfather kills. The kill is one pick per night, Basic attack. The Mafia evening step is a *single wakeup* with both Godfather and Mafioso (Traditionals get one wake, Coven gets multiple).
- **BotC:** no Mafia analogue. The Demon (the Stalker or Imp) kills after the Storyteller wakes only the Demon.
- **Vibelm:** the Mafia step is *one* step (`07-night-resolution.js:85-117`) with a single kill pick. The wizard treats it as a single target pick (`wizard.js:163-179`).
- **Consequence:** there is no "two-Mafia discussion" moment. The Godfather points, the Mafioso carries. The moderator doesn't have to mediate the Mafia's internal argument.
- **Recommendation (S, DESIGN):** consider letting the moderator *swap* the kill at the wizard step (an "Undo" button). Right now changing the mafia kill requires a wizard back-to-back (which the app allows — `wizard.js:208`), but not an explicit "change mind" gesture.

### 2.9 The Witch is the only "I'm controlling someone" role
- **ToS:** the Witch controls one player per night. The control fails if the target is currently jailed. The Witch learns the controlled player's role.
- **BotC:** the Witch (Minion) controls one player per night. The control fails if the target is in the Storyteller's jail (the Storyteller doesn't have one — but Mechanically the Witch is just a Minion).
- **Vibelm:** identical to BotC. The Witch's role is *revealed* in the wizard step (`wizard.js:74-80`) and the Witch's revealed role is shown to the moderator.
- **Consequence:** the Witch is the *only* role that *redirects* the kill. This is a high-leverage mechanic — the Witch can redirect the Godfather once and then be lynched. The app surfaces the redirected role visibly (`06-night-actions.js:30`).
- **Recommendation (S, DESIGN):** the wizard's "witch learnt role" message is currently logged in `state.logs` (`06-night-actions.js:28`); also show it briefly on the moderator's screen right after the wizard step resolves, so the moderator can whisper it accurately.

### 2.10 The Drunk is permanently disabled
- **ToS:** no Drunk.
- **BotC:** the Drunk (Townsfolk) is given a Townsfolk ability card, but the card is actually blank — the player *thinks* they're a Fortune Teller or Slayer, but they're not. The Storyteller enforces the truth.
- **Vibelm:** matches BotC. The Drunk role is permanently Drunk, all abilities disabled (GDD §2.3, §6.2). The engine sets `isDrunk = true` for the Drunk role every night (`07b-night-resolution.js:75-86`).
- **Consequence:** the Drunk is *purely a social role*. The moderator enforces that the player never acts. The app *visibly* flags the Drunk with the `[DRUNK]` tag on the seat tile (`ui/common.js:62-78`).
- **Recommendation (S, DESIGN):** in the night wizard, when the moderator arrives at a step that would include the Drunk, the wizard should *skip* the Drunk (which it does — `getNightSteps` filters by `hasLivingRole` and the Drunk has no role-based action). Already handled. *No action needed.*

---

## 3. Information-flow analysis

The Information-flow question is the heart of a social deduction game: *who knows what, when, and how does the moderator deliver it?* ToS broadcasts via the engine; BotC has the Storyteller whisper; Vibelm has the moderator whisper using the app.

### 3.1 The night wizard prompt

The night wizard (`js/ui/wizard.js:144-212`) walks the moderator through position 0–14, showing:

- The step title (e.g. "Sheriff")
- The prompt (e.g. "Sheriff, open your eyes. Point to the player you check.")
- Target buttons (one per living player)
- Result indicator (the *Moderator* is shown the result — the engineer reads `[Sheriff] Alice checks Bob: SUSPICIOUS` from the resolveNight log)
- An optional timer (e.g. 30s for Medium, 60s for dead Medium seance)

**Where the app surfaces information right (and the moderator is well-served):**

- `state.gfBluffs` is shown on the seats screen (`seats.js:113`) — the Godfather has been told them at deal.
- `state.executionerTarget` is shown on the seats screen (`seats.js:115`) — the Executioner has been told at deal.
- The Witch's *revelation* (the role of the controlled player) is logged into `state.logs` (`06-night-actions.js:28`) — visible in the Event Log card.
- The Consigliere's *learned role* is logged into `state.logs` (`06-night-actions.js:233-234`) — visible.
- The Undertaker's *inspected role* is logged into `state.logs` (`06-night-actions.js:243-244`) — visible.
- The Lookout's *visitors* is logged into `state.logs` (`06-night-actions.js:314-316`) — visible.
- The Tracker's *followed-to* is logged into `state.logs` (`06-night-actions.js:303-305`) — visible.

**Where the app *fails* to surface information:**

- The Sheriff's result is logged (`Sheriff checks Bob: SUSPICIOUS`) but the moderator must *physically scroll* to the log to find it. **Recommendation (M, DESIGN):** show the Sheriff/Tracker/Lookout/Consigliere/Undertaker results in a *primary result card* that appears after the wizard step resolves, with a "Show player" button that opens the Whisper sheet to that player.
- The Poisoner's *poisoned target* is logged (`06-night-actions.js:16`) but the [POISONED] status tag on the seat tile (`ui/common.js:69`) doesn't actually persist between days — `isDrunk` is reset at night (`07b-night-resolution.js:75-86`). The status tag on the *current night* is correct; on the *next day* it's wiped. **Recommendation (S, CODE):** retain `poisoned` for the day cycle, not just the night.
- The Blackmailer's *blackmailed target* is silenced on the *next* day only (`beginDay` engine `09-day.js:23-37`). The `[BLACKMAILED]` tag is shown on the seat tile (`ui/common.js:73`) but the day-view doesn't show *which* players are silenced today. **Recommendation (S, DESIGN):** add a "Today's silenced players" notice at the top of the day view.
- The Witch's *declared mafia-side* (GDD §2.3) is handled by the seats screen toggle (`seats.js:118-123`), but the moderator has to *ask* the Witch before the game starts. This is a player-protocol obligation, not an app responsibility. **Recommendation (S, DESIGN):** add a Night Zero checklist step (§5) that includes "Whisper Witch side" so it's not forgotten.
- The Forger's *forged target* is shown in the morning announcement (`day.js:50-53`) but the *forged will* is on the paper card. The moderator must remember which player had their will forged. **Recommendation (S, DESIGN):** add a "Forged tonight" reminder on the morning screen that names the player *and* the player whose will was forged.
- The Veteran alert is *recorded* as a `[ALERT]` tag on the seat tile (`ui/common.js:71`) but the *alert count* (0–3) is only visible on the player detail sheet. **Recommendation (S, DESIGN):** show the warning when the Veteran is on their 3rd alert — they're about to lose the ability.

### 3.2 The morning announcement (mystery mode)

The morning view (`day.js:45-72`) shows:

- Forged will reminders (one per forged will)
- Revivals (one per revived player)
- Inheritance note (Deputy-inherits-Sheriff)
- Death cards (player name + role-shown-as-`?? UNKNOWN ??`, unless `classicReveal` is on)

This is exactly the BotC breakfast: the town wakes up, the moderator reads the names, the moderator reads the wills (off the paper cards), and the dead are mysteries until the end of the game. The critical missing piece is the *list of will-reading* — the moderator must remember the order. **Recommendation (S, DESIGN):** add a "Read in order" tick-list on the morning card.

The *forged will* handling is tested (`tests/game-loop.test.js` — the "Wizard-back re-recording" case, `SESSION-REPORT.md:110`) but the *forged-target* card is a brief notice, not a checklist. **Recommendation (S, DESIGN):** add a `forged-by-X` chip to the death card so the moderator knows *which* will to read.

### 3.3 The death store vs the seat-tile store

The app keeps two representations of a dead player:

- `state.players[]` — the player object, with `isAlive: false` and all the status flags (some reset, some kept).
- `state.graveyard[]` — a tombstone record (`{ playerId, name, trueRole, inspectedByUndertaker, wasCleaned, deathCause }`) — `07-night-resolution.js:63-71`.

The Undertaker's inspection is keyed on the *graveyard entry* (`06-night-actions.js:237-246`). The `wasCleaned` flag is set on the *graveyard entry* when the Janitor cleans. The seat-tile (`ui/common.js:62-78`) shows the *per-player flags* (kept across the night). The player detail sheet shows the *playerLog* (newest first).

**Where the app is inconsistent:** the *Forger's forged-will* is keyed on the *player ID* in `state.morning.forgedWills` (`09-day.js:19`), but the *graveyard* entry is the right place to thread it (since the Forger forges *a player's will* and the forged will is read *if the player dies*). The current logic is in `getMorningAnnouncement` (`09-day.js:5-21`) — but the *forged target* is shown only as a name, not as a player-card. **Recommendation (S, CODE):** change the morning screen to show the *forged target's seat tile* (so the moderator can see the role that was forged *for* them), not just the name.

### 3.4 Bluffing, the Witch, and inherited info

The Witch's *declared side* is `state.witchSide` (default MAFIA, `config.js` / `interface.md`). The seats screen has a toggle (`seats.js:118-123`) that the moderator uses *before* the game starts. **What happens if the moderator forgets to ask the Witch?** Per the GDD §2.3, the Witch defaults to Mafia and counts as Mafia-aligned for victory. The app *doesn't* remind the moderator to ask.

**Recommendation (L, RULE):** add a Night Zero checklist (§5) that includes "Whisper Witch side" explicitly.

### 3.5 The Deputy inheritance moment

The Deputy inherits the Sheriff's badge when the Sheriff dies (engine `07-night-resolution.js:94-102`). The morning view shows the inheritance note (`09-day.js:58-60`). The seat tile shows `[INHERITED SHERIFF]` (`ui/common.js:67`).

**Where the app is excellent:** the inheritance is *announced publicly* at the morning — exactly per GDD §7.4. The moderator must read the note aloud.

**Where the app is fragile:** the next night, the position-11 step includes the *inherited Deputy* (`05-night-steps.js:34-43`). The wizard prompt is the *Sheriff's prompt* — but the actor is now the Deputy. The prompt does not say "you inherited the badge", it just says "Sheriff, open your eyes". **Recommendation (S, DESIGN):** when the inherited Deputy acts, the prompt should read "Deputy (inherited Sheriff), open your eyes."

### 3.6 The Forger's stale will

Per GDD §7.2, the Forger forges a *fake* will for one player. If the player dies *before the next morning*, the forged will is read instead of the true one. The forged will is on the *paper card* of the target — the moderator must remember who the Forger has been forging for, what the fake will says, and *read that one* when the target dies.

**The app surfaces the forge:** the morning notice (`day.js:50-53`) and the playerLog entry (`06-night-actions.js:145-146`). The *forged target* is kept in `state.morning.forgedWills`. **The app doesn't keep the forged will text** — and per the "companion mode" rule, it *shouldn't* (the will is read from the paper card). **Recommendation (S, DESIGN):** add a "Forge for X" reminder *on the death card* of any player who was previously forged for — so the moderator knows they should read the forged will, not the true one.

### 3.7 The Consigliere's Drunk inversion

The Consigliere under Drunk inversion gets a *random role of a different alignment* (`06-night-actions.js:228-232`). The moderator has to whisper the *false* role to the Drunk Consigliere. The app correctly logs the false role into `state.logs` (`06-night-actions.js:234`), but the *seat tile shows the Drunk flag* (`ui/common.js:67`) — so the moderator knows the *true* result was inverted.

**Recommendation (S, DESIGN):** show the *inversion note* in the Consigliere's result. Right now the log says "Consigliere learns the role of Bob: Doctor" but doesn't say "this is inverted because the Consigliere is Drunk." **Recommendation (S, DESIGN):** add a `INVERTED` chip to the Consigliere result when the actor is Drunk.

### 3.8 The Undertaker's Janitor-blind check

The Undertaker cannot inspect a Janitor-cleaned corpse. The engine *correctly* refuses (`06-night-actions.js:239-241`). The moderator needs to know *why* the Undertaker was skipped — so the corpse button is shown but the action is logged with "no inspection" or no log entry. **Recommendation (S, DESIGN):** when the wizard step is the Undertaker, mark a cleaned corpse button as `[CLEANED]` so the moderator knows why the Undertaker can't act on them.

### 3.9 The Voting screen at a glance

The day view (`day.js:21-43`) shows:

- Discussion timer (60/120/180s)
- Day abilities (Vigilante, Deputy, Mayor)
- Trial UI (start-trial button, then SECONDS stage, then VOTE stage)
- Event Log card

**Where the app is excellent:** the seconds tally (`day.js:128-137`) shows the live count of agreements vs the needed threshold. The vote tally (`day.js:102-117`) shows the live Guilty/Innocent/Abstain chips. The ghost-tokens line (`day.js:119-126`) lists the players who still have a token.

**Where the app is fragile:** the trial UI doesn't show *who* seconded or *how* everyone voted *until the trial is over*. In a 15-player game, the moderator must remember each player's gesture. **Recommendation (M, DESIGN):** add a "Who voted what" panel that shows the tally in real-time and a "Show nominees" history. The current implementation only shows *who voted in the seconds round* after the trial is resolved; the moderator needs to *track* the seconds round manually.

### 3.10 The "previous-day, current-day" transitions

The blackmailer's target is silenced *the next day* — the engine stores the silenced target in `state.morning.blackmailTarget` (`09-day.js:24-37`) and re-applies the silenced flag on `beginDay`. The seat tile shows `[BLACKMAILED]` (`ui/common.js:73`). The day view has no *banner* showing "X is silenced today" — so the moderator must look at the seat tiles individually. **Recommendation (S, DESIGN):** add a top-of-day banner "Today's silenced: X" that disappears when the day ends.

---

## 4. Trial / lynch deep dive

The current trial flow is BotC-style two-stage: **nomination → SECONDS → strict-majority acceptance → VOTE**. The current SECONDS math is `floor(living/2) + 1` (i.e. 6 living need 4, 5 living need 3) — `09-day.js:108-116`. The nominator auto-counts as agreeing (`09-day.js:110`).

### 4.1 ToS vs BotC vs Vibelm

| Detail | ToS | BotC | Vibelm |
|---|---|---|---|
| Vote = simple majority (GUILTY > others) | yes | yes (TINKLES) | yes (`09-day.js:142-148`) |
| Nominator auto-agrees | n/a | yes | yes (`09-day.js:110`) |
| Strict majority of living to proceed | n/a | yes | yes (`09-day.js:108-109`) |
| Ghost tokens in VOTE stage only | n/a | yes | yes (`09-day.js:83-90`) |
| Ghost tokens cannot second | n/a | yes | yes (CastVote rejects non-living voters in SECONDS, `09-day.js:67-69`) |
| At most one lynch per day | n/a | yes | yes (`09-day.js:47-48`, `dayTrialsDone`) |
| Survived/cancelled trial doesn't count | n/a | yes | yes (only `++` on LYNCHED, `09-day.js:154`) |
| Day 1 no execution | house rule (common) | enforced | configurable via `noLynchD1` house rule |
| Tie acquits | yes | yes | yes (`guilty > others` strict) |
| Mayor weight × 3 on vote | yes | no | yes (`09-day.js:142-144`) |
| Accused may defend | n/a | yes | not visibly; the moderator doesn't have a "Speaker queue" |
| Jury / deliberation | n/a | no | no |
| Abstain is a vote | yes | yes | yes (`09-day.js:84`) |

### 4.2 The strict-majority math is slightly off

The current math is `floor(living / 2) + 1` (`09-day.js:108-109`). For *living* players:

- 6 living → need 4 (correct: > 3 = strict majority of 6)
- 5 living → need 3 (correct: > 2.5 = 3)
- 4 living → need 3 (correct: > 2)
- 3 living → need 2 (correct: > 1.5 = 2)
- 2 living → need 2 (correct: > 1 = 2)
- 1 living → need 1 (correct: > 0.5 = 1)

The math is correct for *strict majority*. **But the BotC rule is "strict majority of LIVING players"** and the calculation does include the nominator. The bug surface is `floor` for *even* counts — for 6 living, `floor(6/2)+1 = 4`, which is exactly half but is the smallest *strict majority* of 6. **Correct.**

The subtler issue: with `noLynchD1: true` (house rule), the trial proceeds to vote but no lynch is possible (`09-day.js:147-148`). The town can still *discuss* the nomination. The current implementation returns `result: 'SURVIVES'` on a tied vote — but for *NoLynch D1*, it ALSO returns `SURVIVES`. The user-facing difference is only the message in the notice. **Recommendation (S, DESIGN):** the result notice should distinguish "Tie (acquitted)" from "Day 1 no-lynch rule". Today it just says "the accused survives" — could be either.

### 4.3 The BotC nominator auto-agrees quirk

BotC does not allow the *accused* to second. The current code excludes the accused (`09-day.js:114`), but it allows the *nominator* to literally "second" themselves — the `agree` count starts at 1 (`09-day.js:110`). The correct analogy: the nominator is *already* in. The current code does *not* show the nominator's "Agree" button in the UI (`day.js:190-194`) — the button is shown as a disabled `Agree` (a11y hint). **Correct.**

**Where the app is fragile:** the "nominator" identity is stored in `state.trial.nominatorId` (interface.md). If the nominator dies *during the trial* (e.g. a Veteran alert wakes them and they die), the *seconds round* still counts them. **Vibelm does not currently model nominator death during the trial.** This is a small edge case but it's a real bug. **Recommendation (S, RULE):** if the nominator dies between nomination and resolution, the trial should still proceed but the `agree` count should be decremented.

### 4.4 The "Day 1" problem

Day 1 with `noLynchD1: true` allows nominations but no lynch. This is *exactly* BotC's "first day is informational". The current implementation has the correct rule (`09-day.js:147-148`) but the *user-facing message* (`day.js:147-148`) is "Not enough guilty votes — the accused survives." This is misleading — the trial *had* a guilty majority, but the day-1 rule blocked it. **Recommendation (S, DESIGN):** distinguish "Tie" / "No lynch D1" / "Acquitted" in the trial result notice.

### 4.5 Ghost vote timing

Per GDD §8.4, ghosts vote in the *verdict stage* only. The current implementation: `castVote` accepts ghost votes only in `state.trial.stage === 'VOTE'` (`09-day.js:83-90`). In the SECONDS stage, the voter must be alive (`09-day.js:69`). **Correct.**

**Where the app is fragile:** the *ghost token* is spent even if the verdict is `ABSTAIN`? No — `E._spendGhostVote` (`08-ghosts.js:23-29`) refuses to spend on `ABSTAIN`. **Correct.**

**Where the app is fragile:** the *ghost votes* are shown in the live tally (`day.js:222-235`) but the *ghost* cannot toggle their vote off (the `ABSTAIN` button is hidden for ghosts — `day.js:232`). But the ghost *can* change their vote *while* the trial is in VOTE stage. If the ghost wants to *change* their vote, they can tap another button. **Correct.**

**Where the app is fragile:** the ghost vote is *not* subtracted from the tally if the ghost *changes* their mind in the same round. The current implementation re-records the vote (`09-day.js:91-95`) but the *token* is still spent — the second vote doesn't re-spend. **Correct.**

### 4.6 The "failed nomination" handling

When a nomination is cancelled (insufficient seconds), the trial closes (`09-day.js:125-126`) and the day continues. The current implementation:

- Returns `result: 'CANCELLED'` (`09-day.js:132-135`)
- Logs `'The nomination of X failed to gather enough seconds.'` (`09-day.js:127-128`)
- Logs the accused as `'acquitted'` (the playerLog kind)
- *Does not* increment `dayTrialsDone` (because no lynch happened)

The user-facing notice is `<strong>Nomination failed</strong> - not enough support.` (`day.js:145-146`). After the notice, the user taps "OK" (`day.js:159`) and the day continues. **Correct.**

**Recommendation (M, DESIGN):** the *failed* nomination should be visible in the day's log. Currently the `state.trial.nominatorId` and `state.trial.accusedId` are cleared on cancellation, so the *history* is lost. The engine logs the cancellation into `state.logs` (`09-day.js:127`), but the visual Event Log card is *collapsed by default* (`day.js:294-302`). A first-time moderator will miss the outcome. **Recommendation (S, DESIGN):** add a "Failed nominations today" notice on the day view.

### 4.7 Tie acquittal

The current rule: `guilty > others` strict (`09-day.js:148`). A tie acquits. The current implementation correctly returns `result: 'SURVIVES'` on a tie (`09-day.js:186-194`). The user-facing notice is "Not enough guilty votes — the accused survives." (`day.js:147-148`). **Correct.**

**Where the app would benefit from a UI polish:** the *live tally* doesn't show the *threshold* (i.e. "you need 4 guilty votes to lynch"). The current tally shows three chips (`GUILTY n`, `INNOCENT n`, `ABSTAIN n`) but no "needed" indicator. **Recommendation (S, DESIGN):** add a "Need k more guilty" pill on the VOTE stage.

### 4.8 The "moderate the trial" UX

The moderator is *the trial judge*. They have to:

1. Run through the nominations (if multiple).
2. Record seconds from each living player.
3. Decide if the nomination passes.
4. Record votes from each living player (and ghost token voters).
5. Apply the outcome.

The current trial UI (`day.js:139-241`) gives the moderator a *single screen* that toggles between SECONDS and VOTE stages. The "Resolve Nomination" button (`day.js:202`) is *sticky* at the bottom — the moderator taps it to advance.

**Where the app is fragile:** the moderator has to *remember* who voted what *during* the round. The current UI doesn't show *who already voted* during the seconds round (the buttons just toggle on/off, but the order isn't visible). **Recommendation (M, DESIGN):** add a "Seconds so far" line per player — `Alice: AGREE`, `Bob: DISAGREE`, `Charlie: ???` — so the moderator can run the seconds round quickly.

### 4.9 The "no remainder" math

In BotC, the *strict majority* rule is for the *nomination* to pass, not for the *vote*. The vote is "GUILTY > others" — which doesn't require a strict majority (just strictly more than the other side). The current implementation has both rules (`09-day.js:108-116` for nomination, `09-day.js:147-148` for vote). **Correct.**

### 4.10 The "wakes up the accused" problem

In BotC, the accused *must not* be roleblocked when their trial happens (this is a non-issue for Vibelm since trials are during the day). But the *accused* is dead by the morning — they can't second their own nomination. The current code excludes the accused from seconding (`09-day.js:114` and `day.js:181`). **Correct.**

---

## 5. Night 1 / first-day problem (the *highest-value* recommendation)

This is the single most impactful gameplay change you can make to Vibelm. The current flow is:

1. Seats dealt view (Day 1 prep)
2. **Day 1 first** (no kills yet, no info beyond what's in the deck)
3. Night 1 (wizard)
4. Morning (deaths, but the NoKillN1 default means no deaths)
5. Day 2 (now with info)
6. Night 2 etc.

The *first* day has *no information to work with*. The town is sitting in a circle wondering what's about to happen. The moderator is whispering bluffs and Witch side and Executioner targets while the players wait. This is the *highest-leverage moment* to give the moderator a structured ritual.

### 5.1 The "Night Zero" checklist

The BotC analogue is the Storyteller's first-night setup: before the eyes are closed, the Storyteller distributes the grimoire, the Demon, the Minions, and the *calibrated* first-night info. The Vibelm analogue is the moment between "Lock Roles" and "Begin Day 1".

**Recommendation (L, DESIGN + CODE):** add a "Night Zero / Prep" screen that the moderator walks through after `Lock Roles` and before `Begin Day 1`. The screen is a checklist with the following items, each with a tap-to-confirm:

| # | Item | Whisper script (from GDD §12.1) | Source |
|---|---|---|---|
| 1 | GF bluffs | "The Godfather is given three Town bluffs to claim. They are: [Bluff 1], [Bluff 2], [Bluff 3]." | `state.gfBluffs` (seats.js:113) |
| 2 | Executioner target | "The Executioner is told their target. The target is [Player X]." | `state.executionerTarget` (seats.js:115) |
| 3 | Witch side | "The Witch is asked privately whether she sides with Town or stays with Mafia by default." | `state.witchSide` (seats.js:118-123) |
| 4 | Medium alive briefing | "The alive Medium is told about the Ghost Ledger and the 60-second dead-seance whisper." | GDD §2.1 |
| 5 | Retributionist briefing | "The Retributionist is told they may revive a dead player once per game." | GDD §2.1 |
| 6 | Amnesiac briefing | "The Amnesiac is told they may remember a dead player's role once per game." | GDD §2.3 |
| 7 | Spy briefing (if any) | n/a — Vibelm has no Spy |
| 8 | Jester briefing | "The Jester is told they win when lynched. They become a taunting ghost with no ghost vote token." | GDD §2.3 |
| 9 | Serial Killer briefing | "The Serial Killer is told they win when last standing or holding majority." | GDD §2.3 |
| 10 | Survivor briefing | "The Survivor is told they win if alive at game end." | GDD §2.3 |
| 11 | The Drunk briefing | "The Drunk is told they have no ability and must not act at night." | GDD §2.3 |
| 12 | Ambiguous roles briefing | "Any role with a 'may not know' line is briefed." (e.g. the Sheriff knowing they read INNOCENT to the Godfather) | GDD §2.1 |
| 13 | First-day discussion format | "The town is given the Day 1 format: open discussion, no votes, no abilities in use." | GDD §12.3 |
| 14 | Seat layout confirmed | "The town is told where to sit." | seats screen |
| 15 | Wills on paper | "Every player has a paper card. Write a last will. Update it after every informative night." | GDD §7.2 |

This is *the* single most valuable DESIGN + CODE change in the report. The app already has *all* the data — it just doesn't present it as a structured ritual.

### 5.2 Why this is a "Night Zero" and not a "Day 1 prep"

A "Night 1 prep" is misleading because there's no night yet — the moderator is doing setup. The BotC term is "the Storyteller setup" (between assembly and First Night). The Vibelm idiom should be "Night Zero" (the moment before Night 1).

### 5.3 The "First Day" question

Should the *first* day have any content? Currently it's blank. BotC has a "first day is informational" with no votes (this is the `noLynchD1` rule). Vibelm's default is `noLynchD1: false`, which means Day 1 *can* have a lynch. The mismatch is real: Day 1 has no info to lynch on.

**Recommendation (M, RULE):** change the default to `noLynchD1: true` (and add a banner explaining "Day 1 is informational"). This matches BotC's first-day rule and avoids the chaotic "lynch on a hunch" of ToS.

### 5.4 What the moderator needs to *prepare* for Day 1

The moderator needs to know:

1. Who is in the deck (visible in the deck builder).
2. Which roles are "loud" — the Jailor (can execute N+1), the Veteran (can alert), the Vigilante (can shoot today), the Deputy (can shoot today), the Mayor (can reveal today).
3. Which roles are "silent" — the Doctor, the Sheriff, the Investigator family, the Mafia.
4. Which roles are "chaotic" — the Witch, the Serial Killer, the Jester.

**Recommendation (M, DESIGN):** add a "Today's subtle players" hint that the moderator can show the *living* players during the day (e.g. "the Investigator and the Sheriff are among you — they may speak"). This is a *BotC* move: the Storyteller prompts public claims.

---

## 6. Readability of roles during play

The current app has *excellent* role *reference* documentation (`js/ui/reference.js` + `styles/reference.css`) — but the moderator spends most of the game looking at the *night wizard* and the *day view*, not the reference.

### 6.1 What the moderator sees during play

- **Night wizard step:** title, prompt, target buttons, result log.
- **Morning view:** death cards, inheritance notes, forged will reminders.
- **Day view:** discussion timer, day abilities, trial UI.
- **Seat overlay:** all 15 tiles with name, role, status tags.
- **Player detail sheet:** name, role, blurb, status tags, playerLog entries.

### 6.2 What the moderator needs but doesn't have

- **"Who knows what"** — for each player, what info have they received this game? The current playerLog (`renderDetailSheet`, `seats.js:179-187`) shows the log entries — but they're *by event*, not by *info held*. A moderator needs to know "Alice the Sheriff has SUSPICIOUS on Bob" — not "Alice acted on Bob at N+1".
- **"Whose info is stale"** — the Drunk Consigliere got a *false role* on Night 1. By Night 3 the Consigliere *still acts Drunk* (the Drunk status persists). The moderator needs to know "this Consigliere's info is unreliable".
- **"Whose info is true"** — the Sheriff's INNOCENT on Bob is true *unless* Bob was framed. The moderator needs to know that the Framer chose Bob tonight.
- **"What to whisper to whom"** — the moderator has to whisper *exactly* "The Sheriff checked Bob tonight: SUSPICIOUS" — but the app's log says "Sheriff checks Bob: SUSPICIOUS" with no player name. A first-time moderator will say "and the result was SUSPICIOUS" without naming the target.

**Recommendation (L, DESIGN):** add a "Tonight's whispers" panel that the moderator can swipe to during the night. Each entry is one whisper per player:

```
[Night 1 — 2026-08-12]
  To Alice (Sheriff): "Bob is SUSPICIOUS."
  To Alice (Sheriff, Drunk): "Bob is INNOCENT." (suspicious inverted)
  To Charlie (Consigliere): "Dave is the [Framer]."
  To Eve (Tracker): "Frank visited Grace."
  ...
```

This is the *single most valuable readability change* in the whole report. The data is already in `state.logs` — it just needs to be *filtered* to per-player whispers.

### 6.3 The Forger's forged will on the morning card

The current morning card (`day.js:50-53`) shows:

> A will was forged for [Player X].

This is *correct* but the moderator must remember which player had their will forged AND read the forged will instead of the true one. **Recommendation (S, DESIGN):** when a death card is shown for a player whose will was forged, add a "FORGED WILL" badge to the card so the moderator reads the right one.

### 6.4 The Sheriff's "after the framing" rule

The Framer sets a target to read SUSPICIOUS. The Sheriff reads the target → SUSPICIOUS. But a *Drunk* Sheriff inverts the result → INNOCENT. The moderator must remember *both* the Framer's target and the Sheriff's target to know whether the SUSPICIOUS is from the Framer or from the real Mafia. **Recommendation (M, DESIGN):** show the Sheriff's result *with* the Sheriff's Drunk status and the Framer's target name in the night's whispers panel.

### 6.5 The "what's the morning in one line" summary

The current morning view is a list of *deaths* + *revivals* + *inheritance*. The *player* who died is a card. But the moderator must also whisper "the Mafia's target was Bob" — except the *Mafia's target* is *not* shown to the moderator unless they're an aligned member. The moderator must read the log to know. **Recommendation (M, DESIGN):** add a "Night summary" card at the top of the morning view that shows the *resolved* actions (who died, who was framed, who was poisoned, who was blackmailed, who was jailed) — separate from the *what to tell the town* (just the deaths).

---

## 7. Scorecard

### 7.1 ToS-style claim gameplay: **4/10**

**Top 3 reasons:**

1. **No public claim mechanism.** The Town has no way to *publish* a claim. BotC's "public claim" is invisible to Vibelm. ToS relies on a chat box; Vibelm has nothing.
2. **No pairwise info role.** The Investigator (ToS) and the BotC Investigator (Minion + Townsfolk info) are both missing. The Town's *only* info roles are Sheriff, Tracker, Lookout, Consigliere, Undertaker.
3. **Roles are *too mechanically complete*.** ToS roles are *spiky* (the Investigator is overpowered, the Escort is weak). Vibelm roles are *balanced* — meaning the Town's information density is low. ToS compensates by letting the Town *claim* — Vibelm doesn't.

### 7.2 BotC-style storyteller gameplay: **7/10**

**Top 3 reasons:**

1. **The night wizard is a real BotC ritual.** The app walks the moderator through positions 0-14, wakes each role individually, and shows the result. This is *exactly* what the Storyteller does.
2. **The trial is a real BotC ritual.** SECONDS → VOTE → strict majority → tie acquits. The botC behaviour is in the engine.
3. **Mystery deaths, ghost tokens, the Jester haunt, the Witch side toggle, the Godfather bluffs** — all the *BotC flavour* mechanics are there.

**Why not 8 or 9?**

- **No Night Zero** (the single biggest gap).
- **No calibrated-question prompt** ("are you able to be a Consigliere?").
- **No "today's subtle players"** hint.
- **The "Tonight's whispers" panel is missing** (see §6.2).

---

## 8. Recommended changes for polish (CODE / DESIGN / RULE, sized S/M/L)

### 8.1 Night-zero / prep ritual (the single highest-value recommendation)

1. **L, DESIGN + CODE:** add a "Night Zero / Prep" screen after `Lock Roles` and before `Begin Day 1`. 15-item checklist, each with a whisper script. The data is already in `state` — just needs to be presented as a structured ritual. Files: new `js/ui/prep.js` + `styles/prep.css`; navigation: `js/app/actions-seats.js` (replace `Begin Day 1` button with a "Next: Prep" → "Begin Day 1" flow).

### 8.2 Night wizard

2. **M, DESIGN:** show the *night's results* in a sticky banner at the top of the night wizard *between* positions. Each result is one line per whisper-target. Files: `js/ui/wizard.js:144-212` for the body, `js/ui/common.js` for a new helper.
3. **S, DESIGN:** for the position-11 step (Sheriff), the prompt should read "Sheriff" or "Deputy (inherited Sheriff)" depending on who is acting. Files: `js/engine/05-night-steps.js:34-43`.
4. **S, DESIGN:** mark cleaned corpses as `[CLEANED]` in the Undertaker's button list so the moderator knows why the action is refused. Files: `js/ui/wizard.js:47-57`, `js/ui/common.js:62-78`.
5. **S, DESIGN:** show the *forged target* on the Forger's step so the moderator knows what's been forged. Files: `js/ui/wizard.js:96-103`.
6. **S, CODE:** add a "previous step" button to the wizard's *first* step (currently hidden, `js/ui/wizard.js:207-209`). Some moderators may want to re-confirm the Veteran alert.
7. **M, CODE:** at the end of the wizard, before Resolve Night, show a *summary card* listing every recorded action and the Sheriff/Tracker/Lookout/Consigliere/Undertaker results. Files: `js/ui/wizard.js:144-212` (new section before Resolve Night).
8. **S, DESIGN:** the Poisoner's poisoned target should retain the `[POISONED]` tag for the *next day* (not just the current night). Files: `js/engine/07b-night-resolution.js:75-86` (the `poisoned = false` reset), `js/ui/common.js:69`.
9. **S, DESIGN:** when the Veteran is on the 3rd alert, show a warning chip. Files: `js/ui/wizard.js:70-74` (Veteran branch).
10. **S, DESIGN:** the Consigliere's Drunk result should show `[INVERTED]` next to the result. Files: `js/ui/wizard.js:133-136` (default `Point to your target` branch — override for Consigliere).

### 8.3 Morning view

11. **S, DESIGN:** when a death card is for a player whose will was forged, add a `[FORGED WILL]` badge. Files: `js/ui/day.js:61-67`.
12. **S, DESIGN:** add a "Read in order" tick-list on the morning card that the moderator checks off as each will is read. Files: `js/ui/day.js:45-72`.
13. **M, DESIGN:** add a "Today's silenced players" banner at the top of the day view. Files: `js/ui/day.js:21-43`.
14. **S, DESIGN:** the morning card should distinguish "Tie" / "No lynch D1" / "Acquitted" user-facing messages. Files: `js/ui/day.js:147-148`.

### 8.4 Day view

15. **M, DESIGN:** add a "seconds so far" line per player during the SECONDS round so the moderator can run the round quickly. Files: `js/ui/day.js:180-201`.
16. **S, DESIGN:** add a "failed nominations today" notice on the day view. Files: `js/ui/day.js:21-43`.
17. **S, DESIGN:** add a "Need k more guilty" pill on the VOTE stage. Files: `js/ui/day.js:209-237`.
18. **M, DESIGN:** add a "Who voted what" panel that shows the live tally during the vote (already exists via `tallyChips`, but should also show a per-player visualization). Files: `js/ui/day.js:209-237`.
19. **M, RULE:** change the default `noLynchD1` to `true` (matches BotC). Files: `js/app/config.js:42`.
20. **L, RULE:** add a "Day 1 public claim" step — each living player makes ONE voluntary statement, written via the app and shown anonymously. Files: new `js/ui/claim.js` + `styles/claim.css`. This is the single biggest gameplay improvement for BotC-style play.

### 8.5 Seat tiles

21. **S, DESIGN:** the seat tile should show the *execution count* for the Jailor (0-3) when the Jailor is on the tile. Files: `js/ui/common.js:62-78`.
22. **S, DESIGN:** the seat tile should show the *Vigilante shots remaining* (0-3) when the Vigilante is on the tile. Files: `js/ui/common.js:62-78`.
23. **S, DESIGN:** add a `TARGET` tag to the Executioner's target (the moderator's view). Files: `js/ui/common.js:62-78`.

### 8.6 Engine rules

24. **S, RULE:** if the nominator dies during the trial, decrement the `agree` count. Files: `js/engine/09-day.js:108-116`.
25. **S, RULE:** add a `result` reason for the trial outcome (tie / no-lynch-D1 / no-guilty / lynch). Files: `js/engine/09-day.js:142-194`.
26. **M, RULE:** add a `house-rule: stubbornToSClaims` toggle that enables a ToS-style "open claim chat" through the app. Files: `js/app/config.js`, `js/app/actions-game.js`.
27. **M, RULE:** add a `house-rule: lynchSecret` toggle that hides the trial votes from the town until resolution. Files: `js/app/config.js`, `js/ui/day.js`.
28. **L, DESIGN:** add a `town-informant` role (BotC Investigator analogue) — "each night, learn one of two players is the ToS Investigator (the other is irrelevant)." Files: new `js/engine/01-roles.js` entry, new `js/engine/05-night-steps.js` step, new `js/engine/06-night-actions.js` resolver.
29. **L, DESIGN:** add a `spy` role (BotC Spy analogue) — "Mafia minion that learns a blurb about a random player each night." Files: new `js/engine/01-roles.js` entry, new `js/engine/05-night-steps.js` step, new `js/engine/06-night-actions.js` resolver.
30. **M, RULE:** add a `rule: noFramerDrunkInvert` toggle — by default, a Drunk Sheriff inverts the Framer's result (per current GDD). Some groups may want to *not* invert (ToS default). Files: `js/app/config.js`, `js/engine/06-night-actions.js:212-215`.
31. **S, CODE:** the morning's forged-wills list should show the *forged target's* seat tile, not just the name. Files: `js/engine/09-day.js:5-21`, `js/ui/day.js:50-53`.
32. **M, CODE:** add a "Tonight's whispers" panel that the moderator can swipe to between night steps. Files: new `js/ui/whisper.js` + `styles/whisper.css`.

### 8.7 Player detail sheet

33. **S, DESIGN:** the playerLog should be filterable by `kind` (night-action, death, poison, jail, etc.). Files: `js/ui/seats.js:179-187`.
34. **S, DESIGN:** the player detail sheet should show the *current* info the player holds (e.g. for the Sheriff: "Bob is SUSPICIOUS"). Files: `js/ui/seats.js:161-189`.
35. **M, DESIGN:** the player detail sheet should show *stale info* (e.g. "this Consigliere's info is inverted because the Consigliere is Drunk"). Files: `js/ui/seats.js:161-189`.

### 8.8 Setup screen

36. **M, DESIGN:** add a "Quick start" button on the setup screen that creates a default 8-player setup. Files: `js/ui/setup.js:130-200`.
37. **S, DESIGN:** the seat layout picker should show a *preview* of the layout (currently only an icon). Files: `js/ui/setup.js:186-193`.

### 8.9 Persistence

38. **S, CODE:** the localStorage save should also include a `version` field so future deserialization can detect format changes. Files: `js/app/persistence.js:8-28`.
39. **M, DESIGN:** add a "Export save" button that downloads the save as JSON. Files: `js/app/persistence.js`, `js/ui/setup.js`.
40. **M, DESIGN:** add a "Save slot" picker (3 slots) so a moderator can run multiple games. Files: `js/app/persistence.js`, `js/app/config.js`.

---

## 9. Summary

Vibelm is a strong **BotC-walk-as-ToS** implementation. The trial mechanics, the night wizard, the mystery deaths, the hugged-by-the-Storyteller flow — all are right where they should be. The biggest gaps are:

1. **No Night Zero** (the single biggest polish win).
2. **No "Tonight's whispers" panel** (single biggest moderator-UX win).
3. **No pairwise info role** (single biggest gameplay-information gap).
4. **No public claim mechanism** (single biggest BotC-feature gap).
5. **Default `noLynchD1: false`** (mismatches the BotC first-day convention).

Address the Night Zero + Tonight's whispers as soon as possible — they are the two highest-leverage changes in the report. The role additions (Town Informant, Spy) are the two highest-leverage gameplay additions.
