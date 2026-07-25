// 028 (optymalizacja kosztów asystenta): higiena kontekstu pętli agenta.
//
// Wyniki narzędzi (step "query") to największy ZMIENNY koszt tokenów: są wstrzykiwane
// do tablicy `messages` i re-wysyłane w KAŻDEJ kolejnej iteracji pętli. Tniemy to
// dwiema czystymi (testowalnymi) dźwigniami, wydzielonymi tu z `route.ts`:
//   1. `compactToolResults` — twardy limit rekordów/znaków POJEDYNCZEGO bloku wyników,
//      z czytelnym znacznikiem ucięcia (model wie, że dane są niepełne — może zawęzić),
//   2. `collapseUsedToolData` — zwijanie ZUŻYTYCH bloków do stuba (pełny zostaje tylko
//      ostatni, którego model właśnie potrzebuje) → koniec kwadratowego narostu tokenów.
// Oba są provider-agnostyczne i nie ruszają delimitera „NIEUFNE DANE" (dokłada go wołający).

export const PER_TOOL_MAX_RECORDS = 12; // maks. rekordów na jedno narzędzie wstrzykiwanych do kontekstu
export const TOOL_RESULT_MAX_CHARS = 3500; // twardy budżet znaków na CAŁY blok wyników (bezpiecznik)
// Stały prefiks bloku wyników — służy też do ROZPOZNANIA bloków do zwinięcia.
export const TOOL_DATA_HEADER = "Wyniki narzędzi";
export const TOOL_DATA_STUB = "[wyniki narzędzi z wcześniejszego kroku — już wykorzystane]";

export type ToolResult = {
  tool: string;
  args: Record<string, unknown>;
  data: unknown;
  error?: string;
  /** 030: znacznik powtórzonego wywołania (wynik z pamięci tury, nie z narzędzia). */
  repeat?: string;
};

// 030: próg skracania pojedynczego pola tekstowego w wynikach narzędzi. Długie opisy
// (np. zgłoszenia błędów ze zrzutami rozmów w opisie zadania) rozsadzały blok wyników,
// przez co bezpiecznik znakowy ucinał JSON W POŁOWIE — model nie rozumiał wyniku i
// ponawiał to samo zapytanie aż do limitu kroków. Skracamy per-pole (JSON zostaje
// poprawny), z jawnym markerem jak sięgnąć po całość.
export const FIELD_MAX_CHARS = 700;
const FIELD_TRIM_MARKER = (total: number) =>
  ` …[SKRÓCONO z ${total} znaków — pełna treść: get_task/get_note po id]`;

/**
 * Rekurencyjnie skraca wszystkie długie stringi w strukturze wyniku narzędzia do
 * `maxLen` znaków, doklejając czytelny marker skrócenia. Zwraca nową strukturę
 * (nie mutuje wejścia). JSON po serializacji pozostaje poprawny.
 */
export function trimLongStrings(value: unknown, maxLen: number = FIELD_MAX_CHARS): unknown {
  if (typeof value === "string") {
    return value.length > maxLen ? value.slice(0, maxLen) + FIELD_TRIM_MARKER(value.length) : value;
  }
  if (Array.isArray(value)) return value.map((v) => trimLongStrings(v, maxLen));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = trimLongStrings(v, maxLen);
    }
    return out;
  }
  return value;
}

/**
 * Kompaktuje wyniki narzędzi PRZED wstrzyknięciem do kontekstu. Dla każdego narzędzia
 * ogranicza listę rekordów do `PER_TOOL_MAX_RECORDS` z czytelnym znacznikiem ucięcia,
 * skraca długie pola tekstowe per-pole (`trimLongStrings` — JSON zostaje poprawny),
 * a na końcu stosuje twardy bezpiecznik znakowy na cały blok. Zwraca serializowany JSON
 * (string) gotowy do wstawienia między delimitery `<<<DANE … DANE>>>`.
 */
export function compactToolResults(results: ToolResult[]): string {
  const trimmed = results.map((r) => {
    const data = trimLongStrings(r.data);
    if (Array.isArray(data) && data.length > PER_TOOL_MAX_RECORDS) {
      const shown = data.slice(0, PER_TOOL_MAX_RECORDS);
      return {
        tool: r.tool,
        args: r.args,
        data: shown,
        truncated: `pokazano ${shown.length} z ${data.length} rekordów — zawęź zapytanie (search/status/limit)`,
        ...(r.error ? { error: r.error } : {}),
        ...(r.repeat ? { repeat: r.repeat } : {}),
      };
    }
    return { ...r, data };
  });
  const json = JSON.stringify(trimmed);
  if (json.length > TOOL_RESULT_MAX_CHARS) {
    return json.slice(0, TOOL_RESULT_MAX_CHARS) + " …[UCIĘTO — przekroczono budżet znaków; zawęź zapytanie]";
  }
  return json;
}

/**
 * Zwija ZUŻYTE bloki wyników narzędzi do krótkiego stuba, zostawiając pełny tylko
 * OSTATNI blok. Mutuje przekazaną tablicę wiadomości w miejscu. Blok rozpoznajemy po
 * stałym prefiksie treści (`TOOL_DATA_HEADER`); stub zaczyna się inaczej, więc nie jest
 * ponownie dopasowywany. Bez utraty jakości: starszy surowy listing jest już przetworzony
 * (model wyciągnął z niego id do kolejnego zapytania), a odpowiedź bazuje na najświeższych danych.
 */
export function collapseUsedToolData(messages: { role: string; content: string }[]): void {
  const idxs: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user" && typeof m.content === "string" && m.content.startsWith(TOOL_DATA_HEADER)) {
      idxs.push(i);
    }
  }
  for (let k = 0; k < idxs.length - 1; k++) {
    messages[idxs[k]].content = TOOL_DATA_STUB;
  }
}
