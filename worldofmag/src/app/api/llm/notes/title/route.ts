import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";

export async function POST(req: NextRequest) {
  const { content } = await req.json() as { content: string };

  if (!content?.trim()) {
    return NextResponse.json({ error: "No content" }, { status: 400 });
  }

  const result = await chatComplete({
    op: "dispatch",
    messages: [
      {
        role: "system",
        content: "Na podstawie treści notatki zaproponuj krótki, zwięzły tytuł (max 60 znaków). Odpowiedz TYLKO tytułem, bez cudzysłowów, bez dodatkowych wyjaśnień.",
      },
      { role: "user", content: content.slice(0, 1000) },
    ],
    temperature: 0.4,
    maxTokens: 60,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const title = (result.content || "").trim().replace(/^["']|["']$/g, "");

  return NextResponse.json({ title });
}
