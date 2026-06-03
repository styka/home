-- Raport implementacji: grupowanie zadań po priorytetach w widokach Nadchodzące/Zaległe/Wszystkie — 2026-06-03.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- Slug z sufiksem, bo slug bazowy „omnia-implementacja-2026-06-03" jest już zajęty przez wcześniejsze raporty z tego dnia.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-03 (zadania: grupowanie po priorytetach)',
  'omnia-implementacja-2026-06-03-zadania-priorytety',
  $omnia_impl$# Omnia — Raport implementacji 2026-06-03

## Widoki Nadchodzące / Zaległe / Wszystkie — opcja grupowania po priorytetach + sort po terminie z czasem

**Diagnoza:** Każda zakładka działu Zadania ma własną, naturalną prezentację:
„Dziś" i widok projektu grupują zadania **po priorytetach**, „Nadchodzące" grupuje
**po dniach**, „Wszystkie" **po projektach**, a „Zaległe" to płaska lista. Wymaganie
właściciela: zachować te naturalne widoki bez zmian, ale **dodać możliwość przełączenia
prezentacji na grupowanie po priorytetach** (tak jak w „Dziś") dla widoków Nadchodzące,
Zaległe i Wszystkie. Dodatkowo: zadania **wewnątrz każdej grupy** muszą być sortowane po
**pełnym terminie wraz z czasem** — żeby np. w „Dziś" zadania poranne były wyżej niż
wieczorne, a w „Nadchodzących" w obrębie jednego dnia obowiązywała kolejność godzinowa.
Audyt kodu ujawnił, że sort po terminie z czasem (`byDueDateAsc`, używa pełnego
`Date.getTime()`) był stosowany w grupach priorytetów i w widoku „Wszystkie", ale **brakowało
go w grupach dni widoku „Nadchodzące"** (kolejność w obrębie dnia zależała od kolejności z
serwera, nie od godziny terminu) oraz w płaskiej liście „Zaległe" (sort wynikał tylko z
`orderBy` zapytania).

**Rozwiązanie:** Zamiast budować osobny komponent dla każdej kombinacji widok×grupowanie,
dodano do `TaskList` jeden prop sterujący — `groupBy: "default" | "priority"`. Gałęzie
renderujące naturalne grupowanie (Nadchodzące/Zaległe/Wszystkie) działają tylko przy
`groupBy === "default"`; gdy użytkownik wybierze „priorytety", przepływ spada do istniejącego
bloku grupowania po priorytetach, który staje się uniwersalnym fallbackiem dla **każdego**
widoku. Dzięki temu logika priorytetów (etykiety, kolejność URGENT→NONE, sekcja zakończonych)
jest reużyta bez duplikacji, a naturalne widoki pozostają nietknięte. Przełącznik prezentacji
(segmentowane przyciski w nagłówku: ikona drzewa = jak w widoku, ikona flagi = po priorytetach)
pokazuje się **tylko** dla widoków, w których ma to sens (upcoming/overdue/all) — „Dziś" i
projekty i tak są zawsze grupowane po priorytetach. Wybór jest zapamiętywany między nawigacjami
w `localStorage` (`tasks.groupBy`). Sortowanie po terminie z czasem dopięto wszędzie: dodano
`.sort(byDueDateAsc)` w grupach dni „Nadchodzących" i w liście „Zaległych", a `byDueDateAsc`
porównuje pełny znacznik czasu (data + godzina), więc kolejność godzinowa działa w obrębie
każdej grupy.

**Zmienione pliki:**
- `src/components/tasks/TaskList.tsx` — nowy prop `groupBy`; gałęzie upcoming/overdue/all
  warunkowane `groupBy === "default"`, dzięki czemu blok grupowania po priorytetach jest
  uniwersalnym fallbackiem; dodany sort po terminie z czasem w grupach dni („Nadchodzące")
  i w płaskiej liście („Zaległe").
- `src/components/tasks/TasksPage.tsx` — stan `groupBy` z trwałością w `localStorage`;
  segmentowany przełącznik (ikony `ListTree`/`Flag`) w nagłówku, widoczny dla widoków
  upcoming/overdue/all; przekazanie `groupBy` do `TaskList`.

## Podsumowanie

Sesja obejmowała **1 zadanie** (UX działu Zadania). Główny obszar zmian: warstwa prezentacji
listy zadań (`TaskList`) oraz powłoka strony zadań (`TasksPage`). Kluczowa decyzja projektowa:
zamiast nowych komponentów wprowadzono **jeden przełącznik trybu grupowania** reużywający
istniejący blok priorytetów jako fallback — minimalny koszt, zero duplikacji, naturalne widoki
bez zmian. Przy okazji uspójniono sortowanie wewnątrz grup do **pełnego terminu z czasem**
(poranne wyżej niż wieczorne), uzupełniając brakujące sortowanie w „Nadchodzących" i „Zaległych".
Preferencja grupowania przeżywa nawigację (`localStorage`). `npm run build` (prisma generate +
next build) przechodzi bez błędów.
$omnia_impl$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
