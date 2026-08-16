# Town of Vibelm — Improvements Status (done vs left to do)

Date: 8/13/2026 | Session gate: 248 tests pass, 0 fail; 30-run sims clean.
Sources: this session's work, docs/audit-unimplemented.md (research audit),
docs/gameplay-improvements.md (proposals), docs/interface.md.

---

## 1. DONE this session (all implemented and tested)

| # | Request | Implementation |
|---|---|---|
| 1 | Oracle works every night | `js/engine/01-roles.js` (n1Only removed, nightly), `05-night-steps.js` (filter removed), night-zero rows in `js/ui/seats.js`, GDD §2.1/§4.8/§5.1/§12.4, interface.md |
| 2 | Reset (clear) a picked role | Clear Role button in the naming sheet (`js/ui/seats.js`, `js/app/actions-sheets.js`), save drops the pending role; hidden in the post-deal Edit Names flow |
| 3 | No whispering; moderator shows tokens | GDD: whisper windows removed, token relay stated, §1.1/§12.3 updated; app: Whispers → Tokens, panel "Info Tokens", card "Info to Show" + "Token shown" (`js/ui/panels.js`, `day.js`, `actions-day.js`, `actions.js`, `actions-panels.js`, `config.js`). Medium seance kept (role ability) |
| 4 | Claims section = full list / layout | Claim round lists every living player at once, tap-to-edit in any order (`js/ui/claims.js`); seat overlay tiles show claim chips in the seat layout (`js/ui/common.js` seatTiles + `day.js`) |
| 5 | No self-agreement in trials | Nominator no longer auto-counts (must second); accused excluded from seconding, verdict AND sentence votes (`js/engine/09-day.js`, `js/ui/day.js`) |
| 6 | Guilty > innocent → dies; last speech; moderator override | Verdict counts GUILTY vs INNOCENT only (abstains ignored, Mayor weight 3); guilty majority → SENTENCE stage (last speech + spare vote, strict majority of living spares, else lynch with full jester/executioner/victory handling); `resolveSentence`, `killPlayer`, `undoKill`; day view moderator controls |
| 7 | Trial resets on a new day | `beginDay` closes an unresolved active trial and resets dayTrialsDone |
| 8 | Codebase split into smaller files | `js/ui/common.js` (372) → common + `panels.js` + `claims.js`; `js/app/actions-game.js` (378) → game + `actions-wizard.js` + `actions-day.js`; `js/engine/09-day.js` (385) → 09 + `09b-day-actions.js`; `js/ui/day.js` (384) → day + `day-trial.js`; tests split into 7 suites + `helpers.js`. Registered in index.html, sw.js CORE_ASSETS, barrel `js/engine.js`; docs updated |
| 9 | Review + fix loop | 2 review cycles; 6 MEDIUM + 20 LOW found and resolved (undoKill jester-haunt guard + lynch refund, resolveTrial SENTENCE guard, killPlayer inheritance, Clear Role flow, stale docs/tests) |
| 10 | UI batch: claims to the top menu, Mod panel, phase clock, timer nudge, collapsible cards | Day-1 guided claim round removed; claims recorded only via the header Claims panel (`js/ui/claims.js` `renderClaimsPanel`/`renderClaimPicker`, seat-tile claim chips in `js/ui/common.js`); `claimRound` dropped from config/persistence. Header is now Tokens / Claims / Seats / Log / Mod with `UI.renderModPanel` (kill-player / undo-kill, undo disabled on an empty graveyard) in `js/ui/panels.js`. Phase clock `div.cycle-clock` (data-phase/data-cycle) replaces the header label and flow strip, styled by the new `styles/clock.css` (linked after game.css, before end.css in index.html and sw.js). Day timer gains -10s/+10s nudges (`APP.adjustDayTimer`, `data-delta`). Day/morning cards are collapsible via `UI.card` (`toggle-card`, `APP.app.collapsed` persisted) |

## 2. IMPLEMENTED (confirmed in code, from the audit)

- Balance proposal changes 1 (default), 2, 4: noKillN1 default ON, Jailor cap removed,
  Doctor blocks all Basic attacks.
- Designer audit: all 12 items implemented. UI audit: all 44 findings implemented.
- Oracle (nightly now), Witness, Washerwoman, Chef, Spy; 35 roles per GDD.
- BotC-comparison implemented subset: noLynchD1, claims panel (full list),
  tokens panel, inherited-Deputy prompt, CLEANED corpses, forged-target, prev-step,
  night summary, LAST ALERT, INVERTED Consigliere, poisoned tag, Night Zero checklist.
- This session additionally closed audit items #14/#20/#25 (trial result reason field:
  tie / not-guilty / no-lynch-day-1 / spared / accused-dead / guilty-stands / cancelled).

## 3. LEFT TO DO (documented but not executed, prioritized)

### P0 — structural balance (proposals in docs/gameplay-improvements.md)
- Ratio-table rebalance (balance Change 3): 2 Mafia at 6-11 players, 3 at 12-15;
  requires re-deriving §4.8 deck reach. Engine: `02-presets.js` RATIO_TABLE,
  `03-deck.js`, ratio tests. [P0-1]
- Guaranteed Doctor in every deck (balance Change 5): post-fill guarantee replacing
  the lowest-priority Town role. [P0-2]

### P1 — next
- Mafia kill dies with the Mafioso (deterministic Change 6 alternative): the kill
  resolves only if the Mafioso is alive and unroleblocked; GF never carries it out.
  High risk, ship after P0-1 + playtesting. [P1-1]
- Sentence stage tuning: replace verdict/sentence Abstain with an explicit Condemn
  default; playtest two spare bars. [P1-2]

### P2 — later
- Oracle nerf on the shelf (every-other-night cooldown or self-drunk) only if Town
  exceeds ~55% win rate. [P2-1]
- New roles: Bodyguard (Town Protective), Physician (Poisoner cure). [P2-2/P2-3]
- House rule: Open Graves (dead speak in the day, default OFF). [P2-4]
- Setup "Balance Check" QoL (archetype or NN win preview; weights/ dir is gitignored
  and currently absent). [P2-5]

### Other known gaps (from the audit)
- Engine `createGame` defaults noKillN1 OFF (04-state.js:88) contradicting GDD; every
  sim/NN entry point calls it without houseRules, so published balance figures were
  measured with Night-1 kills. Decide: default the engine to GDD, or pass houseRules
  in all sim entry points.
- Trained NN weights absent (weights/ missing) — the "40% Town" result is not
  reproducible from the repo as-is.
- Stale blurbs fixed? Jailor "max 3" and Doctor "first Basic attack" blurbs in
  `js/engine/01-roles.js` still contradict GDD/engine (audit item 37) — small doc fix.
- Zombie test "execution cap is three per game" still passes only via the N1
  no-execute rule; executionsUsed counter is never read (audit item 11).
- BotC-comparison unexecuted recommendations: full Night Zero screen, sticky
  night-results banner, FORGED WILL death badge, morning read-order tick-list,
  silenced-players banner, failed-nominations notice, "need k more guilty" pill,
  Jailor executions / Vigilante shots / Executioner TARGET tags on tiles, playerLog
  kind filter, detail-sheet current-info, stale-info markers, Quick start,
  seat-layout preview, save version field, Export save, 3-slot save picker,
  stubbornToSClaims / lynchSecret / noFramerDrunkInvert toggles, town-informant
  role, Mafia-spy variant.
- Dev tooling (SESSION-REPORT next steps): NN training scale-up, more presets/counts,
  server-side multiplayer AI.

## 4. Explicitly rejected (do not implement)
Night Watcher / Informer / Informant roles (deleted by owner), 20% RNG Mafia kill
failure (contradicts fairness-by-construction), scripts/llm-sim (unreliable),
Legacy concept features (superseded by GDD).

## 5. Where the details live
- Proposals with GDD-ready rule text: docs/gameplay-improvements.md (8 proposals + 6
  open questions for the playtesting group).
- Audit evidence with file:line: docs/audit-unimplemented.md.
- API contract: docs/interface.md (24 engine functions incl. resolveSentence,
  killPlayer, undoKill).
