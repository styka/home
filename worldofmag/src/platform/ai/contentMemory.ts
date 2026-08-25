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
import { prisma } from "@/platform/db/prisma";
import { parseStoredUsage, type AiUsageInfo } from "@/platform/ai/usage";
// Import WYŁĄCZNIE typu — `sectionMode.ts` importuje stąd `AiContentKind`, więc import wartości
// zrobiłby cykl w czasie wykonania. Typy znikają przy kompilacji, więc ten kierunek jest bezpieczny.
import type { AiSectionMode } from "@/platform/ai/sectionMode";
import { filtrMoichRekordow, wlasnoscOsobistaDoZapisu } from "@/platform/workspaces/zapis";

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
  | "news.hotTopics"
  // 080 (Z11): obserwatory pogody. Do tej pory jedyna sekcja AI, która wołała model z `useEffect`
  // przy KAŻDYM wejściu na moduł — stąd wieczny spinner i „bardzo często nie działają".
  | "weather.watchers"
  // 102: streszczenie filmu YouTube w wybranej długości. Klucz zakresu niesie identyfikator filmu
  // I długość, bo to trzy osobne treści do zapamiętania, a nie jedna w trzech wariantach.
  // Świadomie NIE ma tego w `AI_SECTION_KINDS`: tryb odświeżania dotyczy sekcji, która sama się
  // pokazuje przy wejściu na stronę, a streszczenie powstaje wyłącznie po kliknięciu długości.
  | "youtube.streszczenie";

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
  /** Zawsze `false` — treść istnieje. Pole rozróżnia oba warianty wyniku (patrz `PendingContent`). */
  pending: false;
}

/**
 * 041: sekcja CZEKA na kliknięcie — nie ma jeszcze żadnej treści, a tryb zabrania generować
 * samoczynnie.
 *
 * To **nie** jest błąd i **nie** jest pusta treść. Rozróżnienie ma własne pole, a nie „puste
 * `value`", bo w 038 dokładnie ta pomyłka kosztowała nas dzień: użytkownik widział to samo, co po
 * awarii, i ponawiał w nieskończoność. Typ wymusza obsłużenie tego stanu — `value` po prostu nie
 * istnieje, dopóki kod nie sprawdzi `pending`.
 */
export interface PendingContent {
  pending: true;
  stale: false;
  fromMemory: false;
  refreshes: 0;
}

/** Wynik odczytu z pamięci, gdy tryb sekcji może wstrzymać generowanie. */
export type RememberedOrPending<T> = RememberedContent<T> | PendingContent;

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

interface RememberArgs<T> {
  ownerId: string;
  kind: AiContentKind;
  scopeKey: string;
  inputHash: string;
  force?: boolean;
  /**
   * 041: tryb odświeżania sekcji (`resolveSectionMode`). **Pominięty = zachowanie sprzed 041**:
   * brak zapisu → generuj. Dzięki temu sekcje przechodzą na tryb pojedynczo, a nie wszystkie naraz.
   */
  mode?: AiSectionMode;
  generate: () => Promise<{ value: T; usage?: AiUsageInfo }>;
}

/**
 * Jedyne wejście do mechanizmu.
 *
 * `generate` jest wołane **tylko** wtedy, gdy pozwala na to tryb sekcji albo gdy użytkownik wymusił
 * odświeżenie (`force`). Zapamiętana treść wraca bez żadnego wywołania modelu — to jest cały sens.
 *
 * Tabela decyzyjna (041):
 * | stan | `onDemand` | `onChange` | `always` | bez trybu |
 * |---|---|---|---|---|
 * | brak zapisu | czeka | czeka | generuj | generuj |
 * | zapis, odcisk zgodny | z pamięci | z pamięci | generuj | z pamięci |
 * | zapis, odcisk inny | z pamięci + „nieaktualne" | generuj | generuj | z pamięci + „nieaktualne" |
 * | `force` | generuj | generuj | generuj | generuj |
 *
 * Dwa warianty zwracanego typu są rozdzielone **przeciążeniami**: wywołanie bez trybu nigdy nie
 * zwróci stanu oczekiwania, więc dotychczasowi wołający nie muszą go obsługiwać.
 */
export async function rememberedContent<T>(
  args: RememberArgs<T> & { mode: AiSectionMode }
): Promise<RememberedOrPending<T>>;
export async function rememberedContent<T>(
  args: RememberArgs<T> & { mode?: undefined }
): Promise<RememberedContent<T>>;
export async function rememberedContent<T>(
  args: RememberArgs<T>
): Promise<RememberedOrPending<T>> {
  const { ownerId, kind, scopeKey, inputHash, force, mode } = args;
  // 078: klucz pamięci treści idzie po PRZESTRZENI (migracja 0242). Ustalamy ją raz — ten sam klucz
  // czyta się tu dwa razy (odczyt i `upsert`), a `filtrMoichRekordow` może domknąć brakującą
  // przestrzeń, więc dwa wywołania to dwie próby tego samego.
  const przestrzen = await filtrMoichRekordow(ownerId);

  const existing = await prisma.aiContent.findUnique({
    where: { workspaceId_kind_scopeKey: { ...przestrzen, kind, scopeKey } },
  });

  // Uszkodzony wpis traktujemy jak brak wpisu: najwyżej treść powstanie ponownie. Wysypanie strony
  // przez jeden zepsuty JSON byłoby znacznie gorsze niż jedno dodatkowe wywołanie modelu.
  // Odczytujemy RAZ — obie decyzje niżej pytają o to samo.
  const stored = existing ? decode<T>(existing.content) : undefined;

  // `always` znaczy „model odpowiada przy każdym wejściu" — nie ma po co czytać pamięci.
  if (existing && stored !== undefined && !force && mode !== "always") {
    const stale = existing.inputHash !== inputHash;
    // `onChange` to jedyny tryb, w którym rozjazd warunków sam sięga po model. W pozostałych
    // treść zostaje na ekranie ze znacznikiem „nieaktualne" — bo znikająca treść jest gorsza od
    // treści sprzed godziny, a o wywołaniu modelu decyduje użytkownik.
    if (!(mode === "onChange" && stale)) {
      return {
        value: stored,
        generatedAt: existing.updatedAt.toISOString(),
        stale,
        fromMemory: true,
        refreshes: existing.refreshes,
        usage: parseStoredUsage(existing.usage),
        pending: false,
      };
    }
  }

  // Nie ma czego pokazać, a tryb zabrania generować samoczynnie — sekcja czeka na kliknięcie.
  // Dotyczy to również wpisu, którego nie dało się odczytać: skoro treści nie ma, użytkownik i tak
  // musi zdecydować, czy warto za nią zapłacić.
  if (!force && stored === undefined && (mode === "onDemand" || mode === "onChange")) {
    return { pending: true, stale: false, fromMemory: false, refreshes: 0 };
  }

  const fresh = await args.generate();
  const now = new Date();
  const row = await prisma.aiContent.upsert({
    where: { workspaceId_kind_scopeKey: { ...przestrzen, kind, scopeKey } },
    create: {
      ...(await wlasnoscOsobistaDoZapisu(ownerId)),
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
    pending: false,
  };
}

function decode<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
