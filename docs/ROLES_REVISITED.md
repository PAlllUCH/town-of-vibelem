# ROLES REVISITED

Authoritative role catalog for Town of VibeLem. Every role's Polish name, English name, category, and ability lives here. The mechanical systems that act on these roles (night resolution order, victory conditions, ghost rules, house rules) live in `docs/GDD.md`.

Roles are listed with their Polish and English names plus the category and ability. The 43 unique roles are split into four alignment buckets: **Town, Mafia, Neutral, Evil**.

---

## Town

| Polish | English | Category | Ability |
|---|---|---|---|
| Cywil | Civilian | Town Support | No ability. Votes and speaks normally. |
| Klawisz | Jailor | Town Killing | Each night, choose a living player to jail. The jailed player is roleblocked for the night, the Jailor reads the jailed player's last will from their card, then the Jailor chooses EXECUTE (thumbs down) or SPARE (thumbs up). Execution is an Unstoppable kill. The Jailor cannot execute on Night 1; jailing and reading the will still work on Night 1. The Jailor cannot jail the same player on two consecutive nights. |
| Wypatrywacz | Lookout | Town Investigative | Each night, choose a living player and learn which players targeted them with a night action that night. If nobody visited them, the Lookout learns "no one". |
| Świadek | Witness | Town Investigative | Each night, choose two living players and learn whether they share an alignment: "Both Town", "Both Mafia", "Both Neutral", or "Different alignments". The comparison uses threat-membership triage: Town team vs Mafia team vs Neutral. The Serial Killer counts as Mafia for this check. Spy, Jester, Executioner, Survivor, The Drunk, Amnesiac, and the Witch count as Neutral regardless of the Witch's declared side. Dead players can still be compared: the check reads their last assigned role. The result inverts if the Witness is Drunk. The Witch may control the Witness: only the first pick is redirected, the second pick stays. |
| Mściciel | Vigilante | Town Killing | Up to three times per game, during the day, secretly choose one living player to shoot; the moderator announces the death publicly without revealing the shooter. If the victim was Town-aligned, the Vigilante dies of guilt at the start of the following night. |
| Weteran | Veteran | Town Killing | Up to three times per game, at the start of a night, declare ALERT. While alert, every player who visits the Veteran with a night action dies (Unstoppable) and their action is void, and the Veteran cannot be killed that night. The alert cannot be roleblocked and is not corrupted by drunkenness. |
| Kucharz | Chef | Town Support | Start-knowing, no night action. You start knowing how many pairs of adjacent evil players there are in the seat circle. The count is relayed privately during the prep phase (Night Zero) and written to the Chef's player log as an info entry at SETUP. The Chef never wakes at night. The count is a snapshot of the deal: it never changes when roles are swapped. Evil includes Mafia-aligned, the Serial Killer, the Demon, the Imp, and a Witch who sides with Mafia. |
| Praczka | Washerwoman | Town Support | Start-knowing, no night action. You start knowing that one of two specified players is a particular Townsfolk role. The app computes a pair and a named (non-Civilian) Town role in the deck that one of them holds, and relays the claim privately during the prep phase (Night Zero); the claim is written to the Washerwoman's player log as an info entry at SETUP. The Washerwoman never wakes at night. If the deck holds no named Town role besides the Washerwoman's own, the app still relays a claim (the Blood on the Clocktower misregistration fallback). The claim always sounds like a plausible townsfolk claim and never names a Mafia or Neutral role. The claim is a snapshot of the deal. |
| Wyrocznia | Oracle | Town Investigative | Each night, choose a living player: learn whether they are TOWN or NOT TOWN (the alignment of their team). The result inverts if the Oracle is Drunk. The Witch may control the pick: the read is redirected to the Witch's chosen target. |
| Grabarz | Undertaker | Town Investigative | Each night, choose one corpse; the moderator privately reveals its true role to you. Cannot inspect a corpse cleaned by the Janitor. |
| Szeryf | Sheriff | Town Investigative | Each night, choose a living player and learn INNOCENT or SUSPICIOUS. Suspicious: Mafia-aligned players except the Godfather (who always reads INNOCENT), the Serial Killer, the Demon, the Imp, and the Possessed (whose role name stays hidden until end-of-game). Everyone else reads INNOCENT. The result inverts if the Sheriff is Drunk. |
| Medium | Medium | Town Support | Alive: each night, during the Medium and Ghosts step, read the Ghost Ledger for 30 seconds. Dead: each night, during the Medium and Ghosts step, whisper with one living player of your choice for 60 seconds. |
| Lekarz | Doctor | Town Protective | Each night, choose a living player (including yourself) to protect. Protection blocks all Basic attacks against them that night. Fails if the Doctor is Drunk or roleblocked. |
| Pokutnik | Retributionist | Town Support | Once per game, at night, choose a dead player to revive. The revived player returns to life at the next morning with their role, abilities, and vote intact, and the revival is announced publicly. Cleaned corpses may be revived. |
| Kurtyzana | Escort | Town Support | Each night, choose a living player to roleblock: their night action fails that night. |
| Tropiciel | Tracker | Town Investigative | Each night, choose a living player and learn which player, if any, they targeted with a night action that night. If they targeted no one, the Tracker learns "no one". |
| Burmistrz | Mayor | Town Support | Once per game, during the day, publicly reveal. From then on, each of the Mayor's votes counts as 3 votes in every trial (while the Mayor is alive; a dead Mayor's ghost-token vote in the verdict stage weighs 1, not 3). |
| Zastępca | Deputy | Town Killing | Once per game, during the day, publicly shoot one living player; they die immediately. If the victim was Town-aligned, the Deputy dies of guilt at the start of the following night. Inheritance: when the Sheriff dies while the Deputy is alive, the Deputy permanently inherits the Sheriff's badge and gains the nightly Sheriff check (in addition to the day shot, if unused). |
| Karczmarz | Innkeeper | Town Protective | Each night, share a drink with a living player. Both of you gain Basic defense for the night; the guest is also roleblocked. Fails entirely if the Innkeeper is Drunk or roleblocked. Targeting a killer (Mafioso, Serial Killer, Imp, Demon) blocks their attack for the night. Does not block Unstoppable attacks. |

---

## Mafia

| Polish | English | Category | Ability |
|---|---|---|---|
| Ojciec Chrzestny | Godfather | Mafia Killing | Leads the Mafia kill and chooses the night's target. Night immune: Basic defense blocks Basic attacks. Reads INNOCENT to the Sheriff. If the Mafioso is dead, performs the kill alone. If roleblocked, the Mafioso performs the kill. The Mafia kill may target any living player other than the kill leader, including fellow Mafia members. At setup, the Godfather is privately given three Town bluff roles, chosen from Town roles that are NOT in the current game deck, and may claim any of them during the game. |
| Cyngiel | Mafioso | Mafia Killing | Carries out the Mafia kill at the Godfather's chosen target. If the Godfather is dead or roleblocked, performs the kill alone. When the Godfather dies, the Mafioso becomes the new Godfather: night immune and reads INNOCENT to the Sheriff. |
| Woźny | Janitor | Mafia Deception | Each night, choose one corpse to clean. A cleaned corpse's true role can never be learned by the Undertaker (and in Classic Reveal Mode its role stays hidden on the morning announcement). Fails if the Janitor is Drunk or roleblocked. |
| Doradca | Consigliere | Mafia Support | Each night, choose a living player and learn their exact role. If Drunk, receives a false role (selected at random from roles of a different alignment). |
| Dama | Consort | Mafia Support | Each night, choose a living player to roleblock: their night action fails that night. |
| Truciciel | Poisoner | Mafia Deception | Each night, choose a living player to poison: the target is Drunk for one cycle. |
| Osiłek | Blackmailer | Mafia Deception | Each night, choose one living player to blackmail. That player cannot speak during the next day: no table talk, no trial defense. They may still vote by hand gesture and may still use gesture-based day abilities. A player cannot be blackmailed on consecutive nights. |
| Pozorant | Framer | Mafia Deception | Each night, choose one living player to frame. A framed player reads SUSPICIOUS to the Sheriff or the inherited Deputy for that night. The frame sets the base result to SUSPICIOUS; a Drunk Sheriff then inverts that result. |
| Fałszerz | Forger | Mafia Deception | Each night, choose one player and forge a false last will for them. If that player dies before the next morning, the moderator reads the forged will from the player's card instead of their true will. |

---

## Neutral

| Polish | English | Category | Ability |
|---|---|---|---|
| Ocalały | Survivor | Neutral Benign | No ability. Wins if alive at game end. |
| Kat | Executioner | Neutral Evil | No ability. At setup, the app assigns a Town-aligned target, revealed privately to the Executioner. Wins when that target is lynched by the town, whether the Executioner is alive or dead. If the target dies by any other means, the Executioner becomes a Jester and their win condition becomes the Jester's win condition (win when lynched). The assigned target must be Town-aligned. |
| Błazen | Jester | Neutral Evil | No ability. Wins immediately when lynched; becomes a taunting ghost that may speak to and mock living players at any time, and receives no ghost vote token. Haunt: at the start of the night following the lynch, the Jester ghost may choose one player who voted Guilty in the lynch trial; that player dies by an Unstoppable attack. The haunt fires only if the game continued to the next night. |
| Szpieg | Spy | Neutral Benign | Each night, choose a living player and learn the team (Town / Mafia / Neutral) of every player who visited them that night; if nobody visited them, you learn "no one". If the Spy is Drunk, the learned teams are random. Wins if alive at game end (shares the win with whoever triggered the end). |
| Trędowaty | Leper | Neutral Benign | No ability. Any player who visits you with a night action becomes Drunk for the following night. Wins if alive at game end. |
| Amnestyk | Amnesiac | Neutral Benign | Once per game, at night, choose a dead player and remember their role: the Amnesiac permanently becomes that role, gaining its abilities, alignment, and win condition. Until then, no ability. If the game ends before remembering, wins if alive at game end. |
| Pijak | The Drunk | Neutral Benign | No ability. Permanently Drunk: all abilities are disabled. Wins if alive at game end. |
| Wyrzutek | Outcast | Neutral Benign | No ability. Reads as Evil to all investigative check abilities: Sheriff = SUSPICIOUS, Oracle = NOT TOWN, Witness = Evil alignment, Consigliere = a random Evil role. Wins if alive at game end. |

---

## Evil

| Polish | English | Category | Ability |
|---|---|---|---|
| Sukkub | Succubus | Evil Support | Each night, choose a living player to enchant. That player cannot vote Guilty against you during any trial the following day. If you are not on trial, the enchantment has no day effect. The Succubus is Evil-aligned for team counts and win conditions. |
| Nekromanta | Necromant | Evil Support | Once per game, at night, choose a dead player and use that player's night ability on a living target of your choice (Town, Neutral, Mafia, or Evil — any dead role works). The Necromant is Evil-aligned for team counts and win conditions. |
| Morderca | Serial Killer | Evil Killing | Each night, choose a living player to kill (Basic attack). Night immune: Basic defense blocks Basic attacks. Reads SUSPICIOUS to the Sheriff. Wins when last standing or holding majority. |
| Demon | Demon | Evil Killing | Each night, choose a living player to kill (Basic attack). Night immune: Basic defense blocks Basic attacks. Reads INNOCENT to the Sheriff. Wins when last standing or holding majority. |
| Imp | Imp | Evil Support | Successor only: no night action while a Demon is alive. When the Demon dies (any cause), the Imp becomes the new Demon: gains Basic defense, reads INNOCENT to the Sheriff, and performs the nightly kill. The Imp is Evil-aligned for team counts and win conditions. If the Demon dies with no Imp in the game, no succession. |
| Opętany | Possessed | Evil Support | Townsfolk disguise: no wake at night, no active ability. Reads as Evil to all checks (Sheriff = SUSPICIOUS, Oracle = NOT TOWN, Witness = Evil alignment), but the role name stays hidden until end-of-game reveal. Counts as Evil for team counts and win conditions. |

---

## Evil vs Neutral (alignment buckets)

The catalog splits the original "Neutral" alignment bucket into two for clarity:

- **Neutral**: benign roles that win only by surviving (Survivor, Spy, Leper, Amnesiac, The Drunk) plus solo-evil neutrals that target the town by their own rules (Jester, Executioner).
- **Evil**: roles that are Evil-aligned for team counts and win conditions, even when they appear solo or beside the Mafia (Serial Killer, Demon, Imp, Succubus, Necromant, Possessed).

Evil roles count toward the Mafia-side alignment total in 1v1 deadlock resolution and toward the SK/Demon win condition ("everyone else dead or last standing"). They are NOT aligned with the Mafia faction and do not share Mafia wins unless explicitly stated.

---

## Notes for the engine

- Role IDs (English, lowercase): see `js/engine/01-roles.js`. Each role also carries `namePl` for the Polish display name.
- The eight new roles: `innkeeper`, `leper`, `outcast`, `succubus`, `necromant`, `demon`, `imp`, `possessed`.
- Team values in the engine: `TOWN`, `MAFIA`, `NEUTRAL`, `EVIL`. The Witch remains `NEUTRAL` (Evil/Neutral Evil) but switches its victory condition by declared side. Evil roles use `team: 'EVIL'`.
- Categories per the engine: `Town Killing`, `Town Investigative`, `Town Protective`, `Town Support`, `Mafia Killing`, `Mafia Deception`, `Mafia Support`, `Neutral Killing`, `Neutral Evil`, `Neutral Benign`, `Evil Killing`, `Evil Support`.
- Localization is driven by `E.locale` (`'en'` or `'pl'`) and the `namePl` field on each role def. UI uses `E.roleName(id, locale)` / `E.roleBlurb(id, locale)` instead of `E.ROLES[id].name` directly.