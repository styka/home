# Spec: Moduł Rośliny — od parapetu do hektara

- **ID:** 113-modul-roslin
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-28
- **Moduł(y):** **nowy moduł Rośliny**; integracje z Pogodą, Zadaniami, Zakupami, Portfelem, Kuchnią, Kalendarzem

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.
> **Podstawa merytoryczna:** [`badania.md`](./badania.md) — głęboki research zamówiony przez właściciela
> (segmenty, mapa 10 poziomów z oceną kompletności każdego, przegląd konkurencji, wymogi prawne,
> analiza pokrycia przez istniejące moduły Omnii). Ten spec jest **wnioskiem** z tamtego dokumentu;
> gdy coś tu jest odłożone, powód stoi tam.

---

## 1. Problem / potrzeba

Omnia prowadzi zwierzęta, pojazdy, zdrowie, kuchnię i magazyn — ale **wszystko, co rośnie, jest poza
systemem**. Właściciel chce moduł, który obsłuży ten sam byt na czterech skalach: kwiatek na
parapecie, ogród przy domu, kwiaciarnia i pole. Dziś każda z tych skal wymaga innej, obcej aplikacji,
a żadna z nich nie wie tego, co Omnia już wie — jaka jest pogoda w miejscu użytkownika, co ma w
spiżarni, ile wydał i co ma zaplanowane.

Teraz, bo dochodzi twardy termin: **od 1 stycznia 2026 profesjonalni użytkownicy środków ochrony
roślin w Polsce prowadzą ewidencję zabiegów z nowymi polami**, z obowiązkiem doprowadzenia jej do
formy elektronicznej do 31 stycznia roku następnego. Żadna aplikacja „do doniczek" tego nie robi.

## 2. Cel i miary sukcesu

- **Cel:** jedno konto Omnii obsługuje **wszystkie** relacje użytkownika z roślinami — kilka odrębnych
  przestrzeni roślinnych o różnych trybach, z opieką, dziennikiem, diagnozą, planem sezonu i (dla
  zawodowca) ewidencją zabiegów — bez budowania drugiego magazynu i drugiej księgowości.
- **Sukces mierzymy:**
  - użytkownik zakłada przestrzeń i dodaje pierwszą roślinę w **≤ 3 krokach**, a przy dodawaniu ze
    zdjęcia gatunek i harmonogram są **zaproponowane**, nie wpisywane ręcznie;
  - w tym samym koncie przestrzeń „Mieszkanie" **nie pokazuje** pól zawodowych, a przestrzeń
    „Kwiaciarnia" pokazuje je **bez przełączania ustawienia konta**;
  - zadanie opieki niesie **jedno zdanie uzasadnienia** („dlaczego dziś"), a nie samą datę;
  - rejestr zabiegów pozwala wyeksportować komplet pól wymaganych od 2026 dla wybranego okresu;
  - żaden widok modułu **nie generuje treści AI samoczynnie przy otwarciu** — treść jest pamiętana,
    a odświeżenie jest decyzją użytkownika (poza sekcjami w trybie `always`).

## 3. Historyjki użytkownika

**Mieszkanie (hobby)**
- Jako mieszkaniec chcę dodać roślinę **ze zdjęcia**, żeby nie szukać jej nazwy ani potrzeb.
- Jako mieszkaniec chcę dostać przypomnienie o podlaniu **dopasowane do pory roku i pogody**, żeby nie
  zalać rośliny zimą.
- Jako mieszkaniec chcę wysłać zdjęcie chorego liścia i dostać **ocenę z poziomem pewności** oraz
  przycisk „zaplanuj zalecany zabieg", żeby wiedzieć, co zrobić, a nie tylko co się dzieje.
- Jako mieszkaniec chcę widzieć **zdjęcia tej samej rośliny w czasie**, żeby zobaczyć, że opieka działa.
- Jako mieszkaniec chcę zapisać, że roślina padła i dlaczego, żeby system po roku powiedział mi, co
  robię źle.

**Ogród (hobby+)**
- Jako ogrodnik chcę mieć w przestrzeni **miejsca** (grządki, strefy) z warunkami, żeby wiedzieć, co
  gdzie posadzić.
- Jako ogrodnik chcę **plan sezonu dla mojej lokalizacji**, a nie przepisany z poradnika.
- Jako ogrodnik chcę **ostrzeżenie o płodozmianie**, gdy sadzę to samo w tym samym miejscu trzeci rok.
- Jako ogrodnik chcę zapisać zbiór i **wysłać go do spiżarni**, żeby domknąć drogę z grządki na talerz.
- Jako wyjeżdżający chcę **udostępnić przestrzeń** osobie, która podleje mi rośliny, z widokiem „co
  dziś podlać".

**Produkcja (kwiaciarnia / hodowla)**
- Jako prowadzący hodowlę chcę traktować **partię** (100 szt. jednego gatunku) jak jeden byt z
  liczbą sztuk, żeby nie zakładać stu rekordów.
- Jako prowadzący hodowlę chcę widzieć **fazę** partii i koszt zabiegów, żeby znać koszt jednostkowy.
- Jako prowadzący hodowlę chcę, żeby koszty trafiały do **Portfela**, a zakupy na **listę zakupów** —
  bez drugiej księgowości.

**Pole (rolnik)**
- Jako rolnik chcę prowadzić uprawę na **powierzchni** z fazami rozwoju, a nie liczyć pojedyncze rośliny.
- Jako rolnik chcę **rejestr zabiegów z polami wymaganymi od 2026** (rodzaj zastosowania, numer
  zezwolenia, dokładna lokalizacja) i **eksport za okres**, żeby spełnić obowiązek.
- Jako rolnik chcę **historię miejsca**, żeby zaplanować płodozmian.

**Wspólne**
- Jako użytkownik chcę mieć **kilka przestrzeni naraz** (kwiaciarnia i prywatny ogród) i żeby każda
  wyglądała odpowiednio do swojego trybu.
- Jako użytkownik chcę zapytać **asystenta** („co dziś podlać?", „załóż roślinę Monstera na parapecie
  w salonie") i dostać odpowiedź lub wykonanie.
- Jako użytkownik chcę widzieć **koszt** operacji AI i decydować o odświeżeniu wygenerowanej treści.

## 4. Kryteria akceptacji (testowalne)

**Przestrzenie i tryby**
- [ ] **AC-1** — Given zalogowany użytkownik z uprawnieniem do modułu, when zakłada przestrzeń
  roślinną i wybiera jej rodzaj (Mieszkanie / Ogród / Produkcja / Pole), then przestrzeń powstaje
  z tym rodzajem, a lista przestrzeni pokazuje ją wraz z liczbą roślin.
- [ ] **AC-2** — Given użytkownik ma dwie przestrzenie o różnych rodzajach, when otwiera przestrzeń
  „Mieszkanie", then pola zawodowe (powierzchnia, faza rozwojowa, koszt jednostkowy, ewidencja) **nie
  są widoczne**; when otwiera przestrzeń „Produkcja" lub „Pole", then są widoczne — **bez zmiany
  jakiegokolwiek ustawienia konta**.
- [ ] **AC-3** — Given przestrzeń dowolnego rodzaju, when użytkownik prosi o pola zaawansowane, then
  są dostępne (tryb steruje domyślną widocznością, nie odbiera funkcji).

**Byt roślinny i miejsca**
- [ ] **AC-4** — Given przestrzeń, when użytkownik dodaje roślinę, then może podać liczność (1 szt.,
  n szt. lub powierzchnię z jednostką) i miejsce w przestrzeni, a byt zapisuje się jako **jeden**
  rekord niezależnie od skali.
- [ ] **AC-5** — Given istniejąca roślina, when użytkownik zakłada z niej sadzonkę, then nowy byt ma
  wskazanie rośliny‑rodzica, a rodzic pokazuje swoje potomstwo.
- [ ] **AC-6** — Given roślina, when użytkownik oznacza ją jako zakończoną (sprzedana / zebrana /
  padła) z powodem, then znika z listy aktywnych, ale **zostaje w historii miejsca** i w statystykach.
- [ ] **AC-7** — Given usunięcie rośliny lub przestrzeni, when użytkownik potwierdzi, then trafia to
  do kosza z retencją i daje się przywrócić z `/trash`.

**Opieka i harmonogram**
- [ ] **AC-8** — Given roślina z gatunkiem i miejscem, when zostaje utworzona, then moduł proponuje
  harmonogram opieki (podlewanie/nawożenie/inne) wynikający z gatunku, miejsca i pory roku.
- [ ] **AC-9** — Given zaplanowany zabieg, when użytkownik otwiera agendę opieki, then przy pozycji
  widnieje **jedno zdanie uzasadnienia terminu**.
- [ ] **AC-10** — Given zaplanowany zabieg, when użytkownik go wykonuje / pomija / przesuwa, then
  zdarzenie zapisuje się w historii, a następny termin przelicza się od faktycznego wykonania.
- [ ] **AC-11** — Given przestrzeń z przypisaną lokalizacją pogodową, when prognoza przewiduje opady
  lub przymrozek, then termin podlewania odsuwa się (odpowiednio: pojawia się ostrzeżenie), a powód
  jest widoczny w uzasadnieniu.
- [ ] **AC-12** — Given zaplanowane zabiegi, when użytkownik otwiera Kalendarz Omnii, then widzi je
  obok pozostałych pozycji agendy; when zbliża się termin, then dostaje powiadomienie.

**Dziennik, pomiary, zbiory**
- [ ] **AC-13** — Given roślina, when użytkownik dodaje wpis do dziennika ze zdjęciem, then wpis jest
  widoczny na osi czasu rośliny, a zdjęcia dają się obejrzeć jako postęp w czasie.
- [ ] **AC-14** — Given roślina, when użytkownik zapisuje pomiar (wysokość, liczba liści, plon,
  wilgotność…), then pomiar ma rodzaj i jednostkę, a jego historia jest widoczna jako przebieg.
- [ ] **AC-15** — Given zapisany zbiór, when użytkownik wybierze „dodaj do spiżarni", then pozycja
  trafia do spiżarni Kuchni; when wybierze „zapisz koszt", then wydatek trafia do Portfela; when
  wybierze „dopisz do zakupów", then pozycja trafia na listę zakupów.

**Katalog gatunków**
- [ ] **AC-16** — Given katalog zaseedowany migracją, when użytkownik szuka gatunku, then znajduje go
  po nazwie polskiej lub łacińskiej i widzi wymagania pielęgnacyjne oraz rodzinę botaniczną.
- [ ] **AC-17** — Given gatunku nie ma w katalogu, when użytkownik dodaje własny, then wpis jest jego
  własnością i widoczny obok systemowych, z czytelnym wskazaniem **pochodzenia** (systemowy /
  użytkownika / zaproponowany przez AI).

**AI**
- [ ] **AC-18** — Given zdjęcie rośliny, when użytkownik prosi o identyfikację, then dostaje
  propozycje gatunku z poziomem pewności i może jedną przyjąć (wypełnia gatunek rośliny) albo odrzucić.
- [ ] **AC-19** — Given zdjęcie objawu i istniejąca roślina, when użytkownik prosi o diagnozę, then
  odpowiedź uwzględnia **kontekst rośliny** (gatunek, miejsce, ostatnie zabiegi, pogoda), podaje
  poziom pewności, **dopuszcza „nie wiem"**, porządkuje zalecenia od naturalnych po chemiczne i
  pozwala **zaplanować zalecany zabieg** jednym działaniem.
- [ ] **AC-20** — Given przestrzeń, when użytkownik prosi o plan sezonu, then plan uwzględnia
  lokalizację, rodzaj przestrzeni, to co już rośnie i historię miejsca, a jego pozycje dają się
  wysłać do Zadań.
- [ ] **AC-21** — Given wygenerowana treść AI (plan sezonu, wnioski, diagnoza), when użytkownik wraca
  do widoku, then treść jest **pamiętana** (nie generuje się od nowa), z datą wytworzenia i znacznikiem
  nieaktualności, a odświeżenie jest jawną decyzją.
- [ ] **AC-22** — Given administrator z włączonym trybem admina, when powstaje treść AI, then widoczny
  jest koszt operacji z nazwą akcji po polsku.
- [ ] **AC-23** — Given asystent Omnii, when użytkownik pyta o rośliny („co dziś podlać?"), then
  asystent odpowiada z danych modułu; when prosi o utworzenie rośliny lub zapisanie zabiegu, then
  akcja przechodzi przez zwykły tryb zatwierdzania planu.

**Warstwa zawodowa**
- [ ] **AC-24** — Given przestrzeń typu Produkcja lub Pole, when użytkownik zapisuje zabieg środkiem
  ochrony roślin, then rejestr przyjmuje komplet pól wymaganych od 2026‑01‑01: datę, miejsce/uprawę,
  powierzchnię, preparat, dawkę, **rodzaj zastosowania**, **numer zezwolenia**, **dokładną lokalizację**,
  wykonującego i warunki.
- [ ] **AC-25** — Given zapisy w rejestrze, when użytkownik eksportuje ewidencję za wybrany okres,
  then otrzymuje plik zawierający wszystkie te pola.
- [ ] **AC-26** — Given uprawa w miejscu, w którym w poprzednich sezonach rosła roślina z tej samej
  rodziny botanicznej, when użytkownik ją zakłada, then dostaje **ostrzeżenie płodozmianowe** (nie
  blokadę).

**Wpięcie w system**
- [ ] **AC-27** — Given użytkownik bez uprawnienia do modułu, when wchodzi na jego adres wprost, then
  dostaje odmowę dostępu (nie tylko wyszarzenie w menu).
- [ ] **AC-28** — Given przestrzeń roślinna, when właściciel udostępni ją innej osobie, then ta osoba
  widzi ją zgodnie z nadaną rolą, a udostępnienie jest widoczne w `/udostepnione`.
- [ ] **AC-29** — Given użytkownik z rośliną wymagającą opieki dziś, when otwiera Stronę główną, then
  widzi to w migawce pulpitu.
- [ ] **AC-30** — Given cały feature, when uruchomimy `npm run build` (do kroku `next build`), then
  przechodzi — wraz z bramkami: uprawnienia trasy, kontrakt widoku, granice modułów, rejestr modułów,
  pokrycie akcji AI, kontrola dostępu, wskaźnik kosztu, pamięć treści AI, paginacja, i18n, kolumny
  własności, logi.

## 5. Zakres

**W zakresie (poziomy 1–5 mapy w całości, 6 częściowo, 7 w części ewidencyjnej):**
- Nowy moduł Rośliny z własnym uprawnieniem, wpięty w rejestr, menu, nawigację boczną, pulpit,
  kalendarz, powiadomienia, kosz, udostępnianie, retencję i asystenta.
- **Przestrzenie roślinne** wewnątrz modułu, z **rodzajem/trybem per przestrzeń**
  (Mieszkanie / Ogród / Produkcja / Pole); użytkownik ma ich dowolnie wiele.
- **Miejsca** w przestrzeni o zmiennej skali (parapet → grządka → sektor → pole), z warunkami
  (nasłonecznienie, gleba/podłoże, powierzchnia) i **historią** (co tu rosło).
- **Byt roślinny** jako jeden model z **licznością** (1 szt. / n szt. / powierzchnia), stanem cyklu
  życia (aktywna / sprzedana / zebrana / padła z powodem) i **relacją rodzic → sadzonka**.
- **Opieka**: harmonogram powtarzalny + log wykonania jako jedno zdarzenie‑zabieg (dość szerokie, by
  unieść oprysk), z pominięciem/przesunięciem, **adaptacją do pory roku i pogody** oraz
  **uzasadnieniem terminu**.
- **Dziennik** z wpisami i zdjęciami; **pomiary** z rodzajem i jednostką; **zbiory**.
- **Katalog gatunków** — systemowy, zaseedowany migracją, rozszerzalny przez użytkownika, z
  pochodzeniem wpisu i rodziną botaniczną.
- **AI**: identyfikacja ze zdjęcia, diagnoza z kontekstem rośliny (z „nie wiem" i planowaniem
  zabiegu), plan sezonu dla lokalizacji, wnioski/podsumowanie przestrzeni — wszystko z pamięcią
  treści, trybem odświeżania i wskaźnikiem kosztu.
- **Asystent**: odczyty (rośliny, agenda opieki, przestrzenie) i akcje (utwórz roślinę/przestrzeń,
  zapisz zabieg, zapisz pomiar) w istniejącym trybie zatwierdzania.
- **Warstwa zawodowa (część ewidencyjna)**: **rejestr zabiegów z polami wymaganymi od 2026‑01‑01 +
  eksport za okres**; fazy rozwojowe jako wspólny słownik (kod dla zawodowca, słowo dla hobbysty);
  partia jako liczność bytu; **ostrzeżenie płodozmianowe** z historii miejsca i rodziny botanicznej.
- **Analityka podstawowa** przestrzeni: przeżywalność, plon, porównanie z poprzednim sezonem, koszt
  czytany z Portfela — plus jedna sekcja wniosków AI.
- **Integracje wychodzące** (przez kontrakty, bez budowania odpowiedników u siebie): Pogoda,
  Zadania, Zakupy, Portfel, **Kuchnia (zbiór → spiżarnia)**, Kalendarz, Powiadomienia.

**Poza zakresem (świadomie — z numerem etapu i powodem; nic z mapy właściciela nie zostało pominięte
bez decyzji, uzasadnienia w `badania.md`):**

| Obszar z mapy | Etap | Powód |
|---|---|---|
| Mapa 2D/3D przestrzeni z przeciąganiem roślin | 2 | Samodzielny edytor graficzny; model miejsc już to uniesie |
| IoT / sensory (wilgoć, temperatura, pH, światło) | 2 | To przyjmowanie danych z zewnątrz: uwierzytelnianie urządzenia, limity, retencja szeregu. **Model pomiaru projektujemy tak, by sensor tylko dopisywał do tej samej tabeli** — etap 2 nie będzie migracją |
| Karencja i prewencja po zabiegu (blokada/ostrzeżenie przed zbiorem) | 2 | Brak danych o preparatach do zaseedowania. **Pole na karencję w rejestrze zakładamy od razu** |
| Import/synchronizacja katalogu z Pl@ntNet/GBIF | 2 | Wymaga klucza i polityki cache; katalog systemowy wystarcza na start |
| Certyfikaty i dokumenty z datą ważności (BIO, ubezpieczenia) | 2 | Wzorzec załączników istnieje (Flota); nie jest na ścieżce krytycznej |
| Suma temperatur efektywnych → przewidywany termin zbioru | 2 | Uczciwy zamiennik „symulatora ML"; wymaga szeregu pogodowego |
| Wydajność na jednostkę powierzchni, rentowność per uprawa, plon t/ha | 2 | Potrzebuje pełnej warstwy produkcyjnej |
| Sąsiedztwo roślin (companion planting) | 2 | Ta sama mechanika co płodozmian, ale brak danych o interakcjach |
| Katalog symptomów do przeszukiwania | 2 | Ma sens, gdy jest materiał z realnych diagnoz |
| Automatyczne nawadnianie, API zewnętrzne, ceny rynkowe, dotacje, umowy | 3 | Sterowanie urządzeniem i integracje handlowe — osobna odpowiedzialność |
| Porównywarka gatunków A vs B, timeline projektu jako osobny widok, wiki roślinna | 3 | Wartość rośnie z rozmiarem katalogu; wiki to w Omnii Notatki (wikilinki) |
| Modelowanie pól, NDVI, zdjęcia z drona, sensoryka multispektralna, współpraca badawcza | 3+ | Poziom aspiracyjny |
| Genetyka i krzyżowanie odmian | 3 | **Fundament (relacja rodzic → potomstwo) powstaje TERAZ** — reszta to nadbudowa, nie nowy byt |
| **Zapasy, dostawcy, dokumenty PZ/WZ, zamówienia, katalog produktów z cenami** | — | **[OBCE]** Realizuje **Magazynowanie Pro**. Moduł integruje się, nie buduje drugiego magazynu |
| **Faktury, P&L, marża, rentowność, budżety, podatki** | — | **[OBCE]** Realizuje **Portfel**. Druga księgowość = dwie prawdy o pieniądzach |
| **Sprzedaż, wyceny, płatności; klienci/CRM** | — | **[OBCE]** Realizują **Usługi** i **Kontakty** |
| Forum, blog, webinary, wyzwania, ranking, marketplace roślin, Instagram | **[NIE]** | Omnia nie ma trybu publicznego ani populacji użytkowników. Realna potrzeba z tego poziomu („ktoś podleje mi kwiaty") jest realizowana **teraz** przez udostępnianie przestrzeni |
| Benchmarking z innymi ogrodnikami | **[NIE]** | Brak populacji — statystyka z próby n=1 |
| Własna baza 50 000+ gatunków | **[NIE]** | Zobowiązanie utrzymaniowe nieproporcjonalne do wartości; katalog systemowy + AI pokrywa realne użycie |
| Segmenty PRO‑GROWER i BUSINESS jako osobne tryby | **[NIE]** | Badanie wykazało, że nie wnoszą nowych pojęć: PRO‑GROWER = Produkcja w większej skali, BUSINESS = handel (Magazyn + Usługi) |

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC (C-22):** **nowy slug** `module.rosliny`, zaseedowany migracją SQL, wpięty w
  rejestr modułów i w nawigację (desktop + mobilny pasek). Trasa modułu sprawdza uprawnienie
  w warstwie układu, nie tylko w menu (bramka `check:route-gating`) — AC-27.
- **Własność danych (C-21 w brzmieniu po 079):** zasób żyje w **przestrzeni własnościowej**
  (`Workspace`), bez kolumn właściciela. Zapis przez helpery własności, odczyt przez filtry zakresu —
  wariant dobierany według zastępowanego warunku, nigdy szerszy. Uwaga terminologiczna dla dalszych
  etapów: **„przestrzeń roślinna" modułu to NIE jest `Workspace`** — to byt wewnątrz modułu (wzorzec
  `Workshop`/`Store`); jedna przestrzeń własnościowa mieści ich wiele.
- **Udostępnianie (C-17):** moduł deklaruje własne zasoby i mapowanie **własnych operacji** na cztery
  role platformy — bez własnych ról i bez własnej reguły dziedziczenia. Roślina dziedziczy po
  przestrzeni. Wejście przez wspólne okno udostępniania; wynik widoczny w `/udostepnione` — AC-28.
- **Asystent AI (C-23):** nowe odczyty i nowe akcje; **każda akcja ma egzekutor**, wpis w kontrakcie
  akcji (polska etykieta, kontrola pól, słownik wartości, walidacja) i klasyfikację w manifeście
  pokrycia wraz z deklaracją dostępu i faktycznym guardem w ciele akcji — AC-23, AC-30.
- **Treści AI:** każde wywołanie modelu jest sklasyfikowane jako pamiętane albo na żądanie; treści do
  czytania są **pamiętane** ze znacznikiem nieaktualności i trybem odświeżania; koszt raportowany z
  **polską nazwą akcji biznesowej** — AC-21, AC-22.
- **Kalendarz:** moduł deklaruje wkład do wspólnej agendy (zabiegi, terminy siewu/zbioru) — AC-12.
- **Powiadomienia:** przypomnienia o zabiegach; ostrzeżenia pogodowe (przymrozek) — AC-11, AC-12.
- **Pulpit:** moduł deklaruje własny wkład do migawki Strony głównej (co wymaga opieki dziś) —
  AC-29. Trasa pulpitu pozostaje bez importów tego modułu.
- **Trash (C-24):** usuwanie roślin i przestrzeni jako soft‑delete z retencją i odzyskiem — AC-7.
- **Retencja:** moduł deklaruje własne polityki (m.in. zdjęcia dziennika); **rejestr zabiegów jest
  wyłączony z automatycznego usuwania** — to dokumentacja o wymogu ustawowym.
- **Integracje wychodzące:** wyłącznie przez kontrakty innych modułów (Pogoda, Zadania, Zakupy,
  Portfel, Kuchnia). Moduł **nie buduje** u siebie zapasów, faktur, księgowości ani sprzedaży.
- **i18n (C-32):** wszystkie teksty przez warstwę tłumaczeń, polski jako język źródłowy.

## 7. Zgodność z konstytucją

| Reguła | Dlaczego kluczowa tutaj |
|---|---|
| **C-01** | Cały kod, migracje i testy wyłącznie w `worldofmag/` |
| **C-36** | To jest **nowy moduł** — jedna deklaracja (menu, uprawnienie, ścieżki, nawigacja, asystent, zadania, kalendarz), pola **leniwe**, wkład do pulpitu w osobnym korzeniu kompozycji, wpięcie sprawdzane **w obie strony**. Zero dopisywania do równoległych list |
| **C-02 / C-36** | Wnętrze modułu importowane **ścieżką względną**; cudzy moduł **wyłącznie przez kontrakt**. Własny kontrakt niesie tylko to, czego potrzebują konsumenci — nie „wszystko" |
| **C-10, C-11, C-14** | Nowe modele i katalog gatunków wymagają **ręcznych, numerowanych, idempotentnych** migracji; seed uprawnienia i katalogu w SQL |
| **C-12** | **Zero enumów Prisma** — rodzaj przestrzeni, stan cyklu życia, rodzaj zabiegu, rodzaj pomiaru to `String` + union TypeScript |
| **C-13** | Weryfikujemy do kroku `next build` na lokalnym Postgresie; **nigdy** przeciw prod DB |
| **C-20** | Mutacje jako Server Actions z `revalidatePath()` |
| **C-17, C-21** | Deklaracja zasobów modułu; dostęp rozstrzyga platforma; własność przez przestrzeń |
| **C-22, C-23, C-24, C-25** | RBAC, egzekutory akcji AI, soft‑delete, audyt zmian konfiguracji |
| **C-30, C-33, C-34, C-35** | Kolory z zmiennych CSS; widoki przez `ModuleView` ze stanami brzegowymi i slotem ustawień; potwierdzenia przez wspólny dialog z jawnym `destructive`; nowy wspólny komponent tylko z konsumentem |
| **C-31** | Mobile‑first: jeden pasek na telefonie, cele dotyku, obszar gestów. Segment hobby to **głównie telefon** |
| **C-32** | Teksty przez `t()`, polski jako źródło |
| **C-40, C-41** | Model i provider z konfiguracji per typ operacji — **nigdy** hardcode; klucze szyfrowane |
| **C-53** | **Najważniejsza reguła tego feature'a.** Mapa właściciela jest wielkości całej Omnii; minimalizm rozstrzygnął zakres i wykluczył budowanie drugiego magazynu i drugiej księgowości |
| **C-54** | Łańcuch `badania.md → spec.md → plan.md → tasks.md → kod` musi zostać spójny; odkrycie na dalszym etapie zawraca do właściwego artefaktu |
| **C-55** | Pytania zadane **raz**, na tym etapie; odpowiedzi zapisane niżej |
| **C-50, C-52, C-52a** | „Gotowe" = zielony build; merge do `develop`, promocja `--ff-only` + tag |

## 8. Otwarte pytania / decyzje właściciela

**Rozstrzygnięte (jedno wywołanie pytań, wszystkie wybory zgodne z rekomendacją):**
- [x] **Zakres tej realizacji** → **Rdzeń wielosegmentowy + AI.** Poziomy 1–5 mapy w całości, 6
  częściowo, 7 w części ewidencyjnej; 8–10 etapami. Reszta wypisana w §5 z numerem etapu i powodem.
- [x] **Tryby** → **Tryb per przestrzeń** (Mieszkanie / Ogród / Produkcja / Pole). Wzorzec „Dom/Pro na
  użytkownika" z Magazynu i Warsztatów **odrzucony**: kwiaciarnia i parapet istnieją jednocześnie w
  jednym koncie. Tryb steruje domyślnymi i widocznością pól, **nie odbiera funkcji**.
- [x] **Warstwa handlowa** → **Integracja z istniejącymi modułami.** Zapasy → Magazynowanie, pieniądze
  → Portfel, sprzedaż → Usługi, klienci → Kontakty. Moduł liczy to, co roślinne.
- [x] **Ewidencja ŚOR** → **Tak: rejestr zabiegów + eksport**, z polami wymaganymi od 2026‑01‑01,
  bez integracji z systemem rządowym.

**Założenia przyjęte samodzielnie** (rozstrzygnięte rekomendowanym domyślnym i wzorcem sąsiednich
modułów; do zmiany bez naruszania zakresu):
- Nazwa i adres modułu po polsku, spójnie z Pogodą, Wiadomościami i Warsztatami.
- Rozmiar katalogu gatunków na start: rząd 150–250 pozycji pokrywających realne polskie użycie
  (doniczkowe, warzywa, zioła, owoce, zboża) — nie „50 000+".
- Identyfikacja i diagnoza przez **LLM** skonfigurowany w panelu (typ operacji dla obrazu), a nie przez
  zewnętrzne API roślinne ani własny model.
- Fazy rozwojowe: jeden słownik oparty na uznanej skali fenologicznej, prezentowany dwojako —
  kodem dla zawodowca, słowem dla hobbysty.
- Zdjęcia trzymane tam, gdzie moduły Omnii już trzymają załączniki (wzorzec załączników Zdrowia/Floty).
- Sekcje AI startują w trybie „na żądanie" — pierwszy wynik powstaje po kliknięciu, nie przy wejściu.

## 9. Ryzyka

| Ryzyko | Ograniczenie |
|---|---|
| **Rozlanie zakresu** — mapa jest wielkości całej Omnii | Zakres domknięty decyzją właściciela; §5 wymienia **każdy** odłożony obszar z etapem i powodem; recenzja sprawdza, czy nic spoza zakresu nie weszło |
| **Trzy równoległe poddrzewa** (hobby / partia / pole) | **Jeden** byt roślinny z licznością i miejsce o zmiennej skali — AC-4 jest sprawdzalne wprost |
| **Interfejs zawodowy zasypuje hobbystę** | Tryb na przestrzeni; pola zaawansowane domyślnie **schowane, nie zablokowane** — AC-2 i AC-3 razem |
| **Koszt AI przy każdym otwarciu widoku** | Treść pamiętana + tryb odświeżania + wskaźnik kosztu z nazwą akcji — AC-21, AC-22; bramki pokrycia pilnują, że nowy plik z wywołaniem modelu ma decyzję |
| **Diagnoza zawsze coś nazywa** | Wymuszony poziom pewności i dopuszczalne „nie wiem" — AC-19 |
| **Ewidencja niekompletna wobec przepisu** | Pola wprost z wymogu + eksport — AC-24, AC-25; pole na karencję założone od razu, choć funkcja jest etapem 2 |
| **Dublowanie Magazynu** („nasiona to przecież zapas") | Granica zapisana w §5: Rośliny = to, co rośnie; Magazyn = to, co leży na półce |
| **Model pomiaru nie uniesie sensorów w etapie 2** | Pomiar z rodzajem i jednostką projektowany tak, by sensor **dopisywał do tej samej tabeli** |
| **Duży, jednorazowy przyrost kodu utrudnia recenzję** | Podział na zadania idący warstwami (dane → akcje → widoki → AI → wpięcia), z bramkami po drodze; `/verify` i `/review` zawracają do implementacji przy brakach (C-54) |
