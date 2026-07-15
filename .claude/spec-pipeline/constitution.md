# Omnia — Konstytucja inżynierska (Spec-Driven Pipeline)

> **Czym jest ten plik.** To zestaw **twardych, nienegocjowalnych reguł** projektu WorldOfMag /
> Omnia. Każdy etap pipeline'u (`/specify → /plan → /tasks → /implement → /verify → /review`) ma
> obowiązek być z nimi zgodny. Gdy spec, plan albo kod łamie którąś regułę — to jest błąd blokujący,
> nie kwestia gustu. Źródłem prawdy dla architektury pozostaje `CLAUDE.md`; ten plik wyciąga z niego
> reguły, które najłatwiej złamać, i podnosi je do rangi bramek jakości.

Numeracja (`C-NN`) jest stała — odwołuj się do reguł po numerze w specach, planach i recenzjach.

---

## A. Zakres i struktura repo

- **C-01 — Pracujemy tylko w `worldofmag/`.** Cały nowy kod, migracje, testy i skrypty żyją w
  `worldofmag/`. **Nigdy** nie dotykaj `src/` w katalogu głównym repo, `_old/`, `pom.xml` ani
  legacy AngularJS/Spring. Komendy uruchamiamy z `worldofmag/`.
- **C-02 — Alias importów `@/*` → `./src/*`.** Zawsze używaj aliasu w importach, nigdy długich
  ścieżek względnych (`../../..`).
- **C-03 — Artefakty pipeline'u żyją w `specs/<NNN-slug>/`** (katalog główny repo): `spec.md`,
  `plan.md`, `tasks.md`, `verify.md`, `review.md`. Numer `NNN` jest sekwencyjny, zero-padded (001,
  002, …). Slug = kebab-case, po angielsku lub po polsku bez znaków diakrytycznych.

## B. Baza danych i migracje

- **C-10 — Edycja `schema.prisma` NIE tworzy tabel na produkcji.** Każdy nowy model/kolumna wymaga
  **ręcznie napisanego pliku migracji** pod `prisma/migrations/<NNNN_nazwa>/migration.sql`. Prod
  odpala `prisma migrate deploy`, który tylko *aplikuje istniejące* pliki.
- **C-11 — Numer migracji jest unikalny i sekwencyjny (4 cyfry).** Nowy numer bierzemy z
  `npm run next:migration`. `npm run check:migrations` (wpięte w `build`) wywala się na *nowej*
  kolizji. **Nigdy nie zmieniaj nazwy już zaaplikowanej migracji** — `migrate deploy` kluczuje po
  pełnej nazwie katalogu, więc rename = ponowne odpalenie (CREATE/ALTER → deploy pada).
- **C-12 — Zero enumów Prisma.** Statusy/rodzaje to kolumny `String` + zawężający typ TypeScript
  (union), np. `type ItemStatus = "NEEDED" | "IN_CART" | "DONE"`. Historyczny powód (SQLite) już nie
  obowiązuje, ale konwencja zostaje — **nigdy** nie konwertuj na `enum`.
- **C-13 — Nie odpalaj `npm run build` / `scripts/migrate.js` lokalnie z prod `DATABASE_URL`.**
  `migrate.js` robi `migrate deploy` + seed na prawdziwej bazie Neon. Do lokalnej weryfikacji
  postaw lokalny Postgres (patrz C-31).
- **C-14 — Seed raportów i uprawnień robimy idempotentnymi migracjami SQL** (dollar-quoting
  `$tag$…$tag$`, `gen_random_uuid()::text`, `ON CONFLICT ("slug") DO NOTHING|UPDATE`). `slug` jest
  **globalnie unikalny**.

## C. Warstwa aplikacji

- **C-20 — Mutacje danych = Server Actions z `revalidatePath()` na końcu.** Nigdy nie dokładaj
  ręcznej inwalidacji cache gdzie indziej. Pliki akcji: `src/actions/*`.
- **C-21 — Model współwłasności `ownerId` / `ownerTeamId`** (wzajemnie wykluczające się). Dostęp
  liczymy przez `getUserTeamIds(userId)` i `where: { OR: [{ ownerId }, { ownerTeamId: { in }}] }`.
  Każdy moduł ma swój guard (`assertListAccess`, `assertNoteAccess`, …) — użyj/rozszerz istniejący.
- **C-22 — RBAC.** Nowy moduł = nowy slug `module.*` zaseedowany migracją SQL, wpięty w
  `src/lib/permissions.ts` (`PERMISSIONS`, `permissionForPath`), w rejestr modułów
  `src/lib/modules.tsx` i w `ModuleSidebar` (desktop + mobilny tab bar). Strony poza `/auth/signin`
  wymagają sesji — brak trybu anonimowego.
- **C-23 — Każda `AIAction` MUSI mieć egzekutor** w `/api/llm/home/execute`. `npm run
  check:actions` (w `build`) wywala się, jeśli brakuje handlera. Typ `AIAction` żyje w
  `src/lib/ai/aiAction.ts`; read-toole w `src/lib/ai/agentTools.ts`.
- **C-24 — Soft-delete zamiast twardego `delete`,** tam gdzie moduł to wspiera: zapis snapshotu do
  `TrashItem` (`lib/trash.ts`) z retencją; odzysk w `/trash`.
- **C-25 — Zmiany RBAC/konfiguracji logujemy w `AuditLog`** (`lib/audit.ts`, kategoria
  `rbac|config`). `AuditLog` nie ma FK do `User` — snapshotuje email aktora.

## D. UX / UI

- **C-30 — Ciemny motyw przez zmienne CSS.** Kolory bierzemy z `var(--bg-base)`, `var(--text-primary)`,
  `var(--accent-*)` itd. — **nigdy** nie hardcoduj hexów. Na kolorowych przyciskach tekst = `var(--on-accent)`,
  nie `#fff`. Skórki mogą nadpisać każdą zmienną, więc hardcode łamie skinowalność.
- **C-31 — Mobile-first i keyboard-first.** Desktopowy sidebar to `hidden md:flex`; mobilny dostaje
  top bar + overlay + dolny tab bar. **Nigdy dwa sidebary na mobile.** Respektuj
  `env(safe-area-inset-bottom)`. Min. cel dotyku `py-3`, checkboxy 20×20px. Skróty: `j/k`, `x/Space`,
  `e`, `d`, `a/n`, `/`, `Ctrl+K`, `Esc`.
- **C-32 — Teksty UI po polsku** (to prywatny system Szymona). Nazwy kategorii w promptach LLM
  traktujemy jako **polskie słowa**, nie angielskie.

## E. AI / LLM

- **C-40 — Routing modeli jest DB-driven** przez `/admin/llm` (`LlmProvider` + `LlmAssignment`),
  rozwiązywany per typ operacji w `src/lib/llm/resolver.ts` (`dispatch`/`reasoning`/`vision`/
  `generation`). Nie hardcoduj providera ani modelu w kodzie funkcji.
- **C-41 — Klucze API szyfrowane w spoczynku** (`lib/crypto/secrets.ts`) i **maskowane** w UI
  (`/admin/config`, `/admin/llm`). Nigdy nie loguj ani nie zwracaj pełnego klucza.

## F. Proces i bramki jakości

- **C-50 — Definicja „gotowe": `npm run build` przechodzi.** Build to
  `copy-docs → copy-audyt(*2) → check:actions → check:migrations → next lint → prisma generate →
  next build → migrate.js`. Dla zmiany docs-only builda nie ma — wystarcza rewizja poprawności.
  **Uwaga:** ostatni krok (`migrate.js`) rusza prod DB — patrz C-13; do CI/lokalu weryfikuj do
  kroku `next build`.
- **C-51 — Każdy naprawiony bug / nieoczywisty problem → wpis do `doświadczenia.md`** (katalog
  główny repo, po polsku, format: `## YYYY-MM-DD — tytuł` / `**Problem:**` / `**Rozwiązanie:**` /
  `**Lekcja:**`). Nie pytaj o zgodę — dopisz i zacommituj razem z fixem.
- **C-52 — Merge do `develop` po skończonym zadaniu** (gdy `build` zielony), zgodnie ze STANDING
  AUTHORIZATION w `CLAUDE.md` — automatycznie, bez pytania. `master` (produkcja) **tylko na wyraźne
  „Tak"** właściciela. Dlatego pipeline **zawsze kończy się jednym pytaniem domykającym**
  („Mistrzu Magu, czy zrobić merge develop do master?", opcja `Nie/zostaw na develop` jako rekomendowana
  pierwsza); merge `develop → master` (i push) robimy **wyłącznie** po odpowiedzi „Tak".
- **C-53 — Minimalizm.** Rozwiązanie najmniejsze z możliwych: bez nadmiarowych abstrakcji, nowych
  zależności i „przy okazji" refaktorów. Zgodność ze stylem otoczenia > osobiste preferencje.

## G. Przebieg pipeline'u (autonomia i spójność)

- **C-54 — Spójność artefaktów i zawracanie.** Artefakty są źródłem prawdy i tworzą łańcuch
  `spec.md → plan.md → tasks.md → kod` — muszą pozostać **spójne**. Gdy dowolny etap odkryje fakt,
  który zmienia **wcześniejszy** artefakt (implementacja pokazuje, że plan jest błędny; plan wykrywa
  lukę w specu; nowa odpowiedź właściciela zmienia zakres), masz obowiązek:
  1. **zaktualizować dotknięty wcześniejszy artefakt** (`spec.md`/`plan.md`/`tasks.md`) — a nie tylko
     „obejść" problem w kodzie,
  2. **przeliczyć w dół to, co z niego wynika** (zmiana speca → popraw plan i zadania; zmiana planu →
     popraw zadania) **zanim** ruszysz dalej,
  3. zostawić krótki ślad zmiany (co i dlaczego), żeby historia decyzji się zgadzała.
  Nigdy nie zostawiaj rozjazdu „kod robi X, ale spec mówi Y". Pętle wstecz są **wbudowane**: `/verify`
  i `/review` przy brakach **zawracają do `/implement`**, dopisując konkretne braki do `tasks.md`;
  gdy brak wynika z błędnego planu/speca — najpierw popraw plan/spec (pkt 1–2), potem wróć do implementacji.
- **C-55 — Jeden moment pytań, z wąską furtką.** Pytania do właściciela są **skoncentrowane w
  `/specify`**: jedno wywołanie `AskUserQuestion`, opcja **rekomendowana pierwsza** + etykieta
  `(zalecane)`. Dalsze etapy działają **autonomicznie** — rozstrzygają rozsądnym domyślnym (wzorzec
  sąsiedniego modułu, minimalizm C-53) i idą dalej. **Furtka (wyjątek):** na późniejszym etapie
  wolno zadać **jedno, zbiorcze** pytanie **tylko** gdy decyzja spełnia **wszystkie** warunki:
  (a) jest istotna dla właściciela (a nie techniczny drobiazg), (b) była nie do przewidzenia na
  `/specify`, (c) zły wybór jest kosztowny lub trudny do cofnięcia, (d) nie da się jej rozstrzygnąć z
  artefaktów, kodu ani konwencji. Wtedy **pytaj, nie zgaduj** (`AskUserQuestion`, rekomendowana
  pierwsza + `(zalecane)`), po odpowiedzi zaktualizuj artefakty wg C-54 i jedź dalej. Cel: właściciel
  wołany **jak najrzadziej**, ale **nigdy nie zgadujemy** przy naprawdę ważnej, niejednoznacznej
  decyzji. Wszystko poza tą furtką rozstrzygasz sam. **Wyjątek sankcjonowany:** obowiązkowe pytanie
  domykające o promocję `develop → master` (C-52) jest zadawane **zawsze** na końcu i nie jest liczone
  jako złamanie „jednego momentu pytań" — to świadoma bramka produkcyjna właściciela.

---

### Jak używać w pipeline
- `/specify` — sekcja *Zgodność z konstytucją* w spec musi wskazać, które reguły dotyczą feature'a;
  to główny (i domyślnie jedyny) moment pytań (C-55).
- `/plan` — plan musi jawnie zaadresować C-10..C-14 (migracje), C-20..C-25 (warstwa app), C-30..C-32 (UX).
- `/tasks` — bramki C-50 wpięte jako kroki (`check:migrations`, `check:actions`, `build`).
- `/verify` i `/review` — weryfikują zgodność z tą konstytucją punkt po punkcie i raportują naruszenia;
  przy brakach zawracają do `/implement` (C-54).
- Każdy etap — trzyma spójność artefaktów (C-54) i pyta tylko przez wąską furtkę (C-55).
