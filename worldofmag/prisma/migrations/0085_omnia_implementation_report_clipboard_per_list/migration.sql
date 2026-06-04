-- Raport implementacyjny: przeniesienie kopiowania promptu dla Claude Code
-- z panelu Admina na poszczególne listy zadań (admin-only, per-lista).
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-04 (kopiowanie promptu na listach zadań)',
  'omnia-implementacja-2026-06-04-clipboard-per-list',
  $omnia_clipboard_per_list$# Omnia — Raport implementacji 2026-06-04

Sesja realizująca 1 zgłoszenie: przeniesienie funkcji „kopiuj prompt dla Claude Code"
z panelu Administratora na poszczególne listy zadań. Zmiana wyłącznie po stronie kodu
(bez zmian schematu danych).

---

## Kopiowanie promptu dla Claude — admin-only, na listach zadań zamiast w panelu Admina
**Diagnoza:** Funkcja kopiująca do schowka prompt LLM + JSON zadań dla Claude Code żyła
w panelu Admina (`/admin`) jako pojedynczy przycisk, który zlepiał wszystkie zadania
projektów o nazwie zawierającej „omnia" (server action `getOmniaTasksForClipboard`,
filtr `status = TODO`). Wymaganie: ta opcja ma pozostać dostępna **tylko dla Admina**,
ale **nie w panelu Admina** — ma być na **listach zadań**, i to per-lista, tak by z danej
listy dało się skopiować do schowka prompt z zadaniami właśnie tej listy.

**Rozwiązanie:** Logikę promptu (stały tekst polecenia dla Claude Code) oraz kopiowanie do
schowka wydzielono do współdzielonego modułu `src/lib/omniaClipboard.ts` — jedno źródło
prawdy dla tekstu promptu i odporny na iOS Safari mechanizm `copyLazy` (ClipboardItem z
Promise<Blob>, fallback na writeText / textarea). Nowy przycisk `TaskListClipboardButton`
ląduje w nagłówku każdej listy zadań i jest renderowany tylko, gdy zalogowany użytkownik
ma uprawnienie `module.admin` (flaga `isAdmin` przekazywana z server-component strony do
`TasksPage`). Po kliknięciu kopiuje prompt + JSON **aktywnych** (nie-terminalnych) zadań
wierzchołkowych aktualnie oglądanej listy — bierzemy je z już załadowanego propu `tasks`,
więc „z tej listy" jest spełnione bez dodatkowego zapytania do bazy, a podzadania i pozycje
odhaczone/anulowane są pomijane jako nie-zadania-do-pracy. Sekcję „Omnia — Claude Code"
usunięto z `/admin`, a nieużywany już `admin-tools.ts` i komponent `OmniaClipboardButton`
skasowano (logika żyje teraz w lib + przycisku na liście).

**Zmienione pliki:**
- `src/lib/omniaClipboard.ts` — nowy: stały prompt `OMNIA_LLM_PROMPT`, `buildOmniaPrompt`, `copyLazy`, sentinel pustej listy.
- `src/components/tasks/TaskListClipboardButton.tsx` — nowy: admin-only przycisk w nagłówku listy; filtruje do aktywnych zadań wierzchołkowych i kopiuje prompt.
- `src/components/tasks/TasksPage.tsx` — nowy prop `isAdmin`; renderuje przycisk w pasku akcji nagłówka.
- `src/app/tasks/[projectId]/page.tsx` — wylicza `isAdmin` (`hasPermission(session, PERMISSIONS.ADMIN)`) i przekazuje do `TasksPage`.
- `src/app/admin/page.tsx` — usunięto sekcję „Omnia — Claude Code" oraz import `OmniaClipboardButton`/ikonę `Bot`.
- `src/actions/admin-tools.ts` — usunięty (jedyna funkcja była nieużywana po przeniesieniu).
- `src/components/admin/OmniaClipboardButton.tsx` — usunięty (zastąpiony lib + przyciskiem na liście).
- `CLAUDE.md` — zaktualizowany opis panelu Admina i listy Server Actions.

## Podsumowanie
Jedno zgłoszenie, zmiana wyłącznie po stronie kodu (bez migracji schematu). Główny obszar:
moduł Zadania (nagłówek listy) + panel Admina + nowy współdzielony lib schowka. Funkcja jest
teraz bliżej kontekstu (admin kopiuje dokładnie tę listę, którą ogląda) i pozostaje
admin-only. Weryfikacja: `node scripts/check-action-coverage.js` (czysto) oraz `next build`
— kompilacja i type-check bez błędów (błędy `UntrustedHost` przy prerenderze są nieszkodliwe).
Raport zapisany przez migrację (jak pozostałe w projekcie) → trafia do `/reports` na deployu.
$omnia_clipboard_per_list$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
