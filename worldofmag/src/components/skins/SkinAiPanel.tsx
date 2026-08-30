"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Sparkles, AlertTriangle, ImageOff } from "lucide-react";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import type { AiUsageInfo } from "@/platform/ai/usage";
import { SkinPreview } from "./SkinPreview";
import { ALL_CONTROLS, type SkinTokens } from "@/lib/skins";
import { createSkin } from "@/actions/skins";
import { kompilujDefinicje } from "@/lib/skins/kompilacja";
import type { DefinicjaZaawansowana } from "@/lib/skins/zaawansowane";

/**
 * 045 — „opisz, jak ma wyglądać" → komplet tokenów.
 *
 * Reguła nadrzędna: model **proponuje, nigdy nie zapisuje**. Wygenerowana skórka
 * pojawia się jako podgląd obok opisu i dopiero kliknięcie „Użyj tej propozycji"
 * wstawia tokeny do edytora — gdzie nadal można je poprawić ręcznie. Automatyczna
 * podmiana wyglądu aplikacji byłaby zaskoczeniem, nie funkcją.
 *
 * Odrzucone tokeny są POKAZYWANE. Model potrafi „pomocnie" zwrócić `url()` z obrazkiem
 * albo czcionkę z sieci; sanityzacja to wycina, ale ciche wycięcie zostawiłoby
 * użytkownika z pytaniem, czemu skórka wygląda inaczej, niż zapowiadał opis.
 */

interface GeneratedSkin {
  name: string;
  description: string;
  colorScheme: "light" | "dark";
  rationale: string;
  tokens: SkinTokens;
  rejected: string[];
}

/** 116: wynik trybu zaawansowanego (pełna definicja zamiast mapy tokenów). */
interface GeneratedAdvanced {
  name: string;
  description: string;
  colorScheme: "light" | "dark";
  rationale: string;
  definition: DefinicjaZaawansowana;
  rejected: string[];
  brakujaceGrafiki: string[];
}

const EXAMPLES = [
  "konsola statku kosmicznego — bursztyn i granat, wersaliki",
  "stary terminal z zielonym fosforem",
  "papier listowy, szeryfy, ciepła biel",
  "japoński minimalizm — dużo światła, jeden akcent",
];

export function SkinAiPanel({
  onApply,
  onSavedAdvanced,
}: {
  onApply: (skin: GeneratedSkin) => void;
  /** 116: wywoływane po zapisaniu skórki ZAAWANSOWANEJ (id nowej skórki). Bez tego
   *  propa przełącznik trybu się nie pokazuje — panel działa jak przed 116. */
  onSavedAdvanced?: (id: string) => void;
}) {
  const t = useTranslations("components.skins.SkinAiPanel");
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedSkin | null>(null);
  const [advanced, setAdvanced] = useState<GeneratedAdvanced | null>(null);
  const [tryb, setTryb] = useState<"simple" | "advanced">("simple");
  const [usage, setUsage] = useState<AiUsageInfo | null>(null);

  async function generate() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/llm/skins/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, tryb }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Nie udało się wygenerować skórki");
      if (tryb === "advanced") {
        setAdvanced(data.skin as GeneratedAdvanced);
        setResult(null);
      } else {
        setResult(data.skin as GeneratedSkin);
        setAdvanced(null);
      }
      setUsage((data.usage ?? null) as AiUsageInfo | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wygenerować skórki");
      setResult(null);
      setAdvanced(null);
    } finally {
      setBusy(false);
    }
  }

  /** 116: zapis skórki zaawansowanej — definicja przechodzi walidację serwerową
   *  w `createSkin` jeszcze raz; klient niczego nie „przemyca". */
  async function saveAdvanced() {
    if (!advanced || !onSavedAdvanced) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createSkin({
        name: advanced.name,
        description: advanced.description || null,
        colorScheme: advanced.colorScheme,
        tokens: {},
        definition: advanced.definition,
      });
      onSavedAdvanced(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać skórki");
    } finally {
      setSaving(false);
    }
  }

  // Podgląd zaawansowanej: kompilacja czystą funkcją (bez assetów — sloty `missing`
  // i tak są jeszcze pominięte) + ostrzeżenia (kontrast) z tej samej kompilacji.
  const advancedPreview = advanced ? kompilujDefinicje(advanced.definition, []) : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          alignSelf: "flex-start",
          minHeight: 40,
          padding: "0 14px",
          borderRadius: "var(--radius-control)",
          background: "var(--bg-elevated)",
          border: "var(--border-width) var(--border-style) var(--border)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Sparkles size={15} style={{ color: "var(--accent-purple)" }} />
        {t("opiszSkorkeSlowami")}
      </button>
    );
  }

  return (
    <div
      style={{
        borderTop: "var(--border-width) var(--border-style) var(--border)",
        paddingTop: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={15} style={{ color: "var(--accent-purple)" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t("opiszSkorkeSlowami")}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
        >
          {t("zwin")}
        </button>
      </div>

      {/* 116: przełącznik rodzaju. Segmenty, nie menu (lekcja 100) — widać, co jest
          dostępne i co wybrane. Pokazuje się tylko tam, gdzie jest komu odebrać zapis
          skórki zaawansowanej (prop onSavedAdvanced). */}
      {onSavedAdvanced && (
        <div style={{ display: "flex", gap: 6 }}>
          {(["simple", "advanced"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setTryb(m)}
              aria-pressed={tryb === m}
              style={{
                padding: "5px 12px",
                borderRadius: "var(--radius-pill)",
                border: "var(--border-width) var(--border-style) var(--border)",
                background: tryb === m ? "var(--bg-elevated)" : "transparent",
                color: tryb === m ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {m === "simple" ? t("trybProsty") : t("trybZaawansowany")}
            </button>
          ))}
        </div>
      )}
      {onSavedAdvanced && tryb === "advanced" && (
        <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {t("opisTrybuZaawansowanego")}
        </span>
      )}

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder={t("npKonsolaStatkuKosmicznego")}
        style={{
          background: "var(--bg-base)",
          border: "var(--border-width) var(--border-style) var(--border)",
          borderRadius: "var(--radius-control)",
          color: "var(--text-primary)",
          padding: "8px 10px",
          fontSize: 13,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            style={{
              padding: "5px 10px",
              borderRadius: "var(--radius-pill)",
              background: "var(--bg-elevated)",
              border: "var(--border-width) var(--border-style) var(--border)",
              color: "var(--text-secondary)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={generate}
          disabled={busy || !prompt.trim()}
          style={{
            minHeight: 40,
            padding: "0 16px",
            borderRadius: "var(--radius-control)",
            background: "var(--accent-purple)",
            border: "none",
            color: "var(--on-accent)",
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            opacity: busy || !prompt.trim() ? 0.6 : 1,
          }}
        >
          {busy ? "Generuję…" : result ? "Generuj ponownie" : "Generuj"}
        </button>
        {usage && <AiCostBadge akcja="Generowanie skórki z opisu" usage={usage} />}
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-red)" }}>
          <AlertTriangle size={13} />
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 220px",
            gap: 14,
            alignItems: "start",
            padding: 12,
            borderRadius: "var(--radius-lg)",
            border: "var(--border-width) var(--border-style) var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{result.name}</span>
            {result.description && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{result.description}</span>
            )}
            {result.rationale && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{result.rationale}</span>
            )}

            {/* 081: KOMPLETNOŚĆ skórki. Prompt żąda kompletu 53 tokenów, ale model bywa oszczędny —
                a skórka złożona z ośmiu tokenów to przemalowane tło i wygląda jak „AI nie umie".
                Bez tej liczby użytkownik nie ma jak odróżnić słabego modelu od słabego opisu. */}
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("ustawionoTokenow", {
                ile: Object.keys(result.tokens).length,
                wszystkich: ALL_CONTROLS.length,
              })}
            </span>

            {result.rejected.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--accent-amber)" }}>
                Pominięto {result.rejected.length} niedozwolonych {result.rejected.length === 1 ? "token" : "tokenów"}:{" "}
                {result.rejected.slice(0, 4).join(", ")}
                {result.rejected.length > 4 ? "…" : ""}
              </span>
            )}

            <button
              type="button"
              onClick={() => onApply(result)}
              style={{
                alignSelf: "flex-start",
                minHeight: 40,
                padding: "0 16px",
                borderRadius: "var(--radius-control)",
                background: "var(--accent-blue)",
                border: "none",
                color: "var(--on-accent)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("uzyjTejPropozycji")}
            </button>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("nicNieZostaloJeszcze")}
            </span>
          </div>

          <SkinPreview tokens={result.tokens} />
        </div>
      )}

      {/* 116: wynik trybu zaawansowanego — podgląd ze skompilowanych zmiennych,
          ostrzeżenia (kontrast, brakujące grafiki), jawna lista odrzuconych pól
          i zapis dopiero po decyzji użytkownika (AC-2). */}
      {advanced && advancedPreview && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 220px",
            gap: 14,
            alignItems: "start",
            padding: 12,
            borderRadius: "var(--radius-lg)",
            border: "var(--border-width) var(--border-style) var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{advanced.name}</span>
            {advanced.description && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{advanced.description}</span>
            )}
            {advanced.rationale && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{advanced.rationale}</span>
            )}

            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("warstwyDefinicji", {
                tokeny: Object.keys(advanced.definition.tokens ?? {}).length,
                komponenty: Object.keys(advanced.definition.components ?? {}).length,
                animacje: Object.keys(advanced.definition.animations ?? {}).length,
              })}
            </span>

            {advancedPreview.ostrzezenia.map((o) => (
              <span key={o} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--accent-amber)" }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                {o}
              </span>
            ))}

            {advanced.brakujaceGrafiki.length > 0 && (
              <span style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                <ImageOff size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                {t("brakGeneratoraGrafik", { ile: advanced.brakujaceGrafiki.length })}
              </span>
            )}

            {advanced.rejected.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--accent-amber)" }}>
                {t("pominietoPol", { ile: advanced.rejected.length })}{" "}
                {advanced.rejected.slice(0, 4).join(", ")}
                {advanced.rejected.length > 4 ? "…" : ""}
              </span>
            )}

            <button
              type="button"
              onClick={saveAdvanced}
              disabled={saving}
              style={{
                alignSelf: "flex-start",
                minHeight: 40,
                padding: "0 16px",
                borderRadius: "var(--radius-control)",
                background: "var(--accent-blue)",
                border: "none",
                color: "var(--on-accent)",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {t("zapiszIAktywuj")}
            </button>
          </div>

          <SkinPreview tokens={advancedPreview.tokens} />
        </div>
      )}
    </div>
  );
}
