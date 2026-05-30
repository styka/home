import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category: string = typeof body.category === "string" ? body.category.trim() : "";

  if (!category) {
    return NextResponse.json({ error: "Podaj nazwę kategorii" }, { status: 400 });
  }

  const result = await chatComplete({
    op: "reasoning",
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

  return NextResponse.json({ hints });
}
