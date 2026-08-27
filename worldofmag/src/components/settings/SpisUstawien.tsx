"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { SEKCJE_USTAWIEN, pasujeDoFrazy } from "@/lib/ustawienia/sekcje";

/**
 * 109: SPIS SEKCJI USTAWIEŃ Z WYSZUKIWARKĄ.
 *
 * Jeden komponent w dwóch wariantach, bo to jest jedna i ta sama lista:
 *  - `kafelki` — cała trasa `/settings`: nazwa + opis, na telefonie pełna szerokość,
 *    na komputerze siatka;
 *  - `lista` — wąska kolumna przy otwartej sekcji (`hidden md:flex`), żeby przeskok do innej
 *    sekcji nie wymagał wracania do spisu.
 *
 * **Wyszukiwarka czyta TEN SAM rejestr co spis** — osobny słownik fraz rozjechałby się z listą
 * sekcji przy pierwszej zmianie nazwy, a wyszukiwarka istnieje po to, żeby prowadzić do sekcji,
 * które naprawdę są. Filtr jest odporny na brak diakrytyków: „jezyk" znajduje „Język…" (`bezOgonkow`).
 */
export function SpisUstawien({
  wariant,
  aktywna,
}: {
  wariant: "kafelki" | "lista";
  aktywna?: string;
}) {
  const t = useTranslations("components.settings.SpisUstawien");
  const [fraza, setFraza] = useState("");

  const widoczne = useMemo(
    () =>
      SEKCJE_USTAWIEN.filter((s) =>
        pasujeDoFrazy(fraza, t(s.kluczNazwy), t(s.kluczOpisu), t(s.kluczHasel)),
      ),
    [fraza, t],
  );

  const kafelki = wariant === "kafelki";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: kafelki ? 16 : 10, minHeight: 0 }}>
      {/* Pole szukania — jedno na widok, nad listą. */}
      <div style={{ position: "relative" }}>
        <Search
          size={16}
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
        />
        <input
          type="search"
          value={fraza}
          onChange={(e) => setFraza(e.target.value)}
          aria-label={t("etykietaSzukania")}
          placeholder={t("placeholderSzukania")}
          style={{
            width: "100%",
            // C-31: cel dotyku — pole ma 44 px wysokości także na telefonie.
            minHeight: 44,
            padding: "10px 34px 10px 32px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-primary)",
            fontSize: 14,
          }}
        />
        {fraza !== "" && (
          <button
            type="button"
            onClick={() => setFraza("")}
            aria-label={t("wyczysc")}
            title={t("wyczysc")}
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              background: "none",
              border: "none",
              borderRadius: 6,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {widoczne.length === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "20px 18px",
            textAlign: "center",
          }}
        >
          <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>{t("brakTrafienTytul")}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{t("brakTrafienOpis")}</div>
        </div>
      ) : (
        <nav
          aria-label={t("etykietaSzukania")}
          className={kafelki ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-1"}
          style={kafelki ? undefined : { overflowY: "auto", minHeight: 0 }}
        >
          {widoczne.map((s) => {
            const jestAktywna = s.id === aktywna;
            return (
              <Link
                key={s.id}
                href={`/settings/${s.id}`}
                aria-current={jestAktywna ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: kafelki ? "flex-start" : "center",
                  gap: 12,
                  // C-31: minimalny cel dotyku, także w wąskiej liście bocznej.
                  minHeight: 44,
                  padding: kafelki ? "14px 16px" : "8px 10px",
                  background: kafelki || jestAktywna ? "var(--bg-surface)" : "transparent",
                  border: kafelki ? "1px solid var(--border)" : "1px solid transparent",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: jestAktywna ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <span style={{ display: "flex", flexShrink: 0, color: jestAktywna ? "var(--text-primary)" : "var(--text-muted)", marginTop: kafelki ? 2 : 0 }}>
                  <s.Ikona size={kafelki ? 20 : 17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: kafelki ? 15 : 13.5, fontWeight: 500, color: "var(--text-primary)" }}>
                    {t(s.kluczNazwy)}
                  </span>
                  {kafelki && (
                    <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.45 }}>
                      {t(s.kluczOpisu)}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
