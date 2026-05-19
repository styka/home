import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category: string = typeof body.category === "string" ? body.category.trim() : "";

  if (!category) {
    return NextResponse.json({ error: "Podaj nazwę kategorii" }, { status: 400 });
  }

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany" },
      { status: 503 }
    );
  }

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.value}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for a Polish grocery shopping app. Respond only with the requested list, no explanations.",
        },
        {
          role: "user",
          content: `List 6-8 specific grocery items typically found in the "${category}" category of a Polish grocery store. Return only a comma-separated list of item names in Polish, no explanations, no numbering.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    }),
  });

  if (!groqRes.ok) {
    return NextResponse.json({ error: "Błąd API Groq" }, { status: 502 });
  }

  const groqData = await groqRes.json();
  const hints: string = groqData.choices?.[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ hints });
}
