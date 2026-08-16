# Audit: Improvements written down but never executed (R-AUDIT output)

Date: 8/13/2026. Read-only audit by research agent. The source docs it reviewed
(balance-proposal, design-suggestions, the reports folder, SESSION-REPORT, CONCEPT) were
removed in the 8/16 doc cleanup; the condensed result lives in docs/IMPROVEMENTS-STATUS.md.

## A. IMPLEMENTED (confirmed in code)

- Balance proposal: Change 1 default (noKillN1 toggle ON in config.js), Change 2 (no
  Jailor cap), Change 4 (Doctor blocks all Basic attacks). Changes 3, 5, 6 not done.
- first-night-roles.md: only Oracle survives; Night Watcher / Informer / Informant deleted
  (owner request). AGENTS.md:62 still mentions Informant (stale).
- design-suggestions.md: all 12 items confirmed present (game.css, base.css, seats.css,
  setup.css, reference.css, icon.svg, router.js, common.js, actions-setup.js).
- ui-audit.md: 44 findings confirmed across waves 1-3 (day.js, wizard.js, seats.js,
  base.css, game.css, sheets.css, router.js, end.js, actions-setup.js, common.js).
- tos-botc-comparison.md implemented subset: noLynchD1 default, claim round, whispers
  panel, inherited-Deputy prompt, CLEANED corpses, forged-target, prev-step, summary
  card, LAST ALERT, INVERTED Consigliere, poisoned tag, night-zero checklist (6 rows).
- SESSION-REPORT "Work delivered" items 1-15 all present. 35 roles match GDD.

## B. NOT EXECUTED (documented, absent from code)

1. "Balance Check" feature on the setup screen (SESSION-REPORT next steps; would live in
   js/ui/setup.js + js/app/actions-setup.js).
2. Neural-net scale-up / other presets / player counts / multiplayer server AI
   (SESSION-REPORT next steps; dev tooling, not app features).
3. balance-proposal Change 1 second half: remove the noKillN1 house-rule toggle (night-1
   kills always void).
4. balance-proposal Change 3: adjusted ratio table (10:7/2/1, 11:8/2/1, 12:8/3/1,
   13:9/3/1, 14:9/3/2, 15:10/3/2) — engine RATIO_TABLE and GDD still old.
5. balance-proposal Change 5: structural "guaranteed protective role per preset" rule
   (no GDD rule, no deck logic; presets merely happen to include Doctor).
6. balance-proposal Change 6: 20% Mafia kill failure or deterministic both-killers rule.
7. tos-botc-comparison recommendations absent: full Night Zero screen (#1), sticky
   night-results banner (#2), FORGED WILL death badge (#11), morning read-order tick-list
   (#12), silenced-players banner (#13), tie/no-lynch/acquit distinction (#14), failed
   nominations notice (#16), "need k more guilty" pill (#17), Jailor execution count on
   tile (#21), Vigilante shots on tile (#22), TARGET tag on Executioner target (#23),
   nominator-death decrement (#24), trial result reason field (#25), house-rule toggles
   stubbornToSClaims (#26) and lynchSecret (#27), town-informant role (#28), Mafia spy
   (#29), noFramerDrunkInvert (#30), forged-wills seat tile (#31), playerLog kind filter
   (#33), detail-sheet current-info (#34), stale-info markers (#35), Quick start (#36),
   seat-layout preview (#37), save version field (#38), Export save (#39), 3-slot save
   picker (#40).
8. Engine createGame defaults noKillN1 OFF (04-state.js:88) contradicting GDD; all sims
   and NN training call createGame without houseRules, so reported balance figures were
   measured under the OLD rules.
9. Trained weights absent (weights/ directory missing; agent-loader throws; NN "40%
   Town win" not reproducible from repo).
10. Stale role blurbs: Jailor "max 3" (01-roles.js:9), Doctor "first Basic attack"
    (01-roles.js:24) contradict GDD/engine.
11. Zombie test "the execution cap is three per game" (formerly tests/engine.test.js:1038-1045, now in the split suites) passes
    only via the N1 no-execute rule; executionsUsed counter never read.
12. Stale docs: README 30 roles/119 tests, AGENTS.md caps line + Informant, SESSION-REPORT
    "213 pass" (actually 221).

## C. CODE MARKERS

None (no TODO/FIXME/XXX/HACK in js/, styles/, scripts/, docs/).
