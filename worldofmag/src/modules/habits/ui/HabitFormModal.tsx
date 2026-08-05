"use client";

import { useEffect, useState } from "react";
import { Check, X, Bell } from "lucide-react";
import { parseDays } from "@/lib/habitStats";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 14,
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" };

const EMOJI_PRESETS = ["✅", "💧", "🏃", "📚", "🧘", "💪", "🛏️", "🥗", "🚭", "🧹", "💊", "✍️", "🦷", "☀️", "🙏", "📵"];
const COLOR_PRESETS = [
  "var(--accent-orange)",
  "var(--accent-green)",
  "var(--accent-blue)",
  "var(--accent-purple)",
  "var(--accent-amber)",
  "var(--accent-red)",
];

const WEEKDAYS = [
  { n: 1, label: "Pn" },
  { n: 2, label: "Wt" },
  { n: 3, label: "Śr" },
  { n: 4, label: "Cz" },
  { n: 5, label: "Pt" },
  { n: 6, label: "So" },
  { n: 0, label: "Nd" },
];

export interface HabitFormValue {
  name: string;
  description: string;
  icon: string;
  color: string;
  daysOfWeek: string | null;
  weeklyGoal: number | null;
  reminderTime: string | null;
}

export function emptyHabitForm(): HabitFormValue {
  return { name: "", description: "", icon: "✅", color: "var(--accent-orange)", daysOfWeek: null, weeklyGoal: null, reminderTime: null };
}

type Preset = "daily" | "weekdays" | "weekend" | "custom";

function detectPreset(days: Set<number> | null): Preset {
  if (!days) return "daily";
  const eq = (arr: number[]) => arr.length === days.size && arr.every((n) => days.has(n));
  if (eq([1, 2, 3, 4, 5])) return "weekdays";
  if (eq([0, 6])) return "weekend";
  return "custom";
}

export function HabitFormModal({
  initial,
  title,
  onSave,
  onClose,
}: {
  initial: HabitFormValue;
  title: string;
  onSave: (v: HabitFormValue) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<HabitFormValue>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof HabitFormValue>(k: K, v: HabitFormValue[K]) => setForm((f) => ({ ...f, [k]: v }));

  const days = parseDays(form.daysOfWeek);
  const preset = detectPreset(days);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyPreset(p: Preset) {
    if (p === "daily") set("daysOfWeek", null);
    else if (p === "weekdays") set("daysOfWeek", "1,2,3,4,5");
    else if (p === "weekend") set("daysOfWeek", "0,6");
    else set("daysOfWeek", form.daysOfWeek ?? "1,2,3,4,5"); // wejście w tryb własny
  }

  function toggleDay(n: number) {
    const cur = parseDays(form.daysOfWeek) ?? new Set([0, 1, 2, 3, 4, 5, 6]);
    const next = new Set(cur);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    const arr = Array.from(next).sort((a, b) => a - b);
    set("daysOfWeek", arr.length === 7 || arr.length === 0 ? null : arr.join(","));
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Nazwa nawyku jest wymagana");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "max(env(safe-area-inset-top), 24px) 12px 24px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded" style={{ background: "none", border: "none", color: "var(--text-muted)" }} aria-label="Zamknij">
            <X size={18} />
          </button>
        </div>

        {/* Nazwa + podgląd ikony */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              background: "var(--bg-elevated)",
              border: `1px solid ${form.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {form.icon}
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Nazwa</label>
            <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="np. Pij wodę rano" autoFocus />
          </div>
        </div>

        {/* Emoji */}
        <div>
          <label style={labelStyle}>Ikona</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EMOJI_PRESETS.map((e) => (
              <button
                key={e}
                onClick={() => set("icon", e)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  fontSize: 18,
                  background: form.icon === e ? "var(--bg-elevated)" : "var(--bg-base)",
                  border: `1px solid ${form.icon === e ? "var(--border-focus)" : "var(--border)"}`,
                  cursor: "pointer",
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Kolor */}
        <div>
          <label style={labelStyle}>Kolor</label>
          <div style={{ display: "flex", gap: 8 }}>
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => set("color", c)}
                aria-label={c}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: c,
                  border: form.color === c ? "2px solid var(--text-primary)" : "2px solid transparent",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>

        {/* Harmonogram */}
        <div>
          <label style={labelStyle}>Powtarzaj</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {([
              ["daily", "Codziennie"],
              ["weekdays", "Dni powszednie"],
              ["weekend", "Weekend"],
              ["custom", "Wybrane dni"],
            ] as [Preset, string][]).map(([p, lbl]) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded text-xs font-medium"
                style={{
                  background: preset === p ? "var(--bg-elevated)" : "transparent",
                  border: `1px solid ${preset === p ? "var(--border-focus)" : "var(--border)"}`,
                  color: preset === p ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div style={{ display: "flex", gap: 6 }}>
              {WEEKDAYS.map(({ n, label }) => {
                const on = days?.has(n) ?? true;
                return (
                  <button
                    key={n}
                    onClick={() => toggleDay(n)}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      background: on ? "var(--bg-elevated)" : "var(--bg-base)",
                      border: `1px solid ${on ? "var(--border-focus)" : "var(--border)"}`,
                      color: on ? "var(--text-primary)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* HA2: cel tygodniowy (zamiast konkretnych dni) */}
        <div>
          <label style={labelStyle}>Cel tygodniowy (zamiast dni)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number" min={0} max={7}
              value={form.weeklyGoal ?? ""}
              onChange={(e) => { const n = parseInt(e.target.value, 10); set("weeklyGoal", Number.isInteger(n) && n > 0 ? Math.min(7, n) : null); }}
              placeholder="np. 3"
              style={{ width: 80, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13 }}
            />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {form.weeklyGoal ? `${form.weeklyGoal}× w tygodniu (dowolne dni)` : "wyłączone — używane są dni tygodnia powyżej"}
            </span>
          </div>
        </div>

        {/* Przypomnienie */}
        <div>
          <label style={labelStyle}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Bell size={11} /> Przypomnienie (opcjonalnie)
            </span>
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="time"
              style={{ ...inputStyle, width: "auto" }}
              value={form.reminderTime ?? ""}
              onChange={(e) => set("reminderTime", e.target.value || null)}
            />
            {form.reminderTime && (
              <button onClick={() => set("reminderTime", null)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)", background: "var(--bg-hover)", border: "none" }}>
                Wyłącz
              </button>
            )}
          </div>
        </div>

        {error && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-semibold disabled:opacity-40"
            style={{ background: form.color, color: "var(--on-accent)", border: "none", flex: 1, justifyContent: "center" }}
          >
            <Check size={15} /> Zapisz
          </button>
          <button onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "none" }}>
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}
