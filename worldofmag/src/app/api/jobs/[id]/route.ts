// Z-131 (T-17) — GET /api/jobs/[id]: status i wynik zadania (do pollingu z klienta).
// Zawężone do właściciela (getJob z ownerId) — nie da się podejrzeć cudzego zadania.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getJob } from "@/lib/jobs/queue";
import { startJobWorker } from "@/lib/jobs/worker";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Polling też pilnuje, że worker chodzi (np. po restarcie serwera dla zaległych zadań).
  startJobWorker();

  const job = await getJob(params.id, session.user.id);
  if (!job) return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    status: job.status,
    result: job.result ? JSON.parse(job.result) : null,
    error: job.error,
    attempts: job.attempts,
  });
}
