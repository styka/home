// Wygeneruj przepis z opisu. Logika w handlerze; cienka trasa sync. Klient: runJob("kitchen.generateRecipe").
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { kitchenGenerateRecipeHandler } from "@/lib/jobs/handlers/kitchenGenerateRecipe";
import { JobError } from "@/lib/jobs/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  try {
    return NextResponse.json(await kitchenGenerateRecipeHandler({ prompt: body.prompt }, { ownerId: session.user.id, jobId: "sync" }));
  } catch (e) {
    if (e instanceof JobError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Błąd" }, { status: 500 });
  }
}
