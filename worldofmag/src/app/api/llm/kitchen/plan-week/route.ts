// Plan posiłków na tydzień. Logika (z odczytem przepisów/spiżarni) w handlerze; cienka trasa sync.
// Klient: runJob("kitchen.planWeek", input).
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { kitchenPlanWeekHandler } from "@/lib/jobs/handlers/kitchenPlanWeek";
import { JobError } from "@/lib/jobs/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await kitchenPlanWeekHandler(body, { ownerId: session.user.id, jobId: "sync" }));
  } catch (e) {
    if (e instanceof JobError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Błąd" }, { status: 500 });
  }
}
