import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";

export async function POST(req: NextRequest) {
  const { content, existingTags, existingGroups } = await req.json() as {
    content: string;
    existingTags: string[];
    existingGroups?: string[];
  };

  const groupsHint = existingGroups && existingGroups.length > 0
    ? `\nJeśli treść pasuje do jednej z grup: [${existingGroups.join(", ")}], podaj jej dokładną nazwę w polu "suggestedGroup". W przeciwnym razie null.`
    : "";

  const systemPrompt = `Jesteś asystentem pomagającym tagować notatki.
Proponuj tagi które najlepiej opisują treść notatki.
Odpowiedz TYLKO JSON bez żadnego innego tekstu w formacie:
{"suggested": ["tag1", "tag2"], "new": ["nowy_tag"], "suggestedGroup": null}
- "suggested": tagi spośród dostarczonych istniejących tagów (max 5)
- "new": nowe tagi których nie ma na liście (max 3, krótkie, po polsku lub angielsku)
- "suggestedGroup": nazwa pasującej grupy lub null${groupsHint}
Tagi powinny być krótkie (1-2 słowa), pisane małymi literami.`;

  const userMessage = `Istniejące tagi: ${existingTags.length > 0 ? existingTags.join(", ") : "(brak)"}

Treść notatki:
${content.slice(0, 2000)}`;

  const result = await chatComplete({
    op: "dispatch",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    maxTokens: 200,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const text = result.content || "{}";

  try {
    const parsed = JSON.parse(text) as { suggested?: string[]; new?: string[]; suggestedGroup?: string | null };
    const suggestedGroup = typeof parsed.suggestedGroup === "string" ? parsed.suggestedGroup : null;
    return NextResponse.json({
      suggested: (parsed.suggested ?? []).filter((t: string) => existingTags.includes(t)),
      new: parsed.new ?? [],
      suggestedGroup: existingGroups?.includes(suggestedGroup ?? "") ? suggestedGroup : null,
    });
  } catch {
    return NextResponse.json({ suggested: [], new: [], suggestedGroup: null });
  }
}
