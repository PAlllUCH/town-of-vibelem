# Comprehensive System Specification & Role Catalog Revision

Niniejszy dokument stanowi pełną specyfikację techniczną i merytoryczną dla silnika gry oraz aplikacji wspomagającej moderatora. Zawiera zweryfikowaną hierarchię pierwszeństwa akcji nocnych, kompletny katalog ról (w tym nowe role z sekcji TBD) oraz rejestr zasad wyjątkowych i przypadków brzegowych (Edge Cases), które eliminują sprzeczności i luki mechaniczne.

---

## 1. Master Night Resolution Sequence (Tablica Pierwszeństwa)

Wszystkie akcje nocne są rozwiązywane w ścisłej, chronologicznej sekwencji. Akcje z pozycji wcześniejszych aplikują swoje efekty zanim pozycje późniejsze zostaną przetworzone przez silnik gry.

| Pozycja | Rolę Aktywne | Zastosowanie i Wpływ na Statusy |
|---|---|---|
| **0** | **Veteran**, **Jester (Haunt)** | Aktywacja Alertu (Immunity + Unstoppable Counter-Kill); egzekucja nawiedzenia Jestera. |
| **1** | **Poisoner** | Nałożenie statusu `POISONED` / `DRUNK` na 1 pełny cykl. |
| **2** | **Witch** | Kontrola i zmiana celu gracza; odczyt roli kontrolowanego. |
| **3** | **Jailor** | Nałożenie statusów `JAILED` i `ROLEBLOCKED`; opcjonalny Unstoppable Kill (`EXECUTE`). |
| **4** | **Escort**, **Consort**, **Innkeeper** | Nałożenie statusu `ROLEBLOCKED`; Innkeeper nakłada dodatkowo status `PROTECTED`. |
| **5** | **Doctor** | Nałożenie statusu `PROTECTED` (Basic Defense). |
| **6** | **Mafia (Godfather / Mafioso)** | Wyznaczenie i wykonanie zabójstwa Mafii (Basic Attack). |
| **7** | **Janitor**, **Forger** | Czyszczenie ciał (`CLEANED`); podmienienie testamentu (`FORGED`). |
| **8** | **Blackmailer** | Nałożenie statusu `BLACKMAILED` (Zakaz mówienia w Dzień N+1). |
| **9** | **Serial Killer**, **Imp**, **Demon** | Wykonanie indywidualnych ataków zabójców (Basic Attack). |
| **10** | **Framer** | Nałożenie statusu `FRAMED` (Odczyt jako `SUSPICIOUS` na tę noc). |
| **11** | **Śledczy** (*Sheriff, Tracker, Lookout, Witness, Oracle, Consigliere, Undertaker, Spy, Succubus*) | Generowanie i przekazywanie informacji (żetony/gesty). |
| **12** | **Necromant**, **Retributionist**, **Amnesiac** | Interakcje ze zwłokami (Wskrzeszenie / Przejęcie roli / Użycie mocy). |
| **13** | **Medium & Ghosts** | Seans spirytystyczny / Wpis do Ghost Ledger. |
| **14** | **Morning Processing** | Przeliczenie zgonów, rozpatrzenie dziedziczenia odznaki Szeryfa, ogłoszenie poranka. |

---

## 2. Rejestr Zasad Wyjątkowych i Przypadków Brzegowych (Edge Cases)

### A. Weteran na Alercie (Veteran Priority Override)
1. **Nadrzędność Alertu**: Weteran na Alercie (Pozycja 0) natychmiastowo zabija (Unstoppable Attack) każdego, kto go odwiedzi w danej nocy, a akcja odwiedzającego zostaje uznana za niebyłą.
2. **Weteran vs Poisoner / Escort / Witch / Innkeeper**:
   * Gracze odwiedzający Weterana giną na Pozycji 0.
   * Ich zdolności (zatrucie, roleblock, kontrola, ochrona) **nie nakładają się** na Weterana.
3. **Weteran a pijaństwo (Drunk)**: Jeśli Weteran został zatruty wcześniej, jego Alert **nie ulega zepsuciu**. Odwiedzający go i tak giną.

### B. Przekierowania i Kontrola Wiedźmy (Witch Redirect Rules)
1. **Priorytet Przekierowania**: Kontrola Wiedźmy aplikuje się na Pozycji 2. Zmiana celu zachodzi natychmiast i dotyczy akcji wykonywanej na późniejszej pozycji kontrolowanej roli.
2. **Wiedźma vs Jailor**: Wiedźma nie może skontrolować gracza, który został uwięziony przez Jailora (Jailor działa na Pozycji 3, ale status uwięzienia anuluje wstecznie kontrolę Wiedźmy z Pozycji 2).
3. **Wiedźma vs Klawisz**: Kontrolowanie Jailora przekierowuje tylko cel uwięzienia. Decyzja `EXECUTE` lub `SPARE` pozostaje u Jailora.

### C. Zastępca i Dziedziczenie Odznaki (Deputy Inheritance Rules)
1. **Moment dziedziczenia**: Dziedziczenie odznaki Szeryfa następuje podczas porannego ogłoszenia (Morning Processing - Pozycja 14), po śmierci Szeryfa.
2. **Opóźnienie sprawdzenia**: Zastępca (Deputy) **nigdy nie budzi się tej samej nocy**, w której zginął Szeryf. Jego pierwsze badanie śledcze przypada na kolejną noc po porannym komunikacie.

### D. Interakcje Karczmarza (Innkeeper Edge Cases)
1. **Podwójny status**: Wybrany cel otrzymuje jednocześnie status `ROLEBLOCKED` oraz `PROTECTED` (Basic Defense).
2. **Karczmarz vs Ataki**: Chroni cel przed atakami typu Basic. Nie chroni przed atakami Unstoppable (Jailor EXECUTE, Veteran Alert, Jester Haunt).
3. **Karczmarz celujący w zabójcę**: Wybór zabójcy (Mafioso, SK, Imp) blokuje jego atak tej nocy.

### E. Remisy 1v1 i Deadlock Engine (Tie-Breaker Rules)
W sytuacjach 1v1, gdy żaden z graczy nie może zabić drugiego w nocy ani przegłosować go w dzień:
1. **Serial Killer vs Godfather / Mafioso**: Automatyczne zwycięstwo przechodzi na korzyść **Serial Killera**.
2. **Serial Killer vs Town**: Wygrana **Serial Killera**.
3. **Mafia vs Town (1v1)**: Automatyczne zwycięstwo **Mafii**.

### F. Pijaństwo (Drunk Status Exceptions)
1. **Wpływ**: Drunk inwertuje lub fałszuje wyniki ról śledczych (*Sheriff, Oracle, Witness, Consigliere, Spy*) oraz powoduje niepowodzenie akcji *Doctora* i *Janitora*.
2. **Brak wpływu**: *Jailor, Veteran, Escort, Blackmailer, Tracker, Lookout, Undertaker* oraz akcje ataku zabójców działają normalnie pod wpływem statusu Drunk.

### G. Algorytm Generowania Decku (Executioner Target Rule)
1. Cel przypisany do Kata (*Executioner*) **musi obowiązkowo należeć do frakcji Miasta (Town-aligned)**.
2. Kat nigdy nie może otrzymać jako celu Jestera, członka Mafii ani Neutrala.

---

## 3. Kompletny Katalog Ról z Analizą Specyfikacji

### Frakcja: Miasto (Town)

#### 1. Civilian (Cywil)
* **Pozycja**: Brak (rola pasywna).
* **Zdolność**: Brak. Głosuje i rozmawia normalnie.
* **Edge Cases**: Może być celem fałszywej informacji startowej Praczki (*Washerwoman*).

#### 2. Jailor (Klawisz)
* **Pozycja**: Pozycja 3.
* **Zdolność**: Wybiera żyjącego gracza do uwięzienia (`JAILED` + `ROLEBLOCKED`). Czyta testament. Wybiera `EXECUTE` (Unstoppable Attack) lub `SPARE`.
* **Edge Cases**: Nie wykonuje egzekucji Noc 1. Nie może uwięzić tej samej osoby dwie noce z rzędu. Odwiedzenie Weterana na Alercie powoduje śmierć Klawisza na Pozycji 0.

#### 3. Lookout (Wypatrywacz)
* **Pozycja**: Pozycja 11.
* **Zdolność**: Wybiera gracza i dowiaduje się, kto odwiedził ten cel tej nocy.
* **Edge Cases**: Widzi wszystkich odwiedzających. Jeśli cel odwiedzi zabójca, Wypatrywacz go widzi.
* **Uwaga nazewnicza**: Nazwa zmodyfikowana na *Wypatrywacz*, aby odróżnić rolę od *Witness* (Świadek).

#### 4. Vigilante (Mściciel)
* **Pozycja**: Faza Dnia.
* **Zdolność**: Do 3 razy na grę może potajemnie zastrzelić gracza w dzień.
* **Edge Cases**: Zastrzeżenie gracza z Miasta powoduje śmierć Mściciela z poczucia winy na początku kolejnej nocy (`Unstoppable Kill`).

#### 5. Veteran (Weteran)
* **Pozycja**: Pozycja 0 (Pre-Night).
* **Zdolność**: Do 3 razy na grę aktywuje `ALERT`. Zyskuje niewrażliwość na ataki i zabija każdego odwiedzającego atakiem Unstoppable.
* **Edge Cases**: Nadrzędny wobec wszystkich innych akcji. Nie ulega roszadom ani pijaństwu.

#### 6. Chef (Kucharz)
* **Pozycja**: Brak (Start-knowing, Night 0).
* **Zdolność**: Dowiaduje się, ile par sąsiadujących ze sobą graczy w kręgu należy do frakcji Złej (Mafia, SK, Demon, Imp, Wiedźma po stronie Mafii).
* **Edge Cases**: Informacja stanowi niezmienny snapshot z momentu rozdania kart.

#### 7. Washerwoman (Praczka)
* **Pozycja**: Brak (Start-knowing, Night 0).
* **Zdolność**: Dowiaduje się, że jeden z dwóch wskazanych graczy posiada konkretną rolę z frakcji Miasta.
* **Edge Cases**: Niezmienny snapshot z rozdania kart.

#### 8. Oracle (Wyrocznia)
* **Pozycja**: Pozycja 11.
* **Zdolność**: Wybiera gracza i dowiaduje się, czy jest `TOWN` czy `NOT TOWN`.
* **Edge Cases**: Status Drunk inwertuje wynik (`TOWN` <-> `NOT TOWN`).

#### 9. Witness (Świadek)
* **Pozycja**: Pozycja 11.
* **Zdolność**: Wybiera dwóch graczy i dowiaduje się, czy należą do tej samej frakcji (`Both Town`, `Both Mafia`, `Both Neutral`, `Different alignments`).
* **Edge Cases**: SK traktowany jako Mafia w tym sprawdzeniu. Drunk odwraca lub losuje wynik.

#### 10. Undertaker (Grabarz)
* **Pozycja**: Pozycja 11.
* **Zdolność**: Wybiera ciało i poznaje jego prawdziwą rolę.
* **Edge Cases**: Nie może zbadać ciała wyczyszczonego przez Janitora (`CLEANED`). Odporny na Drunk.

#### 11. Sheriff (Szeryf)
* **Pozycja**: Pozycja 11.
* **Zdolność**: Wybiera gracza i dowiaduje się: `INNOCENT` lub `SUSPICIOUS`.
* **Edge Cases**: `SUSPICIOUS` zwracają: Mafia (bez GF), SK, Demon. GF zwraca `INNOCENT`. Status Framed wymusza odczyt `SUSPICIOUS`. Status Drunk inwertuje wynik.

#### 12. Medium
* **Pozycja**: Pozycja 13.
* **Zdolność**: Żywy: czyta Ghost Ledger (30s). Martwy: szepta z jednym żyjącym graczym (60s).
* **Edge Cases**: Roleblock odwołuje seans danej nocy.

#### 13. Doctor (Lekarz)
* **Pozycja**: Pozycja 5.
* **Zdolność**: Chroni cel przed atakami typu Basic na jedną noc (`PROTECTED`).
* **Edge Cases**: Zawodzi, jeśli Doktor jest Drunk lub Roleblocked. Nie chroni przed atakami Unstoppable.

#### 14. Retributionist (Pokutnik)
* **Pozycja**: Pozycja 12.
* **Zdolność**: Raz na grę wskrzesza zmarłego gracza.
* **Edge Cases**: Może wskrzeszać ciała `CLEANED`. Wskrzeszony wraca do gry i traci żeton głosu ducha.

#### 15. Escort (Kurtyzana)
* **Pozycja**: Pozycja 4.
* **Zdolność**: Wybiera gracza i nakłada status `ROLEBLOCKED`.
* **Edge Cases**: Odwiedzenie Weterana na Alercie skutkuje śmiercią Kurtyzany na Pozycji 0.

#### 16. Tracker (Tropiciel)
* **Pozycja**: Pozycja 11.
* **Zdolność**: Wybiera gracza i poznaje kogo ten gracz odwiedził.
* **Edge Cases**: Zwraca "no one", jeśli cel nikogo nie odwiedził lub został zablokowany.

#### 17. Mayor (Burmistrz)
* **Pozycja**: Faza Dnia.
* **Zdolność**: Otwarcie ujawnia się w dzień. Od tego momentu jego głos waży 3 w każdym procesie.
* **Edge Cases**: Po śmierci jego żeton głosu ducha waży 1.

#### 18. Deputy (Zastępca)
* **Pozycja**: Faza Dnia / Pozycja 11 (po dziedziczeniu).
* **Zdolność**: Raz na grę jawnie strzela do gracza w dzień. Po śmierci Szeryfa dziedziczy jego odznakę.
* **Edge Cases**: Jeśli zastrzeli członka Miasta, ginie kolejnej nocy. Pierwsze badanie po przejęciu odznaki wykonuje noc po ogłoszeniu śmierci Szeryfa.

#### 19. Innkeeper (Karczmarz)
* **Pozycja**: Pozycja 4.
* **Zdolność**: Wybiera gracza i nakłada na niego jednocześnie `ROLEBLOCKED` oraz `PROTECTED` (Basic Defense).
* **Edge Cases**: Użycie na zabójcy blokuje jego atak. Znikają wszystkie efekty, jeśli Karczmarz jest Drunk.

---

### Frakcja: Mafia

#### 20. Godfather (Ojciec Chrzestny)
* **Pozycja**: Pozycja 6.
* **Zdolność**: Wyznacza cel ataku Mafii. Posiada Basic Defense i czyta się jako `INNOCENT`.
* **Edge Cases**: Otrzymuje 3 bluff-role na starcie. W przypadku śmierci/roleblocka Mafioso przejmuje wykonanie ataku.

#### 21. Mafioso (Cyngiel)
* **Pozycja**: Pozycja 6.
* **Zdolność**: Wykonuje atak Mafii na cel wyznaczony przez Godfathera.
* **Edge Cases**: Po śmierci Godfathera awansuje na nowego Godfathera (zyskuje Basic Defense i odczyt INNOCENT).

#### 22. Janitor (Woźny)
* **Pozycja**: Pozycja 7.
* **Zdolność**: Czyszczenie ciała zmarłego (`CLEANED`).
* **Edge Cases**: Rola wyczyszczonego ciała nie jest ujawniana rano, a Grabarz nie może go zbadać. Zawodzi przy statusie Drunk.

#### 23. Consigliere (Doradca)
* **Pozycja**: Pozycja 11.
* **Zdolność**: Poznaje dokładną rolę wybranego gracza.
* **Edge Cases**: Status Drunk zwraca fałszywą rolę z innej frakcji.

#### 24. Consort (Dama)
* **Pozycja**: Pozycja 4.
* **Zdolność**: Wybiera gracza i nakłada status `ROLEBLOCKED`.
* **Edge Cases**: Odpowiednik Kurtyzany w Mafii.

#### 25. Poisoner (Truciciel)
* **Pozycja**: Pozycja 1.
* **Zdolność**: Zatra wybranego gracza – nakłada status `POISONED` / `DRUNK` na 1 pełny cykl.
* **Edge Cases**: Działa na samym początku nocy, wyłączając lub inwertując zdolności ról z późniejszych pozycji.

#### 26. Blackmailer (Osiłek)
* **Pozycja**: Pozycja 8.
* **Zdolność**: Wybiera gracza – uciszony cel nie może mówić w Dzień N+1.
* **Edge Cases**: Nie można uciszać tej samej osoby dwie noce z rzędu.

#### 27. Framer (Pozorant)
* **Pozycja**: Pozycja 10.
* **Zdolność**: Wyznaczony cel otrzymuje status `FRAMED` i czyta się jako `SUSPICIOUS` dla Szeryfa tej nocy.

#### 28. Forger (Fałszerz)
* **Pozycja**: Pozycja 7.
* **Zdolność**: Fałszuje testament wskazanego gracza.
* **Edge Cases**: Jeśli cel zginie tej nocy/dnia, odczytywany jest wyłącznie sfałszowany testament.

---

### Frakcja: Neutral / Evil

#### 29. Serial Killer (Morderca)
* **Pozycja**: Pozycja 9.
* **Zdolność**: Wykonuje nocny atak Basic. Posiada Basic Defense i czyta się jako `SUSPICIOUS`.
* **Edge Cases**: Wygrywa automatycznie we wszystkich sytuacjach remisowych 1v1.

#### 30. Survivor (Ocalały)
* **Pozycja**: Brak (rola pasywna).
* **Zdolność**: Brak. Wygrywa, jeśli żyje w momencie zakończenia gry.

#### 31. Spy (Szpieg)
* **Pozycja**: Pozycja 11.
* **Zdolność**: Dowiaduje się, z jakich frakcji byli gracze odwiedzający dany cel.
* **Edge Cases**: Status Drunk zwraca losowe frakcje. Wygrywa, jeśli dożyje do końca gry.

#### 32. Jester (Błazen)
* **Pozycja**: Pozycja 0 (po powieszeniu).
* **Zdolność**: Wygrywa w momencie powieszenia. Kolejnej nocy zabija wybranego gracza głosującego `Guilty` atakiem Unstoppable (`Haunt`).
* **Edge Cases**: Staje się drwiącym duchem, nie otrzymuje żetonu głosu ducha.

#### 33. Witch (Wiedźma)
* **Pozycja**: Pozycja 2.
* **Zdolność**: Przekierowuje akcję wybranego gracza na drugi cel i dowiaduje się jego roli.
* **Edge Cases**: Nie może skontrolować uwięzionego gracza. Deklaruje wybraną frakcję (domyślnie Mafia).

#### 34. The Drunk (Pijak)
* **Pozycja**: Brak.
* **Zdolność**: Brak. Permanetnie zablokowane zdolności. Wygrywa, jeśli żyje na koniec gry.

#### 35. Amnesiac (Amnestyk)
* **Pozycja**: Pozycja 12.
* **Zdolność**: Wybiera ciało i na stałe przejmuje jego rolę, frakcję oraz cel wygranej.

#### 36. Executioner (Kat)
* **Pozycja**: Brak (Setup).
* **Zdolność**: Przypisany cel z Miasta musi zostać powieszony. Jeśli cel zginie inaczej, Kat staje się Błaznem.

---

### Nowe Role (Sformatowany Moduł TBD)

```markdown
## Town (Nowe)

| Polish | English | Category | Ability |
|---|---|---|---|
| Karczmarz | Innkeeper | Town Protective | Each night, choose a living player: they gain Basic defense for the night, but their night action is roleblocked. |

---

## Neutral (Nowe)

| Polish | English | Category | Ability |
|---|---|---|---|
| Trędowaty | Leper | Neutral Benign | No ability. Any player who visits you with a night action becomes Drunk for the following night. Wins if alive at game end. |
| Wyrzutek | Outcast | Neutral Benign | No ability. Reads as Evil / NOT TOWN to all investigative check abilities. Wins if alive at game end. |

---

## Evil (Nowe)

| Polish | English | Category | Ability |
|---|---|---|---|
| Sukkub | Succubus | Evil Support | Each night, choose a living player to enchant: that player cannot vote Guilty against you during any trial the following day. |
| Nekromanta | Necromant | Evil Support | Once per game, at night, choose a dead non-Town player and use their night ability on a living target of your choice. |
| Imp | Imp | Evil Killing | Each night, choose a living player to kill (Basic attack). If you die during the day, a living Minion/Evil teammate becomes the new Imp and gains the nightly kill. |
| Demon | Demon | Evil Killing | Each night, choose a living player to kill (Basic attack). Night immune: Basic defense blocks Basic attacks. Reads INNOCENT to the Sheriff. |
| Opętany | Possessed | Evil Support | Townsfolk disguise: you do not wake at night and have no active ability, but you count as Evil-aligned for team checks and win conditions. |