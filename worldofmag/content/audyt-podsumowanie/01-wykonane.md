# Co zostało wykonane

> **Po co ta strona.** To samodzielne, aktualne podsumowanie **wszystkich zmian wdrożonych po audycie**
> — tak żeby wracając do dalszych prac poaudytowych **nie trzeba było zaglądać do starego audytu ani do
> innych raportów**. Pełny audyt (z rozdziałami i rekomendacjami `Z-NNN`) żyje pod
> **`/admin/audyt`** jako głęboka referencja; tutaj masz skondensowany stan realizacji.
>
> **Oznaczenia:** `T-NN` = zadanie z żywego trackera (Dodatek A.16), `Z-NNN` = numer rekomendacji z audytu.
> Stan na **2026-07-14**.

---

## Skrót: co jest zrobione

Zamknięte zostały **ETAP 0–3** trackera (domknięcia, tanie decyzje, łatwe i średnie zadania autonomiczne)
oraz dwa najcięższe zadania z ETAP 5: **wyszukiwanie pełnotekstowe notatek (T-16)** i **kolejka zadań AI
(T-17)**. Do tego doszły prace tej sesji poza trackerem (hardening kolejki, kosmetyka ESLint, uporządkowanie
dokumentacji, ta strona).

| Zadanie | Z-NNN | Co dostarczono | Status |
|---|---|---|---|
| **T-01** Weryfikacja wizualna po deployu | Z-114, Z-112/113 | 22 modale na wspólny `ui/Modal`, spójny EmptyState, slugify wykonawców (ł→l). Przy okazji 2 bugfixy. | ✅ zweryfikowane |
| **T-02** ESLint jako bramka | Z-011/015 | `.eslintrc.json` + krok `next lint` w buildzie; realne błędy = error, kosmetyka = warning. | ✅ |
| **T-03** Zakupy: ręczny DnD kolejności | Z-221 | `Item.order` (migr. `0198`), `reorderItems`, `@dnd-kit` za uchwyt; ręczna kolejność nadpisuje trasę per-kategoria. | ✅ zweryfikowane |
| **T-04** Usuwanie konta właściciela zespołu | Z-051 | Auto-transfer własności na następcę (`pickTeamSuccessor`, `lib/teams/ownership.ts`); zespół solo kasowany kaskadowo. | ✅ |
| **T-06** Diagnostyka wolnych zapytań | Z-037 | `lib/health/queryDiag.ts` + karta „Diagnostyka zapytań" w `/admin/health` (EXPLAIN bez ANALYZE). | ✅ |
| **T-07** Tańszy model dla `dispatch` | Z-134 | Już spełnione architekturą `operationType` (`llama-3.1-8b-instant` dla dispatch). | ✅ |
| **T-08** Drobne P2 + testy czystej logiki | — | Testy spójności katalogu warsztatów (`lib/warsztat/catalog.ts`). | ✅ |
| **T-09** Cache agregatu kalendarza | Z-072 | `getCalendarEvents` w `unstable_cache`, klucz per-user + 60 s TTL (bez ręcznej inwalidacji). | ✅ zweryfikowane |
| **T-10** Ujednolicony „Udostępnij" | Z-193 | `lib/sharing/capabilities.ts` + reużywalny `ShareControl`; wpięty w Zadania i Zwierzęta. | ✅ zweryfikowane |
| **T-11** Wirtualizacja długich list | Z-071 | `@tanstack/react-virtual` na Kontaktach; nawigacja `j/k` przez `scrollToIndex`. Wzorzec do powielenia. | ✅ zweryfikowane |
| **T-12** Role rodzic/dziecko w rodzinie | Z-194 | `TeamMember.moduleAccess` (migr. `0197`) + `canMemberAccessModule` + UI „Dostęp"; egzekwowane w 11 modułach team-owned. | ✅ |
| **T-16** Wyszukiwanie pełnotekstowe notatek | Z-240 | Indeksy trigramowe `pg_trgm` (migr. `0201`) + ranking trafności app-level (`lib/notes/searchRank.ts`). | ✅ |
| **T-17** Kolejka Job dla ciężkich operacji AI | Z-131 | Model `Job` (migr. `0202`), `SKIP LOCKED`, worker, 10 operacji async, panel `/admin/jobs`, limit uczciwości. | ✅ |

Weryfikacja globalna: **tsc + ESLint + `next build` (exit 0) + suita testów 400/400**. Zadania oznaczone
„zweryfikowane" domknął właściciel na żywo (**„T-01 OK", 2026-07-02**); reszta potwierdzona buildem/testami
i czeka na smoke-test na `develop`.

---

## Szczegóły — ETAP 0–1 (domknięcia i tanie decyzje)

### T-01 — weryfikacja wizualna + 2 bugfixy
Modale przeniesione na jeden dostępny `ui/Modal`, ujednolicony `EmptyState`, poprawiony `slugify`
wykonawców (polskie znaki: „Łódź" → `lodz`). Przy weryfikacji wyłapane i naprawione dwa realne błędy:

- **Termin zadania = „Invalid Date":** `datetime-local` zwraca czas **lokalny**, a doklejanie `":00"`/
  strefy psuło parsowanie → wydzielony `lib/dateInput.ts` (`parseDateInput`) + testy.
- **Import przepisu zwracał 422** maskując prawdziwą przyczynę „LLM nieskonfigurowany" → `extractWithLLM`
  zwraca teraz czytelny `llmError`.
- Sprostowano też instrukcję: **dodawanie pozycji zakupów jest inline** (pole „Dodaj produkt…"), nie modal.

### T-02 — ESLint jako bramka jakości
`eslint` + `eslint-config-next` w devDeps; `.eslintrc.json` rozszerza `next/core-web-vitals`, rejestruje
plugin `@typescript-eslint`, degraduje kosmetykę do **warning**, a `rules-of-hooks` trzyma jako **error**.
Bramka: krok `next lint --dir src` w `build`. Realny błąd (np. hook warunkowy) wywala build.

### T-03 — ręczna kolejność zakupów vs sort po trasie
Kolumna `Item.order` (migracja `0198`, default 0 = brak ułożenia, 100% wstecznie zgodne); loader sortuje
`[order ASC, priority DESC, createdAt ASC]`; akcja `reorderItems(listId, category, orderedIds)`. UI:
`@dnd-kit/sortable` — przeciąganie **za uchwyt**, reszta wiersza dalej interaktywna. Ręczna kolejność
per-kategoria nadpisuje trasę (trasa porządkuje tylko nagłówki kategorii).

### T-04 — bezpieczne usuwanie konta właściciela zespołu
Zdjęta twarda blokada; `purgeUserData` najpierw rozwiązuje zespoły: jeśli są inni członkowie → własność na
następcę wg czystego `pickTeamSuccessor` (najstarszy ADMIN → najstarszy członek), zespół solo → kasowany
kaskadowo. Respektuje `Team.ownerId = RESTRICT`. 6 testów reguły + 2 DB-gated.

---

## Szczegóły — ETAP 2–3 (autonomiczne: kod + weryfikacja po deployu)

### T-06 — diagnostyka zapytań w `/admin/health`
`summarizeExplainPlan` (czysty parser) + `EXPLAIN (FORMAT JSON)` **bez ANALYZE** (plan bez wykonania,
bezpieczne na prod) + karta z badge index/seq, szac. kosztem i listą indeksów. Monitor regresów: Seq Scan
na dużej gorącej liście = sygnał.

### T-07 — tańszy model dla klasy `dispatch`
Bez zmian kodu — architektura `operationType` (`lib/llm/resolver.ts`) już mapuje `dispatch` na szybki/tani
`llama-3.1-8b-instant`, a `reasoning`/`generation` na `llama-3.3-70b-versatile`. Admin może nadpisać w `/admin/llm`.

### T-09 — cache najgorętszego odczytu (agregat kalendarza)
`getCalendarEvents` owinięte w `unstable_cache` z kluczem **per-user + 60 s TTL**. Świeżość gwarantuje TTL,
**bez ręcznej inwalidacji** (świadomie — zero footguna „zapomniany revalidateTag" w dziesiątkach mutacji).
`user.id` w kluczu = brak przecieku między userami.

### T-10 — ujednolicony „Udostępnij"
`lib/sharing/capabilities.ts` — jedna mapa „jak każdy moduł się dzieli" (`team`/`entity`/`projectMembers`).
Reużywalny, prezentacyjny `ShareControl` (opcja `hideHeader`) wpięty w **Zadania** i **Zwierzęta**; logika
dostępu została w Server Actions (zero zmian semantyki).

### T-11 — wirtualizacja długich list
`@tanstack/react-virtual` na najdłuższej płaskiej liście (**Kontakty**): renderuje tylko widoczne wiersze
(+overscan), dynamiczny pomiar wysokości, a nawigacja klawiaturą woła `virtualizer.scrollToIndex`. Wzorzec
(load-all + client-filter) udokumentowany do powielenia, gdy inne listy realnie urosną.

### T-12 — granularne role modułowe domownika
Kolumna `TeamMember.moduleAccess` (JSON `string[]`|NULL, migr. `0197`) + helper `canMemberAccessModule`
(`lib/teams/memberAccess.ts`). Reguła: rodzice OWNER/ADMIN = pełny dostęp; dziecko `null` = pełny (wstecznie
zgodne), `[]` = brak, lista = tylko wymienione. Akcja `setMemberModuleAccess` + UI „Dostęp" per-domownik;
egzekwowane przez `getAccessibleTeamIds` w getterach **11 modułów team-owned**.

---

## Szczegóły — ETAP 5 (trudne / architektoniczne)

### T-16 — wyszukiwanie pełnotekstowe notatek (FTS)
Wariant **trigramowy** (najbezpieczniejszy — bez przepisywania logiki dostępu na surowy SQL): migracja
`0201` = `CREATE EXTENSION pg_trgm` + indeksy GIN `gin_trgm_ops` na `Note.title`/`Note.content`. Przyspieszają
istniejące `ILIKE '%q%'` (zero zmian zapytania/wyników). Do tego **ranking trafności app-level**
(`lib/notes/searchRank.ts`: tytuł waży ~3×, dopasowanie całego pola/prefiksu/początku słowa > środek, liczba
trafień) — wpięty w `getNotes` tylko przy `search`.

> **Świadomy dryf (zaakceptowany przez właściciela):** rozszerzenie + indeksy wyrażeniowe żyją tylko w
> migracji `0201`, nie w `schema.prisma` → `migrate diff` pokaże dryf. Bezpieczne przy `migrate deploy`;
> **nie** uruchamiać `migrate dev`/auto-fix na prodzie (mógłby usunąć indeksy).

### T-17 — kolejka Job dla ciężkich operacji AI
Model `Job` (migr. `0202`: status/attempts/backoff/runAfter/lockedAt/ownerId/dedupeKey; brak FK — sprzątany
w `purgeUserData`, RODO). Kolejka `lib/jobs/queue.ts`: `enqueue` (idempotencja `dedupeKey`), **`claimNext` =
`SELECT … FOR UPDATE SKIP LOCKED`** (wieloworkerowo bez podwójnego wzięcia), `complete`/`fail` + wykładniczy
backoff, odzysk po crashu (visibility timeout ~2 min), `cleanupOldJobs`. Worker in-process (`worker.ts`,
singleton) **startowany leniwie z tras API** — **NIE** z `instrumentation.ts` (to ciągnęło `node:crypto` do
edge-bundla i wywalało `next build`; patrz `doświadczenia.md` 2026-07-02). API `POST /api/jobs` (allowlista
typów) + `GET /api/jobs/[id]` (scoped do właściciela). Klient `runJob` (enqueue+polling→wynik) — near-drop-in
dla UI.

**Wpięte async — komplet 10 operacji AI:**

- **Vision/OCR:** `kitchen.ocrImage`, `kitchen.ocrText`, `magazyn.scan`, `magazyn.document`.
- **Reasoning/generation:** `kitchen.generateRecipe`, `kitchen.planWeek`, `magazyn.insights`,
  `magazyn.orderDraft`, `pets.insights`, `stores.generate`.
- „Twarde" operacje rzucają `JobError`; „miękkie" (wnioski/porady/draft) degradują łagodnie (`unavailable`).
- **Świadomie SYNC:** skan w asystencie AI (interaktywny czat), briefing, szybki dispatch
  (parse/normalize/categorize/tags/title/search).

**Hardening obserwowalności + skali (ta sesja):** panel admina **`/admin/jobs`** (liczniki wg statusu,
aktywne wg typu, najwięksi konsumenci per-user, lista ostatnich zadań, ręczny **retry**/anuluj, sprzątanie
24h+; `actions/jobs.ts`) + **limit uczciwości** aktywnych zadań na użytkownika (`MAX_ACTIVE_JOBS_PER_OWNER=20`
w `enqueue` → `QuotaError` → HTTP 429, sprawdzany **po** dedupe, by idempotentny re-submit nie padał).

---

## Prace tej sesji poza trackerem

- **Usunięcie zaślepki modułu Praca/Work** — właściciel zdecydował, że moduł jest niepotrzebny; zdjęty wpis
  „Work (coming soon)" z sidebara (desktop + mobile), z `/admin/architecture` i z `CLAUDE.md`.
- **Kosmetyka ESLint: 64 → 15 warningów** — wyeliminowane w całości `no-unescaped-entities` (44→0, proste
  cudzysłowy zamykające zamienione na typograficzne `„…"`, chirurgicznie po `line:col`) i `jsx-a11y/alt-text`
  (6→0, realne `<img>` w generatorach ikon → `alt=""`, fałszywe trafienia na ikonie lucide `Image` → alias
  `ImageIcon`).
- **Uporządkowanie dokumentacji** — urealniony `CLAUDE.md` (roadmapa: dodawanie list, „Zakończ zakupy" i UI
  Truck były już zrobione; tabela modułów), aktualizacja trackera i przewodnika właściciela.
- **Raporty admina (migr. `0203`)** — odświeżony raport `przewodnik-wlasciciela` + nowy `tracker-roboczy` w
  `/reports`, plus **ta strona podsumowania** (`/admin/audyt-podsumowanie`).
- **Wpisy do `doświadczenia.md`** — m.in.: instrumentation vs edge-bundle (`node:crypto`), kolejność
  dedupe→limit w kolejce, fałszywy alarm a11y na ikonie lucide `Image`, artefakt „długi build ubija lokalny
  Postgres".
