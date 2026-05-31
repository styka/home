-- Raport implementacji 2026-05-31 (Nawyki, workflow develop, naprawa nawigacji raportów)
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-31',
  'omnia-implementacja-2026-05-31',
  $omnia_2026_05_31$# Omnia — Raport implementacji 2026-05-31

Sesja realizująca trzy zgłoszenia administratora: nowy dział **Nawyki**, korekta
workflow gita w `CLAUDE.md` oraz naprawa nawigacji na stronie domowej raportów.

## Dział nawyki bazując na jednym z raportów
**Diagnoza:** Raport systemowy `new-modules-proposal` (migracja `0018_initial_reports`)
opisywał moduł „Nawyki (Habit Tracker)": definicje nawyków (nazwa, ikona, częstotliwość),
odhaczanie tap=zrobione, pasek postępu i streak, widok tygodniowy/miesięczny w stylu
GitHub contributions, powiadomienia przypominające oraz synergia z Zadaniami. Brakowało
implementacji — należało zbudować pełny, dopracowany moduł (desktop + mobile).

**Rozwiązanie:** Moduł zbudowano ściśle według istniejącego wzorca działów (jak `health`):
trasa server-side z bramką `module.habits`, komponent kliencki, server actions z
`revalidatePath`, własność user/zespół (`ownerId`/`ownerTeamId` + `getUserTeamIds`). Dane
rozbito na `Habit` (definicja) i `HabitEntry` (dziennik wykonań, jeden wpis na dzień,
`@@unique([habitId, date])`), z datą jako „YYYY-MM-DD" bez strefy czasowej — stabilne dla
heatmapy i streaków niezależnie od TZ. Statystyki (bieżący/najdłuższy streak liczony po
dniach zaplanowanych, postęp tygodnia) wydzielono do czystego `habitStats.ts`, by były
testowalne i współdzielone serwer↔klient. Odhaczanie jest optymistyczne (natychmiastowy
feedback + przeliczenie streaka po stronie klienta), a przypomnienia korzystają z **tego
samego mechanizmu co przypomnienia o zadaniach** — wspólny helper `notifications.ts`
(Service Worker z fallbackiem) + polling co 30 s, dedup na `habitId:date`. UX skupiono na
motywacji (zachęcające mikrokopie, duże cele dotykowe, vim-style j/k/space/x, modal dodawania
z presetami emoji/kolorów/harmonogramu), bo dział ma wspierać odbudowę nawyków.

**Zmienione pliki:**
- `prisma/schema.prisma` — modele `Habit` i `HabitEntry` + relacje na `User`/`Team`.
- `prisma/migrations/0047_habits_module/migration.sql` — tabele, indeksy, klucze obce.
- `src/types/index.ts` — typy `Habit`, `HabitWithStats`.
- `src/lib/habitStats.ts` — daty lokalne, harmonogram, streaki, postęp tygodnia.
- `src/lib/notifications.ts` — wspólny helper powiadomień (reużyty z modułu Zadań).
- `src/actions/habits.ts` — `getHabits` (ze statystykami), CRUD, `toggleHabitDay`, `reorderHabits`.
- `src/app/habits/{page,layout}.tsx` — trasa (gating `module.habits`) i provider palety.
- `src/components/habits/{HabitsPage,HabitFormModal,HabitHeatmap}.tsx` — UI działu.
- `src/lib/permissions.ts`, `scripts/migrate.js`, `prisma/seed.ts` — uprawnienie `module.habits` → ADMIN.
- `src/components/shell/{ModuleSidebar,AppShell}.tsx` — wpis w obu źródłach nawigacji (desktop + mobile).

## Skoryguj Cloud i markdown
**Diagnoza:** `CLAUDE.md` nie precyzował, że gałąź `develop` to środowisko testowe i że
weryfikacja działania pracy wymaga deployu z `develop`. Brakowało jasnej reguły, by domyślnie
i automatycznie mergować pracę do `develop` (zamiast meldować „zrobione" i czekać), a promocję
na produkcję (`master`) wykonywać dopiero na wyraźną prośbę.

**Rozwiązanie:** Doprecyzowano sekcję „Git workflow" — `develop` opisany jako środowisko
testowe z auto-deployem; reguła „po ukończeniu zadania i zielonym buildzie merguj `claude/*`
→ `develop` domyślnie, bez pytania"; `develop → master` tylko na wyraźną prośbę, po
potwierdzeniu, że na teście działa. Zachowano: preferowany fast-forward, brak force-push.

**Zmienione pliki:**
- `CLAUDE.md` — rozszerzona sekcja „Git workflow (merge przez `develop`)".

## Na stronie domowej raportów nie da się przejść do żadnych widoków
**Diagnoza:** Strona `/reports` to dashboard, którego sekcja „Zarządzanie" zawierała kafelek
„Wszystkie raporty" linkujący do `/reports` — czyli do samej siebie (martwy link). Dodatkowo
lista pokazywała tylko 8 ostatnich raportów (reszta nieosiągalna), a trasa szczegółów
`/reports/[slug]` jako jedyna uwierzytelniona strona treści nie miała `dynamic = "force-dynamic"`.

**Rozwiązanie:** Usunięto martwy, zapętlony link i zdjęto limit listy, dzięki czemu strona
domowa jest pełną, klikalną listą wszystkich raportów (każdy wiersz → szczegóły). Trasie
szczegółów dodano `force-dynamic` dla parytetu z resztą aplikacji i pewnego renderu on-demand.
Sekcja „Zarządzanie" pokazuje się tylko adminowi (realny cel: panel admina).

**Zmienione pliki:**
- `src/components/reports/ReportsHomePage.tsx` — pełna lista zamiast 8, usunięty self-link, sekcja zarządzania tylko dla admina.
- `src/app/reports/[slug]/page.tsx` — `export const dynamic = "force-dynamic"`.

## Podsumowanie
Zrealizowano 3 zadania. Największy obszar to nowy, rozbudowany dział **Nawyki** wpięty we
wspólny wzorzec architektury (gating `module.*`, własność user/zespół, server actions z
`revalidatePath`, motyw na zmiennych CSS, podwójna nawigacja desktop/mobile) z naciskiem na
profesjonalny, motywujący UX i realne przypomnienia reużywające mechanizmu z Zadań. Poza tym
korekta dokumentu `CLAUDE.md` (domyślny auto-merge do `develop`) i naprawa nawigacji raportów.
Dwie migracje schematu/treści (`0047` nawyki, `0048` ten raport). Lekcję z naprawy nawigacji
dopisano do `doświadczenia.md`. Uwaga utrzymaniowa: dział Nawyki używa powiadomień lokalnych
(polling klienta) — ten sam, sprawdzony mechanizm co przypomnienia o zadaniach.
$omnia_2026_05_31$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
