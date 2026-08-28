"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, Download, AlertTriangle, Plus } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { exportTreatmentRegister, recordTreatment, type PozycjaRejestruDTO } from "../actions/ewidencja";
import type { PrzestrzenDTO } from "../actions/przestrzenie";
import { drobny, naglowekSekcji, pole, przycisk, przyciskGlowny, sekcja } from "./style";

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
export function Ewidencja({ pozycje: poczatkowe, przestrzenie }: { pozycje: PozycjaRejestruDTO[]; przestrzenie: PrzestrzenDTO[] }) {
  const t = useTranslations("modules.rosliny.Ewidencja");
  const [pending, startTransition] = useTransition();
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [pozycje, setPozycje] = useState(poczatkowe);
  const [formularz, setFormularz] = useState(false);
  const [f, setF] = useState({
    spaceId: przestrzenie[0]?.id ?? "",
    productName: "",
    permitNumber: "",
    applicationKind: "opryskiwanie",
    doseValue: "",
    doseUnit: "l/ha",
    areaValue: "",
    areaUnit: "ha",
    locationText: "",
    operator: "",
    conditions: "",
    withdrawalDays: "",
  });

  const niekompletne = pozycje.filter((p) => p.braki.length > 0).length;

  function ustaw(klucz: keyof typeof f, wartosc: string) {
    setF((s) => ({ ...s, [klucz]: wartosc }));
  }

  /**
   * AC-24: zapis zabiegu z kompletem pól wymaganych od 2026.
   *
   * **Braki NIE blokują zapisu** — akcja zwraca ich listę, a my ją pokazujemy. Zablokowanie
   * ukarałoby kogoś, kto właśnie wrócił z pola i uzupełni numer zezwolenia wieczorem, a skutkiem
   * byłby zabieg niezapisany w ogóle — czyli dokładnie to, czemu ewidencja ma zapobiegać.
   */
  function zapisz() {
    if (!f.spaceId) return;
    startTransition(async () => {
      const wynik = await recordTreatment({
        spaceId: f.spaceId,
        productName: f.productName.trim() || null,
        permitNumber: f.permitNumber.trim() || null,
        applicationKind: f.applicationKind.trim() || null,
        doseValue: Number(f.doseValue.replace(",", ".")) || null,
        doseUnit: f.doseUnit.trim() || null,
        areaValue: Number(f.areaValue.replace(",", ".")) || null,
        areaUnit: f.areaUnit.trim() || null,
        locationText: f.locationText.trim() || null,
        operator: f.operator.trim() || null,
        conditions: f.conditions.trim() || null,
        withdrawalDays: Number(f.withdrawalDays) || null,
      });
      setPozycje((lista) => [
        {
          id: wynik.id,
          occurredAt: new Date().toISOString(),
          spaceName: przestrzenie.find((p) => p.id === f.spaceId)?.name ?? "",
          plantName: null,
          placeName: null,
          productName: f.productName.trim() || null,
          permitNumber: f.permitNumber.trim() || null,
          applicationKind: f.applicationKind.trim() || null,
          doseValue: Number(f.doseValue.replace(",", ".")) || null,
          doseUnit: f.doseUnit.trim() || null,
          areaValue: Number(f.areaValue.replace(",", ".")) || null,
          areaUnit: f.areaUnit.trim() || null,
          locationText: f.locationText.trim() || null,
          operator: f.operator.trim() || null,
          conditions: f.conditions.trim() || null,
          withdrawalDays: Number(f.withdrawalDays) || null,
          note: null,
          braki: wynik.braki,
        },
        ...lista,
      ]);
      setKomunikat(wynik.braki.length ? t("zapisanoZBrakami", { pola: wynik.braki.join(", ") }) : t("zapisanoKompletnie"));
      setF((s) => ({ ...s, productName: "", permitNumber: "", doseValue: "", areaValue: "", locationText: "", conditions: "" }));
      setFormularz(false);
    });
  }

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
        <>
        {przestrzenie.length > 0 && (
          <button type="button" style={przycisk} onClick={() => setFormularz((v) => !v)}>
            <Plus size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {t("nowyZabieg")}
          </button>
        )}
        <button type="button" style={przyciskGlowny} onClick={eksportuj} disabled={pending}>
          <Download size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
          {t("eksportuj")}
        </button>
        </>
      }
    >
      {formularz && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("nowyZabieg")}</h2>
          <p style={{ ...drobny, margin: "0 0 10px" }}>{t("formularzOpis")}</p>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            <select value={f.spaceId} onChange={(e) => ustaw("spaceId", e.target.value)} aria-label={t("przestrzenEtykieta")} style={pole}>
              {przestrzenie.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
            <input type="text" value={f.productName} onChange={(e) => ustaw("productName", e.target.value)} placeholder={t("srodekPlaceholder")} aria-label={t("srodekEtykieta")} style={pole} />
            <input type="text" value={f.permitNumber} onChange={(e) => ustaw("permitNumber", e.target.value)} placeholder={t("zezwoleniePlaceholder")} aria-label={t("zezwolenieEtykieta")} style={pole} />
            <input type="text" value={f.applicationKind} onChange={(e) => ustaw("applicationKind", e.target.value)} placeholder={t("zastosowaniePlaceholder")} aria-label={t("zastosowanieEtykieta")} style={pole} />
            <input type="text" inputMode="decimal" value={f.doseValue} onChange={(e) => ustaw("doseValue", e.target.value)} placeholder={t("dawkaPlaceholder")} aria-label={t("dawkaEtykieta")} style={pole} />
            <input type="text" value={f.doseUnit} onChange={(e) => ustaw("doseUnit", e.target.value)} aria-label={t("jednostkaDawkiEtykieta")} style={pole} />
            <input type="text" inputMode="decimal" value={f.areaValue} onChange={(e) => ustaw("areaValue", e.target.value)} placeholder={t("powierzchniaPlaceholder")} aria-label={t("powierzchniaEtykieta")} style={pole} />
            <input type="text" value={f.areaUnit} onChange={(e) => ustaw("areaUnit", e.target.value)} aria-label={t("jednostkaPowierzchniEtykieta")} style={pole} />
            <input type="text" value={f.locationText} onChange={(e) => ustaw("locationText", e.target.value)} placeholder={t("lokalizacjaPlaceholder")} aria-label={t("lokalizacjaEtykieta")} style={pole} />
            <input type="text" value={f.operator} onChange={(e) => ustaw("operator", e.target.value)} placeholder={t("wykonujacyPlaceholder")} aria-label={t("wykonujacyEtykieta")} style={pole} />
            <input type="text" value={f.conditions} onChange={(e) => ustaw("conditions", e.target.value)} placeholder={t("warunkiPlaceholder")} aria-label={t("warunkiEtykieta")} style={pole} />
            <input type="text" inputMode="numeric" value={f.withdrawalDays} onChange={(e) => ustaw("withdrawalDays", e.target.value)} placeholder={t("karencjaPlaceholder")} aria-label={t("karencjaEtykieta")} style={pole} />
          </div>
          <button type="button" style={{ ...przyciskGlowny, marginTop: 10 }} onClick={zapisz} disabled={pending}>
            {t("zapiszZabieg")}
          </button>
        </section>
      )}

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
