import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth")

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth/signin", req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|icons|manifest\\.json|sw\\.js).*)"],
}
