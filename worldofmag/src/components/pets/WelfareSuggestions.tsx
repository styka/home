"use client";

import { useEffect, useState } from "react";
import { Sparkles, Info, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";
import { llm } from "@/lib/llm-client";
import type { WelfareSuggestion, CareAgendaItem } from "@/types";

const SEVERITY_META = {
  info: { color: "var(--accent-blue)", Icon: Info },
  warning: { color: "var(--accent-amber)", Icon: AlertTriangle },
  danger: { color: "var(--accent-red)", Icon: ShieldAlert },
} as const;

interface Props {
  suggestions: WelfareSuggestion[];
  pets: Array<{ name: string; species: string; presetKey?: string }>;
  agenda: CareAgendaItem[];
}

export function WelfareSuggestions({ suggestions, pets, agenda }: Props) {
  const [tips, setTips] = useState<string[] | null>(null);
  const [loadingTips, setLoadingTips] = useState(false);

  useEffect(() => {
    if (pets.length === 0) return;
    let cancelled = false;
    setLoadingTips(true);
    llm.pets
      .insights({
        pets,
        agenda: agenda.map((a) => ({ petName: a.petName, title: a.title, bucket: a.bucket, dueAt: a.dueAt })),
        ruleSuggestions: suggestions.map((s) => ({ title: s.title, detail: s.detail })),
      })
      .then((res) => { if (!cancelled) setTips(res.tips ?? []); })
      .catch(() => { if (!cancelled) setTips([]); })
      .finally(() => { if (!cancelled) setLoadingTips(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (suggestions.length === 0 && !loadingTips && (!tips || tips.length === 0)) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {suggestions.map((s) => {
        const meta = SEVERITY_META[s.severity];
        return (
          <div
            key={s.id}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "10px 12px", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--bg-surface)",
            }}
          >
            <meta.Icon size={15} style={{ color: meta.color, flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{s.title}</div>
              {s.detail && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{s.detail}</div>}
            </div>
          </div>
        );
      })}

      {(loadingTips || (tips && tips.length > 0)) && (
        <div
          style={{
            padding: "12px 14px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Sparkles size={13} style={{ color: "var(--accent-purple)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-purple)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Porady AI
            </span>
            {loadingTips && <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-muted)" }} />}
          </div>
          {tips && tips.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
              {tips.map((t, i) => (
                <li key={i} style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
