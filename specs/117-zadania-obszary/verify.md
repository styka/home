# Weryfikacja: Obszary w Zadaniach + trwała odzyskiwalność kosza

- **Spec:** ./spec.md (117-zadania-obszary)
- **Data:** 2026-08-31
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`), migracje 0001–0287 zaaplikowane (C-13 — prod nietknięty)

## Bramki

| Komenda | Wynik |
|---|---|
| `npm run build` (pełny: copy-* → 30 bramek → `tsc` → `next lint` → `prisma generate` → `next build` → `check:perf` → `migrate.js` na LOKALNEJ bazie) | ✅ EXIT 0 (`scratchpad/build5.log`) |
| `npm run check:migrations` | ✅ „następny wolny numer: 0288" |
| `npm run check:actions` | ✅ 168 akcji, każda z egzekutorem |
| `npm run check:schema-drift` | ✅ brak rozjazdu |
| `npm run check:ai-coverage` | ✅ 687 akcji (7 nowych wpisów 117) |
| `next lint --dir src` | ✅ 0 błędów, 0 warningów |
| `npm run check:i18n` | ✅ zero literałów w komponentach |
| `npm run test:unit` (z `DATABASE_URL`) | ✅ 1504/1504 (w tym 6 nowych testów drzewa obszarów) |
| Smoke AC (skrypt `scratchpad/smoke-117.ts`, wspólny restorator) | ✅ „SMOKE OK" |

Po drodze naprawione **dwie czerwienie odziedziczone z develop po merge 116** (nie z tego feature'a):
brak wyjątku `check:ownership-scope` dla `skinAssets.ts` i pęknięta zapadka `check:domain`
(pomocniki 116 wyprowadzone do `src/lib/skins/zapis.ts`). Opisane w `doświadczenia.md` (2026-08-31).

## Kryteria akceptacji

- **AC-1 (drzewo ≥3 poziomy)** — ✅. Test jednostkowy `obszary.test.ts` (spłaszczenie 3-poziomowe,
  głębokość, sieroty); smoke utworzył A→A1→A1X przez Prismę; UI renderuje dowolną głębokość
  (`ObszarySekcje.tsx` — wcięcie `min(glebokosc, 6)`, cap tylko wizualny).
- **AC-2 (dokładnie jeden obszar, „brak" odpina)** — ✅. `Task.areaId` to jedna kolumna (model);
  walidacja przynależności obszaru do projektu docelowego + odpinanie przy przenosinach:
  `src/modules/tasks/actions/tasks.ts` (blok „117" w `updateTask`); picker `WyborObszaru`
  w `TaskDetail` (sekcja dat), opcja pusta → `null`.
- **AC-3 (sekcje wg drzewa, „Bez obszaru", bez znikania/dubli)** — ✅. Jeden zbiór źródłowy:
  `TasksPage` przekazuje do `ObszaryWidok` te same `visibleTasks` co lista (zakładka statusu +
  tagi + szukaj); `zadaniaWObszarze` to PARTYCJA tego zbioru (każde zadanie w dokładnie jednym
  kubełku, osierocone wskazania → `null`); sekcja „Bez obszaru" na końcu (`ObszarySekcje.tsx`).
- **AC-4 (3 przełączalne warianty, pamięć, domyślnie sekcje)** — ✅. `PrzelacznikSegmentowy`
  sekcje/wgłąb/panel; wariant w adresie (`obszary=` w `viewSpec`, domyślna `sekcje`); ostatni
  wybór w `localStorage` (`wariantObszarow.ts`) używany TYLKO gdy adres nie niesie parametru
  (`TasksPage` — efekt z warunkiem `viewParams.obszary !== undefined`), więc URL/ulubione wygrywa.
  Panel poniżej `lg` podstawia sekcje (C-31).
- **AC-5 (usuwanie: scal / poddrzewo)** — ✅. Dialog wyboru trybu z przyciskiem destrukcyjnym
  (`ObszaryWidok.tsx`); `deleteArea` w transakcji: „scal" przepina dzieci i zadania na rodzica,
  „poddrzewo" kasuje korzeń (kaskada FK), `Task.areaId` → `SetNull`. Smoke: po „poddrzewo"
  0 obszarów, `areaId=null`.
- **AC-6 (przywrócenie odtwarza strukturę)** — ✅. Smoke: restore migawki odtworzył 3 węzły
  z właściwą hierarchią (rodzic A1X = A1) i przypisania obu zadań. Restorator nie kradnie
  ręcznych przenosin (warunek na bieżącej wartości `areaId`).
- **AC-7 (opróżnienie/retencja nie kasuje danych)** — ✅. Wszystkie 6 miejsc kasujących
  `TrashItem` przeszło na statusy (`grep trashItem.delete` → 0 trafień w `src/`); smoke: po
  „opróżnieniu" wiersz istnieje ze statusem `emptied`; retencja = `updateMany → expired`
  (`platform/trash/trash.ts`). RODO (kaskada po `User`) świadomie zostaje — wyjątek ze speca.
- **AC-8 (panel admina + audyt)** — ✅. `/admin/kosz` (wpis w rejestrze narzędzi, filtry
  statusu/szukajka, kursorowe doładowanie); `adminRestoreTrashItem` = `requireAdmin` → ten sam
  dispatch `przywrocZMigawki` co `/trash` → `logAudit("admin", "trash.restore", …)`. Rdzeń
  potwierdzony smoke'iem (restore z wpisu `emptied` działa); klik w UI nie był wykonywany
  w sandboxie (ograniczenie, nie brak).
- **AC-9 (obszary wspólne w projekcie zespołowym)** — ✅ przez ślad kodu: każda akcja obszarów
  przechodzi przez `assertProjectAccess` (052: wspólne sprawdzanie `platform/sharing`), a zapytanie
  filtruje wyłącznie po `projectId` — brak filtra per-użytkownik, więc członkowie widzą to samo
  drzewo. Nie wykonano testu dwoma kontami end-to-end (ograniczenie środowiska).

## Zgodność z konstytucją

- C-01/C-02/C-36 ✅ — kod obszarów w `src/modules/tasks/` (własne wnętrze ścieżką względną —
  poprawiony import w teście); restoratory w `src/lib/trash/` czytają moduły wyłącznie przez
  kontrakty (`rosliny`, `tasks`); platforma kosza nie zna modułów.
- C-10..C-12/C-15 ✅ — ręczne, addytywne migracje 0286/0287; zero enumów (`status`/`tryb` jako
  `String` + unie TS).
- C-20/C-21 ✅ — Server Actions z `revalidatePath`; dostęp przez guard projektu (model przestrzeni).
- C-23 ✅ — zero nowych `AIAction` (zgodnie ze specem); coverage uzupełnione.
- C-24 ✅ (zaostrzone — nic z kosza nie znika), C-25 ✅ (audyt operacji admina, kategoria `admin`).
- C-30..C-34 ✅ — wyłącznie zmienne CSS; panel desktop-only z fallbackiem; teksty w `pl.json`;
  dialog usunięcia z jawnie destrukcyjnym przyciskiem; widok wewnątrz istniejącej ramy Tasks.
- C-50 ✅ (pełny build), C-51 ✅ (wpis w `doświadczenia.md`), C-53 ✅ (bez nowych zależności;
  jedyny refaktor — wyniesienie restoratorów — wymuszony współdzieleniem user/admin).

## Regresje

- **Kosz istniejących modułów**: restoratory przeniesione 1:1 (fallback przestrzeni z
  `item.userId` zamiast sesji — dla ścieżki użytkownika tożsame, bo wpis należy do sesji);
  format migawek nietknięty; testy DB-gated przechodzą.
- **Zadania**: `updateTask` — nowe pole czysto addytywne; snapshoty kosza zadań niosą `areaId`
  (stare migawki bez pola → `null`, restorator toleruje). Widoki list/kanban/timeline nietknięte
  poza dodatkowym przyciskiem układu (tylko widok projektu).
- **Cron retencji** (`/api/cron/retention`): sygnatura `purgeExpiredTrash` bez zmian (zwraca
  liczbę), zmiana wyłącznie semantyki delete→expired.
- **Bundle/perf**: `check:perf` w buildzie zielony (pasmo ±5 %).

## Werdykt końcowy

**GOTOWE Z UWAGAMI** — wszystkie AC spełnione, bramki zielone. Uwagi (nieblokujące, do decyzji
recenzji):

1. **Nieaktualne teksty kosza użytkownika**: przycisk „Usuń trwale" i potwierdzenia „Tej operacji
   nie można cofnąć" / „usunięte trwale" (`TrashPage.tsx`, `pl.json`) po 117 mówią nieprawdę —
   wpis tylko znika z widoku użytkownika, a admin może go przywrócić. Warto przepisać na
   „Usuń z kosza" + zdanie o odzyskiwalności przez administratora.
2. E2E klikacze nie były uruchamiane w tym przebiegu (logika pokryta bramkami, testami
   jednostkowymi i smokiem na lokalnej bazie).
