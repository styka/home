import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/auth.config"

const ADMIN_EMAIL = "tyka.szymon@gmail.com"

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "build-time-placeholder-set-real-value-on-render"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
      if (token) {
        session.user.id = token.id as string
        session.user.role = (token.role as string) ?? "USER"
        session.user.roles = (token.roles as string[]) ?? []
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
    },
  },
})
