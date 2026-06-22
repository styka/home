import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { purgeExpiredTrash } from "@/lib/trash";
import { logEvent } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

/**
 * Z-059 — wyzwalane zewnętrznie zadanie retencji (free tier nie ma natywnego crona).
 *
 * Globalnie czyści przeterminowany kosz wszystkich użytkowników (inline-cleanup w
 * `recordTrash` dotyka tylko aktywnego usera). Podłącz pod zewnętrzny scheduler/uptime
 * (np. dzienny POST z nagłówkiem `Authorization: Bearer <CRON_SECRET>`).
 *
 * Autoryzacja: sekret `CRON_SECRET` (gdy ustawiony) ALBO zalogowany admin — dzięki
 * temu działa też ręcznie z panelu/konsoli, a bez sekretu nie jest publicznie otwarte.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret && req.headers.get("authorization") === `Bearer ${secret}`;

  if (!authorized) {
    const session = await auth();
    const isAdmin = session?.user?.roles?.includes("ADMIN");
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const trashPurged = await purgeExpiredTrash();
  logEvent("info", "retention.purge", { trashPurged }); // Z-096
  return NextResponse.json({ ok: true, trashPurged });
}
