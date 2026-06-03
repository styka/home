"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Eye, EyeOff, Loader2, X, Plus, Smartphone } from "lucide-react";
import { updateMenuPrefs } from "@/actions/menuPrefs";
import { accessibleModulesInOrder, MAX_TAB_BAR, type MenuPrefs, type ModuleDef } from "@/lib/modules";

export function MenuPrefsEditor({ permissions, prefs }: { permissions: string[]; prefs: MenuPrefs }) {
  const [rows, setRows] = useState<ModuleDef[]>(() => accessibleModulesInOrder(permissions, prefs));
  const [disabled, setDisabled] = useState<string[]>(prefs.disabled);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Wszystkie dostępne moduły (do wyboru w dolnym pasku).
  const allAccessible = accessibleModulesInOrder(permissions, prefs);
  const byId = new Map(allAccessible.map((m) => [m.id, m]));
  const [tabBar, setTabBar] = useState<string[]>(() => prefs.tabBar.filter((id) => byId.has(id)));

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

  function persistTabBar(next: string[]) {
    setTabBar(next);
    startTransition(async () => {
      await updateMenuPrefs({ tabBar: next });
      router.refresh();
    });
  }

  function moveTab(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= tabBar.length) return;
    const copy = [...tabBar];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    persistTabBar(copy);
  }

  function removeTab(id: string) {
    persistTabBar(tabBar.filter((t) => t !== id));
  }

  function addTab(id: string) {
    if (tabBar.includes(id) || tabBar.length >= MAX_TAB_BAR) return;
    persistTabBar([...tabBar, id]);
  }

  const available = allAccessible.filter((m) => !tabBar.includes(m.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Menu boczne */}
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

      {/* Dolny pasek (mobile) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Smartphone size={13} /> Dolny pasek (telefon)
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
          Ikony i ich kolejność na dolnym pasku w telefonie — niezależne od menu bocznego (maks. {MAX_TAB_BAR}).
        </p>
        {tabBar.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>Brak ikon — dodaj poniżej.</p>
        ) : (
          tabBar.map((id, idx) => {
            const m = byId.get(id);
            if (!m) return null;
            return (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <button onClick={() => moveTab(idx, -1)} disabled={idx === 0} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="W lewo">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => moveTab(idx, 1)} disabled={idx === tabBar.length - 1} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="W prawo">
                    <ChevronDown size={14} />
                  </button>
                </div>
                <span style={{ color: m.color, display: "flex", flexShrink: 0 }}><m.Icon size={18} /></span>
                <span style={{ flex: 1, color: "var(--text-primary)", fontSize: 14 }}>{m.label}</span>
                <button
                  onClick={() => removeTab(id)}
                  className="focus:outline-none"
                  style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}
                  title="Usuń z dolnego paska"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })
        )}

        {available.length > 0 && tabBar.length < MAX_TAB_BAR && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
            {available.map((m) => (
              <button
                key={m.id}
                onClick={() => addTab(m.id)}
                className="focus:outline-none"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  padding: "5px 10px",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                }}
                title={`Dodaj „${m.label}" do dolnego paska`}
              >
                <Plus size={12} /><span style={{ color: m.color, display: "flex" }}><m.Icon size={14} /></span>{m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
