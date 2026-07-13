// Transkrypcja tekstu ze zdjęcia. Logika w handlerze (`@/lib/jobs/handlers/kitchenOcrText`);
// tu cienka trasa sync (wstecznie). Klient używa kolejki: runJob("kitchen.ocrText").
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { kitchenOcrTextHandler } from "@/lib/jobs/handlers/kitchenOcrText";
import { JobError } from "@/lib/jobs/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { image?: string };
  try {
    return NextResponse.json(await kitchenOcrTextHandler({ image: body.image }, { ownerId: session.user.id, jobId: "sync" }));
  } catch (e) {
    if (e instanceof JobError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Błąd" }, { status: 500 });
  }
}
