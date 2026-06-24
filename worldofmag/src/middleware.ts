import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Middleware runs in Edge Runtime — only use the edge-compatible authConfig
// (no PrismaClient, no Node.js-only imports).
export const { auth: middleware } = NextAuth(authConfig)
export default middleware

export const config = {
  // Bramka logowania pomija: API auth, health, feed iCal (Z-150: auth tokenem w URL,
  // nie sesją), zasoby _next, generowane ikony (icon/apple-icon/pwa-icon), manifest,
  // service worker i favicon — muszą być publiczne, bo przeglądarka/iOS/klient kalendarza
  // pobierają je BEZ sesji (inaczej dostają redirect zamiast treści).
  matcher: ["/((?!api/auth|api/health|api/calendar/ical|_next/static|_next/image|icon|apple-icon|apple-touch-icon|pwa-icon|manifest|sw\\.js|favicon).*)"],
}
