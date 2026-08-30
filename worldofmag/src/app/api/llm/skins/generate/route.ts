// 045: wygeneruj skórkę z opisu słownego. Logika w handlerze; cienka trasa sync.
// 116: + tryb `advanced` (pełna definicja zaawansowana) i limit `ai.skorki` — trasa
// działała dotąd bez limitu, a klik „generuj" to najłatwiejsza do zapętlenia operacja AI.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { sprawdzLimit, zajmijSlot, POLITYKI } from "@/platform/rateLimit";
import { skinGenerateHandler } from "@/platform/jobs/handlers/skinGenerate";
import { JobError } from "@/platform/jobs/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await sprawdzLimit("ai.skorki", session.user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }
  // Strażnik współbieżności (recenzja 116, ust. 2): polityka deklaruje `rownolegle: 1`,
  // a egzekwuje to WYŁĄCZNIE dzierżawa slotu — bez niej dwuklik „Generuj" odpala dwie
  // równoległe generacje. Wzorzec z trasy agenta.
  const release = await zajmijSlot("ai.skorki", session.user.id);
  if (!release) {
    return NextResponse.json({ error: POLITYKI["ai.skorki"].komunikatSlot }, { status: 429 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { prompt?: string; tryb?: string };
    return NextResponse.json(
      await skinGenerateHandler(
        { prompt: body.prompt, tryb: body.tryb === "advanced" ? "advanced" : "simple" },
        { ownerId: session.user.id, jobId: "sync" },
      ),
    );
  } catch (e) {
    if (e instanceof JobError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Błąd" }, { status: 500 });
  } finally {
    await release();
  }
}
