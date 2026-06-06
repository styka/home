"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { updateTaskProjectStatusConfig } from "@/actions/taskProjects";
import type { ProjectStatusConfig, TaskStatus } from "@/types";
import { SYSTEM_TASK_STATUSES, statusMeta } from "@/types";

interface Props {
  projectId: string;
  config: ProjectStatusConfig;
  onClose: () => void;
}

type Row = { key: TaskStatus; enabled: boolean; inChain: boolean };

/** Buduje uporządkowaną listę wierszy: najpierw włączone (w kolejności listy), potem reszta systemowych. */
function buildRows(config: ProjectStatusConfig): Row[] {
  const enabledSet = new Set(config.enabled);
  const chainSet = new Set(config.chain);
  const ordered: Row[] = config.enabled.map((key) => ({ key, enabled: true, inChain: chainSet.has(key) }));
  for (const s of SYSTEM_TASK_STATUSES) {
    if (!enabledSet.has(s.key)) ordered.push({ key: s.key, enabled: false, inChain: false });
  }
  return ordered;
}

export function TaskStatusConfigEditor({ projectId, config, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(config));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= rows.length) return;
    setRows((prev) => {
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function toggleEnabled(idx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, enabled: !r.enabled, inChain: !r.enabled ? r.inChain : false } : r
      )
    );
  }

  function toggleChain(idx: number) {
    setRows((prev) => prev.map((r, i) => (i === idx && r.enabled ? { ...r, inChain: !r.inChain } : r)));
  }

  function handleSave() {
    const enabled = rows.filter((r) => r.enabled).map((r) => r.key);
    if (enabled.length === 0) {
      setError("Włącz co najmniej jeden status.");
      return;
    }
    const chain = rows.filter((r) => r.enabled && r.inChain).map((r) => r.key);
    setError(null);
    startTransition(async () => {
      try {
        await updateTaskProjectStatusConfig(projectId, { enabled, chain });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-md rounded-lg border overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Statusy listy</span>
          <button onClick={onClose} className="p-1.5 rounded focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 overflow-y-auto">
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text-secondary)" }}>Włączony</strong> — status widoczny jako zakładka i cel zmiany.{" "}
            <strong style={{ color: "var(--text-secondary)" }}>W ścieżce</strong> — bierze udział w przechodzeniu przód/tył (klik checkboxa, klawisz x). Kolejność wyznacza zakładki i kierunek ścieżki.
          </p>

          <div className="flex flex-col gap-1">
            {rows.map((r, idx) => {
              const meta = statusMeta(r.key);
              return (
                <div
                  key={r.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded"
                  style={{ backgroundColor: "var(--bg-elevated)", opacity: r.enabled ? 1 : 0.55 }}
                >
                  <div className="flex flex-col">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="W górę">
                      <ChevronUp size={13} />
                    </button>
                    <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="W dół">
                      <ChevronDown size={13} />
                    </button>
                  </div>

                  <span className="flex-1 text-sm" style={{ color: meta.color }}>{meta.label}</span>

                  <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                    <input type="checkbox" checked={r.enabled} onChange={() => toggleEnabled(idx)} style={{ accentColor: "var(--accent-blue)" }} />
                    Włączony
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: r.enabled ? "var(--text-secondary)" : "var(--text-muted)" }}>
                    <input type="checkbox" checked={r.inChain} disabled={!r.enabled} onChange={() => toggleChain(idx)} style={{ accentColor: "var(--accent-green)" }} />
                    W ścieżce
                  </label>
                </div>
              );
            })}
          </div>

          {error && <p className="text-xs mt-2" style={{ color: "var(--accent-red)" }}>{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded focus:outline-none" style={{ color: "var(--text-secondary)" }}>
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded focus:outline-none disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
          >
            {isPending && <Loader2 size={12} className="animate-spin" />}
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
