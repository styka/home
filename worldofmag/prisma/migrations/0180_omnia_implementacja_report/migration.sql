-- 0180: raport implementacyjny sesji 2026-06-14 (Dysk Google dla raportów + fix „Dziś").
-- Treść w bazie (storage='db' z domyślnej wartości kolumny dodanej w 0179).
INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-14',
  'omnia-implementacja-2026-06-14',
  $omnia0614$# Omnia — Raport implementacji 2026-06-14

Sesja realizuje dwa zgłoszenia administratora: (1) przechowywanie raportów na Dysku Google
jako opcję domyślną oraz (2) błąd widoku „Dziś" w module Zadań.

## Raporty na Dysku Google (źródło db | drive)

**Diagnoza:** Raporty żyły wyłącznie jako markdown w kolumnie `Report.content` (Postgres).
Na `develop` istniała już pełna, per-user integracja z Dyskiem Google (OAuth `drive.file`,
folder „Omnia" z podfolderami per moduł, rejestr `DriveFile`, helpery
`uploadFile`/`streamFile`/`deleteFile`), ale raporty z niej nie korzystały. Wymóg: nowe raporty
domyślnie na Dysku (jak inne pliki), **bez** migrowania istniejących, a UI ma radzić sobie z
oboma źródłami i pozwalać nimi zarządzać.

**Rozwiązanie:** Wybrano model „metadane w bazie, treść na Dysku". `Report` zyskał pola
`storage` ("db"|"drive", domyślnie "db") i `driveFileId`. Dzięki temu listy, unikalność slug i
RBAC działają bez zmian (szybkie zapytania po metadanych), a tylko bajty treści wędrują na Dysk
jako plik `.md` w folderze „Omnia/Raporty". Domyślną gałęzią jest Dysk **tylko gdy użytkownik
go połączył** — inaczej następuje cichy fallback do bazy (sesje/skrypty bez połączonego konta
nadal działają). Istniejące raporty pozostają `storage='db'`, więc zachowują lokalizację.
Odczyt (`getReport`/`getUserReport`) „hydratuje" treść z Dysku przezroczyście, więc widoki
podglądu/edycji nie muszą wiedzieć, skąd pochodzi treść; edycja nadpisuje plik w miejscu
(`updateFileContent`, PATCH `uploadType=media`), a usunięcie kasuje też plik na Dysku.

**Zmienione pliki:**
- `prisma/schema.prisma`, `prisma/migrations/0179_report_drive_storage` — pola `storage` + `driveFileId`.
- `src/lib/drive/client.ts` — folder „Raporty" w `MODULE_FOLDERS` + helper `updateFileContent`.
- `src/actions/reports.ts` — wybór składowania (`pickStorage`), upload/odczyt/edycja/kasowanie treści na Dysku, `storage` w metadanych.
- `src/app/admin/reports/new/page.tsx` — przełącznik „Przechowuj na Dysku Google" (domyślnie ON gdy połączony).
- `src/app/admin/reports/[slug]/page.tsx` i `.../edit/page.tsx` + `EditReportForm.tsx` — odczyt przez hydratujące `getReport`, badge źródła.
- `src/app/admin/reports/page.tsx`, `src/components/reports/ReportsHomePage.tsx`, `src/app/reports/page.tsx` — badge „Dysk/Baza" na listach.

**Uwaga:** wyszukiwarka raportów (`searchReports`) przeszukuje treść w bazie; dla raportów na
Dysku treść w bazie jest pusta, więc dla nich działa wyszukiwanie po tytule (pełnotekstowe
przeszukiwanie treści z Dysku to ewentualne przyszłe rozszerzenie).

## Bug widoku „Dziś" w Zadaniach

**Diagnoza:** Zadanie przesunięte o jeden dzień w przyszłość nadal pojawiało się na liście
„Dziś" (o kilka dni — znikało). To realny błąd, nie celowy zabieg. `getTodayTasks`,
`getOverdueTasks` i liczniki na `/tasks` liczyły granice doby przez `new Date(); setHours(0/23…)`,
czyli w strefie **serwera** (Render = UTC). Tymczasem `dueDate` zapisywane były jako instanty
UTC niespójnie: inline-picker (`TaskRow`) używał lokalnego południa, ale panel szczegółów,
szybkie dodawanie i wejście AI robiły `new Date("YYYY-MM-DD")` = UTC-północ. Przy użytkowniku w
UTC+2 instant „jutra" potrafił trafić w UTC-owe okno „dziś"; wrażliwa jest tylko granica +1 dnia
(kilka dni leży daleko od granicy doby — stąd objaw „myli się tylko o jeden dzień").

**Rozwiązanie:** Granice doby liczone są teraz w strefie **użytkownika**. Helper
`src/lib/userTime.ts` (`userDayBounds`/`userTomorrowStart`) zwraca instanty UTC odpowiadające
lokalnej północy i 23:59:59.999 doby użytkownika, na podstawie strefy IANA z ciasteczka `tz`
(ustawianego raz w `AppShell` z `Intl.DateTimeFormat().resolvedOptions().timeZone`, fallback
`Europe/Warsaw`). Offset wyznaczany jest przez `Intl.DateTimeFormat(..., {timeZone})` (poprawnie
wokół DST), bez dodatkowych bibliotek. Uzupełniająco zapis wybranego dnia znormalizowano do
lokalnego południa wszędzie (spójnie z `TaskRow`), aby instant jednoznacznie należał do doby
użytkownika.

**Zmienione pliki:**
- `src/lib/userTime.ts` (nowy) — strefa użytkownika + granice doby jako instanty UTC.
- `src/components/shell/AppShell.tsx` — zapis ciasteczka `tz`.
- `src/actions/tasks.ts` — `getTodayTasks`/`getOverdueTasks` używają `userDayBounds`.
- `src/app/tasks/page.tsx`, `src/app/tasks/[projectId]/page.tsx` — liczniki + widok „Nadchodzące".
- `src/components/tasks/TaskDetail.tsx`, `QuickAddTask.tsx`, `AITaskInput.tsx` — zapis na lokalne południe.

## Podsumowanie

Zrealizowano 2 zadania. Główne obszary: moduł Raportów (nowy wymiar przechowywania
db/Dysk Google z reużyciem istniejącej warstwy Drive) oraz moduł Zadań (poprawność stref
czasowych w widokach dziennych). Zmiany są addytywne i kompatybilne wstecz — istniejące raporty
i zadania działają bez zmian; `npm run build` (prisma generate + next build) oraz `tsc --noEmit`
przechodzą. Praca scalona z `develop` (środowisko testowe). Pełny zapis na Dysk Google jest
weryfikowalny dopiero z połączonym kontem na środowisku live (sandbox blokuje API Google).
$omnia0614$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
