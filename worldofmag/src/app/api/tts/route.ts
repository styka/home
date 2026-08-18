import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { sprawdzLimit } from "@/platform/rateLimit";
import { SPEECH_MAX_CHARS, synthesizeSpeech } from "@/lib/tts/serverTts";

// 031: endpoint serwerowej syntezy mowy (lektor asystenta). Wymaga sesji i podlega temu samemu
// limitowi zapytań co reszta AI. Zwraca 501, gdy administrator nie przypisał dostawcy dla typu
// operacji `speech` — klient traktuje to jako „brak funkcji" i płynnie wraca do głosów przeglądarki.

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await sprawdzLimit("ai.mowa", session.user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.message }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string; voiceId?: string | null };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Brak tekstu do odczytania." }, { status: 400 });
  if (text.length > SPEECH_MAX_CHARS) {
    return NextResponse.json(
      { error: `Tekst do odczytania jest za długi (limit ${SPEECH_MAX_CHARS} znaków).` },
      { status: 413 }
    );
  }

  try {
    const result = await synthesizeSpeech({ text, voiceId: body.voiceId ?? null });
    if (!result) {
      return NextResponse.json(
        { error: "Serwerowa synteza mowy nie jest skonfigurowana." },
        { status: 501 }
      );
    }
    return new NextResponse(result.audio, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "Content-Length": String(result.audio.byteLength),
      },
    });
  } catch {
    // Szczegóły błędu dostawcy zostają na serwerze — klient ma tylko wrócić do głosów przeglądarki.
    return NextResponse.json({ error: "Nie udało się odczytać tekstu na głos." }, { status: 502 });
  }
}
