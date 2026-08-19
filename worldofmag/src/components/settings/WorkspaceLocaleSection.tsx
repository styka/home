"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setWorkspaceLocale, type UstawieniaPrzestrzeniDTO } from "@/actions/workspaceSettings";

/**
 * 089 (zadanie 37) — JĘZYK I STREFA CZASOWA PRZESTRZENI.
 *
 * Sekcja wymienia przestrzenie, do których użytkownik należy, bo ustawienie należy do przestrzeni,
 * a nie do konta: zespół ma jeden język, wspólny dla wszystkich, którzy w nim pracują. Przy jednej
 * przestrzeni osobistej wygląda to jak zwykłe ustawienie konta — i o to chodzi.
 *
 * Strefa czasowa jest polem tekstowym z listą podpowiedzi, a nie zamkniętym `select`-em: lista stref
 * IANA ma ponad 400 pozycji i jest własnością środowiska, nie nasza. Wartość spoza listy i tak
 * degraduje się przy odczycie do domyślnej, więc nie ma tu czego zepsuć.
 */
const CZESTE_STREFY = [
  "Europe/Warsaw",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "UTC",
];

export function WorkspaceLocaleSection({
  przestrzenie,
  jezyki,
}: {
  przestrzenie: UstawieniaPrzestrzeniDTO[];
  jezyki: { kod: string; nazwa: string }[];
}) {
  if (przestrzenie.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {przestrzenie.map((p) => (
        <WierszPrzestrzeni key={p.workspaceId} przestrzen={p} jezyki={jezyki} />
      ))}
    </div>
  );
}

function WierszPrzestrzeni({
  przestrzen,
  jezyki,
}: {
  przestrzen: UstawieniaPrzestrzeniDTO;
  jezyki: { kod: string; nazwa: string }[];
}) {
  const t = useTranslations("components.settings.WorkspaceLocaleSection");
  const [locale, setLocale] = useState(przestrzen.locale);
  const [timezone, setTimezone] = useState(przestrzen.timezone);
  const [isPending, startTransition] = useTransition();
  const [stan, setStan] = useState<"" | "ok" | string>("");

  function zapisz() {
    setStan("");
    startTransition(async () => {
      try {
        await setWorkspaceLocale(przestrzen.workspaceId, locale, timezone);
        setStan("ok");
      } catch (e) {
        setStan(e instanceof Error ? e.message : "Nie udało się zapisać.");
      }
    });
  }

  const zablokowane = isPending || !przestrzen.mogeZmieniac;

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
        {przestrzen.nazwa}
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
          {przestrzen.kind === "personal" ? "przestrzeń osobista" : "przestrzeń zespołu"}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select
          value={locale}
          disabled={zablokowane}
          onChange={(e) => { setLocale(e.target.value); setStan(""); }}
          className="py-3"
          style={{
            padding: "6px 8px", fontSize: 13, borderRadius: 6,
            border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
          }}
        >
          {jezyki.map((j) => (
            <option key={j.kod} value={j.kod}>{j.nazwa}</option>
          ))}
        </select>
        <input
          list="omnia-strefy"
          value={timezone}
          disabled={zablokowane}
          onChange={(e) => { setTimezone(e.target.value); setStan(""); }}
          className="py-3"
          style={{
            flex: "1 1 180px", minWidth: 0, padding: "6px 8px", fontSize: 13, borderRadius: 6,
            border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
          }}
        />
        <datalist id="omnia-strefy">
          {CZESTE_STREFY.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={zapisz}
          disabled={zablokowane}
          className="py-3"
          style={{
            padding: "6px 12px", fontSize: 12, borderRadius: 6, cursor: zablokowane ? "default" : "pointer",
            border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
            opacity: zablokowane ? 0.6 : 1,
          }}
        >
          Zapisz
        </button>
      </div>
      {!przestrzen.mogeZmieniac && (
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          {t("ustawieniaZespoluZmieniaJego")}
        </div>
      )}
      {stan === "ok" && <div style={{ fontSize: 11.5, color: "var(--accent-green)", marginTop: 6 }}>Zapisano</div>}
      {stan && stan !== "ok" && <div style={{ fontSize: 11.5, color: "var(--accent-red)", marginTop: 6 }}>{stan}</div>}
    </div>
  );
}
