-- Raport implementacji: poddział „Leki i pielęgnacja" w module Zdrowie — 2026-06-04.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- Slug z sufiksem, bo slug bazowy „omnia-implementacja-2026-06-04" koliduje z innymi raportami z tego dnia.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-04 (zdrowie: leki i pielęgnacja)',
  'omnia-implementacja-2026-06-04-leki-pielegnacja',
  $omnia_impl$# Omnia — Raport implementacji 2026-06-04

## Poddział „Leki i pielęgnacja" w module Zdrowie (harmonogram dawkowania)

**Diagnoza:** Moduł Zdrowie obsługiwał tylko wizyty i badania (`HealthEvent`) — jedna
strona `/health`, brak jakiegokolwiek harmonogramowania powtarzalnych czynności.
Wymaganie właściciela: poddział „leki" z dawkowaniem (czego, ile, o których godzinach,
z jaką cyklicznością), a do tego **generyczność** — na identycznej zasadzie mają działać
czynności pielęgnacyjne (zmiana opatrunku, obcinanie paznokci itd.). Potrzebny był więc
jeden mechanizm „harmonogram + odhaczanie wykonań", nie tylko leki.

**Rozwiązanie:** Zamiast dwóch osobnych bytów (leki vs. pielęgnacja) wprowadzono **jeden
model** `MedicationSchedule` z polem-dyskryminatorem `kind` (`MEDICATION` | `CARE`) oraz
dziennik wykonań `MedicationLog` (jeden wpis na slot: `scheduleId + date + slot`, unikat).
Cykliczność trzymana jest „płasko" (prościej i czytelniej niż JSON `RecurringRule`):
`freqType` = `DAILY` (co N dni) / `WEEKLY` (wybrane dni tygodnia) / `HOURLY` (co N godzin),
`interval`, `daysOfWeek` (CSV), `timesOfDay` (JSON wielu godzin) oraz okno kuracji
`startDate`/`endDate`. Cała logika rozwijania harmonogramu na konkretne sloty dnia żyje
w jednej czystej funkcji (`src/lib/medicationSchedule.ts`), współdzielonej przez UI, akcję
serwerową agendy „na dziś", Kalendarz i read-tool asystenta — bez duplikacji reguł
dni/godzin. Reużyto istniejących helperów dat z modułu Nawyków (`habitStats`: `isoDate`,
`parseDays`), więc „dzień" liczony jest lokalnie („YYYY-MM-DD"), spójnie z resztą aplikacji.

Dostęp i własność są dokładnie takie jak w `HealthEvent` (user/zespół, `ownerId`/`ownerTeamId`,
guard `assertScheduleAccess`). UI dodaje do Zdrowia pod-nawigację (`HealthNav`, wzorzec
z Kuchni): zakładka „Wizyty i badania" (istniejąca strona) oraz „Leki i pielęgnacja"
(`/health/leki`) z agendą „na dziś" (odhaczanie tworzy/zdejmuje log) i zarządzaniem
harmonogramami (dodaj/edytuj/usuń/wstrzymaj). Poddział dziedziczy uprawnienie
`module.health` (jest pod `/health`), więc nie trzeba było nowego permission.

Integracje zgodnie z decyzją właściciela: **Kalendarz** rozwija sloty leków na dni
miesiąca w `getCalendarEvents` (jedno zdarzenie na dawkę), a **asystent AI** dostał
read-tool `list_medications` oraz akcje zapisu `create_medication`, `log_dose`
i `delete_medication` (ta ostatnia oznaczona jako destrukcyjna w `ActionDrawer`,
więc jest opt-in). Spójność katalog↔executor potwierdza `check-action-coverage`.

**Zmienione pliki:**
- `prisma/schema.prisma` — modele `MedicationSchedule` + `MedicationLog`, relacje na `User`/`Team`.
- `prisma/migrations/0082_medications/migration.sql` — migracja PostgreSQL (idempotentna, FK przez DO/EXCEPTION).
- `src/types/index.ts` — typy `MedicationSchedule`/`MedicationLog`/`DoseSlot` + unie (`kind`, `freqType`, `outcome`).
- `src/lib/medicationSchedule.ts` — rozwijanie slotów (`slotsForDate`), agenda dnia (`buildDayAgenda`), opis cykliczności (`describeFrequency`).
- `src/actions/medications.ts` — Server Actions: lista, agenda dnia, CRUD harmonogramu, `logDose`/`unlogDose` (scoping user/zespół, `revalidatePath`).
- `src/app/health/layout.tsx` + `src/components/health/HealthNav.tsx` — pod-nawigacja modułu Zdrowie.
- `src/app/health/leki/page.tsx` + `src/components/health/MedicationsPage.tsx` — strona poddziału (agenda „na dziś", lista, formularz z wyborem cykliczności i pór dnia).
- `src/actions/calendar.ts` — rozwinięcie slotów leków/pielęgnacji do `CalendarEvent[]`.
- `src/lib/ai/agentTools.ts` — read-tool `list_medications` (prompt + nazwa + handler).
- `src/app/api/llm/home/agent/route.ts` — katalog akcji zdrowia rozszerzony o leki.
- `src/app/api/llm/home/execute/route.ts` — executor akcji `create_medication`/`log_dose`/`delete_medication` + resolver po nazwie.
- `src/components/home/ActionDrawer.tsx` — `delete_medication` na liście akcji destrukcyjnych (opt-in).
- `CLAUDE.md`, `doświadczenia.md` — aktualizacja tabeli modułów/schematu i lekcje.

## Podsumowanie

Jedno zadanie z obszaru modułu Zdrowie — rozbudowa o poddział „Leki i pielęgnacja":
generyczny harmonogram podawania leków oraz cyklicznych czynności pielęgnacyjnych
z agendą „na dziś" i odhaczaniem wykonań. Główne obszary zmian: schemat bazy (2 nowe
modele + migracja), warstwa logiki (jeden współdzielony helper cykliczności), Server
Actions, UI (pod-nawigacja + strona + formularz), oraz integracje z Kalendarzem i
asystentem AI. Świadoma decyzja projektowa: jeden model z dyskryminatorem `kind`
zamiast dwóch bytów, by „leki" i „pielęgnacja" dzieliły dokładnie tę samą mechanikę.
Weryfikacja: `check-action-coverage` (92 akcje, wszystkie obsłużone) oraz `next build`
przechodzą bez błędów. Migracja prod (`0082`) zostanie zastosowana automatycznie przy
deployu z gałęzi `develop`.
$omnia_impl$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
