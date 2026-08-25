import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { mirrorPersonalWorkspace } from "@/platform/workspaces/sync"
import { prisma } from "@/platform/db/prisma"
import { authConfig } from "@/auth.config"
import { ZASTEPCZY_SEKRET_SESJI } from "./zastepczySekret"
import { czyNaHostingu } from "@/platform/runtime/hosting"

const ADMIN_EMAIL = "tyka.szymon@gmail.com"

/**
 * 101 (AC-10) — WARTOŚĆ ZASTĘPCZA SEKRETU SESJI.
 *
 * `next build` wykonuje ten moduł, a bez `AUTH_SECRET` NextAuth rzuca — więc na czas budowania
 * podstawiamy wartość zastępczą. Cena tego rozwiązania jest jednak poważna: gdyby zmiennej
 * zabrakło **w czasie działania**, aplikacja podpisywałaby sesje sekretem, który leży w publicznym
 * repozytorium — czyli każdy mógłby podrobić cudzą sesję, a aplikacja wyglądałaby na sprawną.
 *
 * Dlatego wartość jest **nazwaną stałą** w `./zastepczySekret` (plik bez zależności — patrz tam),
 * a nie literałem: strażnik w `src/instrumentation.ts`
 * (uruchamiany przy starcie serwera, NIE podczas budowania) porównuje się z nią i zatrzymuje proces.
 * Gdyby literał stał w dwóch miejscach, poprawiony w jednym rozjechałby strażnika po cichu.
 */

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = ZASTEPCZY_SEKRET_SESJI
}

/**
 * Uproszczone logowanie dla klikaczy — Playwright nie przejdzie przez ekran Google, więc loguje się
 * jako znany użytkownik z seeda.
 *
 * 104 (punkt 3 planu domknięcia bezpieczeństwa) — DRUGI WARUNEK.
 *
 * Do tej pory bramką była wyłącznie zmienna `E2E_TEST_MODE`, a bezpieczeństwo opierało się na tym,
 * że nikt nigdy nie ustawi jej na hostingu. To jest zabezpieczenie **jednopunktowe**: jedna pomyłka
 * przy kopiowaniu konfiguracji między środowiskami otwiera logowanie bez hasła — po cichu, bez
 * żadnego objawu.
 *
 * Drugim warunkiem jest „nie działamy na hostingu". Świadomie NIE jest nim `NODE_ENV`: od 098
 * klikacze serwują aplikację przez `next start`, czyli same chodzą w trybie produkcyjnym — bramka
 * po `NODE_ENV` wyłączyłaby logowanie testowe w testach (patrz `platform/runtime/hosting`).
 */
const e2eProviders =
  process.env.E2E_TEST_MODE === "1" && !czyNaHostingu()
    ? [
        Credentials({
          id: "e2e",
          name: "E2E",
          credentials: { email: { label: "Email", type: "email" } },
          async authorize(creds) {
            const email = typeof creds?.email === "string" ? creds.email : null
            if (!email) return null
            const user = await prisma.user.findUnique({ where: { email } })
            if (!user) return null
            return { id: user.id, email: user.email, name: user.name, image: user.image }
          },
        }),
      ]
    : []

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...e2eProviders],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, userRoles: { select: { role: true } } },
        })
        token.role = dbUser?.role ?? "USER"
        token.roles = dbUser?.userRoles.map((r) => r.role) ?? []
      }
      return token
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string
        session.user.role = (token.role as string) ?? "USER"
        // Fetch fresh roles and permissions on every session access
        // paginacja: kompletny — role w sesji; brakująca rola to utrata uprawnień bez żadnego komunikatu.
        const userRoles = await prisma.userRole.findMany({
          where: { userId: token.id as string },
          select: { role: true },
        })
        const roles = userRoles.map((r) => r.role)
        session.user.roles = roles
        // paginacja: kompletny — uprawnienia ról w sesji; jak wyżej.
        const rolePerms = await prisma.rolePermission.findMany({
          where: { role: { in: roles } },
          select: { permission: { select: { slug: true } } },
        })
        session.user.permissions = Array.from(new Set(rolePerms.map((rp) => rp.permission.slug)))
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      const updates: Record<string, string> = {}
      if (user.image) updates.avatarUrl = user.image
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: updates })
      }

      // Assign roles: new users get only BETA_TESTER
      const rolesToInsert: string[] = ["BETA_TESTER"]
      if (user.email === ADMIN_EMAIL) {
        rolesToInsert.push("USER", "ADMIN")
        await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } })
      }

      for (const role of rolesToInsert) {
        await prisma.userRole.upsert({
          where: { userId_role: { userId: user.id!, role } },
          create: { userId: user.id!, role },
          update: {},
        })
      }

      // Faza 2 / zadanie 9: każde konto ma przestrzeń osobistą — rozdz. 8.2 mówi „powstaje
      // automatycznie przy rejestracji", więc to jest jej jedyne właściwe miejsce. Migracja 0226
      // zrobiła to dla kont istniejących; bez tego wiersza niezmiennik rozjechałby się nazajutrz
      // po wdrożeniu, przy pierwszym nowym użytkowniku.
      // Wariant CICHY: nieudane lustro nie może zablokować założenia konta (patrz sync.ts).
      await mirrorPersonalWorkspace(user.id!)
    },
  },
})
