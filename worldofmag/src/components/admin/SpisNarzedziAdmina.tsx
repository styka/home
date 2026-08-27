"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { GRUPY_NARZEDZI, type NarzedzieAdmina } from "@/lib/admin/narzedzia";
import { pasujeDoFrazy } from "@/lib/ui/szukanie";
import { startFeedbackInspector } from "@/platform/ai/feedbackBus";

/**
 * 110: SPIS NARZĘDZI PANELU — grupy i wyszukiwarka.
 *
 * Zastępuje płaską listę dwudziestu jeden odnośników, w której „Zarządzanie dostępem" sąsiadowało
 * z „Testami klikaczami" bez żadnej podpowiedzi, że to rzeczy z różnych światów.
 *
 * **Wyszukiwarka czyta TEN SAM rejestr co grupy** — osobny słownik fraz rozjechałby się z listą
 * przy pierwszej zmianie nazwy, a wyszukiwarka istnieje po to, żeby prowadzić do narzędzi, które
 * naprawdę są. Filtr jest odporny na brak diakrytyków (`pasujeDoFrazy`).
 *
 * Grupa, z której nic nie zostało po filtrowaniu, **znika razem z nagłówkiem** — pusty nagłówek
 * sugerowałby, że narzędzie tam jest, tylko go nie widać.
 */
export function SpisNarzedziAdmina() {
  const t = useTranslations("components.admin.SpisNarzedziAdmina");
  const [fraza, setFraza] = useState("");

  const widoczne = useMemo(
    () =>
      GRUPY_NARZEDZI.map((g) => ({
        ...g,
        narzedzia: g.narzedzia.filter((x) =>
          pasujeDoFrazy(fraza, t(x.kluczNazwy), t(x.kluczOpisu), t(x.kluczHasel)),
        ),
      })).filter((g) => g.narzedzia.length > 0),
    [fraza, t],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
      {/* Pole szukania — jedno na widok, nad grupami. */}
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
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, background: "none", border: "none", borderRadius: 6,
              color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {widoczne.length === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "20px 18px", textAlign: "center",
          }}
        >
          <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>{t("brakTrafienTytul")}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{t("brakTrafienOpis")}</div>
        </div>
      ) : (
        <nav aria-label={t("etykietaListy")} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {widoczne.map((grupa) => (
            <section key={grupa.id}>
              <h2
                style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                  color: "var(--text-muted)", marginBottom: 10,
                }}
              >
                {t(grupa.kluczNazwy)}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {grupa.narzedzia.map((narzedzie) => (
                  <Pozycja key={narzedzie.id} narzedzie={narzedzie} />
                ))}
              </div>
            </section>
          ))}
        </nav>
      )}
    </div>
  );
}

function Pozycja({ narzedzie }: { narzedzie: NarzedzieAdmina }) {
  const t = useTranslations("components.admin.SpisNarzedziAdmina");
  const nazwa = t(narzedzie.kluczNazwy);
  const opis = t(narzedzie.kluczOpisu);

  const tresc = (
    <>
      <span style={{ display: "flex", flexShrink: 0, color: "var(--accent-purple)", marginTop: 2 }}>
        <narzedzie.Ikona size={18} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{nazwa}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.45 }}>{opis}</span>
      </span>
    </>
  );

  const styl = {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    // C-31: minimalny cel dotyku.
    minHeight: 44,
    padding: "12px 14px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    textDecoration: "none",
    textAlign: "left" as const,
    width: "100%",
    cursor: "pointer",
  };

  /**
   * Pozycja-akcja nie prowadzi pod adres — uruchamia tryb wskazywania elementu na miejscu. Zostaje
   * w rejestrze (a więc i w wyszukiwarce), bo panel jest jedynym miejscem, w którym się jej szuka;
   * poza nim tryb startuje skrótem `Ctrl/Cmd+Shift+B` i admińskim przyciskiem w górnym pasku.
   *
   * 110: znikł osobny `FeedbackTriggerButton` — miał dokładnie jednego konsumenta (dawną listę
   * narzędzi) i po jej przepisaniu zostałby komponentem bez użycia, czyli gorszym niż jego brak.
   */
  if (narzedzie.akcja === "wskazElement") {
    return (
      <button type="button" onClick={() => startFeedbackInspector()} style={styl}>
        {tresc}
      </button>
    );
  }

  return (
    <Link href={narzedzie.href} style={styl}>
      {tresc}
    </Link>
  );
}
