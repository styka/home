// Z-131 (T-17) — wspólne typy warstwy zadań (handlery + błędy). Bez zależności od
// Prismy/Next, żeby dało się importować i z workera, i z tras API, i z testów.

/** Błąd z kodem HTTP — handler rzuca go, a trasa/worker mapują na status/porażkę. */
export class JobError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "JobError";
    this.status = status;
  }
}

/** Kontekst wykonania zadania (bez sesji — właściciel przekazany w jobie). */
export interface JobContext {
  ownerId: string | null;
  jobId: string;
  /**
   * 039: zgłoszenie etapu wieloetapowego zadania („Pobieram źródła (3/5)…"). Trafia do `Job.progress`,
   * więc przeżywa odświeżenie strony — komponent odczytuje etap z kolejki, nie z własnej pamięci.
   * Opcjonalne, bo zadania jednoetapowe nie mają czego zgłaszać, a testy nie muszą tego podstawiać.
   */
  progress?: (text: string) => void;
}

/** Handler zadania: dostaje payload (odparsowany JSON) i kontekst, zwraca wynik (JSON-owalny). */
export type JobHandler<P = unknown, R = unknown> = (payload: P, ctx: JobContext) => Promise<R>;
