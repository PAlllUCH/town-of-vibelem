# First-Night-Only Role Proposals

*Designer report. Repo: `G:/Mój dysk/Projekty/Town of Vajbelem`. Source of truth: `docs/GDD.md` (rules) and `docs/interface.md` (API). Every claim below has a GDD or engine reference. No source files were edited.*

---

## N1-only design rationale

N1-only roles ("act once on Night 1, then become civilians") solve a specific problem in Vibelm's flow: **Day 1 has nothing to investigate** (GDD §12.3, `tos-botc-comparison.md` §2.3). The town wakes to an empty morning (NoKillN1 default), with no corpse, no will, and no check results. N1-only roles give the *first* night a burst of calibrated information that becomes Day 2 conversation material without repeating in later nights.

**Why this works for a moderator-run table game:**

- **One wizard tap each.** The moderator wakes the player once, records one gesture, whispers one result. No recurring bookkeeping.
- **Day 1 gets stakes.** Players with N1-only roles know they have *one shot* and will advocate for targets during Day 1 discussion. This seeds the first arguments.
- **Day 2 gets material.** The results (one alignment fact, one visitor count, one role reveal) are exactly the kind of calibrated information BotC uses to drive conversation (`tos-botc-comparison.md` §2.5, §5).
- **Balance scales naturally.** At 6 players the deck is tight and N1-only roles are rare; at 15 players there's room for all three. They consume Town slots that would otherwise be Civilians, so they *add* information density without changing the ratio table.
- **Bluff surface expands.** N1-only roles that are *not* in the deck appear in the Godfather's bluff pool (`state.gfBluffs`, `seats.js:113`). The GF can now claim "I'm the Oracle, I checked Bob, he's Town" — a verifiable lie.

---

## 1. Oracle

| Field | Spec |
|---|---|
| **Name** | Oracle |
| **Team** | Town (Town Investigative) |
| **N1-only tagline** | Reads the light in one soul. Once. |
| **Ability** | Night 1 only. Choose a living player: learn whether they are **TOWN** or **NOT TOWN**. After Night 1, the Oracle is a plain civilian with no further abilities. |
| **When it wakes** | Position 11 (with the existing Town Investigative cluster). Own step: "Oracle, open your eyes. Point to the player you read." Separate wake from Sheriff, Tracker, Lookout, Consigliere, and Undertaker at the same position (matching the GDD convention: every non-Mafia role wakes in its own step, GDD §5.1). |
| **Target rules** | Any living player, including self. Non-self target preferred by convention (Doctor is the only role that self-targets, GDD §2.1); self-target allowed mechanically to avoid an engine edge case, but the moderator should discourage it. Cannot target a dead player (ghost). |
| **Result** | The moderator whispers: **"TOWN"** or **"NOT TOWN"**. Wording is deliberately distinct from the Sheriff's SUSPICIOUS/INNOCENT so the Oracle and Sheriff cannot be confused at the table. |
| **Drunk inversion** | If the Oracle is Drunk (Poisoner target or The Drunk role, GDD §6), the result is inverted: a Town player reads NOT TOWN, a non-Town player reads TOWN. The app notes `[INVERTED]` beside the result (matching the recommended Consigliere pattern, `tos-botc-comparison.md` §3.7). |
| **Roleblock/Witch interaction** | Roleblocked (Escort/Consort at position 4): no result; the Oracle's action is void (GDD §5.1, "roleblock only cancels the target's own action"). Controlled by Witch (position 2): the Oracle's target is redirected to the Witch's chosen target; the Oracle learns the redirected target's alignment. The Witch learns the Oracle's exact role (GDD §2.3). |
| **Victory counting** | Town-aligned (GDD §9.1). Counts as Town for Town victory condition (§9.3: "every Mafia-aligned player is dead and the Serial Killer is dead"). No individual victory condition. |
| **Bluff compatibility** | Excellent GF bluff. If the Oracle is not in the deck, it appears in the Godfather's three-Town-bluff list (`state.gfBluffs`). The GF can claim "I'm the Oracle, I checked [Mafia teammate], they're Town" — a verifiable-sounding lie that the Town must cross-check against other info. The Oracle's N1-only nature means the bluff claim expires after Day 2, which is natural: "I already used my ability." |
| **Balance notes** | Scales well 6-15. At 6 players (4 Town, 2 Mafia), the Oracle has a 67% chance of hitting Town and a 33% chance of hitting Mafia; a NOT TOWN result narrows suspects to 2 players. At 15 players (9 Town, 4 Mafia, 2 Neutral), the Oracle is one source among many and doesn't dominate. The Oracle adds ~1 bit of alignment info to Night 1, comparable to the Sheriff but without recurring value. Mafia can counter-claim Oracle and fabricate results. Town can cross-check Oracle results against Sheriff results for consistency. |
| **Example table-talk** | *"I'm the Oracle. I checked Alice last night — she's TOWN. If anyone has info that contradicts this, speak now."* |

### Engine touchpoints

| File | What to add/change |
|---|---|
| `js/engine/01-roles.js` | New entry `oracle`: `{ id:'oracle', name:'Oracle', team:'TOWN', category:'Town Investigative', blurb:'Night 1 only. Learns whether a player is Town or not Town. Becomes a civilian after Night 1.', nightAction:true, dayAction:false, oncePerGame:true, maxUses:1, n1Only:true }`. The `n1Only:true` field is new and signals `getNightSteps` to filter this role out after Night 1. |
| `js/engine/02-presets.js` (`E.NIGHT_STEPS`) | New step: `{ position:11, title:'Oracle', roles:['oracle'], prompt:'Oracle, open your eyes. Point to the player you read.' }`. Insert after the existing position-11 steps (e.g. after Consigliere, before Undertaker). |
| `js/engine/05-night-steps.js` (`getNightSteps`) | Filter: skip Oracle step when `nightNum !== 1` (same pattern as Retributionist/Amnesiac conditional logic). In the `tpl.position === 11` branch, add: `if (tpl.title === 'Oracle' && !isNightOne) continue;`. |
| `js/engine/06-night-actions.js` | New resolver in `E._nightActions.investigators`: if `a.roleId === 'oracle'`, look up the target's team (`E.ROLES[target.assignedRole].team`). Apply Drunk inversion. Whisper the result. Log `"Oracle reads [Name]: TOWN/NOT TOWN"` into `state.logs`. |
| `js/engine/07b-night-resolution.js` | No change. Oracle resolution is folded into the investigators block. |
| Victory checks (`js/engine/10-victory.js`) | No change. Oracle is Town-aligned; existing Town victory logic handles it. |

---

## 2. Night Watcher

| Field | Spec |
|---|---|
| **Name** | Night Watcher |
| **Team** | Town (Town Support) |
| **N1-only tagline** | Counts the footsteps in the dark. Once. |
| **Ability** | Night 1 only. Choose a living player: learn **how many players** visited them with a night action that night. After Night 1, the Night Watcher is a plain civilian with no further abilities. |
| **When it wakes** | Position 11 (own step, separate wake). Prompt: "Night Watcher, open your eyes. Point to the player you watch." Placed after Oracle in the step order. The Night Watcher counts all recorded actions at positions 0-10 that targeted the chosen player, *excluding* the Night Watcher's own action and actions by dead players. |
| **Target rules** | Any living player, including self (watching yourself tells you how many roles visited *you* — strong defensive info). Cannot target a dead player. |
| **Result** | The moderator whispers a single number: **"0"**, **"1"**, **"2"**, or higher. No role names, no visitor identities. A count of 0 means nobody visited the target. A count of 2+ means the target is a high-interest player (likely Mafia target, Doctor target, or investigative target). |
| **Drunk inversion** | None. The Night Watcher counts visitors; visitor count is a mechanical fact, not a judgment call. Drunkenness does not corrupt factual counts (GDD §6.1: "No other ability is affected by drunkenness"). The Night Watcher ignores Drunk status. |
| **Roleblock/Witch interaction** | Roleblocked (Escort/Consort at position 4): no result; the count is void. Controlled by Witch (position 2): the Night Watcher's target is redirected to the Witch's chosen target; the Night Watcher learns the redirected target's visitor count. The Witch learns the Night Watcher's exact role. If the redirected target has no visitors (common for an arbitrary Witch pick), the Night Watcher learns "0". |
| **Victory counting** | Town-aligned (GDD §9.1). No individual victory condition. |
| **Bluff compatibility** | Good GF bluff. The GF can claim "I'm the Night Watcher, I watched Bob, 0 visitors" — a plausible lie that is hard to disprove (who would contradict a "0" claim?). If the GF watched a Mafia teammate, claiming "1 visitor" (the Consigliere visited them) is also plausible. |
| **Balance notes** | Provides ~1.5 bits of info: the count itself (0, 1, 2+) plus the meta-signal that the target is interesting enough to be visited. At 6 players with 2 Mafia, a count of 1 on a player means exactly one role visited them — but the Night Watcher doesn't know *which* role. This creates discussion: "Who visited Bob?" is the Day 2 question. Mafia can muddy the waters by claiming Night Watcher results that contradict the real ones. The Night Watcher is weaker than the Lookout (who learns *identities*) but available on the first night when no other visitor-tracking exists. |
| **Example table-talk** | *"I'm the Night Watcher. I watched Bob last night — two people visited him. That's a lot of interest for Night 1. Bob, care to explain?"* |

### Engine touchpoints

| File | What to add/change |
|---|---|
| `js/engine/01-roles.js` | New entry `nightwatcher`: `{ id:'nightwatcher', name:'Night Watcher', team:'TOWN', category:'Town Support', blurb:'Night 1 only. Learns how many players visited the chosen target. Becomes a civilian after Night 1.', nightAction:true, dayAction:false, oncePerGame:true, maxUses:1, n1Only:true }`. |
| `js/engine/02-presets.js` (`E.NIGHT_STEPS`) | New step: `{ position:11, title:'Night Watcher', roles:['nightwatcher'], prompt:'Night Watcher, open your eyes. Point to the player you watch.' }`. Insert after Oracle in the position-11 cluster. |
| `js/engine/05-night-steps.js` (`getNightSteps`) | Filter: skip Night Watcher step when `nightNum !== 1`. Add `if (tpl.title === 'Night Watcher' && !isNightOne) continue;` in the position-11 branch. |
| `js/engine/06-night-actions.js` | New resolver: count all `state.night.actions` entries at positions 0-10 whose `targetId` matches the Night Watcher's chosen target. Exclude actions by dead players and the Night Watcher's own action. Whisper the count. Log `"Night Watcher watches [Name]: [n] visitors"`. |
| `js/engine/07b-night-resolution.js` | No change. Night Watcher resolution is folded into the investigators block (position 11). |
| Victory checks | No change. Night Watcher is Town-aligned. |

---

## 3. Informer

| Field | Spec |
|---|---|
| **Name** | Informer |
| **Team** | Town (Town Investigative) |
| **N1-only tagline** | Learns exactly who one person is. Once. |
| **Ability** | Night 1 only. Choose a living player: the moderator privately reveals their **exact role**. After Night 1, the Informer is a plain civilian with no further abilities. |
| **When it wakes** | Position 11 (own step, separate wake). Prompt: "Informer, open your eyes. Point to the player you investigate." Placed after Night Watcher in the step order (Oracle → Night Watcher → Informer → existing steps). |
| **Target rules** | Any living player, including self (learning your own role is pointless but not harmful). Cannot target a dead player. |
| **Result** | The moderator whispers the target's **exact role name** (e.g. "Sheriff", "Godfather", "Jester"). Same wording style as the Consigliere (GDD §2.2: "learns their exact role"). |
| **Drunk inversion** | If the Informer is Drunk, the result is **false**: a random role of a **different alignment** is shown instead (GDD §6.1, matching the Consigliere's Drunk rule exactly). The app notes `[INVERTED]` beside the result. The Informer does not know they are Drunk (the Poisoner is secret); the false result will be discovered later when the target's claims contradict it. |
| **Roleblock/Witch interaction** | Roleblocked (Escort/Consort at position 4): no result; the action is void. Controlled by Witch (position 2): the Informer's target is redirected; the Informer learns the redirected target's role. The Witch learns the Informer's exact role. If the redirected target is the Witch herself, the Informer learns "Witch" (or a random non-Neutral role if Drunk). |
| **Victory counting** | Town-aligned (GDD §9.1). No individual victory condition. |
| **Bluff compatibility** | Strong GF bluff but risky. The GF can claim "I'm the Informer, I checked [Mafia teammate], they're Sheriff" — a verifiable-sounding lie. The risk: if the real Informer is in the game and checked the same player, the GF is exposed. The Informer's N1-only nature limits the damage: the GF can claim to have used their ability already and shift to a civilian-equivalent posture. |
| **Balance notes** | The most powerful of the three roles (learns the exact role, not just alignment or a count). At 6 players, a single Informer check can identify the Godfather on Night 1 — but the Godfather has Basic defense and the Mafia can counter-claim. At 15 players, the Informer is one of many info sources and doesn't dominate. The Informer occupies the same niche as the Consigliere (exact role reveal) but for Town and only once. This asymmetry is deliberate: the Consigliere acts every night (Mafia advantage), while the Informer acts once (Town burst). If both are in the deck, they check each other's targets and the information war intensifies. The Informer is the highest-priority N1-only role for deck inclusion because it produces the most actionable Day 2 material. |
| **Example table-talk** | *"I'm the Informer. I checked Charlie last night — he's the Godfather. Charlie, care to claim?"* |

### Engine touchpoints

| File | What to add/change |
|---|---|
| `js/engine/01-roles.js` | New entry `informer`: `{ id:'informer', name:'Informer', team:'TOWN', category:'Town Investigative', blurb:'Night 1 only. Learns the exact role of one player. Becomes a civilian after Night 1.', nightAction:true, dayAction:false, oncePerGame:true, maxUses:1, n1Only:true }`. |
| `js/engine/02-presets.js` (`E.NIGHT_STEPS`) | New step: `{ position:11, title:'Informer', roles:['informer'], prompt:'Informer, open your eyes. Point to the player you investigate.' }`. Insert after Night Watcher in the position-11 cluster. |
| `js/engine/05-night-steps.js` (`getNightSteps`) | Filter: skip Informer step when `nightNum !== 1`. Add `if (tpl.title === 'Informer' && !isNightOne) continue;` in the position-11 branch. |
| `js/engine/06-night-actions.js` | New resolver in `E._nightActions.investigators`: if `a.roleId === 'informer'`, look up `E.ROLES[target.assignedRole].name`. Apply Drunk inversion (random role of different alignment, matching Consigliere logic). Whisper the role name. Log `"Informer investigates [Name]: [RoleName]"`. |
| `js/engine/07b-night-resolution.js` | No change. Informer resolution is folded into the investigators block. |
| Victory checks | No change. Informer is Town-aligned. |

---

## N1-only engine pattern

All three roles share a common implementation pattern. Rather than scattering N1-only logic across files, add a single `n1Only: true` field to the role definition in `01-roles.js`:

```js
// In getNightSteps (05-night-steps.js), add to the conditional chain:
} else if (tpl.n1Only && !isNightOne) {
  continue;  // skip N1-only steps after Night 1
}
```

This replaces the per-role `if (tpl.title === 'Oracle' && !isNightOne) continue;` checks above with a single generic filter. The `isNightOne` variable already exists in `getNightSteps` (`05-night-steps.js:8`). The `n1Only` field on `E.NIGHT_STEPS` entries flows from the role definition through the step template.

For `state.players[]`, no new fields are needed. The existing `usedOncePerGame` flag (used by Retributionist, Amnesiac, Deputy, Mayor) already tracks whether a once-per-game ability was consumed. Set `usedOncePerGame = true` after the N1 action is recorded. The `getNightSteps` filter ensures the step never appears again.

---

## Deck placement

Each N1-only role replaces a *priority slot* in an existing preset's Town list (not an addition — the deck size equals player count). They should sit *below* recurring power roles and *above* Civilians, since they're more valuable than a blank card but less valuable than a role that acts every night.

### Recommended placements

| Role | Preset | Insert after | Replaces | Rationale |
|---|---|---|---|---|
| **Oracle** | P2 (The Poisoned Pint) | Tracker (pos 6 in Town list) | Tracker's slot → Tracker moves down | P2's Town list is info-heavy (Sheriff, Lookout, Tracker). The Oracle fits the investigative theme and adds N1 burst to a preset that otherwise has no first-night info beyond the Sheriff check. |
| **Oracle** | P4 (The Imposter at the Altar) | Lookout (pos 4) | Lookout's slot → Lookout moves down | P4 already has Mayor + Executioner drama; the Oracle's alignment check gives Town something concrete to work with on Day 2. |
| **Night Watcher** | P1 (Whispers from the Morgue) | Tracker (pos 6) | Tracker's slot → Tracker moves down | P1 is the corpse-focused preset. The Night Watcher's visitor count complements the Undertaker (who inspects corpses) and Medium (who reads the Ghost Ledger). |
| **Night Watcher** | P5 (The Widow's Vigil) | Retributionist (pos 6) | Retributionist's slot → Retributionist moves down | P5 has Witch + Poisoner pressure. The Night Watcher gives Town early intel on who's being targeted, countering the Witch's control information. |
| **Informer** | P1 (Whispers from the Morgue) | Retributionist (pos 7) | Retributionist's slot → Retributionist moves down | P1 is the highest-info preset. The Informer's exact role reveal is the strongest N1-only ability and fits the investigative theme. |
| **Informer** | P3 (The Gunpowder Plot) | Doctor (pos 5) | Doctor's slot → Doctor moves down | P3 is firepower-heavy (Deputy, Veteran, Vigilante). The Informer adds investigative depth and can identify the Serial Killer on Night 1. |

### Priority order rules

- N1-only roles should sit **below** recurring investigative roles (Sheriff, Lookout, Tracker) and **above** Civilians in the priority list.
- At 6 players (4 Town), the N1-only roles are unlikely to be included (Jailor, Doctor, Sheriff fill the 4 slots). This is correct: small games don't need extra N1 info.
- At 10+ players, one or two N1-only roles appear naturally as the Town list expands past the core roles.
- The roles may also appear in the Godfather's bluff pool if not selected for the deck (`state.gfBluffs`), adding bluff diversity to any preset.

### Preset integration example

**Preset 1 (Whispers from the Morgue), 10 players (6 Town, 3 Mafia, 1 Neutral):**

Current Town priority: Jailor, Undertaker, Medium, Doctor, Sheriff, Tracker, Retributionist → Civilians.
Modified: Jailor, Undertaker, Medium, Doctor, Sheriff, **Informer**, **Night Watcher**, Tracker → Civilians.

Deck: Jailor, Undertaker, Medium, Doctor, Sheriff, Informer (6 Town) + Godfather, Mafioso, Janitor (Mafia) + Amnesiac (Neutral).

---

## Implementation checklist

1. Add `n1Only: true` field to `E.NIGHT_STEPS` entries for Oracle, Night Watcher, and Informer in `02-presets.js`.
2. Add the three role definitions to `01-roles.js` with `n1Only: true`.
3. Add the N1-only filter to `getNightSteps` in `05-night-steps.js`.
4. Add resolvers for all three roles in `06-night-actions.js` inside `E._nightActions.investigators`.
5. Add the three step entries to `E.NIGHT_STEPS` at position 11 (Oracle, Night Watcher, Informer).
6. Update presets P1-P6 to include N1-only roles in priority lists where recommended.
7. Update `E.ROLES` count in `interface.md` (30 → 33 roles: 14+3=17 Town, 9 Mafia, 7 Neutral).
8. Update `docs/GDD.md` Section 2.1 with the three new role blocks.
9. Update `docs/GDD.md` Section 5.1 with the three new position-11 steps.
10. Write tests: N1-only steps appear on Night 1, absent on Night 2+; Oracle alignment result; Night Watcher visitor count; Informer exact role; Drunk inversions; roleblock voids; Witch redirect.
