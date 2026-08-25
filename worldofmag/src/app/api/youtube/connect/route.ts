import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/platform/auth/session";
import { buildConsentUrl, YOUTUBE_CALLBACK_PATH, YOUTUBE_STATE_COOKIE } from "@/lib/youtube/oauth";

/** 102 (AC-3): start dobrowolnej zgody na odczyt subskrypcji — przekierowanie na ekran Google. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/auth/signin", req.url));

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL(YOUTUBE_CALLBACK_PATH, req.nextUrl.origin).toString();

  const res = NextResponse.redirect(buildConsentUrl(state, redirectUri));
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
