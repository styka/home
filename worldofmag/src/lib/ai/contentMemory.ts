// 038: PAMIĘĆ TREŚCI generowanych przez AI — jeden mechanizm dla całej aplikacji.
//
// Problem, który rozwiązuje: treść wygenerowana przez model znikała po odświeżeniu strony i
// powstawała od nowa, choć użytkownik o to nie prosił. Płacił więc za to samo wielokrotnie i nie
// mógł wrócić do tego, co przed chwilą czytał. Zasada właściciela: **treść wygenerowana raz jest
// pamiętana, a nowa powstaje wyłącznie na wyraźne kliknięcie**.
//
// Czego ten mechanizm świadomie NIE obejmuje: narzędzi działających na żądanie (podpowiedz tagi,
// sparsuj wklejony tekst, wyszukaj). Tam kliknięcie JUŻ jest wyraźną akcją, a pamięć zwracałaby
// nieaktualny wynik dla zmienionego wejścia. Klasyfikację każdego wywołania modelu trzyma manifest
// `content-memory-coverage.json`, pilnowany bramką `check-content-memory.js`.

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { parseStoredUsage, type AiUsageInfo } from "@/lib/ai/usage";

/**
 * Rodzaj zapamiętanej treści. String + union (C-12) — nigdy enum Prisma.
 *
 * Nie ma tu szczegółowych planów pomysłów pogodowych: mają własną trwałość od 037 (kolumny
 * `detail`/`detailAt`/`detailRuns` w `WeatherIdea`), a wpięcie ich dodatkowo tutaj byłoby drugim
 * mechanizmem na tę samą potrzebę (C-53).
 */
export type AiContentKind =
  | "weather.ideas"
  | "storage.insights"
  | "pets.insights"
  | "kitchen.planWeek"
  // 039: gorące tematy — wejście na widok Wiadomości nie może kosztować za każdym razem.
  | "news.hotTopics";

export interface RememberedContent<T> {
  value: T;
  /** Kiedy treść powstała — UI pokazuje to przy każdej zapamiętanej treści. */
  generatedAt: string;
  /**
   * Warunki powstania różnią się od bieżących. To sygnał do POKAZANIA znacznika „nieaktualne",
   * a nie do samoczynnego generowania — o tym decyduje wyłącznie użytkownik.
   */
  stale: boolean;
  /** `true`, gdy treść pochodzi z pamięci (czyli nie było wywołania modelu). */
  fromMemory: boolean;
  /** Ile razy użytkownik jawnie odświeżył tę treść. */
  refreshes: number;
  usage?: AiUsageInfo;
}

/**
 * Separator pól w odcisku: znak NUL, bo nie wystąpi w żadnej sensownej wartości wejściowej — dzięki
 * temu `["ab", "c"]` i `["a", "bc"]` dają RÓŻNE odciski. Zapisany jako sekwencja ucieczki, nie jako
 * surowy bajt: plik źródłowy z bajtem NUL git klasyfikuje jako binarny i przestaje go diffować, co
 * odbiera możliwość recenzji kodu.
 */
const SEP = "\u0000";

/**
 * Stabilny odcisk warunków. Te same dane wejściowe dają ten sam skrót, a kolejność argumentów ma
 * znaczenie — to jest cecha, nie wada: `hashInputs(a, b)` opisuje inne warunki niż `hashInputs(b, a)`.
 *
 * Wartości liczbowe **zaokrąglaj przed przekazaniem**. Odcisk liczony z surowej prognozy zmieniałby
 * się przy korekcie o jedną dziesiątą stopnia i unieważniał treść bez powodu — czyli niweczył całą
 * oszczędność, dla której ten mechanizm powstał.
 */
export function hashInputs(...parts: (string | number | null | undefined)[]): string {
  const joined = parts.map((p) => (p == null ? "" : String(p))).join(SEP);
  return createHash("sha256").update(joined).digest("hex").slice(0, 32);
}

/**
 * Jedyne wejście do mechanizmu.
 *
 * `generate` jest wołane **tylko** wtedy, gdy nie ma zapisu albo gdy użytkownik wymusił odświeżenie
 * (`force`). Zapamiętana treść wraca bez żadnego wywołania modelu — to jest cały sens.
 */
export async function rememberedContent<T>(args: {
  ownerId: string;
  kind: AiContentKind;
  scopeKey: string;
  inputHash: string;
  force?: boolean;
  generate: () => Promise<{ value: T; usage?: AiUsageInfo }>;
}): Promise<RememberedContent<T>> {
  const { ownerId, kind, scopeKey, inputHash, force } = args;

  const existing = await prisma.aiContent.findUnique({
    where: { ownerId_kind_scopeKey: { ownerId, kind, scopeKey } },
  });

  if (existing && !force) {
    const value = decode<T>(existing.content);
    // Uszkodzony wpis traktujemy jak brak wpisu: najwyżej treść powstanie ponownie. Wysypanie
    // strony przez jeden zepsuty JSON byłoby znacznie gorsze niż jedno dodatkowe wywołanie modelu.
    if (value !== undefined) {
      return {
        value,
        generatedAt: existing.updatedAt.toISOString(),
        stale: existing.inputHash !== inputHash,
        fromMemory: true,
        refreshes: existing.refreshes,
        usage: parseStoredUsage(existing.usage),
      };
    }
  }

  const fresh = await args.generate();
  const now = new Date();
  const row = await prisma.aiContent.upsert({
    where: { ownerId_kind_scopeKey: { ownerId, kind, scopeKey } },
    create: {
      ownerId,
      kind,
      scopeKey,
      inputHash,
      content: JSON.stringify(fresh.value),
      usage: fresh.usage ? JSON.stringify(fresh.usage) : null,
      refreshes: 0,
    },
    update: {
      inputHash,
      content: JSON.stringify(fresh.value),
      usage: fresh.usage ? JSON.stringify(fresh.usage) : null,
      // Liczymy tylko JAWNE odświeżenia — pierwsza generacja odświeżeniem nie jest.
      refreshes: force ? { increment: 1 } : undefined,
      updatedAt: now,
    },
  });

  return {
    value: fresh.value,
    generatedAt: row.updatedAt.toISOString(),
    stale: false,
    fromMemory: false,
    refreshes: row.refreshes,
    usage: fresh.usage,
  };
}

function decode<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
