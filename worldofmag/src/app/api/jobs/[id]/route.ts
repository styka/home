// Z-131 (T-17) — GET /api/jobs/[id]: status i wynik zadania (do pollingu z klienta).
// Zawężone do właściciela (getJob z ownerId) — nie da się podejrzeć cudzego zadania.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { getJob } from "@/lib/jobs/queue";
import { startJobWorker } from "@/lib/jobs/worker";
import { visibleUsage } from "@/lib/ai/costVisibility";
import type { AiUsageInfo } from "@/lib/ai/usage";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Polling też pilnuje, że worker chodzi (np. po restarcie serwera dla zaległych zadań).
  startJobWorker();

  const job = await getJob(params.id, session.user.id);
  if (!job) return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: 404 });

  // 037: bramka widoczności licznika kosztu działa TUTAJ, a nie w handlerze zadania. Handlery
  // chodzą w workerze bez sesji użytkownika, więc `auth()` zwróciłoby tam null i licznik nigdy nie
  // zapaliłby się dla modułów opartych o kolejkę (analityka magazynu, plan tygodnia, OCR…).
  // Handler zapisuje zużycie surowe, a my dopiero przy odczycie decydujemy, czy je pokazać.
  const result = job.result ? (JSON.parse(job.result) as Record<string, unknown>) : null;
  if (result && result.usage) {
    const allowed = await visibleUsage(result.usage as AiUsageInfo);
    if (allowed) result.usage = allowed;
    else delete result.usage;
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    result,
    error: job.error,
    // 039: etap wieloetapowego zadania — dzięki niemu powrót na stronę odtwarza stan trwającego
    // przebiegu z kolejki, a nie z pamięci komponentu.
    progress: job.progress,
    attempts: job.attempts,
  });
}
