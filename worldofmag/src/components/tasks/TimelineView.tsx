"use client";

import { useMemo } from "react";
import { statusMetaFor, type Task, type ProjectStatusConfig } from "@/types";

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--accent-red)", HIGH: "var(--accent-amber)", MEDIUM: "var(--accent-blue)", LOW: "var(--text-muted)", NONE: "transparent",
};

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  const base = date.toLocaleDateString("pl-PL", { weekday: "long", day: "2-digit", month: "long" });
  if (diff === 0) return `Dziś · ${base}`;
  if (diff === 1) return `Jutro · ${base}`;
  if (diff === -1) return `Wczoraj · ${base}`;
  return base;
}

/** Widok osi czasu (T1): zadania pogrupowane po dniu terminu (zaległe → przyszłe), bez terminu na końcu. */
export function TimelineView({ tasks, statusConfig, onOpen }: { tasks: Task[]; statusConfig: ProjectStatusConfig; onOpen: (id: string) => void }) {
  const { groups, noDate } = useMemo(() => {
    const map = new Map<string, Task[]>();
    const noDate: Task[] = [];
    for (const t of tasks) {
      if (!t.dueDate) { noDate.push(t); continue; }
      const key = isoDay(new Date(t.dueDate));
      const arr = map.get(key);
      if (arr) arr.push(t); else map.set(key, [t]);
    }
    const groups = Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return { groups, noDate };
  }, [tasks]);

  const todayIso = isoDay(new Date());

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 12 }}>
      {groups.length === 0 && noDate.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", padding: 8 }}>Brak zadań do pokazania.</div>
      )}
      {groups.map(([iso, items]) => {
        const overdue = iso < todayIso;
        return (
          <div key={iso} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: overdue ? "var(--accent-red)" : "var(--text-secondary)", marginBottom: 6, textTransform: "capitalize" }}>
              {dayLabel(iso)}{overdue ? " · zaległe" : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {items.map((t) => <Row key={t.id} t={t} statusConfig={statusConfig} onOpen={onOpen} />)}
            </div>
          </div>
        );
      })}
      {noDate.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Bez terminu</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {noDate.map((t) => <Row key={t.id} t={t} statusConfig={statusConfig} onOpen={onOpen} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ t, statusConfig, onOpen }: { t: Task; statusConfig: ProjectStatusConfig; onOpen: (id: string) => void }) {
  const meta = statusMetaFor(t.status, statusConfig);
  return (
    <button
      onClick={() => onOpen(t.id)}
      className="flex items-center gap-2 w-full text-left focus:outline-none"
      style={{ padding: "7px 10px", borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 99, background: meta.color, flexShrink: 0 }} title={meta.label} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-primary)", textDecoration: meta.isTerminal ? "line-through" : "none", opacity: meta.isTerminal ? 0.6 : 1 }}>
        {t.title}
      </span>
      {t.priority && t.priority !== "NONE" && (
        <span style={{ width: 6, height: 6, borderRadius: 99, background: PRIORITY_COLOR[t.priority] ?? "transparent", flexShrink: 0 }} />
      )}
    </button>
  );
}
