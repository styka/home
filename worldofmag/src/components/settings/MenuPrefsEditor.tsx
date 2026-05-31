"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { updateMenuPrefs } from "@/actions/menuPrefs";
import { accessibleModulesInOrder, type MenuPrefs, type ModuleDef } from "@/lib/modules";

export function MenuPrefsEditor({ permissions, prefs }: { permissions: string[]; prefs: MenuPrefs }) {
  const [rows, setRows] = useState<ModuleDef[]>(() => accessibleModulesInOrder(permissions, prefs));
  const [disabled, setDisabled] = useState<string[]>(prefs.disabled);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function persist(nextRows: ModuleDef[], nextDisabled: string[]) {
    setRows(nextRows);
    setDisabled(nextDisabled);
    startTransition(async () => {
      await updateMenuPrefs({ order: nextRows.map((r) => r.id), disabled: nextDisabled });
      router.refresh();
    });
  }

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= rows.length) return;
    const copy = [...rows];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    persist(copy, disabled);
  }

  function toggle(id: string) {
    const nextDisabled = disabled.includes(id) ? disabled.filter((d) => d !== id) : [...disabled, id];
    persist(rows, nextDisabled);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        Włącz/wyłącz działy i ustaw ich kolejność w menu bocznym.
        {isPending && <Loader2 size={12} className="animate-spin" />}
      </p>
      {rows.map((m, idx) => {
        const isOn = !disabled.includes(m.id);
        return (
          <div
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              opacity: isOn ? 1 : 0.55,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="W górę">
                <ChevronUp size={14} />
              </button>
              <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="W dół">
                <ChevronDown size={14} />
              </button>
            </div>
            <span style={{ color: m.color, display: "flex", flexShrink: 0 }}><m.Icon size={18} /></span>
            <span style={{ flex: 1, color: "var(--text-primary)", fontSize: 14 }}>{m.label}</span>
            <button
              onClick={() => toggle(m.id)}
              className="focus:outline-none"
              style={{ display: "flex", alignItems: "center", gap: 5, color: isOn ? "var(--accent-green)" : "var(--text-muted)", fontSize: 12 }}
              title={isOn ? "Wyłącz w menu" : "Włącz w menu"}
            >
              {isOn ? <Eye size={15} /> : <EyeOff size={15} />}
              {isOn ? "Wł." : "Wył."}
            </button>
          </div>
        );
      })}
    </div>
  );
}
