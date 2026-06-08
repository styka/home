"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTask } from "@/actions/tasks";
import { statusMetaFor, type Task, type ProjectStatusConfig } from "@/types";

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--accent-red)",
  HIGH: "var(--accent-amber)",
  MEDIUM: "var(--accent-blue)",
  LOW: "var(--text-muted)",
  NONE: "transparent",
};

/** Tablica Kanban (T2): kolumny = włączone statusy listy; karty przeciągane między kolumnami zmieniają status. */
export function KanbanBoard({ tasks, statusConfig, onOpen }: { tasks: Task[]; statusConfig: ProjectStatusConfig; onOpen: (id: string) => void }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const columns = statusConfig.enabled.map((key) => statusMetaFor(key, statusConfig));

  async function drop(statusKey: string) {
    const id = dragId;
    setDragId(null); setOverKey(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === statusKey) return;
    await updateTask(id, { status: statusKey });
    router.refresh();
  }

  return (
    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden" style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 12, height: "100%", alignItems: "flex-start" }}>
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverKey(col.key); }}
              onDragLeave={() => setOverKey((k) => (k === col.key ? null : k))}
              onDrop={() => drop(col.key)}
              style={{
                width: 270, flexShrink: 0, maxHeight: "100%", display: "flex", flexDirection: "column",
                background: overKey === col.key ? "var(--bg-hover)" : "var(--bg-surface)",
                border: `1px solid ${overKey === col.key ? col.color : "var(--border)"}`,
                borderRadius: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: col.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{col.label}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>{colTasks.length}</span>
              </div>
              <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {colTasks.length === 0 ? (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 2px" }}>—</span>
                ) : (
                  colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setOverKey(null); }}
                      onClick={() => onOpen(t.id)}
                      style={{
                        background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8,
                        padding: "8px 10px", cursor: "grab", opacity: dragId === t.id ? 0.5 : 1,
                        borderLeft: t.priority && t.priority !== "NONE" ? `3px solid ${PRIORITY_COLOR[t.priority] ?? "transparent"}` : "1px solid var(--border)",
                      }}
                    >
                      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.35 }}>{t.title}</div>
                      {t.dueDate && (
                        <div style={{ fontSize: 11, color: new Date(t.dueDate) < new Date() && !col.isTerminal ? "var(--accent-red)" : "var(--text-muted)", marginTop: 3 }}>
                          {new Date(t.dueDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
