# App-Game Verification Report

Generated: 2026-09-02T20:12:50.162Z

## Passed checks (55)

- startRoles completed without crash
- Phase is SEATS after role assignment
- Seats dealt view renders seat tiles
- Circle layout renders --tile-w and --tile-cap CSS vars
- seatPlaceholder "Player N" renders in seats grid
- Begin Day 1 button visible in seats dealt view
- Naming screen renders seat-btn elements (via editNames)
- Naming screen circle renders --tile-w and --tile-cap CSS vars
- jailorNoExecN1 defaults to false (Jailor CAN execute on N1)
- beginDay1 completed without crash
- Phase is DAY, dayNumber is 1
- No wizard active during Day phase
- Game header renders for Day 1
- Game body renders content during Day
- startTrial(9) completed
- Trial active, stage is SECONDS
- secondAll completed
- resolveTrial (SECONDS) completed
- Trial stage moved to VOTE
- castAll GUILTY completed
- resolveTrial (VOTE) completed
- Trial stage moved to SENTENCE
- resolveSentence completed
- Player 9 (witch) was lynched
- Game continues after Day 1 lynch (phase: DAY)
- endDay completed
- Wizard step renders content in game-body
- Wizard step prompt text renders in game-body
- wizNext advances wizard index
- wizBack returns wizard index
- driveNight completed for night 1
- No self-targets recorded in night 1
- Wizard index at end after driveNight
- Jailor decision on N1: SPARE (EXECUTE also allowed since jailorNoExecN1=false)
- Engine accepts Jailor EXECUTE on Night 1 (jailorNoExecN1=false)
- resolveNight completed
- Phase is MORNING after resolveNight
- Morning announcement renders
- beginDay completed
- Phase is DAY, dayNumber is 2
- endDay completed
- Wizard step renders content in game-body
- Wizard step prompt text renders in game-body
- wizNext advances wizard index
- wizBack returns wizard index
- driveNight completed for night 2
- No self-targets recorded in night 2
- Wizard index at end after driveNight
- resolveNight completed
- Phase is MORNING after resolveNight
- Morning announcement renders
- beginDay completed
- Phase is DAY, dayNumber is 3
- End screen renders Role Reveal
- endReveal has all 12 players

## Issues found (0)

None.

## Full-game transcript summary

- Players: 12 (jailor, doctor, godfather, mafioso, escort, sheriff, tracker, lookout, witch, veteran, medium, survivor)
- Team counts: town 7, mafia 3, neutral 2
- Preset: p1
- Final phase: END
- Final day: 3
- Winner: TOWN
- Alive at end: 9
- Cycles: 2

### Deaths

- **Day 1**: Player 9 (Player 9) as witch - lynched by the town
- **Day 2**: Player 3 (Player 3) as godfather - lynched by the town
- **Day 3**: Player 4 (Player 4) as mafioso - lynched by the town

### Full log

```
=== Phase 1: Setup ===

=== Phase 2: Day 1 Trial ===
Nominating player 9 (witch) from player 1 (jailor)...
All living players seconding...
All voting GUILTY...
All sentencing GUILTY...

=== Phase 3: Day/Night Loops ===

--- Cycle 1 (phase: DAY, day: 1, alive: 11) ---
Ending day 1...
Night 1: 10 wizard steps
  Step 0: Veteran Alert (pos 0, roles: veteran)
  Step 1: Jailor (pos 3, roles: jailor)
  Step 2: Escort (pos 4, roles: escort)
  Step 3: Doctor (pos 5, roles: doctor)
  Step 4: Mafia (pos 6, roles: godfather,mafioso)
  Step 5: Sheriff (pos 11, roles: sheriff)
  Step 6: Tracker (pos 11, roles: tracker)
  Step 7: Lookout (pos 11, roles: lookout)
  Step 8: Medium and Ghosts (pos 13, roles: medium)
  Step 9: Morning (pos 14, roles: )
Driving night 1...
Resolving night 1...
Beginning day 2...
Nominating player 3 (godfather)...
Lynched player 3 (godfather)

--- Cycle 2 (phase: DAY, day: 2, alive: 10) ---
Ending day 2...
Night 2: 10 wizard steps
  Step 0: Veteran Alert (pos 0, roles: veteran)
  Step 1: Jailor (pos 3, roles: jailor)
  Step 2: Escort (pos 4, roles: escort)
  Step 3: Doctor (pos 5, roles: doctor)
  Step 4: Mafia (pos 6, roles: godfather,mafioso)
  Step 5: Sheriff (pos 11, roles: sheriff)
  Step 6: Tracker (pos 11, roles: tracker)
  Step 7: Lookout (pos 11, roles: lookout)
  Step 8: Medium and Ghosts (pos 13, roles: medium)
  Step 9: Morning (pos 14, roles: )
Driving night 2...
Resolving night 2...
Beginning day 3...
Nominating player 4 (mafioso)...
Lynched player 4 (mafioso)
Game ended after lynch! Winner: TOWN

=== Final State ===
Phase: END
Day: 3
Winner: TOWN
Alive: 9 players
Cycles run: 2

=== Deaths ===
  Day 1: Player 9 (Player 9) as witch - lynched by the town
  Day 2: Player 3 (Player 3) as godfather - lynched by the town
  Day 3: Player 4 (Player 4) as mafioso - lynched by the town

=== State Logs ===
  Roles assigned.
  Player 1 nominates Player 9 for trial.
  Player 9 was lynched by the town.
  [Night 1] Player 5 roleblocked Player 1.
  [Night 1] Player 2 protected Player 1.
  [Night 1] The Mafia kill is void (No Kill on Night One): Player 1 is unharmed.
  [Night 1] Player 6 (Sheriff) checks Player 1: INNOCENT.
  [Night 1] Player 11 reads the Ghost Ledger.
  [Night 1] Player 7 (Tracker) tracks Player 1: no one.
  [Night 1] Player 8 (Lookout) watches Player 1: Player 5, Player 2, Player 3, Player 6, Player 7.
  Player 1 nominates Player 3 for trial.
  Player 3 was lynched by the town.
  The Mafioso has become the new Godfather.
  [Night 2] Player 5 roleblocked Player 1.
  [Night 2] Player 2 protected Player 1.
  [Night 2] Player 1 survived an attack (Doctor protection).
  [Night 2] The Mafia killed Player 1.
  [Night 2] Player 6 (Sheriff) checks Player 1: INNOCENT.
  [Night 2] Player 11 reads the Ghost Ledger.
  [Night 2] Player 7 (Tracker) tracks Player 1: no one.
  [Night 2] Player 8 (Lookout) watches Player 1: Player 5, Player 2, Player 4, Player 6, Player 7.
  Player 1 nominates Player 4 for trial.
  Player 4 was lynched by the town.
  TOWN wins: All Mafia-aligned players and the Serial Killer are dead.
  Game over. All roles revealed.
```
