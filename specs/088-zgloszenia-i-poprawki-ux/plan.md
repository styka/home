# Plan techniczny: Zgłoszenia bez czekania i pakiet poprawek UX

- **Spec:** ./spec.md (088-zgloszenia-i-poprawki-ux)
- **Status:** draft
- **Data:** 2026-08-24

## 1. Podejście

Pięć pozycji, dwa ciężary. **Ciężar główny** to droga zgłoszenia: zamiast pętli agenta
(`/api/llm/home/agent` → plan → `/api/llm/home/execute`) tryb wskazywania woła **wprost jedną Server
Action** `submitFeedbackTask`, która tworzy zadanie z tytułem roboczym i **kolejkuje zadanie w tle**
po ładny tytuł. Wzorcem jest istniejąca para „akcja zapisuje + `Job` dorabia treść modelem", którą
moduł Wiadomości ma w `news.refresh`, a Magazynowanie w `magazynScan`/`magazynOrderDraft`.
**Ciężar drugi** to trzy poprawki CSS/JSX w miejscach, które już mają swój utarty wzorzec
(`ViewBar`, `NaglowekSekcji` + menu ⋮ jak przy edycji tematu, oś czasu w `NewsTimeline`).

Kolejka, nie „strzał i zapomnij" z przeglądarki: żądanie wystrzelone z klienta ginie razem
z zamknięciem asystenta albo przejściem na inną stronę — czyli dokładnie w scenariuszu, który
naprawiamy (AC-2).

## 2. Model danych (Prisma)

- **Nowy model `TaskAttachment`** — dokładna kalka `NoteAttachment` / `HealthAttachment`
  (to jest wzorzec załącznika w tym repo: obraz jako **data URL** w kolumnie `url`):
  - `id String @id @default(cuid())`
  - `taskId String`
  - `name String` — np. „Zrzut wskazanego elementu"
  - `kind String @default("screenshot")` — rodzaj jako **`String` + union TS** `TaskAttachmentKind =
    "screenshot" | "file"` (C-12; zero enumów Prisma). Pole istnieje, bo załącznik-zrzut ma być
    odróżnialny od ewentualnych późniejszych plików.
  - `url String` — data URL obrazu
  - `createdAt DateTime @default(now())`
  - relacja: `task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)` +
    `@@index([taskId])`; po stronie `Task`: `attachments TaskAttachment[]`.
- **Bez `workspaceId` i bez `ownerId`** — świadomie, zgodnie z trzema istniejącymi tabelami
  załączników: to rekord **podrzędny**, właściciela ma przez rodzica, a kasowanie robi kaskada FK.
  Bramki `check:workspace-fill` / `check:workspace-nullable` patrzą wyłącznie na modele, które
  kolumnę przestrzeni **mają**, więc nowa tabela ich nie dotyczy.
- **Bez zmian w `Task`** — `priority` (`NONE|LOW|MEDIUM|HIGH|URGENT`) już istnieje i wystarcza.
- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **`0259`**
  - Katalog: `prisma/migrations/0259_task_attachment/migration.sql`
  - DDL (ręcznie pisany, bez `migrate diff` — C-15):
    ```sql
    CREATE TABLE IF NOT EXISTS "TaskAttachment" (
      "id"        TEXT PRIMARY KEY,
      "taskId"    TEXT NOT NULL,
      "name"      TEXT NOT NULL,
      "kind"      TEXT NOT NULL DEFAULT 'screenshot',
      "url"       TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId")
        REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");
    ```
  - `npm run check:schema-drift` musi wyjść czysto (schemat = migracje).

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 `src/actions/feedback.ts` — rozszerzenie `submitFeedbackTask`
Sygnatura rośnie o dwa **opcjonalne** pola, żeby nie ruszać istniejącego wywołania z egzekutora AI:

```ts
submitFeedbackTask(input: {
  title: string;
  description?: string;
  priority?: TaskPriority;       // domyślnie "MEDIUM"
  screenshotDataUrl?: string;    // data:image/...;base64,...
}): Promise<SubmitFeedbackResult & { title: string }>
```
Ciało (kolejność ma znaczenie — zapis przed czymkolwiek modelowym):
1. `requireAuth()` (jak dziś; wyjątek dostępu do skrzynki bez zmian — C-17/RBAC opisane w spec),
2. walidacja i przycięcie `title`/`description` (jak dziś) + **walidacja zrzutu**: musi zaczynać się
   od `data:image/` i mieścić się w limicie (`MAX_SHOT_BYTES = 1_500_000` znaków base64); zrzut poza
   limitem/nieprawidłowy jest **pomijany po cichu** — zgłoszenie ma powstać zawsze (AC-8),
3. `prisma.task.create({ data: { title, description, projectId, createdById, priority } })`,
4. gdy zrzut przeszedł walidację → `prisma.taskAttachment.create(...)` (ta sama transakcja nie jest
   potrzebna: brak zrzutu nie unieważnia zgłoszenia),
5. `enqueueJob("tasks.feedbackTitle", { taskId }, { ownerId: user.id, dedupeKey: \`feedback-title:${task.id}\` })`
   — **w try/catch**: brak kolejki nie może wywrócić zgłoszenia (AC-3),
6. `revalidatePath("/tasks")` + `revalidatePath("/tasks/<projectId>")` (bez zmian).

`getFeedbackInboxInfo` bez zmian.

### 3.2 `src/modules/tasks/actions/tasks.ts` — odczyt załączników
```ts
getTaskAttachments(taskId: string): Promise<TaskAttachmentDTO[]>
```
Guard: `assertTaskAccess(task, user.id)` (ten sam, co `addTaskComment`) — czyli kto nie widzi
zadania, nie widzi zrzutu. Zapytanie z jawnym `take: SUFIT_LISTY` (C — `check:pagination`).
DTO: `{ id, name, kind, url, createdAt }`. Kasowanie ręczne **nie wchodzi w zakres** — zrzut ginie
kaskadą razem z zadaniem (spec, „poza zakresem").

### 3.3 Zadanie w tle: `src/modules/tasks/jobs/feedbackTitle.ts`
- Nowy plik `src/modules/tasks/jobs/index.ts` mapujący `{ "tasks.feedbackTitle": feedbackTitleHandler }`,
  wpięty **leniwie** przez `jobs: () => import("./jobs")` w `src/modules/tasks/module.server.ts`
  (C-36 — pole leniwe, bo handler ciąga Prismę i model; allowlista kolejkowania jest pochodną tej mapy).
- Handler:
  1. czyta zadanie (`id`, `title`, `description`, `version`); gdy nie istnieje → cichy koniec,
  2. gdy tytuł nie jest tytułem roboczym (nie ma znacznika) → koniec (idempotencja przy ponowieniu),
  3. `chatComplete` na typie operacji **`dispatch`** (tani, szybki — C-40, model z `/admin/llm`),
     prompt po polsku: „zwięzły tytuł zgłoszenia, max ~80 znaków, bez cudzysłowów", wejście = opis,
  4. `updateWithVersion` (`@/platform/concurrency/version`) na `Task` — **wymóg bramki
     `check:versioning`**: `Task` ma kolumnę `version`, więc zwykły `prisma.task.update` wywala build,
  5. zwraca `{ title, usage: usageFromChat(res) }` — zużycie ląduje w `Job.result`, a `visibleUsage`
     nakłada się dopiero przy odczycie (wzorzec z `check:cost-badge` dla handlerów),
  6. błąd modelu → `JobError` niepowtarzalny/`maxAttempts: 2`; **tytuł roboczy zostaje** (AC-3).
- Logi wyłącznie przez `logEvent` (`check:logs` — żadnego `console.*`).
- Manifesty: wpis w `src/lib/ai/content-memory-coverage.json` (`mode: "on-demand"`, powód: tytuł
  konkretnego zgłoszenia, pamięć zwracałaby cudzy tytuł) — bez niego `check:content-memory` wywala build.

### 3.4 Manifest pokrycia AI (`check:ai-coverage`)
- `feedback:submitFeedbackTask` — wpis istnieje, **zostaje bez zmian** (`status: "ai"`,
  `access: "open"` + `accessReason`).
- `tasks:getTaskAttachments` — **nowy wpis**: `{ "kind": "read", "status": "excluded",
  "reason": "internal", "access": "shared" }` (czyta załącznik zadania, guard = `assertTaskAccess`).

## 4. RBAC / rejestr modułu (C-22)

Bez zmian: żadnego nowego sluga, żadnego nowego modułu, żadnego wpięcia w `permissions.ts` /
`modules.tsx` / `ModuleSidebar`. Tryb wskazywania pozostaje pod `useTrybAdmina`, skrzynka zgłoszeń
zachowuje swój jedyny, wąski wyjątek dostępu. Jedyna zmiana w rejestrze to **pole `jobs`**
w `src/modules/tasks/module.server.ts`.

## 5. UI (C-30, C-31, C-32)

### 5.1 Zrzut wskazanego elementu — `src/components/shell/FeedbackInspector.tsx`
- Nowa zależność **`html-to-image`** (MIT, bez zależności przechodnich — decyzja właściciela).
  Ładowana **leniwie i tylko tutaj**: `const { toPng, toJpeg } = await import("html-to-image")`
  wewnątrz `capture()`. Dzięki temu nie wchodzi do wspólnego grafu tras (budżet `check:perf`).
- `capture(el)`:
  1. `setActive(false)` i **usunięcie podświetlenia przed zrzutem** (inaczej ramka wskaźnika trafia
     na obraz),
  2. `toPng(el, { pixelRatio: Math.min(devicePixelRatio, 2), cacheBust: true, backgroundColor: <var(--bg-base) odczytany z getComputedStyle> })`
     — element bywa przezroczysty, a zrzut bez tła wygląda jak uszkodzony,
  3. gdy wynik > limitu → drugie podejście `toJpeg(el, { quality: 0.8, pixelRatio: 1 })`; gdy dalej
     za duży → **zrzut odpada, zgłoszenie idzie bez niego** (AC-8),
  4. cały krok w `try/catch` z `Promise.race` na 4 s — rasteryzacja nie może zawiesić trybu,
  5. `openAssistant({ feedbackContext, feedbackShot })`.
- `src/platform/ai/assistantBus.ts`: `AssistantOpenDetail` dostaje `feedbackShot?: string`.

### 5.2 Asystent — tryb zgłoszenia bez pętli agenta — `src/components/assistant/AICommandSheet.tsx`
- `feedbackShotRef` obok istniejącego `feedbackRef`.
- **Wybór priorytetu (AC-10):** w trybie zgłoszenia nad polem wiadomości pojawia się rząd
  chipów `Niski / Normalny / Wysoki / Pilny` (`NONE` pomijamy — brak priorytetu nie jest wyborem),
  domyślnie **Normalny** (`MEDIUM`). Stan `feedbackPriority`, zerowany razem z trybem. Kolory
  wyłącznie ze zmiennych CSS, cele dotyku `py-3` (C-30, C-31), teksty przez `t()` (C-32).
- **`handleSend` w trybie zgłoszenia** przestaje wołać `callAgent`. Zamiast tego:
  1. tytuł roboczy: `roboczyTytul(text)` — `🐛 ` + pierwsze zdanie/≤80 znaków (czysta funkcja
     w `src/lib/ai/feedbackTitle.ts`, testowalna bez bazy),
  2. opis: **dokładnie ten sam skład, co dziś** — opis zgłaszającego *verbatim* + „Kontekst
     wskazanego miejsca (UI)" (AC-5),
  3. `await submitFeedbackTask({ title, description, priority, screenshotDataUrl })`,
  4. tura asystenta rodzaju `answer` z potwierdzeniem: „✅ Utworzono zgłoszenie: <tytuł>" +
     (gdy `canRead`) odnośnik do zadania; `persist(...)` jak dziś,
  5. brak `setBusy(true)` na czas modelu — bo modelu tu nie ma; jedyne oczekiwanie to zapis do bazy.
- Konsekwencja porządkowa: `feedbackPrefixRef` (deterministyczne dokładanie „🐛 " w `handleExecute`)
  **przestaje być potrzebne w tej ścieżce** — tytuł nadaje serwer. Ref zostaje wyłącznie dla
  zgłoszeń wychodzących ze zwykłej rozmowy (agent nadal potrafi `submit_feedback`).

### 5.3 Załącznik w szczegółach zadania — `src/modules/tasks/ui/TaskDetail.tsx`
Sekcja „Załączniki" wzorowana **jeden do jednego** na `NoteAttachments` z `NoteRow.tsx`:
`useEffect` → `getTaskAttachments(taskId)`, miniatura `<img>` z `url`, klik → powiększenie w
istniejącym `Modal`. Pusta lista = brak sekcji (bez pustego stanu — to nie jest widok, tylko blok).

### 5.4 Pusty wiersz w pasku widoku — `src/components/ui/view/ViewBar.tsx`
Wrapper pierwszego wiersza (`flex min-w-0 items-center gap-2 md:contents`, `minHeight: 48` przy
`compact`) na telefonie zawiera **tylko** akcje i ustawienia — tytuł jest tam `hidden md:flex`.
Widok bez akcji i bez ustawień (Zadania: `density="compact"`, same `filters`) dostaje więc pusty
pasek 48 px. Poprawka: gdy `!actions && !settings`, wrapper renderujemy jako
`hidden md:contents` (i bez `minHeight`). Od `md` `display: contents` przywraca dokładnie dzisiejszy
układ — AC-15.

### 5.5 Oś czasu vs. przyklejone paski — `src/modules/news/ui/NewsTimeline.tsx`
Punkt osi stoi `absolute -left-[21px]` w `li`, a `ol` ma `border-l` + `pl-4`, więc kropka wystaje
**4 px poza lewą krawędź kolumny treści**; przyklejone paski mają tło szerokości tej kolumny, więc
kropka przesuwa się widocznie **obok** nich. Poprawka: `ol` dostaje lewy margines równy połowie
kropki (`ml-1` = 4 px) — kropka zostaje **wyśrodkowana na linii** (AC-13), a jej skrajny piksel
wraca do wnętrza kolumny (AC-12). Zero zmian w mechanizmie zasłony z C-33.

### 5.6 „Proponowane" + menu ⋮ — `src/modules/news/ui/HotTopics.tsx`
- `t("goraceTematy")` w nagłówku sekcji → nowy klucz `t("proponowane")` = **„Proponowane"**
  (zakładka nadal nazywa się „Gorące tematy" — nazwa zostaje tam, gdzie niesie informację).
- Dwa przełączniki („Monitorowane (n)", „Odrzucone (n)") wychodzą z `akcje` do **menu
  trzykropkowego** — ten sam wzorzec, którym 087 schowało edycję/usuwanie tematu
  (`components/ui/…` menu używane w `sekcjeTematow.tsx`; wykorzystujemy istniejący komponent menu,
  nie piszemy drugiego). Pozycje z zerowym licznikiem **nie są renderowane** (AC-18); gdy obie są
  puste, znika cały przycisk ⋮.
- Teksty do `messages/pl.json` w namespace `modules.news.HotTopics` (C-32).

## 6. AI / integracje (C-23, C-40)

- **Zero nowych `AIAction`.** Akcja `submit_feedback` i jej egzekutor (`src/modules/tasks/ai/executor.ts`)
  zostają nietknięte — `check:actions` i kontrakt akcji bez zmian.
- **Jedno wywołanie modelu** na zgłoszenie, typ operacji `dispatch`, model rozwiązywany z `/admin/llm`
  (C-40 — zero hardcodowania providera). Zużycie liczone jak w każdym handlerze zadania.
- Kalendarz / powiadomienia / auto-wydatek — nie dotyczy.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | model `TaskAttachment` + relacja w `Task` |
| `prisma/migrations/0259_task_attachment/migration.sql` | nowy | DDL tabeli + indeks + FK kaskadowy |
| `src/actions/feedback.ts` | edycja | `priority` + `screenshotDataUrl`, zapis załącznika, kolejkowanie tytułu |
| `src/modules/tasks/actions/tasks.ts` | edycja | `getTaskAttachments` + DTO (guard `assertTaskAccess`) |
| `src/modules/tasks/jobs/feedbackTitle.ts` | nowy | handler dorabiający tytuł (jedno `chatComplete`, `updateWithVersion`) |
| `src/modules/tasks/jobs/index.ts` | nowy | mapa handlerów modułu (= allowlista kolejkowania) |
| `src/modules/tasks/module.server.ts` | edycja | leniwe pole `jobs` |
| `src/lib/ai/feedbackTitle.ts` | nowy | `roboczyTytul()` — czysta funkcja + test jednostkowy |
| `src/lib/ai/content-memory-coverage.json` | edycja | wpis `on-demand` dla nowego handlera |
| `src/lib/ai/action-coverage.json` | edycja | wpis dla `tasks:getTaskAttachments` |
| `src/platform/ai/assistantBus.ts` | edycja | `feedbackShot?: string` w `AssistantOpenDetail` |
| `src/components/shell/FeedbackInspector.tsx` | edycja | zrzut wskazanego elementu (leniwy import, limit, fallback) |
| `src/components/assistant/AICommandSheet.tsx` | edycja | tryb zgłoszenia bez agenta + chipy priorytetu + potwierdzenie |
| `src/modules/tasks/ui/TaskDetail.tsx` | edycja | sekcja załączników (miniatura + podgląd) |
| `src/components/ui/view/ViewBar.tsx` | edycja | brak pustego wiersza na telefonie |
| `src/modules/news/ui/NewsTimeline.tsx` | edycja | kropka osi wraca do kolumny treści |
| `src/modules/news/ui/HotTopics.tsx` | edycja | „Proponowane" + menu ⋮ |
| `messages/pl.json` | edycja | wszystkie nowe teksty (C-32) |
| `package.json` / `package-lock.json` | edycja | `html-to-image` |
| `src/lib/ui/perf-baseline.json` | edycja (warunkowo) | tylko jeśli pomiar wyjdzie poza pasmo ±5 % |
| `e2e/…` | edycja/nowy | klikacz na potwierdzenie zgłoszenia (bez modelu) |
| `doświadczenia.md` | edycja | lekcja o przerywanym żądaniu i o zapadce „zapis przed modelem" (C-51) |

## 8. Bramki i weryfikacja (C-50)

- Lokalny Postgres (`pg_ctlcluster 16 main start`, `omnia/omnia_dev`), `DATABASE_URL`/`DIRECT_URL`
  wyeksportowane do powłoki, `npx prisma migrate deploy` — **nigdy prod DB (C-13)**; weryfikujemy do
  kroku `next build`, bez `migrate.js`.
- Bramki, które ta zmiana rusza wprost: `check:migrations`, `check:schema-drift`, `check:versioning`,
  `check:content-memory`, `check:cost-badge`, `check:ai-coverage`, `check:ai-access`, `check:pagination`,
  `check:i18n`, `check:ui-contract`, `check:logs`, `check:module-registry`, `check:perf` (po `next build`).
- E2E: `bash scripts/e2e-web.sh` (buduje i serwuje `next start`), bez `networkidle` (`check:e2e-waits`).

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1 | Klikacz: tryb zgłoszenia → wysyłka → potwierdzenie w wątku **bez** stanu „myślę"; zadanie w bazie |
| AC-2 | Klikacz: wysyłka + natychmiastowe `Esc`/zamknięcie → zadanie nadal istnieje |
| AC-3 | Test handlera: brak modelu / rzucony błąd → tytuł roboczy zostaje, zadanie nietknięte |
| AC-4 | Przegląd kodu + licznik `AiUsage`/`Job.result`: jedno wywołanie, typ `dispatch`; brak wywołania `/execute` |
| AC-5 | Asercja na opisie utworzonego zadania (verbatim + blok kontekstu) i na prefiksie 🐛 |
| AC-6, AC-7 | Klikacz: zadanie ma załącznik `kind=screenshot`; `TaskDetail` pokazuje miniaturę; kasowanie zadania kasuje wiersz (FK) |
| AC-8 | Test jednostkowy walidacji: zły/za duży data URL → zgłoszenie powstaje, `taskAttachment` puste, brak błędu w UI |
| AC-9 | Test progu rozmiaru (PNG → JPEG → rezygnacja) |
| AC-10, AC-11 | Klikacz: chipy widoczne w trybie zgłoszenia; wybrany „Wysoki" → `priority: "HIGH"` w zadaniu |
| AC-12, AC-13 | Pomiar w klikaczu: `boundingBox().x` kropki ≥ `x` kolumny treści; kropka nadal na linii (odchyłka ≤1 px) |
| AC-14, AC-15 | Pomiar wysokości pierwszego wiersza paska przy 360 px w widoku bez akcji (0 px) i z akcjami (bez zmian); desktop bez zmian |
| AC-16..AC-18 | Klikacz przy 360 px: nagłówek „Proponowane" w jednym wierszu, pozycje w menu ⋮, brak pozycji przy zerowym liczniku |

## 9. Ryzyka techniczne i plan wycofania

- **`html-to-image` powiększa paczkę** → import wyłącznie leniwy w komponencie admina; po buildzie
  sprawdzamy `check:perf`. Gdy najcięższa trasa wyjdzie poza pasmo — najpierw szukamy przecieku do
  wspólnego grafu, dopiero potem aktualizujemy próg z uzasadnieniem.
- **Rasteryzacja zawodzi na niektórych elementach** (obrazy z innych domen, `canvas`) → limit czasu
  4 s + `try/catch` + zgłoszenie bez zrzutu. Nigdy nie blokuje wysyłki.
- **Data URL rozdyma wiersz zadania** → twardy limit 1,5 MB i degradacja PNG → JPEG → brak zrzutu.
- **`updateWithVersion` przy dorabianiu tytułu może trafić na konflikt** (ktoś zmienił tytuł ręcznie)
  → wtedy **nie nadpisujemy**; handler kończy się cicho (zmiana człowieka wygrywa z kosmetyką modelu).
- **Zadanie w tle nie ruszy, gdy instancja śpi** (wolny tier `develop`) → tytuł roboczy jest pełnoprawny,
  a worker budzi się przy pierwszym żądaniu; to znany, opisany kompromis, nie usterka.
- **Rollback:** kod — cofnięcie commita (poprawki UI są niezależne od siebie i od migracji);
  migracja — `TaskAttachment` jest tabelą **dokładaną**, więc rollback kodu nie wymaga rollbacku
  bazy (osierocona tabela nikomu nie przeszkadza; usunięcie osobną migracją, gdyby trzeba).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-15** — ręcznie pisana migracja `0259`, numer z `next:migration`, `String`+union zamiast
      enuma, zero DDL z `migrate diff`, żadnego builda przeciw prod DB.
- [x] **C-20..C-25** — mutacje w Server Actions z `revalidatePath`; guard `assertTaskAccess` przy
      odczycie załączników; wyjątek skrzynki bez poszerzenia; brak nowych `AIAction` (C-23);
      kasowanie zrzutu przez kaskadę (nie dotyczy kosza); brak zmian RBAC/konfiguracji (brak wpisu audytu).
- [x] **C-30..C-33, C-35** — kolory tylko ze zmiennych CSS; poprawki celują w telefon; teksty przez
      `t()` i `messages/pl.json`; poprawka pustego wiersza idzie **w ramie widoku**, nie wyjątkiem
      w module; sekcja załączników dowieziona razem z jej pierwszym konsumentem.
- [x] **C-36** — nowe pole `jobs` deklarowane leniwie w `module.server.ts`; handler żyje w module,
      allowlista kolejkowania pozostaje pochodną deklaracji; platforma nadal nie zna modułu.
- [x] **C-40, C-41** — model z `/admin/llm` po typie operacji, zero hardcodowania; kluczy nie dotykamy.
- [x] **C-53 (minimalizm)** — jedna nowa zależność, świadomie wybrana przez właściciela i ładowana
      leniwie; zero nowych abstrakcji; trzy poprawki UI to zmiany jedno-/kilkulinijkowe w istniejących
      komponentach; brak refaktorów „przy okazji".
- [x] **C-50..C-52a** — zielony build jako definicja gotowego; lekcja do `doświadczenia.md`;
      merge do `develop`, promocja `--ff-only` + tag.
