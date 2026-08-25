import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { przygotujZgode, YOUTUBE_STATE_COOKIE } from "@/modules/youtube/contract";

/**
 * 102 (AC-3): start dobrowolnej zgody na odczyt subskrypcji.
 *
 * Trasa jest cienka celowo: robi wyłącznie to, czego moduł zrobić nie może — ustawia ciasteczko
 * i przekierowuje. Kolejność kroków przepływu zostaje w module.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/auth/signin", req.url));

  const { url, state } = przygotujZgode(req.nextUrl.origin);

  const res = NextResponse.redirect(url);
  // Zabezpieczenie przed CSRF: dokładnie ten stan musi wrócić w wywołaniu zwrotnym.
  res.cookies.set(YOUTUBE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
