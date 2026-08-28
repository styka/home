"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, Download, AlertTriangle } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { exportTreatmentRegister, type PozycjaRejestruDTO } from "../actions/ewidencja";
import { drobny, naglowekSekcji, przycisk, przyciskGlowny, sekcja } from "./style";

/**
 * 113 — rejestr zabiegów środkami ochrony roślin (AC-24, AC-25).
 *
 * **Braki są pokazane PRZY KAŻDYM wierszu, a nie dopiero przy eksporcie.** Kontrola weryfikuje
 * kompletność danych, więc użytkownik musi widzieć, czego brakuje, wtedy gdy jeszcze może to
 * uzupełnić — a nie w chwili oddawania dokumentu.
 *
 * Eksport nie pobiera pliku sam z siebie: zwraca treść, którą użytkownik zapisuje świadomym
 * kliknięciem. Plik startujący automatycznie po wejściu na widok byłby zaskoczeniem, a nie funkcją.
 */
export function Ewidencja({ pozycje }: { pozycje: PozycjaRejestruDTO[] }) {
  const t = useTranslations("modules.rosliny.Ewidencja");
  const [pending, startTransition] = useTransition();
  const [komunikat, setKomunikat] = useState<string | null>(null);

  const niekompletne = pozycje.filter((p) => p.braki.length > 0).length;

  function eksportuj() {
    startTransition(async () => {
      const wynik = await exportTreatmentRegister();
      const blob = new Blob([wynik.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = wynik.nazwaPliku;
      a.click();
      URL.revokeObjectURL(url);
      setKomunikat(t("wyeksportowano", { ile: wynik.liczbaZabiegow, braki: wynik.liczbaNiekompletnych }));
    });
  }

  return (
    <ModuleView
      icon={<ClipboardList size={18} />}
      iconColor="var(--accent-green)"
      title={t("tytul")}
      breadcrumb={
        <Link href="/rosliny" style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {t("wroc")}
        </Link>
      }
      state={pozycje.length === 0 ? "empty" : "ready"}
      empty={{ title: t("pustoTytul"), description: t("pustoOpis"), icon: <ClipboardList size={22} /> }}
      actions={
        <button type="button" style={przyciskGlowny} onClick={eksportuj} disabled={pending}>
          <Download size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
          {t("eksportuj")}
        </button>
      }
    >
      <section style={sekcja}>
        <h2 style={naglowekSekcji}>{t("obowiazekTytul")}</h2>
        <p style={{ ...drobny, margin: 0 }}>{t("obowiazekOpis")}</p>
      </section>

      {niekompletne > 0 && (
        <section style={{ ...sekcja, borderColor: "var(--accent-amber)" }}>
          <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>
            <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent-amber)" }} aria-hidden />
            {t("niekompletne", { ile: niekompletne })}
          </p>
        </section>
      )}

      {komunikat && (
        <section style={sekcja}>
          <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{komunikat}</p>
        </section>
      )}

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>{t("rejestrTytul", { ile: pozycje.length })}</h2>
        <div style={{ overflowX: "auto" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {pozycje.map((p) => (
              <li key={p.id} style={{ fontSize: 13, color: "var(--text-primary)", display: "grid", gap: 3 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 600 }}>{p.occurredAt.slice(0, 10)}</span>
                  <span>{p.productName ?? t("brakSrodka")}</span>
                  <span style={{ ...drobny, marginLeft: "auto" }}>{p.spaceName}</span>
                </div>
                <span style={drobny}>
                  {[
                    p.permitNumber ? t("zezwolenie", { numer: p.permitNumber }) : null,
                    p.applicationKind,
                    p.doseValue ? `${p.doseValue} ${p.doseUnit ?? ""}` : null,
                    p.areaValue ? `${p.areaValue} ${p.areaUnit ?? ""}` : null,
                    p.locationText,
                    p.operator,
                  ].filter(Boolean).join(" · ")}
                </span>
                {p.braki.length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--accent-amber)" }}>
                    {t("brakuje", { pola: p.braki.join(", ") })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <button type="button" style={{ ...przycisk, marginTop: 10 }} onClick={eksportuj} disabled={pending}>
          {t("eksportuj")}
        </button>
      </section>
    </ModuleView>
  );
}
