# Helper-Mode Full-Game Verification Report

Generated: 2026-09-02T20:27:13.113Z

## Passed checks (93)

- startRoles completed without crash
- Phase is SEATES after role assignment
- jailorNoExecN1 defaults to false (Jailor CAN execute on N1)
- beginDay1 completed without crash
- Phase is DAY, dayNumber is 1
- Switched to helper mode and rendered game screen
- Helper cards (Night Order, Players, Statuses) render during DAY
- All player names appear in the helper roster
- Status sheet opens for player 1
- Status sheet lists all flags: DRUNK, POISONED, JAILED, PROTECTED, ALERT, REVEALED, BLACKMAILED, ENCHANTED, CLEANED, NECRO USED, SUCCUBUS TARGET, GHOST
- All 12 status flags toggle correctly
- Status chips render in the roster
- All status flags toggle off correctly
- Status sheet closed
- helper-kill-player works on player 12 (jester)
- helper-undo-kill works
- Helper bar shows End Day during DAY
- endDay completed without crash
- Phase is NIGHT after endDay
- Helper mode persists into NIGHT
- Night step card, outstanding card, and roster render during NIGHT
- Helper step navigation (next/prev) works
- Outstanding night actions show PENDING tags
- driveNight completed for Night 1
- No self-targets recorded in Night 1
- Jailor decision on N1: SPARE
- Outstanding night actions show DONE after driveNight
- resolveNight completed
- Phase is MORNING after resolveNight
- Morning recap card renders during MORNING
- Helper bar shows Begin Day during MORNING
- beginDay completed (cycle 1)
- Phase is DAY, dayNumber is 2
- Helper bar shows End Day in cycle 1
- endDay completed (cycle 1)
- Night step card renders in cycle 1
- Resolve Night button in helper bar (cycle 1)
- driveNight completed (cycle 1)
- resolveNight completed (cycle 1)
- Phase is MORNING after resolveNight (cycle 1)
- Morning Recap renders in cycle 1
- beginDay completed (cycle 2)
- Phase is DAY, dayNumber is 3
- Helper bar shows End Day in cycle 2
- endDay completed (cycle 2)
- Night step card renders in cycle 2
- Resolve Night button in helper bar (cycle 2)
- driveNight completed (cycle 2)
- resolveNight completed (cycle 2)
- Phase is MORNING after resolveNight (cycle 2)
- Morning Recap renders in cycle 2
- beginDay completed (cycle 3)
- Phase is DAY, dayNumber is 4
- Helper bar shows End Day in cycle 3
- endDay completed (cycle 3)
- Night step card renders in cycle 3
- Resolve Night button in helper bar (cycle 3)
- driveNight completed (cycle 3)
- resolveNight completed (cycle 3)
- Phase is MORNING after resolveNight (cycle 3)
- Morning Recap renders in cycle 3
- beginDay completed (cycle 4)
- Phase is DAY, dayNumber is 5
- Helper bar shows End Day in cycle 4
- endDay completed (cycle 4)
- Night step card renders in cycle 4
- Resolve Night button in helper bar (cycle 4)
- driveNight completed (cycle 4)
- resolveNight completed (cycle 4)
- Phase is MORNING after resolveNight (cycle 4)
- Morning Recap renders in cycle 4
- beginDay completed (cycle 5)
- Phase is DAY, dayNumber is 6
- Helper bar shows End Day in cycle 5
- endDay completed (cycle 5)
- Night step card renders in cycle 5
- Resolve Night button in helper bar (cycle 5)
- driveNight completed (cycle 5)
- resolveNight completed (cycle 5)
- Phase is MORNING after resolveNight (cycle 5)
- Morning Recap renders in cycle 5
- beginDay completed (cycle 6)
- Phase is DAY, dayNumber is 7
- Helper bar shows End Day in cycle 6
- endDay completed (cycle 6)
- Night step card renders in cycle 6
- Resolve Night button in helper bar (cycle 6)
- driveNight completed (cycle 6)
- resolveNight completed (cycle 6)
- Phase is END after resolveNight (cycle 6)
- End screen renders Role Reveal
- endReveal has all 12 players
- Helper mode maintained throughout the entire game

## Issues found (1)

- **jailor step prompt**: threw: jailor prompt renders
AssertionError [ERR_ASSERTION]: jailor prompt renders
    at G:\Mój dysk\Projekty\Town of Vajbelem\scripts\verify-helper-game.js:283:10
    at safeCheck (G:\Mój dysk\Projekty\Town of Vajbelem\scripts\verify-helper-game.js:57:5)

## Full-game transcript summary

- Players: 12 (jailor, doctor, godfather, mafioso, witch, veteran, tracker, lookout, sheriff, innkeeper, survivor, jester)
- Team counts: town 7, mafia 3, neutral 2
- Preset: p1
- Mode: helper (entire game)
- Final phase: END
- Final day: 7
- Winner: "MAFIA"
- Alive at end: 4
- Cycles: 6

### Key helper-mode checks

- Night step card shows Jailor prompt with EXECUTE/SPARE (jailorNoExecN1=false)
- Helper player roster shows all player names
- Status sheet lists all 12 flags: DRUNK, POISONED, JAILED, PROTECTED, ALERT, REVEALED, BLACKMAILED, ENCHANTED, CLEANED, NECRO_USED, SUCCUBUS_TARGET, GHOST
- Bottom bar: End Day during DAY, Resolve Night during NIGHT, Begin Day during MORNING
- helper-kill-player and helper-undo-kill work
- Night outstanding card shows PENDING/DONE
- Morning Recap card renders during MORNING

### Deaths

- **Day 2**: Player 3 (Player 3) as godfather - lynched by the town
- **Night 2**: Player 2 (Player 2) as doctor - executed by the Jailor
- **Day 3**: Player 4 (Player 4) as mafioso - lynched by the town
- **Night 3**: Player 6 (Player 6) as veteran - executed by the Jailor
- **Night 4**: Player 7 (Player 7) as tracker - executed by the Jailor
- **Night 5**: Player 8 (Player 8) as lookout - executed by the Jailor
- **Night 6**: Player 9 (Player 9) as sheriff - executed by the Jailor

### Full log

```
=== Phase 1: Setup (Helper Mode Full Game) ===
Players: Player 1, Player 2, Player 3, Player 4, Player 5, Player 6, Player 7, Player 8, Player 9, Player 10, Player 11, Player 12
Roles assigned: Player 1=jailor, Player 2=doctor, Player 3=godfather, Player 4=mafioso, Player 5=witch, Player 6=veteran, Player 7=tracker, Player 8=lookout, Player 9=sheriff, Player 10=innkeeper, Player 11=survivor, Player 12=jester

=== Phase 2: Day 1 in Helper Mode ===

=== Phase 3: Night 1 in Helper Mode ===
Driving Night 1 actions via wizard...
  Jailor action: target=2, extra={"jailorDecision":"SPARE"}
Resolving Night 1...
Deaths after Night 1:

=== Phase 4: Day/Night Loops (Helper Mode) ===

--- Cycle 1 (phase: MORNING, day: 1, alive: 12) ---
Beginning day 2...
Nominating player 3 (godfather)...
Lynched player 3 (godfather)
Ending day 2...
Night 2: driving wizard...
Resolving night 2...

--- Cycle 2 (phase: MORNING, day: 2, alive: 10) ---
Beginning day 3...
Nominating player 4 (mafioso)...
Lynched player 4 (mafioso)
Ending day 3...
Night 3: driving wizard...
Resolving night 3...

--- Cycle 3 (phase: MORNING, day: 3, alive: 8) ---
Beginning day 4...
Ending day 4...
Night 4: driving wizard...
Resolving night 4...

--- Cycle 4 (phase: MORNING, day: 4, alive: 7) ---
Beginning day 5...
Ending day 5...
Night 5: driving wizard...
Resolving night 5...

--- Cycle 5 (phase: MORNING, day: 5, alive: 6) ---
Beginning day 6...
Ending day 6...
Night 6: driving wizard...
Resolving night 6...

--- Cycle 6 (phase: MORNING, day: 6, alive: 5) ---
Beginning day 7...
Ending day 7...
Night 7: driving wizard...
Resolving night 7...
Game ended after night resolution! Winner: "MAFIA"

=== Final State ===
Phase: END
Day: 7
Winner: "MAFIA"
Alive: 4 players
Cycles run: 6

=== Deaths ===
  Day 2: Player 3 (Player 3) as godfather - lynched by the town
  Night 2: Player 2 (Player 2) as doctor - executed by the Jailor
  Day 3: Player 4 (Player 4) as mafioso - lynched by the town
  Night 3: Player 6 (Player 6) as veteran - executed by the Jailor
  Night 4: Player 7 (Player 7) as tracker - executed by the Jailor
  Night 5: Player 8 (Player 8) as lookout - executed by the Jailor
  Night 6: Player 9 (Player 9) as sheriff - executed by the Jailor

=== State Logs ===
  Roles assigned.
  Player 12 was killed by the moderator.
  [Night 1] The Witch controls Player 1 and learns their role: Jailor.
  [Night 1] Player 1 jailed Player 2.
  [Night 1] Player 10 shared a drink with Player 1 at the inn; both are protected.
  [Night 1] The Mafia kill is void (No Kill on Night One): Player 1 is unharmed.
  [Night 1] Player 9 (Sheriff) checks Player 1: INNOCENT.
  [Night 1] Player 7 (Tracker) tracks Player 1: Player 2.
  [Night 1] Player 8 (Lookout) watches Player 1: Player 5, Player 10, Player 3, Player 9, Player 7.
  Player 1 nominates Player 3 for trial.
  Player 3 was lynched by the town.
  The Mafioso has become the new Godfather.
  [Night 2] The Witch controls Player 1 and learns their role: Jailor.
  [Night 2] Player 1 jailed Player 2.
  [Night 2] Player 2 died: executed by the Jailor.
  [Night 2] Player 10 shared a drink with Player 1 at the inn; both are protected.
  [Night 2] Player 1 survived an attack (Doctor protection).
  [Night 2] The Mafia killed Player 1.
  [Night 2] Player 9 (Sheriff) checks Player 1: INNOCENT.
  [Night 2] Player 7 (Tracker) tracks Player 1: Player 2.
  [Night 2] Player 8 (Lookout) watches Player 1: Player 5, Player 10, Player 4, Player 9, Player 7.
  Player 1 nominates Player 4 for trial.
  Player 4 was lynched by the town.
  [Night 3] The Witch controls Player 1 and learns their role: Jailor.
  [Night 3] Player 1 jailed Player 6.
  [Night 3] Player 6 died: executed by the Jailor.
  [Night 3] Player 10 shared a drink with Player 1 at the inn; both are protected.
  [Night 3] Player 9 (Sheriff) checks Player 1: INNOCENT.
  [Night 3] Player 7 (Tracker) tracks Player 1: Player 6.
  [Night 3] Player 8 (Lookout) watches Player 1: Player 5, Player 10, Player 9, Player 7.
  [Night 4] The Witch controls Player 1 and learns their role: Jailor.
  [Night 4] Player 1 jailed Player 7.
  [Night 4] Player 7 died: executed by the Jailor.
  [Night 4] Player 10 shared a drink with Player 1 at the inn; both are protected.
  [Night 4] Player 9 (Sheriff) checks Player 1: INNOCENT.
  [Night 4] Player 8 (Lookout) watches Player 1: Player 5, Player 10, Player 9.
  [Night 5] The Witch controls Player 1 and learns their role: Jailor.
  [Night 5] Player 1 jailed Player 8.
  [Night 5] Player 8 died: executed by the Jailor.
  [Night 5] Player 10 shared a drink with Player 1 at the inn; both are protected.
  [Night 5] Player 9 (Sheriff) checks Player 1: INNOCENT.
  [Night 6] The Witch controls Player 1 and learns their role: Jailor.
  [Night 6] Player 1 jailed Player 9.
  [Night 6] Player 9 died: executed by the Jailor.
  [Night 6] Player 10 shared a drink with Player 1 at the inn; both are protected.
  [Night 7] The Witch controls Player 1 and learns their role: Jailor.
  [Night 7] Player 1 jailed Player 10.
  [Night 7] Player 10 died: executed by the Jailor.
  MAFIA wins: The Mafia holds majority.
  Game over. All roles revealed.
```
