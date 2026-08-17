# Phase E: Comprehensive Unit Tests for New Roles

## Context
- 43 roles total, 8 new: innkeeper, leper, outcast, succubus, necromant, demon, imp, possessed
- Night steps at js/engine/02-presets.js (positions: Innkeeper pos 4, Demon/SK pos 9, Succubus pos 11, Necromant pos 12)
- Helpers: E.roleName, E.roleBlurb, E.setLocale in js/engine/01-roles.js
- Victory tie-breaker in js/engine/10-victory.js
- Engine helpers: E._isDemon, E._hasBasicDefense, E._sheriffSuspicious, E._alignmentOf in js/engine/07-night-resolution.js

## Test pattern
Follow the existing test pattern from engine-roles.test.js and engine-victory.test.js:
- Use node:test (describe/test)
- Use assert from node:assert/strict
- Use assignRoles helper from helpers.js
- Use E.createGame, E.setPlayerNames, E.dealRoles, E.recordNightAction, E.resolveNight
- Keep tests self-contained (each test creates its own state)

## Tests to add in tests/engine-roles.test.js

### describe('Innkeeper')
- test('both Innkeeper and guest gain Basic defense'): set up 8p game with innkeeper + mafia. Night: mafia targets innkeeper, innkeeper protects guest. Both survive. Verify both isProtected.
- test('guest is roleblocked by Innkeeper'): innkeeper protects a serial killer. SK's action fails. Verify SK didn't kill.
- test('Innkeeper Drunk fails entirely'): innkeeper is Drunk (poisoned before). Protection fails, guest not roleblocked. Mafia kills guest.

### describe('Leper')
- test('night visitors become Drunk'): leper on table. Escort visits leper. After night, escort is Drunk.
- test('non-visitors unaffected'): leper on table. Doctor protects someone else. Doctor not Drunk.

### describe('Succubus')
- test('enchant target gets enchanted flag'): succubus enchants a player. Verify target.enchanted = true.
- test('enchanted player cannot vote Guilty against Succubus in verdict'): succubus on trial. Enchanted voter tries Guilty. Vote becomes Abstain.

### describe('Necromant')
- test('borrows dead Sheriffs ability once'): sheriff dies. necromant targets corpse + living target. Sheriff check runs on living target. Verify oncePerGame.
- test('cannot borrow twice'): attempt second borrow. Fails.

### describe('Imp and Demon succession')
- test('Imp has no night action while Demon lives'): create game with imp + demon. Imp has no action at pos 9. Demon kills.
- test('Imp becomes new Demon when Demon dies'): demon dies. Verify imp.inheritedRole = 'demon'. Next night, imp kills.
- test('Imp reads INNOCENT to Sheriff after succession'): imp promoted. Sheriff checks imp. Result = INNOCENT.

### describe('Possessed')
- test('reads Evil to Sheriff'): sheriff checks possessed. Result = SUSPICIOUS.
- test('counts as Evil for alignment'): E._alignmentOf returns 'EVIL'.

### describe('Outcast')
- test('reads Evil to Sheriff'): sheriff checks outcast. Result = SUSPICIOUS.
- test('wins by surviving'): outcast alive at game end. Check victory includes outcast.

## Tests to add in tests/engine-victory.test.js

### describe('tie-breakers')
- test('SK + 1 non-Town: SK wins'): set up game with SK vs Godfather only. SK wins.
- test('Demon + 1 non-Town: Demon wins'): set up game with Demon vs Godfather only. Demon wins.
- test('Evil + Town (1v1): Evil wins'): set up game with possessed vs town. Evil wins.
- test('all Mafia + SK dead: Town wins'): standard win.
- test('Demon alive with only Town: Demon wins'): set up. Demon kills last town. Demon wins.

## Output
Edit tests/engine-roles.test.js and tests/engine-victory.test.js in-place. Follow existing code style. Do not add comments. Output complete updated files via FILE blocks.
