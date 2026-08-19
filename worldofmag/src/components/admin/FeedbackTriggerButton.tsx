"use client";

import { useTranslations } from "next-intl";
import { MousePointerClick } from "lucide-react";
import { startFeedbackInspector } from "@/platform/ai/feedbackBus";

/**
 * Wpis w panelu admina uruchamiający „tryb wskazywania" (FeedbackInspector).
 * Tryb nie ma już stałego pływającego przycisku — startuje stąd, skrótem
 * Ctrl/Cmd+Shift+B lub admińskim przyciskiem w górnym pasku (mobile).
 */
export function FeedbackTriggerButton() {
  const t = useTranslations("components.admin.FeedbackTriggerButton");
  return (
    <button
      onClick={() => startFeedbackInspector()}
      className="admin-tool-link"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", width: "100%", background: "transparent", border: "none", color: "var(--text-primary)", textAlign: "left", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
    >
      <MousePointerClick size={15} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
      <span style={{ fontSize: 13 }}>{t("zglosBladSugestieWskaz")}</span>
      <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>›</span>
    </button>
  );
}
