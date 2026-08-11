"use client";

import { useEffect, useState } from "react";
import { Sparkles, Info, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";
import { runJob } from "@/lib/jobs/client";
import type { WelfareSuggestion, CareAgendaItem } from "@/types";
import type { AiCostUsage } from "@/components/ui/AiCostBadge";
import { AiContentMeta, AiContentPending } from "@/components/ui/AiContentMeta";
import type { AiSectionMode } from "@/platform/ai/sectionMode";

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
  const [aiUsage, setAiUsage] = useState<AiCostUsage | undefined>();
  const [aiMemory, setAiMemory] = useState<{ generatedAt?: string; stale?: boolean }>({});
  const [loadingTips, setLoadingTips] = useState(false);
  /** 041: porady czekają na kliknięcie — stan osobny od „jeszcze się ładuje" i od „brak porad". */
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<AiSectionMode>("onDemand");

  // Z-131 (T-17): porady przez kolejkę zadań (degradacja łagodna — brak AI → [] tips).
  function runTips(force: boolean) {
    return runJob<{
      tips: string[];
      usage?: AiCostUsage;
      generatedAt?: string;
      stale?: boolean;
      pending?: boolean;
      mode?: AiSectionMode;
    }>("pets.insights", {
      pets,
      agenda: agenda.map((a) => ({ petName: a.petName, title: a.title, bucket: a.bucket, dueAt: a.dueAt })),
      ruleSuggestions: suggestions.map((s) => ({ title: s.title, detail: s.detail })),
      force,
    });
  }

  function load(force = false) {
    if (pets.length === 0) return;
    setLoadingTips(true);
    runTips(force)
      .then((res) => {
        if (res.mode) setMode(res.mode);
        // 041: sekcja startuje przy wejściu na stronę, więc `pending` NIE jest tu ponawiane w tle —
        // to jest dokładnie ta sytuacja, w której model ma milczeć do czasu decyzji użytkownika.
        setPending(!!res.pending);
        if (res.pending) return;
        setTips(res.tips ?? []);
        setAiUsage(res.usage);
        setAiMemory({ generatedAt: res.generatedAt, stale: res.stale });
      })
      .catch(() => setTips([]))
      .finally(() => setLoadingTips(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 041: `pending` musi przetrwać ten warunek — bez porad i bez sygnałów sekcja znikałaby całkowicie,
  // więc użytkownik nie miałby czego kliknąć, żeby je w ogóle dostać.
  if (suggestions.length === 0 && !loadingTips && !pending && (!tips || tips.length === 0)) {
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

      {pending && (
        <AiContentPending
          busy={loadingTips}
          onGenerate={() => load(true)}
          title="Porady AI powstaną po kliknięciu"
          hint="Ta sekcja jest ustawiona na „na żądanie”, więc wejście na stronę nic nie kosztuje."
          actionLabel="Poproś o porady"
          sectionKind="pets.insights"
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            if (m !== "onDemand") load();
          }}
        />
      )}

      {!pending && (loadingTips || (tips && tips.length > 0)) && (
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
          <div style={{ marginTop: 8 }}>
            <AiContentMeta
              generatedAt={aiMemory.generatedAt}
              stale={aiMemory.stale}
              busy={loadingTips}
              onRefresh={() => load(true)}
              refreshLabel="Nowe porady"
              staleHint="Zwierzęta lub zadania opieki zmieniły się od czasu wygenerowania tych porad"
              usage={aiUsage}
              sectionKind="pets.insights"
              mode={mode}
              onModeChange={(m) => setMode(m)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
