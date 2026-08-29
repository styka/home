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
  const body = await req.json().catch(() => ({}));
  const category: string = typeof body.category === "string" ? body.category.trim() : "";

  if (!category) {
    return NextResponse.json({ error: "Podaj nazwę kategorii" }, { status: 400 });
  }

  const result = await chatComplete({
    op: "reasoning",
    userId,
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant for a Polish shopping app. The app supports any type of shopping category, not just food. Respond only with the requested comma-separated list, no explanations, no numbering.",
      },
      {
        role: "user",
        content: `The Polish word for the shopping category is: "${category}". List 6-8 specific, visually distinct products that a person would buy in this category. Return only a comma-separated list of product names in Polish, no explanations, no numbering.`,
      },
    ],
    temperature: 0.7,
    maxTokens: 100,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const hints: string = (result.content || "").trim();

  return NextResponse.json({ hints, ...(await usageField(result, "podpowiedzi kategorii")) });
}
