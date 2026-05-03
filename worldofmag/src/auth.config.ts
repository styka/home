import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

// Edge-compatible auth config — no Prisma, no Node.js-only imports.
// Used by middleware to check session without touching the database.
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: { signIn: "/auth/signin" },
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
