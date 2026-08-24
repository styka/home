// 086 (AC-8..AC-11): RDZEŃ generowania gorących tematów — bez sesji, bez `requireAuth`.
//
// Do 086 cała ta logika mieszkała w Server Action `getHotTopics`, która zaczyna od `requireAuth()`.
// Zgłoszenie właściciela („gorące tematy powinny się odświeżać podczas pobierania nowych
// wiadomości") wymaga, żeby to samo policzyło ZADANIE W TLE — a zadanie sesji nie ma, zna tylko
// `ownerId`. Rdzeń przyjmuje więc właściciela PARAMETREM, a akcja użytkownika staje się cienką
// nakładką: jedno źródło logiki zamiast dwóch kopii, które rozjechałyby się przy pierwszej zmianie
// promptu.
//
// Plik świadomie NIE zna sesji ani widoku — dzięki temu wołają go dwa różne konteksty.

import { prisma } from "@/platform/db/prisma";
import { chatComplete } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import { fingerprintOf } from "@/lib/textKey";
import { rememberedContent, hashInputs } from "@/platform/ai/contentMemory";
import { resolveSectionMode } from "@/platform/ai/sectionModeResolver";
import type { AiSectionMode } from "@/platform/ai/sectionMode";
import { usageFromChat, type AiUsageInfo } from "@/platform/ai/usage";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";

/** Okno świeżości materiału, z którego budujemy listę. */
const FRESHNESS_MS = 24 * 60 * 60 * 1000;

export interface HotTopic {
  title: string;
  summary: string;
  suggestedFilter: string;
  sources: string[];
  /** Odcisk tytułu — po nim rozpoznajemy temat odrzucony albo już monitorowany. */
  fingerprint: string;
}

export interface WynikGoracychTematow {
  topics: HotTopic[];
  generatedAt: string | null;
  stale: boolean;
  fromMemory: boolean;
  pending: boolean;
  mode: AiSectionMode;
  /** Surowe zużycie — o tym, komu je pokazać, decyduje konsument (`visibleUsage`). */
  usage?: AiUsageInfo;
}

/**
 * Przelicza (albo odczytuje z pamięci) listę gorących tematów właściciela.
 *
 * `force` znaczy „ktoś o to poprosił wprost" — kliknięcie w zakładce albo zakończone pobieranie
 * nowych materiałów. Bez niego wynik przychodzi z pamięci treści (038) i nie kosztuje wywołania.
 */
export async function przeliczGoraceTematy(
  ownerId: string,
  opts?: { force?: boolean },
): Promise<WynikGoracychTematow> {
  const cutoff = new Date(Date.now() - FRESHNESS_MS);
  const wlasne = await filtrMoichRekordow(ownerId);

  const articles = await prisma.newsArticle.findMany({
    where: { ...wlasne, publishedAt: { gte: cutoff } },
    orderBy: { publishedAt: "desc" },
    take: 60,
    include: { source: { select: { name: true } } },
  });

  // 041: tryb rozstrzygamy PRZED sprawdzeniem materiału, bo trafia do wyniku w obu ścieżkach —
  // przełącznik w pasku ma działać także wtedy, gdy nie ma jeszcze z czego budować listy.
  const mode = await resolveSectionMode(ownerId, "news.hotTopics");

  if (articles.length === 0) {
    return { topics: [], generatedAt: null, stale: false, fromMemory: false, pending: false, mode };
  }

  const hidden = await prisma.newsHiddenTopic.findMany({
    take: SUFIT_LISTY,
    where: { ...wlasne },
    select: { fingerprint: true },
  });

  /**
   * 084 (AC-25, AC-26): propozycja, którą JUŻ MONITORUJESZ, nie jest propozycją.
   *
   * Odcisk liczymy TĄ SAMĄ funkcją co dla odrzuconych (`fingerprintOf`), a nie drugą regułą
   * podobieństwa: dwie reguły rozjechałyby się przy pierwszej zmianie i dałyby stan, w którym temat
   * jest „odrzucony, ale nie taki sam jak monitorowany".
   */
  const monitorowane = await prisma.newsTopic.findMany({
    take: SUFIT_LISTY,
    where: { ...wlasne },
    select: { title: true },
  });
  const odsiane = new Set([
    ...hidden.map((h) => h.fingerprint),
    ...monitorowane.map((t) => fingerprintOf(t.title)),
  ]);

  const headlines = articles.map((a) => `[${a.source.name}] ${a.title}`);

  const remembered = await rememberedContent<{ topics: HotTopic[] }>({
    ownerId,
    kind: "news.hotTopics",
    scopeKey: "default",
    // Warunki = materiał, z którego lista powstała. Nowe artykuły w puli zapalają „nieaktualne",
    // ale NIE generują listy od nowa — o tym decyduje `force`.
    inputHash: hashInputs(articles.length, articles[0]?.id ?? "", articles[articles.length - 1]?.id ?? ""),
    force: opts?.force,
    mode,
    generate: async () => {
      const system =
        "Analizujesz nagłówki wiadomości z ostatnich 24h z kilku polskich portali. Pogrupuj je w " +
        "6–8 najważniejszych, wyraźnie różnych gorących tematów. Pisz po polsku. Zwróć WYŁĄCZNIE JSON.";
      const userPrompt =
        `NAGŁÓWKI:\n${headlines.join("\n")}\n\n` +
        `Zwróć JSON: {"topics":[{"title":"krótka nazwa tematu","summary":"1–2 zdania o co chodzi",` +
        `"suggestedFilter":"propozycja filtra semantycznego do monitorowania tego tematu",` +
        `"sources":["nazwy portali, które o tym piszą"]}]}`;

      const res = await chatComplete({
        op: "reasoning",
        json: true,
        temperature: 0.2,
        maxTokens: 2000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      });
      if (!res.ok) throw new Error(res.message);
      const out = parseJsonLoose<{ topics?: HotTopic[] }>(res.content);
      if (out == null) throw new Error("Nie udało się odczytać odpowiedzi LLM (niepoprawny JSON).");

      const topics = (out.topics ?? []).slice(0, 8).map((t) => ({
        ...t,
        fingerprint: fingerprintOf(t.title ?? ""),
      }));
      return { value: { topics }, usage: usageFromChat([{ res, label: "gorące tematy" }]) };
    },
  });

  // Lista jeszcze nie powstała, a tryb zabrania generować samoczynnie.
  if (remembered.pending) {
    return { topics: [], generatedAt: null, stale: false, fromMemory: false, pending: true, mode };
  }

  return {
    // Odrzucone i monitorowane odfiltrowujemy PO odczycie z pamięci, a nie przed zapisem — dzięki
    // temu cofnięcie odrzucenia (albo usunięcie tematu) przywraca propozycję od razu, bez płacenia
    // za ponowne wygenerowanie listy.
    topics: (remembered.value.topics ?? []).filter((t) => !odsiane.has(t.fingerprint)),
    generatedAt: remembered.generatedAt,
    stale: remembered.stale,
    fromMemory: remembered.fromMemory,
    usage: remembered.usage,
    pending: false,
    mode,
  };
}

/**
 * 086 (AC-9, AC-11): REGUŁA ETAPU w przebiegu odświeżania — wydzielona, żeby dała się sprawdzić
 * testem bez Prismy i bez dostawcy modelu.
 *
 * Zawiera dokładnie dwie decyzje, obie zgłoszone przez właściciela albo wymuszone przez
 * doświadczenie:
 *   • przeliczamy **tylko** gdy coś przyszło — bez nowych materiałów analiza dałaby tę samą listę
 *     z tej samej puli, czyli byłaby wyłącznie kosztem;
 *   • awaria **nie wychodzi na zewnątrz** — to etap dodatkowy, a pobrane i streszczone wiadomości
 *     są już zapisane. Wyjątek stąd wywróciłby przebieg i zabrał użytkownikowi to, co się udało
 *     (ta sama lekcja, co z partiami streszczeń w 084).
 *
 * Ten sam wzorzec, co `przetworzPartiami`: reguła mieszka tutaj, a wykonawcę dostaje parametrem.
 */
export async function etapGoracychTematow({
  pobrano,
  przelicz,
  onBlad,
}: {
  /** Ile nowych materiałów przyniosło to pobranie. */
  pobrano: number;
  przelicz: () => Promise<unknown>;
  onBlad?: (blad: unknown) => void;
}): Promise<boolean> {
  if (pobrano <= 0) return false;
  try {
    await przelicz();
    return true;
  } catch (e) {
    onBlad?.(e);
    return false;
  }
}
