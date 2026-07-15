# Spec: Filtry w widokach Kanban/Timeline + kompaktowy pasek „Dostosuj pulpit”

- **ID:** 001-filtry-widokow-i-pasek-pulpitu
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-15
- **Moduł(y):** Tasks (Zadania) · Home (pulpit)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

> **Uwaga — pakiet dwóch niezależnych poprawek.** Właściciel dostarczył dwie drobne, niepowiązane ze
> sobą sprawy w jednej paczce: (A) błąd filtrowania w widokach Zadań, (B) poprawka UX paska
> „Dostosuj pulpit”. Trzymamy je w jednym specie (minimalizm — C-53), ale z osobnymi kryteriami
> akceptacji. Można je planować/wdrażać i weryfikować rozłącznie.

## 1. Problem / potrzeba

**A. Filtry nie działają w Kanbanie i na Timeline.** W dziale Zadania nad listą jest pasek filtrów
(zakładki statusów „Wszystkie / Do zrobienia / …” + wybór tagów). Działa on wyłącznie w układzie
**Lista**. Po przełączeniu na **Kanban** lub **Timeline** pasek nadal jest widoczny, ale nie robi nic:
zaznaczenie tagu nie zawęża zadań, a przełączanie zakładek statusu „nic nie zmienia”. Użytkownik
widzi kontrolki, które go okłamują — to realny błąd, nie tylko brak funkcji.

**B. Pasek „Dostosuj pulpit” marnuje przestrzeń pionową.** Na stronie głównej (`/`, sekcja powitania
„Dobry wieczór, Szymon!”) przycisk „Dostosuj pulpit” siedzi w **osobnej, pełnej linijce** dedykowanej
tylko jemu, między banerem zaproszeń a sekcjami pulpitu. Zajmuje cenne miejsce nad „fałdą” (above the
fold) na coś, co jest używane rzadko. Potrzebny lepszy UX, który nie kradnie pionu.

## 2. Cel i miary sukcesu

- **Cel A:** filtry (zakładki statusu **oraz** tagi) działają spójnie we wszystkich trzech układach
  Zadań — Lista, Kanban, Timeline.
  **Sukces mierzymy:** dla tego samego zestawu filtrów zbiór widocznych zadań jest identyczny między
  układami; zaznaczenie tagu w Kanbanie/Timeline natychmiast zawęża widok; żadna widoczna kontrolka
  filtra nie jest „martwa”.
- **Cel B:** wejście w personalizację pulpitu przestaje zajmować osobną linijkę.
  **Sukces mierzymy:** w trybie normalnym kontrolka „Dostosuj pulpit” nie zajmuje własnego, pełnego
  wiersza (odzyskana przestrzeń pionowa nad fałdą), przy zachowaniu 100% dotychczasowej funkcji
  edycji układu.

## 3. Historyjki użytkownika

- Jako użytkownik Zadań chcę, aby po zaznaczeniu tagu w widoku Kanban/Timeline lista zadań się
  zawęziła, żebym widział tylko to, co mnie interesuje — tak samo jak w widoku Lista.
- Jako użytkownik Zadań chcę, aby przełączanie zakładek statusu dawało widoczny efekt w każdym
  układzie, żeby kontrolki nie wprowadzały w błąd.
- Jako użytkownik pulpitu chcę więcej treści widocznej od razu po wejściu na stronę główną, żeby nie
  tracić miejsca na rzadko klikany przycisk personalizacji.
- Jako użytkownik pulpitu chcę nadal móc zmieniać kolejność i widoczność sekcji, żeby personalizacja
  nie zniknęła przy okazji porządków w UI.

## 4. Kryteria akceptacji (testowalne)

Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.

**A. Filtry w Kanbanie i na Timeline**

- [ ] **AC-1** — Given widok **Kanban** z zadaniami mającymi różne tagi, when użytkownik zaznaczy tag
  w pasku filtrów, then na tablicy pozostają wyłącznie zadania z tym tagiem; odznaczenie tagu
  przywraca pełny zestaw.
- [ ] **AC-2** — Given widok **Timeline**, when użytkownik zaznaczy jeden lub więcej tagów, then oś
  czasu pokazuje tylko zadania spełniające **wszystkie** zaznaczone tagi (zgodnie z semantyką filtra
  tagów w widoku Lista).
- [ ] **AC-3** — Given widok **Kanban** lub **Timeline** i wybrana zakładka statusu inna niż
  „Wszystkie”, when użytkownik przełącza zakładki, then zawartość widoku zmienia się w obserwowalny
  sposób zgodnie z wybranym statusem (koniec stanu „przełączam i nic się nie dzieje”).
  *(Dokładna semantyka zakładek statusu w Kanbanie — patrz decyzja właściciela Q1 w sekcji 8.)*
- [ ] **AC-4** — Given ten sam zestaw filtrów (zakładka + tagi + ewentualne wyszukiwanie), when
  użytkownik przełącza układ Lista ↔ Kanban ↔ Timeline, then zbiór widocznych zadań jest **spójny**
  między układami — różni się wyłącznie sposób prezentacji, nie zawartość.
- [ ] **AC-5** — Given aktywne wyszukiwanie tekstowe lub AI, when użytkownik jest w Kanbanie/Timeline,
  then wyszukiwanie nadal działa i łączy się z filtrami (brak regresji istniejącego zachowania).

**B. Kompaktowy pasek „Dostosuj pulpit”**

- [ ] **AC-6** — Given pulpit w trybie normalnym (nie-edycja), when użytkownik patrzy na górę strony,
  then kontrolka „Dostosuj pulpit” **nie zajmuje osobnego, pełnego wiersza** przeznaczonego tylko dla
  niej (mierzalna redukcja marnowanej przestrzeni pionowej względem stanu obecnego).
- [ ] **AC-7** — Given nowa forma kontrolki, when użytkownik jej użyje, then może wejść w tryb edycji
  układu pulpitu i z niego wyjść, a pełna dotychczasowa funkcjonalność (zmiana kolejności sekcji,
  ukrywanie/pokazywanie, zapis preferencji per-użytkownik) działa bez zmian.
- [ ] **AC-8** — Given tryb edycji układu, when jest aktywny, then jest wyraźnie odróżnialny od trybu
  normalnego i ma jednoznaczny sposób zakończenia (odpowiednik „Gotowe”).
- [ ] **AC-9** — Given widok mobilny, when użytkownik otwiera pulpit, then kontrolka jest dostępna i
  klikalna z zachowaniem minimalnego celu dotyku (C-31), bez psucia układu powitania.
- [ ] **AC-10** — Given różne skórki (skiny), when kontrolka się renderuje, then korzysta ze zmiennych
  CSS (bez hardkodowanych kolorów) — zgodnie z C-30.

## 5. Zakres

**W zakresie:**
- Doprowadzenie filtra statusu (zakładki) i filtra tagów do działania w układach Kanban i Timeline,
  spójnie z widokiem Lista.
- Zmiana sposobu prezentacji wejścia w personalizację pulpitu tak, by nie zajmowało dedykowanej,
  pełnej linijki — przy zachowaniu całej funkcji edycji.

**Poza zakresem (świadomie):**
- Nowe rodzaje filtrów (np. po priorytecie, projekcie, terminie) czy zapisywane presety filtrów.
- Przeprojektowanie samego trybu edycji sekcji (strzałki góra/dół, ukrywanie) poza tym, co konieczne
  do przeniesienia wejścia w edycję.
- Zmiana zestawu sekcji pulpitu lub logiki `dashboardPrefs` (kolejność/widoczność zapisywane po
  staremu).
- Zmiany w drag&drop Kanbana, w renderowaniu kart czy w osi czasu poza filtrowaniem wejściowego
  zbioru zadań.
- Jakiekolwiek zmiany schematu bazy danych.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — istniejące `module.tasks` (A) i `module.home` (B). Brak nowego
  slugu (C-22 nie dotyczy).
- **Własność danych:** brak nowego modelu ani zmiany własności. (A) to logika prezentacji po stronie
  klienta na już pobranych, autoryzowanych zadaniach; (B) korzysta z istniejącej personalizacji
  `dashboardPrefs` (per-użytkownik) bez zmian w jej kształcie. C-21 bez wpływu.
- **Asystent AI:** nie dotyczy — brak nowej `AIAction` ani read-toola (C-23 bez wpływu).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — kluczowa: najmniejsza możliwa zmiana. (A) to doprowadzenie już istniejącego
  filtrowania do dwóch pozostałych układów; (B) to zmiana rozmieszczenia jednej kontrolki. Bez nowych
  abstrakcji, zależności i „przy okazji” refaktorów.
- **C-30 (motyw przez zmienne CSS)** — nowa/przeniesiona kontrolka i ewentualne poprawki widoków
  używają `var(--…)`, bez hardkodowanych hexów; tekst na akcentach = `var(--on-accent)`.
- **C-31 (mobile-first / keyboard-first)** — zachować działanie na mobile (min. cel dotyku) oraz
  istniejące skróty klawiaturowe filtrów (`1–5` przełącza zakładki) — po poprawce mają realnie
  wpływać na Kanban/Timeline.
- **C-32 (UI po polsku)** — wszelkie teksty pozostają po polsku.
- **C-20 (mutacje = Server Actions + `revalidatePath`)** — o ile w ogóle dotknięte: personalizacja
  pulpitu już idzie przez istniejącą Server Action; nie dokładamy ręcznej inwalidacji.
- **C-50 (definicja „gotowe”: `npm run build` zielony)** oraz **C-51** — dla części (A), będącej
  naprawą błędu, dopisujemy wpis do `doświadczenia.md`.
- **C-10..C-14 (migracje)** — nie dotyczą (brak zmian w schemacie).

## 8. Otwarte pytania / decyzje właściciela

- [ ] **Q1 — Semantyka zakładek statusu w widoku Kanban.** Kanban już z natury grupuje zadania po
  statusie (kolumny). Jak mają zachować się zakładki statusu w tym układzie?
  - (a) Filtrują tablicę do jednej kolumny wybranego statusu (spójne z Listą).
  - (b) W Kanbanie zakładki statusu są ukryte/wyłączone (skoro Kanban i tak pokazuje statusy jako
    kolumny), a filtruje wyłącznie tag + wyszukiwanie.
  **Rekomendacja:** (b) w Kanbanie (usuwa mylące „nic nie robi” u źródła i unika Kanbana z jedną
  kolumną), przy czym w Timeline zakładki statusu działają normalnie jak w Liście. Filtr tagów działa
  w obu układach niezależnie od tej decyzji. *Decyzja nie blokuje planu — domyślnie przyjmiemy
  rekomendację (b), jeśli właściciel nie wskaże inaczej.*
- [ ] **Q2 — Docelowe umiejscowienie wejścia w personalizację pulpitu.** Właściciel prosił „wymyśl
  lepszy UX”, więc konkret zostawiamy na `/plan`. Kierunki do rozważenia: mała ikonka w wierszu
  powitania (obok nagłówka), pozycja w istniejącej stopce linków, lub kontrolka pojawiająca się przy
  najechaniu/kompaktowa. **Rekomendacja:** ikonka „suwaki” w wierszu powitania (zero dodatkowego
  wiersza). *Decyzja projektowa — nie blokuje speca.*

## 9. Ryzyka

- **Rozjazd liczników vs. widok (A).** Liczniki na zakładkach statusu liczą po pełnym zbiorze zadań;
  po włączeniu filtrów w Kanbanie/Timeline trzeba uważać, by liczniki i realnie pokazywany zbiór się
  nie „kłóciły” w odbiorze. → Zaadresować w planie (spójna definicja zbioru wejściowego per układ).
- **Regresja wyszukiwania (A).** Wyszukiwanie tekstowe/AI już działa w Kanbanie/Timeline; łącząc je z
  filtrami nie wolno go zepsuć. → AC-5 pilnuje braku regresji.
- **Utrata personalizacji (B).** Przy zmianie rozmieszczenia kontrolki łatwo przypadkiem odciąć wejście
  w edycję na mobile lub zgubić stan „Gotowe”. → AC-7..AC-9 pilnują pełnej funkcji i dostępności.
- **Skinowalność (B).** Nowe rozmieszczenie nie może wprowadzić hardkodowanych kolorów. → AC-10.
