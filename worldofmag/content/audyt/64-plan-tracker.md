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

### T-01 · 🟡 · 🤝 · Weryfikacja wizualna po deployu (modale / EmptyState / slugi) — *Z-114, Z-112/113, slugify*
- **Stan:** kod gotowy i skompilowany (tsc), ale **nie zweryfikowany na żywo** (pracujemy na gałęzi
  roboczej, deploy wstrzymany limitem Render). 22 modale przeniesione na dostępny `ui/Modal`, EmptyState
  ujednolicony, slugify wykonawców naprawiony (ł→l), migracja `0196` (onDelete) gotowa.
- **Twoja akcja (👤):** po deployu na `develop` — kliknąć kilka modali (np. dodawanie do listy zakupów,
  edycja spiżarni, import przepisu), sprawdzić puste stany i polskie slugi (`/providers/…`); potwierdzić,
  że nic nie jest rozjechane. **+ `/admin/health` → nowa karta „Diagnostyka zapytań" (T-06) renderuje się. + Kalendarz/Home ładuje się, dane świeże po ≤60 s (cache T-09). + Kontakty (T-11): lista płynnie się przewija, j/k przeskakuje zaznaczenie i doscrollowuje, edycja wiersza nie rozjeżdża layoutu.**
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

### T-03 · 🔓 · 👤 · Zakupy: ręczny DnD pozycji vs sort po trasie — *Z-221*
- **Gotowe:** `@dnd-kit` już w projekcie (plan posiłków) — wzorzec do powielenia.
- **Brakuje (decyzja):** czy ręczny `Item.order` ma nadpisywać sort po trasie sklepu? Per-kategoria czy
  globalnie? To zmienia UX, nie tylko kod. Po decyzji: migracja `Item.order` + akcja reorder + UI.

### T-04 · 🔓 · 👤 · Reguła przy usuwaniu konta właściciela zespołu — *Z-051 część*
- **Gotowe:** blokada usunięcia + akcja `transferTeamOwnership`.
- **Brakuje (decyzja):** co z zasobami zespołu, gdy właściciel kasuje konto — auto-transfer (do kogo?)
  czy auto-usunięcie solo-zespołów? Dziś: blokada + ręczny transfer.

### T-05 · 🔓 · 👤 · Model reklam — kierunek — *Z-474 (P2)*
- **Brakuje (decyzja):** czy/jak reklamy kontekstowe (bez profilowania) z opcją „wyłącz" — dopiero po
  freemium/B2B. Decyzja kierunkowa.

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

### T-10 · 🟡 · 🤝 · Ujednolicony „Udostępnij" — *Z-193*
- **Rdzeń zrobiony (2026-06-27):** `src/lib/sharing/capabilities.ts` — JEDNA mapa „jak każdy moduł się
  dzieli" (`team`/`entity`/`projectMembers`) + helpery `getShareCapability`/`canShare`/`isShareable` +
  etykiety mechanizmów. 5 testów (m.in. „entity tylko tasks/pets", user-only→null). tsc czysto.
- **Zostaje (UI — po deployu / przy zdrowym tooling):** reużywalny komponent „Udostępnij" czytający mapę i
  zastępujący 3 rozjechane wejścia (TaskShare w `TaskDetail`, PetShare w `PetSections`, wybór zespołu)
  jednym spójnym. Czyste UI → weryfikacja wzrokowa po deployu.

### T-11 · 🟡 · 🤝 · Wirtualizacja długich list — *Z-071*
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

### T-12 · 🟡 · 🤝 · Role rodzic/dziecko w rodzinie — *Z-194*
- **Rdzeń zrobiony (2026-06-28):** kolumna `TeamMember.moduleAccess` (TEXT JSON `string[]`|NULL,
  migracja `0197`) + czysty helper `src/lib/teams/memberAccess.ts` (`canMemberAccessModule`,
  `parseModuleAccess`/`serializeModuleAccess`, `RESTRICTABLE_MODULES` derywowane z mapy współdzielenia
  Z-193). Reguła: „rodzice" OWNER/ADMIN = pełny dostęp; „dziecko" `null` = pełny (wstecznie zgodne);
  `[]` = brak; lista = tylko wymienione; moduł nie-team zawsze dostępny. 12 testów; tsc czysto.
  Seam egzekwowania: `getAccessibleTeamIds(userId, moduleId)` w `server-utils` (gotowy do wpięcia).
- **Zostaje (po deployu / rollout):** wpiąć `getAccessibleTeamIds` w odczyty modułów team-aware
  zamiast `getUserTeamIds` + UI „dostęp domownika" (przypisanie modułów dziecku w `/settings/team/[id]`).

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

### T-16 · ⬜ · 🧑‍💻 · Wyszukiwanie pełnotekstowe notatek (FTS) — *Z-240*
- tsvector+GIN (lub trigram) zamiast `ILIKE` skanującego. **Uwaga techniczna:** surowy indeks/extension
  reintrodukuje dryf w Prisma (właśnie wyzerowany) albo wymaga preview-features `postgresqlExtensions` —
  do zrobienia świadomie, nie „przy okazji".

### T-17 · ⬜ · 🧑‍💻 · Kolejka Job dla ciężkich operacji AI — *Z-131*
- Model `Job` (status/retry) + worker/polling; wpięcie OCR / plan tygodnia / analizy jako async-status
  zamiast blokujących żądań. Wymaga runtime workera.

### T-18 · ⬜ · 🧑‍💻 · Warstwa i18n `t()` (przyrostowo) — *Z-115*
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
`@tanstack/react-virtual`, wzorzec do powielenia), **T-12 🟡** (rdzeń: `canMemberAccessModule` +
migracja `0197` + 12 testów). Suite 349/349; tsc czysto. Zostaje wzrokowa weryfikacja po deployu (→T-01)
+ rollout egzekwowania/UI (T-12) i wzorca na kolejne listy (T-11)._
_Tracker roboczy — aktualizowany po każdym zadaniu (status ⬜/🟡/🔓/⏸️ → ✅). Utworzony 2026-06-27 z
przeniesieniem rozdziału A.14 („Decyzje właściciela") w całości tutaj. Postęp historyczny `Z-NNN`: A.13._
