# UI Audit: Town of Vibelm

Date: 8/12/2026 | Scope: Full codebase UI layer (read-only, no edits)

**Methodology:** Every file listed in `docs/tasks/task-ui-audit.md` was read end-to-end. Findings are severity-ranked within each group: Critical > High > Medium > Low. Each finding includes the file:line evidence, a concrete table-game scenario, and a sizing estimate.

---

## A. Reading the Board at a Glance

### A-1. Flow strip labels are unreadable at arm's length [High]
**Where:** `base.css:168` - `.flow-label { font-size: .82rem }`, plus `base.css:161` - `.flow-step { opacity: .45 }`.
**What:** The phase flow strip (Prep/Day/Night/Morning/End) renders labels at 0.82rem (~13px) with 45% opacity on inactive steps. On a phone held at arm's length by a standing moderator, the inactive labels vanish.
**Scenario:** Moderator is mid-Night 3 and glances down to confirm they're in the Night phase. The "Day" and "Morning" labels at 45% opacity are invisible in dim room lighting; only the active "Night" dot is visible.
**Fix:** Raise `.flow-step` base opacity to 0.6, raise `.flow-label` font-size to `.88rem`. Add `font-weight: 600` to `.flow-step.on .flow-label`. Small.

### A-2. Wizard progress ("Step 3 of 9") is buried at tiny size [High]
**Where:** `wizard.js:155` - `html += '<div class="wizard-progress">Step ' + (idx + 1) + ' of ' + steps.length + '</div>';`, `game.css:14` - `.wizard-progress { font-size: .8rem; color: var(--muted) }`.
**What:** The step counter is 0.8rem muted text. During a 9-step night (10-player game), the moderator has no quick way to estimate progress through the night without squinting.
**Scenario:** Moderator running a 12-player game with 7 night steps. They're on step 4 and want to know how many actors remain. The "Step 4 of 7" text is so small and muted it blends into the prompt above.
**Fix:** Increase `.wizard-progress` to `font-size: .92rem; font-weight: 600; color: var(--accent)`. Small.

### A-3. Game header phase tag duplicates the flow strip [Medium]
**Where:** `day.js:13-18` - `UI.renderGameHeader` outputs `<span class="tag tag-accent">' + UI.esc(state.phase) + '</span>` followed immediately by `UI.flowStrip(state.phase)`.
**What:** The header shows "NIGHT" as a tag, then the flow strip shows "Night" as the active step, directly below. Two phase indicators consume vertical space with redundant information.
**Scenario:** On a small phone (iPhone SE), the game header card with the phase tag, the label, and the flow strip take up ~90px before any game content appears.
**Fix:** Remove the `tag-accent` span from the game header; rely on the flow strip + the label text ("Night 3") for phase indication. Small.

### A-4. "No deaths last night" notice uses accent color instead of ok [Medium]
**Where:** `day.js:68` - `html += '<div class="notice">No deaths last night.</div>'`; `game.css:1-8` - `.notice` default border is `var(--accent)`.
**What:** A night with no deaths is good news for the Town. The notice uses the default accent (amber) border, making it feel neutral rather than positive.
**Scenario:** After a Doctor-protected night, the moderator sees "No deaths last night" in an amber-bordered card. The players expect good news; the amber border reads as caution, not relief.
**Fix:** Add class `ok` to the no-deaths notice: `<div class="notice ok">`. Small.

### A-5. Morning announcement lacks explicit "what to do next" prompt [Medium]
**Where:** `day.js:45-72` - `morningView()` renders death cards and notices but no instruction text. The bottom bar renders separately via `day.js:34` - `bar = '<button class="btn btn-primary btn-bar" data-action="begin-day">Begin Day</button>'`.
**What:** The morning view shows deaths, revivals, and inheritance, but the moderator must scroll to the bottom bar to find the "Begin Day" action. There's no in-card prompt saying "Read the deaths aloud, then tap Begin Day."
**Scenario:** First-time moderator sees death cards, isn't sure what to do next. They scroll past the deaths and find the button by accident. Adding "Announce the deaths above, then begin the day." would orient them.
**Fix:** Add a `.notice` at the bottom of the morning card: `<div class="notice">Read the announcements above to the table, then tap <strong>Begin Day</strong>.</div>`. Small.

### A-6. Night step timer is too subtle and small [Medium]
**Where:** `game.css:20-31` - `.timer { font-size: 1rem; padding: 6px 16px }`.
**What:** The night step timer (for Medium's 30-second read or dead Medium's 60-second seance) is a small pill badge. When a timer is critical (the Medium must stop reading after 30s), the moderator needs a more prominent signal.
**Scenario:** Medium reads the Ghost Ledger. Moderator glances at the phone; the 1rem timer pill is easy to miss among the wizard prompt and actor controls.
**Fix:** For step timers (Medium), use the `timer-ring` circular design already built for the day timer, scaled down to ~100px. At minimum, increase `.timer` to `font-size: 1.2rem; padding: 8px 20px`. Medium.

### A-7. Death cards don't distinguish kill causes [Low]
**Where:** `day.js:62-66` - Death cards show name + roleShown, no cause.
**What:** `getMorningAnnouncement` returns `cause` per death, but the morning view ignores it. The moderator can't tell from the app if a death was from Mafia kill vs. SK kill vs. Veteran alert.
**Scenario:** Two players died. The moderator announces them but can't quickly reference which was which from the app (they may have notes, but the app should help).
**Fix:** Add `<div class="death-cause">' + UI.esc(d.cause) + '</div>` to the death card, styled muted. Small.

### A-8. The game-body scrolls independently from the bottom bar, losing context [Low]
**Where:** `base.css:192` - `#game-bar { position: sticky; bottom: 0; z-index: 20 }`.
**What:** The bottom bar is sticky at the bottom, but the game body above it scrolls. In long trial views with 15 voters, the moderator scrolls through voters and the "Resolve Trial" button stays at the bottom, but the voter list and the button can't be seen simultaneously.
**Scenario:** 12-player game during a vote. The voter list is 12 rows + ghost voters. The moderator taps votes, scrolls down, taps the resolve button, scrolls back up to check the tally. A "Resolve" button at the top of the trial card (in addition to the bar) would help.
**Fix:** Add a duplicate "Resolve Nomination" / "Resolve Trial" button at the top of the trial card, already present in the card body at `day.js:202`. Verify it's rendered for both SECONDS and VOTE stages. Small.

### A-9. Day timer ring has no haptic/audio cue at zero [Low]
**Where:** `router.js:55-66` - `onTimerDone` calls `UI.toast("Time's up!")` and clears state.
**What:** When the day timer hits zero, the only feedback is a toast notification that auto-dismisses in 2.6 seconds. A moderator watching the table, not the phone, may miss it entirely.
**Scenario:** Moderator starts a 120s discussion timer, then walks around the table. Timer expires silently (toast only). Moderator returns to phone 30s later, unsure if time has passed.
**Fix:** Add a short vibration (`navigator.vibrate && navigator.vibrate(200)`) in `onTimerDone` for day timers. Also play a short beep via `AudioContext` if available. Small.

---

## B. Trial UI (SECONDS + VOTE)

### B-1. Seconding tally doesn't show individual agree/disagree status clearly [High]
**Where:** `day.js:180-201` - The SECONDS voter rows render Agree/Disagree buttons per player, but the current state of each player's second is indicated only by the `.on` class on the button (accent background).
**What:** The moderator must scan each voter row to see who has seconded. In a 10-player game, that's 9 rows of two buttons each. There's no summary line like "5 of 6 needed" prominently displayed before the voter list.
**Scenario:** Moderator asks the table to second. They see "SECONDS 3 of 5" in a small tally chip at the top, then must scroll through 9 voter rows to call on the remaining players. A large, prominent progress indicator at the top of the card would help.
**Fix:** Make the tally chip larger: `font-size: 1rem; padding: 6px 14px; font-weight: 700`. Place it inside a styled container with a progress-bar-like background fill. Medium.

### B-2. The transition from SECONDS to VOTE has no visual break [High]
**Where:** `day.js:172-201` (SECONDS) vs `day.js:203-237` (VOTE). Both render inside the same `.card` with the same `<h2>Trial</h2>`.
**What:** When `resolveTrial` returns `ACCEPTED`, the SECONDS stage clears and the VOTE stage renders in its place. The card looks nearly identical: same heading, same voter rows (just with different buttons). There's no "Nomination accepted! Vote now." banner.
**Scenario:** After a successful seconding, the moderator resolves the nomination. The screen refreshes with the VOTE stage, but the visual change is so subtle (buttons change from Agree/Disagree to Guilty/Innocent) that the moderator may not realize the stage has changed.
**Fix:** Add a transitional notice: `html += '<div class="notice ok">Nomination accepted. Proceed to verdict vote.</div>'` when entering the VOTE stage. Medium.

### B-3. Ghost voter emoji icon (::before) is inconsistent across platforms [Medium]
**Where:** `game.css:116-122` - `.ghost-voter::before { content: "\1F47B" }`.
**What:** The ghost emoji renders differently on iOS, Android, and desktop. On some devices it's tiny, on others it may not render at all (low-end Android WebViews).
**Scenario:** Moderator on a cheap Android phone sees a blank box instead of a ghost emoji next to a dead player's vote row. The dashed border is the only signal this is a ghost voter.
**Fix:** Replace the emoji with a styled SVG icon or a CSS ghost shape (two overlapping circles). Alternatively, add a `.tag-ghost` label reading "GHOST" alongside the emoji. Small.

### B-4. Tally chips have inverted intuition for Guilty/Innocent [Medium]
**Where:** `game.css:127-129` - `.tally-chip.g { color: var(--ok) }` (green = Guilty), `.tally-chip.i { color: var(--bad) }` (red = Innocent).
**What:** Guilty is green and Innocent is red. In most UIs, green means "safe/good" and red means "danger/bad." Guilty means someone dies, which is the dangerous outcome. The colors are backwards.
**Scenario:** Moderator glances at the tally: "GUILTY 4" in green, "INNOCENT 3" in red. The green draws the eye as "the good outcome," but a guilty verdict kills a player. This inverts the emotional signal.
**Fix:** Swap: `.tally-chip.g { color: var(--bad); border-color: var(--bad) }`, `.tally-chip.i { color: var(--ok); border-color: var(--ok) }`. Small.

### B-5. Ghost tokens note is buried and vague [Medium]
**Where:** `day.js:237` - `html += '<p class="muted small">Ghost votes spend the ghost token. A revealed Mayor counts as 3.</p>'`.
**What:** This info is at the very bottom of the voter list in muted small text. The moderator needs to know which ghosts have tokens BEFORE they start voting, not after scrolling past all voters.
**Scenario:** Moderator is recording votes. They forget which dead player has a ghost token. The `ghostTokens()` note at `day.js:120-126` shows names above the voter list, which is good, but the note about spending is at the bottom.
**Fix:** Merge the "Ghost votes spend..." note into the `ghostTokens()` output, displayed above the voter list. Small.

### B-6. Trial result card is generic, doesn't differentiate outcomes [Medium]
**Where:** `day.js:142-161` - Result card uses `.notice.ok` or `.notice.bad` with text. Lynched, survived, cancelled, and acquitted all use the same visual treatment.
**What:** A lynch is a major game event. The result notice for a lynch should be visually more dramatic than "not enough guilty votes."
**Scenario:** Player is lynched. The moderator sees a small `.notice.bad` with "Lynched: Player Name." Same box style as a failed nomination. Players expect drama.
**Fix:** Add a `.notice-critical` style for lynch results: `background: var(--bad-dim); border-left-width: 6px; font-size: 1rem;`. Apply it when `r.result === 'LYNCHED'`. Small.

### B-7. Abstain button appears for living voters but no indication ghosts can't abstain [Low]
**Where:** `day.js:232-234` - Ghost rows omit the Abstain button (conditional `v.ghost ? '' :`), but there's no explanation why.
**What:** Ghosts can only vote Guilty or Innocent. The Abstain button is simply missing for ghost rows with no tooltip or note.
**Scenario:** Moderator unfamiliar with the rules wonders why a ghost player can't abstain. They may think it's a bug.
**Fix:** Add a tiny note on ghost voter rows: `<span class="muted small">(ghosts: G/I only)</span>`. Low.

### B-8. The nominator auto-agrees but their row shows a disabled "Agree" button [Low]
**Where:** `day.js:192-193` - `html += '<button class="btn btn-vote on" disabled>Agree</button>'`.
**What:** The nominator's Agree button is shown as active (`on`) but disabled. This is correct but visually confusing: the button looks clickable because of the accent background, but tapping does nothing.
**Scenario:** Moderator taps the nominator's Agree button (it looks selected). Nothing happens. They tap again, thinking the app froze.
**Fix:** Add `.btn-vote:disabled { opacity: .5; cursor: default }` to make disabled state clearer. Small.

---

## C. Night Wizard Ergonomics

### C-1. "Who acts?" label is indistinguishable from the wizard prompt [High]
**Where:** `wizard.js:195` - `html += '<p class="wizard-label">Who acts?</p>'`; `game.css:17` - `.wizard-label { font-size: .88rem; color: var(--muted); text-transform: uppercase }`.
**What:** The wizard prompt is 1.3rem bold on a tinted background (`game.css:16`), and the "Who acts?" label below it is 0.88rem muted uppercase. The prompt is the text the moderator reads aloud; "Who acts?" is the interactive instruction. They have different purposes but similar visual weight.
**Scenario:** Moderator reads the prompt aloud, then looks for the actor buttons. The "Who acts?" label doesn't jump out; the moderator's eye goes straight to the buttons. Adding more weight to the instruction would help.
**Fix:** Increase `.wizard-label` to `font-size: .95rem; color: var(--text); font-weight: 700`. Medium.

### C-2. Back and Skip are equally weighted, risking accidental skip [High]
**Where:** `wizard.js:138-141` - Both buttons are `.btn.btn-sm`, same size and styling.
**What:** Back (go to previous step) and Skip (skip current step) are adjacent, same-sized buttons. "Skip" is destructive (skips an actor) while "Back" is safe. They should have different visual weight.
**Scenario:** Moderator meant to go Back to re-read a step but accidentally taps Skip. The step is now skipped and they must navigate back. With equally styled buttons, this mistake is easy.
**Fix:** Style "Skip" as `.btn.btn-sm` (default/neutral) and "Back" as `.btn.btn-sm.btn-ok` (or vice versa: make Skip less prominent, Back more). Add a gap between them. Small.

### C-3. Jester haunt prompt is contextually ambiguous [Medium]
**Where:** `wizard.js:112-131` - The Jester haunt renders "Pick one player who voted Guilty in the lynch trial" with no prominent header.
**What:** The haunt is a unique, once-per-game event that happens at position 0 (Veteran alert step). The prompt appears mixed in with the Veteran's own alert question. There's no distinct section header like "Jester Haunt" separating it from the Veteran's alert.
**Scenario:** Moderator enters Night 2 after a Jester lynch. Position 0 shows the Veteran alert prompt AND the Jester haunt picker on the same screen. The moderator must distinguish between these two unrelated actions.
**Fix:** Add a prominent notice above the haunt picker: `<div class="notice bad"><strong>Jester Haunt:</strong> The Jester ghost may haunt one Guilty voter.</div>`. Small.

### C-4. Witch two-tap flow uses separate lists, losing context [Medium]
**Where:** `wizard.js:74-80` - Witch renders "Point to the player you control" with a living-player list, then after selection, "Controlled: X. Now point to the redirect target" with the same list.
**What:** After selecting the controlled player, the UI rebuilds the full list for the redirect target. The controlled player's name appears in text but the moderator must re-scan the entire list for the redirect target.
**Scenario:** Moderator controls Player 3 (Sheriff). The list rebuilds with the same players. The moderator must remember "I just picked Player 3" and pick a different target from the same-looking list.
**Fix:** Add the controlled player's name as a disabled button at the top of the redirect list, styled with `.actor-done`, so the moderator sees them in context. Small.

### C-5. Mafia group pick doesn't show who the kill leader is prominently [Medium]
**Where:** `wizard.js:170-174` - Mafia step shows "Mafia, point to your kill target" with buttons for the kill leader.
**What:** The UI shows `leader` buttons but doesn't prominently display "Kill leader: [Godfather/Mafioso]". The moderator must infer from the button which Mafia member is acting.
**Scenario:** Godfather is dead; Mafioso is the kill leader. The moderator sees Mafioso's button but must remember that Mafioso is now the leader. A label would help.
**Fix:** Add `<p class="wizard-label">Kill leader: ' + UI.esc(leader.name) + ' (' + UI.roleName(leader.assignedRole) + ')</p>` above the target buttons. Small.

### C-6. Shared steps (position 11: Sheriff/Tracker/Lookout/Consigliere/Undertaker) show no grouping indicator [Medium]
**Where:** `wizard.js:144-211` - `nightWizard` renders each step individually. Steps at the same position are separate entries in the `steps` array.
**What:** When multiple roles share position 11, the wizard shows them as separate steps with no visual cue that they're concurrent (same night phase). The moderator sees "Sheriff" as step 7, "Tracker" as step 8, etc., without knowing they're all position 11.
**Scenario:** Moderator is on step 7 (Sheriff). They see "Step 7 of 12." They don't realize steps 8-11 (Tracker, Lookout, Consigliere, Undertaker) all share the same position and could theoretically be resolved in any order.
**Fix:** Add a small badge on steps sharing a position: `<span class="tag tag-accent">GROUP</span>` or a position indicator like "Pos 11" in the progress area. Small.

### C-7. Veteran alert step mixes with Jester haunt at position 0 [Medium]
**Where:** `wizard.js:70-73` (Veteran) and `wizard.js:112-131` (Jester). Both are position 0.
**What:** The Veteran alert is a simple yes/no. The Jester haunt (if applicable) is a target picker. They're both rendered in the same step view when position 0 is active. The UI doesn't separate them clearly.
**Scenario:** Jester was lynched. Night 2 begins. Position 0 shows the Veteran's alert buttons AND the Jester's haunt picker in the same card. The moderator must handle both but they look like one continuous form.
**Fix:** Render the Jester haunt in a separate `.notice.bad` card above or below the Veteran alert, with its own heading. Medium.

### C-8. "No eligible actors this night" doesn't explain why [Low]
**Where:** `wizard.js:183-185` - `html += '<p class="muted">No eligible actors this night.</p>'`.
**What:** When a step has no actors (e.g., all players with that role are dead), the UI says "No eligible actors" without explaining whether this is expected (role not in deck) or an error.
**Scenario:** Moderator sees "No eligible actors" for a role they expected to act. They're unsure if the role is dead, not in the deck, or if there's a bug.
**Fix:** Change message to "No living [role name] players." or "This role is not in the current deck." Small.

### C-9. Forger confirm button text breaks the single-word convention [Low]
**Where:** `wizard.js:102` - `'Confirm Forge'` vs other confirmations: `wizard.js:72` `'Yes, Alert'`, `wizard.js:89-93` `'EXECUTE'/'SPARE'`, `wizard.js:102` `'Confirm Forge'`.
**What:** Jailor has EXECUTE/SPARE (single-word, all-caps). Forger has "Confirm Forge" (two words, mixed case). The inconsistent convention makes the Forger's button feel like a different kind of action.
**Scenario:** Moderator has muscle memory from the Jailor's EXECUTE/SPARE buttons. The Forger's "Confirm Forge" requires a different reading pattern.
**Fix:** Change to `'FORGE'` for consistency with the all-caps decision convention. Small.

---

## D. Seats/Sheets

### D-1. Circle layout seat tiles are only 90px wide, too narrow for 15 players [High]
**Where:** `seats.css:63-64` - `.circle .seat-tile { width: 90px }`, `seats.css:120-121` - `.circle .seat-dealt { width: 90px }`.
**What:** All circle tiles are a fixed 90px regardless of player count. With 15 players, the circle radius is the same as with 6 players (45% of container). Tiles overlap or touch, and the name/role/tags inside 90px are cramped.
**Scenario:** 15-player game, circle layout. Seat 1 (top) and Seat 2 (top-right) are adjacent. Their 90px tiles overlap slightly on a 375px-wide phone screen.
**Fix:** Scale tile width with player count: `width: clamp(72px, calc(90px - (n - 6) * 2px), 90px)`. Or set via JS: `tile.style.width = Math.max(72, 90 - (n - 6) * 2) + 'px'`. Medium.

### D-2. Player detail sheet's activity log has no visual differentiation by entry kind [High]
**Where:** `seats.js:184-186` - Log entries render as plain text: `html += '<div class="player-log-row">' + UI.esc(log[i].text) + '</div>'`.
**What:** `state.playerLog` entries have `kind` values: `set`, `swap`, `night-action`, `death`, `lynched`, `shot`, `poisoned`, `jailed`, `protected`, `verdict`, etc. All render identically.
**Scenario:** Moderator opens Player 5's detail sheet during Day 2. The log shows 8 entries all in the same style: "Role set to Sheriff", "Targeted Player 3 (N1)", "Protected by Doctor (N1)", "Voted GUILTY (D2)". Deaths and verdicts have the same weight as routine actions.
**Fix:** Map `kind` to CSS classes: `death`/`lynched`/`shot` → `.player-log-row.log-bad`; `protected`/`revive` → `.player-log-row.log-ok`; `night-action` → `.player-log-row.log-accent`. Add `data-kind` attribute and style accordingly. Small.

### D-3. Role picker in the naming sheet is a flat unsorted list [High]
**Where:** `seats.js:146-152` - Roles render as flat `.seat-sheet-role-btn` buttons in the order returned by `availableRoles()`.
**What:** `availableRoles` returns civilian first, then deck roles in deck order (shuffled). No team grouping, no alphabetical sort, no category headers. A 15-player deck has 15 roles in random order.
**Scenario:** Moderator opens the naming sheet for Seat 7. The role list shows: Civilian, Janitor, Doctor, Serial Killer, Lookout, Consort, Jailor, Amnesiac, Framer, Veteran, Sheriff, Tracker, Medium, Escort, Vigilante. Finding "Sheriff" requires scanning the entire list.
**Fix:** Group roles by team (Town/Mafia/Neutral) with section headers, sorted alphabetically within each team. Add `data-team` headers to the list. Medium.

### D-4. Naming sheet role list max-height can be too small for large decks [Medium]
**Where:** `sheets.css:48` - `.seat-sheet-role-list { max-height: 35vh }`.
**What:** 35vh on a phone (~260px on iPhone 12) fits ~8-9 role buttons at 44px each. A 15-player deck has 15 roles; the list scrolls internally, hiding 6 roles below the fold.
**Scenario:** Moderator must scroll inside the role list to find a specific role, while the sheet itself is also scrollable. Nested scrolling is confusing.
**Fix:** Increase `max-height` to `45vh` or remove the max-height constraint (the sheet itself already has `max-height: 85vh`). Small.

### D-5. Naming sheet doesn't show deck composition while picking roles [Medium]
**Where:** `seats.js:131-158` - `renderNamingSheet` shows available roles but not how many are left to assign.
**What:** The main seats screen shows "X seats left to assign" (`seats.js:54`), but inside the naming sheet, the moderator can't see how many of each team's roles are still unassigned.
**Scenario:** Moderator is assigning roles. They've picked 4 Town roles and 1 Mafia. Inside the naming sheet for Seat 6, they can't see "1 Town, 1 Mafia, 1 Neutral remaining."
**Fix:** Add a summary line above the role list: `<p class="muted small">Remaining: X Town, Y Mafia, Z Neutral</p>`. Small.

### D-6. Detail sheet shows no role category or team label [Medium]
**Where:** `seats.js:161-188` - `renderDetailSheet` shows the role name in team color, but no category label (e.g., "Town Investigative") or team text.
**What:** The role card shows "Sheriff" in steel-blue but doesn't say "Town Investigative." The reference panel shows categories; the detail sheet doesn't.
**Scenario:** Moderator opens a player's detail sheet to check their role. They see "Sheriff" in blue. Is that Town? What category? They must close the sheet and open the reference panel.
**Fix:** Add `<span class="reference-cat">' + UI.esc(r.category) + '</span>` to the role card in the detail sheet. Small.

### D-7. Swap mode has no cancel button in the hint area [Low]
**Where:** `seats.js:83-88` - Swap mode hint says "Tap a seat to select it..." but the only cancel is the "Cancel Swap" button in the card header.
**What:** The hint text and the cancel button are far apart (hint is below the header). On a scrollable page, the header may be off-screen.
**Scenario:** Moderator enters swap mode, then changes their mind. They scroll down to see the seat grid; the "Cancel Swap" button scrolled off the top.
**Fix:** Add a "Cancel Swap" button at the bottom of the hint area. Low.

### D-8. Seats naming grid circle inputs are 72px wide, barely fitting names [Low]
**Where:** `seats.css:56` - `.circle .seat-name-input { width: 72px }`.
**What:** Name inputs in circle layout are 72px wide. Most player names ("Player 10") overflow. The input shows "Play..." with ellipsis.
**Scenario:** Moderator types "Christopher" into a circle layout name input. They see "Chri..." and can't verify the full name without tapping into the sheet.
**Fix:** This is acceptable for the circle layout (space is constrained), but the naming sheet provides the full input. Add a tooltip or long-press preview showing the full name. Low.

---

## E. Setup & Deck Builder

### E-1. Team count total mismatch error only appears as a toast [High]
**Where:** `actions-setup.js:123-127` - `if (total !== APP.cfg.playerCount) { UI.toast('Team totals must equal...'); return; }`.
**What:** When team totals don't match the player count, the "Start Session" button silently refuses to work and a toast appears for 2.6 seconds. There's no persistent on-screen indicator of the mismatch.
**Scenario:** Moderator adjusts Mafia count from 3 to 2, making the total 7 instead of 8. They tap "Start Session." Nothing happens except a brief toast. They tap again. The toast reappears but they're confused about what's wrong.
**Fix:** Add a persistent `.notice.bad` above the Start button when `total !== playerCount`: `<div class="notice bad">Team totals (' + total + ') must equal ' + pc + ' players.</div>`. Medium.

### E-2. Selecting a preset overwrites custom deck edits without confirmation [High]
**Where:** `actions-setup.js:8-17` - `selectPreset` replaces `APP.cfg.deckConfig` with the preset's default lists.
**What:** The moderator builds a custom deck (e.g., removes a role, adds another), then taps a different preset card. All customizations are instantly lost.
**Scenario:** Moderator spent 2 minutes building a custom deck. They accidentally tap "The Poisoned Pint" preset. The deck resets. Their edits are gone.
**Fix:** Before overwriting, check if the current deck differs from the preset. If so, show a confirmation toast or dialog: "Switching presets will reset your deck edits. Continue?" Medium.

### E-3. Civilians stepper's "auto" label is confusing [Medium]
**Where:** `setup.js:72` - `(cfg.civilians == null ? '<span class="muted small">auto</span>' : '')`.
**What:** When civilians are in auto mode, a small "auto" label appears next to the stepper. Tapping +/- overrides auto mode (sets a specific number) but there's no way to return to auto mode.
**Scenario:** Moderator sets civilians to 3 manually. They want to go back to "auto" (let the app decide). There's no button or gesture to reset to auto.
**Fix:** Add a "Reset to auto" button/link when `cfg.civilians != null`. Small.

### E-4. Deck builder up/down buttons have no directional clarity [Medium]
**Where:** `setup.js:58-59` - `▲` and `▼` buttons are `.btn.btn-icon` (44x44px) with Unicode arrows.
**What:** The up/down arrows are Unicode characters that render inconsistently across devices. On some phones they appear as small, hard-to-read triangles.
**Scenario:** Moderator wants to move "Sheriff" from position 3 to position 2 in the Town priority list. The ▲ button is tiny and they're not sure which direction is "up" (toward the top of the list = higher priority).
**Fix:** Replace Unicode arrows with SVG chevrons or add "Move up" / "Move down" aria-labels (already present: `aria-label="Move up"`). The aria-labels are good for accessibility; consider adding visible labels on hover/long-press. Low.

### E-5. Team structure steppers have no validation feedback when at limits [Low]
**Where:** `actions-setup.js:59-62` - `teamInc` shows a toast when total exceeds player count.
**What:** The +/- buttons are not disabled when at the limit; they just show a toast. The button remains visually clickable.
**Scenario:** Moderator tries to add more Mafia slots. The total is already at the player count. The + button looks active but shows a toast error.
**Fix:** Disable the + button when `total >= playerCount` and the - button when `val <= 0`. Add `disabled` attribute in `setup.js` rendering. Small.

---

## F. Consistency & Polish

### F-1. No focus styles for keyboard/assistive navigation [High]
**Where:** `base.css:49` - `* { -webkit-tap-highlight-color: transparent }`. No `:focus` or `:focus-visible` styles anywhere in the CSS.
**What:** All interactive elements (buttons, inputs, toggles) have no visible focus ring. While this is a phone-first app, the focus trap in sheets (`actions-sheets.js:103-122`) requires keyboard navigation for accessibility testing.
**Scenario:** QA tester tabs through the app with a keyboard connected to the phone. No element shows a focus indicator. They can't tell which button is focused.
**Fix:** Add `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` to `base.css` for all interactive elements. Small.

### F-2. 26 hardcoded color values remain outside tokens [Medium]
**Where:** Scattered across all CSS files. Examples: `game.css:117` `\1F47B` (emoji, not a color), `game.css:41-48` `var(--panel)` in radial-gradient (tokenized), but `game.css:82-83` `var(--bad-mid)` and `var(--bad-dim)` are tokens.
**What:** A previous session tokenized ~20 colors. However, several rgba values and inline styles remain: `wizard.js:208` inline `style="margin-top:10px"`, `day.js:13` inline `style="padding:10px 14px"`, `seats.css:16` border-top color using `var(--line)`.
**Scenario:** Design update changes the color palette. Most colors update via tokens, but inline styles and a few remaining hardcoded values break consistency.
**Fix:** Audit inline styles (3 instances in JS) and move to CSS classes. Verify all color values reference `:root` tokens. Medium.

### F-3. Toast notifications stack poorly [Medium]
**Where:** `common.js:135-147` - Single toast element with a 2.6s timer. `base.css:205-226` - Toast is positioned `fixed; top: 14px; left: 50%`.
**What:** If two toasts fire in quick succession (e.g., "Roles swapped" then immediately "Game saved"), only the last one shows. The first is overwritten.
**Scenario:** Moderator swaps roles. The toast "Roles swapped" appears for 200ms, then "Game saved" overwrites it. They never see the confirmation.
**Fix:** Queue toasts or use a toast container that stacks multiple notifications. Alternatively, show the most recent toast and extend the timer. Medium.

### F-4. Toggle row click target is the full row, but the toggle knob is only 54px [Medium]
**Where:** `setup.css:88-125` - `.toggle-row` is a full-width button, `.toggle` is 54x32px with a 26px knob.
**What:** The entire row is clickable (which is good for touch), but the toggle knob animation is the only visual feedback. The row doesn't show a `:active` state.
**Scenario:** Moderator taps the "No Kill on Night One" toggle row. The toggle animates, but the row itself has no pressed state. The moderator isn't sure the tap registered until the toggle moves.
**Fix:** Add `.toggle-row:active { background: var(--accent-faint) }` for immediate feedback. Small.

### F-5. Disabled buttons use opacity only, not a distinct style [Medium]
**Where:** `base.css:116` - `.btn:disabled { opacity: .4; pointer-events: none }`.
**What:** Disabled buttons are just dimmed. On dark backgrounds, 40% opacity can still look interactive, especially to moderators with visual impairments.
**Scenario:** "Start Session" button is disabled (team totals mismatch). It looks slightly dimmer but still appears tappable.
**Fix:** Add `filter: grayscale(0.5)` or change background to a distinct disabled color: `background: var(--bg2); border-color: var(--line-dim); color: var(--muted)`. Small.

### F-6. End screen role reveal grid isn't team-grouped [Medium]
**Where:** `end.js:42-57` - Role reveal renders a flat `.seat-tiles` grid sorted by seat number.
**What:** The end screen reveals all roles but sorts by seat, not by team. Reviewing who was Town vs. Mafia requires scanning each tile's team color.
**Scenario:** Game ends. Moderator wants to show the table "Here were all the Mafia members." They must scan 12 tiles to find the 3 red-bordered ones.
**Fix:** Add a team filter or group the reveal by team: Town section, Mafia section, Neutral section. Or add a toggle to switch between seat-order and team-grouped views. Medium.

### F-7. Header "Roles" button has no visual indication of the reference panel state [Low]
**Where:** `index.html:27` - `<button class="btn btn-sm" data-action="toggle-reference">Roles</button>`.
**What:** When the reference panel is open, the "Roles" button doesn't change appearance. The panel is a full-screen overlay; the button behind it is hidden, but when the panel closes, there's no "active" state on the button.
**Scenario:** Moderator opens the reference panel, reads a role, closes it. They forget if they already opened it and tap again, reopening it by accident.
**Fix:** Add an `.on` class to the Roles button when `app.referenceOpen` is true. Small.

### F-8. The .btn-sm header button (44px min-height) is too tall for the compact header [Low]
**Where:** `base.css:122` - `.btn-sm { min-height: 44px; padding: 6px 10px; font-size: .85rem }`, `reference.css:37` - `.app-header .btn-sm { margin-top: 10px }`.
**What:** The header has a title, subtitle, and a 44px button. On small phones, the header takes up ~80px of vertical space before any content.
**Scenario:** iPhone SE (375px wide). The header with the "Roles" button pushes the setup content down. The button is larger than needed for a simple toggle.
**Fix:** Consider a smaller header button variant or reduce the header button to `min-height: 36px`. Low.

### F-9. No safe-area-inset handling for notched phones in the game header [Low]
**Where:** `base.css:64` - `.app { padding: 0 14px calc(120px + env(safe-area-inset-bottom)) }`. Bottom padding accounts for safe area, but the top doesn't.
**What:** iPhones with a notch have `safe-area-inset-top`. The `.app-header` has `padding: 18px 0 10px` which may place the title under the notch on some devices.
**Scenario:** iPhone 14 Pro with Dynamic Island. The "Town of Vibelm" title may overlap with the island.
**Fix:** Add `padding-top: max(18px, env(safe-area-inset-top))` to `.app-header`. Small.

### F-10. No transition/animation on screen changes [Low]
**Where:** `base.css:81-82` - `.screen.active { animation: fade .18s ease }`.
**What:** Screens fade in on activation but there's no exit animation. The transition from seats to game (Begin Day 1) is instant: one screen hides, another appears. On phones, this feels abrupt.
**Scenario:** Moderator taps "Begin Day 1." The seats screen vanishes and the game screen fades in. The instant disappearance of the seats feels like a glitch.
**Fix:** Add a brief exit animation: `.screen { animation: fadeOut .12s ease }` when deactivating. Or use `transition: opacity .15s` on `.screen`. Low.

---

## G. Friction List: Top 10 Moderator Annoyances (2-hour session)

Ranked by frequency × severity:

1. **Trial flow confusion** (B-1, B-2): The seconding → voting transition is invisible. Moderator must remember which stage they're in. Happens every trial (3-5x per game).
2. **Night wizard "Who acts?" not prominent** (C-1): Every night step requires scanning for the actor instruction. 5-8 steps per night × 3-5 nights = ~30 times per game.
3. **Back/Skip equally weighted** (C-2): Accidental skips during the night wizard. 1-2 times per game, but disruptive (must navigate back).
4. **Team total mismatch is silent** (E-1): During setup, tapping "Start Session" with wrong totals shows only a fleeting toast. Confusing for new moderators.
5. **Preset overwrites custom deck** (E-2): One accidental preset tap loses 2 minutes of deck editing. Happens once per session but is frustrating.
6. **No "what's next" guidance** (A-5): Moderator must discover action buttons by scrolling. Especially problematic in the morning (Begin Day) and after trials.
7. **Ghost voter visibility** (B-3, B-5): Ghost tokens and ghost voters are hard to spot in a long voter list. Critical information buried.
8. **Player log entries undifferentiated** (D-2): Opening a player's detail sheet during a late-game night shows a wall of identical-looking text. Hard to find the relevant entry.
9. **Circle tiles too narrow for 15 players** (D-1): Large games make the circle layout nearly unusable. Names truncate, tags overflow.
10. **Day timer feedback is too subtle** (A-9): Timer expiry is a toast-only notification. Moderator misses it when watching the table.

---

## Recommended Batch of Changes

### Wave 1: Correctness & Legibility (core usability)

| # | Finding | Change | Size |
|---|---------|--------|------|
| 1 | A-1 | `.flow-step` opacity 0.45→0.6, `.flow-label` font-size .82rem→.88rem, add font-weight: 600 | S |
| 2 | A-2 | `.wizard-progress` font-size .8rem→.92rem, color muted→accent, font-weight: 600 | S |
| 3 | B-1 | Seconds tally chip: font-size 1rem, padding 6px 14px, font-weight 700, add progress container | M |
| 4 | B-2 | Add `<div class="notice ok">Nomination accepted. Vote now.</div>` when entering VOTE stage | S |
| 5 | B-4 | Swap tally-chip colors: GUILTY→bad, INNOCENT→ok | S |
| 6 | C-1 | `.wizard-label` font-size .88rem→.95rem, color muted→text, font-weight: 700 | S |
| 7 | C-3 | Add Jester haunt notice with `.notice.bad` above the haunt picker | S |
| 8 | D-2 | Add `data-kind` to player-log-row, style death/lynched→bad, protected→ok, night-action→accent | S |
| 9 | E-1 | Add persistent `.notice.bad` above Start button when team totals mismatch | S |
| 10 | F-1 | Add `:focus-visible` outline to base.css | S |

### Wave 2: Ergonomics (moderator workflow)

| # | Finding | Change | Size |
|---|---------|--------|------|
| 11 | C-2 | Style Back as `.btn-ok`, keep Skip as `.btn`. Add gap between them | S |
| 12 | C-4 | Show controlled player as disabled button at top of redirect list | S |
| 13 | C-5 | Add "Kill leader: [name] (role)" label above Mafia target buttons | S |
| 14 | D-3 | Group role picker by team with section headers, alphabetical within team | M |
| 15 | D-4 | Increase `.seat-sheet-role-list` max-height 35vh→45vh | S |
| 16 | D-5 | Add remaining role counts above the role picker list | S |
| 17 | D-6 | Add role category label to detail sheet role card | S |
| 18 | E-2 | Add confirmation before preset deck overwrite when custom edits exist | M |
| 19 | E-3 | Add "Reset to auto" link for civilians stepper when not in auto mode | S |
| 20 | A-5 | Add "Read aloud, then tap Begin Day" notice to morning card | S |
| 21 | A-4 | Add `.ok` class to no-deaths notice | S |
| 22 | C-6 | Add position badge to grouped steps (position 11 group) | S |
| 23 | B-5 | Merge ghost token spending note into ghostTokens output | S |

### Wave 3: Polish (visual refinement)

| # | Finding | Change | Size |
|---|---------|--------|------|
| 24 | A-3 | Remove redundant phase tag from game header | S |
| 25 | A-6 | Increase night step timer prominence (size or ring design) | M |
| 26 | A-7 | Add death cause to morning death cards | S |
| 27 | A-9 | Add vibration + audio cue on day timer expiry | S |
| 28 | B-3 | Replace ghost emoji with CSS/SVG ghost icon | S |
| 29 | B-6 | Add `.notice-critical` style for lynch results | S |
| 30 | B-8 | Improve disabled vote button styling (lower opacity, no accent bg) | S |
| 31 | C-7 | Separate Jester haunt from Veteran alert into distinct cards | S |
| 32 | C-9 | Change Forger confirm button to "FORGE" (single word, all caps) | S |
| 33 | D-1 | Scale circle tile width with player count | M |
| 34 | D-7 | Add cancel button at bottom of swap mode hint | S |
| 35 | F-2 | Audit and tokenize remaining hardcoded colors and inline styles | M |
| 36 | F-3 | Queue or stack toast notifications | M |
| 37 | F-4 | Add `.toggle-row:active` background feedback | S |
| 38 | F-5 | Improve disabled button style (add grayscale or distinct bg) | S |
| 39 | F-6 | Group end-screen role reveal by team | M |
| 40 | F-7 | Add `.on` class to Roles button when reference panel open | S |
| 41 | F-9 | Add safe-area-inset-top to app-header | S |
| 42 | F-10 | Add exit animation to deactivating screens | S |
| 43 | B-7 | Add "(ghosts: G/I only)" note on ghost voter rows | S |
| 44 | C-8 | Change "No eligible actors" to role-specific message | S |

---

*End of audit. 44 findings total. No source files were edited.*
