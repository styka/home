"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Loader2, Plus, Pencil, Trash2, Check } from "lucide-react";
import { updateTaskProjectStatusConfig } from "@/actions/taskProjects";
import { Modal } from "@/components/ui/Modal";
import type { ProjectStatusConfig, CustomTaskStatus } from "@/types";
import { resolveStatuses } from "@/types";
import { StatusIcon, STATUS_ICON_OPTIONS } from "./StatusIcon";

interface Props {
  projectId: string;
  config: ProjectStatusConfig;
  onClose: () => void;
}

type Row = {
  key: string;
  label: string;
  color: string;
  icon: string;
  isTerminal: boolean;
  isSystem: boolean;
  enabled: boolean;
  inChain: boolean;
};

// Paleta kolorów dla własnych statusów (akcenty motywu).
const COLOR_OPTIONS = [
  "var(--text-muted)",
  "var(--accent-blue)",
  "var(--accent-green)",
  "var(--accent-amber)",
  "var(--accent-red)",
  "var(--accent-purple)",
];

/** Buduje uporządkowaną listę wierszy: najpierw włączone (w kolejności listy), potem reszta. */
function buildRows(config: ProjectStatusConfig): Row[] {
  const all = resolveStatuses(config);
  const enabledSet = new Set(config.enabled);
  const chainSet = new Set(config.chain);
  const byKey = new Map(all.map((s) => [s.key, s]));
  const ordered: Row[] = [];
  for (const key of config.enabled) {
    const s = byKey.get(key);
    if (s) ordered.push({ ...s, enabled: true, inChain: chainSet.has(key) });
  }
  for (const s of all) {
    if (!enabledSet.has(s.key)) ordered.push({ ...s, enabled: false, inChain: false });
  }
  return ordered;
}

function randomKey() {
  return "c_" + Math.random().toString(36).slice(2, 10);
}

type FormState = { label: string; color: string; icon: string; isTerminal: boolean };
const EMPTY_FORM: FormState = { label: "", color: "var(--accent-blue)", icon: "circle", isTerminal: false };

export function TaskStatusConfigEditor({ projectId, config, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(config));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Formularz dodawania/edycji własnego statusu. editingKey === null ⇒ dodawanie.
  const [formOpen, setFormOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

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

  function removeCustom(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function openAdd() {
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(row: Row) {
    setEditingKey(row.key);
    setForm({ label: row.label, color: row.color, icon: row.icon, isTerminal: row.isTerminal });
    setFormOpen(true);
  }

  function submitForm() {
    const label = form.label.trim();
    if (!label) {
      setError("Podaj nazwę statusu.");
      return;
    }
    setError(null);
    if (editingKey) {
      setRows((prev) =>
        prev.map((r) =>
          r.key === editingKey ? { ...r, label, color: form.color, icon: form.icon, isTerminal: form.isTerminal } : r
        )
      );
    } else {
      setRows((prev) => [
        ...prev,
        { key: randomKey(), label, color: form.color, icon: form.icon, isTerminal: form.isTerminal, isSystem: false, enabled: true, inChain: false },
      ]);
    }
    setFormOpen(false);
  }

  function handleSave() {
    const enabled = rows.filter((r) => r.enabled).map((r) => r.key);
    if (enabled.length === 0) {
      setError("Włącz co najmniej jeden status.");
      return;
    }
    const chain = rows.filter((r) => r.enabled && r.inChain).map((r) => r.key);
    const custom: CustomTaskStatus[] = rows
      .filter((r) => !r.isSystem)
      .map((r) => ({ key: r.key, label: r.label, color: r.color, icon: r.icon, isTerminal: r.isTerminal }));
    setError(null);
    startTransition(async () => {
      try {
        await updateTaskProjectStatusConfig(projectId, { enabled, chain, custom });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać");
      }
    });
  }

  return (
    <Modal
      onClose={onClose}
      title="Statusy listy"
      footer={
        <>
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
        </>
      }
    >
      <div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text-secondary)" }}>Włączony</strong> — status widoczny jako zakładka i cel zmiany.{" "}
            <strong style={{ color: "var(--text-secondary)" }}>W ścieżce</strong> — bierze udział w przechodzeniu przód/tył (klik checkboxa, klawisz x). Kolejność wyznacza zakładki i kierunek ścieżki. Statusy systemowe można tylko włączać/wyłączać; własne można edytować i usuwać.
          </p>

          <div className="flex flex-col gap-1">
            {rows.map((r, idx) => (
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

                <StatusIcon name={r.icon} size={15} color={r.color} />
                <span className="flex-1 text-sm truncate" style={{ color: r.color }}>{r.label}</span>

                {!r.isSystem && (
                  <>
                    <button onClick={() => openEdit(r)} className="focus:outline-none" style={{ color: "var(--text-muted)" }} title="Edytuj status">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => removeCustom(r.key)} className="focus:outline-none" style={{ color: "var(--accent-red)" }} title="Usuń status">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}

                <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                  <input type="checkbox" checked={r.enabled} onChange={() => toggleEnabled(idx)} style={{ accentColor: "var(--accent-blue)" }} />
                  Włączony
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: r.enabled ? "var(--text-secondary)" : "var(--text-muted)" }}>
                  <input type="checkbox" checked={r.inChain} disabled={!r.enabled} onChange={() => toggleChain(idx)} style={{ accentColor: "var(--accent-green)" }} />
                  W ścieżce
                </label>
              </div>
            ))}
          </div>

          {formOpen ? (
            <div className="mt-3 p-3 rounded border flex flex-col gap-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {editingKey ? "Edytuj status" : "Nowy status"}
              </span>
              <input
                autoFocus
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") submitForm(); }}
                placeholder="Nazwa statusu"
                className="text-sm px-2 py-1.5 rounded focus:outline-none"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs w-12" style={{ color: "var(--text-muted)" }}>Kolor</span>
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className="w-5 h-5 rounded-full focus:outline-none flex items-center justify-center"
                    style={{ backgroundColor: c, border: form.color === c ? "2px solid var(--text-primary)" : "1px solid var(--border)" }}
                    title={c}
                  >
                    {form.color === c && <Check size={11} style={{ color: "#fff" }} />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs w-12" style={{ color: "var(--text-muted)" }}>Ikona</span>
                {STATUS_ICON_OPTIONS.map((name) => (
                  <button
                    key={name}
                    onClick={() => setForm((f) => ({ ...f, icon: name }))}
                    className="p-1 rounded focus:outline-none"
                    style={{ backgroundColor: form.icon === name ? "var(--bg-hover)" : "transparent", border: form.icon === name ? "1px solid var(--accent-blue)" : "1px solid transparent" }}
                    title={name}
                  >
                    <StatusIcon name={name} size={15} color={form.color} />
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={form.isTerminal} onChange={(e) => setForm((f) => ({ ...f, isTerminal: e.target.checked }))} style={{ accentColor: "var(--accent-green)" }} />
                Status „zamykający" (chowany w widoku aktywnych, jak Zrobione)
              </label>
              <div className="flex items-center justify-end gap-2 mt-1">
                <button onClick={() => setFormOpen(false)} className="text-xs px-2.5 py-1 rounded focus:outline-none" style={{ color: "var(--text-secondary)" }}>
                  Anuluj
                </button>
                <button onClick={submitForm} className="text-xs px-2.5 py-1 rounded focus:outline-none" style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}>
                  {editingKey ? "Zapisz status" : "Dodaj"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 text-xs mt-3 px-2 py-1.5 rounded focus:outline-none"
              style={{ color: "var(--accent-blue)" }}
            >
              <Plus size={14} /> Dodaj własny status
            </button>
          )}

        {error && <p className="text-xs mt-2" style={{ color: "var(--accent-red)" }}>{error}</p>}
      </div>
    </Modal>
  );
}
