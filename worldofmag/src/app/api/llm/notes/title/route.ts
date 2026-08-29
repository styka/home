import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/platform/llm/chat";
import { auth } from "@/platform/auth/session";
import { usageField } from "@/platform/ai/costVisibility";

export async function POST(req: NextRequest) {
  // Sesję wymusza już middleware; auth() jest tu po `userId` — bez niego chatComplete nie
  // wiązał kosztu z użytkownikiem, więc licznik zużycia i miesięczny limit planu pomijały
  // te wywołania (dawały się obejść „tańszą" trasą pomocniczą).
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { content } = await req.json() as { content: string };

  if (!content?.trim()) {
    return NextResponse.json({ error: "No content" }, { status: 400 });
  }

  const result = await chatComplete({
    op: "dispatch",
    userId,
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

  return NextResponse.json({ title, ...(await usageField(result, "tytuł notatki")) });
}
