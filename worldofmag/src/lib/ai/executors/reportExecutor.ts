// Z-010: handler akcji asystenta dla modułu Raporty (zapis wyniku/sesji do /reports).
import { createUserReport } from "@/actions/reports";
import { asStr, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeReportAction(action: AIAction): Promise<string | ExecOutcome> {
  const { type, params } = action;

  if (type === "save_report") {
    const title = asStr(params.title) ?? "Raport z asystenta";
    const content = asStr(params.content) ?? String(params.content ?? "");
    if (!content.trim()) throw new Error("Pusta treść raportu");
    const report = await createUserReport({ title, content });
    return { message: `Zapisano raport „${title}"`, navigateTo: `/reports/${report.slug}`, navigateLabel: "Otwórz raport" };
  }

  throw new Error(`Nieznany typ akcji raportów: ${type}`);
}
