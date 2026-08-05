# Spec: Granice modułów — Faza 1, fala 3 (domknięcie zadania 5)

- **ID:** 048-granice-modulow-fala-3
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-05
- **Moduł(y):** Wiadomości, Pogoda, Usługi, Kuchnia, Zwierzęta, Portfel, Zakupy, Zadania, Kalendarz, Strona główna (+ deklaracja nawigacji bocznej, słowniki, dług testowy)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Dwie fale przeniosły 11 z 21 modułów i **dowiodły wzorca**. Zostało dziesięć — i to nie są resztki,
tylko **najbardziej sprzężone jądro aplikacji**: Zadania (woła je już przeniesiony moduł Nawyki),
Zakupy (współdzielą słowniki z Kuchnią), Portfel (rozlicza Usługi), Kalendarz i pulpit (czytają
prawie wszystko). Dopóki one leżą poza granicami, cel przebudowy jest **nieosiągnięty tam, gdzie
najbardziej boli**: dokładnie te moduły najczęściej się zmieniają i najczęściej psują sobie nawzajem.

Trzy rzeczy dodatkowo dojrzały do zrobienia **teraz, a nie później**:
- **Nawigacja boczna.** Powłoka importuje dziś sześć komponentów `*SideNav` wprost z wnętrz modułów.
  Po tej fali wszystkie sześć będzie wnętrzami modułów — recenzja 047 nazwała to warunkiem, nie
  życzeniem: bez pola w deklaracji świadome wyłączenie urośnie z dwóch importów do sześciu.
- **Słowniki współdzielone.** Przy tagach dało się to nazwać i odłożyć. Przy Zakupach i Kuchni
  problem wraca **z trzema kolejnymi słownikami naraz** i musi dostać jedno rozstrzygnięcie.
- **Osiem zastanych porażek klikaczy.** Mają imiona i potwierdzoną „zastałość", nie mają diagnozy.
  Póki świecą na czerwono, pełny zestaw wymaga przypisu — a sygnał z przypisem to sygnał, którego
  z czasem nikt nie czyta.

## 2. Cel i miary sukcesu

- **Cel:** domknąć zadanie 5 checklisty — **wszystkie moduły za granicą**, lista przejściowa pusta,
  a to, co dotąd było świadomym wyłączeniem, albo rozwiązane, albo nazwane z powodem i terminem.
- **Sukces mierzymy:**
  - moduły w `src/modules/`: **11 → 21**, lista przejściowa **10 → 0** (albo jawnie mniej,
    z powodem dla każdego pozostawionego);
  - powłoka **nie importuje żadnego wnętrza modułu** — nawigacja boczna przychodzi z deklaracji;
  - **zero** zmian widocznych dla użytkownika: klikacz ścieżki szczęśliwej nadal 21/21;
  - liczba czerwonych w pełnym zestawie klikaczy **spada**, a każda pozostała ma **diagnozę**,
    nie tylko nazwę.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby dodanie modułu wymagało jednego katalogu — bez wyjątków
  „poza Zadaniami i Zakupami, bo tam jeszcze po staremu".
- Jako **osoba rozwijająca Omnię** chcę, żeby powłoka nie musiała wiedzieć, jak nazywa się komponent
  nawigacji w każdym module — inaczej każdy nowy moduł to znów edycja pliku powłoki.
- Jako **osoba czytająca czerwony wynik klikaczy** chcę wiedzieć, czy to regresja, czy znany dług —
  bez zaglądania do dokumentu z listą wyjątków.
- Jako **użytkownik aplikacji** nie chcę zauważyć niczego: te same ekrany, adresy i uprawnienia.

## 4. Kryteria akceptacji (testowalne)

**Domknięcie przenoszenia**

- [ ] **AC-1** — Given dowolny moduł z rejestru, when sprawdzam, gdzie mieszka jego kod, then jest
      w katalogu tego modułu — albo jest na **jawnej** liście pozostawionych, z powodem.
- [ ] **AC-2** — Given konsument spoza modułu sięgający po dane, when korzysta z modułu, then robi
      to **wyłącznie przez jego kontrakt**.
- [ ] **AC-3** — Given przeniesiony moduł, when szukam jego wpisu na liście przejściowej i w słowniku
      uprawnień, then **nie ma go tam** — tożsamość wynika z deklaracji.
- [ ] **AC-4** — Given moduł zależny od innego modułu (Nawyki→Zadania, Usługi→Portfel,
      Kuchnia→Zakupy), when sprawdzam ten import, then idzie przez kontrakt, a **rozmiar kontraktu
      pokazuje koszt tego sprzężenia** zamiast go ukrywać.

**Powłoka bez wiedzy o wnętrzach**

- [ ] **AC-5** — Given moduł z własną nawigacją boczną, when powłoka ją renderuje, then bierze ją
      **z deklaracji modułu**, a nie z importu jego wnętrza.
- [ ] **AC-6** — Given powłoka aplikacji, when sprawdzam jej importy, then **żaden** nie sięga do
      wnętrza modułu.

**Słowniki współdzielone**

- [ ] **AC-7** — Given słownik używany przez więcej niż jeden moduł (kategorie, jednostki, produkty,
      tagi), when sprawdzam jego miejsce, then decyzja jest **jedna, zapisana i uzasadniona** —
      nie „każdy słownik inaczej".

**Dług testowy**

- [ ] **AC-8** — Given osiem zastanych porażek klikaczy, when kończę falę, then **każda ma diagnozę**:
      naprawiona albo opisana przyczyną i powodem, dla którego naprawa nie mieści się w tej fali.

**Brak regresji i domknięcie fazy**

- [ ] **AC-9** — Given przeniesione moduły, when uruchamiam klikacz ścieżki szczęśliwej, then
      **21/21 modułów** otwiera się bez błędu.
- [ ] **AC-10** — Given cała aplikacja, when uruchamiam komplet bramek i budowanie, then wszystko
      przechodzi, a liczba akcji objętych kontrolą dostępu **nie spada**.
- [ ] **AC-11** — Given pusta lista przejściowa, when ktoś napisze moduł „po staremu" (poza katalogiem
      modułów), then bramka to **wykrywa** — domknięcie AC-6 z przebiegu 046.
- [ ] **AC-12** — Given historia zmian tej fali, when ją przeglądam, then przenosiny są oddzielone od
      zmian zachowania: żaden commit nie miesza jednego z drugim.
- [ ] **AC-13** — Given dziennik przebudowy, when go czytam po tej fali, then wiem, czy Faza 1 jest
      domknięta, co z niej zostało i co jest pierwszym krokiem Fazy 2.

## 5. Zakres

**W zakresie:**
- Przeniesienie dziesięciu modułów: Wiadomości, Pogoda, Usługi, Kuchnia, Zwierzęta, Portfel, Zakupy,
  Zadania, Kalendarz, Strona główna — każdy osobnym commitem.
- Rozstrzygnięcie sprzężeń międzymodułowych kontraktami (Nawyki→Zadania, Usługi→Portfel,
  Kuchnia→Zakupy, Kalendarz→wiele, pulpit→wiele).
- **Nawigacja boczna z deklaracji** — osobny commit, bo to zmiana zachowania.
- **Jedno rozstrzygnięcie dla słowników współdzielonych** (kategorie, jednostki, produkty, tagi).
- **Diagnoza ośmiu zastanych porażek klikaczy** + naprawa tych, które da się naprawić bez zmiany
  zachowania aplikacji.
- Domknięcie fazy przy pustej liście: zaostrzenie bramki rejestru, usunięcie martwego kodu
  przejściowego.
- Aktualizacja rozdz. 15 dziennika: stan Fazy 1, co zostaje na Fazę 2.

**Poza zakresem (świadomie):**
- **Zdolności platformy `ai`, `llm`, `jobs`** — 38 plików, ~200 importujących; własny przebieg.
- **Zadanie 8** (asystent AI składany z deklaracji) — dokument stawia je po wszystkich modułach;
  wymaga najpierw platformy `ai`.
- **Pola `dashboard`, `calendar`, `resources` w deklaracji** (rozdz. 9.3) — pulpit i kalendarz stają
  się modułami dopiero w tej fali; wyprowadzanie ich z deklaracji to następny krok, nie ten.
- **Faza 2** (współdzielenie, `Workspace`, `ResourceGrant`) w całości.
- Jakakolwiek zmiana funkcjonalna w przenoszonych modułach.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów; uprawnienia przenoszą się do deklaracji, slugi w bazie
  i przypisania ról nietknięte. Po fali `PERMISSIONS` ma zawierać już tylko sluggi **spoza rejestru
  modułów** (ustawienia, admin, zaproszenia, podupranienia Kuchni) — i to jest sprawdzalny dowód, że
  „8 → 1" zadziałało (C-22).
- **Własność danych:** bez zmian — `ownerId`/`ownerTeamId` i guardy jadą razem z akcjami (C-21).
- **Asystent AI:** bez nowych `AIAction` ani read-tooli; zmieniają się **wyłącznie ścieżki importu**
  w egzekutorach i narzędziach odczytu. Liczba akcji objętych bramkami **nie może spaść** (C-23).
- **Kalendarz:** staje się modułem. Jego agregat nadal ma zwracać **identyczny** wynik — to jest
  najostrzejszy test tej fali, bo czyta dane sześciu innych modułów.
- **Powiadomienia / trash:** bez zmian.
- **Baza danych:** **bez migracji.**

## 7. Zgodność z konstytucją

- **C-36** — reguła całej fali; po niej ma obowiązywać **bez wyjątków**, bo nie zostanie moduł, do
  którego się nie stosuje.
- **C-02** — alias na zewnątrz, ścieżka względna wewnątrz modułu.
- **C-21, C-22** — własność i RBAC bez zmian.
- **C-23** — egzekutory i read-toole przez kontrakty; pokrycie akcji bez ubytku.
- **C-53** — powtarzamy wzorzec; nowe są tylko trzy rzeczy, których fala **wymaga**: pole nawigacji
  w deklaracji, rozstrzygnięcie słowników, zaostrzenie bramki po opróżnieniu listy.
- **C-50, C-51** — build zielony; nieoczywiste problemy do `doświadczenia.md`.
- **C-10..C-14** — **nie dotyczą**: brak zmian schematu; potwierdzi bramka rozjazdu.

## 8. Otwarte pytania / decyzje właściciela

Brak pytań — wzorzec rozstrzygnięty w 046 i 047, a właściciel zlecił przeprowadzenie pipeline'u do
końca. Decyzje przyjęte domyślnie, zapisane tutaj:

- **Kolejność: od najmniej do najbardziej sprzężonych**, z Kalendarzem i pulpitem na końcu — one
  czytają pozostałe moduły, więc przeniesione jako ostatnie zastaną gotowe kontrakty zamiast
  tymczasowych.
- **Słowniki współdzielone zostają w `src/actions` i dostają jedno, wspólne uzasadnienie** —
  zgodnie z precedensem tagów z 047. Powód: kategorie, jednostki i produkty **nie są własnością**
  ani Zakupów, ani Kuchni; wciągnięcie ich do któregokolwiek zabetonowałoby sprzężenie, a wyniesienie
  do platformy to osobne zadanie z własnym ryzykiem (trzy modele, trzy poziomy własności
  system/user/team). Fala ma domknąć **granice modułów**, nie przeprojektować słowniki.
- **Moduł zbyt sprzężony zostaje na liście z powodem** — cel to sprawdzone przeniesienie, nie liczba
  w raporcie.
- **Naprawiamy tylko te porażki klikaczy, które da się naprawić bez zmiany zachowania aplikacji.**
  Test oczekujący nieistniejącego przycisku to błąd testu; brakująca funkcja w aplikacji to backlog
  produktowy i nie wchodzi do fali refaktorującej.

## 9. Ryzyka

- **Kalendarz i pulpit czytają wiele modułów** → przenoszone jako ostatnie, po kontraktach, na których
  się opierają; agregat kalendarza porównany przed/po.
- **Kontrakty Zadań i Zakupów spuchną** (najwięcej konsumentów w systemie) → kontrakt piszemy z listy
  realnych wywołań; rozmiar traktujemy jako **wynik pomiaru sprzężenia**, nie jako porażkę — i tak go
  raportujemy.
- **Fala jest duża** (10 modułów + trzy zmiany zachowania) → jeden commit na moduł, zmiany zachowania
  osobno, komplet bramek po każdym module. Przy realnym ryzyku utraty kontroli — zatrzymanie się
  z częścią modułów przeniesionych i **jawnym** raportem, zamiast forsowania całości.
- **Nawigacja z deklaracji dotyka powłoki**, czyli każdej strony → osobny commit, klikacz po nim.
- **Zaostrzona bramka rejestru może blokować pracę**, jeśli lista nie dojdzie do zera → włączamy ją
  **tylko** przy pustej liście; inaczej odkładamy i mówimy to wprost.
