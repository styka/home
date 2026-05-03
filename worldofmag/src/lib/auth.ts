import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

const ADMIN_EMAIL = "tyka.szymon@gmail.com"

// NextAuth v5 throws MissingSecret during build if AUTH_SECRET is not set.
// Provide a placeholder so the build succeeds; real value must be set on Render.
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "build-time-placeholder-set-real-value-on-render"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      // @ts-ignore — role is our custom field
      session.user.role = (user as any).role ?? "USER"
      return session
    },
  },
  events: {
    async createUser({ user }) {
      const updates: Record<string, string> = {}
      if (user.email === ADMIN_EMAIL) updates.role = "ADMIN"
      if (user.image) updates.avatarUrl = user.image
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: updates })
      }
    },
  },
})
