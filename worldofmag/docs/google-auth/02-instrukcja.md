# Instrukcja: logowanie Google w Next.js 14 + NextAuth v5 + Prisma + Neon + Render

Minimalna, kompletna instrukcja od zera. Wykonaj kroki po kolei — żadnych ślepych uliczek.

**Stack:** Next.js 14 (App Router) · NextAuth v5 beta · @auth/prisma-adapter · Prisma 5 · PostgreSQL (Neon) · Render

---

## Wymagania wstępne

- Działająca aplikacja Next.js 14 z Prisma + PostgreSQL (Neon)
- Konto Google Cloud Console
- Serwis na Render z dostępem do Settings

---

## Krok 1 — Google Cloud Console: OAuth credentials

1. Otwórz [console.cloud.google.com](https://console.cloud.google.com)
2. Utwórz nowy projekt lub wybierz istniejący
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Application type: **Web application**
5. Authorized redirect URIs — dodaj **oba**:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://<twoja-domena>.onrender.com/api/auth/callback/google` (production)
6. Skopiuj **Client ID** i **Client Secret** — będą potrzebne w kroku 9

---

## Krok 2 — Instalacja paczek

```bash
cd worldofmag
npm install next-auth@5.0.0-beta.25 @auth/prisma-adapter
```

---

## Krok 3 — Schemat Prisma

Dodaj do `prisma/schema.prisma` modele wymagane przez NextAuth. Pola `avatarUrl` i `role` są opcjonalne (własne rozszerzenia):

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  avatarUrl     String?           // opcjonalne: Google profile photo URL
  role          String    @default("USER")  // opcjonalne: "USER" | "ADMIN"
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts Account[]
  sessions Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

Utwórz i zastosuj migrację:

```bash
npx prisma migrate dev --name auth_tables
```

> **Neon free tier:** jeśli `migrate dev` failuje (błąd E57P01), poczekaj 10 sekund i spróbuj ponownie. Neon budzi się po pierwszym połączeniu.

---

## Krok 4 — `src/auth.config.ts` (edge-safe)

> ⚠️ Ten plik **nie może importować Prismy** ani żadnych Node.js-only modułów. Jest używany przez middleware w Edge Runtime.

```ts
import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname.startsWith("/auth")
      if (isAuthPage) return true
      if (!isLoggedIn) return Response.redirect(new URL("/auth/signin", nextUrl))
      return true
    },
  },
} satisfies NextAuthConfig
```

---

## Krok 5 — `src/lib/auth.ts` (pełna konfiguracja, Node.js only)

> ⚠️ Używaj `strategy: "jwt"` — **NIE "database"**. `strategy: "database"` odpytuje DB przy każdym żądaniu i failuje w Edge Runtime.

```ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/auth.config"

// Zabezpieczenie przed brakiem AUTH_SECRET podczas buildu
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "build-time-placeholder-replace-on-render"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },  // ← KLUCZOWE: nie "database"
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Pierwsze logowanie: pobierz rolę z DB i zapisz w JWT
        token.id = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        })
        token.role = dbUser?.role ?? "USER"
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = (token.role as string) ?? "USER"
      }
      return session
    },
  },
  events: {
    // Opcjonalne: przypisz rolę ADMIN pierwszemu adminowi
    async createUser({ user }) {
      const updates: Record<string, string> = {}
      if (user.email === process.env.ADMIN_EMAIL) updates.role = "ADMIN"
      if (user.image) updates.avatarUrl = user.image
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: updates })
      }
    },
  },
})
```

---

## Krok 6 — `src/middleware.ts`

> ⚠️ Importuj TYLKO z `@/auth.config`, NIE z `@/lib/auth`. `auth.ts` importuje Prismę — nie może być w Edge Runtime.

```ts
import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

export const { auth: middleware } = NextAuth(authConfig)
export default middleware

export const config = {
  // Wyklucz: API auth routes, pliki statyczne Next.js, ikony PWA, service worker
  matcher: ["/((?!api/auth|_next/static|_next/image|icons|manifest\\.json|sw\\.js).*)"],
}
```

---

## Krok 7 — `src/app/api/auth/[...nextauth]/route.ts`

```ts
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

---

## Krok 8 — `src/types/next-auth.d.ts` (TypeScript augmentation)

```ts
import { DefaultSession } from "next-auth"
import { JWT as DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string
    role?: string
  }
}
```

---

## Krok 9 — Strona logowania `src/app/auth/signin/page.tsx`

```tsx
import { signIn } from "@/lib/auth"

export default function SignInPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form
        action={async () => {
          "use server"
          await signIn("google", { redirectTo: "/" })
        }}
      >
        <button type="submit">Zaloguj się przez Google</button>
      </form>
    </div>
  )
}
```

---

## Krok 10 — Obsługa migracji na Neon (Render + cold-start)

Stwórz `scripts/migrate.js`:

```js
const { execSync } = require("child_process")

const MAX_ATTEMPTS = 5
const RETRY_MS = 8_000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" })
      console.log("✔ Migrations applied.")
      return
    } catch {
      if (i === MAX_ATTEMPTS) {
        console.error("✘ Migration failed after all attempts.")
        process.exit(1)
      }
      console.log(`Attempt ${i} failed (Neon waking up?). Retrying in ${RETRY_MS / 1000}s…`)
      await sleep(RETRY_MS)
    }
  }
}

main()
```

Zaktualizuj `package.json` — migracja na końcu buildu:

```json
{
  "scripts": {
    "build": "prisma generate && next build && node scripts/migrate.js",
    "start": "next start",
    "postinstall": "prisma generate"
  }
}
```

> **Dlaczego w build a nie w start?** Render gwarantuje świeży build bez cache dla kodu. `startCommand` może używać cached artefaktów ze starego buildu. Migracja w build = gwarancja że zawsze uruchomi się z nowym kodem.

---

## Krok 11 — Zmienne środowiskowe

### Lokalnie (`.env.local`)

```bash
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"
AUTH_SECRET="wygeneruj-losowy-string-min-32-znaki"
AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="twoj-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-twoj-client-secret"
```

Generowanie `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

### Render Dashboard

W serwisie → **Environment** → dodaj wszystkie powyższe zmienne z wartościami produkcyjnymi:
- `AUTH_URL` → `https://twoja-domena.onrender.com`
- `AUTH_SECRET` → nowy losowy string (inny niż lokalny)

---

## Krok 12 — `render.yaml` (opcjonalnie)

```yaml
services:
  - type: web
    name: worldofmag
    runtime: node
    buildCommand: npm ci && npx prisma generate && npm run build
    startCommand: next start
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: DIRECT_URL
        sync: false
      - key: AUTH_SECRET
        sync: false
      - key: AUTH_URL
        sync: false
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
```

---

## Weryfikacja

Po deployu sprawdź kolejno:

1. `https://twoja-domena.onrender.com` → redirect do `/auth/signin` ✓
2. Kliknij "Zaloguj się przez Google" → okno Google OAuth ✓
3. Wybierz konto → redirect z powrotem do aplikacji ✓
4. Otwórz Prisma Studio (lokalnie z `DIRECT_URL` produkcyjnym): `npx prisma studio`
5. Tabela `User` — sprawdź czy rekord istnieje ✓
6. Tabela `Account` — sprawdź czy OAuth account jest zlinkowany ✓

---

## Najczęstsze błędy

| Błąd | Przyczyna | Rozwiązanie |
|------|-----------|-------------|
| `PrismaClient is not configured to run in Edge Runtime` | middleware importuje Prismę | Użyj `auth.config.ts` w middleware, NIE `lib/auth.ts` |
| Pętla: logowanie → powrót do /auth/signin | `strategy: "database"` lub Prisma w Edge Runtime | Zmień na `strategy: "jwt"` |
| `redirect_uri_mismatch` (Google) | URL w Google Console nie pasuje | Dodaj dokładny URI: `https://domena/api/auth/callback/google` |
| `AUTH_SECRET` missing | Brak zmiennej na Render | Ustaw w Render Dashboard → Environment |
| Migracja failuje na pierwszym uruchomieniu | Neon cold-start E57P01 | Użyj retry logic w `scripts/migrate.js` |
| `The table 'public.Account' does not exist` | Migracja nie została zastosowana | Sprawdź logi buildu — `scripts/migrate.js` musi być w `npm run build` |
