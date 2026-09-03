'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.ROLES = Object.create(null);
  var roleDefs = {
    jailor: {
      id: 'jailor', name: 'Jailor', namePl: 'Klawisz', team: 'TOWN', category: 'Town Killing',
      blurb: 'Jails a player each night, then EXECUTES (Unstoppable) or SPARES. Cannot jail the same player two nights in a row.',
      blurbPl: 'Każdej nocy więzi jednego gracza, po czym WYKONUJE WYROK (nie do zatrzymania) lub OSZCZĘDZA. Nie może więzić tego samego gracza dwa noce z rzędu.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    undertaker: {
      id: 'undertaker', name: 'Undertaker', namePl: 'Grabarz', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, privately learns the true role of one corpse. Cannot inspect a corpse cleaned by the Janitor, or the same corpse twice.',
      blurbPl: 'Każdej nocy prywatnie poznaje prawdziwą rolę jednego trupa. Nie może badać trupa oczyszczonego przez Woźnego ani tego samego trupa dwa razy.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    medium: {
      id: 'medium', name: 'Medium', namePl: 'Medium', team: 'TOWN', category: 'Town Support',
      blurb: 'Alive: reads the Ghost Ledger each night. Dead: whispers with one living player each night.',
      blurbPl: 'Żywy: co noc czyta Dziennik Duchów. Martwy: co noc szepta z jednym żywym graczem.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    doctor: {
      id: 'doctor', name: 'Doctor', namePl: 'Lekarz', team: 'TOWN', category: 'Town Protective',
      blurb: 'Each night, protects one player from all Basic attacks against them that night. Fails if Drunk or roleblocked.',
      blurbPl: 'Każdej nocy chroni jednego gracza przed wszystkimi podstawowymi atakami tej nocy. Zawodzi, gdy jest Pijany lub zablokowany.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    sheriff: {
      id: 'sheriff', name: 'Sheriff', namePl: 'Szeryf', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, checks one player: SUSPICIOUS for Mafia (except the Godfather), Serial Killer, Demon, Imp, and Possessed. INNOCENT otherwise. Result inverts if Drunk.',
      blurbPl: 'Każdej nocy sprawdza jednego gracza: SUSPICIOUS dla Mafii (oprócz Ojca Chrzestnego), Mordercy, Demona, Impa i Opętanego. INNOCENT w pozostałych przypadkach. Wynik odwraca się, gdy jest Pijany.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    deputy: {
      id: 'deputy', name: 'Deputy', namePl: 'Zastępca', team: 'TOWN', category: 'Town Killing',
      blurb: 'Once per game, publicly shoots a player. Dies of guilt at the following night if the victim was Town. Inherits the Sheriff badge when the Sheriff dies.',
      blurbPl: 'Raz na grę publicznie strzela do gracza. Umiera z wyrzutów sumienia następującej nocy, jeśli ofiara była z Miasta. Po śmierci Szeryfa dziedziczy jego odznakę.',
      nightAction: false, dayAction: true, oncePerGame: true, maxUses: 1
    },
    tracker: {
      id: 'tracker', name: 'Tracker', namePl: 'Tropiciel', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, learns which player, if any, the chosen player targeted with a night action.',
      blurbPl: 'Każdej nocy dowiaduje się, którego gracza — jeśli w ogóle kogoś — wskazał swoją nocną akcją wybrany gracz.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    lookout: {
      id: 'lookout', name: 'Lookout', namePl: 'Wypatrywacz', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, learns which players targeted the chosen player with a night action.',
      blurbPl: 'Każdej nocy dowiaduje się, którzy gracze odwiedzili wybranego gracza nocną akcją.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    witness: {
      id: 'witness', name: 'Witness', namePl: 'Świadek', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, chooses two living players and learns whether they share an alignment. Inverts if Drunk.',
      blurbPl: 'Każdej nocy wybiera dwóch żywych graczy i dowiaduje się, czy należą do tego samego obozu. Wynik odwraca się, gdy jest Pijany.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    oracle: {
      id: 'oracle', name: 'Oracle', namePl: 'Wyrocznia', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, learns whether a player is TOWN or NOT TOWN. Inverts if Drunk.',
      blurbPl: 'Każdej nocy dowiaduje się, czy gracz jest z MIASTA czy SPOZA MIASTA. Wynik odwraca się, gdy jest Pijany.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    washerwoman: {
      id: 'washerwoman', name: 'Washerwoman', namePl: 'Praczka', team: 'TOWN', category: 'Town Support',
      blurb: 'Starts knowing that one of two specified players is a particular Townsfolk role. No night action.',
      blurbPl: 'Od początku wie, że jeden z dwóch wskazanych graczy ma określoną rolę Miasta. Brak akcji nocnej.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null, startKnowing: true
    },
    chef: {
      id: 'chef', name: 'Chef', namePl: 'Kucharz', team: 'TOWN', category: 'Town Support',
      blurb: 'Starts knowing how many pairs of adjacent evil players sit in the seat circle. No night action.',
      blurbPl: 'Od początku wie, ile par sąsiadujących złych graczy siedzi w kręgu miejsc. Brak akcji nocnej.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null, startKnowing: true
    },
    escort: {
      id: 'escort', name: 'Escort', namePl: 'Kurtyzana', team: 'TOWN', category: 'Town Support',
      blurb: 'Each night, roleblocks one player: their night action fails that night.',
      blurbPl: 'Każdej nocy blokuje jednego gracza: jego nocna akcja tej nocy zawodzi.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    retributionist: {
      id: 'retributionist', name: 'Retributionist', namePl: 'Pokutnik', team: 'TOWN', category: 'Town Support',
      blurb: 'Once per game, revives one dead player at the next morning.',
      blurbPl: 'Raz na grę wskrzesza jednego martwego gracza następnego ranka.',
      nightAction: true, dayAction: false, oncePerGame: true, maxUses: 1
    },
    veteran: {
      id: 'veteran', name: 'Veteran', namePl: 'Weteran', team: 'TOWN', category: 'Town Killing',
      blurb: 'Up to three times, declares ALERT at night: visitors die (Unstoppable) and the Veteran cannot be killed.',
      blurbPl: 'Do trzech razy ogłasza ALERT w nocy: odwiedzający giną (nie do zatrzymania), a Weteran nie może zostać zabity.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: 3
    },
    vigilante: {
      id: 'vigilante', name: 'Vigilante', namePl: 'Mściciel', team: 'TOWN', category: 'Town Killing',
      blurb: 'Up to three times during the day, secretly shoots a player. Dies of guilt at the following night if the victim was Town.',
      blurbPl: 'Do trzech razy w ciągu dnia potajemnie strzela do gracza. Umiera z wyrzutów sumienia następującej nocy, jeśli ofiara była z Miasta.',
      nightAction: false, dayAction: true, oncePerGame: false, maxUses: 3
    },
    mayor: {
      id: 'mayor', name: 'Mayor', namePl: 'Burmistrz', team: 'TOWN', category: 'Town Support',
      blurb: 'Once per game, publicly reveals: each of the Mayor\'s votes then counts as 3.',
      blurbPl: 'Raz na grę publicznie ujawnia się: każdy głos Burmistrza liczy wtedy jako 3.',
      nightAction: false, dayAction: true, oncePerGame: true, maxUses: 1
    },
    civilian: {
      id: 'civilian', name: 'Civilian', namePl: 'Cywil', team: 'TOWN', category: 'Town Support',
      blurb: 'No ability. Votes and speaks normally.',
      blurbPl: 'Brak zdolności. Głosuje i wypowiada się normalnie.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    godfather: {
      id: 'godfather', name: 'Godfather', namePl: 'Ojciec Chrzestny', team: 'MAFIA', category: 'Mafia Killing',
      blurb: 'Leads the Mafia kill. Night immune, reads INNOCENT to the Sheriff. Given three Town bluff roles not in the deck at setup.',
      blurbPl: 'Prowadzi mafijskie zabójstwo. Odporny nocą, czyta się Szeryfowi jako INNOCENT. Na starcie dostaje trzy blufowane role Miasta spoza talii.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    mafioso: {
      id: 'mafioso', name: 'Mafioso', namePl: 'Cyngiel', team: 'MAFIA', category: 'Mafia Killing',
      blurb: 'Carries out the Mafia kill. Performs it alone if the Godfather is dead or roleblocked. Becomes the new Godfather when the Godfather dies.',
      blurbPl: 'Wykonuje mafijskie zabójstwo. Działa sam, gdy Ojciec Chrzestny umrze lub zostanie zablokowany. Po śmierci Ojca Chrzestnego sam zostaje nowym Ojcem Chrzestnym.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    janitor: {
      id: 'janitor', name: 'Janitor', namePl: 'Woźny', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, cleans one corpse: its true role can never be learned. Fails if Drunk or roleblocked.',
      blurbPl: 'Każdej nocy czyści jeden trup: jego prawdziwej roli nie da się już nigdy poznać. Zawodzi, gdy jest Pijany lub zablokowany.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    consigliere: {
      id: 'consigliere', name: 'Consigliere', namePl: 'Doradca', team: 'MAFIA', category: 'Mafia Support',
      blurb: 'Each night, learns the exact role of one player. If Drunk, learns a random role of a different alignment.',
      blurbPl: 'Każdej nocy poznaje dokładną rolę jednego gracza. Jeśli jest Pijany, poznaje losową rolę innego obozu.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    consort: {
      id: 'consort', name: 'Consort', namePl: 'Dama', team: 'MAFIA', category: 'Mafia Support',
      blurb: 'Each night, roleblocks one player: their night action fails that night.',
      blurbPl: 'Każdej nocy blokuje jednego gracza: jego nocna akcja tej nocy zawodzi.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    poisoner: {
      id: 'poisoner', name: 'Poisoner', namePl: 'Truciciel', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, poisons one player: they are Drunk for one cycle.',
      blurbPl: 'Każdej nocy truje jednego gracza: przez jeden cykl jest on Pijany.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    blackmailer: {
      id: 'blackmailer', name: 'Blackmailer', namePl: 'Osiłek', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, blackmails one player: they cannot speak during the next day. No consecutive-night blackmail.',
      blurbPl: 'Każdej nocy szantażuje jednego gracza: następnego dnia nie może on mówić. Bez szantażu tego samego gracza dwa noce z rzędu.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    framer: {
      id: 'framer', name: 'Framer', namePl: 'Pozorant', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, frames one player: they read SUSPICIOUS to the Sheriff for that night.',
      blurbPl: 'Każdej nocy kompromituje jednego gracza: tej nocy czyta się Szeryfowi jako SUSPICIOUS.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    forger: {
      id: 'forger', name: 'Forger', namePl: 'Fałszerz', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, forges a false last will for one player. If that player dies before the next morning, the moderator reads the forged will from the player\'s card.',
      blurbPl: 'Każdej nocy fałszuje testament jednego gracza. Jeśli ten gracz zginie przed następnym rankiem, moderator odczyta fałszywy testament z jego karty.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    serialkiller: {
      id: 'serialkiller', name: 'Serial Killer', namePl: 'Morderca', team: 'NEUTRAL', category: 'Neutral Killing',
      blurb: 'Each night, kills one player (Basic attack). Night immune. Reads SUSPICIOUS to the Sheriff. Wins when last standing or holding majority.',
      blurbPl: 'Każdej nocy zabija jednego gracza (atak podstawowy). Odporny nocą. Czyta się Szeryfowi jako SUSPICIOUS. Wygrywa, gdy zostanie ostatni żywy albo uzyska większość.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    survivor: {
      id: 'survivor', name: 'Survivor', namePl: 'Ocalały', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'No ability. Wins if alive at game end.',
      blurbPl: 'Brak zdolności. Wygrywa, jeśli przeżyje do końca gry.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    spy: {
      id: 'spy', name: 'Spy', namePl: 'Szpieg', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'Each night, watches one player: learns the team of every player who visited them. Random teams if Drunk. Wins if alive at game end.',
      blurbPl: 'Każdej nocy obserwuje jednego gracza: poznaje obóz każdego, kto go tej nocy odwiedził. Przy Pijanym obozy są losowe. Wygrywa, jeśli przeżyje do końca gry.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    jester: {
      id: 'jester', name: 'Jester', namePl: 'Błazen', team: 'NEUTRAL', category: 'Neutral Evil',
      blurb: 'No ability. Wins when lynched, becoming a taunting ghost that may haunt one Guilty voter the following night.',
      blurbPl: 'Brak zdolności. Wygrywa, gdy zostanie powieszony, stając się drwiącym duchem, który następnej nocy może nawiedzić jednego głosującego GUILTY.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    witch: {
      id: 'witch', name: 'Witch', namePl: 'Wiedźma', team: 'NEUTRAL', category: 'Neutral Evil',
      blurb: 'Each night, controls one player (except a jailed player) and redirects their action; learns their role. Sides with Mafia by default, Town if declared.',
      blurbPl: 'Każdej nocy kontroluje jednego gracza (poza uwięzionym) i przekierowuje jego akcję; poznaje przy tym jego rolę. Domyślnie sprzymierzona z Mafią lub z Miastem, jeśli to ogłosi.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    drunk: {
      id: 'drunk', name: 'The Drunk', namePl: 'Pijak', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'Permanently Drunk: all abilities disabled. No night or day action. Wins if alive at game end.',
      blurbPl: 'Trwale Pijany: wszystkie zdolności wyłączone. Brak akcji nocnej i dziennej. Wygrywa, jeśli przeżyje do końca gry.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    amnesiac: {
      id: 'amnesiac', name: 'Amnesiac', namePl: 'Amnestyk', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'Once per game, remembers the role of one dead player and permanently becomes it. Wins with that role\'s team.',
      blurbPl: 'Raz na grę pamięta rolę jednego martwego gracza i na stałe się nią staje. Wygrywa razem z obozem tej roli.',
      nightAction: true, dayAction: false, oncePerGame: true, maxUses: 1
    },
    executioner: {
      id: 'executioner', name: 'Executioner', namePl: 'Kat', team: 'NEUTRAL', category: 'Neutral Evil',
      blurb: 'Wins when the assigned Town target is lynched. If the target dies by any other means, becomes a Jester.',
      blurbPl: 'Wygrywa, gdy przydzielony cel z Miasta zostanie powieszony. Jeśli cel zginie w inny sposób, staje się Błaznem.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    innkeeper: {
      id: 'innkeeper', name: 'Innkeeper', namePl: 'Karczmarz', team: 'TOWN', category: 'Town Protective',
      blurb: 'Each night, share a drink with a living player. Both of you gain Basic defense for the night; the guest is also roleblocked. Fails entirely if the Innkeeper is Drunk or roleblocked.',
      blurbPl: 'Każdej nocy częstuje napojem żywego gracza. Oboje zyskujecie podstawową obronę na tę noc, a gość jest dodatkowo blokowany. Zawodzi całkowicie, gdy Karczmarz jest Pijany lub zablokowany.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    leper: {
      id: 'leper', name: 'Leper', namePl: 'Trędowaty', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'No ability. Any player who visits you with a night action becomes Drunk for the following night. Wins if alive at game end.',
      blurbPl: 'Brak zdolności. Każdy gracz, który odwiedzi cię nocną akcją, staje się na następną noc Pijany. Wygrywa, jeśli przeżyje do końca gry.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    outcast: {
      id: 'outcast', name: 'Outcast', namePl: 'Wyrzutek', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'No ability. Reads as Evil to all investigative checks (Sheriff = SUSPICIOUS, Oracle = NOT TOWN, Witness = Evil alignment, Consigliere = a random Evil role). Wins if alive at game end.',
      blurbPl: 'Brak zdolności. Czyta się jako Zły we wszystkich sprawdzieniach (Szeryf = SUSPICIOUS, Wyrocznia = NOT TOWN, Świadek = zły obóz, Doradca = losowa rola Zła). Wygrywa, jeśli przeżyje do końca gry.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    succubus: {
      id: 'succubus', name: 'Succubus', namePl: 'Sukkub', team: 'EVIL', category: 'Evil Support',
      blurb: 'Each night, choose a living player to enchant: that player cannot vote Guilty against you during any trial the following day.',
      blurbPl: 'Każdej nocy rzuca urok na żywego gracza: następnego dnia nie może on głosować GUILTY przeciwko tobie podczas żadnego procesu.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    necromant: {
      id: 'necromant', name: 'Necromant', namePl: 'Nekromanta', team: 'EVIL', category: 'Evil Support',
      blurb: 'Once per game, at night, choose a dead player and use that player\'s night ability on a living target of your choice (any alignment\'s role works).',
      blurbPl: 'Raz na grę, nocą, wybiera martwego gracza i używa jego nocnej zdolności na wybranym przez siebie żywym celu (rola dowolnego obozu działa).',
      nightAction: true, dayAction: false, oncePerGame: true, maxUses: 1
    },
    demon: {
      id: 'demon', name: 'Demon', namePl: 'Demon', team: 'EVIL', category: 'Evil Killing',
      blurb: 'Each night, kills one player (Basic attack). Night immune. Reads INNOCENT to the Sheriff. Wins when last standing or holding majority.',
      blurbPl: 'Każdej nocy zabija jednego gracza (atak podstawowy). Odporny nocą. Czyta się Szeryfowi jako INNOCENT. Wygrywa, gdy zostanie ostatni żywy albo uzyska większość.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    imp: {
      id: 'imp', name: 'Imp', namePl: 'Imp', team: 'EVIL', category: 'Evil Support',
      blurb: 'Successor only: no night action while a Demon is alive. When the Demon dies, the Imp becomes the new Demon and gains Basic defense + INNOCENT reads.',
      blurbPl: 'Tylko następca: brak akcji nocnej, dopóki żyje Demon. Gdy Demon umrze, Imp staje się nowym Demonem i zyskuje podstawową obronę oraz odczyty INNOCENT.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    possessed: {
      id: 'possessed', name: 'Possessed', namePl: 'Opętany', team: 'EVIL', category: 'Evil Support',
      blurb: 'Townsfolk disguise: no wake at night, no ability. Reads as Evil to all checks (Sheriff = SUSPICIOUS, Oracle = NOT TOWN, Witness = Evil); role name stays hidden until end-of-game.',
      blurbPl: 'Przebranie za mieszkańca: brak pobudki w nocy i brak zdolności. Czyta się jako Zły we wszystkich sprawdzeniach (Szeryf = SUSPICIOUS, Wyrocznia = NOT TOWN, Świadek = zły obóz); nazwa roli pozostaje ukryta do końca gry.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    }
  };
  Object.keys(roleDefs).forEach(function (k) { E.ROLES[k] = roleDefs[k]; });

  Object.freeze(E.ROLES);
  Object.keys(E.ROLES).forEach(function (k) { Object.freeze(E.ROLES[k]); });

  var currentLocale = 'pl';
  try {
    if (root.localStorage && (root.localStorage.getItem('tov.locale') === 'pl' || root.localStorage.getItem('tov.locale') === 'en')) {
      currentLocale = root.localStorage.getItem('tov.locale');
    }
  } catch (e) {}

  Object.defineProperty(E, 'locale', {
    enumerable: true,
    get: function () { return currentLocale; }
  });

  E.setLocale = function (loc) {
    currentLocale = (loc ? String(loc) : 'en').toLowerCase();
    try {
      if (root.localStorage) root.localStorage.setItem('tov.locale', currentLocale);
    } catch (e) {}
    return currentLocale;
  };

  E.roleName = function (id, locale) {
    var role = E.ROLES[id];
    if (!role) return id;
    var loc = String(locale || currentLocale).toLowerCase();
    if (role.nameLocales && role.nameLocales[loc] != null) return role.nameLocales[loc];
    return loc === 'pl' ? role.namePl : role.name;
  };

  E.roleBlurb = function (id, locale) {
    var role = E.ROLES[id];
    if (!role) return id;
    var loc = String(locale || currentLocale).toLowerCase();
    if (role.blurbLocales && role.blurbLocales[loc] != null) return role.blurbLocales[loc];
    return loc === 'pl' && role.blurbPl ? role.blurbPl : role.blurb;
  };
})(typeof window !== 'undefined' ? window : globalThis);