// Wnioski z analityki magazynu. Logika w handlerze; cienka trasa sync (degradacja łagodna).
// Klient: runJob("magazyn.insights", stats).
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { magazynInsightsHandler } from "@/lib/jobs/handlers/magazynInsights";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await magazynInsightsHandler(body, { ownerId: session.user.id, jobId: "sync" }));
}
