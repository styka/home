// Porady dobrostanu zwierząt. Logika w handlerze; cienka trasa sync (degradacja łagodna).
// Klient: runJob("pets.insights", input).
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { petsInsightsHandler } from "@/lib/jobs/handlers/petsInsights";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await petsInsightsHandler(body, { ownerId: session.user.id, jobId: "sync" }));
}
