import type { AiCallLogRow } from "@/actions/llmConfig";

// Wspólny formatter surowego logu wywołań LLM (tabela `AiCall`). Jedno źródło formatu dla panelu
// „Diagnostyka asystenta AI" (/admin/ai-calls) i dla zgłoszenia błędu z czatu asystenta — dzięki temu
// oba miejsca prezentują dokładnie te same pola (bez rozjazdu).

export function fmtAiCallTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pl-PL", { hour12: false });
  } catch {
    return iso;
  }
}

export function aiCallsToText(rows: AiCallLogRow[]): string {
  const head = "czas | źródło | op | dostawca | model | wysiłek | ok | status | próby | prompt+compl=total tok | cache zapis/odczyt | latency ms | conversationId | błąd";
  const lines = rows.map((r) =>
    [
      fmtAiCallTime(r.createdAt),
      r.source ?? "—",
      r.operationType,
      r.providerKind,
      r.model,
      // 033: poziom wysiłku faktycznie użyty; „—" = parametr nie był wysyłany.
      r.effort ?? "—",
      r.ok ? "OK" : "FAIL",
      r.status ?? "—",
      r.attempts,
      `${r.promptTokens}+${r.completionTokens}=${r.totalTokens}`,
      // 034: tokeny pamięci podręcznej promptu są ROZLICZANE (zapis drożej niż wejście), więc bez
      // nich kwota kosztu wygląda na wziętą z sufitu.
      `${r.cacheWriteTokens}/${r.cacheReadTokens}`,
      r.latencyMs,
      r.conversationId ?? "—",
      r.errorText ? r.errorText.replace(/\s+/g, " ") : "",
    ].join(" | ")
  );
  return [head, ...lines].join("\n");
}
