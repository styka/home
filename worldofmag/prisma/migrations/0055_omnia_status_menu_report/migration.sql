-- Raport implementacji 2026-05-31 (konfigurowalne statusy zadań + menu zależne od uprawnień).
-- Slug rozszerzony, bo 'omnia-implementacja-2026-05-31' zajmuje wcześniejszy raport (0048).
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-31 (statusy zadań + menu)',
  'omnia-implementacja-2026-05-31-statusy-menu',
  $omnia_status_menu$# Omnia — Raport implementacji 2026-05-31 (statusy zadań + menu)

Sesja realizująca zgłoszenia administratora. Z trzech zadań **dwa wdrożono w pełni**
(konfigurowalne statusy zadań + status „W weryfikacji"; menu zależne od uprawnień z
preferencjami użytkownika), a **zadanie o integracji Google Drive świadomie odłożono**
do osobnej iteracji (uzasadnienie niżej).

## Google Drive — świadomie odłożone (osobna iteracja)
**Diagnoza:** Wymaganie: użytkownik wkleja w ustawieniach link do folderu Google Drive
(z prawem edycji „dla każdego z linkiem"), a aplikacja przechowuje tam pliki (głównie
zdjęcia) w strukturze per-dział, dodając opcję uploadu wszędzie, gdzie dziś podaje się
URL obrazka.
**Rozwiązanie / decyzja:** Po konsultacji zakres zawężono do zadań 2 i 3, a Drive
potraktowano jako osobne zadanie. Istotne ograniczenie techniczne do rozstrzygnięcia
przed startem: **sam link „każdy z linkiem może edytować" NIE wystarcza** do
programowego (serwerowego) zapisu/usuwania plików — Drive REST API wymaga autoryzacji
(OAuth z zakresem Drive albo konto serwisowe, z którym użytkownik dzieli folder).
Anonimowy link działa tylko dla człowieka w przeglądarce. To determinuje całą
architekturę (provider uploadu, model w DB, struktura folderów), dlatego nie podpinano
go „na skróty".
**Zmienione pliki:** brak (zadanie odłożone).

## Status „W weryfikacji" + konfigurowalne statusy per lista
**Diagnoza:** Statusy zadań były zaszyte globalnie (`TaskStatus` + cykl
`TODO→IN_PROGRESS→DONE` w dwóch miejscach), bez statusu weryfikacji i bez możliwości
konfiguracji per lista. Wymagano: nowy systemowy status „W weryfikacji" (domyślnie
wyłączony), konfigurowalny zestaw statusów i ścieżka przejść przód/tył per lista, przy
zachowaniu możliwości skoku do dowolnego statusu, oraz przepływu akceptacji/odrzucenia
po oznaczeniu zadania jako zrobione.
**Rozwiązanie:** „Weryfikacja" zamodelowana jako zwykły status w ścieżce **przed**
`DONE` — dzięki temu nie trzeba osobnego mechanizmu: gdy lista włączy
`IN_VERIFICATION`, ścieżka to `…→IN_VERIFICATION→DONE`, a zadanie w tym statusie dostaje
akcje **Zatwierdź** (→ DONE) i **Odrzuć** (→ powrót/dowolny status). Konfiguracja siedzi
w `TaskProject.statusConfig` (JSON `{ enabled, chain }`; `null` = domyślne statusy
systemowe bez weryfikacji) — minimalna zmiana schematu, zero łamania istniejących list.
Rozdział na `enabled` (zakładki + cele „skoku") i `chain` (cykl przód/tył) pozwala
pokazać np. „Odłożone"/„Anulowane" jako filtry, trzymając je poza domyślnym cyklem `x`.
Filtry i opcje statusu są teraz wyliczane z konfiguracji listy, a `toggleTaskStatus`
cykluje po ścieżce projektu zamiast stałej tablicy.
**Zmienione pliki:**
- `prisma/schema.prisma` + `migrations/0053_task_status_config` — `TaskProject.statusConfig`.
- `src/types/index.ts` — status `IN_VERIFICATION`, `SYSTEM_TASK_STATUSES`, `ProjectStatusConfig`, helpery `parse/serialize/resolve`.
- `src/actions/tasks.ts` — cykl po ścieżce projektu; `IN_VERIFICATION` nie jest terminalem.
- `src/actions/taskProjects.ts` — `updateTaskProjectStatusConfig` (walidacja chain ⊆ enabled).
- `src/components/tasks/TaskStatusConfigEditor.tsx` — edytor statusów listy (włączony/w ścieżce + kolejność).
- `src/components/tasks/{TaskRow,TaskFilters,TaskDetail,TasksPage}.tsx` — dynamiczne filtry/ikony, akcje Zatwierdź/Odrzuć, selektor „skok do dowolnego".
- `src/app/tasks/[projectId]/page.tsx` — przekazanie konfiguracji listy do widoku.

## Menu zależne od uprawnień + preferencje użytkownika
**Diagnoza:** Pozycje menu były powielone w trzech miejscach (`AppShell`, `ModuleSidebar`,
bloki mobilne), a brak uprawnień renderował element jako wyszarzony z kłódką zamiast go
ukrywać. Brakowało też możliwości włączania/wyłączania działów i zmiany ich kolejności.
**Rozwiązanie:** Wydzielono jedno źródło prawdy `src/lib/modules.tsx` (lista `MODULES`
+ `resolveMenu(permissions, prefs)` → `enabled`/`more`). Brak uprawnień ⇒ pozycja w ogóle
nie jest renderowana (ukrycie, nie disabled) — spójnie na desktopie, w drawerze mobilnym i
dolnym pasku. Preferencje per-user (`UserMenuPref`: kolejność + wyłączone działy, domyślnie
wszystko **oprócz QA**) pozwalają wyłączać działy i je porządkować; sekcja „Więcej…" pokazuje
działy dostępne, ale wyłączone (szybkie włączenie), a pełny edytor (on/off + ↑/↓) jest w
ustawieniach. Strona domowa: linki w stopce bez uprawnień są teraz ukrywane, nie wyszarzane.
**Zmienione pliki:**
- `prisma/schema.prisma` + `migrations/0054_user_menu_pref` — model `UserMenuPref`.
- `src/lib/modules.tsx` — lista modułów + helpery widoczności/kolejności.
- `src/actions/menuPrefs.ts` — odczyt/zapis preferencji (upsert + revalidate layout).
- `src/components/shell/{AppShell,ModuleSidebar}.tsx` — render z jednego źródła, „Więcej…", ukrywanie bez uprawnień.
- `src/components/settings/MenuPrefsEditor.tsx` + `src/app/settings/page.tsx` — sekcja „Menu".
- `src/app/layout.tsx` — wczytanie preferencji i przekazanie do powłoki.
- `src/components/home/HomePage.tsx` — ukrycie zablokowanych linków stopki.

## Podsumowanie
Zrealizowano 2 z 3 zadań (3. — Drive — odłożone z uzasadnieniem). Główne obszary zmian:
**moduł Zadań** (konfigurowalne statusy per lista + przepływ weryfikacji, bez łamania
istniejących list dzięki `statusConfig=null`) oraz **powłoka/nawigacja** (jedno źródło
prawdy dla menu, ukrywanie zamiast wyłączania, preferencje kolejności i włączonych działów).
Dwie migracje DB (0053, 0054), `npm run build` przechodzi, zmiany skomitowane na gałęzi
roboczej i mergowane na `develop` (środowisko testowe). Lekcja o duplikacji nawigacji i
„hidden vs disabled" dopisana do `doświadczenia.md`.
$omnia_status_menu$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
