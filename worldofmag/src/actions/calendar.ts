"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { collectCalendarEvents } from "@/lib/calendar/collect";
import type { CalendarEvent } from "@/lib/calendar";

function feedUrl(token: string): string {
  const base = (process.env.AUTH_URL || "").replace(/\/$/, "");
  return `${base}/api/calendar/ical?token=${token}`;
}

/**
 * Agreguje zdarzenia z wielu modułów (zadania, plan posiłków, zdrowie, leki,
 * przeglądy floty, opieka nad zwierzętami, powtórki SRS, usługi) w jeden widok
 * kalendarza dla zalogowanego usera. Rdzeń (Z-150) w `@/lib/calendar/collect`
 * (reużywany przez feed iCal, który auth tokenem, nie sesją).
 */
export async function getCalendarEvents(year: number, month0: number): Promise<CalendarEvent[]> {
  const user = await requireAuth();
  return collectCalendarEvents(user.id, year, month0);
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
