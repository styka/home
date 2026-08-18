import { NextResponse } from "next/server";
import { prisma } from "@/platform/db/prisma";
import { ensureJobWorker } from "@/lib/jobs/registry";
import { ensureEventWorker } from "@/lib/eventSubscribers";
import { rolaProcesu } from "@/platform/runtime/rola";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Z-090: publiczny endpoint zdrowia dla zewnętrznego uptime-monitora (ping na
 * `/api/health`). Zwraca 200, gdy aplikacja i baza odpowiadają; 503, gdy baza nie
 * odpowiada — dzięki temu monitor potrafi odróżnić „żyje" od „padło". Bez danych
 * wrażliwych. Wyłączony z bramki auth w middleware (matcher).
 *
 * **088 (zadanie 33): to jest też miejsce, w którym budzi się proces `worker`.** Instancja bez
 * ruchu użytkownika nie ma powodu wykonać ani jednej trasy, więc worker uruchamiany leniwie
 * z `/api/jobs` nigdy by w niej nie wystartował. Kontrola zdrowia jest jedynym żądaniem, które
 * platforma hostingowa wysyła **sama i regularnie** — a `ensure*` jest idempotentne, więc kosztuje
 * to jedno sprawdzenie flagi. (Nie `instrumentation.ts`: jest bundlowane także dla runtime EDGE,
 * a łańcuch workera używa modułów node-only — Z-131.)
 */
export async function GET() {
  const startedAt = Date.now();
  ensureJobWorker();
  ensureEventWorker();
  let db: "ok" | "down" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }
  const body = {
    status: db === "ok" ? "ok" : "degraded",
    db,
    commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown",
    // Rola widoczna w odpowiedzi: przy trzech usługach z jednego obrazu to jedyny sposób, żeby
    // sprawdzić, czy każda z nich dostała tę, którą miała dostać.
    role: rolaProcesu(),
    tookMs: Date.now() - startedAt,
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: db === "ok" ? 200 : 503 });
}
