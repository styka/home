/**
 * Wspólne typy i helpery dla seedów QA (scenariusze testowe).
 * Każdy moduł ma własny plik prisma/seeds/qa-<module>.ts który eksportuje
 * tablicę EPICS i wywołuje seedModule(). Uruchamiane zbiorczo przez qa-all.ts.
 */
import type { PrismaClient } from "@prisma/client";

export interface ScenarioSeed {
  slug: string;
  title: string;
  type: "positive" | "negative" | "edge";
  priority: "P0" | "P1" | "P2";
  pre: string[];
  steps: string[];
  expected: string[];
  negatives?: [string, string][];
  notes?: string;
}

export interface StorySeed {
  slug: string;
  title: string;
  description?: string;
  scenarios: ScenarioSeed[];
}

export interface EpicSeed {
  slug: string;
  title: string;
  description?: string;
  stories: StorySeed[];
}

/** Buduje markdown treści scenariusza w spójnym formacie. */
export function md(s: ScenarioSeed): string {
  const parts: string[] = [];
  parts.push("## Warunki wstępne\n");
  parts.push(s.pre.map((p) => `- ${p}`).join("\n"));
  parts.push("\n\n## Kroki\n");
  parts.push(s.steps.map((st, i) => `${i + 1}. ${st}`).join("\n"));
  parts.push("\n\n## Oczekiwany rezultat\n");
  parts.push(s.expected.map((e) => `- ${e}`).join("\n"));
  if (s.negatives && s.negatives.length > 0) {
    parts.push("\n\n## Przypadki brzegowe / negatywne\n");
    parts.push("| Akcja | Oczekiwany rezultat |\n|---|---|");
    parts.push(s.negatives.map(([a, r]) => `| ${a} | ${r} |`).join("\n"));
  }
  if (s.notes) {
    parts.push(`\n\n## Notatki\n\n> ${s.notes}`);
  }
  return parts.join("");
}

export interface SeedResult {
  epicCount: number;
  storyCount: number;
  scenarioCount: number;
}

/**
 * Idempotentnie seeduje epiki/stories/scenariusze dla danego modułu.
 * Upsert po slug — bezpieczny do wielokrotnego uruchamiania.
 */
export async function seedModule(
  prisma: PrismaClient,
  module: string,
  epics: EpicSeed[],
  authorId: string | null,
): Promise<SeedResult> {
  let epicCount = 0;
  let storyCount = 0;
  let scenarioCount = 0;

  for (let ei = 0; ei < epics.length; ei++) {
    const epicSeed = epics[ei];
    const epic = await prisma.qaEpic.upsert({
      where: { slug: epicSeed.slug },
      create: {
        slug: epicSeed.slug,
        title: epicSeed.title,
        description: epicSeed.description ?? null,
        module,
        order: ei,
      },
      update: {
        title: epicSeed.title,
        description: epicSeed.description ?? null,
        module,
        order: ei,
      },
    });
    epicCount++;

    for (let si = 0; si < epicSeed.stories.length; si++) {
      const storySeed = epicSeed.stories[si];
      const story = await prisma.qaUserStory.upsert({
        where: { slug: storySeed.slug },
        create: {
          slug: storySeed.slug,
          title: storySeed.title,
          description: storySeed.description ?? null,
          epicId: epic.id,
          order: si,
        },
        update: {
          title: storySeed.title,
          description: storySeed.description ?? null,
          epicId: epic.id,
          order: si,
        },
      });
      storyCount++;

      for (let ci = 0; ci < storySeed.scenarios.length; ci++) {
        const sc = storySeed.scenarios[ci];
        await prisma.qaTestScenario.upsert({
          where: { slug: sc.slug },
          create: {
            slug: sc.slug,
            title: sc.title,
            type: sc.type,
            priority: sc.priority,
            content: md(sc),
            storyId: story.id,
            order: ci,
            authorId,
          },
          update: {
            title: sc.title,
            type: sc.type,
            priority: sc.priority,
            content: md(sc),
            storyId: story.id,
            order: ci,
          },
        });
        scenarioCount++;
      }
    }
  }

  return { epicCount, storyCount, scenarioCount };
}
