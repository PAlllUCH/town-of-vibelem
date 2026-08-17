# Implementation Spec — Phase B3+B4+B5

This spec is for the **engine game-logic implementation** of the new roles and victory tie-breaker. The Phase B1 role definitions (in `js/engine/01-roles.js`) and Phase B2 night steps (in `js/engine/02-presets.js`) are already done.

## Context

- Authoritative role catalog: `docs/ROLES_REVISITED.md`
- Authoritative mechanic spec: `docs/REVISION_1.md`
- Mechanical systems: `docs/GDD.md`
- Engine helpers already added in `js/engine/07-night-resolution.js`:
  - `isDemonLike(state, player)` — true for demon, imp-with-inheritedRole=demon, or amnesiac-remembered-demon
  - `E._isDemon(state, player)` — public alias
  - `E._hasBasicDefense` now includes demon-like
  - `E._sheriffSuspicious` returns true for imp, possessed, succubus, necromant, outcast
  - `E._updateInheritance` now promotes Imp to Demon when Demon dies (`state.pendingDemonSuccession`)

## Working conventions

The codebase pattern (see other resolvers in `06-night-actions.js` and `06b-night-actions.js`):

- File is an IIFE: `(function (root) { var E = root.VillageEngine; ... })(window || globalThis);`
- Each night-action resolver is a function `resolve<Name>(ctx)` that:
  - Finds its action via `ctx.actions.find(a => a.position === N && a.roleId === '...')`
  - Checks `actor.isAlive`, `!ctx.isBlocked(actor.id)`, `!ctx.isVoided(action)`, `targetId && ctx.alive(targetId)`
  - Uses `ctx.setEff(actor.id, targetId)` to record targeting
  - Uses `ctx.log(...)` for moderator transcript, `E._logPlayer(ctx.state, pid, E._logAt(ctx.state), kind, text)` for player log
  - Uses `ctx.applyAttack(targetId, 'basic' | 'unstoppable', cause)` for kills
  - For roleblock: `ctx.blocked.push(targetId)`
  - For protection: `E._byId(ctx.state, targetId).isProtected = true`
- Resolvers are exported by adding to `E._nightActions = { ... }`
- The `ctx` object includes: `state`, `actions`, `blocked`, `deaths`, `effectiveTargets`, `setEff`, `getEff`, `byId`, `alive`, `isBlocked`, `isVoided`, `applyAttack`, `log`, `nightNum`, `noKillN1`, `latestEntry`, `deferred`, `forgedWills`, `reviveTarget`, `jailor`, `jailAction`, `witchAction`, `control`, `prevBlackmailTarget`

Innkeeper is already in `ctx.rbActions` if you want to lump it in with roleblockers, but since it also grants protection, make it a separate resolver.

---

## Task 1: Implement Innkeeper resolver (in `06-night-actions.js`)

**Position**: 4, roleId `'innkeeper'`.

**Logic**:
1. Find the action: `ctx.actions.find(a => a.position === 4 && a.roleId === 'innkeeper')`.
2. Skip if no action, or actor not alive, or actor is voided or roleblocked.
3. Skip if actor is Drunk (entire effect fails).
4. Get `targetId` and verify alive.
5. Apply protection to BOTH the Innkeeper (`actor.id`) AND the target. Set `E._byId(ctx.state, targetId).isProtected = true` for the target, and `E._byId(ctx.state, actor.id).isProtected = true` for the Innkeeper.
6. Add `targetId` to `ctx.blocked` (roleblock the guest).
7. Mark the guest with `guest.protectedByInnkeeper = true` (optional, for UI tag).
8. `ctx.setEff(actor.id, targetId)`.
9. Log via `ctx.log` and `E._logPlayer` for the guest and the innkeeper.

**Edge case**: if the guest is one of the night killers (Mafioso, Serial Killer, Demon, Imp-with-inheritedRole=demon), the roleblock cancels their night action. The protection still applies for any *other* Basic attack. The target's `isProtected` flag alone doesn't block the killer's own attack — the killer's action is blocked because they are roleblocked.

---

## Task 2: Implement Demon resolver (in `06-night-actions.js`)

**Position**: 9, roleId `'demon'`.

**Logic**:
1. Find the action: `ctx.actions.find(a => a.position === 9 && a.roleId === 'demon')`.
2. Skip if no action, voided, actor not alive, or actor roleblocked.
3. Get `targetId` and verify alive.
4. Handle Witch control: if `ctx.control && ctx.control.valid && ctx.control.controlledId === actor.id && ctx.control.redirect`, use `ctx.control.redirect` as the target.
5. `ctx.setEff(actor.id, targetId)`.
6. If `ctx.noKillN1`, log "void" and skip `applyAttack`. Otherwise `ctx.applyAttack(targetId, 'basic', 'killed by the Demon')`.
7. Log result.

**Demon succession integration**: at night start, if the previous Imp-now-Demon is alive (via `player.inheritedRole === 'demon' && assignedRole === 'imp'`), include them in the kill logic. The simplest approach: in the resolver, treat `assignedRole === 'demon' || (assignedRole === 'imp' && inheritedRole === 'demon')` as a Demon actor. The NIGHT_STEPS step lists `roles: ['demon']` only, so the action carries `roleId: 'demon'`. We need to ensure the Imp-as-Demon can submit night actions after succession.

**For the action to be recordable**, the wizard needs to know who is the current Demon. The simplest engine approach for now: the resolver checks for any player with `assignedRole === 'demon' || (assignedRole === 'imp' && inheritedRole === 'demon')` who is alive and ungagged, and attributes the action to them. If the original Demon is dead and the Imp is now Demon, the Imp records the action. The action's `playerId` field is set by the UI when the wizard step is rendered.

This is a UI-side concern. For tests, we can directly invoke the resolver with an action whose `playerId` is the Imp (after `inheritedRole` was set to 'demon').

---

## Task 3: Implement Succubus resolver (in `06b-night-actions.js`)

**Position**: 11, roleId `'succubus'`.

**Logic**:
1. Find the action: `ctx.actions.find(a => a.position === 11 && a.roleId === 'succubus')`.
2. Skip if no action, voided, actor not alive, or actor roleblocked.
3. Get `targetId` and verify alive.
4. Mark the target: `E._byId(ctx.state, targetId).enchanted = true` and `E._byId(ctx.state, targetId).enchantedBy = actor.id`.
5. `ctx.setEff(actor.id, targetId)`.
6. Log via `ctx.log` and `E._logPlayer` for the actor.
7. The voting restriction (cannot vote Guilty against the Succubus on the day) is a UI/UI-state concern, not engine. The engine just records the enchantment; the day-trail code restricts votes.

---

## Task 4: Implement Necromant resolver (in `06b-night-actions.js`)

**Position**: 12, roleId `'necromant'`.

**Logic**:
1. Find the action: `ctx.actions.find(a => a.position === 12 && a.roleId === 'necromant')`.
2. Skip if no action, voided, actor not alive, or actor roleblocked. Also skip if `actor.usedOncePerGame === true` (once per game).
3. Get `targetId` (a corpse) and verify it is NOT alive. Verify the corresponding graveyard entry exists.
4. Find the remembered role: look up `ctx.latestEntry(ctx.state, targetId).trueRole`.
5. Mark `actor.usedOncePerGame = true` and `state.necromant = state.necromant || {}; state.necromant.used = true; state.necromant.rememberedRole = roleId;`.
6. Check the role has a night action that can be re-applied. If the role is start-knowing (Washerwoman, Chef), no effect to apply (log "no night ability to borrow").
7. For living targets, the wizard step needs a `secondTarget` (the living target of the borrowed ability). Read `action.extra.secondTarget`. If absent, log "no living target chosen" and skip.
8. Construct a synthetic action for the resolver of the borrowed role and queue it for re-resolution. The simplest approach: write a new synthetic action object and push it into `ctx.actions` if the borrowed role's resolver exists. The borrowed action's `roleId` is the remembered role's id, `playerId` is the Necromant, `targetId` (or secondTarget) is the living target, `position` is whatever the role's night step position is.
9. `ctx.setEff(actor.id, targetId)` (for the borrowed corpse).
10. Log via `ctx.log` and `E._logPlayer`.

**Game limit**: only one role per game (`oncePerGame: true`).

---

## Task 5: Implement Leper visitor poisoning (in `06b-night-actions.js`)

**Position**: no night step (passive). Implementation goes in the `resolveDeferred` function or a new `resolveLeper` function called after all actions.

**Logic**:
1. After all other actions resolve, scan `ctx.effectiveTargets` for entries where `targetId === <a Leper's id>` and `playerId !== <the Leper's id>`.
2. For each such visitor, set `E._byId(ctx.state, visitorPlayerId).isDrunk = true` and `E._byId(ctx.state, visitorPlayerId).poisoned = true` (so the Poisoner-theft conflict applies on the next cycle).
3. Log via `ctx.log` and `E._logPlayer`.

---

## Task 6: Update `10-victory.js` for tie-breakers

Update `E.checkVictory` to apply the new tie-breaker rules (GDD §5.5 E):

```js
E.checkVictory = function (state) {
  var living = state.players.filter(function (p) { return p.isAlive; });
  if (living.length === 0) {
    var result = { winner: null, reason: 'No living players.' };
    state.winner = result;
    state.phase = 'END';
    return result;
  }
  if (living.length === 1) {
    var last = living[0];
    if (E._alignmentOf(state, last) === 'TOWN') {
      return finish(state, { winner: 'TOWN', reason: 'The last survivor is Town-aligned.' });
    }
    if (E._isSerialKiller(state, last) || E._isDemon(state, last)) {
      var kind = E._isSerialKiller(state, last) ? 'SERIAL_KILLER' : 'DEMON';
      return finish(state, { winner: kind, reason: 'The ' + (kind === 'SERIAL_KILLER' ? 'Serial Killer' : 'Demon') + ' stands last.' });
    }
    if (E._alignmentOf(state, last) === 'MAFIA') {
      return finish(state, { winner: 'MAFIA', reason: 'The last survivor is Mafia-aligned.' });
    }
    if (E._alignmentOf(state, last) === 'EVIL') {
      return finish(state, { winner: 'EVIL', reason: 'The last survivor is Evil-aligned.' });
    }
  }
  var town = 0, mafia = 0, evil = 0;
  for (var i = 0; i < living.length; i += 1) {
    var a = E._alignmentOf(state, living[i]);
    if (a === 'TOWN') town += 1;
    else if (a === 'MAFIA') mafia += 1;
    else if (a === 'EVIL') evil += 1;
  }
  var sk = living.find(function (p) { return E._isSerialKiller(state, p); });
  var demon = living.find(function (p) { return E._isDemon(state, p); });
  var result = null;
  // 1v1 tie-breaker priority: SK > Demon > Evil leader > Mafia >= Town
  if (sk && living.length - 1 <= 1) {
    result = { winner: 'SERIAL_KILLER', reason: 'The Serial Killer stands last or holds majority.' };
  } else if (demon && living.length - 1 <= 1) {
    result = { winner: 'DEMON', reason: 'The Demon stands last or holds majority.' };
  } else if (mafia >= town + evil) {
    result = { winner: 'MAFIA', reason: 'The Mafia holds majority.' };
  } else if (mafia === 0 && evil === 0 && !sk && !demon) {
    result = { winner: 'TOWN', reason: 'All Mafia-aligned and Evil players are dead.' };
  }
  if (result) {
    result.survivors = E._livingSharers(state);
    state.winner = result;
    state.phase = 'END';
    state.logs.push(result.winner + ' wins: ' + result.reason);
  }
  return result;
};

function finish(state, result) {
  result.survivors = E._livingSharers(state);
  state.winner = result;
  state.phase = 'END';
  state.logs.push(result.winner + ' wins: ' + result.reason);
  return result;
}
```

Add `E._livingSharers` already works for the new sharers (Survivor, Drunk, Spy). Document that Leper, Outcast, Possessed, Succubus, Necromant do NOT share the win unless they are the winner.

---

## Task 7: Wire resolvers into `E._nightActions`

In `06-night-actions.js`, add `innkeeper: resolveInnkeeper` and `demon: resolveDemon` to the `E._nightActions` object.

In `06b-night-actions.js`, add `succubus: resolveSuccubus`, `necromant: resolveNecromant`, and `leperPoison: resolveLeper` to the `E._nightActions` object.

---

## Task 8: Update `09-day.js` (or wherever) to apply Succubus vote restriction

After the existing trial logic, in the `castVote` handlers, if a player is enchanted, treat their Guilty vote as a no-op (or convert to Abstain). The simplest approach: in `castVote`, after recording the vote, check `state.players[i].enchanted` and `state.players[i].enchantedBy === vote.accusedId`. If the vote is GUILTY and the accused is the Succubus, replace it with ABSTAIN (per BotC rules: the enchanted player cannot vote Guilty against the Succubus).

Find the existing `castVote` / `castVerdictVote` / `castSentenceVote` functions in `js/engine/09-day.js` and apply this filter.

---

## Tests to add (also assign to a later worker)

Unit tests in `tests/engine-roles.test.js` for new roles:
- Innkeeper: protection applies to both, guest roleblocked, Drunk Innkeeper fails
- Demon: Basic attack kill, blocked by Doctor protection, blocked by Basic defense (via imp-as-demon)
- Demon succession: when Demon dies, Imp becomes new Demon with Basic defense
- Outcast: Sheriff reads SUSPICIOUS, Oracle reads NOT TOWN
- Possessed: Sheriff reads SUSPICIOUS, role hidden
- Succubus: target is enchanted, voting restriction
- Necromant: borrows dead role's ability once, then locked
- Leper: visitors become Drunk

Victory tests in `tests/engine-victory.test.js`:
- 1v1 SK + non-Town: SK wins
- 1v1 Demon + non-Town: Demon wins
- 1v1 Mafia + Town: Mafia wins (no change)
- 1v1 Evil + Town: Evil wins

---

## Files to touch

- `js/engine/06-night-actions.js` — Innkeeper, Demon resolvers
- `js/engine/06b-night-actions.js` — Succubus, Necromant, Leper resolvers
- `js/engine/07-night-resolution.js` — already updated (helpers + Imp succession)
- `js/engine/09-day.js` — Succubus vote restriction
- `js/engine/10-victory.js` — tie-breaker logic

## Output

Update each touched file in-place. Output the complete updated file for each via the worker's `[FILE: name]...[/FILE]` blocks. Do not touch tests in this task (separate worker). Do not touch UI files (later Phase C).
