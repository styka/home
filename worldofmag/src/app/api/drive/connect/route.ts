import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { buildConsentUrl, DRIVE_CALLBACK_PATH } from "@/lib/drive/oauth";

// Kicks off the Drive OAuth flow: redirects the user to Google's consent screen.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL(DRIVE_CALLBACK_PATH, req.nextUrl.origin).toString();

  const res = NextResponse.redirect(buildConsentUrl(state, redirectUri));
  // CSRF guard: verify this exact state comes back on the callback.
  res.cookies.set("drive_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
