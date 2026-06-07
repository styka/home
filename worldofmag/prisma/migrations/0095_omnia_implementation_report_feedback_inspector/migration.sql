-- Raport implementacyjny: admiński „tryb wskazywania" do zgłaszania błędów/sugestii.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-07',
  'omnia-implementacja-2026-06-07',
  $omnia_feedback_inspector$# Omnia — Raport implementacji 2026-06-07

Sesja realizuje jedno zgłoszenie: admin ma móc w wyjątkowo łatwy sposób zgłosić
błąd lub sugestię dotyczącą konkretnego miejsca w aplikacji. Po włączeniu „trybu
wskazywania" klik w dowolny element UI rozpoznaje to miejsce, otwiera asystenta
(magiczną ikonę) z gotowym kontekstem i z opisu admina tworzy zadanie w projekcie
**Omnia** (z tytułem wygenerowanym przez AI), zatwierdzane w znanym `ActionDrawer`.

---

## Admiński tryb wskazywania do zgłaszania błędów i sugestii
**Diagnoza:** Brakowało szybkiej ścieżki „zauważyłem coś tutaj → zgłoś". Wymaganie:
(1) tryb tylko dla admina, włączany łatwo; (2) klik w miejsce rozpoznaje kontekst
(dział/podstrona/komponent); (3) otwiera się chat z tym kontekstem w rozmowie;
(4) admin jest poinformowany, co trafiło do kontekstu, i proszony o opis; (5) po
opisie chat wywołuje `ActionDrawer` z akcją utworzenia zadania w projekcie „Omnia",
gdzie description = opis admina, a tytuł generowany jest z opisu. Całość ma być
maksymalnie wygodna UX-owo, mimo że to funkcja wyłącznie dla admina.

**Rozwiązanie:** Świadomie reużyto istniejącego potoku asystenta (agent → krok
`plan` → `ActionDrawer` → `execute`), zamiast budować osobną ścieżkę — akcja
`create_task` z `projectName: "Omnia"` już istniała i była obsługiwana przez
executor, więc całe „tworzenie zadania" sprowadziło się do dobrze sformułowanego
promptu. Aktywacja trybu: dyskretny pływający przycisk (ikona robaczka, nad
przyciskiem asystenta) **widoczny tylko dla admina**, plus skrót **Ctrl/Cmd+Shift+B**.
W trybie aktywnym element pod kursorem jest podświetlany, a pasek u góry instruuje
„kliknij element, którego dotyczy zgłoszenie" (Esc/Anuluj wychodzi). Kliknięcie jest
przechwytywane w **fazie capture** (`stopPropagation` + `preventDefault`), żeby nie
odpaliło normalnej akcji aplikacji. Rozpoznanie miejsca buduje czytelny markdownowy
opis: route, ewentualny `data-omnia-area`, najbliższy nagłówek sekcji, `aria-label`/
`title`, charakterystyka elementu (tag/id/klasy), tekst w pobliżu i skrócona ścieżka
DOM. Otwarcie self-contained `AICommandSheet` z zewnątrz rozwiązano **lekką magistralą
zdarzeń** (`window` CustomEvent `omnia:assistant-open`) — bez przebudowy drzewa na
React Context. Asystent startuje świeżą rozmowę z kartą „co trafiło do kontekstu" i
prośbą o opis; pierwszą wiadomość admina opakowuje w polecenie „utwórz JEDNO zadanie
w projekcie Omnia, tytuł wygeneruj z opisu, description = opis + kontekst". Tryb
trzymany jest w `useRef` (jednorazowy), więc kolejne wiadomości w tej rozmowie są
już zwykłe. `ensureOmniaProject()` tworzy (find-or-create) projekt „Omnia" z góry,
by zadanie miało gdzie trafić.

**Zmienione pliki:**
- `src/lib/ai/assistantBus.ts` — nowy, lekka magistrala zdarzeń `openAssistant({feedbackContext})` (CustomEvent) do otwierania asystenta z dowolnego miejsca.
- `src/components/shell/FeedbackInspector.tsx` — nowy, admiński tryb wskazywania: FAB + skrót Ctrl+Shift+B, podświetlanie elementu, przechwytywanie kliknięcia w fazie capture, budowa kontekstu (route/sekcja/element/DOM-path), `ensureOmniaProject()` i otwarcie asystenta.
- `src/components/shell/AppShell.tsx` — montaż `FeedbackInspector` wyłącznie dla admina (`isAdmin`).
- `src/components/home/AICommandSheet.tsx` — nasłuch na zdarzenie otwarcia; tryb zgłoszenia (`feedbackRef`), seedowanie wątku kartą kontekstu, gałąź w `handleSend` budująca prompt „utwórz zadanie w projekcie Omnia" i kierująca go zwykłą ścieżką agent→plan→ActionDrawer.
- `src/actions/taskProjects.ts` — nowy `ensureOmniaProject()` (find-or-create projektu „Omnia" jako kosza na zgłoszenia admina).
- `prisma/migrations/0095_omnia_implementation_report_feedback_inspector/migration.sql` — ten raport.

## Podsumowanie
Jedno zgłoszenie, zamknięte w sposób minimalny: maksimum reużycia istniejącej
infrastruktury asystenta (agent/`ActionDrawer`/executor, akcja `create_task`) i
tylko niezbędna nowa „instalacja hydrauliczna" — magistrala zdarzeń do otwierania
chatu z zewnątrz oraz overlay trybu wskazywania z przechwytywaniem kliknięć w fazie
capture. Główne obszary zmian: powłoka aplikacji (`AppShell`/nowy `FeedbackInspector`),
asystent AI (`AICommandSheet`) i akcje zadań (`ensureOmniaProject`). Funkcja jest
ściśle admin-only (montaż za `isAdmin`). Weryfikacja: `tsc --noEmit` przechodzi bez
błędów oraz `check:actions` potwierdza spójność katalogu akcji z executorem; pełny
`npm run build` świadomie nie był uruchamiany lokalnie, bo jego ostatni krok pisze do
produkcyjnej bazy. Raport zapisany przez migrację → trafia do `/reports` na deployu.
$omnia_feedback_inspector$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
