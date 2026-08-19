"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { CheckSquare, Flag, Calendar, Tag as TagIcon, FolderInput, Trash2, X, Circle } from "lucide-react";
import { StatusIcon } from "./StatusIcon";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import type { TaskProject, TaskTagDef, TaskPriority, ProjectStatusConfig } from "@/types";
import { resolveStatuses, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS, DEFAULT_STATUS_CONFIG } from "@/types";

/** Łata przekazywana do bulkUpdateTasks — tylko ustawione pola są zmieniane. */
export type BulkPatch = Partial<{
  status: string;
  priority: TaskPriority;
  dueDate: Date | null;
  category: string;
  projectId: string | null;
  addTagIds: string[];
  removeTagIds: string[];
  completedAt: Date | null;
}>;

interface BulkActionBarProps {
  count: number;
  totalVisible: number;
  allSelected: boolean;
  pending: boolean;
  statusConfig?: ProjectStatusConfig;
  allProjects: TaskProject[];
  allTags: TaskTagDef[];
  onSelectAll: () => void;
  onClear: () => void;
  onApply: (patch: BulkPatch) => void;
  onDelete: () => void;
}

type Panel = null | "status" | "priority" | "due" | "category" | "project" | "tags";

const PRIORITIES: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"];

export function BulkActionBar({
  count, totalVisible, allSelected, pending, statusConfig = DEFAULT_STATUS_CONFIG,
  allProjects, allTags, onSelectAll, onClear, onApply, onDelete,
}: BulkActionBarProps) {
  const t = useTranslations("modules.tasks.BulkActionBar");
  // 080 (Z2): panele kotwiczymy do CAŁEGO paska, nie do pojedynczych przycisków — przyciski
  // przewijają się w poziomie na wąskim ekranie, więc kotwica na przycisku skakałaby razem z nimi.
  const barRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [dueValue, setDueValue] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  // Opcjonalna wspólna data wykonania dla masowego przejścia na status terminalny („Zrobione").
  const [doneDateValue, setDoneDateValue] = useState("");
  // Tagi: mapa id → "add" | "remove". Klik cyklicznie: brak → dodaj → usuń → brak.
  const [tagState, setTagState] = useState<Record<string, "add" | "remove">>({});

  const statuses = resolveStatuses(statusConfig);
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  function apply(patch: BulkPatch) {
    onApply(patch);
    setPanel(null);
  }

  function cycleTag(id: string) {
    setTagState((s) => {
      const next = { ...s };
      if (!next[id]) next[id] = "add";
      else if (next[id] === "add") next[id] = "remove";
      else delete next[id];
      return next;
    });
  }

  function applyTags() {
    const addTagIds = Object.entries(tagState).filter(([, v]) => v === "add").map(([id]) => id);
    const removeTagIds = Object.entries(tagState).filter(([, v]) => v === "remove").map(([id]) => id);
    if (addTagIds.length === 0 && removeTagIds.length === 0) { setPanel(null); return; }
    apply({ addTagIds, removeTagIds });
    setTagState({});
  }

  const actionBtn =
    "flex flex-col items-center justify-center gap-0.5 px-2.5 py-2 rounded text-xs focus:outline-none min-w-[52px]";
  // 080 (Z2): tło, ramkę, warstwę i POZYCJĘ daje `AnchoredLayer`. Zostało samo wypełnienie treści.
  // Wcześniej stało tu `absolute bottom-full` — czyli „zawsze w górę", bez sprawdzania, czy jest
  // tam miejsce, i bez odporności na przycięcie przez przewijany kontener.
  const panelWrap = "w-full";
  const panelStyle: React.CSSProperties = {};
  const itemBtn =
    "flex items-center gap-2 w-full px-2.5 py-2 rounded text-sm text-left focus:outline-none";

  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center px-3 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        // 080 (Z2): na komputerze pasek jest OBIEKTEM, nie belką przez cały ekran. `md:w-auto`
        // było, ale rząd akcji potrafi urosnąć szerzej niż okno, więc dokładamy sufit szerokości;
        // zewnętrzny kontener już centruje. Na telefonie bez zmian — tam pełna szerokość jest
        // właściwa, a `mb-16` omija dolny pasek zakładek.
        className="pointer-events-auto relative w-full md:w-auto md:max-w-2xl mb-16 md:mb-4 rounded-xl shadow-xl"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        {/* Popover aktywnej akcji — jedna warstwa na wszystkie sześć paneli (080/Z7). */}
        <AnchoredLayer
          anchorRef={barRef}
          open={panel !== null}
          onClose={() => setPanel(null)}
          side="gora"
          align="srodek"
          width={320}
          ariaLabel={t("opcjeAkcjiZbiorczej")}
          style={{ padding: 8 }}
        >
        {panel === "status" && (
          <div className={panelWrap} style={panelStyle}>
            {/* Opcjonalna data wykonania — stosowana przy przejściu na status „zamykający". */}
            <label className="block text-xs px-1 pb-1" style={{ color: "var(--text-muted)" }}>
              Data wykonania (opcjonalnie — dla „Zrobione”)
            </label>
            <input type="date" value={doneDateValue}
              onChange={(e) => setDoneDateValue(e.target.value)}
              className="w-full px-2 py-2 rounded text-sm mb-2"
              style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            {statuses.map((s) => (
              <button key={s.key} className={itemBtn} style={{ color: "var(--text-primary)" }}
                onClick={() => apply({ status: s.key, completedAt: s.isTerminal && doneDateValue ? new Date(doneDateValue + "T12:00:00") : undefined })}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}>
                <StatusIcon name={s.icon} size={16} color={s.color} />
                {s.label}
              </button>
            ))}
          </div>
        )}
        {panel === "priority" && (
          <div className={panelWrap} style={panelStyle}>
            {PRIORITIES.map((p) => (
              <button key={p} className={itemBtn} style={{ color: "var(--text-primary)" }}
                onClick={() => apply({ priority: p })}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}>
                <span className="inline-block rounded" style={{ width: 3, height: 16, backgroundColor: p !== "NONE" ? TASK_PRIORITY_COLORS[p] : "var(--border)" }} />
                {TASK_PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        )}
        {panel === "due" && (
          <div className={panelWrap} style={panelStyle}>
            <input type="date" value={dueValue} autoFocus
              onChange={(e) => setDueValue(e.target.value)}
              className="w-full px-2 py-2 rounded text-sm mb-2"
              style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <div className="flex gap-2">
              <button className="flex-1 px-2 py-2 rounded text-sm" disabled={!dueValue}
                style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)", opacity: dueValue ? 1 : 0.5 }}
                onClick={() => apply({ dueDate: new Date(dueValue + "T12:00:00") })}>Ustaw termin</button>
              <button className="flex-1 px-2 py-2 rounded text-sm"
                style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
                onClick={() => apply({ dueDate: null })}>{t("wyczyscTermin")}</button>
            </div>
          </div>
        )}
        {panel === "category" && (
          <div className={panelWrap} style={panelStyle}>
            <input type="text" value={categoryValue} autoFocus placeholder="Kategoria…"
              onChange={(e) => setCategoryValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && categoryValue.trim()) apply({ category: categoryValue.trim() }); }}
              className="w-full px-2 py-2 rounded text-sm mb-2"
              style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button className="w-full px-2 py-2 rounded text-sm" disabled={!categoryValue.trim()}
              style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)", opacity: categoryValue.trim() ? 1 : 0.5 }}
              onClick={() => apply({ category: categoryValue.trim() })}>{t("ustawKategorie")}</button>
          </div>
        )}
        {panel === "project" && (
          <div className={panelWrap} style={panelStyle}>
            {allProjects.map((p) => (
              <button key={p.id} className={itemBtn} style={{ color: "var(--text-primary)" }}
                onClick={() => apply({ projectId: p.id })}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}>
                <span>{p.isInbox ? "📥" : p.emoji ?? "📋"}</span>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
        {panel === "tags" && (
          <div className={panelWrap} style={panelStyle}>
            <p className="text-xs px-1 pb-1.5" style={{ color: "var(--text-muted)" }}>
              Klik: <span style={{ color: "var(--accent-green)" }}>dodaj</span> → <span style={{ color: "var(--accent-red)" }}>{t("usun")}</span> → brak
            </p>
            <div className="flex flex-wrap gap-1.5 pb-2">
              {allTags.length === 0 && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t("brakTagow")}</span>}
              {allTags.map((t) => {
                const st = tagState[t.id];
                const border = st === "add" ? "var(--accent-green)" : st === "remove" ? "var(--accent-red)" : "var(--border)";
                return (
                  <button key={t.id} onClick={() => cycleTag(t.id)}
                    className="px-2 py-1 rounded-full text-xs"
                    style={{ border: `1px solid ${border}`, color: "var(--text-primary)",
                      textDecoration: st === "remove" ? "line-through" : undefined }}>
                    {st === "add" ? "＋ " : st === "remove" ? "－ " : ""}{t.name}
                  </button>
                );
              })}
            </div>
            <button className="w-full px-2 py-2 rounded text-sm"
              style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
              onClick={applyTags}>Zastosuj tagi</button>
          </div>
        )}

        </AnchoredLayer>

        {/* Główny pasek — przewijalny poziomo na mobile, żeby wszystkie akcje były osiągalne
            na wąskim ekranie (wzorzec z paska narzędzi TasksPage). */}
        <div ref={barRef} className="flex items-center gap-1 p-2 overflow-x-auto [&>*]:flex-shrink-0" style={{ opacity: pending ? 0.6 : 1 }}>
          <div className="flex flex-col items-start pr-1 pl-1">
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{count}</span>
            <button onClick={onSelectAll} className="text-xs focus:outline-none hover:underline" style={{ color: "var(--accent-blue)" }}>
              {allSelected ? "Odznacz" : `Wszystkie (${totalVisible})`}
            </button>
          </div>

          <div className="w-px self-stretch mx-0.5" style={{ backgroundColor: "var(--border)" }} />

          <button className={actionBtn} disabled={pending} onClick={() => togglePanel("status")}
            style={{ color: panel === "status" ? "var(--accent-blue)" : "var(--text-secondary)" }}>
            <Circle size={16} /> Status
          </button>
          <button className={actionBtn} disabled={pending} onClick={() => togglePanel("priority")}
            style={{ color: panel === "priority" ? "var(--accent-blue)" : "var(--text-secondary)" }}>
            <Flag size={16} /> Priorytet
          </button>
          <button className={actionBtn} disabled={pending} onClick={() => togglePanel("due")}
            style={{ color: panel === "due" ? "var(--accent-blue)" : "var(--text-secondary)" }}>
            <Calendar size={16} /> Termin
          </button>
          <button className={actionBtn} disabled={pending} onClick={() => togglePanel("category")}
            style={{ color: panel === "category" ? "var(--accent-blue)" : "var(--text-secondary)" }}>
            <CheckSquare size={16} /> Kategoria
          </button>
          <button className={actionBtn} disabled={pending} onClick={() => togglePanel("project")}
            style={{ color: panel === "project" ? "var(--accent-blue)" : "var(--text-secondary)" }}>
            <FolderInput size={16} /> Projekt
          </button>
          <button className={actionBtn} disabled={pending} onClick={() => togglePanel("tags")}
            style={{ color: panel === "tags" ? "var(--accent-blue)" : "var(--text-secondary)" }}>
            <TagIcon size={16} /> Tagi
          </button>
          <button className={actionBtn} disabled={pending} onClick={onDelete}
            style={{ color: "var(--accent-red)" }}>
            <Trash2 size={16} /> {t("usun2")}
          </button>

          <div className="w-px self-stretch mx-0.5" style={{ backgroundColor: "var(--border)" }} />

          <button onClick={onClear} className="p-2 rounded focus:outline-none" title="Anuluj (Esc)"
            style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
