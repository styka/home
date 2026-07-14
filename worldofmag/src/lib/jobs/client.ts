// Z-131 (T-17) — klient kolejki. `runJob` = zakolejkuj + odpytuj do skutku i zwróć
// wynik (albo rzuć błąd). Dzięki temu wywołujący UI zmienia się minimalnie: dalej
// `await runJob(...)` i dostaje wynik/rzut — tylko teraz backend robi to asynchronicznie
// (bez timeoutów żądania, z ponawianiem po stronie workera).

export interface RunJobOptions {
  dedupeKey?: string;
  /** Odstęp pollingu (ms). */
  pollMs?: number;
  /** Maksymalny czas oczekiwania (ms) zanim rzucimy timeout. */
  timeoutMs?: number;
  /** Callback statusu (np. do pokazania „przetwarzanie…"). */
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });

/** Zakolejkuj zadanie `type` z `payload` i poczekaj na wynik (typ R). Rzuca Error na porażce. */
export async function runJob<R = unknown>(type: string, payload: unknown, opts: RunJobOptions = {}): Promise<R> {
  const { pollMs = 1500, timeoutMs = 5 * 60 * 1000, onStatus, signal } = opts;

  const enqRes = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload, dedupeKey: opts.dedupeKey }),
    signal,
  });
  const enq = await enqRes.json().catch(() => ({}));
  if (!enqRes.ok || !enq.jobId) throw new Error(enq.error || "Nie udało się zakolejkować zadania");

  onStatus?.(enq.status ?? "QUEUED");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollMs, signal);
    const res = await fetch(`/api/jobs/${enq.jobId}`, { signal });
    if (!res.ok) {
      if (res.status === 404) throw new Error("Zadanie zniknęło");
      continue; // przejściowy błąd — spróbuj dalej
    }
    const s = await res.json();
    onStatus?.(s.status);
    if (s.status === "DONE") return s.result as R;
    if (s.status === "FAILED") throw new Error(s.error || "Zadanie nie powiodło się");
    if (s.status === "CANCELLED") throw new Error("Zadanie anulowane");
    // QUEUED / RUNNING → odpytuj dalej
  }
  throw new Error("Przekroczono czas oczekiwania na zadanie");
}
