# Spec: Obszary zamiast grup projektów — jedno drzewo porządku w Zadaniach, z migracją danych

- **ID:** 125-obszary-zamiast-grup
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-04
- **Moduł(y):** Tasks

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

W module Zadania współistnieją dziś dwa mechanizmy porządkowania ponad pojedynczym zadaniem:
**grupy projektów** (zapisany zbiór wielu projektów, widok zbiorczy `/tasks/zestaw/…`, zarządzane
od 122 w dropdownie filtra) oraz **obszary** (od 117 — drzewo tematyczne WEWNĄTRZ jednego
projektu). Właściciel odbiera to jako dublowanie pojęć i chce **jednego** mechanizmu: grupy mają
zniknąć całkowicie, ich rolę przejmują obszary — z automatyczną migracją istniejących grup — a
obszary mają być widoczne („wylistowane") na stronie głównej modułu Zadania.

## 2. Cel i miary sukcesu

- Cel: w Zadaniach istnieje jedno pojęcie porządkujące — **obszar** — działające na dwóch
  poziomach jednej logiki: obszar-kategoria grupuje **projekty** (styl Things 3), a wewnątrz
  projektu obszary porządkują **zadania** (117, bez zmian); pojęcie „grupa projektów" nie
  występuje nigdzie w UI ani w danych czynnych.
- Sukces mierzymy:
  - po wdrożeniu każda dotychczasowa grupa użytkownika istnieje jako obszar z tą samą nazwą,
    emoji i kolorem, a jej projekty są do niego przypisane — bez żadnej ręcznej pracy;
  - strona główna Zadań pokazuje sekcję obszarów z licznikami (projekty, aktywne zadania),
    a klik prowadzi do widoku zbiorczego obszaru w ≤1 kliknięcie;
  - w widokach zbiorczych zawężenie do obszaru (wraz z całym poddrzewem) wymaga ≤2 kliknięć;
  - słowo „grupa" (w sensie grup projektów) nie występuje w UI modułu.

## 3. Historyjki użytkownika

- Jako użytkownik chcę przypisać projekt do obszaru (np. „🏠 Dom", „💼 Praca"), żeby projekty
  z jednej dziedziny życia trzymały się razem w nawigacji i w widokach.
- Jako użytkownik chcę wejść w obszar i zobaczyć **wszystkie zadania jego projektów** w jednym
  widoku zbiorczym (dokładnie to, co dawał zapisany zestaw), żeby ogarniać dziedzinę naraz.
- Jako użytkownik chcę na stronie głównej Zadań widzieć listę moich obszarów z licznikami,
  żeby jednym rzutem oka ocenić, gdzie się pali, i wejść tam jednym kliknięciem.
- Jako użytkownik z dotychczasowymi grupami chcę, żeby po aktualizacji moje grupy stały się
  obszarami automatycznie (nazwa/emoji/kolor/projekty zachowane), a stare adresy widoków zestawów
  nadal prowadziły do właściwej treści.
- Jako użytkownik w widoku zbiorczym (Wszystkie/Dziś/…) chcę zawęzić listę **jednym wyborem
  obszaru** — wynik ma objąć zadania z całego poddrzewa wybranego obszaru, aż do liści — żeby nie
  klikać wielu checkboxów.
- Jako użytkownik chcę tworzyć, zmieniać nazwę/emoji/kolor, przenosić projekty między obszarami
  i usuwać obszar (projekty wtedy zostają, tylko tracą przypisanie), żeby porządek nadążał za życiem.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given użytkownik z zapisanymi grupami projektów (w tym projekt należący do kilku
  grup), when wdrożenie z migracją danych się kończy, then każda grupa istnieje jako obszar
  (nazwa, emoji, kolor zachowane), każdy projekt jest przypisany do **dokładnie jednego** obszaru
  (przy konflikcie wygrywa pierwsza grupa wg dotychczasowej kolejności), a żadna grupa nie jest
  widoczna w UI.
- [ ] **AC-2** — Given obszar z projektami, when użytkownik otwiera widok zbiorczy obszaru, then
  widzi zadania wszystkich projektów obszaru (i podobszarów, jeśli są) — funkcjonalnie to, co
  dawał widok zestawu: te same filtry statusów, układy listy i operacje na zadaniach.
- [ ] **AC-3** — Given stary adres widoku zestawu (`/tasks/zestaw/<id>` zapisany np. w ulubionych),
  when użytkownik go otwiera po wdrożeniu, then trafia do widoku zbiorczego obszaru powstałego
  z tej grupy (bez błędu i bez pustego ekranu).
- [ ] **AC-4** — Given strona główna modułu Zadania, when użytkownik ją otwiera, then widzi sekcję
  obszarów: każdy obszar z emoji/nazwą oraz licznikami (projekty, aktywne zadania), klik prowadzi
  do widoku zbiorczego obszaru; projekty bez obszaru są osiągalne jak dotąd (nie znikają).
- [ ] **AC-5** — Given nawigacja boczna modułu, when użytkownik ją przegląda, then zamiast sekcji
  „Grupy" widzi obszary z projektami pod spodem (projekt bez obszaru — w płaskiej liście jak
  dotąd); wejście w obszar i w projekt działa jednym kliknięciem.
- [ ] **AC-6** — Given widok zbiorczy (Wszystkie/Dziś/Nadchodzące/Zaległe), when użytkownik używa
  filtra obszaru (wybór **jednowartościowy**), then lista zawęża się do zadań z wybranego obszaru
  i całego jego poddrzewa (podobszary aż do liści); zdjęcie filtra pokazuje wszystko (zakres nigdy
  nie degraduje do zera); dotychczasowy multiselect po projektach nie występuje.
- [ ] **AC-7** — Given zarządzanie obszarami, when użytkownik tworzy obszar, zmienia nazwę/emoji/
  kolor, przypina/odpina projekt albo usuwa obszar, then zmiany są widoczne natychmiast w nawigacji
  i na stronie głównej; usunięcie obszaru wymaga potwierdzenia i **nie usuwa projektów ani zadań**
  (tracą tylko przypisanie); wybór „usuń" jest oznaczony jako destrukcyjny.
- [ ] **AC-8** — Given dane grup po migracji, when patrzymy na bazę, then dane grup nie są
  bezpowrotnie skasowane w tym samym kroku, w którym powstają obszary (bezpieczne wycofanie —
  szczegół należy do planu); ponowne uruchomienie migracji nie duplikuje obszarów.
- [ ] **AC-9** — Given obszary wewnątrz projektu (117), when całość zmian wchodzi, then drzewo
  obszarów w projekcie, widoki „wg obszarów", drill-down i panel boczny działają bez zmian.
- [ ] **AC-10** — Given całość zmian, when uruchamiany jest `npm run build` (do kroku `next build`),
  then przechodzi bez błędów; e2e obszaru zmiany (widoki zbiorcze, stare adresy zestawów) zielone.

## 5. Zakres

**W zakresie:**
- Obszar jako kategoria projektów na poziomie przestrzeni (możliwe zagnieżdżanie obszar-w-obszarze;
  projekt należy do najwyżej jednego obszaru), z pełnym zarządzaniem (utwórz/edytuj/przypnij/usuń).
- Widok zbiorczy obszaru (następca widoku zestawu) + przekierowanie starych adresów zestawów.
- Migracja danych: grupy → obszary (nazwa/emoji/kolor/projekty; konflikt: pierwsza grupa wygrywa),
  idempotentna, bez natychmiastowego kasowania danych źródłowych.
- Sekcja obszarów na stronie głównej Zadań z licznikami.
- Nawigacja boczna: sekcja obszarów zamiast sekcji grup.
- Filtr widoków zbiorczych: jednowartościowy wybór obszaru z semantyką poddrzewa — w miejsce
  multiselect po projektach i zapisu zestawów.

**Poza zakresem (świadomie):**
- Zmiany w obszarach WEWNĄTRZ projektu (117) — model, widoki i akcje zostają nietknięte; łączenie
  obu poziomów w jedno fizyczne drzewo danych to decyzja planu, ale zachowanie 117 ma pozostać.
- Współdzielenie obszaru per zasób (role viewer/editor…) — obszar dziedziczy widoczność z projektów.
- Wpięcie obszarów w asystenta AI (nowe akcje/read-toole) — osobne zgłoszenie, jeśli zajdzie potrzeba.
- Kolorowanie/ikonografia ponad to, co miały grupy (emoji + kolor znacznika).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — istniejące `module.tasks`; żadnej nowej trasy poza modułem.
- **Własność danych:** obszar-kategoria żyje w przestrzeni (workspace), jak dotychczasowe grupy —
  bez nowego nośnika własności.
- **Asystent AI:** bez nowych akcji/read-tooli (patrz „poza zakresem"); **ale** istniejąca akcja
  asystenta tworząca grupę projektów musi zniknąć razem z grupami (inaczej asystent tworzyłby byt,
  którego UI już nie zna) — to porządek po usuwanym mechanizmie, nie nowa funkcja. *(Dopisek na
  etapie planu, C-54: wykryto akcję `create_project_group` w katalogu asystenta.)*
- **Kalendarz / powiadomienia:** nie dotyczy.
- **Trash / kosz:** usunięcie obszaru-kategorii to operacja odwracalna w sensie danych zadań
  (nic poza przypisaniem nie ginie) — potwierdzenie destrukcyjne wystarcza; snapshot do kosza
  wg wzorca modułu, jeśli plan uzna to za spójne z resztą (grupy dziś do kosza nie trafiają).

## 7. Zgodność z konstytucją

- **C-10/C-11/C-15** — migracja danych (grupy → obszary) jako ręczny, idempotentny plik SQL
  z numerem z `npm run next:migration`; bez kasowania źródła w tym samym kroku (AC-8).
- **C-12** — żadnych enumów Prisma; ewentualne rodzaje jako `String` + union TS.
- **C-20/C-21** — mutacje jako Server Actions z `revalidatePath`; dostęp przez istniejące wzorce
  własności przestrzeni (`filtrMoichRekordow` itd.).
- **C-30/C-31/C-32** — tokeny motywu, mobile-first (sidebar/tab bar bez drugiego sidebara),
  teksty przez `t()` do `pl.json`.
- **C-33** — widok zbiorczy obszaru deklaruje się przez `ModuleView` (wpis w manifeście
  ui-contract, jeśli dojdzie trasa).
- **C-34** — usunięcie obszaru przez `confirmDialog({ destructive: true })`.
- **C-53** — minimalizm: netto jedno pojęcie zamiast dwóch; bez nowych zależności.
- **C-54** — spójność artefaktów przy odkryciach w trakcie (zwł. wokół modelu drzewa).
- **C-50/C-52/C-52a** — build do `next build` lokalnie; merge `develop`, promocja `master` ff-only.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jedynym momencie pytań (C-55), 2026-09-04:

- [x] **Model docelowy: obszar = kategoria projektów, 1:N** (styl Things 3; wybór właściciela).
  Obszary wewnątrz projektu (117) zostają bez zmian.
- [x] **Migracja: „pierwsza grupa wygrywa"** — projekt należący do kilku grup trafia do obszaru
  z pierwszej grupy wg kolejności; pozostałe obszary powstają bez niego (wybór właściciela).
- [x] **Strona główna: sekcja Obszary z licznikami** (wybór właściciela).
- [x] **Filtr widoków zbiorczych: jednowartościowy wybór obszaru** (odpowiedź własna właściciela):
  „w wynikach powinny się pojawić wszystkie zadania z wybranego obszaru i jego podobszarów itd.
  do liści" — czyli semantyka **poddrzewa**; zapis zestawów znika razem z grupami, multiselect po
  projektach zastąpiony tym filtrem.

Założenia przyjęte domyślnie (rekomendowane, bez osobnego pytania):
- Odpowiedź właściciela o „podobszarach do liści" implikuje, że obszary-kategorie **mogą się
  zagnieżdżać** (obszar w obszarze) — dopuszczamy drzewo także na poziomie kategorii; filtr
  i widok zbiorczy liczą zakres z całego poddrzewa (obszary zagnieżdżone + projekty + ich zadania).
- Stare adresy `/tasks/zestaw/<id>` przekierowują trwale do widoku obszaru powstałego z migracji
  tej grupy; adres nieistniejącej grupy zachowuje dotychczasowe zachowanie „nie znaleziono".
- Projekty bez obszaru pozostają w płaskiej liście „Projekty" (sidebar) i w dotychczasowych
  miejscach — obszar jest opcjonalny, niczego nie wymusza.
- Sekcja obszarów na stronie głównej: przy ≥1 obszarze lista z licznikami; przy 0 — zwięzła
  zachęta z przyciskiem utworzenia pierwszego obszaru (wzorzec sekcji „Projekty" obok). *(Korekta
  C-54 na implementacji: całkowite ukrycie sekcji nie zostawiałoby żadnej ścieżki utworzenia
  PIERWSZEGO obszaru najwyższego poziomu — dropdown tworzy tylko pod-obszary istniejących.)*

## 9. Ryzyka

- **Dwa poziomy obszarów (kategorie projektów vs obszary w projekcie) mogą się mylić w UI** →
  nazewnictwo i miejsca użycia rozdzielone (sidebar/strona główna = kategorie; wnętrze projektu =
  117); plan ma jawnie rozstrzygnąć, czy to jeden byt danych, czy dwa — bez zmiany zachowań 117 (AC-9).
- **Migracja danych użytkowników** → idempotentna, bez kasowania źródła w tym samym kroku,
  weryfikowana na lokalnym Postgresie z danymi przypominającymi produkcyjne (AC-1, AC-8).
- **Utrata funkcji zapisanych zestawów** (multiselect + zapis) → świadoma decyzja właściciela;
  przekierowania starych adresów chronią ulubione widoki (AC-3).
- **Regres widoków zbiorczych** (filtry, liczniki, skróty) → AC-6 + e2e widoków zbiorczych.
- **Bramki** (ui-contract przy nowej trasie, i18n, pagination) → budujemy do `next build` przed
  merge (AC-10).
