import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Middleware runs in Edge Runtime — only use the edge-compatible authConfig
// (no PrismaClient, no Node.js-only imports).
export const { auth: middleware } = NextAuth(authConfig)
export default middleware

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|icons|manifest\\.json|sw\\.js).*)"],
}
