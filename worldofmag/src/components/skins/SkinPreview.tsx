"use client";

import { useTranslations } from "next-intl";
import { resolveTokens, tokensToStyle, type SkinTokens } from "@/lib/skins";

/** Miniatura skórki — renderuje przykładowy „chrom" aplikacji ze zmiennymi danej
 *  skórki zastosowanymi lokalnie (scoped), więc pokazuje wygląd bez zmiany całej strony.
 *
 *  045: podgląd pokazuje też TYPOGRAFIĘ, CIEŃ, TŁO i OBRAMOWANIE, nie tylko próbki kolorów.
 *  Odkąd skórka steruje krojem, wersalikami i poświatą, miniatura złożona z samych kolorowych
 *  prostokątów pokazywałaby ułamek tego, co użytkownik właśnie zmienia — i wybór skórki
 *  z listy byłby zgadywaniem. */
export function SkinPreview({ tokens, compact = false }: { tokens: SkinTokens; compact?: boolean }) {
  const t = useTranslations("components.skins.SkinPreview");
  const full = resolveTokens(tokens);
  const style = tokensToStyle(full);

  return (
    <div
      style={{
        ...style,
        background: "var(--bg-base)",
        backgroundImage: "var(--bg-image-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-family-base)",
        borderRadius: "var(--radius-lg)",
        border: "var(--border-width) var(--border-style) var(--border)",
        padding: compact ? 10 : 14,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 8 : 10,
        overflow: "hidden",
        fontSize: "var(--font-size-base)",
      }}
    >
      {/* pasek z „akcentem" */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-blue)" }} />
        <div style={{ height: 8, flex: 1, borderRadius: "var(--radius)", background: "var(--bg-elevated)" }} />
      </div>
      {/* karta powierzchni */}
      <div
        style={{
          background: "var(--bg-surface)",
          backgroundImage: "var(--bg-image-surface)",
          border: "var(--border-width) var(--border-style) var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-surface)",
          padding: compact ? 8 : 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-family-display)",
            fontWeight: "var(--font-weight-heading)" as unknown as number,
            letterSpacing: "var(--letter-spacing-heading)",
            textTransform: "var(--text-transform-heading)" as React.CSSProperties["textTransform"],
            color: "var(--text-primary)",
            fontSize: compact ? 12 : 14,
          }}
        >
          {t("naglowek")}
        </div>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: compact ? 10 : 11,
            letterSpacing: "var(--letter-spacing-base)",
            lineHeight: "var(--line-height-base)",
          }}
        >
          {t("tekstDrugorzedny")}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
          <span style={{ background: "var(--accent-blue)", color: "var(--on-accent)", padding: "3px 8px", borderRadius: "var(--radius)", fontSize: 10, fontWeight: 500 }}>
            Akcent
          </span>
          <span style={{ background: "var(--accent-green)", color: "var(--on-accent)", padding: "3px 8px", borderRadius: "var(--radius)", fontSize: 10, fontWeight: 500 }}>
            OK
          </span>
          <span style={{ background: "var(--accent-red)", color: "var(--on-accent)", padding: "3px 8px", borderRadius: "var(--radius)", fontSize: 10, fontWeight: 500 }}>
            Uwaga
          </span>
        </div>
        {/* Kontrolka — pokazuje zaokrąglenie kontrolek i poświatę, czyli to, czym „Mostek"
            różni się od „Papieru" bardziej niż samym kolorem. */}
        <div
          style={{
            marginTop: 4,
            alignSelf: "flex-start",
            background: "var(--accent-amber)",
            color: "var(--on-accent)",
            padding: "4px 12px",
            borderRadius: "var(--radius-control)",
            boxShadow: "var(--shadow-glow)",
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          Przycisk
        </div>
      </div>
    </div>
  );
}
