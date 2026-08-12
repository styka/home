# Spec: `requireAccess` — sprawdzanie dostępu jako zdolność platformy

- **ID:** 052-requireaccess-platforma
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-12
- **Moduł(y):** platforma (nowa zdolność) + **Zadania** jako pierwszy konsument

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

051 postawiło fundament współdzielenia — przestrzenie i nadania istnieją i są wypełnione danymi —
ale **nikt ich nie czyta**. Dostęp liczy się nadal tak jak przed przebudową: każdy moduł ma własny
guard, własne rozumienie „kto może", i własny słownik ról. Nadanie dostępu do zasobu, gdyby dziś
powstało, **nie dałoby nikomu niczego**.

To jest asymetria, która musi zniknąć jako następna: dopóki sprawdzanie dostępu jest funkcją modułu,
udostępnianie nie może być zdolnością platformy (rozdz. 8.1). Dołożenie współdzielenia do
dziewiętnastu modułów, które go nie mają, oznaczałoby dziś napisanie dziewiętnastu guardów.

Jest też konkretne, nazwane w dokumencie zagrożenie: **asystent AI czyta wszystkie moduły** i robi to
przez `where: { ownerId }`. Gdy zasoby staną się współdzielone, asystent stanie się **drogą obejścia
uprawnień** — rozdz. 9.6 nazywa to wprost realnym zagrożeniem bezpieczeństwa, które musi być pokryte
testem.

## 2. Cel i miary sukcesu

- **Cel:** pytanie „czy ta osoba może wykonać tę operację na tym zasobie?" ma **jedną odpowiedź
  w jednym miejscu** — w platformie — a moduł tylko deklaruje, co jego operacje znaczą.
- **Sukces mierzymy:**
  - decyzje o dostępie dla modułu pilotażowego są **identyczne** z dzisiejszymi — porównane
    w tabeli prawdy pozycja po pozycji, nie „na oko";
  - sprawdzenie dostępu dla **właściciela** (przypadek najczęstszy) nie kosztuje więcej zapytań
    niż dziś, a powtórne sprawdzenie tego samego zasobu w jednym żądaniu nie kosztuje **żadnego**;
  - odczyty asystenta dotyczące modułu pilotażowego **nie mają drogi obejścia** — pokryte testem;
  - platforma nadal **nie zna żadnego modułu**;
  - użytkownik nie zauważa niczego.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby dołożenie współdzielenia do modułu było deklaracją „moje
  operacje znaczą tyle a tyle", a nie pisaniem kolejnego guardu.
- Jako **osoba rozwijająca Omnię** chcę jednego miejsca, w którym czytam, kto co może — zamiast
  odtwarzania reguły z trzech różnych guardów o różnych słownikach ról.
- Jako **użytkownik, który coś udostępnił** chcę, żeby druga osoba miała dostęp **wszędzie**, także
  przez asystenta — a jednocześnie żeby asystent **nie pokazał jej** niczego, do czego dostępu nie ma.
- Jako **użytkownik aplikacji** nie chcę zauważyć niczego: te same widoki, te same odmowy, te same
  komunikaty.

## 4. Kryteria akceptacji (testowalne)

**Zdolność platformy**

- [ ] **AC-1** — Given sprawdzanie dostępu w platformie, when przeglądam jego zależności, then **nie
      importuje ani jednego modułu**; wiedzę o zasobach dostaje **parametrem wymaganym** (wzorzec
      `buildAiCatalog` — parametr opcjonalny z domyślną wartością jest zakazany, bo zapomniany
      argument stałby się cichym przyzwoleniem).
- [ ] **AC-2** — Given moduł, when deklaruje swoje typy zasobów, then podaje **mapowanie własnych
      operacji na cztery role** (`viewer` < `commenter` < `editor` < `manager`) i relację
      rodzic→dziecko. Moduł **nie definiuje własnych ról**.
- [ ] **AC-3** — Given zasób dziedziczący po rodzicu (zadanie w projekcie), when sprawdzam dostęp
      do dziecka, then decyduje dostęp do **rodzica** — bez pisania tej reguły w module.

**Równoważność — sedno tego przebiegu**

- [ ] **AC-4** — Given macierz (relacja użytkownika do zasobu) × (operacja), when porównuję decyzję
      dzisiejszego guardu z decyzją nowego mechanizmu, then są **identyczne w każdej pozycji**.
      Różnica jest błędem albo **świadomą zmianą z zapisanym powodem** — nigdy „tak jest lepiej".
- [ ] **AC-5** — Given przypadek, w którym nowy mechanizm **poszerzyłby** dostęp wobec dzisiejszego
      (np. członek zespołu, którego dzisiejszy guard nie uwzględnia), when go napotkam, then
      **zachowuję dzisiejsze zachowanie** i zgłaszam rozbieżność jako ustalenie. Poszerzanie dostępu
      jest poza zakresem tego przebiegu.

**Wymagania niefunkcjonalne (rozdz. 8.9)**

- [ ] **AC-6** — Given sprawdzenie dostępu dla **właściciela** zasobu, when mierzę liczbę zapytań,
      then **nie rośnie** wobec dzisiejszego guardu.
- [ ] **AC-7** — Given to samo sprawdzenie powtórzone w **jednym żądaniu**, when mierzę liczbę
      zapytań, then drugie i kolejne kosztują **zero**.
- [ ] **AC-8** — Given zasób z nadaniami i dziedziczeniem, when rozwiązuję dostęp, then nadania
      są czytane **jednym zapytaniem**, nie po jednym na poziom.

**Bezpieczeństwo (rozdz. 9.6)**

- [ ] **AC-9** — Given odczyt asystenta dotyczący modułu pilotażowego, when użytkownik nie ma dostępu
      do zasobu, then asystent **go nie zwraca** — pokryte testem, który **widziano na czerwono**
      przed doprowadzeniem do zieleni.

**Brak regresji i domknięcie**

- [ ] **AC-10** — Given aplikacja po zmianie, when z niej korzystam, then **nic się nie zmienia**:
      te same widoki, te same odmowy, te same komunikaty błędów.
- [ ] **AC-11** — Given komplet bramek i budowanie, when je uruchamiam, then wszystko przechodzi,
      a liczniki 160 / 551 / 35 / 35 nie spadają.
- [ ] **AC-12** — Given dziennik przebudowy, when go czytam, then zadanie 10 jest odnotowane wraz
      z **tym, co trzeba będzie zamienić w zadaniu 11**, i z listą tego, co świadomie zostało.

## 5. Zakres

**W zakresie:**
- **Sprawdzanie dostępu jako zdolność platformy**: jedna funkcja odpowiadająca „czy wolno", z
  dziedziczeniem rodzic→dziecko, cache'em na czas żądania i rozwiązywaniem nadań jednym zapytaniem.
- **Deklaracja typów zasobów w module**: etykieta, mapowanie operacji na cztery role, dzieci.
- **Pierwszy konsument: Zadania.** Wybrane nie z sympatii, tylko dlatego, że mają dziś **oba**
  interesujące nas mechanizmy naraz — własność plus członkostwo w projekcie, i ręcznie napisane
  dziedziczenie projekt→zadanie. To najostrzejszy dostępny sprawdzian.
- **Tabela prawdy** porównana pozycja po pozycji, jako warunek przełączenia.
- **Odczyty asystenta dla Zadań** przez wspólne sprawdzanie dostępu, z testem obejścia.
- Dziennik: zadanie 10 i wskazanie, co zamienia zadanie 11.

**Poza zakresem (świadomie) — każde ma swój numer w checkliście rozdz. 14:**
- **`workspaceId` na 46 modelach** — **zadanie 11**, nazwane w rozdz. 8.10 najbardziej ryzykownym
  krokiem całej przebudowy.
- **Przeniesienie `TaskProjectMember`/`TaskShare`/`PetShare` na nadania** — **zadanie 12**. Pilot
  **czyta** dzisiejsze mechanizmy, nie migruje danych.
- **Deklaracje typów zasobów dla pozostałych osiemnastu modułów** — rozdz. 8.10, krok 8.
- **Unieważnianie cache zdarzeniem i wypychanie zmiany do przeglądarek** (rozdz. 8.9 pkt 3) —
  wymaga warstwy zdarzeń z **Fazy 4**. Tu cache żyje tyle, co żądanie, więc problem unieważniania
  po prostu nie powstaje.
- **Poszerzenie czyjegokolwiek dostępu**, UI udostępniania, kontrola współbieżności.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** **bez nowych slugów.** Uprawnienia modułowe (`module.*`) odpowiadają na
  pytanie „jaką część aplikacji widzisz", a nowe sprawdzanie na „co możesz zrobić z tym konkretnym
  zasobem". Te dwa wymiary **pozostają rozdzielne**; ten przebieg ich nie łączy (C-22).
- **Własność danych:** bez zmian w modelu. `ownerId`/`ownerTeamId` **nadal są źródłem prawdy** —
  nowe sprawdzanie je czyta, a nie zastępuje.
- **Asystent AI:** **dotyczy i jest kluczowe.** Odczyty dla modułu pilotażowego przechodzą przez
  wspólne sprawdzanie. Zero nowych akcji i read-tooli — zmienia się droga, nie katalog.
- **Kalendarz / powiadomienia / trash:** bez zmian.
- **Baza danych:** **bez migracji.** Wszystko, czego potrzeba, powstało w 051.

## 7. Zgodność z konstytucją

- **C-36** — reguła wiodąca: platforma nie zna modułów, więc wiedza o zasobach przychodzi
  **parametrem wymaganym**. To także miejsce na lekcję z 049/050: deklaracja typów zasobów to czyste
  dane i może jechać z resztą deklaracji modułu, ale **cokolwiek dotyka bazy jest kodem serwerowym**
  i nie może trafić tam, skąd sięgnie po nie powłoka.
- **C-21** — model współwłasności nietknięty; nowe sprawdzanie **czyta** `ownerId`/`ownerTeamId`.
- **C-22** — RBAC bez zmian i bez zlewania się z rolami zasobu.
- **C-35** — zdolność bez konsumenta jest gorsza niż jej brak; stąd pilot w tym samym przebiegu.
- **C-53** — minimalizm: jeden moduł pilotażowy, nie dwadzieścia jeden; zero migracji danych.
- **C-50, C-51** — build zielony; nieoczywiste problemy do `doświadczenia.md`.
- **C-54** — jeśli tabela prawdy pokaże, że dzisiejsze zachowanie jest **niespójne** (a jest to
  prawdopodobne — trzy guardy o trzech słownikach ról), poprawiamy **spec**, a nie naciągamy wynik.

## 8. Otwarte pytania / decyzje właściciela

**Brak pytań** — właściciel zlecił kontynuację automatyczną, a decyzje tego przebiegu rozstrzyga
dokument (rozdz. 8.4 daje słownik ról, 8.9 wymagania, 9.6 wymóg dla asystenta) i dyscyplina z 049–051
(dowód równoważności przed przełączeniem). Założenia przyjęte samodzielnie:

- **Najpierw dowód, potem przełączenie.** Tabela prawdy powstaje **przed** podmianą guardu; bez niej
  przełączenie sposobu podejmowania decyzji o dostępie byłoby zmianą „na kompilator". To ta sama
  zasada, która w 050 uratowała migawkę pulpitu.
- **Zachowujemy dzisiejsze zachowanie co do znaku, nawet jeśli wygląda na błąd.** Jeżeli okaże się,
  że któryś guard nie uwzględnia np. własności zespołowej, **nie naprawiamy tego po drodze** —
  naprawa dostępu ukryta w przebudowie dostępu jest nie do zweryfikowania. Rozbieżność idzie do
  ustaleń jako osobna rzecz do decyzji.
- **Pilotem są Zadania**, bo mają własność, członkostwo i dziedziczenie naraz. Moduł prostszy
  przeszedłby zbyt łatwo i niczego by nie dowiódł.
- **Cache żyje tyle, co żądanie.** Wariant trwalszy wymagałby unieważniania zdarzeniem, a warstwa
  zdarzeń to Faza 4. Cache per żądanie daje wymaganie z rozdz. 8.9 pkt 2 **bez** zaciągania długu,
  którego nie ma czym spłacić.
- **Stan przejściowy jest nazwany, nie udawany.** „Zero zapytań dla właściciela" z rozdz. 8.9 opiera
  się na porównaniu przestrzeni zasobu z przestrzeniami z sesji — a zasoby nie mają jeszcze tej
  kolumny (zadanie 11). Dlatego AC-6 mówi „nie rośnie wobec dzisiejszego guardu", a nie „zero".
  Mechanizm ma być zbudowany tak, żeby zadanie 11 **zamieniło jeden krok**, a nie przepisało całość.

## 9. Ryzyka

- **To jest kod decydujący o dostępie do danych.** Błąd nie objawia się wolniejszą stroną, tylko
  cudzymi danymi albo zablokowaną pracą → dlatego AC-4 (tabela prawdy) jest warunkiem przełączenia,
  a nie formalnością na końcu, i dlatego AC-5 zakazuje poszerzania dostępu przy okazji.
- **Trzy dzisiejsze guardy mają trzy słowniki ról** → mapowanie na cztery role może się nie ułożyć
  jeden do jednego. Wtedy obowiązuje C-54: poprawiamy spec i zapisujemy decyzję, zamiast wybierać
  „najbliższą" rolę po cichu.
- **Asystent jest drogą obejścia z definicji** — czyta wszystko i nie przechodzi przez UI. Test
  obejścia musi być **widziany na czerwono**, inaczej nie wiadomo, czy czegokolwiek pilnuje.
- **Cache per żądanie może „zamrozić" decyzję** w obrębie żądania, które samo zmienia nadania →
  granicą jest żądanie, a operacje zmieniające dostęp i tak kończą się przeładowaniem widoku;
  odnotowane, żeby nie zaskoczyło przy Fazie 4.
- **Pokusa zrobienia od razu wszystkich modułów** → dziewiętnaście deklaracji bez tabeli prawdy dla
  każdej to dziewiętnaście niesprawdzonych zmian w kontroli dostępu. Granica jest w §5 i jest twarda.
