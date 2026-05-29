import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Middleware runs in Edge Runtime — only use the edge-compatible authConfig
// (no PrismaClient, no Node.js-only imports).
export const { auth: middleware } = NextAuth(authConfig)
export default middleware

export const config = {
  // Bramka logowania pomija: API auth, zasoby _next, generowane ikony (icon/apple-icon/
  // pwa-icon), manifest, service worker i favicon — muszą być publiczne, bo przeglądarka
  // i iOS pobierają je BEZ sesji (inaczej dostają redirect i pokazują starą/cache'owaną ikonę).
  matcher: ["/((?!api/auth|_next/static|_next/image|icon|apple-icon|apple-touch-icon|pwa-icon|manifest|sw\\.js|favicon).*)"],
}
