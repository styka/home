# Dodatek A.16 — Plan realizacji i kolejność (TRACKER ROBOCZY)

> **To jest nasz główny, żywy tracker dalszej pracy.** Zadania ułożone **od najprostszych do
> najtrudniejszych**. Po zrobieniu zadania **zmieniamy jego status** (kolumna/emoji). Rozdział A.13
> zostaje jako szczegółowy dziennik `Z-NNN`; A.15 to migawka „co zrobione / co zostało".
>
> **Tu zebrane jest WSZYSTKO, co dawniej było w rozdziale „Decyzje właściciela" (A.14)** — ten rozdział
> jest już nieaktualizowany; korzystamy z tego planu.

**Legenda statusu:**
- ⬜ **TODO** — nieruszone.
- 🟡 **W TOKU** — ruszone, ale niedokończone (często czeka na Twoją weryfikację po deployu).
- 🔓 **CZEKA NA CIEBIE** — wymaga decyzji właściciela / konta / klucza / konfiguracji.
- ⏸️ **ODŁOŻONE** — świadomie, z podanym powodem.
- ✅ **ZROBIONE** — domknięte i zweryfikowane.

**Kto:** 🧑‍💻 = robię ja (kod) · 👤 = akcja po Twojej stronie · 🤝 = ja robię, Ty weryfikujesz/decydujesz.

---

## ETAP 0 — Domknąć „ruszone" (po najbliższym deployu) — minuty

### T-01 · ✅ · 🤝 · Weryfikacja wizualna po deployu (modale / EmptyState / slugi) — *Z-114, Z-112/113, slugify*
> **Zweryfikowane przez właściciela 2026-07-02 („T-01 OK").** Przy okazji wyłapane i naprawione 2 bugi
> (termin zadania `datetime-local` = Invalid Date; import przepisu maskował „LLM nieskonfigurowany" jako
> 422) oraz sprostowana instrukcja (dodawanie pozycji zakupów jest inline, nie modal).
- **Stan:** kod gotowy i skompilowany (tsc), ale **nie zweryfikowany na żywo** (pracujemy na gałęzi
  roboczej, deploy wstrzymany limitem Render). 22 modale przeniesione na dostępny `ui/Modal`, EmptyState
  ujednolicony, slugify wykonawców naprawiony (ł→l), migracja `0196` (onDelete) gotowa.
- **Twoja akcja (👤):** po deployu na `develop` — kliknąć kilka modali (np. dodawanie do listy zakupów,
  edycja spiżarni, import przepisu), sprawdzić puste stany i polskie slugi (`/providers/…`); potwierdzić,
  że nic nie jest rozjechane. **+ `/admin/health` → nowa karta „Diagnostyka zapytań" (T-06) renderuje się. + Kalendarz/Home ładuje się, dane świeże po ≤60 s (cache T-09). + Kontakty (T-11): lista płynnie się przewija, j/k przeskakuje zaznaczenie i doscrollowuje, edycja wiersza nie rozjeżdża layoutu. + Zakupy (T-03): uchwyt DnD przy najechaniu/dotyku, przeciąganie zmienia kolejność w obrębie kategorii (long-press na telefonie), kolejność trzyma się po odświeżeniu i nie psuje sortu po trasie. + Zespół (T-12): w `/settings/team/[id]` przycisk „Dostęp" przy domowniku otwiera checkboxy modułów; po odznaczeniu modułu i zapisie domownik przestaje widzieć współdzielone zasoby tego modułu (a wciąż widzi dozwolone). + Zadania (T-10): sekcja „Udostępnianie" w szczególe zadania działa jak wcześniej (dodaj po e-mailu z rolą Widz/Edytor, usuń), teraz z reużywalnego `ShareControl`.**
- **Po potwierdzeniu:** status → ✅.

---

## ETAP 1 — Tanie decyzje (1 zdanie z Twojej strony odblokowuje) — 👤

### T-02 · ✅ · 🧑‍💻 · ESLint jako bramka — *Z-011 / Z-015*
- **Decyzja właściciela (2026-06-28):** „włącz wg rekomendacji".
- **Zrobione (2026-06-28):** dodano `eslint@8.57.1` + `eslint-config-next@14.2.29` (devDeps);
  `.eslintrc.json` rozszerza `next/core-web-vitals`, rejestruje plugin `@typescript-eslint` (inaczej
  osierocone dyrektywy `eslint-disable @typescript-eslint/*` rzucały „rule not found" = 9 fałszywych
  errorów), a kosmetykę degraduje do **warning** (`no-unescaped-entities`, `exhaustive-deps`,
  `no-img-element`, `alt-text`); `rules-of-hooks` = **error**. Jawna bramka: krok `next lint --dir src`
  w `build` (przed `next build`) + `eslint.ignoreDuringBuilds:true` w `next.config` (jedno miejsce, bez
  dublowania) + skrypty `lint`/`check:lint`. Stan: **0 errorów, 64 warningi** → bramka zielona; realny
  błąd (np. hook warunkowy) ją wywala (zweryfikowane sondą). tsc czysto.
- **Opcjonalnie (przyszłość):** stopniowo zbijać 64 warningi (głównie polskie cudzysłowy w JSX i deps).

### T-03 · ✅ · 🤝 · Zakupy: ręczny DnD pozycji vs sort po trasie — *Z-221*
- **Zweryfikowane przez właściciela 2026-07-02 (T-01 OK).** Decyzja (2026-06-28): „ręczna kolejność nadpisuje trasę, per-kategoria".
- **Zrobione (2026-06-28):** kolumna `Item.order` (migracja `0198`, default 0 = brak ułożenia →
  fallback na priority/createdAt; **100% wstecznie zgodne**); loader strony sortuje
  `[order ASC, priority DESC, createdAt ASC]`; akcja `reorderItems(listId, category, orderedIds)`
  (zapis `order=index` w obrębie jednej kategorii, walidacja przynależności do listy+kategorii);
  nowe pozycje (interaktywny add) dopisywane na KONIEC kategorii (`nextCategoryOrder`). UI: `@dnd-kit/sortable`
  w `CategoryGroup` — przeciąganie ZA UCHWYT (GripVertical, hover/focus), reszta wiersza dalej
  interaktywna; optymistyczna kolejność (lista ID, resync tylko przy add/del); w trybie edycji DnD off;
  sensory Pointer/Touch(delay 200)/Keyboard (a11y). Ręczna kolejność per-kategoria nadpisuje trasę
  (trasa porządkuje tylko nagłówki kategorii). tsc + lint czysto; test kontraktu sortowania (4 asercje,
  DB) → suite 353/353.
- **Zostaje (po deployu):** wzrokowo sprawdzić DnD na telefonie (long-press) i desktopie; reorder w widoku
  z filtrem dotyczy tylko widocznych pozycji (świadome ograniczenie — pełne ułożenie w widoku „Wszystkie").

### T-04 · ✅ · 🧑‍💻 · Reguła przy usuwaniu konta właściciela zespołu — *Z-051 część*
- **Decyzja właściciela (2026-06-28):** auto-transfer na najstarszego ADMIN-a (fallback najstarszy
  członek); zespół solo kasowany wraz z zasobami.
- **Zrobione (2026-06-28):** zdjęta twarda blokada w `deleteMyAccount`; `purgeUserData` najpierw
  rozwiązuje zespoły usera-właściciela (`resolveOwnedTeams`): są inni członkowie → własność na następcę
  wg czystego `pickTeamSuccessor` (`src/lib/teams/ownership.ts`: najstarszy ADMIN → najstarszy członek),
  następca dostaje rolę OWNER, zasoby zespołu zostają; zespół solo → `team.delete()` (ownerTeam=Cascade
  sprząta zasoby+członkostwa). Respektuje `Team.ownerId` = RESTRICT (transfer/usun PRZED `user.delete`).
  6 testów jednostkowych reguły + 2 DB-gated (transfer zachowuje zasoby/preferuje ADMIN-a; solo kasuje
  kaskadowo). tsc + lint czysto; suite 364/364. UI bez zmian (nie pre-sprawdzała własności).

### T-05 · ⏸️ · 👤 · Model reklam — kierunek — *Z-474 (P2)*
- **Decyzja właściciela (2026-06-28):** reklamy kontekstowe **bez profilowania**, z opcją „wyłącz",
  ale **dopiero po wdrożeniu freemium/B2B** (zależne od T-20). Świadomie ODŁOŻONE — zero kodu teraz;
  wraca jako temat po uruchomieniu płatności i linii podziału free/premium.

---

## ETAP 2 — Łatwe autonomiczne (kod, weryfikowalne lokalnie) — 🧑‍💻

### T-06 · ✅ · 🧑‍💻 · Diagnostyka wolnych zapytań (EXPLAIN) w `/admin/health` — *Z-037 (P2)*
- **Zrobione (2026-06-27):** `src/lib/health/queryDiag.ts` (czysty parser `summarizeExplainPlan` + 4
  reprezentatywne zapytania list) + sekcja `queryDiagnostics` w `src/actions/systemHealth.ts`
  (`EXPLAIN (FORMAT JSON)` **bez ANALYZE** = plan bez wykonania, bezpieczne na prod) + karta „Diagnostyka
  zapytań" w `SystemHealthPage` (badge index/seq + szac. koszt + indeksy). Monitor regresów: Seq Scan na
  DUŻej gorącej liście = sygnał (na małej bazie Seq jest normalny).
- **Weryfikacja:** 7 testów parsera (`queryDiag.test`); 4/4 EXPLAIN poprawne na lokalnym Postgresie; tsc
  czysto; suite **326/326**. **Render karty do obejrzenia po deployu → dopisane do T-01.**

### T-07 · ✅ · 🧑‍💻 · Tańszy model dla `dispatch` — *Z-134*
- **Już spełnione architekturą operationType** (bez zmian kodu, weryfikacja 2026-06-27): `lib/llm/resolver.ts`
  mapuje `dispatch` → `OPERATION_TYPE_META.dispatch.defaultModel` = **`llama-3.1-8b-instant`** (tani/szybki),
  a `reasoning`/`generation` → `llama-3.3-70b-versatile`. Wszystkie trasy klasy dispatch (normalize,
  parse-ingredients, categorize, notes/tags, tasks/parse, import-url, magazyn/*, klasyfikacja agenta…)
  wołają z `op:"dispatch"`. Admin może nadpisać w `/admin/llm`. To dokładnie Z-134.

### T-08 · ✅ · 🧑‍💻 · Drobne P2 modułowe + dalsze testy czystej logiki
- **Zrobione (2026-06-27):** testy spójności katalogu warsztatów (`src/lib/warsztat/catalog.ts`, 6 testów):
  fallbacki `getWorkshopType`/`getSuggestions`, każdy typ ma niepustą listę, **unikalność `key` w obrębie
  typu** (łączy się z `WorkshopItem.suggestionKey`), komplet pól + poprawny kind/tier. Strażnik przed cichym
  błędem przy rozbudowie statycznego katalogu. tsc czysto; suite **332/332**.
- Pozostali kandydaci na przyszłość (gdy wrócimy do P2): Z-034/035, Z-116/117/118 + przegląd modułów per rozdział.

---

## ETAP 3 — Średnie autonomiczne (kod robię ja, zachowanie weryfikujesz po deployu) — 🤝

### T-09 · ✅ · 🤝 · Cache najgorętszych odczytów (agregat kalendarza) — *Z-072*
- **Zrobione (2026-06-27):** `getCalendarEvents` (`src/actions/calendar.ts`) owinięte w `unstable_cache`
  z **kluczem PER-USER + 60 s TTL** (`collectCalendarEvents` jest cookie-free → bezpieczne w cache).
  Świeżość gwarantuje TTL — **bez ręcznej inwalidacji** (świadomie: zero footguna „zapomniany
  revalidateTag" w dziesiątkach mutacji); `user.id` w kluczu = brak przecieku między userami. Gorący
  agregat wielomodułowy (zadania/posiłki/zdrowie/leki/flota/zwierzęta/SRS) — kalendarz, briefing, Home.
- **Weryfikacja:** tsc czysto; suite 332/332. **Zachowanie (cache'owanie, świeżość ≤60 s) — po deployu → T-01.**

### T-10 · ✅ · 🤝 · Ujednolicony „Udostępnij" — *Z-193*
- **Rdzeń (2026-06-27):** `src/lib/sharing/capabilities.ts` — JEDNA mapa „jak każdy moduł się dzieli"
  (`team`/`entity`/`projectMembers`) + helpery + etykiety. 5 testów.
- **Komponent + integracje (2026-06-28…07-02):** reużywalny, prezentacyjny `ShareControl`
  (`src/components/sharing/ShareControl.tsx`, z opcją `hideHeader`) czytający mapę zdolności — lista
  udostępnień + dodawanie po e-mailu („entity") + podpowiedź o pozostałych mechanizmach. Logika dostępu
  w Server Actions (callbacki) — zero zmian semantyki. Wpięty w **Zadania** (`TaskDetail`, zweryfikowane
  T-01) **i Zwierzęta** (`PetSections`, `hideHeader` pod `SectionShell`, zachowany komunikat o
  współdzieleniu zespołowym). tsc+lint czysto.
- **Opcjonalnie (przyszłość, niski priorytet):** ujednolicenie *wyboru właściciela-zespołu* przy
  tworzeniu/edycji zasobów (dziś każdy moduł ma własny selektor) — świadomie NIE forsuję na siłę, bo
  to szeroka zmiana o małej wartości; wzorzec `ShareControl` gotowy, gdy zajdzie potrzeba.

### T-11 · ✅ · 🤝 · Wirtualizacja długich list — *Z-071*
- **Zweryfikowane przez właściciela 2026-07-02 (T-01 OK — Kontakty płynne, j/k doscrollowuje).**
- **Zrobione (2026-06-28):** dodano `@tanstack/react-virtual@3.14.4` i owinięto najdłuższą płaską
  listę (**Kontakty**, `ContactsPage`) w wirtualizer: renderuje tylko widoczne wiersze (+overscan 8),
  dynamiczny pomiar wysokości (`measureElement` — wiersze różnej wysokości: tagi/notatki + tryb edycji),
  `scrollMargin` liczony od kontenera strony (nagłówek+szukajka w tym samym scrollu), a nawigacja
  klawiaturą woła `virtualizer.scrollToIndex` (zamiast `scrollIntoView` po refie — wiersze poza ekranem
  nie istnieją w DOM). **Wzorzec do powielenia** udokumentowany w komentarzu (load-all + client-filter).
  tsc czysto; suite 349/349.
- **Zostaje (po deployu / rollout):** wzrokowa weryfikacja płynności i nawigacji j/k na Kontaktach
  (po deployu → T-01); powielenie wzorca na kolejne długie listy gdy realnie urosną (np. magazyn — ale
  to lista grupowana w sekcjach, wymaga spłaszczenia indeksu jak w Z-232).

### T-12 · ✅ · 🤝 · Role rodzic/dziecko w rodzinie — *Z-194*
- **Rdzeń (2026-06-28):** kolumna `TeamMember.moduleAccess` (TEXT JSON `string[]`|NULL, migr. `0197`)
  + czysty helper `src/lib/teams/memberAccess.ts` (`canMemberAccessModule`, parse/serialize,
  `RESTRICTABLE_MODULES`+etykiety z mapy Z-193). Reguła: rodzice OWNER/ADMIN = pełny dostęp; dziecko
  `null` = pełny (wstecznie zgodne); `[]` = brak; lista = tylko wymienione. 13 testów jednostkowych.
- **Dokończone (2026-06-28):** akcja `setMemberModuleAccess` (ADMIN/OWNER, nie dla OWNER/siebie) +
  UI „Dostęp" per-domownik w `MemberList` (`/settings/team/[id]`: checkboxy modułów, wszystkie
  zaznaczone = `null` = pełny dostęp). **Egzekwowanie:** `getAccessibleTeamIds(userId, moduleId)`
  wpięte w gettery-odczyty 11 modułów team-owned (shopping, notes, kitchen [recipes/cookbooks/
  mealplans/pantry], health [+medications], habits, flota, portfel [+budgets/reports], languages,
  magazynowanie, warsztaty, pets [+husbandry/breeding]) — zamiast `getUserTeamIds` w gałęzi
  `user.id` (gardy-zapisy `userId` nietknięte). **100% wstecznie zgodne** (default null = bez zmian).
  Test DB egzekwowania (dziecko z ograniczeniem nie widzi zespołu dla zablokowanego modułu). tsc+lint;
  suite 369/369.
- **Poza zakresem (inny model współdzielenia):** `tasks` (projectMembers/entity — nie `ownerTeamId`+
  `getUserTeamIds`) i `contacts` (user-only) — egzekwowanie tam wymaga osobnego podejścia (follow-up).

---

## ETAP 4 — Wymaga Twojego konta/klucza/konfiguracji (zewnętrzne) — 🔓 / 🤝

### T-13 · 🔓 · 🤝 · Error-tracking + uptime + alert 5xx — *Z-090*
- **Gotowe:** seam `reportClient/ServerError`, `instrumentation.ts` (punkt initu), publiczny `/api/health`
  (200/503 + ping DB).
- **Brakuje (Ty):** ustawić `SENTRY_DSN` w env Render + (opcjonalnie) `npm i @sentry/nextjs` i odkomentować
  init; wybrać zewn. uptime-monitor (UptimeRobot/Better Uptime) pingujący `/api/health`; kanał alertu 5xx
  (e-mail/Slack).

### T-14 · 🔓 · 🤝 · DR: włączenie PITR na Neon + release-command Render — *Z-093 / Z-092*
- **Gotowe:** runbook DR (`docs/devops/runbook-deploy-rollback.md`) — restore z PITR/branch Neona +
  checklist; build artefaktu jest DB-free.
- **Brakuje (Ty):** włączyć PITR na koncie Neon + przećwiczyć restore (RPO/RTO); skonfigurować
  release-command na Render, by w pełni odsprzęgnąć migrację od build/deploy.

### T-15 · 🔓 · 🤝 · Integracje Gmail / Google Calendar — *Z-150 / Z-151 / Z-156*
- **Gotowe:** wzorzec per-user OAuth (Drive, scope `drive.file`) do powielenia; feed iCal (jednostronny)
  już jest.
- **Brakuje (Ty):** decyzja o zakresach + **rozszerzenie scope OAuth Google + przejście weryfikacji ekranu
  zgody (Google review)** dla zakresów wrażliwych. Potem ja implementuję klientów (odczyt Kalendarza, Gmail).

---

## ETAP 5 — Trudne / architektoniczne (większy nakład) — 🧑‍💻

### T-16 · ✅ · 🧑‍💻 · Wyszukiwanie pełnotekstowe notatek (FTS) — *Z-240*
- **Decyzja właściciela (2026-07-02):** „rób FTS, zgoda na dryf".
- **Zrobione (2026-07-02):** wariant **trigramowy** (najbezpieczniejszy — bez przepisywania logiki
  dostępu na surowy SQL): migracja `0201` = `CREATE EXTENSION pg_trgm` + indeksy GIN `gin_trgm_ops`
  na `Note.title`/`Note.content`. Przyspieszają istniejące `col ILIKE '%q%'` (zero zmian zapytania/
  zachowania/wyników, filtr zostaje w Prisma) — potwierdzone `EXPLAIN`: `Bitmap Index Scan on
  Note_title_trgm_idx`. Do tego **ranking trafności app-level** (`src/lib/notes/searchRank.ts`:
  tytuł waży ~3×, całe pole/prefiks/początek słowa > środek, liczba trafień) wpięty w `getNotes` tylko
  przy `search` (bez `search` kolejność bez zmian). 12 testów (9 rankingu + 3 DB: rozszerzenie/indeksy
  istnieją, filtr poprawny, planer używa indeksu). tsc+lint czysto.
- **ŚWIADOMY DRYF (zaakceptowany):** rozszerzenie + indeksy wyrażeniowe żyją tylko w migracji `0201`
  (nie w `schema.prisma`) → `migrate diff` pokaże dryf. Bezpieczne przy `migrate deploy`; **nie**
  uruchamiać `migrate dev`/auto-fix na prodzie (mógłby usunąć indeksy). Udokumentowane w migracji.

### T-17 · ✅ · 🧑‍💻 · Kolejka Job dla ciężkich operacji AI — *Z-131*
- **Decyzja właściciela (2026-07-02):** Faza 1, worker in-process (prod płatny = nie usypia); projekt
  wieloworkerowy pod przyszłą skalę; awans do osobnego workera Render „gdy ruch zażąda" (bez zmiany kodu).
- **Faza 1 — rdzeń gotowy (2026-07-02):** model `Job` (migr. `0202`; status/attempts/backoff/runAfter/
  lockedAt/ownerId/dedupeKey; brak FK — sprzątany w `purgeUserData`, RODO). Kolejka
  `src/lib/jobs/queue.ts`: `enqueue` (idempotencja dedupeKey), **`claimNext` = `SELECT … FOR UPDATE
  SKIP LOCKED`** (wieloworkerowo bez podwójnego wzięcia), `complete`/`fail`+wykładniczy backoff,
  `failJobPermanent`, odzysk po crashu (visibility timeout), `cleanupOldJobs`. Worker in-process
  (`worker.ts`, singleton, `JOBS_WORKER_DISABLED` do testów) **startowany leniwie z tras API**
  (`startJobWorker()` przy pierwszym enqueue/pollingu) — **NIE** z `instrumentation.ts` (to ciągnęło
  `node:crypto` do edge-bundla i wywalało `next build`; patrz doświadczenia 2026-07-02). API
  `POST /api/jobs` (allowlista typów) + `GET /api/jobs/[id]` (scoped do właściciela). Klient `runJob`
  (enqueue+polling→wynik/rzut — near-drop-in dla UI). **10 testów DB** (m.in. dwa równoległe claimy =
  dokładnie jeden bierze; retry/backoff; odzysk RUNNING; dedupe). tsc+lint; suita 398/398.
- **Wpięte async — KOMPLET 10 operacji (2026-07-02):**
  - **Vision/OCR:** `kitchen.ocrImage` (ImportFromImageDialog), `kitchen.ocrText` (RecipeImagesEditor),
    `magazyn.scan` (StorageScan), `magazyn.document` (DocumentsPage).
  - **Reasoning/generation:** `kitchen.generateRecipe` (ImportFromAIDialog), `kitchen.planWeek`
    (PlanWeekDialog — handler czyta przepisy/spiżarnię po `ownerId`), `magazyn.insights`
    (StorageAnalytics), `magazyn.orderDraft` (PurchaseOrders), `pets.insights` (WelfareSuggestions),
    `stores.generate` (StoreWizard).
  - Każda: handler w `src/lib/jobs/handlers/*`, rejestr + allowlista, stara trasa cienka (deleguje),
    klient woła `runJob` (near-drop-in). „Twarde" ops rzucają `JobError`; „miękkie" (insights/tips/
    order-draft) degradują łagodnie (`unavailable`). Zweryfikowane `next build` (exit 0) + suita 398/398.
  - **Świadomie SYNC:** skan w asystencie AI (`AICommandSheet`, interaktywny czat), briefing, oraz
    szybki dispatch (parse/normalize/categorize/tags/title/search/enrich, notes qa/rewrite).
- **Hardening obserwowalności + skali (2026-07-14):** panel admina **`/admin/jobs`** (liczniki wg
  statusu, aktywne wg typu, top konsumenci per-user, lista ostatnich zadań, ręczny **retry**/anuluj,
  sprzątanie 24h+; `actions/jobs.ts`, admin-only) + **limit uczciwości** aktywnych zadań na użytkownika
  (`MAX_ACTIVE_JOBS_PER_OWNER=20` w `enqueue` → `QuotaError` → HTTP 429, sprawdzany **po** dedupe, by
  idempotentny re-submit nie padał). Nowe helpery `countActiveJobsForOwner`/`requeueJob`/`cancelJob`.
  4 nowe testy (limit + dedupe-bypass + admin retry/cancel). tsc+lint+`next build` (exit 0); suita 400+4.
- **Faza 2 (przyszłość, gdy ruch zażąda):** wynieść workera do osobnej usługi Render (ten sam kod
  kolejki — `SKIP LOCKED` już wieloworkerowy); knobki współbieżności/per-user.

### T-18 · ⏸️ · 🧑‍💻 · Warstwa i18n `t()` (przyrostowo) — *Z-115*
- **Decyzja właściciela (2026-07-14):** świadomie **ODŁOŻONE**. Produkcja służy na razie tylko właścicielowi
  (apka PL). i18n wracamy dopiero **~100 użytkowników na produkcji** po oficjalnym wydaniu wersji PL —
  wtedy dokładamy inne języki. Zero kodu teraz.
- Scaffolding `t()` + ekstrakcja stringów. `formatMoney` już na `Intl.NumberFormat`. Duże, przyrostowe.

---

## ETAP 6 — Biznes / prawo / strategia (głównie Ty; duży ciężar) — 🔓

### T-19 · 🔓 · 👤 · Treść prawna: polityka prywatności + regulamin — *Z-053*
- **Gotowe:** mechanizm zgód (`UserConsent`, wersjonowanie), strony `/legal/*`, baner, rejestr
  podprocesorów (Google/Groq/Neon/Render). Treść = `src/lib/legal/documents.ts` (oznaczona „robocza").
- **Brakuje (Ty):** zatwierdzenie treści przez prawnika/DPO + ewentualne umowy powierzenia z podprocesorami.

### T-20 · 🔓 · 🤝 · Płatności + cennik free/premium — *Z-473 / Z-470*
- **Gotowe:** model `Subscription` + `src/lib/plans.ts` (limity AI per plan, `hasFeature`/`getActivePlan`),
  budżet AI per plan, sekcja „Twój plan" w Ustawieniach.
- **Brakuje (Ty + ja):** wybór bramki (**Stripe** vs **Przelewy24** — Stripe bywał problematyczny na
  Twojej sieci, do potwierdzenia), dane firmy/VAT, **linia podziału funkcji free/premium** + ceny. Potem ja:
  integracja bramki + webhooki statusów → `Subscription`, faktury/VAT, mapowanie funkcji premium.

### T-21 · 🔓 · 🤝 · Dane zdrowotne: field-encryption + „zero reklam" — *Z-270 część*
- **Gotowe:** AI opt-in dla danych zdrowotnych (domyślnie OFF), at-rest na poziomie Neon.
- **Brakuje (decyzja):** czy wdrażać **field-encryption** wrażliwych pól (wpływa na wyszukiwanie/trendy) +
  zarządzanie kluczami; potwierdzenie polityki „zero reklam w Zdrowiu/Finansach".

### T-22 · 🔓 · 🤝 · 2FA + zarządzanie sesjami/urządzeniami — *Z-058*
- **Gotowe:** logowanie Google, szyfrowanie kluczy at-rest (`secrets.ts`); procedura sekretów (Z-054) ✅.
- **Brakuje (decyzja):** czy/kiedy 2FA + zarządzanie sesjami (po fundamencie RODO).

### T-23 · 🔓 · 👤 · Pierwszy vertical / podaplikacja branżowa — *Z-490*
- **Gotowe:** modularna architektura + RBAC + warstwa planów do pakietów branżowych.
- **Brakuje (decyzja):** którą branżę uruchamiamy pierwszą (Hodowca / Gastronomia / Flota B2B /
  Rolnictwo) i w jakim zakresie MVP.

### T-24 · 🔓 · 👤 · Ekonomika ARPU / CAC / LTV — *Z-510 część*
- **Gotowe:** `/admin/metrics` liczy realny koszt AI / MAU z `AiUsage` (cena tokenów konfigurowalna).
- **Brakuje:** źródło przychodów (billing — T-20) + koszt pozyskania (marketing) do policzenia ARPU/CAC/LTV.
  Zależne od T-20.

### T-25 · ⬜ · 👤 · Strategia podaplikacji + model ilościowy + marketing — *Z-490–495 / Z-512–515 / Z-530–535*
- Całe obszary biznesowe (nie kod): plan verticali, pełny model kosztów/przychodów, pozycjonowanie/ICP/kanały.
  Do wspólnego omówienia.

---

_**Postęp ETAP 2 — UKOŃCZONY (2026-06-27):** T-06 ✅ (Z-037 diagnostyka EXPLAIN), T-07 ✅ (Z-134 już
spełnione architekturą operationType), T-08 ✅ (testy spójności katalogu warsztatów). Suite 332/332.
**Następne: ETAP 3 (T-09…T-12) — deploy-zależne, podejmę na „rób dalej"; ETAP 1 (T-02…T-05) czeka na Twoje decyzje.**_
_**Postęp ETAP 3 (2026-06-28):** T-09 ✅, T-10 🟡 (rdzeń), **T-11 🟡** (rdzeń: Kontakty zwirtualizowane
`@tanstack/react-virtual`, wzorzec do powielenia), **T-12 ✅** (rdzeń + egzekwowanie w 11
modułach + UI „Dostęp" domownika). Suite 369/369; tsc+lint czysto. Zostaje wzrokowa weryfikacja po
deployu (→T-01) + wzorzec wirtualizacji na kolejne listy (T-11) + ujednolicony „Udostępnij" (T-10 UI)._
_**Postęp ETAP 1 (2026-06-28, decyzje właściciela „wszystkie wg rekomendacji"):** **T-02 ✅** (ESLint
bramka), **T-03 🟡** (DnD kolejności zakupów, migr. 0198 — zostaje wizualna weryfikacja po deployu),
**T-04 ✅** (auto-transfer/usuń zespół solo przy kasowaniu konta), **T-05 ⏸️** (reklamy odłożone do
freemium). Suite 364/364; tsc + lint czysto. Pozostają decyzje właściciela: ETAP 4 (T-13/14/15 — konta/
klucze zewn.) i ETAP 6 (biznes/prawo)._
_**Postęp 2026-07-02 (weryfikacja właściciela „T-01 OK" + domknięcia):** **T-01 ✅** (wizualna
weryfikacja; przy okazji fix terminu zadania + odmaskowanie importu przepisu), **T-03 ✅**, **T-11 ✅**,
**T-10 ✅** (ShareControl wpięty w Zadania + Zwierzęta). tsc+lint czysto; pełna suita zielona.
**Pozostaje autonomicznie:** T-16 (FTS — czeka na zgodę na świadomy dryf), T-17 (kolejka Job — decyzja
o workerze), T-18 (i18n — niski priorytet). Reszta = ETAP 4/6 (konta/klucze/decyzje właściciela)._
_**Postęp 2026-07-14:** **T-16 ✅** (FTS notatek — pg_trgm + ranking), **T-17 ✅** (kolejka Job: komplet
10 operacji async + hardening: panel `/admin/jobs` + limit uczciwości per-user), **T-18 ⏸️** (i18n
świadomie odłożone do ~100 userów na prod — decyzja właściciela). tsc+lint+`next build` zielone.
**Stan autonomiczny: WYCZERPANY** — wszystkie pozostałe zadania (T-13/14/15 = ETAP 4 konta/klucze;
T-19…T-25 = ETAP 6 biznes/prawo) czekają na akcje/decyzje właściciela (patrz `PRZEWODNIK-WLASCICIELA.md`)._
_Tracker roboczy — aktualizowany po każdym zadaniu (status ⬜/🟡/🔓/⏸️ → ✅). Utworzony 2026-06-27 z
przeniesieniem rozdziału A.14 („Decyzje właściciela") w całości tutaj. Postęp historyczny `Z-NNN`: A.13._
