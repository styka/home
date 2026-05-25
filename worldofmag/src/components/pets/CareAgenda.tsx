"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Loader2, AlertCircle, Clock, CalendarDays, Syringe, Pill, Bug, Utensils, Stethoscope } from "lucide-react";
import { completeTreatment, completeCareTask } from "@/actions/petCare";
import { speciesEmoji } from "@/lib/petSpecies";
import { useToast } from "@/components/ui/Toast";
import type { CareAgendaItem } from "@/types";

const BUCKET_META: Record<CareAgendaItem["bucket"], { label: string; color: string; Icon: typeof AlertCircle }> = {
  OVERDUE: { label: "Zaległe", color: "var(--accent-red)", Icon: AlertCircle },
  TODAY: { label: "Dziś", color: "var(--accent-amber)", Icon: Clock },
  UPCOMING: { label: "Nadchodzące (7 dni)", color: "var(--accent-blue)", Icon: CalendarDays },
};

function categoryIcon(category: string) {
  switch (category) {
    case "VACCINE": return <Syringe size={14} />;
    case "DEWORMER":
    case "PARASITE": return <Bug size={14} />;
    case "FEEDING": return <Utensils size={14} />;
    case "VET": return <Stethoscope size={14} />;
    default: return <Pill size={14} />;
  }
}

function dueLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
}

export function CareAgenda({ items, emptyHint }: { items: CareAgendaItem[]; emptyHint?: string }) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  function handleComplete(item: CareAgendaItem) {
    const rawId = item.id.slice(2); // strip "t-"/"c-" prefix
    startTransition(async () => {
      try {
        if (item.kind === "TREATMENT") await completeTreatment(rawId);
        else if (item.kind === "CARE_TASK") await completeCareTask(rawId);
        else { showToast("Otwórz profil zwierzęcia, aby zaktualizować wizytę", "info"); return; }
        setDoneIds((prev) => new Set(prev).add(item.id));
        showToast("Odhaczono", "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  const visible = items.filter((i) => !doneIds.has(i.id));

  if (visible.length === 0) {
    return (
      <div style={{ padding: "20px 16px", borderRadius: 10, border: "1px dashed var(--border)", background: "var(--bg-surface)", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Brak zaplanowanych zadań opieki 🎉</p>
        {emptyHint && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>{emptyHint}</p>}
      </div>
    );
  }

  const buckets: CareAgendaItem["bucket"][] = ["OVERDUE", "TODAY", "UPCOMING"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {buckets.map((bucket) => {
        const group = visible.filter((i) => i.bucket === bucket);
        if (group.length === 0) return null;
        const meta = BUCKET_META[bucket];
        return (
          <div key={bucket}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <meta.Icon size={13} style={{ color: meta.color }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {meta.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {group.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--bg-surface)",
                  }}
                >
                  <span style={{ color: meta.color, display: "flex", flexShrink: 0 }}>{categoryIcon(item.category)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.title}
                    </div>
                    <Link href={`/pets/${item.petId}`} style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none" }}>
                      {speciesEmoji(item.petSpecies)} {item.petName} · {dueLabel(item.dueAt)}
                    </Link>
                  </div>
                  {item.kind !== "VET_VISIT" && (
                    <button
                      onClick={() => handleComplete(item)}
                      disabled={isPending}
                      title="Odhacz wykonanie"
                      style={{
                        flexShrink: 0, width: 28, height: 28, borderRadius: 6,
                        border: "1px solid var(--border)", background: "var(--bg-elevated)",
                        color: "var(--accent-green)", cursor: isPending ? "wait" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
