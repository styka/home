# Spec: Bulkowa (zbiorcza) edycja zadań

- **ID:** 013-bulk-task-editing
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-20
- **Moduł(y):** Tasks (`/tasks`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba
Na liście zadań dziś zmienia się je pojedynczo — żeby np. przestawić 12 zadań na inny status,
podnieść priorytet kilku pozycji albo przenieść zaznaczone do innego projektu, trzeba otwierać i
zapisywać każde z osobna. To żmudne i wybija z rytmu przy porządkowaniu backlogu. Potrzebujemy
**zbiorczej edycji**: zaznaczyć wiele (lub wszystkie) zadań i za jednym zamachem zmienić wybrane
wartości, zostawiając nietknięte pola bez zmian. Ma być wygodne **zarówno na komputerze, jak i na
telefonie**.

## 2. Cel i miary sukcesu
- Cel: użytkownik zaznacza dowolny podzbiór (lub wszystkie) zadań na liście i jednym działaniem
  zmienia wybrane atrybuty wielu zadań naraz; pola, których nie ustawił, pozostają niezmienione.
- Sukces mierzymy:
  - Zmiana statusu/priorytetu dla N zaznaczonych zadań zajmuje **≤ 3 kliknięcia/tapnięcia** (wejście
    w zaznaczanie → wybór akcji → potwierdzenie/wybór wartości), niezależnie od N.
  - Działa tak samo dobrze na desktopie i na mobile (checkboxy ≥ 20×20 px, pasek akcji nie zasłania
    treści, respektuje `env(safe-area-inset-bottom)`).
  - Po zbiorczej zmianie każde nietknięte pole każdego zadania ma **dokładnie tę samą** wartość co
    przed operacją.

## 3. Historyjki użytkownika
- Jako użytkownik chcę zaznaczyć kilka zadań na liście i ustawić im wspólny status, żeby szybko
  domknąć/odłożyć grupę zadań.
- Jako użytkownik chcę zaznaczyć „wszystkie" widoczne zadania i podnieść priorytet, żeby nie klikać
  każdego z osobna.
- Jako użytkownik chcę zaznaczonym zadaniom ustawić wspólny termin lub kategorię, żeby uporządkować
  planowanie.
- Jako użytkownik chcę przenieść zaznaczone zadania do innego projektu za jednym razem.
- Jako użytkownik chcę zaznaczonym zadaniom dodać lub zdjąć wybrane tagi, nie ruszając ich
  pozostałych tagów.
- Jako użytkownik chcę zbiorczo usunąć zaznaczone zadania (do Kosza, z możliwością odzysku).
- Jako użytkownik na telefonie chcę wejść w tryb zaznaczania (długie przytrzymanie lub przycisk
  „Zaznacz") i mieć akcje zbiorcze wygodnie w zasięgu kciuka.
- Jako użytkownik chcę móc wyjść z trybu zaznaczania (Esc / „Anuluj") bez wprowadzania zmian.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.
- [ ] **AC-1** — Given lista zadań, when użytkownik wejdzie w tryb zaznaczania i zaznaczy ≥ 2 zadania,
  then pojawia się pasek akcji zbiorczych z licznikiem zaznaczonych pozycji.
- [ ] **AC-2** — Given zaznaczone zadania o różnych statusach, when użytkownik wybierze zbiorczy nowy
  status, then wszystkie zaznaczone zadania dostają ten status, a pozostałe (niezaznaczone) zadania
  są nietknięte.
- [ ] **AC-3** — Given zaznaczone zadania, when użytkownik ustawi tylko priorytet (nie dotykając
  statusu, terminu, kategorii, projektu, tagów), then po operacji zmienia się wyłącznie priorytet, a
  wszystkie inne pola każdego zadania pozostają takie same jak przed operacją.
- [ ] **AC-4** — Given zaznaczone zadania, when użytkownik ustawi zbiorczy termin (dueDate), then
  każde zaznaczone zadanie ma ten termin; when użytkownik zbiorczo wyczyści termin, then każde
  zaznaczone zadanie ma pusty termin.
- [ ] **AC-5** — Given zaznaczone zadania, when użytkownik wybierze zbiorczą kategorię, then każde
  zaznaczone zadanie dostaje tę kategorię.
- [ ] **AC-6** — Given zaznaczone zadania, when użytkownik wybierze „przenieś do projektu X", then
  wszystkie zaznaczone zadania trafiają do projektu X (z zachowaniem dostępu — patrz AC-10).
- [ ] **AC-7** — Given zaznaczone zadania, when użytkownik doda tag T i/lub usunie tag U, then każde
  zaznaczone zadanie ma tag T dołączony i tag U zdjęty, a jego **pozostałe** tagi są bez zmian
  (semantyka dodaj/usuń, nie „zastąp całość").
- [ ] **AC-8** — Given zaznaczone zadania, when użytkownik wybierze zbiorcze usunięcie i potwierdzi,
  then wszystkie zaznaczone zadania znikają z listy i są odzyskiwalne z `/trash`.
- [ ] **AC-9** — Given tryb zaznaczania, when użytkownik użyje „zaznacz wszystkie", then zaznaczają
  się wszystkie pozycje w bieżącym widoku/liście; ponowne użycie odznacza wszystkie.
- [ ] **AC-10** — Given zadania, do których użytkownik nie ma prawa edycji (cudze/bez dostępu),
  then zbiorcza operacja ich nie zmienia (są pomijane lub w ogóle niezaznaczalne), a użytkownik
  dostaje czytelny sygnał, ile pozycji zmieniono.
- [ ] **AC-11** — Given tryb zaznaczania, when użytkownik naciśnie Esc lub „Anuluj", then
  zaznaczenie znika i żadne zadanie nie zostaje zmienione.
- [ ] **AC-12** — Given lista z **własnymi (per-lista) statusami**, when użytkownik zbiorczo zmienia
  status, then do wyboru są statusy obowiązujące dla tej listy (a nie tylko domyślne).
- [ ] **AC-13** — Given telefon (widok mobilny), when użytkownik wejdzie w tryb zaznaczania, then
  checkboxy mają cel dotyku ≥ 20×20 px, a pasek akcji zbiorczych nie zasłania treści i respektuje
  dolny bezpieczny margines; on desktopie jednoczesne zaznaczanie zakresem (Shift+klik) działa.

## 5. Zakres
**W zakresie:**
- Tryb zaznaczania wielu zadań na liście zadań (widok listy) — desktop + mobile.
- Pływający pasek/bottom-sheet akcji zbiorczych z licznikiem i „Anuluj".
- „Zaznacz wszystkie / odznacz wszystkie" dla bieżącego widoku.
- Zbiorcza zmiana: **status** (z uwzględnieniem custom statusów listy), **priorytet**, **termin
  (dueDate; ustaw lub wyczyść)**, **kategoria**, **przeniesienie do innego projektu**, **tagi
  (dodaj/usuń wybrane)**, **usunięcie zbiorcze** (do Kosza).
- Zasada „nietknięte pola bez zmian": w jednej operacji zmieniają się tylko te atrybuty, które
  użytkownik świadomie ustawił.
- Pomijanie zadań bez prawa edycji z czytelnym podsumowaniem, ile faktycznie zmieniono.

**Poza zakresem (świadomie):**
- Zbiorcza edycja pól swobodnych (tytuł, opis) — nie mają sensownej wspólnej wartości.
- Zbiorcze ustawianie reguły powtarzania (recurring) i podzadań (parent/child) — złożona semantyka,
  osobny temat.
- Zbiorcze przypisywanie osoby (assignee) — do rozważenia później, nie w 1. wersji.
- Zaznaczanie/edycja bulk w widoku **Kanban** i **Timeline** — 1. wersja obejmuje widok listy;
  pozostałe widoki mogą dostać to później.
- Zbiorcze operacje przez asystenta AI (patrz sekcja 6 — na razie bez nowej `AIAction`).
- Cofnij (undo) całej operacji jednym kliknięciem inne niż odzysk usuniętych z `/trash`.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez nowego slugu — mieści się w istniejącym `module.tasks`. Edycja/usuwanie
  respektuje istniejący model dostępu do zadań/projektów (własność + współdzielenie/EDITOR).
- **Własność danych:** bez zmian w modelu własności — działamy na istniejących zadaniach
  (`ownerId`/`ownerTeamId` na projekcie + współdzielenie zadań); operacja zbiorcza egzekwuje te same
  reguły dostępu co edycja pojedynczego zadania (por. C-21).
- **Asystent AI:** nie dotyczy w 1. wersji — nie dodajemy nowej `AIAction` ani read-toola (asystent
  już potrafi edytować pojedyncze zadania). Ewentualne „zmień N zadań" przez AI to osobny, przyszły
  temat.
- **Kalendarz / powiadomienia / trash:** zbiorcze usunięcie korzysta z **soft-delete / Kosza**
  (odzysk w `/trash`, por. C-24). Zmiana terminów zaznaczonych zadań naturalnie odświeża ich obecność
  w kalendarzu/agendzie przez istniejącą agregację — bez osobnej integracji. Bez nowych powiadomień.

## 7. Zgodność z konstytucją
- **C-01/C-02** — cała praca w `worldofmag/`, importy przez alias `@/*`.
- **C-12** — statusy/priorytety pozostają `String` + union w TypeScript; żadnych enumów Prisma.
- **C-20** — mutacja zbiorcza jako Server Action z `revalidatePath()` na końcu; brak ręcznej
  inwalidacji cache gdzie indziej.
- **C-21** — dostęp do zadań/projektów liczony istniejącym guardem; operacja pomija pozycje bez
  prawa edycji zamiast je zmieniać.
- **C-24** — zbiorcze usunięcie przez soft-delete do `TrashItem` (odzysk w `/trash`).
- **C-30** — kolory paska akcji/checkboxów z zmiennych CSS (`var(--…)`), tekst na akcentach
  `var(--on-accent)`; bez hardcodowanych hexów (skinowalność).
- **C-31** — mobile-first i keyboard-first: checkboxy ≥ 20×20, pasek respektuje
  `env(safe-area-inset-bottom)`, Esc zamyka tryb; nigdy dwa sidebary na mobile.
- **C-32** — całość UI po polsku.
- **C-53** — minimalizm: maksymalne ponowne użycie istniejących akcji zadań i komponentów listy; bez
  nowych zależności i „przy okazji" refaktorów.

## 8. Otwarte pytania / decyzje właściciela
Rozstrzygnięte na `/specify` (jedyny moment pytań, C-55):
- [x] **Wzorzec UX** → **Tryb zaznaczania + pływający pasek akcji** (checkboxy na wierszach; desktop:
  pojawiają się przy najechaniu / po 1. zaznaczeniu, Shift+klik = zakres, „zaznacz wszystkie";
  mobile: długie przytrzymanie lub przycisk „Zaznacz", checkboxy 20×20; pasek/bottom-sheet z
  licznikiem i akcjami wysuwany na dole).
- [x] **Zakres pól** → **pełny zestaw**: status, priorytet, termin, kategoria, projekt, tagi,
  usunięcie. Każde pole opcjonalne — puste = bez zmian.
- [x] **Semantyka tagów** → **dodaj/usuń wybrane tagi** (pozostałe tagi zadania nietknięte), nie
  „zastąp całość".

Założenia przyjęte domyślnie (rekomendowane, do potwierdzenia dopiero gdyby coś zgrzytnęło — C-55):
- 1. wersja obejmuje **widok listy** zadań (Kanban/Timeline później).
- Zbiorcze usunięcie wymaga jednego **potwierdzenia** (akcja destrukcyjna), reszta akcji działa od
  razu.
- Bez zbiorczej edycji assignee/recurring/tytułu/opisu w 1. wersji (sekcja 5 „poza zakresem").

## 9. Ryzyka
- **Częściowa zmiana przy braku dostępu** → jasne podsumowanie „zmieniono X z N", pozycje bez prawa
  edycji pomijane (AC-10); brak cichych, mylących wyników.
- **Custom statusy per-lista** → lista dostępnych statusów w pasku zbiorczym musi odpowiadać
  konfiguracji danej listy (AC-12), inaczej można ustawić status spoza listy.
- **Wydajność przy dużym N** → operacja zbiorcza powinna być jedną transakcją/round-tripem, nie N
  osobnymi zapisami; ograniczyć re-render listy po zmianie.
- **UX kolizja gestów na mobile** (długie przytrzymanie vs przewijanie/drag&drop kolejności) →
  wyraźny przycisk „Zaznacz" jako pewna alternatywa do gestu.
- **Przypadkowe masowe usunięcie** → mitiguje potwierdzenie + soft-delete/Kosz (odzysk).
