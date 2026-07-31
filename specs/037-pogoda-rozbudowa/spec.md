# Spec: Pogoda — mapa, obserwatory, propozycje „Co robić?" i widoczne koszty AI

- **ID:** 037-pogoda-rozbudowa
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-31
- **Moduł(y):** Pogoda (główny) + przekrojowo wszystkie moduły korzystające z LLM + panel admina (LLM)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Moduł Pogoda działa, ale sześć zgłoszeń właściciela pokazuje, że w codziennym użyciu zawodzi w
czterech miejscach naraz: **nie da się ustawić lokalizacji**, której nie zna wyszukiwarka nazw (małe
wsie) przy jednocześnie niedostępnej geolokalizacji urządzenia; **obserwatory pogody kłamią** —
obserwator o mokrym weekendzie potrafi pokazać status „Sprzyja" z uzasadnieniem „weekend suchy" — a
raz utworzonego obserwatora **nie można poprawić**; sekcja **„Co robić?" daje jeden ogólnikowy akapit**
zamiast konkretnych, związanych z okolicą pomysłów, których nie da się ani rozwinąć, ani zapamiętać,
ani odrzucić na przyszłość; a **koszt treści generowanych przez AI jest niewidoczny** wszędzie poza
asystentem, choć to ten sam mechanizm i ten sam portfel.

Robimy to teraz, bo wszystkie sześć zgłoszeń dotyczy jednego ekranu (`/pogoda`) i tych samych danych —
rozbijanie ich na osobne wdrożenia oznaczałoby czterokrotne przechodzenie po tym samym układzie strony.

## 2. Cel i miary sukcesu

- **Cel:** Pogoda staje się modułem, któremu można zaufać i z którego realnie się korzysta: lokalizację
  ustawia się dowolnie (mapa), obserwatory mówią prawdę i dają się edytować, „Co robić?" podsuwa
  konkretne, lokalne pomysły z trwałymi szczegółami i pamięcią decyzji użytkownika, a każda treść
  wygenerowana przez AI — w Pogodzie i w pozostałych modułach — pokazuje swój koszt.
- **Sukces mierzymy:**
  - Ustawienie dowolnego punktu na Ziemi jako lokalizacji pogody zajmuje ≤3 interakcje (otwórz wybór →
    wskaż punkt na mapie → zapisz), bez wpisywania nazwy i bez zgody na geolokalizację.
  - Żaden obserwator nie pokazuje statusu sprzecznego ze swoim opisem (weryfikowalne na obserwatorze
    „Bardzo mokry weekend": przy suchej prognozie status = „Niespełnione", nigdy „Sprzyja").
  - Edycja istniejącego obserwatora jest możliwa bez usuwania i tworzenia go od nowa.
  - „Co robić?" zwraca **listę** ≥4 nazwanych propozycji, w tym co najmniej jedną odnoszącą się do
    konkretnego miejsca/atrakcji w promieniu ~30 km od lokalizacji.
  - Szczegóły propozycji obejrzane dziś są dostępne po ponownym otwarciu aplikacji jutro, bez
    ponownego generowania i bez ponownego kosztu.
  - Propozycja odrzucona („nie proponuj") nie pojawia się w kolejnych generacjach, a użytkownik może
    ją przywrócić.
  - W każdym miejscu aplikacji, gdzie treść powstała z modelu językowego, przy tej treści widać
    wskaźnik kosztu (przy włączonym przełączniku), a administrator może rozwinąć rozbicie na
    modele/tokeny/koszt poszczególnych wywołań.

## 3. Historyjki użytkownika

- Jako użytkownik chcę **wskazać lokalizację palcem na mapie**, żeby dostać pogodę dla wsi, której
  wyszukiwarka nazw nie zna, i bez udostępniania lokalizacji urządzenia.
- Jako użytkownik chcę **widzieć na mapie, gdzie właściwie jest** moja zapisana lokalizacja, żeby
  wyłapać pomyłkę (dwie miejscowości o tej samej nazwie).
- Jako użytkownik chcę, żeby obserwator „Bardzo mokry weekend" mówił mi wprost **czy ten warunek
  zachodzi**, a nie czy pogoda jest ładna — inaczej nie wiem, co właściwie oznacza kafelek.
- Jako użytkownik chcę **poprawić istniejącego obserwatora** (nazwę, opis, zakres dni), bo pomyliłem
  się przy tworzeniu albo zmieniły mi się oczekiwania.
- Jako użytkownik chcę zamiast jednego akapitu dostać **listę konkretnych propozycji** — i ogólnych
  („wycieczka rowerowa"), i miejscowych („Skrzyczne → Malinowska Skała → Skrzyczne") — dobranych do
  pogody i okolicy, a przy złej pogodzie propozycji domowych.
- Jako użytkownik chcę **rozwinąć propozycję w szczegółowy plan** (co zabrać, ile to trwa, na co
  uważać przy tej pogodzie), jednym dotknięciem, tak samo wygodnie na telefonie jak na komputerze.
- Jako użytkownik chcę, żeby **raz wygenerowane szczegóły zostały ze mną** — wracam do nich za tydzień,
  bo dziś akurat nie mam czasu, a plan mi się spodobał.
- Jako użytkownik chcę móc **wygenerować szczegóły ponownie**, gdy pierwsza wersja mnie nie
  przekonała albo pogoda się zmieniła.
- Jako użytkownik chcę mieć **jedno miejsce ze wszystkimi rozważanymi pomysłami**, żeby wrócić do nich
  przy innej okazji i nimi zarządzać.
- Jako użytkownik chcę **oznaczyć propozycję jako „nigdy mi tego nie proponuj"** — od razu z listy, bez
  wchodzenia w szczegóły — i móc to później cofnąć.
- Jako użytkownik chcę **poznać po kafelku, że tę propozycję już kiedyś rozważałem**, żeby nie czytać
  drugi raz tego samego.
- Jako właściciel systemu chcę **widzieć koszt każdej treści wygenerowanej przez AI** w tym samym
  wyglądzie co w asystencie, żeby wiedzieć, ile kosztuje mnie korzystanie z modułu.
- Jako administrator chcę **wejść w szczegóły kosztu** (jakie modele, ile tokenów, ile kosztował każdy
  prompt składający się na tę treść) oraz **włączyć/wyłączyć pokazywanie licznika** w całej aplikacji.
- Jako użytkownik chcę, żeby na `/pogoda` **najpierw była dzisiejsza pogoda**, potem „Co robić?", a
  dopiero pod tym najbliższe godziny — bo w tej kolejności tego używam.

## 4. Kryteria akceptacji (testowalne)

**Mapa i lokalizacje**
- [ ] **AC-1** — Given jestem na `/pogoda`, when otwieram wybór lokalizacji, then obok wyszukiwania po
      nazwie i przycisku „moja lokalizacja" dostępna jest **mapa**, na której mogę przesuwać widok,
      przybliżać/oddalać i wskazać punkt.
- [ ] **AC-2** — Given wskazałem na mapie punkt bez nazwy w wyszukiwarce, when zapisuję lokalizację,
      then zostaje ona dodana do moich lokalizacji z sensowną nazwą (nazwa najbliższej miejscowości lub
      współrzędne, gdy nazwy nie da się ustalić) i prognoza jest liczona dla wskazanego punktu.
- [ ] **AC-3** — Given mam ustawioną lokalizację, when otwieram wybór lokalizacji, then mapa startuje
      wyśrodkowana na bieżącej lokalizacji ze znacznikiem w jej punkcie.
- [ ] **AC-4** — Given korzystam z telefonu, when używam mapy, then obsługa gestów (przesuwanie,
      szczypanie) działa, mapa mieści się w ekranie i nie blokuje przewijania strony pod nią, a cele
      dotykowe spełniają minimum z C-31.
- [ ] **AC-5** — Given kafelki mapy są niedostępne (brak sieci/blokada), when otwieram wybór
      lokalizacji, then widzę czytelny komunikat po polsku, a pozostałe sposoby wyboru lokalizacji
      (nazwa, geolokalizacja, współrzędne) nadal działają.

**Obserwatory**
- [ ] **AC-6** — Given mam obserwatora opisującego zjawisko negatywne (np. „Bardzo mokry weekend"),
      when prognoza jest sucha, then kafelek pokazuje status **„Niespełnione"** (nie „Sprzyja") z
      uzasadnieniem odnoszącym się wprost do treści obserwatora.
- [ ] **AC-7** — Given dowolny obserwator, when patrzę na jego kafelek, then status pochodzi z zamkniętego
      zbioru neutralnych wartości („Spełnione" / „Częściowo" / „Niespełnione" / stan nieoceniony) i
      nigdy nie wyraża oceny „ładna/brzydka pogoda".
- [ ] **AC-8** — Given istniejący obserwator (własny lub z gotowca), when wybieram przy nim „Edytuj",
      then mogę zmienić jego nazwę, opis warunku i zakres dni, a po zapisaniu kafelek jest przeliczany
      wg nowej definicji.
- [ ] **AC-9** — Given edytuję obserwatora i zmieniam warunek, when zapisuję, then poprzednia ocena nie
      jest pokazywana jako aktualna dla nowej definicji (użytkownik nie widzi statusu wyliczonego dla
      starego warunku).

**„Co robić?" — propozycje**
- [ ] **AC-10** — Given jestem na `/pogoda` z ustawioną lokalizacją, when otwieram „Co robić?", then
      widzę **listę** nazwanych propozycji (nie jeden akapit), każda z krótkim uzasadnieniem
      odnoszącym się do pogody wybranego dnia/pory.
- [ ] **AC-11** — Given lista propozycji, then zawiera zarówno propozycje ogólne, jak i **co najmniej
      jedną odnoszącą się do konkretnego miejsca/atrakcji w okolicy** (orientacyjnie do ~30 km od
      lokalizacji); przy pogodzie wykluczającej rekreację na zewnątrz — propozycje domowe.
- [ ] **AC-12** — Given propozycja na liście, when ją otwieram (dotknięcie kafelka lub jego ikony),
      then dostaję **szczegółowy plan** tej propozycji; na komputerze w panelu obok listy, na telefonie
      w widoku pełnoekranowym, z widocznym powrotem do listy.
- [ ] **AC-13** — Given obejrzałem szczegóły propozycji, when zamykam aplikację i otwieram ją ponownie
      (inny dzień, inne urządzenie tego samego konta), then te same szczegóły są dostępne **bez
      ponownego generowania**.
- [ ] **AC-14** — Given otwarte szczegóły propozycji, when wybieram „Generuj ponownie", then powstaje
      nowa wersja szczegółów i to ona jest pokazywana.
- [ ] **AC-15** — Given propozycja, której szczegóły już kiedyś oglądałem, when pojawia się ponownie na
      liście „Co robić?", then jest wyraźnie oznaczona jako **już rozważana** i prowadzi do zapisanych
      szczegółów zamiast generować je od nowa.
- [ ] **AC-16** — Given lista propozycji w „Co robić?", when przy propozycji wybieram „Nie proponuj",
      then znika ona z listy, trafia do biblioteki pomysłów ze stanem „zablokowana" (nawet jeśli nigdy
      nie oglądałem jej szczegółów) i **nie pojawia się** w kolejnych generacjach.
- [ ] **AC-17** — Given biblioteka pomysłów, when otwieram ją z modułu Pogoda, then widzę wszystkie
      propozycje, które kiedykolwiek rozważałem lub zablokowałem, z filtrowaniem po stanie
      (zapisane / rozważane / zablokowane) i po lokalizacji.
- [ ] **AC-18** — Given pozycja w bibliotece, when wybieram działanie zarządzające, then mogę:
      **usunąć** ją, **zablokować** / **przywrócić proponowanie**, **zapisać jako ulubioną** oraz
      **otworzyć jej szczegóły** (jeśli były generowane).
- [ ] **AC-19** — Given usunąłem pozycję z biblioteki, when otwieram `/trash`, then jest tam do
      odzyskania zgodnie z retencją (C-24).
- [ ] **AC-20** — Given propozycja z zapisanymi szczegółami, when wybieram „Dodaj do zadań", then
      powstaje zadanie w module Zadania z nazwą propozycji i odsyłaczem do jej szczegółów.
- [ ] **AC-21** — Given nie mam ustawionej lokalizacji albo generowanie się nie powiodło, when otwieram
      „Co robić?", then widzę czytelny stan pusty/błędu po polsku z możliwością ponowienia — bez pustego
      kafelka i bez błędu w konsoli.

**Koszty AI**
- [ ] **AC-22** — Given administrator ma włączony licznik, when moduł Pogoda wygeneruje treść przez AI
      (opis dnia, propozycje, szczegóły propozycji, ocena obserwatorów), then przy tej treści widoczny
      jest wskaźnik kosztu **w tym samym wyglądzie co w asystencie AI**.
- [ ] **AC-23** — Given jestem administratorem, when rozwijam wskaźnik kosztu przy treści z dowolnego
      modułu, then widzę rozbicie na poszczególne wywołania modelu: model, typ operacji, tokeny
      (wejście/wyjście/pamięć podręczna) i koszt każdego z nich oraz sumę.
- [ ] **AC-24** — Given nie jestem administratorem, when licznik jest włączony, then widzę wyłącznie to,
      co przewiduje ustawienie widoczności — i nigdy nie mam dostępu do szczegółów technicznych
      zarezerwowanych dla administratora.
- [ ] **AC-25** — Given jestem administratorem w ustawieniach LLM, when przełączam „pokazuj licznik
      kosztów w aplikacji" na wyłączony, then wskaźnik znika ze wszystkich modułów (asystent zachowuje
      się zgodnie z tym samym ustawieniem), a zmiana trafia do dziennika zmian konfiguracji (C-25).
      **Doprecyzowanie z implementacji (C-54):** w oknie **asystenta** wskaźnik istniał już wcześniej i
      był widoczny dla **każdego** użytkownika. Zawężenie go teraz do administratora byłoby cofnięciem
      istniejącej funkcji, a nie realizacją zgłoszenia — dlatego asystent słucha **samego przełącznika**,
      a reguła „tylko administrator" obowiązuje w miejscach, w których licznik dopiero powstaje.
- [ ] **AC-26** — Given inne moduły generujące treść przez AI (m.in. Kuchnia, Notatki, Zadania,
      Magazynowanie, Języki, Wiadomości, Pety, Sklepy), when treść zostaje wygenerowana, then przy niej
      również widać ten sam wskaźnik kosztu — miejsca te są wypisane w planie na podstawie analizy kodu.
- [ ] **AC-27** — Given model użyty do wygenerowania treści nie ma stawek w cenniku, when patrzę na
      wskaźnik, then widzę „koszt nieznany", nigdy „0 zł".
- [ ] **AC-28** — Given deweloper dodaje nowe wywołanie modelu w module, when uruchamia `npm run build`,
      then bramka jakości wskazuje brak wpięcia licznika (nowe wywołania LLM nie mogą po cichu ominąć
      prezentacji kosztu).

**Układ strony**
- [ ] **AC-29** — Given wchodzę na `/pogoda`, when strona się wyrenderuje, then kolejność sekcji w
      kolumnie głównej to: **pogoda na dziś → „Co robić?" → najbliższe godziny → reszta bez zmian**,
      identycznie na komputerze i na telefonie.

## 5. Zakres

**W zakresie:**
- Wybór lokalizacji pogody przez wskazanie punktu na **mapie** (przesuwanie, zoom, znacznik, start na
  bieżącej lokalizacji), obok istniejącego wyszukiwania po nazwie i geolokalizacji urządzenia;
  ustalenie nazwy dla wskazanego punktu.
- Naprawa semantyki statusu obserwatorów: status opisuje **czy warunek obserwatora zachodzi**, w
  neutralnych, zamkniętych wartościach, z uzasadnieniem odnoszącym się do treści obserwatora.
- **Edycja** istniejącego obserwatora (nazwa, opis warunku, zakres dni) obok istniejących
  dodaj/włącz/wyłącz/usuń.
- Przebudowa „Co robić?" z pojedynczego opisu na **listę propozycji** (ogólne + konkretne miejscowe do
  ~30 km + domowe przy złej pogodzie), z generowaniem **szczegółowego planu** pojedynczej propozycji na
  żądanie.
- **Trwałość** propozycji i ich szczegółów (per użytkownik), ponowna generacja szczegółów, oznaczanie
  propozycji już rozważanych.
- **Biblioteka pomysłów** jako osobna podstrona modułu Pogoda: przegląd, filtry, zarządzanie (usuń,
  zablokuj „nie proponuj", przywróć, oznacz jako ulubione, otwórz szczegóły) + soft-delete do `/trash`.
- Blokowanie propozycji **bezpośrednio z listy** w „Co robić?" (bez wchodzenia w szczegóły).
- Przycisk **„Dodaj do zadań"** dla propozycji ze szczegółami (integracja z modułem Zadania).
- **Wspólny wskaźnik kosztu AI** użyty w Pogodzie i we **wszystkich** pozostałych miejscach
  generujących treść przez LLM (lista miejsc powstaje w planie z analizy kodu), spójny wizualnie z
  asystentem; szczegóły per wywołanie dla administratora.
- **Globalny przełącznik** widoczności licznika w panelu administratora (ustawienia LLM), audytowany.
- **Bramka jakości** pilnująca, że nowe wywołania LLM mają wpięty licznik.
- Zmiana **kolejności sekcji** na `/pogoda`.

**Poza zakresem (świadomie):**
- Nawigacja/trasowanie do zaproponowanych miejsc (od tego jest moduł Truck / zewnętrzne mapy) — dajemy
  co najwyżej odsyłacz do map zewnętrznych.
- Rezerwacje, bilety, godziny otwarcia atrakcji i jakiekolwiek dane komercyjne.
- Zmiana dostawcy danych pogodowych i rozbudowa samej prognozy (nowe parametry meteorologiczne).
- Powiadomienia push o spełnieniu obserwatora (obecny mechanizm powiadomień zostaje bez zmian).
- Twarde limity/budżety wydatków na AI i blokowanie wywołań po przekroczeniu kwoty — pokazujemy koszt,
  nie egzekwujemy budżetu.
- Historia kosztów per moduł w formie raportu/wykresu w panelu administratora (dziś wystarcza wskaźnik
  przy treści; szerszy raport to osobny temat).
- Współdzielenie propozycji i biblioteki pomysłów w zespole (dane są prywatne właściciela konta).
- Wpięcie propozycji w moduł Kalendarz (na razie tylko Zadania).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego modułu — całość mieści się w istniejącym `module.weather`
  (biblioteka pomysłów to podstrona Pogody). Przełącznik licznika i szczegóły kosztu są pod
  `module.admin`. Wpięcie „dodaj do zadań" respektuje `module.tasks` (przycisk tylko dla użytkownika
  z dostępem). Por. C-22.
- **Własność danych:** propozycje, ich szczegóły i decyzje użytkownika („zablokowana", „ulubiona")
  są **prywatne dla użytkownika** — dokładnie jak dotychczasowe lokalizacje i obserwatory Pogody, które
  mają **wyłącznie `ownerId`** (bez `ownerTeamId`). Naśladujemy ten wzorzec sąsiedniego kodu w obrębie
  tego samego modułu (C-21, C-53): dokładanie dziś kolumny zespołowej, która zawsze byłaby pusta, to
  martwy balast. Współwłasność zespołowa jest świadomie poza zakresem.
- **Asystent AI:** funkcja nie wymaga nowych akcji zapisujących. Asystent ma już odczyt pogody; jeśli
  w planie okaże się, że sensowne jest udostępnienie mu listy propozycji jako odczytu — dokładamy
  wyłącznie read-tool, bez `AIAction`. Każda ewentualna nowa akcja musi mieć egzekutor (C-23) i wpis
  w manifeście pokrycia AI.
- **Kalendarz / powiadomienia / trash:** kalendarz — nie dotyczy (poza zakresem). Powiadomienia — bez
  zmian. **Trash — tak:** usunięcie pozycji z biblioteki pomysłów przechodzi przez soft-delete z
  retencją i odzyskiem w `/trash` (C-24).
- **Panel administratora:** nowy przełącznik w ustawieniach LLM + zmiana zapisywana w dzienniku
  zmian konfiguracji (C-25).

## 7. Zgodność z konstytucją

- **C-01 / C-02** — cała praca w `worldofmag/`, importy przez alias `@/*`.
- **C-10 / C-11 / C-12** — trwałość propozycji, ich szczegółów i decyzji użytkownika oraz edycja
  obserwatorów wymagają zmian w schemacie → **ręcznie napisane pliki migracji** z kolejnym wolnym
  numerem; wszystkie stany (np. stan propozycji, status obserwatora) jako `String` + union TypeScript,
  **nigdy** enum Prisma.
- **C-13** — weryfikujemy build lokalnie do kroku `next build` na lokalnym Postgresie; żadnego
  `migrate.js` przeciwko produkcyjnej bazie.
- **C-14** — przełącznik widoczności licznika seedujemy idempotentną migracją SQL.
- **C-20** — wszystkie mutacje (lokalizacje, obserwatory, propozycje, biblioteka) to Server Actions z
  `revalidatePath()`.
- **C-21** — ownership propozycji wg wzorca `ownerId`/`ownerTeamId` i guardów modułu.
- **C-22** — brak nowego sluga; podstrona biblioteki pod istniejącym `module.weather`, szczegóły kosztu
  i przełącznik pod `module.admin`.
- **C-24** — usuwanie pozycji z biblioteki przez soft-delete do `TrashItem`.
- **C-25** — przełączenie widoczności licznika trafia do `AuditLog` (kategoria `config`).
- **C-30** — mapa, kafelki propozycji, panel szczegółów i wskaźnik kosztu wyłącznie na zmiennych CSS
  (skórki muszą działać); tekst na kolorowych tłach przez `var(--on-accent)`. Uwaga na kafelki mapy:
  ich kolorystyka jest zewnętrzna — otoczka i kontrolki mają być skinowalne.
- **C-31** — mapa i panel szczegółów propozycji projektowane mobile-first: na telefonie pełnoekranowy
  arkusz, cele dotykowe ≥ `py-3`, respekt dla `env(safe-area-inset-bottom)`, żadnych dwóch sidebarów.
- **C-32** — wszystkie teksty UI po polsku; prompty traktują nazwy miejsc i kategorii jako polskie.
- **C-40** — model do generowania propozycji i szczegółów rozwiązywany przez routing DB-driven per typ
  operacji; **żadnego** hardcodowania dostawcy/modelu.
- **C-50** — „gotowe" = zielony `npm run build` (do kroku `next build`), z nową bramką na wpięcie
  licznika kosztów.
- **C-51** — każdy naprawiony błąd (w szczególności semantyka statusu obserwatorów) kończy się wpisem
  w `doświadczenia.md`.
- **C-52** — merge do `develop`, a po zielonej recenzji automatyczna promocja `develop → master`.
- **C-53** — minimalizm: dokładamy **jedną** lekką zależność mapową (decyzja właściciela), nie budujemy
  własnego silnika map ani własnego systemu budżetów AI; wskaźnik kosztu to **jeden współdzielony
  komponent**, nie kopie w modułach.
- **C-54 / C-55** — pytania zadane jednorazowo (poniżej); dalsze etapy trzymają spójność artefaktów.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie pytania zadano jednorazowo na etapie `/specify`; właściciel wybrał wariant zalecany w każdym.

- [x] **Mapa** → **Leaflet + kafelki OpenStreetMap.** Prawdziwa mapa (przesuwanie, zoom, klik = punkt),
      bez klucza API, dobre gesty na mobile; nazwę wskazanego punktu ustalamy odwrotnym geokodowaniem.
- [x] **Biblioteka propozycji** → **osobna podstrona modułu Pogoda** (lista propozycji zostaje na
      `/pogoda`, szczegóły w panelu na desktopie / pełnoekranowym arkuszu na mobile), z filtrami i
      zarządzaniem, **plus** przycisk „dodaj do zadań".
- [x] **Licznik kosztów AI** → **wszystkie moduły korzystające z LLM**, globalny przełącznik w panelu
      administratora, **domyślnie widoczny dla administratora**, szczegóły techniczne wyłącznie dla
      administratora, bramka w buildzie pilnująca nowych wywołań.
- [x] **Status obserwatorów** → **status = czy warunek obserwatora zaszedł**, neutralne etykiety
      („Spełnione" / „Częściowo" / „Niespełnione"), uzasadnienie odnoszące się do treści obserwatora;
      model nigdy nie ocenia „urody" pogody.

**Założenia przyjęte samodzielnie** (rozstrzygnięte wzorcem sąsiednich modułów i C-53):
- Propozycje i biblioteka są **prywatne dla użytkownika** (jak lokalizacje i obserwatory Pogody).
- Promień „okolicy" to **orientacyjne ~30 km** przekazane modelowi jako wskazówka, nie twardy filtr
  geometryczny — nie budujemy własnej bazy atrakcji.
- Szczegóły propozycji generujemy **na żądanie** (dopiero po otwarciu pozycji), nie z góry dla całej
  listy — inaczej każde wejście na `/pogoda` kosztowałoby wielokrotność dzisiejszej ceny.
- Lista propozycji jest **przypisana do lokalizacji i doby**, a nie generowana przy każdym renderze —
  ponowne wejście na stronę tego samego dnia nie generuje nowego kosztu (poza jawnym „wylosuj inne").
- Wskaźnik kosztu przy treści pokazuje **koszt tej treści**, nie skumulowany koszt sesji.
- Istniejący przycisk „Wylosuj inną" zostaje jako sposób na wymuszenie nowej listy propozycji.

## 9. Ryzyka

- **Kafelki mapy jako zasób zewnętrzny** → dostępność i regulamin OSM. Ograniczamy: rozsądny nagłówek
  identyfikujący aplikację, brak masowego pobierania, czytelny stan awaryjny (AC-5) i zachowanie
  wszystkich dotychczasowych sposobów wyboru lokalizacji.
- **Nowa zależność w bundlu** (mapa) → ładowana wyłącznie w komponencie wyboru lokalizacji, leniwie,
  żeby nie obciążać pierwszego wejścia na `/pogoda`.
- **Model zmyśla atrakcje** („Skrzyczne" w miejscu, gdzie go nie ma) → w propozycjach miejscowych
  wymagamy nazwy własnej i krótkiego uzasadnienia „dlaczego stąd blisko"; użytkownik ma jednym
  dotknięciem odrzucić propozycję („nie proponuj"), co jest naturalną korektą jakości.
- **Rosnący koszt AI** przy liście + szczegółach → szczegóły generujemy na żądanie i zapisujemy na
  stałe (AC-13/AC-15 wprost eliminują powtórne generowanie), a wskaźnik kosztu czyni wydatek widocznym.
- **Rozjazd kosztu widocznego i faktycznego** → wskaźnik pokazuje koszt **szacowany** wg cennika; model
  bez stawek raportujemy jako „koszt nieznany" (AC-27), nigdy jako zero.
- **Szeroki zasięg licznika** (wiele modułów) grozi rozlaniem zmiany → mitygujemy jednym współdzielonym
  komponentem i jednym miejscem pobierania danych o zużyciu; moduły tylko przekazują identyfikator
  operacji.
- **Zmiana kolejności sekcji** może kolidować z personalizacją układu → sprawdzamy, czy kolejność sekcji
  Pogody nie jest sterowana preferencjami użytkownika, żeby zmiana nie nadpisała cudzych ustawień.
- **Migracja istniejących obserwatorów** na nową semantykę statusu → stare, zapisane oceny nie mogą być
  pokazywane jako aktualne w nowej skali (AC-9).
