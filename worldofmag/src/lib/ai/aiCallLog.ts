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
  const head = "czas | źródło | op | dostawca | model | ok | status | próby | prompt+compl=total tok | latency ms | conversationId | błąd";
  const lines = rows.map((r) =>
    [
      fmtAiCallTime(r.createdAt),
      r.source ?? "—",
      r.operationType,
      r.providerKind,
      r.model,
      r.ok ? "OK" : "FAIL",
      r.status ?? "—",
      r.attempts,
      `${r.promptTokens}+${r.completionTokens}=${r.totalTokens}`,
      r.latencyMs,
      r.conversationId ?? "—",
      r.errorText ? r.errorText.replace(/\s+/g, " ") : "",
    ].join(" | ")
  );
  return [head, ...lines].join("\n");
}
