"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CURATED_CONTROLS,
  ADVANCED_CONTROLS,
  DEFAULT_DARK_TOKENS,
  DENSITY_OPTIONS,
  SKIN_GROUP_LABELS,
  type SkinTokens,
  type SkinControl,
  type SkinGroup,
} from "@/lib/skins";
import { SkinPreview } from "./SkinPreview";
import { SkinAiPanel } from "./SkinAiPanel";
import { SkinTransfer } from "./SkinTransfer";
import { createSkin, updateSkin, type SkinView } from "@/actions/skins";

type TeamOpt = { id: string; name: string };

const inputStyle: React.CSSProperties = {
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  padding: "8px 10px",
  fontSize: 13,
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

/** Czy wartość nadaje się do <input type=color> (#rrggbb). */
function asColorInput(v: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
}

export function SkinEditor({
  initial,
  existingId = null,
  mode,
  system = false,
  teams = [],
  onClose,
  onSaved,
}: {
  initial?: SkinView | null;
  existingId?: string | null; // jeśli ustawione → edycja; w przeciwnym razie tworzenie
  mode: "user" | "admin";
  system?: boolean; // skórka systemowa (admin)
  teams?: TeamOpt[];
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const t = useTranslations("components.skins.SkinEditor");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tokens, setTokens] = useState<SkinTokens>({ ...DEFAULT_DARK_TOKENS, ...(initial?.tokens ?? {}) });
  const [name, setName] = useState(initial?.name ?? "Moja skórka");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [teamId, setTeamId] = useState<string>(initial?.ownerTeamId ?? "");
  const [advanced, setAdvanced] = useState(false);

  const colorScheme = (tokens["--color-scheme"] === "light" ? "light" : "dark") as "light" | "dark";

  function set(key: string, value: string) {
    setTokens((t) => ({ ...t, [key]: value }));
  }

  const previewTokens = useMemo(() => tokens, [tokens]);

  function save() {
    setError(null);
    start(async () => {
      try {
        if (existingId) {
          await updateSkin(existingId, {
            name,
            description,
            colorScheme,
            tokens,
            isPublic: system ? true : isPublic,
            sortOrder: initial?.sortOrder,
          });
          onSaved?.(existingId);
        } else {
          const id = await createSkin({
            name,
            description,
            colorScheme,
            tokens,
            isSystem: system,
            isPublic: system ? true : isPublic,
            ownerTeamId: !system && teamId ? teamId : null,
          });
          onSaved?.(id);
        }
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać skórki");
      }
    });
  }

  function renderControl(c: SkinControl) {
    const value = tokens[c.key] ?? DEFAULT_DARK_TOKENS[c.key] ?? "";
    if (c.kind === "scheme") {
      return (
        <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{c.label}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {(["dark", "light"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("--color-scheme", s)}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  border: `1px solid ${colorScheme === s ? "var(--accent-blue)" : "var(--border)"}`,
                  background: colorScheme === s ? "var(--accent-blue)" : "var(--bg-base)",
                  color: colorScheme === s ? "var(--on-accent)" : "var(--text-secondary)",
                }}
              >
                {s === "dark" ? "Ciemny" : "Jasny"}
              </button>
            ))}
          </div>
          {c.hint && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.hint}</span>}
        </div>
      );
    }
    if (c.kind === "density") {
      return (
        <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{c.label}</span>
          <select value={value} onChange={(e) => set(c.key, e.target.value)} style={inputStyle}>
            {DENSITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    if (c.kind === "radius") {
      const px = parseInt(value, 10) || 0;
      return (
        <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{c.label} — {px}px</span>
          <input
            type="range"
            min={0}
            max={24}
            value={px}
            onChange={(e) => set(c.key, `${e.target.value}px`)}
            style={{ width: "100%", accentColor: "var(--accent-blue)" }}
          />
        </div>
      );
    }
    // Rodzaje z zamkniętą listą wartości (czcionka, wersaliki, styl obramowania, ramki).
    if (c.kind === "font" || c.kind === "keyword") {
      return (
        <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{c.label}</span>
          <select value={value} onChange={(e) => set(c.key, e.target.value)} style={inputStyle}>
            {(c.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {c.hint && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.hint}</span>}
        </div>
      );
    }

    if (c.kind === "easing") {
      const presets = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"];
      return (
        <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{c.label}</span>
          <select
            value={presets.includes(value) ? value : "__custom"}
            onChange={(e) => { if (e.target.value !== "__custom") set(c.key, e.target.value); }}
            style={inputStyle}
          >
            {presets.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value="__custom">{t("wlasnaCubicBezier")}</option>
          </select>
          {!presets.includes(value) && (
            <input value={value} onChange={(e) => set(c.key, e.target.value)} style={inputStyle} placeholder="cubic-bezier(0.2, 0, 0, 1)" />
          )}
        </div>
      );
    }

    if (c.kind === "weight") {
      return (
        <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{c.label}</span>
          <select value={value} onChange={(e) => set(c.key, e.target.value)} style={inputStyle}>
            {["300", "400", "500", "600", "700", "800", "900"].map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      );
    }

    // Pozostałe rodzaje (length, tracking, number, duration, shadow, background) to pola
    // tekstowe — wartości są zbyt różnorodne na suwak, a walidacja i tak jest po stronie
    // `sanitizeTokenValue`. Podpowiedź mówi wprost, co wolno wpisać.
    if (c.kind !== "color") {
      const placeholder =
        c.kind === "shadow" ? "0 4px 16px rgba(0,0,0,0.4) albo none"
        : c.kind === "background" ? "linear-gradient(...) albo none"
        : c.kind === "duration" ? "120ms"
        : c.kind === "tracking" ? "0.08em"
        : c.kind === "number" ? "1.5"
        : "16px";
      return (
        <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>{c.label}</span>
          <input
            value={value}
            onChange={(e) => set(c.key, e.target.value)}
            style={inputStyle}
            placeholder={placeholder}
            spellCheck={false}
          />
          {c.hint && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.hint}</span>}
        </div>
      );
    }

    // color
    return (
      <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelStyle}>{c.label}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="color"
            value={asColorInput(value)}
            onChange={(e) => set(c.key, e.target.value)}
            style={{ width: 36, height: 32, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "transparent", cursor: "pointer" }}
            aria-label={c.label}
          />
          <input value={value} onChange={(e) => set(c.key, e.target.value)} style={{ ...inputStyle, fontFamily: "var(--font-mono, monospace)" }} />
        </div>
        {c.hint && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.hint}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Nazwa + opis */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>Nazwa</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} maxLength={60} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={labelStyle}>Opis (opcjonalnie)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} maxLength={140} />
        </div>
      </div>

      {/* Podgląd na żywo */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 220px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {CURATED_CONTROLS.map(renderControl)}
        </div>
        <div style={{ position: "sticky", top: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={labelStyle}>{t("podglad")}</span>
          <SkinPreview tokens={previewTokens} />
        </div>
      </div>

      {/* Zaawansowane */}
      <div>
        <button
          type="button"
          onClick={() => setAdvanced((a) => !a)}
          style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", fontSize: 12, padding: 0 }}
        >
          {advanced ? "▾ Ukryj zaawansowane" : "▸ Zaawansowane (wszystkie zmienne)"}
        </button>
        {advanced && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12 }}>
            {/* Pogrupowane w rodziny — płaska lista czterdziestu kilku pól była nie do
                przejrzenia, a to właśnie w tych rodzinach siedzi charakter motywu. */}
            {(Object.keys(SKIN_GROUP_LABELS) as SkinGroup[]).map((group) => {
              const controls = ADVANCED_CONTROLS.filter((c) => c.group === group);
              if (controls.length === 0) return null;
              return (
                <div key={group}>
                  <h4 style={{ ...labelStyle, marginBottom: 8, marginTop: 0, color: "var(--text-primary)" }}>
                    {SKIN_GROUP_LABELS[group]}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
                    {controls.map(renderControl)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 045: opis słowami → komplet tokenów. Model PROPONUJE, niczego nie zapisuje. */}
      <SkinAiPanel
        onApply={(generated) => {
          setTokens((t) => ({ ...t, ...generated.tokens }));
          if (generated.name) setName(generated.name);
          if (generated.description) setDescription(generated.description);
        }}
        // 116: skórka ZAAWANSOWANA zapisuje się w panelu (model → walidacja → zapis),
        // z pominięciem edytora tokenów — nie ma tam czego dostrajać ręcznie.
        onSavedAdvanced={(id) => {
          onSaved?.(id);
          onClose();
        }}
      />

      {/* 045: przenośność — skórka jako plik. */}
      <SkinTransfer
        skinId={existingId}
        tokens={tokens}
        onImported={(imported) => setTokens((t) => ({ ...t, ...imported }))}
      />

      {/* Udostępnianie (tylko user) */}
      {!system && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            {t("udostepnijPublicznieKazdyMoze")}
          </label>
          {teams.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
              {t("zespol")}
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ ...inputStyle, width: "auto" }} disabled={!!existingId}>
                <option value="">— moja prywatna —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {error && <div style={{ color: "var(--accent-red)", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} disabled={pending} style={{ padding: "8px 16px", background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
          Anuluj
        </button>
        <button type="button" onClick={save} disabled={pending} style={{ padding: "8px 16px", background: "var(--accent-blue)", border: "1px solid var(--accent-blue)", borderRadius: 6, color: "var(--on-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
          {pending ? "Zapisywanie…" : "Zapisz skórkę"}
        </button>
      </div>
    </div>
  );
}
