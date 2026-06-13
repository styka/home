import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCode, fetchAccountEmail, DRIVE_CALLBACK_PATH } from "@/lib/drive/oauth";
import { ensureRootFolder } from "@/lib/drive/client";

// Google redirects here after consent. We exchange the code for tokens, persist
// the per-user connection, and create the "Omnia" root folder.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }
  const userId = session.user.id;

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("drive_oauth_state")?.value;

  const settingsUrl = new URL("/settings", req.url);

  if (url.searchParams.get("error")) {
    settingsUrl.searchParams.set("drive", "denied");
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    settingsUrl.searchParams.set("drive", "error");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = new URL(DRIVE_CALLBACK_PATH, req.nextUrl.origin).toString();
    const tokens = await exchangeCode(code, redirectUri);
    const email = await fetchAccountEmail(tokens.accessToken);

    await prisma.driveConnection.upsert({
      where: { userId },
      create: {
        userId,
        email,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        folderMap: "{}",
      },
      update: {
        email,
        // Keep an existing refresh token if Google didn't return a new one.
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
      },
    });

    await ensureRootFolder(userId, tokens.accessToken);
    settingsUrl.searchParams.set("drive", "connected");
  } catch {
    settingsUrl.searchParams.set("drive", "error");
  }

  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete("drive_oauth_state");
  return res;
}
