import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { collectCalendarEvents } from "@/lib/calendar/collect";
import { buildICalendar } from "@/lib/calendar/ical";

export const dynamic = "force-dynamic";

/**
 * Z-150: publiczny feed iCal agendy Omnia. Auth = odwoływalny token w `?token=`
 * (NIE sesja — dlatego trasa jest wyłączona z middleware). Zwraca okno
 * [bieżący miesiąc − 1 … + 2] zdarzeń ze wszystkich modułów (scoping w
 * `collectCalendarEvents` po userze/zespole — brak przecieku cross-user).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new NextResponse("Missing token", { status: 401 });

  const user = await prisma.user.findUnique({
    where: { icalToken: token },
    select: { id: true, name: true },
  });
  if (!user) return new NextResponse("Invalid or revoked token", { status: 403 });

  const now = new Date();
  const events = [];
  for (let off = -1; off <= 2; off++) {
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
    events.push(...(await collectCalendarEvents(user.id, d.getFullYear(), d.getMonth())));
  }

  const ics = buildICalendar(events, {
    name: `Omnia — ${user.name ?? "Kalendarz"}`,
    dtstamp: now.toISOString(),
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="omnia.ics"',
      // Klienty kalendarza odpytują cyklicznie — krótki cache prywatny.
      "Cache-Control": "private, max-age=900",
    },
  });
}
