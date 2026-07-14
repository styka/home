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
}

/** Handler zadania: dostaje payload (odparsowany JSON) i kontekst, zwraca wynik (JSON-owalny). */
export type JobHandler<P = unknown, R = unknown> = (payload: P, ctx: JobContext) => Promise<R>;
