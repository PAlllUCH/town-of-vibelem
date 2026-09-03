# GM-TESTING — Manual Test Plan for the Game Master

A full-session walkthrough that exercises every feature by playing the game the way it is meant to be played. Follow it in order on your phone (or double-click `index.html`). Each phase ends with a short checklist of what you should see on screen. No artificial state pokes, no breaking actions: everything here happens in a normal table game.

---

## Phase 0 — Open and prepare

Open the app fresh (or after finishing a previous session).

- [ ] The setup screen appears with collapsible cards: Players, Scenario, House Rules, Seat Layout, Deck.
- [ ] If an old save exists you see a **Saved game found** banner instead; tap **New Game** to start clean.

### Players, preset, deck

1. Set the player count with the `-` / `+` stepper to match the table (say 9). The ratio line updates (e.g. 6 Town, 2 Mafia, 1 Neutral).
   - *See:* ratio text matches the count; total players line shows `total = player count`.
2. Optionally adjust team slots with the small team steppers.
3. Pick a scenario preset card (e.g. Classic). The selected card highlights.
4. Scroll to the Deck builder. Add a role to any team list from the dropdown — Evil roles are listed there too and marked `· Evil`. Reorder with ▲/▼ or remove with ✕. For Town you can also step the Civilian count or leave it on auto.
5. Watch the deck preview at the bottom update live.

- [ ] Deck preview chips match your picks per team; counts never exceed the team slots; preview shows no error.

### House rules and layout

- Toggle **No Kill Night 1**, **No Lynch Day 1**, **Classic Reveal** on/off as your group prefers.
- Pick Circle or U Shape layout.

- [ ] Toggles show their knob position clearly; layout selection highlights.

## Phase 1 — Seats screen

Tap the action button to deal roles and go to seats.

1. Tap each seat tile and enter real player names; optionally assign a role manually for a custom setup (Clear Role empties it again). Civilian is only offered while deck capacity remains.
2. Find the Witch side control and flip it between **Mafia** / **Town** if a Witch is in this game's deck.
3. Confirm every seat has a name.

- [ ] Every seat shows its name; the note "Witch sides with Mafia/Town this game" reflects your choice; tapping a seat opens the bottom sheet and closing it keeps edits.

## Phase 2 — Day 1

Start Day 1 (the flow is seats → Day 1 → Night 1 → Morning → Day 2 …).

1. Check the phase clock at the top: it should read DAY 1.
2. Start the discussion timer with one of the presets **60s** / **120s** / **180s**. Nudge it with **−10s** / **+10s**, then stop it.
3. Try a trial from day one: tap **Start Trial**, pick a nominator, then pick the accused.
4. In the SECONDS stage tap AGREE/DISAGREE for each living player except the accused until the seconded counter reaches the required strict majority (`floor(living/2)+1`), then resolve the nomination.
5. Record verdict votes GUILTY / INNOCENT / ABSTAIN for living voters (ghost tokens appear here once someone died — skip on Day 1). Resolve the verdict.
6. If guilty-majority: the SENTENCE stage appears; vote again and resolve. INNOCENT votes reaching a strict majority spare the accused, otherwise they lynch.
7. Cancel out of a leftover trial naturally: end the day without resolving, or let a nomination fail (too few seconds).

- [ ] Timer ring counts down and turns red under 30s; vibration/sound fires at zero.
- [ ] Seconding progress chip shows "X of Y"; a failed nomination says not enough support; a spared accused returns to play; a lynched player moves to the graveyard; at most one lynch happened today.
- [ ] Collapsing cards (the `-` buttons) folds them and survives re-rendering.

## Phase 3 — Night walk

End the day to reach Night 1. Use either the wizard view or Helper mode (**switch mode** in the sidebar); the helper gives you the step bar.

1. The night order card lists only steps whose roles are actually dealt. Read each step title aloud before waking anyone.
2. Walk the steps with **Prev** / **Next** in the bottom bar. For each wake:
   - **Veteran (pos 0):** ask thumbs up/down — say "Do you want to go on alert?" Also the Jester haunts here after being lynched: point at a Guilty voter.
   - **Witch (pos 2):** first pick who to control ("Point to the player you take tonight"), then redirect their target. Say: "You now act as this player."
   - **Jailor (pos 3):** pick who to jail, then choose **EXECUTE** or **SPARE**. On Night 1 both appear unless the No Jailor Execution on Night One house rule is enabled, in which case only **SPARE** is offered — say so aloud.
   - Other woken roles: tap the acting player, tap the target, confirm. Corpse-targeting roles (Undertaker, Janitor, Retributionist, Amnesiac, Necromant) get a graveyard list instead of living players.
3. When the last step shows **Done**, tap **Resolve Night**.

- [ ] Step counter reads "k / n"; Prev disabled on the first step; Done replaces Next on the last; actors already recorded show as done when revisiting a step; the Witch flow asks twice (control, then redirect); Jailor Night 1 hides EXECUTE only when the No Jailor Execution on Night One house rule is enabled.

## Phase 4 — Morning recap

After resolving, the phase clock flips to MORNING.

1. Read the Morning Announcement card: deaths with role shown (`?? UNKNOWN ??` unless cleaned/classic reveal), cause of death, revivals (e.g. Retributionist), inheritance notes (Deputy gets the Sheriff check), forged-will notices.
2. Relay info tokens: the Info to Show card lists each player's fresh result; hand them the phone or whisper the line, then tap **Token Shown** to mark it RELAYED.
3. Tap **Begin Day**.

- [ ] Deaths appear with DEAD tags and role-or-UNKNOWN; a quiet night says no deaths; relayed entries show RELAYED; Begin Day moves the clock to the next DAY number.

## Phase 5 — Trials in earnest (Day 2+)

Run a complete trial with ghost votes:

1. Nominate someone. During the verdict stage, dead players holding unspent ghost tokens appear as extra voter rows marked `(ghost · G/I only)` — record their GUILTY/INNOCENT only.
2. Have the Mayor reveal via the Day abilities card before voting; his verdict then weighs 3 in the tally chips.
3. Reach a guilty majority, run the sentence round, and observe the spare rule (INNOCENT needs a strict majority of all living players).
4. After a Jester is lynched, next night step 0 lets you haunt exactly one alive Guilty voter.

- [ ] Ghost rows lack the ABSTAIN button and disappear once their token is spent; Mayor weight visibly changes the tally; sentence-stage hint explains the spare threshold; jester-win / executioner-win banners appear when they trigger.

## Phase 6 — Moderator overrides

Use the Mod panel from the top menu only when reality diverges from the app:

- **Kill Player:** someone dies in a way the app did not predict (house-ruled death, mistake correction mid-night).
- **Undo Last Kill:** immediately revert a mistaken kill or undo; the button names the last graveyard entry and is disabled when the graveyard is empty.
- Both also exist inside Helper mode's per-player status sheet.

- [ ] A killed player flips to GHOST everywhere (clock-side roster, seat tiles, helper roster); Undo restores them fully; undo is disabled right after a new game or an emptied graveyard.

## Phase 7 — Claims, tokens, status tags

1. When players publicly claim a role, open **Claims** and tap the row, pick the claimed role (grouped Town/Mafia/Neutral/Evil) or Clear. Claim chips appear on seat-overlay tiles.
2. Open **Tokens** anytime to re-read every info entry ever given, newest first, tagged by night.
3. Open **Seats** overlay and read the status tags:
   - DRUNK poisoned results fail/invert · POISONED drunk starting next night · JAILED cannot act or vote · PROTECTED protected last night · ALERT Veteran armed · REVEALED Mayor or role public · BLACKMAILED cannot speak today · ENCHANTED cannot vote guilty vs Succubus · CLEANED Janitor took the role · NECRO USED Necromant borrowed already · SUCCUBUS TARGET current enchant · GHOST dead but voting/haunting.
4. In Helper mode, toggle these flags per player via their sheet — use it only to mirror what actually happened in play.

- [ ] Claims persist across screens; token history is grouped per player; tags appear only while fresh (a night flag clears next cycle); legend card matches the tiles.

## Phase 8 — Endgame

Play toward a victory (or force staleness naturally: days with no lynch and nights with no death five cycles in a row).

- [ ] End screen shows a banner naming the winner (Town/Mafia/SK/Demon/Jester/…, both languages where set).
- [ ] A stalemate shows **Draw** with the reason "no lynch and no death for N consecutive cycles".
- [ ] Survivors line lists who lived; the recap lists every death by night and cause; Role Reveal shows all true roles grouped by team with ALIVE/GHOST and INHERITED tags.
- [ ] **New Session** returns to setup cleanly.

## Phase 9 — Save, resume, end

1. Mid-game, close the tab entirely. Reopen `index.html` (same browser/device).
2. The resume banner appears; tap **Resume** and verify the phase, trial state, timer presets and claims survived.

- [ ] Resumed game lands on the exact same screen with the same phase clock number; nothing was double-counted; starting New Game wipes the banner.

---

## Five-minute smoke test before a real game

1. Setup loads, no console errors, cards collapse.
2. Player count changes and ratio follows.
3. One preset selects and the deck preview fills.
4. Seats accept names and the witch side toggles.
5. Day 1 starts; timer runs and stops.
6. A trial can be opened and cancelled harmlessly.
7. End Day → Night 1: step bar shows only dealt roles; Jailor offers SPARE-only only under the No Jailor Execution on Night One house rule (otherwise EXECUTE and SPARE both appear).
8. Resolve Night → morning deaths render (or "no deaths"); Begin Day works.
9. Mod panel: Kill Player then Undo Last Kill restores the player.
10. Reload page mid-game → Resume banner restores the session.
