'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.STRINGS = {
    phaseDay: { pl: 'Dzień', en: 'Day' },
    phaseNight: { pl: 'Noc', en: 'Night' },
    phaseMorning: { pl: 'Ranek', en: 'Morning' },
    phasePrep: { pl: 'Przygotowanie', en: 'Prep' },
    phaseOver: { pl: 'Koniec', en: 'Over' },
    teamTown: { pl: 'Miasto', en: 'Town' },
    teamMafia: { pl: 'Mafia', en: 'Mafia' },
    teamNeutral: { pl: 'Neutralni', en: 'Neutral' },
    teamEvil: { pl: 'Zło', en: 'Evil' },
    noClaim: { pl: 'Brak deklaracji', en: 'No claim' },
    beginDay: { pl: 'Rozpocznij dzień', en: 'Begin Day' },
    endDay: { pl: 'Zakończ dzień', en: 'End Day' },
    resolveNight: { pl: 'Rozstrzygnij noc', en: 'Resolve Night' },
    prev: { pl: 'Wstecz', en: 'Prev' },
    next: { pl: 'Dalej', en: 'Next' },
    done: { pl: 'Gotowe', en: 'Done' },
    notesLabel: { pl: 'Notatki', en: 'Notes' },
    saveNote: { pl: 'Zapisz notatkę', en: 'Save note' },
    noNotes: { pl: 'Brak notatek.', en: 'No notes yet.' },
    stepOf: { pl: 'Krok {0} z {1}', en: 'Step {0} of {1}' },
    nightStepOf: { pl: 'Krok nocy {0} z {1}', en: 'Night Step {0} of {1}' },
    nightOrderTitle: { pl: 'Kolejność nocy', en: 'Night Order' },
    morningRecapTitle: { pl: 'Podsumowanie nocy', en: 'Morning Recap' },
    morningAnnouncementTitle: { pl: 'Ogłoszenie poranka', en: 'Morning Announcement' },
    noDeathsLastNight: { pl: 'W nocy nikt nie zginął.', en: 'No deaths last night.' },
    revivedLabel: { pl: 'Ożywieni', en: 'Revived' },
    forgedWillLine: { pl: 'Sfałszowano testament gracza {0}.', en: 'A will was forged for {0}.' },
    readThenBeginDay: {
      pl: 'Przeczytaj powyższe ogłoszenia przy stole, a następnie wybierz <strong>Rozpocznij dzień</strong>.',
      en: 'Read the announcements above to the table, then tap <strong>Begin Day</strong>.'
    },
    timerTitle: { pl: 'Czasomierz dyskusji', en: 'Discussion Timer' },
    stopTimer: { pl: 'Stop', en: 'Stop' },
    dayAbilitiesTitle: { pl: 'Dzienne umiejętności', en: 'Day Abilities' },
    noDayAbilities: { pl: 'Brak dostępnych dziennych umiejętności.', en: 'No day abilities available.' },
    vigilanteShot: { pl: 'Strzał Wigilanta (zostało {0})', en: 'Vigilante Shot ({0} left)' },
    deputyShoot: { pl: 'Strzał Zastępcy (raz na grę)', en: 'Deputy Shoot (once)' },
    mayorReveal: { pl: 'Ujawnienie Burmistrza', en: 'Mayor Reveal' },
    trialTitle: { pl: 'Sąd', en: 'Trial' },
    startTrial: { pl: 'Rozpocznij sąd', en: 'Start Trial' },
    nominationStage: { pl: 'Nominacja', en: 'Nomination' },
    verdictStage: { pl: 'Werdykt', en: 'Verdict' },
    sentenceStage: { pl: 'Wyrok', en: 'Sentence' },
    nominateVerb: { pl: 'Nominuj', en: 'Nominate' },
    secondChip: { pl: 'POPARCIE', en: 'SECONDS' },
    agreeVerb: { pl: 'Za', en: 'Agree' },
    disagreeVerb: { pl: 'Przeciw', en: 'Disagree' },
    guiltyVerb: { pl: 'Winny', en: 'Guilty' },
    innocentVerb: { pl: 'Niewinny', en: 'Innocent' },
    spareVerb: { pl: 'Ocalić', en: 'Spare' },
    abstainVerb: { pl: 'Wstrzymuję się', en: 'Abstain' },
    executeVerb: { pl: 'STRACIĆ', en: 'EXECUTE' },
    accusedLabel: { pl: 'Oskarżony', en: 'Accused' },
    nominatedByLabel: { pl: 'Nominował', en: 'Nominated by' },
    whoNominates: { pl: 'Kto nominuje?', en: 'Who nominates?' },
    whoIsAccused: { pl: 'Kto jest oskarżony?', en: 'Who is accused?' },
    resolveNomination: { pl: 'Rozstrzygnij nominację', en: 'Resolve Nomination' },
    resolveSentence: { pl: 'Rozstrzygnij wyrok', en: 'Resolve Sentence' },
    switchToApp: { pl: 'Przełącz na aplikację', en: 'Switch to App' },
    switchToHelper: { pl: 'Przełącz na helpera', en: 'Switch to Helper' },
    tokensLabel: { pl: 'Żetony', en: 'Tokens' },
    claimsLabel: { pl: 'Deklaracje', en: 'Claims' },
    seatsLabel: { pl: 'Miejsca', en: 'Seats' },
    seatsNamingTitle: { pl: 'Nazwij miejsca', en: 'Name the Seats' },
    seatsLeftHint: { pl: 'Pozostało miejsc do przypisania: {0}', en: '{0} seat(s) left to assign' },
    autoFillRest: { pl: 'Uzupełnij resztę', en: 'Auto-fill rest' },
    lockRoles: { pl: 'Zatwierdź role', en: 'Lock Roles' },
    editNames: { pl: 'Edytuj nazwy', en: 'Edit Names' },
    redealLabel: { pl: 'Rozlosuj ponownie', en: 'Redeal' },
    namingHint: {
      pl: 'Rozdaj po jednej roli na gracza na osobności. Aplikacja jest tylko dla moderatora: nie pokazuj ekranu.',
      en: 'Deal one role per player in private. The app is moderator-only: keep the screen to yourself.'
    },
    seatPlaceholder: { pl: 'Gracz {0}', en: 'Player {0}' },
    editSeatAria: { pl: 'Edytuj miejsce {0}', en: 'Edit seat {0}' },
    logLabel: { pl: 'Dziennik', en: 'Log' },
    modLabel: { pl: 'Mod', en: 'Mod' },
    modPanelTitle: { pl: 'Moderator', en: 'Moderator' },
    rolesLabel: { pl: 'Role', en: 'Roles' },
    seatGridTitle: { pl: 'Krzesła', en: 'Seat Grid' },
    closeLabel: { pl: 'Zamknij', en: 'Close' },
    menuLabel: { pl: 'Menu', en: 'Menu' },
    languageLabel: { pl: 'Język', en: 'Language' },
    cancelLabel: { pl: 'Anuluj', en: 'Cancel' },
    sessionOver: { pl: 'Gra zakończona.', en: 'Session over.' },
    eventLogTitle: { pl: 'Dziennik zdarzeń ({0})', en: 'Event Log ({0})' },
    noEventsYet: { pl: 'Brak zdarzeń.', en: 'No events yet.' },
    nightTitle: { pl: 'Noc', en: 'Night' },
    pickTarget: { pl: 'Wskaż swój cel', en: 'Point to your target' },
    pickCorpse: { pl: 'Wskaż zwłoki', en: 'Point to a corpse' },
    skipLabel: { pl: 'Pomiń', en: 'Skip' },
    backLabel: { pl: 'Wróć', en: 'Back' },
    nextStep: { pl: 'Następny krok', en: 'Next Step' },
    skipToNextStep: { pl: 'Pomiń do następnego kroku', en: 'Skip to next step' },
    previousStep: { pl: 'Poprzedni krok', en: 'Previous step' },
    continueLabel: { pl: 'Kontynuuj', en: 'Continue' },
    whoActs: { pl: 'Kto działa?', en: 'Who acts?' },
    actingPrefix: { pl: 'Działa: {0}', en: 'Acting: {0}' },
    allActorsRecorded: {
      pl: 'Wszystkie akcje zapisane. Przejdź do następnego kroku.',
      en: 'All actors recorded. Continue to the next step.'
    },
    noActionsRecordedYet: {
      pl: 'Ta noc nie ma jeszcze zapisanych akcji.',
      en: 'No actions recorded for this night yet.'
    },
    summaryTitle: { pl: 'Podsumowanie akcji nocy', en: 'Night Actions Summary' },
    wizardJump: { pl: 'Wróć do kroku: {0}', en: 'Jump back to step: {0}' },
    noNightStepsTitle: { pl: 'Brak kroków nocy', en: 'No night steps' },
    tapResolveNight: {
      pl: 'Wybierz Rozstrzygnij noc, aby kontynuować.',
      en: 'Tap Resolve Night to continue.'
    },
    recordingComplete: {
      pl: 'Zapis nocy gotowy &mdash; wybierz poniżej <strong>Rozstrzygnij noc</strong>, aby go rozstrzygnąć.',
      en: 'Night recording complete &mdash; tap <strong>Resolve Night</strong> below to process it.'
    },
    wizardActionToast: { pl: 'Zapisano: {0}', en: 'Recorded: {0}' },
    morningBrokenNote: {
      pl: 'Świta. Zapis nocy jest kompletny: wybierz poniżej <strong>Rozstrzygnij noc</strong>, aby go rozstrzygnąć.',
      en: 'Morning has broken. Night recording is complete: tap <strong>Resolve Night</strong> below to process it.'
    },
    alertYes: { pl: 'Tak, czujność', en: 'Yes, Alert' },
    alertNo: { pl: 'Bez czujności', en: 'No Alert' },
    killPlayerLabel: { pl: 'Zabij gracza', en: 'Kill Player' },
    undoLastKill: { pl: 'Cofnij ostatnią śmierć', en: 'Undo Last Kill' },
    setupLabel: { pl: 'Ustawienia', en: 'Setup' },
    infoTokensTitle: { pl: 'Żetony informacji', en: 'Info Tokens' },
    infoToShowTitle: { pl: 'Informacje do pokazania', en: 'Info to Show' },
    tokenShownBtn: { pl: 'Żeton pokazany', en: 'Token shown' },
    noInfoYet: { pl: 'Jeszcze brak nocnych informacji.', en: 'No night info yet.' },
    playersTitle: { pl: 'Gracze', en: 'Players' },
    statusesTitle: { pl: 'Statusy', en: 'Statuses' },
    unassignedLabel: { pl: 'Bez roli', en: 'Unassigned' },
    noLivingActor: { pl: 'Brak żywego aktora dla tego kroku.', en: 'No living actor for this step.' },
    reminderNone: { pl: 'Brak celu, po prostu zamknij noc.', en: 'No target, just close the night.' },
    reminderThumbs: { pl: 'Odpowiedź sygnałem kciuka, bez celu.', en: 'Answer with a thumbs signal, no target.' },
    reminderCorpse: { pl: 'Cel: wskaż zwłoki.', en: 'Target: point to a corpse.' },
    reminderLiving: { pl: 'Cel: wskaż żywego gracza.', en: 'Target: point to a living player.' },
    drawReason: {
      pl: 'Gra zakończyła się remisem po {0} kolejnych cyklach bez linczów i bez śmierci nocnych.',
      en: 'The game ends in a draw after {0} consecutive cycles with no lynch and no night deaths.'
    },
    survivingLabel: { pl: 'Żywi', en: 'Surviving' },
    recapTitle: { pl: 'Podsumowanie sesji', en: 'Session Recap' },
    roleRevealTitle: { pl: 'Ujawnienie ról', en: 'Role Reveal' },
    newSessionLabel: { pl: 'Nowa sesja', en: 'New Session' },
    revealNote: {
      pl: 'Tajemnicze zgony i czyszczenie Grabarza są unieważnione: prawdziwe role są pokazane wszystkim.',
      en: 'Mystery deaths and Janitor cleaning are void: true roles are shown for everyone.'
    },
    ghostTokensLabel: { pl: 'Żetony duchów', en: 'Ghost tokens' },
    ghostTokensNote: {
      pl: 'Głos ducha zużywa żeton; ujawniony Burmistrz liczy się jako 3.',
      en: 'Ghost votes spend the token; a revealed Mayor counts as 3.'
    },
    secondsHint: {
      pl: 'Każdy żywy gracz, w tym nominujący, musi poprzeć nominację. Potrzebne są {0} głosy za, aby przejść dalej.',
      en: 'Every living player, including the nominator, must second. The nomination needs {0} agreeing votes to proceed.'
    },
    sentenceHint: {
      pl: 'Oskarżony może wygłosić ostatnie przemówienie przed głosowaniem o ułaskawieniu. Głosy Niewinny go ratują; wymagana jest ściśle większość żywych graczy (oskarżony nie głosuje).',
      en: 'The accused may give a last speech before the spare vote. Innocent votes spare them; a strict majority of living players is required (the accused does not vote).'
    },
    nominationAccepted: {
      pl: 'Nominacja przyjęta &mdash; rozpoczyna się głosowanie.',
      en: 'Nomination accepted &mdash; voting begins.'
    },
    nominationSeconded: {
      pl: 'Nominacja poparta ({0} z {1}) - sąd przechodzi do głosowania.',
      en: 'Nomination seconded ({0} of {1}) - the trial proceeds to a vote.'
    },
    resultNotEnoughSupport: {
      pl: '<strong>Za mało poparcia</strong> &mdash; nominacja upadła.',
      en: '<strong>Not enough support</strong> &mdash; nomination fell.'
    },
    resultSpared: {
      pl: '<strong>Ocalony:</strong> oskarżony został uratowany głosami za ułaskawieniem.',
      en: '<strong>Spared:</strong> the accused was saved by the spare vote.'
    },
    resultGuiltyMajority: {
      pl: '<strong>Większość winnych</strong> &mdash; przejdź do głosowania o ułaskawieniu.',
      en: '<strong>Guilty majority</strong> &mdash; proceed to the spare vote.'
    },
    resultNoLynchDay1: {
      pl: '<strong>Brak linczu w dniu 1</strong> (zasada domowa).',
      en: '<strong>No lynch on Day 1</strong> (house rule).'
    },
    resultAccusedDead: {
      pl: '<strong>Brak linczu:</strong> oskarżony nie żyje.',
      en: '<strong>No lynch:</strong> the accused is dead.'
    },
    resultNotGuilty: {
      pl: '<strong>Niewinny</strong> &mdash; więcej głosów Niewinny, oskarżony przeżywa.',
      en: '<strong>Not guilty</strong> &mdash; more Innocent votes, the accused survives.'
    },
    resultTie: {
      pl: '<strong>Głosowanie remisowe</strong> &mdash; oskarżony przeżywa.',
      en: '<strong>Tie vote</strong> &mdash; the accused survives.'
    },
    resultLynched: { pl: '<strong>Lincz:</strong> {0}', en: '<strong>Lynched:</strong> {0}' },
    resultAcquitted: {
      pl: '<strong>Uniewinniono:</strong> nikt nie został stracony',
      en: '<strong>Acquitted:</strong> no one was lynched'
    },
    jesterWinLine: { pl: '<strong>Jester wygrywa!</strong>', en: '<strong>The Jester wins!</strong>' },
    executionerWinLine: { pl: '<strong>Kat wygrywa!</strong>', en: '<strong>The Executioner wins!</strong>' },
    witchControlPrompt: { pl: 'Wskaż gracza, którego kontrolujesz', en: 'Point to the player you control' },
    witchRedirectPrompt: { pl: 'Wskaż nowy cel przekierowania', en: 'Point to the redirect target' },
    controlledSuffix: { pl: 'kontrolowany', en: 'controlled' },
    jailedPrefix: { pl: 'Uwięziony: {0}. Stracić czy ocalić?', en: 'Jailed: {0}. Execute or spare?' },
    night1NoExecution: { pl: 'Noc 1: egzekucja niedozwolona.', en: 'Night 1: no execution allowed.' },
    forgeTargetPrompt: {
      pl: 'Wskaż gracza, którego testament fałszujesz',
      en: 'Point to the player whose will you forge'
    },
    forgingForPrefix: { pl: 'Fałszowanie testamentu: {0}', en: 'Forging a will for: {0}' },
    willForgePrefix: { pl: 'Sfałszowany testament:', en: 'Will forge:' },
    forgeNote: {
      pl: 'Sfałszowany testament odczytuje się z karty gracza.',
      en: 'The forged will is read from the player\'s card.'
    },
    forgeVerb: { pl: 'FAŁSZUJ', en: 'FORGE' },
    witnessFirstPrompt: {
      pl: 'Wskaż pierwszego porównywanego gracza',
      en: 'Point to the first player you compare'
    },
    witnessSecondPrompt: {
      pl: 'Wskaż drugiego porównywanego gracza',
      en: 'Point to the second player you compare'
    },
    firstPickSuffix: { pl: 'pierwszy wybór', en: 'first pick' },
    confirmCompare: { pl: 'Potwierdź porównanie', en: 'Confirm compare' },
    inspectPrompt: { pl: 'Wskaż gracza, którego badasz', en: 'Point to the player you inspect' },
    mediumLedgerBtn: {
      pl: 'Medium czyta Księgę Duchów (bez celu)',
      en: 'Medium read the Ghost Ledger (no target)'
    },
    deadMediumPrompt: {
      pl: 'Martwe Medium: wybierz żywego gracza do szeptów',
      en: 'Dead Medium: pick a living player to whisper with'
    },
    jesterHauntTitle: { pl: 'Nawrót Jesterhaunt', en: 'Jester Haunt' },
    jesterHauntNotice: {
      pl: '<strong>Nawrót Jesterhaunt:</strong> duch Jester może nawiedzić jednego winnego głosującego.',
      en: '<strong>Jester Haunt:</strong> The Jester ghost may haunt one Guilty voter.'
    },
    noLivingGuiltyVoters: {
      pl: 'Brak żywych głosujących Winny z sądu.',
      en: 'No living Guilty voters from the lynch trial.'
    },
    hauntOnlyNote: {
      pl: 'Nawrót może celować tylko w kogoś, kto głosował Winny.',
      en: 'The haunt may only target someone who voted Guilty.'
    },
    hauntPickPrompt: {
      pl: 'Wybierz gracza, który głosował Winny w sądzie',
      en: 'Pick one player who voted Guilty in the lynch trial'
    },
    scenarioCardTitle: { pl: 'Scenariusz', en: 'Scenario' },
    houseRulesTitle: { pl: 'Zasady domowe', en: 'House Rules' },
    seatLayoutTitle: { pl: 'Rozstaw miejsc', en: 'Seat Layout' },
    deckBuilderTitle: { pl: 'Kreator talii', en: 'Deck Builder' },
    startSession: { pl: 'Rozpocznij sesję', en: 'Start Session' },
    playersWord: { pl: 'graczy', en: 'players' },
    teamStructureHead: { pl: 'Struktura drużyn (suma musi wynosić {0})', en: 'Team structure (must total {0})' },
    totalPlayersLine: { pl: 'Suma: <strong>{0}</strong> / {1} graczy', en: 'Total: <strong>{0}</strong> / {1} players' },
    ruleNoKillN1T: { pl: 'Brak zabójstwa w pierwszą noc', en: 'No Kill on Night One' },
    ruleNoKillN1D: {
      pl: 'Zabójstwa nocne są nieważne w pierwszą noc.',
      en: 'Night kills are void on the first night.'
    },
    ruleNoLynchD1T: { pl: 'Brak linczu w pierwszym dniu', en: 'No Lynch on Day One' },
    ruleNoLynchD1D: {
      pl: 'Żaden sąd nie może zakończyć się linczem pierwszego dnia.',
      en: 'No trial may end in a lynch on day one.'
    },
    ruleClassicRevealT: { pl: 'Tryb klasycznego ujawnienia', en: 'Classic Reveal Mode' },
    ruleClassicRevealD: {
      pl: 'Poranne zgony pokazują prawdziwe role.',
      en: 'Morning deaths show true roles.'
    },
    ruleJailorNoExecN1T: { pl: 'Brak egzekucji Klawisza w pierwszą noc', en: 'No Jailor Execution on Night One' },
    ruleJailorNoExecN1D: {
      pl: 'Klawisz może więzić i czytać testament pierwszej nocy, ale nie może wykonać wyroku.',
      en: 'The Jailor may jail and read the will on night one but cannot execute.'
    },
    priorityLabel: { pl: 'priorytet', en: 'priority' },
    topDrawnHint: { pl: '(góra = losowany pierwszy)', en: '(top = drawn first)' },
    emptyTownList: {
      pl: 'Pusta lista. Sloty wypełnią Cywile.',
      en: 'Empty list. Slots fill with Civilians.'
    },
    emptyPaddedList: {
      pl: 'Pusta lista. Sloty uzupełni preset i pula ról.',
      en: 'Empty list. Slots pad from the preset and role pool.'
    },
    civiliansLabel: { pl: 'Cywile:', en: 'Civilians:' },
    autoLabel: { pl: 'automatycznie', en: 'auto' },
    resetToAuto: { pl: 'Wróć na automat', en: 'Reset to auto' },
    addVerb: { pl: 'Dodaj', en: 'Add' },
    deckPreviewLabel: { pl: 'Podgląd talii', en: 'Deck preview' },
    noneLabel: { pl: 'brak', en: 'none' },
    deckBuilderHint: {
      pl: 'Edytuj listy priorytetów drużyn, potem sprawdź podgląd talii.',
      en: 'Edit each team priority list, then check the live deck preview.'
    },
    teamTotalsNotice: {
      pl: 'Suma drużyn ({0}) musi równać się liczbie graczy: {1}.',
      en: 'Team totals ({0}) must equal {1} players.'
    },
    outstandingTitle: { pl: 'Zaległe akcje nocy', en: 'Outstanding Night Actions' },
    outstandingBtn: { pl: 'Zaległe', en: 'Outstanding' },
    statusPending: { pl: 'OCZEKUJE', en: 'PENDING' },
    statusDone: { pl: 'ZAPISANE', en: 'DONE' },
    statusSkipped: { pl: 'POMINIĘTE', en: 'SKIPPED' }
  };

  E.localized = function (value, locale) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      var loc = String(locale || E.locale || 'en').toLowerCase();
      if (value[loc] != null) return value[loc];
      if (value.en != null) return value.en;
      var keys = Object.keys(value);
      return keys.length ? value[keys[0]] : '';
    }
    return String(value);
  };

  E.str = function (key, locale) {
    var entry = E.STRINGS[key];
    if (!entry) return key;
    var loc = String(locale || E.locale || 'en').toLowerCase();
    var text = entry[loc] || entry.en;
    if (!text) text = entry.en;
    var args = arguments;
    return String(text).replace(/\{(\d+)\}/g, function (m, d) {
      var i = Number(d) + 2;
      return i < args.length ? String(args[i]) : m;
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
