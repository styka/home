-- 114 — RAPORT: PRZEGLĄD CAŁOŚCIOWY PROJEKTU — CO ZOSTAŁO ZMIENIONE I DODANE.
--
-- Właściciel poprosił: „przeanalizuj cały kod projektu, popraw/zrefaktoryzuj co warto, dopełnij
-- funkcjonalność modułów — a na koniec dodaj do raportów admina dokument z opisem wszystkiego,
-- co zostało zmienione/dodane". Ten raport jest tym dokumentem: pełna lista zmian sesji 114
-- z podziałem na naprawy błędów, dopełnienia funkcjonalne i porządki, plus co ŚWIADOMIE zostało
-- na później (tracker ETAP 7, T-26…T-31).
--
-- Migracja NIE zmienia kształtu bazy: jeden `INSERT` z `ON CONFLICT DO NOTHING` (C-14).
-- Treść nie zawiera żadnego sekretu ani adresu bazy (C-41).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "storage", "authorId", "teamId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Przegląd całościowy 114 — co zmieniono i dodano',
  'przeglad-calosciowy-114',
  $przeglad114$# Przegląd całościowy projektu (114) — co zmieniono i dodano

Sesja z 2026-08-29: trzy równoległe recenzje świeżym okiem (moduł Rośliny · przekrojowa całego
`src/` · macierz zdolności modułów), a po nich seria poprawek i dopełnień. Wszystko poniżej jest
scalone do `develop`. Pozycje odłożone świadomie mają numery **T-26…T-31** w trackerze
(`/admin/audyt` → A.16, ETAP 7).

---

## 1. Naprawione błędy (realne, z widocznym skutkiem)

### Kalendarz wywalał się na zdarzeniach Roślin
Wkład modułu Rośliny (113) emitował `module: "rosliny"`, którego `MODULE_META` kalendarza nie
znało — rzutowanie `as CalendarModule` uciszało kompilator, a `CalendarPage` czytała
`MODULE_META[ev.module].label`, więc **jeden zabieg roślinny w widocznym miesiącu = TypeError
i pusta strona kalendarza**. Dodane wpisy metadanych, `assembleCalendar` odrzuca nieznane moduły,
a nowy test (`moduleMeta.test.ts`) skanuje wszystkie `calendar.ts` modułów i wymaga wpisu dla
każdego emitowanego modułu — ten rozjazd nie wróci po cichu.

### Asystent: trzy równoległe listy modułów rozjechane
Unia typów znała 18 modułów, ręczna lista w trasie agenta 16 (bez Roślin i YouTube — ich akcje
były po cichu przepisywane na „shopping" i kończyły się „Nieznany typ akcji"), a powłoka czatu 13
(akcje Kontaktów/Raportów/Roślin/Warsztatów/YouTube w ogóle nie trafiały do promptu). Teraz jest
**jedno źródło**: `AI_ACTION_MODULES` (tablica + typ pochodny); nieznany moduł odrzuca akcję
zamiast fallbacku. Doszły też słowa-klucze taniego pre-routingu dla Roślin i YouTube oraz konteksty
ścieżek `/warsztaty`, `/contacts`, `/rosliny`, `/reports`, `/youtube` (dotąd asystent na tych
stronach proponował „Dodaj mleko do zakupów").

### Głosowe „zatwierdź"/„odrzuć" nigdy nie działało
Regexy używały ASCII-owego `\b` po polskich literach — formy z diakrytykami (dokładnie te, które
zwraca rozpoznawanie mowy pl-PL) nigdy nie pasowały, więc głosowe potwierdzenie szło do płatnego
agenta jako zwykła rozmowa. `granicePolskie` wydzielone do klienckiego `lib/ai/granice.ts`
i użyte w powłoce; przy okazji ostatni surowy `\b\w` w `fastPath` (wykrywanie nazwanej listy).

### „Dzisiaj" liczone w strefie serwera (UTC) — sześć miejsc
Między północą a 2:00 czasu polskiego: odhaczenie nawyku lądowało we **wczorajszym** dniu (a
strażnik przyszłości odrzucał poprawną datę z przeglądarki), briefing pokazywał wczorajszy
jadłospis, asystent odhaczał dawkę leku na wczoraj i raportował wczorajszy stan nawyków, granica
„nadchodzące/minione" wizyt przesuwała się o 2 h, okno „jedno przypomnienie dziennie" u zwierząt
żyło w UTC. Wszystko przeszło na `lib/userTime.ts` (doba użytkownika); statystyki nawyków dostały
parametr `todayIso`, a klient wysyła dzień jawnie.

### Plan posiłków: strzałki tygodni z przestarzałym domknięciem
Nasłuchiwacz klawiatury trzymał `goPrev/goNext` z pierwszego renderu — po pierwszym przeskoku
kolejne strzałki nawigowały od starej kotwicy. Funkcje w `useCallback` + w zależnościach efektu.

### Rośliny — pakiet ze świeżej recenzji
- **„Odłóż" liczy od późniejszej z dat (termin, dziś)** — zaległego zadania nie dawało się
  odłożyć: nowy termin wypadał w przeszłości, a UI zdejmowało pozycję z ekranu, więc wyglądało
  na sukces aż do odświeżenia.
- **Kosz przestał gubić dane rośliny**: migawka obejmuje teraz harmonogram opieki (kaskada go
  kasowała — przywrócona roślina znikała z agendy NA ZAWSZE, bo harmonogram zakłada tylko
  tworzenie rośliny) oraz identyfikatory zdarzeń opieki; przywrócenie odtwarza harmonogram
  i jawnie przypina z powrotem historię zabiegów i zbiory (`SET NULL` nadpisał `plantId`,
  wbrew komentarzowi, który obiecywał samoistny powrót historii).
- **Asystent widzi to samo co widoki**: zakres `zakresPrzestrzeni` (moje + nadane mi przestrzenie)
  zamiast węższego — opiekun udostępnionego ogrodu słyszał „nic do podlania"; „zaległe" wg tej
  samej reguły co agenda (doba karencji); licznik roślin tylko ACTIVE (spójnie z kafelkiem).
- **Trasa szczegółu rośliny** weryfikuje zgodność `spaceId` z adresu: sklejony ręcznie URL
  renderował roślinę domową w trybie polowym (pola BBCH/liczność wbrew AC-2), a niedostępna
  przestrzeń z adresu kończyła się błędem 500 zamiast 404.
- **`harvestToPantry` przyjmuje wyłącznie zbiory** — dotąd dowolne zdarzenie z mojego zakresu
  (np. wpis ewidencji oprysku) dało się wysłać do spiżarni jako „1 kg …".
- Zmiana stanu nie kasuje już wpisanej przyczyny (korekta DEAD→HARVESTED wymazywała najcenniejszą
  daną modułu); liczność ≤ 0 przy edycji to błąd, nie cisza (reguła w `domain/roslina` + test);
  pole „Co ile dni" znika dla podlewania (termin liczy reguła domenowa — etykieta obiecywała
  sterowanie, którego nie ma); trzeci wynik leczenia „Pogorszyło się" (najważniejszy sygnał —
  że zalecenie AI zaszkodziło — nie miał przycisku); daty dziennika/pomiarów/zbiorów/zabiegów
  w strefie przeglądarki (były w UTC); licznik na liście przestrzeni mówi „Zaległe i na dziś".

### Bezpieczeństwo i koszty AI
- **Blokada SSRF w imporcie przepisu z URL**: nowy `lib/http/pobierzPubliczny.ts` odrzuca sieci
  prywatne (localhost, 10/8, 172.16/12, 192.168/16, 169.254 — metadane chmury, CGNAT, ULA
  i link-local v6, zmapowane `::ffff:`), rozwiązuje DNS przed pobraniem i sprawdza **każdy skok
  przekierowania**. Dotąd trasa pobierała dowolny adres i oddawała treść błędu w komunikacie —
  nadawała się na skaner sieci hostingu.
- **11 tras `/api/llm/**` wiąże teraz koszt z użytkownikiem** (notes/*, tasks/*, normalize,
  category-*): bez `userId` licznik zużycia w `/settings` zaniżał, a miesięczny limit planu dawał
  się obejść „tańszą" trasą pomocniczą.
- **Rotacja tokenu iCal**: kontrola `AUTH_URL` przed rotacją — dotąd rotacja wykonywała się
  najpierw, więc przy braku/literówce env stary link umierał, a nowego nie było.

## 2. Dopełnienia funkcjonalne

- **Nawyki w kalendarzu**: jeden wpis dziennie („N nawyków do odhaczenia"), liczone są
  POZOSTAŁE (odhaczone nie czekają), nawyki z celem tygodniowym pominięte (nie mają dni).
- **Warsztaty w kalendarzu**: terminy przeglądów sprzętu (`nextServiceAt`) — ta sama semantyka
  co przeglądy Floty; dotąd agenda Pro żyła obok wspólnego kalendarza.
- **Kontakty: urodziny** — nowa kolumna `Contact.birthday` (migracja 0278), pole w formularzu,
  data przy wierszu i **wpis co rok we wspólnym kalendarzu** („🎂 Urodziny: …"). Model nie miał
  wcześniej ŻADNEGO pola daty, więc najbardziej oczywista funkcja lekkiego CRM była technicznie
  niemożliwa.
- **Kosz dla Kontaktów i Nawyków**: usunięcie zapisuje migawkę (nawyk razem z całym dziennikiem
  wykonań — kaskada kasowała miesiące odhaczeń i streaki), `/trash` przywraca oba typy.

## 3. Porządki i strażnicy

- **ESLint: 0 warningów** (z 20, historycznie 64) — zależności hooków naprawione realnie,
  świadome wzorce (reset formularza per `task.id`, `<img>` w generatorach ikon Satori i dla
  data-URI) mają uzasadnione wyłączenia w miejscu.
- **Nowe testy**: strażnik zgodności wkładów kalendarza z metadanymi, zakresy sieci prywatnych
  (SSRF), reguła dodatniej liczności, parsowanie daty urodzin, regexy granic polskich słów.
- **Bramki**: `check-ai-access` rozpoznaje `zakresPrzestrzeni` jako zawężenie; zapadka reguł
  domenowych trzyma (nowe reguły od razu w `domain/` z testami); próg N+1 kalendarza podniesiony
  16→19 z wpisem w historii (trzy nowe wkłady, powtórzenia wciąż 1 — to nie pętla).
- **Dokumentacja**: cztery lekcje w `doświadczenia.md` (rzutowanie `as` przez granicę modułów,
  równoległe listy, „dzisiaj" w strefie procesu, lekarstwo w niedostępnym pliku), tabela modułów
  i roadmapa w `CLAUDE.md`, tracker A.16 z nowym etapem.

## 4. Co ŚWIADOMIE zostało na później (tracker A.16, ETAP 7)

- **T-26** — `SPRAYING` odhaczony z agendy zaśmieca ewidencję ŚOR pustym, nieusuwalnym wierszem;
  pokrewne: `deletePlace` zrywa `placeId` w historycznych wpisach ewidencji.
- **T-27** — obsługa błędów i rola „tylko odczyt" w widokach Roślin (+ garść mniejszych ustaleń).
- **T-28** — rate-limit na pozostałych ~30 trasach `/api/llm/**` (w tym najdroższe vision/OCR).
- **T-29** — dialog konfliktu edycji (zadanie 16): `ConflictProvider` zamontowany, nikt nie łapie
  `ConflictError`; klienci nie przesyłają `expectedVersion`.
- **T-30** — decyzja o zakresie kosza dla pozostałych modułów (przepisy, zwierzęta, portfel…).
- **T-31** — drobne: unikalność planu posiłków na `workspaceId`, tagi z kategoryzacji AI w edytorze
  przepisu, `hasProjectRole` połykający błędy infrastruktury, wkłady dashboardu
  Nawyków/Warsztatów/Kontaktów, kalendarz Magazynowania (`expiresAt`) i Portfela (`deadline`).

---

*Raport wygenerowany w sesji przeglądu całościowego 114 (2026-08-29). Weryfikacja: pełna suita
jednostkowa i wszystkie bramki build zielone; szczegóły per-commit w historii gałęzi.*$przeglad114$,
  'system',
  'db',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
