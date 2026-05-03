# Raport sesji: wdrożenie logowania Google w WorldOfMag

**Stack:** Next.js 14 (App Router) · NextAuth v5 beta · @auth/prisma-adapter · Prisma 5 · PostgreSQL (Neon free tier) · Render (free tier)

---

## Chronologia prób i wyniki

### 1. Schemat Prisma + migracja 0002

**Co zrobiono:** Dodano do `schema.prisma` modele wymagane przez NextAuth v5: `User`, `Account`, `Session`, `VerificationToken`. Poza tym: `Team`, `TeamMember`, `TeamInvitation`, pole `ownerId` na `ShoppingList`. Stworzono migration SQL `0002_auth_and_teams`.

**Problem:** Migracja długo nie aplikowała się na produkcyjną bazę Neon. Neon free tier **usypia** po 5 minutach bezczynności. Pierwsze połączenie po przebudzeniu kończy się błędem `E57P01 (terminating connection due to administrator command)`. `prisma migrate deploy` nie ma wbudowanego retry — failował za pierwszym razem.

**Rozwiązanie (ostateczne):** Retry logic w skrypcie Node.js (patrz punkt 5).

---

### 2. Próba: `start.sh` jako `startCommand`

**Co zrobiono:** Stworzono plik `start.sh` w katalogu `worldofmag/`. W `render.yaml` ustawiono `startCommand: bash worldofmag/start.sh`. Skrypt robił retry `prisma migrate deploy`, a po sukcesie uruchamiał `next start`.

**Wynik:** ❌ FAIL

**Dlaczego nie zadziałało:** Render uruchamia `startCommand` z katalogu `/opt/render/project/src/` (root repozytorium), a nie z `worldofmag/`. Ścieżka `worldofmag/start.sh` istniała, ale `npx prisma` wewnątrz skryptu nie miał dostępu do właściwego `node_modules` ani `schema.prisma`. Błąd: `sh start.sh: No such file or directory` lub `prisma: not found`.

---

### 3. Próba: `scripts/start.js` jako niestandardowy start

**Co zrobiono:** Stworzono `worldofmag/scripts/start.js` — Node.js odpowiednik `start.sh` (retry migrate + spawn `next start`). Zaktualizowano `package.json`: `"start": "node scripts/start.js"`. `render.yaml`: `startCommand: npm start`.

**Wynik:** ❌ FAIL

**Dlaczego nie zadziałało:** Render miał **cache** poprzedniego buildu. Przy kolejnym pushu zamiast przebudować aplikację, wykonał tylko "redeploy" — skopiował artefakty z poprzedniego buildu razem ze **starym `package.json`**, w którym `start` nadal był `next start`. Nowy skrypt nigdy nie był wywoływany. Logi pokazywały: `> worldofmag@0.1.0 start` → `> next start` (bez migracji).

**Kluczowe odkrycie:** Render na free tierze czasem robi "Deploying..." bez "Running build command..." — używa cached build artifacts. Nie ma gwarancji, że zmiana startCommand zostanie zastosowana bez pełnego przebudowania.

---

### 4. Próba: `src/instrumentation.ts` (Next.js startup hook)

**Co zrobiono:** Stworzono `src/instrumentation.ts` z funkcją `register()` wywoływaną przez Next.js przy starcie serwera. Funkcja robiła retry `prisma migrate deploy`. Dodano do `next.config.mjs` flagę `experimental: { instrumentationHook: true }`.

**Wynik:** ❌ FAIL

**Dlaczego nie zadziałało:** Render ponownie użył cached buildu — nowa flaga `instrumentationHook: true` w `next.config.mjs` nie była widoczna dla serwera, bo `next.config.mjs` z poprzedniego buildu nie miał tej flagi. `instrumentation.ts` nigdy nie był wywoływany.

**Dodatkowy problem:** Nawet gdyby Render przebudował poprawnie, `instrumentation.ts` w Next.js 14 jest wywoływany w **Node.js runtime** przy starcie serwera — ale uruchamianie `execSync("npx prisma migrate deploy")` synchronicznie przy starcie blokuje inicjalizację serwera.

---

### 5. Rozwiązanie migracji: `scripts/migrate.js` na końcu `npm run build`

**Co zrobiono:** Stworzono `worldofmag/scripts/migrate.js` z retry logic (5 prób, 8s przerwa). Zaktualizowano `package.json`:

```json
"build": "prisma generate && next build && node scripts/migrate.js"
```

Render `buildCommand` w `render.yaml`: `npm ci && npx prisma generate && npm run build`.

**Wynik:** ✅ SUCCESS

**Dlaczego zadziałało:** Faza **build** na Renderze zawsze uruchamia się od zera — nie ma cache dla kodu, tylko dla `node_modules` (npm ci). `npm run build` zawsze wywołuje nowy `scripts/migrate.js`. Retry logic obsługuje Neon cold-start: 5 prób × 8 sekund daje 40 sekund na przebudzenie bazy — wystarczająco.

**Logi potwierdzające:**
```
2 migrations found in prisma/migrations
No pending migrations to apply.
✔ Migrations applied.
```

---

### 6. Problem: pętla logowania Google (Edge Runtime)

**Co zrobiono:** Aplikacja po wdrożeniu pokazywała stronę logowania. Po kliknięciu "Zaloguj się przez Google" i autoryzacji w Google — aplikacja wracała z powrotem na stronę logowania. Nieskończona pętla.

**Wynik:** ❌ FAIL

**Analiza logów:**
```
[auth][error] AdapterError
[auth][cause]: Error: PrismaClient is not configured to run in Edge Runtime
    at getSessionAndUser (...middleware.js...)
```

**Dlaczego nie zadziałało:** `src/middleware.ts` importował `auth` z `@/lib/auth`, który importował `PrismaClient`. Next.js Middleware działa w **Edge Runtime** (V8 isolate, brak pełnego Node.js API). `PrismaClient` używa Node.js-specific API (`net`, `tls`, `crypto` itd.) — nie może działać w Edge Runtime.

Dodatkowo: konfiguracja `session: { strategy: "database" }` oznaczała, że NextAuth przy **każdym żądaniu** walidował token sesji przez bazę danych. Każda walidacja wymagała Prismy → każda walidacja failowała w Edge Runtime → każde żądanie kończyło się błędem → redirect na `/auth/signin` → pętla.

---

### 7. Rozwiązanie auth: split config + JWT strategy

**Co zrobiono:**

1. Stworzono `src/auth.config.ts` — konfiguracja **bez Prismy**, tylko providers i `authorized` callback:

```ts
export const authConfig = {
  providers: [Google(...)],
  pages: { signIn: "/auth/signin" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      if (nextUrl.pathname.startsWith("/auth")) return true
      if (!auth?.user) return Response.redirect(new URL("/auth/signin", nextUrl))
      return true
    }
  }
} satisfies NextAuthConfig
```

2. Zaktualizowano `src/middleware.ts` — używa TYLKO `authConfig`:

```ts
import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
export const { auth: middleware } = NextAuth(authConfig)
export default middleware
```

3. Zaktualizowano `src/lib/auth.ts` — zmieniono `strategy: "database"` → `strategy: "jwt"`:

```ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },  // ← KLUCZOWA ZMIANA
  callbacks: {
    async jwt({ token, user }) { ... },
    async session({ session, token }) { ... }
  }
})
```

4. Dodano `src/types/next-auth.d.ts` — augmentacja typów `Session` i `JWT`.

**Wynik:** ✅ SUCCESS — logowanie Google działa poprawnie.

**Dlaczego zadziałało:**
- Middleware używa `authConfig` bez Prismy → zero Prismy w Edge Runtime
- `strategy: "jwt"` → sesja live w podpisanym cookie (nie w DB)
- Middleware weryfikuje JWT signature (kryptografia, nie DB) → działa w Edge Runtime
- Prisma adapter nadal tworzy rekordy `User` i `Account` w DB, ale **nie zarządza sesją**

---

## Diagram architektury auth (finalny)

```
Użytkownik                Next.js                        Neon DB
    │                        │                               │
    │── GET /shopping ──────►│                               │
    │                   Middleware (Edge Runtime)             │
    │                   czyta JWT z cookie                    │
    │                   weryfikuje podpis ← AUTH_SECRET       │
    │                        │ OK                            │
    │                   Server Component                      │
    │                   auth() ──────── JWT z cookie          │
    │                   session.user.id                       │
    │                        │                               │
    │                   Prisma query ─────────────────────── ►│
    │                        │◄──────────────────────────────│
    │◄── HTML ───────────────│                               │
    │                        │                               │
    │── POST /auth/callback ►│                               │
    │                   NextAuth handler (Node.js)            │
    │                   PrismaAdapter ───────────────────── ►│
    │                   upsert User/Account                   │
    │                   sign JWT cookie ← AUTH_SECRET         │
    │◄── Set-Cookie ─────────│                               │
```

---

## Podsumowanie: co zadziałało a co nie

| Próba | Status | Główna przyczyna niepowodzenia |
|-------|--------|-------------------------------|
| `start.sh` | ❌ | Zły working directory na Render |
| `scripts/start.js` | ❌ | Render cache — stary package.json |
| `instrumentation.ts` | ❌ | Render cache — nowa flaga next.config nie była widoczna |
| `scripts/migrate.js` w build | ✅ | Build phase zawsze od zera, retry obsługuje Neon |
| `strategy: "database"` + middleware | ❌ | Prisma nie działa w Edge Runtime |
| `auth.config.ts` + `strategy: "jwt"` | ✅ | Middleware bez Prismy, sesja w JWT |

---

## Pliki powstałe podczas sesji (stan końcowy)

| Plik | Status | Opis |
|------|--------|------|
| `src/auth.config.ts` | ✅ aktywny | Edge-safe auth config dla middleware |
| `src/lib/auth.ts` | ✅ aktywny | Pełna konfiguracja NextAuth z JWT strategy |
| `src/middleware.ts` | ✅ aktywny | Route protection, Edge Runtime compatible |
| `src/app/api/auth/[...nextauth]/route.ts` | ✅ aktywny | NextAuth API handler |
| `src/types/next-auth.d.ts` | ✅ aktywny | TypeScript type augmentation |
| `scripts/migrate.js` | ✅ aktywny | Retry logic dla Neon cold-start |
| `start.sh` | 🗑️ martwy | Zastąpiony przez scripts/migrate.js |
| `scripts/start.js` | 🗑️ martwy | Zastąpiony przez scripts/migrate.js |
| `src/instrumentation.ts` | 🗑️ martwy | Zastąpiony przez scripts/migrate.js |
