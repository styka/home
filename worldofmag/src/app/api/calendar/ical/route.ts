import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/platform/db/prisma";
import { collectCalendarEvents } from "@/lib/calendarAgenda";
import { buildICalendar } from "@/modules/calendar/contract";
import { sprawdzLimit } from "@/platform/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Z-150: publiczny feed iCal agendy Omnia. Auth = odwoływalny token w `?token=`
 * (NIE sesja — dlatego trasa jest wyłączona z middleware). Zwraca okno
 * [bieżący miesiąc − 1 … + 2] zdarzeń ze wszystkich modułów (scoping w
 * `collectCalendarEvents` po userze/zespole — brak przecieku cross-user).
 */
export async function GET(req: NextRequest) {
  /**
   * 104 (punkt 4 planu domknięcia bezpieczeństwa) — OGRANICZENIE LICZBY PRÓB.
   *
   * Limit stoi PRZED odczytem z bazy i jest liczony po adresie źródłowym, bo przy złym tokenie nie
   * wiadomo jeszcze, o czyj kalendarz chodzi. Sprawdzanie limitu dopiero po trafieniu w token
   * byłoby ochroną włączaną w chwili, w której nie ma już czego chronić.
   *
   * Gdy adresu nie da się ustalić, liczymy wszystkie takie żądania pod jednym kluczem — to
   * zaostrza limit, a nie rozluźnia go, więc kierunek błędu jest właściwy.
   */
  const adres =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "nieznany";
  const limit = await sprawdzLimit("kalendarz.feed", adres);
  if (!limit.ok) {
    return new NextResponse(limit.message, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    });
  }

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
