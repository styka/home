"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardList, Download, AlertTriangle, Plus } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import {
  exportTreatmentRegister,
  getTreatmentRegister,
  recordTreatment,
  type PozycjaRejestruDTO,
} from "../actions/ewidencja";
import { getPlaces } from "../actions/miejsca";
import { getPlants } from "../actions/rosliny";
import type { PrzestrzenDTO } from "../actions/przestrzenie";
import { drobny, naglowekSekcji, pole, przycisk, przyciskGlowny, sekcja } from "./style";

/** Dzisiejsza data w formacie pola `<input type="date">` — w strefie użytkownika, nie w UTC. */
function dzisiaj(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 113 — rejestr zabiegów środkami ochrony roślin (AC-24, AC-25).
 *
 * **Braki są pokazane PRZY KAŻDYM wierszu, a nie dopiero przy eksporcie.** Kontrola weryfikuje
 * kompletność danych, więc użytkownik musi widzieć, czego brakuje, wtedy gdy jeszcze może to
 * uzupełnić — a nie w chwili oddawania dokumentu.
 *
 * Eksport nie pobiera pliku sam z siebie: zwraca treść, którą użytkownik zapisuje świadomym
 * kliknięciem. Plik startujący automatycznie po wejściu na widok byłby zaskoczeniem, a nie funkcją.
 *
 * **Okres jest JEDEN dla widoku i dla eksportu.** Dwa osobne zakresy — jeden do oglądania, drugi do
 * pobrania — dawałyby plik niezgodny z tym, co użytkownik przed chwilą przeglądał, a to jest właśnie
 * ten rodzaj rozjazdu, którego przy dokumencie dla kontroli nikt nie zauważy na czas.
 */
export function Ewidencja({ pozycje: poczatkowe, przestrzenie }: { pozycje: PozycjaRejestruDTO[]; przestrzenie: PrzestrzenDTO[] }) {
  const t = useTranslations("modules.rosliny.Ewidencja");
  const [pending, startTransition] = useTransition();
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [pozycje, setPozycje] = useState(poczatkowe);
  const [formularz, setFormularz] = useState(false);
  const [okres, setOkres] = useState<{ od: string; do: string }>({ od: "", do: "" });
  const [uprawy, setUprawy] = useState<{ id: string; name: string }[]>([]);
  const [miejsca, setMiejsca] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({
    spaceId: przestrzenie[0]?.id ?? "",
    occurredAt: dzisiaj(),
    plantId: "",
    placeId: "",
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

  const rokBiezacy = new Date().getFullYear();
  /**
   * Kiedy widok wolno przełączyć w stan „pusto".
   *
   * Dwa warunki, oba wynikają z tego, że `ModuleView` w stanie `empty` rysuje `ViewEmpty`
   * **zamiast** `children`:
   * - pusty wynik ZAWĘŻONEGO okresu to nie jest pusty rejestr — zniknąłby wybór okresu i nie
   *   byłoby jak z niego wyjść,
   * - **przy otwartym formularzu nigdy**, bo formularz jest w `children`. Bez tego konto bez ani
   *   jednego zabiegu klikało „Nowy zabieg" (przycisk siedzi w `actions`, więc rysuje się zawsze)
   *   i na ekranie nie zmieniało się nic — czyli ewidencja była nieosiągalna dokładnie dla tego,
   *   kto ma ją założyć.
   */
  const pustyRejestr = pozycje.length === 0 && !okres.od && !okres.do && !formularz;
  const niekompletne = pozycje.filter((p) => p.braki.length > 0).length;

  /**
   * Uprawy i miejsca wybranej przestrzeni — bez nich kolumny „Uprawa / roślina" i „Miejsce" były
   * strukturalnie niewypełnialne, a wpis bez przedmiotu zabiegu pokazywał się jako kompletny.
   *
   * Pobieramy je dopiero po otwarciu formularza: to dwa zapytania, których widok samego rejestru
   * nie potrzebuje.
   */
  useEffect(() => {
    if (!formularz || !f.spaceId) return;
    let aktualne = true;
    void (async () => {
      const [r, m] = await Promise.all([getPlants({ spaceId: f.spaceId }), getPlaces(f.spaceId)]);
      if (!aktualne) return;
      setUprawy(r.map((x) => ({ id: x.id, name: x.name })));
      setMiejsca(m.map((x) => ({ id: x.id, name: x.name })));
    })();
    return () => {
      // Przełączenie przestrzeni w trakcie pobierania nie może nadpisać listy nowszym-starszym
      // wynikiem: użytkownik zobaczyłby uprawy z przestrzeni, której już nie wybrał.
      aktualne = false;
    };
  }, [formularz, f.spaceId]);

  /** Zakres jako daty — pusty koniec obejmuje cały ostatni dzień, nie jego północ. */
  function zakres(): { od?: Date; do?: Date } {
    const od = okres.od ? new Date(`${okres.od}T00:00:00`) : undefined;
    const doo = okres.do ? new Date(`${okres.do}T23:59:59.999`) : undefined;
    return { ...(od ? { od } : {}), ...(doo ? { do: doo } : {}) };
  }

  function pokazOkres(od: string, doo: string) {
    setOkres({ od, do: doo });
    startTransition(async () => {
      const z = {
        ...(od ? { od: new Date(`${od}T00:00:00`) } : {}),
        ...(doo ? { do: new Date(`${doo}T23:59:59.999`) } : {}),
      };
      setPozycje(await getTreatmentRegister(z));
      setKomunikat(null);
    });
  }

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
        // Data zabiegu, a nie data wpisania: oprysk wpisany dwa dni później musi wejść do dokumentu
        // z dniem, w którym został wykonany.
        occurredAt: f.occurredAt ? new Date(`${f.occurredAt}T12:00:00`) : undefined,
        plantId: f.plantId || null,
        placeId: f.placeId || null,
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
      // Lista pochodzi z SERWERA, a nie z doklejenia w ślepo: nowa pozycja musi trafić w wybrany
      // okres i w kolejność malejącą po dacie. Wersja doklejająca na czoło pokazywała zabieg
      // z dzisiaj na liście zawężonej do 2025 — którego eksport (honorujący okres) już nie
      // obejmował. To jest dokładnie ten rozjazd „widok ≠ plik", przed którym broni ten widok.
      setPozycje(await getTreatmentRegister(zakres()));
      setKomunikat(wynik.braki.length ? t("zapisanoZBrakami", { pola: wynik.braki.join(", ") }) : t("zapisanoKompletnie"));
      setF((s) => ({ ...s, productName: "", permitNumber: "", doseValue: "", areaValue: "", locationText: "", conditions: "" }));
      setFormularz(false);
    });
  }

  function eksportuj() {
    startTransition(async () => {
      const wynik = await exportTreatmentRegister(zakres());
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
      state={pustyRejestr ? "empty" : "ready"}
      empty={{
        title: t("pustoTytul"),
        description: t("pustoOpis"),
        icon: <ClipboardList size={22} />,
        // Stan pusty MUSI mieć wyjście do formularza: to jedyne wejście do ewidencji, a trafia się
        // na nie zanim powstanie pierwszy wpis.
        ...(przestrzenie.length > 0 ? { action: { label: t("nowyZabieg"), onClick: () => setFormularz(true) } } : {}),
      }}
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
          <p style={{ ...drobny, margin: "0 0 4px" }}>{t("formularzOpis")}</p>
          <p style={{ ...drobny, margin: "0 0 10px" }}>{t("uprawaMiejsceOpis")}</p>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            <select
              value={f.spaceId}
              onChange={(e) => {
                // Zmiana przestrzeni unieważnia wskazania: roślina z poprzedniej przestrzeni nie
                // należy do tej i serwer i tak by ją odrzucił.
                setF((st) => ({ ...st, spaceId: e.target.value, plantId: "", placeId: "" }));
              }}
              aria-label={t("przestrzenEtykieta")}
              style={pole}
            >
              {przestrzenie.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
            <input type="date" value={f.occurredAt} onChange={(e) => ustaw("occurredAt", e.target.value)} aria-label={t("dataEtykieta")} style={pole} />
            <select value={f.plantId} onChange={(e) => ustaw("plantId", e.target.value)} aria-label={t("uprawaEtykieta")} style={pole}>
              <option value="">{t("uprawaBrak")}</option>
              {uprawy.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
            <select value={f.placeId} onChange={(e) => ustaw("placeId", e.target.value)} aria-label={t("miejsceEtykieta")} style={pole}>
              <option value="">{t("miejsceBrak")}</option>
              {miejsca.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
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
        <h2 style={naglowekSekcji}>{t("okresTytul")}</h2>
        <p style={{ ...drobny, margin: "0 0 10px" }}>{t("okresOpis")}</p>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <input
            type="date"
            value={okres.od}
            onChange={(e) => pokazOkres(e.target.value, okres.do)}
            aria-label={t("okresOd")}
            style={pole}
          />
          <input
            type="date"
            value={okres.do}
            onChange={(e) => pokazOkres(okres.od, e.target.value)}
            aria-label={t("okresDo")}
            style={pole}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {[rokBiezacy, rokBiezacy - 1].map((rok) => (
            <button
              key={rok}
              type="button"
              style={przycisk}
              onClick={() => pokazOkres(`${rok}-01-01`, `${rok}-12-31`)}
              disabled={pending}
            >
              {t("okresRok", { rok })}
            </button>
          ))}
          <button type="button" style={przycisk} onClick={() => pokazOkres("", "")} disabled={pending}>
            {t("okresWyczysc")}
          </button>
        </div>
      </section>

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
