// 039: wnioskowanie faktów o użytkowniku z jego zachowań w aplikacji.
//
// Czytamy tylko to, co użytkownik SAM zrobił: zapisał pomysł pogodowy, zablokował inny, dodał temat
// do monitorowania, odrzucił gorący temat. Nie zaglądamy w treści (notatki, zdrowie, finanse) — nie
// dlatego, że technicznie się nie da, ale dlatego, że profil budowany z takich danych byłby czymś,
// czego użytkownik się nie spodziewa.
//
// Wynik to HIPOTEZY, nie prawdy: zapisujemy je z pewnością „guess"/„likely", a użytkownik potwierdza
// albo odrzuca. Odrzucone wracają do promptu jako „tego nie proponuj ponownie".

import { prisma } from "@/platform/db/prisma";
import { chatComplete } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import { fingerprintOf } from "@/lib/textKey";
import { usageFromChat, type AiUsageInfo } from "@/lib/ai/usage";
import { JobError, type JobContext } from "@/lib/jobs/types";
import {
  USER_FACT_CATEGORIES,
  parseUserFactCategory,
  parseUserFactConfidence,
} from "@/lib/userFacts";

export interface UserFactsResult {
  /** Ile nowych hipotez zapisaliśmy. */
  added: number;
  usage?: AiUsageInfo;
}

interface InferredFact {
  category?: string;
  text?: string;
  confidence?: string;
  evidence?: string;
}

const SYSTEM =
  "Na podstawie zachowań użytkownika w aplikacji formułujesz krótkie HIPOTEZY o nim — po polsku, " +
  "jedno zdanie każda. Zasady: opieraj się WYŁĄCZNIE na przekazanych zachowaniach i nie zmyślaj; " +
  "nie powtarzaj faktów już znanych ani tych, którym użytkownik zaprzeczył; nie formułuj hipotez " +
  "o zdrowiu, poglądach politycznych, wyznaniu, orientacji ani sytuacji materialnej; jeśli materiał " +
  "jest zbyt ubogi, zwróć pustą listę — to poprawna odpowiedź. Zwróć WYŁĄCZNIE JSON.";

export async function userFactsHandler(_payload: unknown, ctx: JobContext): Promise<UserFactsResult> {
  if (!ctx.ownerId) throw new JobError("Zadanie bez właściciela", 400);
  const ownerId = ctx.ownerId;

  ctx.progress?.("Zbieram zachowania…");
  const [ideas, topics, hiddenTopics, known] = await Promise.all([
    prisma.weatherIdea.findMany({
      where: { ownerId, state: { in: ["saved", "blocked"] } },
      orderBy: { lastSeenAt: "desc" },
      take: 40,
      select: { title: true, state: true, category: true },
    }),
    prisma.newsTopic.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true, semanticFilter: true },
    }),
    prisma.newsHiddenTopic.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true },
    }),
    prisma.userFact.findMany({
      where: { ownerId },
      select: { text: true, status: true },
    }),
  ]);

  const saved = ideas.filter((i) => i.state === "saved");
  const blocked = ideas.filter((i) => i.state === "blocked");

  // Za mało materiału = nie ma o czym wnioskować. Wołanie modelu „na wszelki wypadek" kosztowałoby
  // za każdym przebiegiem i produkowało hipotezy z powietrza.
  if (saved.length + blocked.length + topics.length < 3) return { added: 0 };

  const behaviour = [
    saved.length ? `Zapisał sobie pomysły: ${saved.map((i) => i.title).join("; ")}` : null,
    blocked.length ? `Odrzucił pomysły: ${blocked.map((i) => i.title).join("; ")}` : null,
    topics.length
      ? `Monitoruje tematy wiadomości: ${topics.map((t) => `${t.title} (${t.semanticFilter})`).join("; ")}`
      : null,
    hiddenTopics.length
      ? `Nie chce propozycji tematów: ${hiddenTopics.map((t) => t.title).join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const activeKnown = known.filter((k) => k.status === "active").map((k) => k.text);
  const rejectedKnown = known.filter((k) => k.status === "rejected").map((k) => k.text);

  ctx.progress?.("Formułuję hipotezy…");
  const res = await chatComplete({
    op: "reasoning",
    json: true,
    temperature: 0.3,
    maxTokens: 1200,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content:
          `ZACHOWANIA:\n${behaviour}\n\n` +
          (activeKnown.length ? `JUŻ WIEMY (nie powtarzaj):\n- ${activeKnown.join("\n- ")}\n\n` : "") +
          (rejectedKnown.length
            ? `UŻYTKOWNIK TEMU ZAPRZECZYŁ (nie proponuj ponownie):\n- ${rejectedKnown.join("\n- ")}\n\n`
            : "") +
          `Kategorie: ${USER_FACT_CATEGORIES.join(" | ")}.\n` +
          `Zwróć JSON: {"facts":[{"category":"interests","text":"jedno zdanie",` +
          `"confidence":"guess|likely","evidence":"na czym oparta hipoteza"}]}. Maks. 5 pozycji.`,
      },
    ],
  });

  const sink = [{ res, label: "wiedza o użytkowniku" }];
  if (!res.ok) throw new JobError(res.message, res.status);
  if (res.truncated) throw new JobError("Odpowiedź modelu została ucięta.", 502);
  const parsed = parseJsonLoose<{ facts?: InferredFact[] }>(res.content);
  if (parsed == null) throw new JobError("Nie udało się odczytać odpowiedzi modelu.", 502);

  const usage = usageFromChat(sink);
  const rejectedPrints = new Set(rejectedKnown.map((t) => fingerprintOf(t)));

  let added = 0;
  for (const f of (parsed.facts ?? []).slice(0, 5)) {
    const text = f.text?.trim();
    if (!text) continue;
    const fingerprint = fingerprintOf(text);
    // Druga zapora na wypadek, gdyby model zignorował listę zaprzeczeń: odrzuconego faktu nie
    // wskrzeszamy nigdy.
    if (rejectedPrints.has(fingerprint)) continue;
    try {
      await prisma.userFact.create({
        data: {
          ownerId,
          category: parseUserFactCategory(f.category),
          text,
          // Model nie ma prawa ogłosić faktu potwierdzonym — potwierdza wyłącznie użytkownik.
          confidence: parseUserFactConfidence(f.confidence === "likely" ? "likely" : "guess"),
          origin: "inferred",
          status: "active",
          evidence: f.evidence?.trim() || null,
          fingerprint,
        },
      });
      added++;
    } catch {
      // Kolizja [ownerId, fingerprint] = ten fakt już znamy (także jako odrzucony). Pomijamy.
    }
  }

  return { added, usage };
}
