// Treść zamówienia do dostawcy. Logika w handlerze; cienka trasa sync (degradacja łagodna).
// Klient: runJob("magazyn.orderDraft", input).
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { magazynOrderDraftHandler } from "@/lib/jobs/handlers/magazynOrderDraft";
import { JobError } from "@/lib/jobs/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await magazynOrderDraftHandler(body, { ownerId: session.user.id, jobId: "sync" }));
  } catch (e) {
    if (e instanceof JobError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Błąd" }, { status: 500 });
  }
}
