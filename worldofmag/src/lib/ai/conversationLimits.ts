// Z-215: limity pamięci/ładowania historii rozmów asystenta AI.
// Wydzielone z `actions/aiConversations.ts` ("use server"), żeby logikę dało się
// przetestować jednostkowo (eksport z pliku "use server" stałby się Server Action).

/** Ile NAJNOWSZYCH wiadomości ładujemy do widoku rozmowy (reszta poza oknem). */
export const MESSAGE_WINDOW = 300;

/** Twardy limit rozmiaru sidecara `AiMessage.data` (JSON: plan/wyniki) — ochrona przed wielkim wierszem. */
export const MAX_DATA_BYTES = 128 * 1024;

/**
 * Ogranicza rozmiar `AiMessage.data`. Zwraca:
 *  - `undefined` dla braku/nieserializowalnych danych (np. BigInt) — nie zapisujemy,
 *  - oryginał, gdy mieści się w limicie,
 *  - marker `{ truncated: true, ... }`, gdy przekracza limit (treść tekstowa wiadomości zostaje nietknięta).
 */
export function boundMessageData(data: unknown): unknown {
  if (data === undefined || data === null) return undefined;
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return undefined; // cykliczne / nieserializowalne
  }
  if (serialized === undefined) return undefined; // np. funkcja/symbol
  if (Buffer.byteLength(serialized, "utf8") > MAX_DATA_BYTES) {
    return { truncated: true, reason: `dane wiadomości przekroczyły limit ${MAX_DATA_BYTES} B` };
  }
  return data;
}
