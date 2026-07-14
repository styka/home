// Import przepisu ze zdjęcia (OCR wizyjny). Logika żyje w handlerze zadania
// (`@/lib/jobs/handlers/kitchenOcrImage`) — TU zostaje cienka, synchroniczna trasa dla
// wstecznej zgodności. Domyślnie klient używa kolejki (Z-131/T-17): runJob("kitchen.ocrImage").

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { kitchenOcrImageHandler } from "@/lib/jobs/handlers/kitchenOcrImage";
import { JobError } from "@/lib/jobs/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { image?: string };
  try {
    const result = await kitchenOcrImageHandler({ image: body.image }, { ownerId: session.user.id, jobId: "sync" });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof JobError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Błąd" }, { status: 500 });
  }
}
