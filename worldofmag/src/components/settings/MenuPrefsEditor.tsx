"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Eye, EyeOff, Loader2, X, Plus, Smartphone, Hand } from "lucide-react";
import { updateMenuPrefs } from "@/actions/menuPrefs";
import { accessibleModulesInOrder, MAKS_MODULOW_W_PASKU, type MenuPrefs, type ModuleDef, type Reka } from "@/lib/modules";

export function MenuPrefsEditor({ permissions, prefs }: { permissions: string[]; prefs: MenuPrefs }) {
  const t = useTranslations("components.settings.MenuPrefsEditor");
  const [rows, setRows] = useState<ModuleDef[]>(() => accessibleModulesInOrder(permissions, prefs));
  const [disabled, setDisabled] = useState<string[]>(prefs.disabled);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Wszystkie dostępne moduły (do wyboru w dolnym pasku).
  const allAccessible = accessibleModulesInOrder(permissions, prefs);
  const byId = new Map(allAccessible.map((m) => [m.id, m]));
  const [tabBar, setTabBar] = useState<string[]>(() => prefs.tabBar.filter((id) => byId.has(id)));
  const [reka, setReka] = useState<Reka>(prefs.handedness);

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
    if (tabBar.includes(id) || tabBar.length >= MAKS_MODULOW_W_PASKU) return;
    persistTabBar([...tabBar, id]);
  }

  function persistReka(next: Reka) {
    setReka(next);
    startTransition(async () => {
      await updateMenuPrefs({ handedness: next });
      router.refresh();
    });
  }

  // 103: Strona główna jest KOTWICĄ paska, nie pozycją modułową — nie ma jej wśród możliwych
  // do dodania, bo dodanie dałoby dwie ikony domu w jednym rzędzie.
  const available = allAccessible.filter((m) => !tabBar.includes(m.id) && m.id !== "home");

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
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--text-muted)" }} title={t("wGore")}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="focus:outline-none disabled:opacity-30" style={{ color: "var(--text-muted)" }} title={t("wDol")}>
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

      {/* 100 (AC-11): dominująca ręka.
          Stoi TU, a nie w „Wyglądzie", bo to nie jest kwestia motywu — to ustawienie dokładnie tych
          elementów, którymi rządzi ta sekcja: dolnego paska i chromu obsługiwanego kciukiem.
          JEDEN przełącznik na wszystkie z nich; trzy osobne byłyby trzema odpowiedziami na jedno
          pytanie „którą ręką trzymasz telefon". */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Hand size={13} /> {t("dominujacaReka")}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
          {t("dominujacaRekaOpis")}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { id: "right" as const, etykieta: t("rekaPrawa") },
            { id: "left" as const, etykieta: t("rekaLewa") },
          ]).map((opcja) => {
            const wybrana = reka === opcja.id;
            return (
              <button
                key={opcja.id}
                onClick={() => persistReka(opcja.id)}
                aria-pressed={wybrana}
                className="focus:outline-none"
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 8,
                  border: `1px solid ${wybrana ? "var(--accent-blue)" : "var(--border)"}`,
                  background: wybrana ? "var(--bg-elevated)" : "var(--bg-surface)",
                  color: wybrana ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: 14,
                  fontWeight: wybrana ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {opcja.etykieta}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dolny pasek (mobile) */}
      <div id="menu" style={{ display: "flex", flexDirection: "column", gap: 6, scrollMarginTop: 16 }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Smartphone size={13} /> {t("dolnyPasekTytul")}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
          {t("dolnyPasekOpis", { maks: MAKS_MODULOW_W_PASKU })}
        </p>
        {/* 103: bez tego zdania limit „2" wygląda na usterkę. Użytkownik widzi w pasku pięć ikon
            i nie ma powodu domyślać się, że trzy z nich są stałe. */}
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
          {t("dolnyPasekKotwice")}
        </p>
        {tabBar.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>{t("brakIkonDodajPonizej")}</p>
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
                  title={t("usunZDolnegoPaska")}
                >
                  <X size={15} />
                </button>
              </div>
            );
          })
        )}

        {available.length > 0 && tabBar.length < MAKS_MODULOW_W_PASKU && (
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
