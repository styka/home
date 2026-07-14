import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Z-090: publiczny endpoint zdrowia dla zewnętrznego uptime-monitora (ping na
 * `/api/health`). Zwraca 200, gdy aplikacja i baza odpowiadają; 503, gdy baza nie
 * odpowiada — dzięki temu monitor potrafi odróżnić „żyje" od „padło". Bez danych
 * wrażliwych. Wyłączony z bramki auth w middleware (matcher).
 */
export async function GET() {
  const startedAt = Date.now();
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
    tookMs: Date.now() - startedAt,
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: db === "ok" ? 200 : 503 });
}
