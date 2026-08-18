// Z-131 (T-17) — pętla workera (in-process). Startowana raz w `instrumentation.ts`.
// Na prod (płatny tier, nie usypia) chodzi ciągle; na develop (free) chodzi gdy apka
// nie śpi. Ten sam kod można później uruchomić jako OSOBNY worker na Render — logika
// pobierania (`claimNext`, SKIP LOCKED) jest wieloworkerowo-bezpieczna.

import { claimNext, completeJob, failJob, failJobPermanent, cleanupOldJobs, setJobProgress, type JobRecord } from "@/platform/jobs/queue";
import { posprzatajLimity } from "@/platform/rateLimit";
import { retencjaJesliCzas } from "@/platform/retention/harmonogram";
import { wZakresieOperacji } from "@/platform/sharing/cache";
import { logEvent, wKontekscieLogu } from "@/platform/observability/log";
import { czyPrzetwarzaZadania, czyWykonujeOkresowe, rolaNierozpoznana } from "@/platform/runtime/rola";
import { flushMetryk, zmierzOperacje } from "@/platform/observability/metryki";
import type { PolitykaRetencji } from "@/platform/retention";
import { reportServerError } from "@/platform/observability/report";
import type { JobHandler } from "@/platform/jobs/types";

/**
 * 049: worker NIE zna rejestru handlerów — dostaje go **wstrzykniętego** przez korzeń kompozycji.
 *
 * Rejestr składa się z deklaracji modułów, więc gdyby platforma sięgała po niego sama, znałaby
 * moduły tylnymi drzwiami (C-36). Parametr jest **wymagany**: wartość domyślna „na razie" byłaby
 * dokładnie tym cichym obejściem, którego ta reguła ma zabraniać.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HandlerResolver = (type: string) => Promise<JobHandler<any, any> | undefined>;

let resolveHandler: HandlerResolver | null = null;

/** Wołane RAZ przez korzeń kompozycji, zanim wystartuje worker. */
export function setJobHandlerResolver(resolver: HandlerResolver): void {
  resolveHandler = resolver;
}

/**
 * 083: polityki retencji — tak samo wstrzykiwane jak rozwiązywanie handlerów i z tego samego powodu.
 * Bez nich okresowe tyknięcie po prostu nie sprząta (i nie udaje, że sprząta).
 */
let politykiRetencji: PolitykaRetencji[] | null = null;

export function setRetentionPolicies(polityki: PolitykaRetencji[]): void {
  politykiRetencji = polityki;
}

const TICK_MS = 3000;
const CONCURRENCY = 2; // ile zadań równolegle na tick (per instancja)
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

// Guard singletona przetrwały HMR w dev (Next re-importuje moduły).
const g = globalThis as unknown as { __omniaJobWorker?: { timer: NodeJS.Timeout | null; cleanup: NodeJS.Timeout | null } };

/**
 * 084 (zadanie 28): jedno zadanie = jeden ZAKRES OPERACJI. Poza żądaniem `React.cache` nie działa,
 * więc handler sprawdzający dostęp pięćdziesiąt razy wykonywał dwieście zapytań o te same
 * członkostwa. Owinięcie daje tej pracy taki sam zakres memoizacji, jaki ma zwykłe żądanie —
 * i kończy się razem z zadaniem, więc nie ma czego unieważniać.
 */
async function processOne(job: JobRecord): Promise<void> {
  // 086 (zadanie 31): zadanie w tle jest dla logów tym, czym żądanie dla trasy — własnym
  // kontekstem. `requestId` to identyfikator zadania: pozwala zebrać wszystkie linie jednego
  // przebiegu, także te wypisane głęboko w handlerze, który o kolejce nic nie wie.
  return wKontekscieLogu(
    { requestId: job.id, module: job.type.split(".")[0], userId: job.ownerId ?? undefined },
    // 087 (zadanie 32): zadanie w tle jest operacją modułu — mierzymy je tam, gdzie jest jeden
    // punkt przejścia dla wszystkich handlerów.
    () => zmierzOperacje(job.type.split(".")[0], job.type, () => wZakresieOperacji(() => processOneWewnatrzZakresu(job))),
  );
}

async function processOneWewnatrzZakresu(job: JobRecord): Promise<void> {
  const handler = resolveHandler ? await resolveHandler(job.type) : undefined;
  if (!handler) {
    // Brak handlera = błąd trwały (ponawianie nic nie da).
    await failJobPermanent(job.id, `Brak handlera dla typu "${job.type}"`);
    return;
  }
  try {
    const payload = JSON.parse(job.payload || "{}");
    // 039: zgłoszenie etapu jest „wystrzel i zapomnij" — handler nie czeka na zapis, bo etap to
    // informacja dla użytkownika, a nie część wyniku. Błąd zapisu połykamy w `setJobProgress`.
    const progress = (text: string) => {
      void setJobProgress(job.id, text);
    };
    const result = await handler(payload, { ownerId: job.ownerId, jobId: job.id, progress });
    await completeJob(job.id, result);
  } catch (e) {
    await failJob(job.id, e instanceof Error ? e.message : String(e));
  }
}

/** Jeden przebieg: przejmij do CONCURRENCY zadań i wykonaj równolegle. Zwraca liczbę wziętych. */
export async function runTick(concurrency = CONCURRENCY): Promise<number> {
  const claimed: JobRecord[] = [];
  for (let i = 0; i < concurrency; i++) {
    const job = await claimNext();
    if (!job) break;
    claimed.push(job);
  }
  if (claimed.length > 0) await Promise.all(claimed.map(processOne));
  return claimed.length;
}

/**
 * Startuje workera in-process (idempotentnie).
 *
 * **088 (zadanie 33): pętla zadań i praca OKRESOWA są teraz sterowane osobno.** Pierwsza należy do
 * roli `worker`, druga do roli `cron` — bo mają różne wymagania skalowania: workerów mogą być dwa,
 * procesów `cron` jeden. W roli domyślnej (`all`, czyli dzisiejsze wdrożenie jednousługowe) chodzi
 * jedno i drugie, więc zachowanie się nie zmienia.
 */
export function startJobWorker(): void {
  const zadania = czyPrzetwarzaZadania();
  const okresowe = czyWykonujeOkresowe();
  if (!zadania && !okresowe) return;
  if (g.__omniaJobWorker) return; // już wystartowany w tym procesie
  g.__omniaJobWorker = { timer: null, cleanup: null };
  if (rolaNierozpoznana()) {
    // Literówka w nazwie roli nie może po cichu wyłączyć przetwarzania — mówimy o tym głośno
    // i pracujemy dalej w roli `all`.
    logEvent("warn", "runtime.rola.nierozpoznana", { wartosc: process.env.OMNIA_ROLE });
  }

  let running = false;
  const loop = async () => {
    if (running) return; // nie nakładaj ticków
    running = true;
    try {
      // Opróżniaj kolejno, dopóki są zadania (do rozsądnego limitu na jeden przebieg).
      let total = 0;
      for (let i = 0; i < 10; i++) {
        const n = await runTick();
        total += n;
        if (n === 0) break;
      }
    } catch (e) {
      reportServerError(e, { kind: "jobWorkerTick" });
    } finally {
      running = false;
    }
    // 087 (zadanie 32): dosypanie metryk zebranych w pamięci. Jedzie tyknięciem workera, a nie
    // własnym interwałem, bo to ten sam warunek: proces, który obsługuje zadania, żyje. Poza
    // `finally`, żeby błąd zapisu metryki nie wyglądał jak błąd przetwarzania zadań.
    await flushMetryk().catch((e) => reportServerError(e, { kind: "metricsFlush" }));
  };

  if (zadania) g.__omniaJobWorker.timer = setInterval(loop, TICK_MS);
  if (okresowe) g.__omniaJobWorker.cleanup = setInterval(() => {
    cleanupOldJobs().catch((e) => reportServerError(e, { kind: "jobCleanup" }));
    // 081: wygasłe okna i dzierżawy limitera. Sprzątanie nie jest warunkiem POPRAWNOŚCI (wygasłe
    // okno zeruje się przy pierwszym trafieniu, wygasły slot da się przejąć) — pilnuje tylko, żeby
    // tabela nie rosła liniowo z liczbą kont, które kiedykolwiek dotknęły asystenta.
    posprzatajLimity().catch((e) => reportServerError(e, { kind: "rateLimitCleanup" }));
    // 083 (zadanie 30): retencja danych. Prawo do przebiegu jest odbierane atomowo, więc mimo że
    // tyknięcie chodzi w każdej instancji `web`, kasowanie wykona się raz na dobę.
    //
    // Polityki są WSTRZYKNIĘTE, dokładnie jak rozwiązywanie handlerów wyżej: dwie z siedmiu opisują
    // dane modułowe (Wiadomości, Zakupy), więc ich korzeń kompozycji stoi poza platformą. Sięgnięcie
    // po niego stąd `import()`-em odwróciłoby zależność — reguła lintu tego nie łapie, bo ścieżka
    // prowadzi przez `@/lib`, i właśnie dlatego trzeba to trzymać samemu.
    if (politykiRetencji) {
      void retencjaJesliCzas(politykiRetencji).catch((e) => reportServerError(e, { kind: "retention" }));
    }
  }, CLEANUP_EVERY_MS);
}
