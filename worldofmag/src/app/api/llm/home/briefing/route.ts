import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/server-utils";
import { getCalendarEvents } from "@/actions/calendar";
import { chatComplete } from "@/lib/llm/chat";
import { checkAiBudget, recordAiUsage } from "@/lib/ai/usage";

// Poranny briefing — krótkie, ciepłe podsumowanie dnia generowane na żądanie
// (przycisk na stronie głównej, klient cache'uje per-dzień). Reużywa agregatu
// kalendarza (zadania/posiłki/zdrowie/przeglądy floty) + zaległe zadania.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  // Z-130: briefing też kosztuje tokeny — egzekwuj dzienny budżet AI.
  const budget = await checkAiBudget(userId);
  if (!budget.ok) {
    return NextResponse.json({ error: budget.message }, { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const todayIso = isoDay(todayStart);
  const horizon = new Date(todayStart);
  horizon.setDate(horizon.getDate() + 2); // dziś + 2 dni
  const horizonIso = isoDay(horizon);

  // Agregat z bieżącego i następnego miesiąca (okno może przekraczać granicę miesiąca).
  const [thisMonth, nextMonth] = await Promise.all([
    getCalendarEvents(now.getFullYear(), now.getMonth()),
    getCalendarEvents(horizon.getFullYear(), horizon.getMonth()),
  ]);
  const seen = new Set<string>();
  const events = [...thisMonth, ...nextMonth]
    .filter((e) => {
      const k = `${e.module}:${e.title}:${e.date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return e.date >= todayIso && e.date <= horizonIso;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Zaległe zadania (termin < dziś, niezakończone) — krótka lista do „ogarnięcia".
  const teamIds = await getUserTeamIds(userId);
  const overdue = await prisma.task.findMany({
    where: {
      parentTaskId: null,
      status: { notIn: ["DONE", "CANCELLED"] },
      dueDate: { lt: todayStart },
      OR: [
        { createdById: userId },
        { assigneeId: userId },
        { project: { ownerId: userId } },
        { project: { members: { some: { userId } } } },
        ...(teamIds.length > 0 ? [{ project: { ownerTeamId: { in: teamIds } } }] : []),
      ],
    },
    select: { id: true, title: true, dueDate: true },
    orderBy: { dueDate: "asc" },
    take: 8,
  });

  // Nic w planie i brak zaległości → nie wołamy LLM, zwracamy gotowy komunikat.
  if (events.length === 0 && overdue.length === 0) {
    return NextResponse.json({
      briefing: "## Dzień dobry! ☀️\n\nNa dziś i najbliższe dni nie masz zaplanowanych terminów ani zaległości. Czysta karta — dobry moment, żeby zaplanować coś ważnego.",
    });
  }

  const todayList = events.filter((e) => e.date === todayIso);
  const soonList = events.filter((e) => e.date > todayIso);
  const fmt = (e: { module: string; title: string; date: string }) =>
    `- [${e.module}] ${e.title}${e.date !== todayIso ? ` (${e.date})` : ""}`;

  const dataBlock = [
    `Dzisiejsza data: ${todayIso}`,
    overdue.length ? `Zaległe zadania (${overdue.length}):\n${overdue.map((t) => `- ${t.title} (termin ${isoDay(t.dueDate as Date)})`).join("\n")}` : "Zaległe zadania: brak",
    todayList.length ? `Na dziś:\n${todayList.map(fmt).join("\n")}` : "Na dziś: brak wpisów",
    soonList.length ? `Najbliższe dni:\n${soonList.map(fmt).join("\n")}` : "Najbliższe dni: brak wpisów",
  ].join("\n\n");

  const result = await chatComplete({
    op: "dispatch",
    messages: [
      {
        role: "system",
        content:
          "Jesteś osobistym asystentem. Na podstawie danych ułóż KRÓTKI poranny briefing po polsku w markdown:\n" +
          "- zacznij nagłówkiem `## Dzień dobry!` z 1 zdaniem wprowadzenia (ciepły, rzeczowy ton),\n" +
          "- potem zwięzła lista najważniejszych rzeczy na dziś (priorytet: zaległe > dzisiejsze terminy > najbliższe),\n" +
          "- na końcu 1 zdanie sugestii, od czego zacząć.\n" +
          "Bez zmyślania — używaj tylko podanych danych. Maksymalnie ~120 słów. Nie dodawaj nagłówków innych niż `##`.",
      },
      { role: "user", content: dataBlock },
    ],
    temperature: 0.4,
    maxTokens: 450,
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  void recordAiUsage(userId, result.usage?.total ?? 0).catch(() => {});
  return NextResponse.json({ briefing: result.content || "## Dzień dobry!\n\nMiłego dnia!" });
}
