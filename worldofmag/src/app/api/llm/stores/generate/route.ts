// Wygeneruj mapę (graf) sklepu. Logika w handlerze; cienka trasa sync. Klient: runJob("stores.generate").
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storesGenerateHandler } from "@/lib/jobs/handlers/storesGenerate";
import { JobError } from "@/lib/jobs/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { storeName?: string };
  try {
    return NextResponse.json(await storesGenerateHandler({ storeName: body.storeName }, { ownerId: session.user.id, jobId: "sync" }));
  } catch (e) {
    if (e instanceof JobError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Błąd" }, { status: 500 });
  }
}
