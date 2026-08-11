// Z-131 (T-17) — POST /api/jobs: zakolejkuj zadanie w tle. Zwraca { jobId }.
// Bezpieczeństwo: tylko typy z allowlisty (049: składanej z deklaracji modułów) i tylko dla zalogowanego
// (ownerId = użytkownik). Payload trafia do handlera dopiero w workerze.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { enqueue, QuotaError, MAX_ACTIVE_JOBS_PER_OWNER } from "@/platform/jobs/queue";
import { isEnqueuable } from "@/lib/jobs/registry";
import { ensureJobWorker } from "@/lib/jobs/registry";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Start workera in-process przy pierwszym użyciu (idempotentnie). Trasa API = runtime
  // Node, więc łańcuch handlerów (crypto) jest tu OK (w przeciwieństwie do instrumentation).
  ensureJobWorker();

  const body = (await req.json().catch(() => ({}))) as { type?: string; payload?: unknown; dedupeKey?: string };
  const type = body?.type;
  if (!type || typeof type !== "string" || !(await isEnqueuable(type))) {
    return NextResponse.json({ error: "Nieobsługiwany typ zadania" }, { status: 400 });
  }

  try {
    const job = await enqueue(type, body.payload ?? {}, {
      ownerId: session.user.id,
      dedupeKey: typeof body.dedupeKey === "string" ? body.dedupeKey : null,
      maxActivePerOwner: MAX_ACTIVE_JOBS_PER_OWNER, // fairness: limit aktywnych zadań na usera
    });
    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch (e) {
    if (e instanceof QuotaError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
}
