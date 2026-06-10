"use client";

import { useState, useTransition } from "react";
import { Trash2, RotateCcw, FileText, CheckSquare, Loader2 } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { restoreTrashItem, purgeTrashItem, emptyTrash, type TrashItemDTO } from "@/actions/trash";

const MODULE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  notes: { label: "Notatka", icon: <FileText size={14} />, color: "var(--accent-purple)" },
  tasks: { label: "Zadanie", icon: <CheckSquare size={14} />, color: "var(--accent-blue)" },
};

export function TrashPage({ items, retentionDays }: { items: TrashItemDTO[]; retentionDays: number }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function restore(id: string) {
    setBusyId(id);
    startTransition(async () => { await restoreTrashItem(id); setBusyId(null); });
  }
  function purge(id: string) {
    if (!confirm("Usunąć trwale? Tej operacji nie można cofnąć.")) return;
    setBusyId(id);
    startTransition(async () => { await purgeTrashItem(id); setBusyId(null); });
  }
  function empty() {
    if (!confirm("Opróżnić cały kosz? Wszystkie pozycje zostaną usunięte trwale.")) return;
    startTransition(() => { emptyTrash(); });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<Trash2 size={22} />}
          iconColor="var(--accent-red)"
          title="Kosz"
          href="/trash"
          subtitle={`Usunięte elementy można przywrócić. Automatyczne czyszczenie po ${retentionDays} dniach.`}
          action={
            items.length > 0 ? (
              <button onClick={empty} disabled={pending} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--accent-red)", fontSize: 13, cursor: "pointer" }}>
                <Trash2 size={13} /> Opróżnij kosz
              </button>
            ) : undefined
          }
        />

        {items.length === 0 ? (
          <EmptyState icon={<Trash2 size={28} />} message="Kosz jest pusty" hint="Usunięte notatki i zadania pojawią się tutaj i będzie je można przywrócić" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it) => {
              const meta = MODULE_META[it.module] ?? { label: it.module, icon: <FileText size={14} />, color: "var(--text-muted)" };
              const busy = busyId === it.id;
              return (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                  <span style={{ color: meta.color, flexShrink: 0 }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {meta.label} · usunięto {new Date(it.deletedAt).toLocaleString("pl-PL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <button onClick={() => restore(it.id)} disabled={busy} title="Przywróć" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "none", background: "var(--accent-green)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Przywróć
                  </button>
                  <button onClick={() => purge(it.id)} disabled={busy} title="Usuń trwale" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
