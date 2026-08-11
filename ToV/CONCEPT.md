Updated Master Documentation PackageHere is your complete, updated master package combining:BotC-Style Alignment Ratio Table (6 to 15 Players)Dynamic Scenario Presets with Priority ListsUpdated Deputy Mechanic (Inherits Sheriff upon death)Streamlined Night Jailor, Drunk/Poisoner System, Mystery Deaths & UndertakerRoaming Ghosts, Ghost Ledger & 1 Ghost Vote TokenUpdated agent_spec.md for HTML/JS Assistant implementationPART 1: BOTC ALIGNMENT RATIO TABLE (6 to 15 Players)(Active players, excluding Moderator)Player CountTown (Good)Mafia (Evil)Neutral (Wildcard)6420752085219621106311173112732138321494115942PART 2: DYNAMIC SCENARIO PRESETSTo set up any scenario:Check your player count in the Ratio Table above to get your required number of Town, Mafia, and Neutral slots.Fill each team by drawing down the scenario's Priority List. (If extra Town slots are needed beyond the list, fill with Civilians).Preset 1: "Whispers from the Morgue"Priority Order:Town: Jailor $\rightarrow$ Undertaker $\rightarrow$ Medium $\rightarrow$ Doctor $\rightarrow$ Sheriff $\rightarrow$ Tracker $\rightarrow$ Retributionist $\rightarrow$ Civilians...Mafia: Godfather $\rightarrow$ Mafioso $\rightarrow$ Janitor $\rightarrow$ ConsigliereNeutral: Amnesiac $\rightarrow$ JesterPreset 2: "The Poisoned Pint"Priority Order:Town: Jailor $\rightarrow$ Doctor $\rightarrow$ Sheriff $\rightarrow$ Lookout $\rightarrow$ Escort $\rightarrow$ Tracker $\rightarrow$ Civilians...Mafia: Godfather $\rightarrow$ Mafioso $\rightarrow$ Poisoner $\rightarrow$ ConsortNeutral: The Drunk $\rightarrow$ WitchPreset 3: "The Gunpowder Plot"Priority Order:Town: Jailor $\rightarrow$ Deputy $\rightarrow$ Veteran $\rightarrow$ Vigilante $\rightarrow$ Doctor $\rightarrow$ Escort $\rightarrow$ Civilians...Mafia: Godfather $\rightarrow$ Mafioso $\rightarrow$ Consort $\rightarrow$ ForgerNeutral: Serial Killer $\rightarrow$ SurvivorPreset 4: "The Imposter at the Altar"Priority Order:Town: Jailor $\rightarrow$ Mayor $\rightarrow$ Doctor $\rightarrow$ Sheriff $\rightarrow$ Tracker $\rightarrow$ Retributionist $\rightarrow$ Civilians...Mafia: Godfather $\rightarrow$ Mafioso $\rightarrow$ Forger $\rightarrow$ ConsigliereNeutral: Executioner $\rightarrow$ JesterPreset 5: "Trial by Fire"Priority Order:Town: Jailor $\rightarrow$ Medium $\rightarrow$ Undertaker $\rightarrow$ Doctor $\rightarrow$ Sheriff $\rightarrow$ Lookout $\rightarrow$ Mayor $\rightarrow$ Civilians...Mafia: Godfather $\rightarrow$ Mafioso $\rightarrow$ Consigliere $\rightarrow$ JanitorNeutral: Arsonist $\rightarrow$ SurvivorPreset 6: "The Vanilla Pub"Priority Order:Town: Jailor $\rightarrow$ Doctor $\rightarrow$ Sheriff $\rightarrow$ Tracker $\rightarrow$ Civilians...Mafia: Godfather $\rightarrow$ Mafioso $\rightarrow$ Consort $\rightarrow$ ConsigliereNeutral: Jester $\rightarrow$ The DrunkPART 3: STREAMLINED MODERATOR RUNBOOK & NIGHT SCRIPT(Play low background white noise / pub ambient sounds during the Night phase)Plaintext1. "Everyone close your eyes and cover your ears. Night falls on the village."

2. "POISONER: Poisoner open your eyes."
   -> [Record target to make DRUNK for the cycle] -> "Poisoner close your eyes."

3. "JAILOR: Jailor open your eyes."
   -> [Point to target] -> [Target is Roleblocked]
   -> [Show target's Last Will note to Jailor]
   -> "Do you EXECUTE (Thumbs Down) or SPARE (Thumbs Up)?"
   -> [Record choice] -> "Jailor close your eyes."

4. "ESCORT / CONSORT: Open your eyes."
   -> [Record target to Roleblock] -> "Close your eyes."

5. "DOCTOR: Doctor open your eyes."
   -> [Record player to Protect (Fails if Doctor is Drunk)] -> "Doctor close your eyes."

6. "MAFIA: Godfather & Mafioso open your eyes."
   -> [Record Kill target] -> "Mafia close your eyes."

7. "JANITOR: Janitor open your eyes."
   -> [If active: Record clean target (Fails if Janitor is Drunk)] -> "Janitor close your eyes."

8. "SERIAL KILLER: Serial Killer open your eyes."
   -> [Record Kill target] -> "Serial Killer close your eyes."

9. "INVESTIGATORS: Sheriff (or Deputy), Consigliere, and Undertaker open your eyes."
   -> [Process actions & show gestures. Invert results if investigator is Drunk]
   -> "Investigators close your eyes."

10. "MEDIUM & GHOSTS: Medium open your eyes. Ghost Council open your eyes."
    -> [If Alive Seance: Facilitate Ghost Ledger read (30s)]
    -> [If Dead Seance: Wake Dead Medium + 1 Living Target to whisper (60s)]
    -> "Medium and Ghosts close your eyes."

11. "Everyone open your eyes. Morning has broken."
12. "Take 30 seconds to update your Last Wills silently."
13. [After 30 seconds] "Pencils down! Last night, Player X died..."
PART 4: REVISED agent_spec.md (HTML5/JS Implementation Specification)Markdown# AGENT SPECIFICATION: VILLAGE MAFIA MODERATOR ENGINE (HTML5/JS)

## 1. PROJECT OVERVIEW
Implement a single-file, zero-dependency HTML5/CSS3/JavaScript web application (`index.html`) serving as an automated Assistant for the Game Moderator running the **Village Pub Hybrid Mafia Engine**.

---

## 2. CORE GAME MECHANICS & DYNAMIC SETUP LOGIC

### A. BotC-Style Dynamic Setup Generator
- Inputs: `playerCount` (6-15) and `selectedPreset` (1 of 6 Scenarios).
- Determines team slot ratio via fixed table:
  - `6`: 4 Town, 2 Mafia, 0 Neutral
  - `7`: 5 Town, 2 Mafia, 0 Neutral
  - `8-9`: N-3 Town, 2 Mafia, 1 Neutral
  - `10-11`: N-4 Town, 3 Mafia, 1 Neutral
  - `12-13`: N-5 Town, 3 Mafia, 2 Neutral
  - `14`: 9 Town, 4 Mafia, 1 Neutral
  - `15`: 9 Town, 4 Mafia, 2 Neutral
- Automatically builds card deck by filling slots according to `selectedPreset` priority list.

### B. Deputy & Sheriff Inheritance Logic
- **Deputy Base Ability:** Single-use Day execution button (`triggerDeputyShot(targetId)`).
- **Inheritance Listener:** When `Sheriff` is added to `graveyard[]`:
  - System checks for an alive player with `assignedRole === 'Deputy'`.
  - Automatically updates Deputy state: `inheritedRole = 'Sheriff'`.
  - Deputy is now included in the Night Investigator step for Sheriff checks.

### C. Streamlined Night Jailor
- Runs in Night Action Wizard.
- Selects target $\rightarrow$ Applies `isRoleblocked = true`.
- Displays target's `lastWill` text to Moderator.
- Accepts `EXECUTE` (target dies, bypassing basic defense) or `SPARE` (target lives).

### D. Drunk Status Engine
- **Poisoner Action:** Selects player at night to set `isDrunk = true` for 1 cycle.
- **The Drunk Role:** Permanent `isDrunk = true`.
- **Drunk Resolutions:**
  - `Sheriff` / `Consigliere`: Inverts returned alignment/role results.
  - `Janitor`: Clean action fails (`wasCleaned = false`).
  - `Doctor`: Protection fails (`isProtected = false`).

### E. Mystery Deaths & The Undertaker
- Morning Phase displays victim's `lastWill`, but `trueRole` renders as `"?? UNKNOWN ??"`.
- **Undertaker Action:** Selects a corpse in `graveyard[]` to inspect. App reveals `trueRole` privately to Moderator.

---

## 3. DATA STRUCTURE SCHEMAS (ES6+)

```javascript
const VillageState = {
  dayNumber: 1,
  phase: 'SETUP', // 'SETUP', 'DAY', 'NIGHT', 'MORNING'
  preset: 'WHISPERS_FROM_THE_MORGUE',
  players: [
    {
      id: 1,
      name: "Alice",
      assignedRole: "Deputy",
      inheritedRole: null, // Set to 'Sheriff' if Sheriff dies
      perceivedRole: "Deputy",
      alignment: "TOWN",
      isAlive: true,
      isDrunk: false,
      hasGhostVote: true,
      ghostVoteSpent: false,
      lastWill: "N1: Waiting for Sheriff...",
      nightTarget: null,
      isRoleblocked: false,
      isProtected: false
    }
  ],
  graveyard: [
    {
      playerId: 2,
      name: "Bob",
      trueRole: "Sheriff",
      inspectedByUndertaker: false,
      wasCleaned: false,
      lastWill: "N1: Checked Charlie - Innocent"
    }
  ]
};
4. INHERITANCE & NIGHT RESOLUTION ALGORITHMSJavaScript// Check Sheriff Death & Deputy Inheritance
function handlePlayerDeath(state, victimId, reason) {
  const victim = state.players.find(p => p.id === victimId);
  victim.isAlive = false;
  
  state.graveyard.push({
    playerId: victim.id,
    name: victim.name,
    trueRole: victim.assignedRole,
    inspectedByUndertaker: false,
    wasCleaned: false,
    lastWill: victim.lastWill
  });

  // Deputy Badge Inheritance Check
  if (victim.assignedRole === 'Sheriff') {
    const deputy = state.players.find(p => p.isAlive && p.assignedRole === 'Deputy');
    if (deputy) {
      deputy.inheritedRole = 'Sheriff';
      state.logs.push(`${deputy.name} (Deputy) has inherited the Sheriff's badge!`);
    }
  }
}

// Night Processing Engine
function processNightPhase(state) {
  // 1. Poisoner
  const poisoner = state.players.find(p => p.isAlive && p.assignedRole === 'Poisoner' && !p.isRoleblocked);
  if (poisoner && poisoner.nightTarget) {
    const target = state.players.find(p => p.id === poisoner.nightTarget);
    if (target) target.isDrunk = true;
  }

  // 2. Jailor
  const jailor = state.players.find(p => p.isAlive && p.assignedRole === 'Jailor' && !p.isRoleblocked);
  let jailedId = null;
  if (jailor && jailor.nightTarget) {
    jailedId = jailor.nightTarget;
    const target = state.players.find(p => p.id === jailedId);
    if (target) {
      target.isRoleblocked = true;
      if (jailor.jailorDecision === 'EXECUTE') {
        handlePlayerDeath(state, target.id, "Executed by Jailor");
      }
    }
  }

  // 3. Active Sheriff Check (Supports inherited Deputy)
  const activeSheriff = state.players.find(p => p.isAlive && (p.assignedRole === 'Sheriff' || p.inheritedRole === 'Sheriff') && !p.isRoleblocked);
  if (activeSheriff && activeSheriff.nightTarget) {
    const target = state.players.find(p => p.id === activeSheriff.nightTarget);
    let result = (target.alignment === 'MAFIA' || target.assignedRole === 'SerialKiller') ? 'SUSPICIOUS' : 'INNOCENT';
    if (activeSheriff.isDrunk) result = (result === 'SUSPICIOUS') ? 'INNOCENT' : 'SUSPICIOUS';
    activeSheriff.lastResult = result;
  }
}
5. UI COMPONENTS REQUIREMENTSScenario & Player Count Setup Screen: Dropdowns to select 6-15 players and 1 of 6 Scenarios. Displays auto-generated card deck.Interactive Seat Grid: Seat tiles showing current status tags ([ALIVE], [GHOST], [DRUNK], [INHERITED SHERIFF]).Daytime Deputy Action Button: Triggers public Deputy shot popup.Automated Night Wizard: Interactive script driving physical gesture prompts in correct priority order.