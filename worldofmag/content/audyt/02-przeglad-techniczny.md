# Rozdział 2 — Przegląd techniczny i architektura

Ten rozdział to **mapa techniczna** projektu — neutralny opis „co i jak”. Ocena (co dobre, co złe,
co naprawić) jest przedmiotem rozdziałów debat (Część II i III).

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | **Next.js 14** (App Router) |
| Język | **TypeScript 5** (tryb strict) |
| UI | **React 18** + **Tailwind CSS** + zmienne CSS (skinowalne) |
| Auth | **NextAuth v5 (beta)** + Google OAuth + adapter Prisma |
| Komponenty | Radix UI (headless), cmdk (paleta), Lucide (ikony), @dnd-kit (drag & drop) |
| Skanowanie | `@zxing/*` (kody kreskowe), `qrcode` (etykiety QR) |
| ORM | **Prisma 5** |
| Baza | **PostgreSQL** (Neon na produkcji, lokalny Postgres w dev — **bez SQLite**) |
| PWA | Instalowalna (service worker + generowane ikony) |
| Hosting | **Render** (Frankfurt, free tier) |

## Struktura repozytorium

Aktywna aplikacja żyje w katalogu **`worldofmag/`**. Reszta repo (`pom.xml`, `src/` AngularJS,
`_old/`) to **archiwalny, zamrożony** legacy — nietykalny. Wszystko nowe powstaje w `worldofmag/`.

```
worldofmag/
├── src/app/            # trasy (App Router)
├── src/actions/        # Server Actions (mutacje) — ~57 plików
├── src/components/     # komponenty wg modułów — ~227 plików
├── src/lib/            # logika domenowa, klienci, helpery
├── src/generated/      # moduły pieczone przy buildzie (docs, ten audyt)
├── prisma/             # schema + ~196 migracji
├── scripts/            # build/migracje/strażniki
├── content/audyt/      # ŹRÓDŁO tego dokumentu (markdown, wersjonowane)
└── docs/               # dokumentacja (m.in. e2e)
```

## App Router — wzorzec trasy

Niemal każda trasa stosuje **rozdział serwer/klient**:
- `*HomePage.tsx` lub `page.tsx` — **komponent serwerowy**: pobiera dane (akcje/Prisma), sprawdza
  sesję/uprawnienia, przekazuje dane w dół.
- `*Page.tsx` — **komponent kliencki** (`"use client"`): interaktywne UI.

Strony admina dodatkowo deklarują `export const dynamic = "force-dynamic"` (świeże sprawdzenie auth) i
na wejściu robią `if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/")`.

## Mutacje danych — Server Actions

**Każda** mutacja to Server Action w `src/actions/*`, kończona `revalidatePath()`. Zasada żelazna:
**nie dokłada się ręcznej inwalidacji cache** gdzie indziej. Istnieje strażnik
(`scripts/check-action-coverage.js`) wymuszający, by każda akcja asystenta AI (`AIAction`) miała
egzekutor — build **failuje**, jeśli nie.

## Autoryzacja i model własności

- **NextAuth v5 + Google OAuth** to jedyny sposób logowania. Sesja niesie `user.id`, `user.roles`,
  `user.permissions`.
- **RBAC:** `UserRole` → role → `RolePermission` → uprawnienia (slug `module.*`). Sprawdzanie przez
  `src/lib/permissions.ts`. Strażnik **samo-wykluczenia admina** blokuje zmianę, która zostawiłaby 0
  użytkowników z `module.admin`.
- **Własność 3-poziomowa** (helpery `src/lib/ownership.ts`):
  - **systemowa** (`userId=null, teamId=null`) — zarządzana przez admina, widoczna dla wszystkich,
  - **użytkownika** (`userId=…`),
  - **zespołu** (`ownerTeamId=…`).
  Wzorzec dostępu: `where: { OR: [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] }`. Część
  encji ma dodatkowo **współdzielenie per-encja** (`TaskShare`, `PetShare`) z rolami VIEWER/EDITOR.

## Model danych

~**130 modeli Prisma**. Konwencja wyróżniająca: **brak enumów Prisma** — statusy/rodzaje to kolumny
`String` z unią typów TS (np. `ItemStatus = "NEEDED" | "IN_CART" | "DONE" | "MISSING"`). Powód
historyczny (SQLite) zniknął, ale konwencja **została celowo utrzymana**.

**Migracje:** edycja `schema.prisma` **nie** tworzy tabel na produkcji — produkcja uruchamia
`prisma migrate deploy`, który **stosuje istniejące pliki migracji**. Każdy nowy model/kolumna wymaga
**ręcznej migracji** w `prisma/migrations/` z **unikalnym, sekwencyjnym 4-cyfrowym prefiksem**
(strażnik `check-migrations.js` failuje na nowej kolizji). Raporty są seedowane **migracjami SQL**
(dollar-quoted, idempotentne `ON CONFLICT (slug) DO …`).

## Integracja z LLM

- `src/lib/llm-client.ts` — typowany klient owijający trasy `/api/llm/*` (namespace’y: notes, tasks,
  shopping, stores, kitchen, languages, magazynowanie, pets).
- **Asystent Home** jest osobny — wołany jako surowe trasy: `/api/llm/home/agent` (pętla agenta po
  SSE), `/api/llm/home/execute` (wykonanie `AIAction[]`), `/api/llm/home/briefing`.
- **Routing providerów/modeli jest DB-driven** (`/admin/llm`, `LlmProvider` + `LlmAssignment`),
  rozstrzygany **per typ operacji** (`dispatch`, `reasoning`, `vision`, `generation`) w
  `src/lib/llm/resolver.ts`. Domyślny provider: Groq (OpenAI-compatible). Klucze **szyfrowane w
  spoczynku** (`src/lib/crypto/secrets.ts`, AES-256-GCM) i maskowane w UI.
- Reguła-fallback bez LLM dla kategoryzacji: `categorize.ts` (~500 słów PL+EN).

## Systemy przekrojowe

- **Kosz / soft-delete** (`TrashItem`, `lib/trash.ts`) — zrzut JSON encji + retencja.
- **Dziennik audytu** (`AuditLog`, `lib/audit.ts`) — zmiany RBAC/config; **bez FK do User** (zrzut
  e-maila aktora, by historia przeżyła usunięcie konta).
- **Zdrowie systemu** (`actions/systemHealth.ts`) — liczone na żywo (brak modelu).
- **Google Drive** — per-użytkownik OAuth (`drive.file`), rejestr `DriveFile`, raporty mogą trzymać
  treść na Drive.
- **Powiadomienia, kalendarz, skórki, personalizacja pulpitu** — opisane funkcjonalnie w Rozdz. 1.

## Pipeline buildu

`npm run build` =
`copy-docs.js && copy-audyt.js && check-action-coverage.js && check-migrations.js && prisma generate && next build && migrate.js`.
- `copy-docs.js` / `copy-audyt.js` — pieką dokumentację i ten audyt do `src/generated/`.
- strażniki — pokrycie akcji AI i numeracja migracji.
- `migrate.js` — `prisma migrate deploy` (z retry na zimny start Neona) + seed. **Dotyka produkcyjnej
  bazy** — nie uruchamia się go lokalnie na prod `DATABASE_URL`. Lokalna weryfikacja to `next build`
  (sam kompilator/typy, bez DB).

## Hosting i workflow gita

- **Render** (Frankfurt, free tier), auto-deploy na push do `master` (produkcja). Free tier **usypia
  po 15 min** → zimny start ~10–15 s.
- **Neon PostgreSQL** (Frankfurt).
- Workflow: **`feature (claude/*) → develop → master`**. `develop` to środowisko testowe (auto-deploy);
  `master` to produkcja (promocja tylko na wyraźną prośbę).

## Wniosek rozdziału

Architektura jest **spójna i nowoczesna**: jeden framework, jeden ORM, jasne wzorce (Server Actions +
`revalidatePath`, własność 3-poziomowa, RBAC, DB-driven LLM, strażniki w buildzie). To solidny
fundament. Pytania otwarte — które rozbiorą kolejne rozdziały — dotyczą **skali** (czy te wzorce
udźwigną 100M), **kosztów** (free tier, tokeny LLM), **bezpieczeństwa/RODO** i **jednolitości UI** przy
tak dużej powierzchni.
