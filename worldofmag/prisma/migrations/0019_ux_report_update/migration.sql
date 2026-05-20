-- Update ux-analysis report with detailed per-module analysis
UPDATE "Report" SET
  "title" = 'Analiza UX modułów — szczegółowy przegląd',
  "category" = 'ux',
  "updatedAt" = NOW(),
  "content" = $report_content$
# Analiza UX modułów — szczegółowy przegląd

> Raport powstał na podstawie analizy kodu źródłowego aplikacji WorldOfMag. Opisuje konkretne problemy UX, niespójności i brakujące funkcjonalności w każdym module, wraz z propozycjami zmian.

---

## Moduł Zakupy (Shopping)

### Co działa dobrze
- Inline tworzenie listy zakupów na stronie głównej — pole tekstowe z Enter/Escape
- Cykl statusów elementów: NEEDED → IN_CART → DONE (klik lub klawisz `Space`/`x`)
- 3 tryby sortowania: kategoria, produkt, mapa sklepu
- Wyszukiwanie po nazwie, kategorii i notatkach
- 5 kart filtrowania statusów (ALL/NEEDED/IN_CART/DONE/MISSING) + skróty `1–5`
- Klawiatura: `j/k` nawigacja, `e` edycja, `d/Delete` usunięcie, `Ctrl+K` paleta
- Mapa sklepu z optymalną trasą (algorytm grafowy)

### Problemy i niespójności

**1. Tworzenie listy z palety komend używa natywnego `prompt()` przeglądarki**
- Plik: `src/components/command-palette/CommandPalette.tsx:97`
- `const name = prompt("List name:")` — natywne okno dialogowe przeglądarki
- Na iOS Safari wygląda jak systemowy alert, całkowicie poza stylem aplikacji
- Brak walidacji, brak placeholder, brak anulowania przez Escape (blokuje stronę)
- Strona główna Shopping ma prawidłowe inline-pole — niespójność

**2. Brak widocznego przycisku "Wyczyść zakończone"**
- `clearDoneItems()` istnieje w akcjach, ale dostępna tylko przez `Ctrl+K` → paleta
- Użytkownik mobilny nigdy tego nie znajdzie — brak `Ctrl+K` na telefonie
- Propozycja: przycisk w headerze listy, widoczny gdy `counts.DONE > 0`

**3. Brak archiwizacji / zamknięcia listy zakupów**
- Po zakończeniu zakupów brak opcji "Zakończ zakupy" — lista pozostaje z elementami DONE
- Jedyne wyjście: ręczne usunięcie listy (niszczy historię) lub zostawienie bałaganu
- Propozycja: przycisk "Zakończ zakupy" → przenieś do archiwum, wyczyść statusy

**4. Statystyki listy ukryte na mobile**
- `src/components/shopping/ShoppingPage.tsx:174`: `<span className="hidden sm:block">`
- Użytkownik mobilny nie widzi ile pozycji jest NEEDED/IN_CART/DONE
- Propozycja: pokazać najważniejszą statystykę (np. ile NEEDED) pod nazwą listy lub w FilterTabs

**5. Brak drag-and-drop do ręcznego sortowania**
- Kolejność elementów jest wyłącznie automatyczna (kategoria/produkt/mapa)
- Użytkownik nie może ręcznie przeorganizować kolejności
- Propozycja: opcjonalny tryb ręcznego sortowania z drag-and-drop (biblioteka `@dnd-kit`)

**6. Brak globalnego widoku "wszystkie listy naraz"**
- Nie ma widoku pokazującego elementy ze wszystkich list równocześnie
- Przydatne gdy rodzina ma kilka list aktywnych jednocześnie

### Propozycje priorytetowe
1. ✅ Zastąpić `prompt()` inline inputem w palecie komend ← **zaimplementowane w tej sesji**
2. ✅ Dodać widoczny przycisk "Wyczyść zakończone" ← **zaimplementowane w tej sesji**
3. Archiwizacja listy po zakończeniu zakupów
4. Statystyki na mobile

---

## Moduł Zadania (Tasks)

### Co działa dobrze
- Widok "Dziś" z zadaniami na bieżący dzień
- Szybkie dodawanie zadania (`a`/`n`) z inline priorytetem i datą
- 5 priorytetów (brak, niski, normalny, wysoki, krytyczny)
- Tagi na zadaniach z filtrowaniem
- Zadania cykliczne z różnymi wzorcami (dziennie/tygodniowo/miesięcznie)
- Panel szczegółów zadania z edycją wszystkich pól
- AI-wyszukiwanie semantyczne przez LLM
- Komentarze do zadań

### Problemy i niespójności

**1. Usunięcie zadania klawiszem `d` bez potwierdzenia**
- Plik: `src/components/tasks/TasksPage.tsx:137`
- `await deleteTask(focusedTaskId)` — bezpośrednie usunięcie bez żadnego confirm
- Projekty mają confirm (`TasksSideNav.tsx:76`), ale zadania z klawiatury — nie
- Propozycja: dodać `confirm("Usunąć zadanie?")` ← **zaimplementowane w tej sesji**

**2. Brak skonsolidowanego widoku "wszystkie projekty"**
- Można przeglądać tylko jeden projekt naraz
- Widok "Wszystkie" nie istnieje — brak przeglądu zadań z różnych projektów w jednym miejscu
- W mobilnym select nawet nie ma opcji "wszystkie projekty"
- Propozycja: widok `/tasks/all` grupujący zadania po projektach

**3. Data zadania edytowalna tylko w panelu szczegółów**
- Zmiana terminu wymaga otwarcia panelu bocznego — 2 kliknięcia minimum
- Brak inline-edycji daty bezpośrednio w wierszu zadania
- Propozycja: klik na datę w wierszu otwiera mini datepicker inline

**4. Zadania cykliczne — słaba widoczność wzorca**
- Badge "🔄" w wierszu zadania nie informuje o szczegółach wzorca
- Nie wiadomo kiedy jest następne wystąpienie bez otwierania panelu
- Propozycja: tooltip lub rozwinięcie z detalami wzorca cyklicznego

**5. Brak "skupionego" widoku na projekt bez listy projektów w sidebar**
- Na mobile cały czas widoczny jest dropdown projektów zajmując miejsce
- Brak trybu "full screen" na listę zadań bez nawigacji

### Propozycje priorytetowe
1. ✅ Potwierdzenie usunięcia klawiszem ← **zaimplementowane w tej sesji**
2. Widok "wszystkie projekty" z grupowaniem
3. Inline-edycja daty w wierszu zadania

---

## Moduł Notatki (Notes)

### Co działa dobrze
- Podświetlanie wyników wyszukiwania w tytule i podglądzie treści
- AI auto-sugestia grupy podczas edycji
- AI sugestie tagów
- AI przepisywanie treści (popraw/przeredaguj/do Markdown)
- Dyktowanie głosowe treści notatki
- Edytowanie głosem ("Powiedz co zmienić")
- Filtrowanie po tagach, grupach, statusie
- Przypinanie notatek

### Problemy i niespójności

**1. Usunięcie notatki bez ŻADNEGO potwierdzenia [KRYTYCZNY]**
- Plik: `src/components/notes/NoteRow.tsx:136`
- `startTransition(() => { deleteNote(note.id); })` — bezpośrednie usunięcie
- Kliknięcie ikony kosza lub wciśnięcie `d` usuwa notatkę natychmiast, bez żadnego pytania
- W przeciwieństwie do list zakupów i projektów zadań, które mają `confirm()`
- Plik: `src/components/notes/NotesPage.tsx:89` — klawisz `d` też nie pyta
- ← **Naprawione w tej sesji**: dodano potwierdzenie

**2. Brak widoku siatkowego (grid)**
- Notatki wyświetlane wyłącznie jako wąska lista z tytułem + fragment treści
- Popularne aplikacje (Notion, Keep, Bear) oferują przełącznik lista/siatka
- Grid 2–3 kolumn lepiej wykorzystuje przestrzeń na szerokich ekranach
- ← **Zaimplementowane w tej sesji**: przycisk toggle Lista/Siatka w headerze

**3. Brak eksportu notatek**
- Nie ma żadnej opcji eksportu do `.md`, `.txt` ani schowka
- Nawet notatki z flagą "isMarkdown" nie można szybko skopiować jako pliku
- ← **Zaimplementowane w tej sesji**: przycisk eksportu do `.md` w akcjach notatki

**4. Brak podglądu Markdown w czasie edycji**
- Notatki można oznaczyć jako Markdown, ale podczas edycji widoczny jest surowy tekst
- Brak trybu "podgląd na żywo" ani split-view editor/preview
- Propozycja: toggle "Podgląd MD" w trybie edycji

**5. AI sugestia grupy — tylko jednorazowa**
- Sugestia grupy pojawia się raz (po wpisaniu treści), ale znika po odrzuceniu
- Brak możliwości ponownego wywołania sugestii bez edycji treści

**6. Brak wyszukiwania w treści z podświetlaniem kontekstu**
- Wyszukiwanie filtruje notatki zawierające frazę, ale w wynikach widać tylko 120 znaków treści
- Dopasowanie może być głęboko w środku notatki i nie być widoczne w podglądzie
- Propozycja: wyciągnąć fragment tekstu z okolicą dopasowania zamiast początku treści

### Propozycje priorytetowe
1. ✅ Potwierdzenie usunięcia ← **zaimplementowane w tej sesji**
2. ✅ Grid/list toggle ← **zaimplementowane w tej sesji**
3. ✅ Eksport do Markdown ← **zaimplementowane w tej sesji**
4. Podgląd Markdown w czasie edycji
5. Kontekstowy fragment w wynikach wyszukiwania

---

## Nawigacja i Shell

### Co działa dobrze
- Responsywna nawigacja boczna ukryta na mobile
- Hamburger menu z overlay na mobile
- Pasek górny z aktywnym modułem na mobile
- Bezpieczne obszary (safe area insets) dla iPhone notch/home indicator
- Paleta komend `Ctrl+K` dla zaawansowanych użytkowników
- Skróty klawiszowe we wszystkich modułach

### Problemy i niespójności

**1. Brak dolnej nawigacji (bottom tab bar) na mobile**
- Jedyna nawigacja na mobile: hamburger → slide-out menu → wybór modułu
- Każda zmiana modułu wymaga 2 tknięć + przewinięcia w menu
- Standard mobilny (iOS/Android): bottom navigation bar z 4–5 głównymi modułami
- Propozycja: stały dolny pasek z ikonami Home/Shopping/Tasks/Notes/⋯

**2. Paleta komend tylko w module Zakupy**
- `CommandPalette` jest dostępna (Ctrl+K) tylko wewnątrz ShoppingPage
- Zadania i Notatki mają własne skróty, ale brak globalnej palety
- Propozycja: globalna paleta komend dostępna z każdej strony

**3. Skróty klawiszowe nie są widoczne na mobile**
- Hinty klawiaturowe (`FilterTabs` na desktop) niewidoczne na telefonie
- Użytkownik mobilny nie wie jakie gesty/skróty są dostępne
- Propozycja: "Help" overlay lub ekran pomocy w ustawieniach

**4. Brak breadcrumbs / kontekstu lokalizacji**
- Na głębokich podstronach (np. `/shopping/stores/[storeId]`) brak wskazania gdzie jesteś
- Poza pojedynczym linkiem "wstecz" brak pełnej ścieżki nawigacyjnej

---

## Mechanizmy ogólne — spójność i wzorce

### Niespójne potwierdzenia usunięcia

| Element | Potwierdzenie | Plik |
|---------|--------------|------|
| Lista zakupów | ✅ `confirm()` | `ListDropdown.tsx:52` |
| Projekt zadań | ✅ `confirm()` | `TasksSideNav.tsx:76` |
| Zadanie (przycisk) | ✅ `confirm()` | `TaskDetail.tsx:205` |
| Zadanie (klawisz `d`) | ❌ brak | `TasksPage.tsx:137` |
| Notatka (przycisk) | ❌ brak | `NoteRow.tsx:136` |
| Notatka (klawisz `d`) | ❌ brak | `NotesPage.tsx:89` |

Zasada: **każda destruktywna operacja wymaga potwierdzenia** — niezależnie od metody wywołania.

### Udostępnianie (Team Sharing)

System udostępniania przez teamydziała w warstwie danych (schema, akcje), ale brak wizualnego wskazania w UI:
- Nie widać które zasoby należą do teamu a które są prywatne
- Brak ikony/badge'a "team" na liście zakupów, projekcie, notatce
- Brak UI do zmiany właściciela zasobu (prywatny → team)
- Propozycja: badge z nazwą teamu przy każdym zasobie teamowym

### Słowniki (kategorie, jednostki)

System 3-poziomowy (system/user/team) istnieje w warstwie akcji i komponentu `CategoryManager`, ale:
- Brak analogicznego UI dla jednostek (Units) — `UnitManager` nie ma sekcji teamowych
- Panel admina nie ma wizualnej różnicy między kategoriami systemowymi a innymi
- Propozycja: ujednolicić UX zarządzania słownikami we wszystkich miejscach

### Obsługa błędów

- Błędy serwera (Server Actions) rzucają wyjątki, ale brak globalnego error boundary
- Użytkownik widzi białą stronę zamiast przyjaznego komunikatu błędu
- Propozycja: globalny `error.tsx` w Next.js App Router + toast notifications

### Brak systemu powiadomień (toasts)

- Operacje wykonują się cicho — brak potwierdzenia "Notatka zapisana" / "Zadanie usunięte"
- Jedynym feedbackiem jest zmiana UI (lub brak zmiany jeśli coś pójdzie nie tak)
- Propozycja: minimalistyczne toast notifications dla kluczowych operacji

$report_content$
WHERE "slug" = 'ux-analysis';

-- Insert session-2 changes summary report
INSERT INTO "Report" ("id", "title", "slug", "category", "content", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Zmiany sesji 2 — poprawki UX i raport analityczny',
  'session-2-ux-fixes',
  'architecture',
  $session_content$
# Zmiany sesji 2 — poprawki UX i raport analityczny

> Podsumowanie zmian wdrożonych w drugiej sesji implementacyjnej WorldOfMag. Sesja skupiała się na poprawkach UX, spójności interfejsu i uzupełnieniu brakującej dokumentacji analitycznej.

---

## Zrealizowane zmiany

### 1. Potwierdzenia usunięcia (Notatki + Zadania)

**Problem:** Notatki nie miały żadnego potwierdzenia przed usunięciem. Kliknięcie ikony kosza lub naciśnięcie `d` natychmiast usuwało notatkę. To samo dotyczyło usuwania zadań klawiszem `d`.

**Rozwiązanie:**
- `NoteRow.tsx` — dodano `confirm()` przed usunięciem przez przycisk
- `NotesPage.tsx` — dodano `confirm()` przed usunięciem przez klawisz `d`
- `TasksPage.tsx` — dodano `confirm()` przed usunięciem zadania przez klawisz `d`

### 2. Przycisk "Wyczyść zakończone" w Shopping UI

**Problem:** Funkcja `clearDoneItems()` istniała w akcjach, ale była dostępna wyłącznie przez paletę komend (`Ctrl+K`). Użytkownik mobilny nie miał dostępu do tej funkcji.

**Rozwiązanie:**
- `ShoppingPage.tsx` — dodano widoczny przycisk w headerze listy, wyświetlany warunkowo gdy `counts.DONE > 0`
- Przycisk widoczny na mobile i desktop

### 3. Zastąpienie `prompt()` w palecie komend

**Problem:** Tworzenie nowej listy zakupów z palety komend (`Ctrl+K` → "New shopping list") używało natywnego `window.prompt()` — systemowego okna dialogowego przeglądarki, całkowicie poza stylem aplikacji.

**Rozwiązanie:**
- `CommandPalette.tsx` — zastąpiono `prompt()` wbudowanym inputem wyświetlanym w obrębie palety
- Po wybraniu opcji "Nowa lista zakupów" pojawia się pole tekstowe z Enter/Escape
- Spójne z resztą UI aplikacji

### 4. Grid/list toggle dla notatek

**Problem:** Notatki wyświetlane były wyłącznie jako lista. Brak alternatywnego widoku.

**Rozwiązanie:**
- `NotesPage.tsx` — dodano przycisk toggle Lista/Siatka (ikony `List`/`LayoutGrid`) w headerze
- Tryb grid: 2–3 kolumny kart (responsywne) z tytułem, fragmentem treści i tagami
- Stan persystowany w `localStorage` między sesjami

### 5. Eksport notatki do Markdown

**Problem:** Brak możliwości wyeksportowania notatki — nawet notatki oznaczone jako Markdown nie można było pobrać.

**Rozwiązanie:**
- `NoteRow.tsx` — dodano przycisk eksportu (ikona `Download`) w akcjach notatki (gdy fokus)
- Kliknięcie tworzy plik `.md` z tytułem i treścią, pobierany przez przeglądarkę

### 6. Aktualizacja raportu UX

**Problem:** Raport `ux-analysis` w bazie danych zawierał ogólnikowy szkielet z punktów planowania, nie rzeczywistą analizę kodu.

**Rozwiązanie:**
- Migracja `0019_ux_report_update` — nadpisanie treści raportu szczegółową analizą na podstawie faktycznego kodu
- Raport zawiera: konkretne pliki i linie kodu z problemami, tabelę niespójności, propozycje priorytetowe per moduł

---

## Stan po sesji 2

| Zmiana | Status |
|--------|--------|
| Potwierdzenie usunięcia notatki (przycisk) | ✅ Wdrożone |
| Potwierdzenie usunięcia notatki (klawisz d) | ✅ Wdrożone |
| Potwierdzenie usunięcia zadania (klawisz d) | ✅ Wdrożone |
| Przycisk "Wyczyść zakończone" w Shopping | ✅ Wdrożone |
| Zastąpienie prompt() w CommandPalette | ✅ Wdrożone |
| Grid/list toggle dla notatek | ✅ Wdrożone |
| Eksport notatki do .md | ✅ Wdrożone |
| Szczegółowy raport UX modułów | ✅ Wdrożone |

## Pozostałe do wdrożenia (z raportu UX)

- Archiwizacja listy zakupów po zakończeniu
- Dolna nawigacja (bottom tab bar) na mobile
- Skonsolidowany widok "wszystkie projekty" w Tasks
- Inline-edycja daty zadania w wierszu
- Podgląd Markdown w czasie edycji notatki
- Kontekstowy fragment tekstu w wynikach wyszukiwania notatek
- Toast notifications dla kluczowych operacji
- Team badge na zasobach teamowych w UI
$session_content$,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "content" = EXCLUDED."content",
  "updatedAt" = NOW();
