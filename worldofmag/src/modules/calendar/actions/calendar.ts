"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";

function feedUrl(token: string): string {
  const base = (process.env.AUTH_URL || "").replace(/\/$/, "");
  return `${base}/api/calendar/ical?token=${token}`;
}

/**
 * Z-150: zwraca URL subskrypcji iCal bieżącego usera (tworzy token przy pierwszym
 * użyciu). Token = sekret w URL → długi, losowy. Zwraca null gdy brak `AUTH_URL`.
 */
export async function getMyIcalFeedUrl(): Promise<string | null> {
  const user = await requireAuth();
  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { icalToken: true } });
  let token = existing?.icalToken ?? null;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await prisma.user.update({ where: { id: user.id }, data: { icalToken: token } });
  }
  if (!process.env.AUTH_URL) return null;
  return feedUrl(token);
}

/** Z-150: rotacja tokenu — stary link przestaje działać, zwraca nowy. */
export async function regenerateIcalFeed(): Promise<string | null> {
  const user = await requireAuth();
  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: user.id }, data: { icalToken: token } });
  if (!process.env.AUTH_URL) return null;
  return feedUrl(token);
}
