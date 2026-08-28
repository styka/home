"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Sprout, Stethoscope, Ruler, NotebookPen, Trash2, Scissors, ScanSearch, Wheat, CalendarPlus } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import { ImageUrlInput } from "@/components/ui/ImageUrlInput";
import { deletePlant, propagatePlant, setPlantStatus, type RoslinaSzczegolDTO } from "../actions/rosliny";
import { addJournalEntry, addMeasurement, type PomiarDTO, type WpisDziennikaDTO } from "../actions/dziennik";
import {
  diagnosePlant,
  identifyPlant,
  markHealthOutcome,
  scheduleRecommendedCare,
  type PropozycjaGatunku,
  type WynikDiagnozy,
} from "../actions/analiza";
import { updatePlant } from "../actions/rosliny";
import { poleWidoczne } from "../lib/tryb";
import { addSpeciesFromCatalog } from "../actions/gatunki";
import { addToShoppingList, bookCareCost, harvestToPantry, recordHarvest, type ZbiorDTO } from "../actions/zbiory";
import type { ZdarzenieDTO } from "../actions/opieka";
import { etykietaFazy, listaFaz } from "../lib/fenologia";
import type { RodzajPomiaru, StatusRosliny, TrybPrzestrzeni } from "../lib/typy";
import { drobny, naglowekSekcji, pole, przycisk, przyciskGlowny, sekcja } from "./style";

/**
 * 113 — szczegół rośliny: oś czasu, pomiary, potomstwo, diagnoza.
 *
 * **Dziennik ze zdjęciami stoi wysoko, a nie na końcu** — to jedyna rzecz, dzięki której użytkownik
 * WIDZI, że jego opieka działa, i najsilniejszy mechanizm utrzymania go przy module.
 *
 * **Zakończenie rośliny wymaga powodu, gdy roślina padła.** Rejestr porażek jest jedyną funkcją
 * w całym module, która POPRAWIA użytkownika, a nie tylko go obsługuje — i to on karmi wnioski
 * o przestrzeni.
 */
export function RoslinaSzczegol({
  roslina,
  dziennik: poczatkowyDziennik,
  pomiary: poczatkowePomiary,
  zdarzenia,
  zbiory: poczatkoweZbiory,
  tryb,
}: {
  roslina: RoslinaSzczegolDTO;
  dziennik: WpisDziennikaDTO[];
  pomiary: PomiarDTO[];
  zdarzenia: ZdarzenieDTO[];
  zbiory: ZbiorDTO[];
  tryb: TrybPrzestrzeni;
}) {
  const t = useTranslations("modules.rosliny.RoslinaSzczegol");
  const confirmDialog = useConfirm();
  const [dziennik, setDziennik] = useState(poczatkowyDziennik);
  const [pomiary, setPomiary] = useState(poczatkowePomiary);
  const [status, setStatus] = useState<StatusRosliny>(roslina.status);
  const [wpis, setWpis] = useState("");
  const [rodzajPomiaru, setRodzajPomiaru] = useState<RodzajPomiaru>("HEIGHT_CM");
  const [wartosc, setWartosc] = useState("");
  const [objaw, setObjaw] = useState("");
  const [zdjecieDiagnozy, setZdjecieDiagnozy] = useState("");
  const [diagnoza, setDiagnoza] = useState<WynikDiagnozy | null>(null);
  const [zaplanowane, setZaplanowane] = useState<string[]>([]);
  const [zdjecieRozpoznania, setZdjecieRozpoznania] = useState("");
  const [propozycje, setPropozycje] = useState<PropozycjaGatunku[] | null>(null);
  const [gatunek, setGatunek] = useState(roslina.gatunek);
  const [zdjecieWpisu, setZdjecieWpisu] = useState("");
  const [plon, setPlon] = useState("");
  const [jednostkaPlonu, setJednostkaPlonu] = useState("kg");
  /**
   * Koszt i „do spiżarni" przypięte do KONKRETNEJ pozycji listy, nie do stanu sesji.
   *
   * Wcześniej obie akcje działały wyłącznie na zbiorze zapisanym w tej samej wizycie: po odświeżeniu
   * strony nie było czego wysłać do spiżarni, choć zbiory leżały w bazie. Widok pokazywał wtedy
   * funkcję, która istniała tylko dla świeżo wpisanego wiersza — a to jest gorsze niż jej brak, bo
   * użytkownik dowiaduje się o ograniczeniu dopiero wtedy, gdy funkcja mu znika.
   */
  const [koszt, setKoszt] = useState<Record<string, string>>({});
  const [zbiory, setZbiory] = useState<ZbiorDTO[]>(poczatkoweZbiory);
  const [faza, setFaza] = useState(roslina.stage ?? "");
  const [pytamOPrzyczyne, setPytamOPrzyczyne] = useState(false);
  const [przyczyna, setPrzyczyna] = useState("");
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function dodajWpis() {
    const tresc = wpis.trim();
    const foto = zdjecieWpisu.trim() || null;
    // AC-13: wpis może być samym zdjęciem — „postęp w czasie" to seria zdjęć, nie seria notatek.
    if (!tresc && !foto) return;
    startTransition(async () => {
      const { id } = await addJournalEntry({ plantId: roslina.id, text: tresc || null, photoUrl: foto });
      setDziennik((d) => [{ id, occurredAt: new Date().toISOString(), text: tresc || null, photoUrl: foto }, ...d]);
      setWpis("");
      setZdjecieWpisu("");
    });
  }

  function rozpoznaj() {
    const foto = zdjecieRozpoznania.trim();
    if (!foto) return;
    setBlad(null);
    startTransition(async () => {
      try {
        const wynik = await identifyPlant(foto);
        setPropozycje(wynik.propozycje);
      } catch (e) {
        setBlad(e instanceof Error ? e.message : t("bladOgolny"));
      }
    });
  }

  /**
   * AC-18: przyjęcie propozycji WYPEŁNIA gatunek rośliny.
   * Gdy propozycja ma odpowiednik w katalogu systemowym, najpierw kopiujemy go do przestrzeni
   * użytkownika — dzięki temu roślina dostaje gatunek z wymaganiami pielęgnacyjnymi, a nie samą
   * nazwę, i harmonogram od razu liczy się z właściwych czterech liczb.
   */
  function przyjmij(p: PropozycjaGatunku) {
    startTransition(async () => {
      try {
        if (p.catalogKey) {
          const { id } = await addSpeciesFromCatalog(p.catalogKey);
          await updatePlant(roslina.id, { speciesId: id, customSpecies: null });
        } else {
          await updatePlant(roslina.id, { customSpecies: p.namePl, speciesId: null });
        }
        setGatunek(p.namePl);
        setPropozycje(null);
      } catch (e) {
        setBlad(e instanceof Error ? e.message : t("bladOgolny"));
      }
    });
  }

  /** AC-19: zalecenie kończy się ZAPLANOWANYM zabiegiem, a nie samym tekstem. */
  function zaplanuj(indeks: number, rodzaj: string | null, tresc: string) {
    startTransition(async () => {
      await scheduleRecommendedCare({ plantId: roslina.id, rodzajZabiegu: rodzaj, tytul: tresc.slice(0, 80) });
      setZaplanowane((z) => [...z, String(indeks)]);
    });
  }

  /**
   * Faza rozwojowa (BBCH) — jedyny konsument `listaFaz`.
   *
   * Pole istniało w danych i w prompcie diagnozy, a **nie dało się go ustawić**: kod fazy
   * decyduje o tym, czy zalecenie jest wykonalne (oprysku nie robi się w kwitnieniu), więc pole,
   * którego użytkownik nie może wypełnić, obniża jakość każdej rady, jaką moduł wydaje.
   *
   * Zapisujemy od razu po wyborze — to jedno pole, a przycisk „zapisz" przy jednym polu jest
   * krokiem, który nic nie wnosi poza możliwością zapomnienia o nim.
   */
  function zapiszFaze(kod: string) {
    setFaza(kod);
    startTransition(async () => {
      await updatePlant(roslina.id, { stage: kod || null });
      // `etykietaFazy` w trybie hobbystycznym może nie znać nazwy — wtedy wystarczy sam kod,
      // bo użytkownik dopiero co go wybrał z listy.
      setKomunikat(kod ? t("fazaZapisana", { nazwa: etykietaFazy(kod, tryb) ?? kod }) : t("fazaUsunieta"));
    });
  }

  function zapiszZbior() {
    const ilosc = Number(plon.replace(",", "."));
    if (!Number.isFinite(ilosc) || ilosc <= 0) return;
    startTransition(async () => {
      const { id } = await recordHarvest({ plantId: roslina.id, quantity: ilosc, quantityUnit: jednostkaPlonu });
      setZbiory((lista) => [
        {
          id,
          occurredAt: new Date().toISOString(),
          plantId: roslina.id,
          plantName: roslina.name,
          quantity: ilosc,
          quantityUnit: jednostkaPlonu,
          note: null,
          wSpizarni: false,
        },
        ...lista,
      ]);
      setPlon("");
      setKomunikat(t("zbiorZapisany"));
    });
  }

  function doSpizarni(id: string) {
    startTransition(async () => {
      await harvestToPantry(id);
      setZbiory((lista) => lista.map((z) => (z.id === id ? { ...z, wSpizarni: true } : z)));
      setKomunikat(t("wSpizarni"));
    });
  }

  function zapiszKoszt(id: string) {
    const kwota = Number((koszt[id] ?? "").replace(",", "."));
    if (!Number.isFinite(kwota) || kwota <= 0) return;
    startTransition(async () => {
      await bookCareCost({ eventId: id, amount: kwota });
      setKoszt((k) => ({ ...k, [id]: "" }));
      setKomunikat(t("kosztZapisany"));
    });
  }

  function naZakupy() {
    startTransition(async () => {
      await addToShoppingList({ name: gatunek ?? roslina.name });
      setKomunikat(t("naLiscieZakupow"));
    });
  }

  function dodajPomiar() {
    const liczba = Number(wartosc.replace(",", "."));
    if (!Number.isFinite(liczba)) return;
    startTransition(async () => {
      const { id } = await addMeasurement({ plantId: roslina.id, kind: rodzajPomiaru, value: liczba });
      setPomiary((p) => [
        ...p,
        { id, measuredAt: new Date().toISOString(), kind: rodzajPomiaru, value: liczba, unit: "", source: "manual", note: null },
      ]);
      setWartosc("");
    });
  }

  function diagnozuj() {
    setBlad(null);
    startTransition(async () => {
      try {
        setDiagnoza(
          await diagnosePlant({
            plantId: roslina.id,
            objaw: objaw.trim() || null,
            zdjecieUrl: zdjecieDiagnozy.trim() || null,
          }),
        );
      } catch (e) {
        setBlad(e instanceof Error ? e.message : t("bladOgolny"));
      }
    });
  }

  /**
   * Zakończenie życia rośliny.
   *
   * Powód jest wymagany tylko dla „padła" — i to jest różnica merytoryczna, nie formalna:
   * sprzedaż albo zbiór mówią same za siebie, a śmierć bez powodu nie mówi nic. To zdanie jest
   * przy tym najcenniejszą daną, jaką moduł zbiera („co mi się nie udaje"), więc pytamy o nie
   * **polem w widoku**, a nie `window.prompt`: natywne okno nie zna skóry, jest po angielsku
   * u części użytkowników, blokuje wątek i nie da się w nim niczego podpowiedzieć (C-32, C-34).
   */
  async function zakoncz(nowy: StatusRosliny) {
    if (nowy === "DEAD") {
      // Najpierw pole, potem potwierdzenie: pytanie „na pewno?" przed podaniem powodu pytałoby
      // o decyzję, której użytkownik jeszcze nie opisał.
      setPytamOPrzyczyne(true);
      return;
    }
    startTransition(async () => {
      await setPlantStatus(roslina.id, nowy, null);
      setStatus(nowy);
    });
  }

  async function potwierdzPadla() {
    const powod = przyczyna.trim();
    if (!powod) {
      setBlad(t("przyczynaWymagana"));
      return;
    }
    const zgoda = await confirmDialog({
      title: t("potwierdzPadla"),
      description: t("potwierdzPadlaOpis"),
      destructive: true,
    });
    if (!zgoda) return;
    startTransition(async () => {
      await setPlantStatus(roslina.id, "DEAD", powod);
      setStatus("DEAD");
      setPytamOPrzyczyne(false);
      setBlad(null);
    });
  }

  async function usun() {
    const zgoda = await confirmDialog({
      title: t("potwierdzUsuniecie", { nazwa: roslina.name }),
      description: t("potwierdzUsunieciaOpis"),
      destructive: true,
    });
    if (!zgoda) return;
    startTransition(async () => {
      await deletePlant(roslina.id);
      window.location.href = `/rosliny/${roslina.spaceId}`;
    });
  }

  function sadzonka() {
    startTransition(async () => {
      const { id } = await propagatePlant(roslina.id);
      window.location.href = `/rosliny/${roslina.spaceId}/roslina/${id}`;
    });
  }

  return (
    <ModuleView
      icon={<Sprout size={18} />}
      iconColor="var(--accent-green)"
      title={roslina.name}
      breadcrumb={
        <Link href={`/rosliny/${roslina.spaceId}`} style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {t("wroc")}
        </Link>
      }
      state="ready"
      actions={
        <>
          <button type="button" style={przycisk} onClick={sadzonka} disabled={pending}>
            <Scissors size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {t("sadzonka")}
          </button>
          <button type="button" style={przycisk} onClick={usun} disabled={pending}>
            <Trash2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {t("usun")}
          </button>
        </>
      }
    >
      <section style={sekcja}>
        <p style={{ ...drobny, margin: 0, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {gatunek && <span>{gatunek}</span>}
          {roslina.placeName && <span>{roslina.placeName}</span>}
          <span>{roslina.quantity} {t(`jednostka.${roslina.quantityUnit}`)}</span>
          {roslina.stage && <span>{etykietaFazy(roslina.stage, tryb)}</span>}
          <span>{t(`status.${status}`)}</span>
        </p>
        {roslina.statusReason && <p style={{ ...drobny, margin: "6px 0 0" }}>{roslina.statusReason}</p>}
        {poleWidoczne(tryb, "faza", true) && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <label htmlFor="faza-rozwojowa" style={drobny}>{t("fazaEtykieta")}</label>
            <select
              id="faza-rozwojowa"
              value={faza}
              onChange={(e) => zapiszFaze(e.target.value)}
              style={{ ...pole, flex: "0 1 240px" }}
              disabled={pending}
            >
              <option value="">{t("bezFazy")}</option>
              {listaFaz().map((f) => (
                <option key={f.kod} value={f.kod}>{f.nazwa}</option>
              ))}
            </select>
          </div>
        )}
        {status === "ACTIVE" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" style={przycisk} onClick={() => zakoncz("HARVESTED")} disabled={pending}>{t("zebrana")}</button>
            <button type="button" style={przycisk} onClick={() => zakoncz("SOLD")} disabled={pending}>{t("sprzedana")}</button>
            <button type="button" style={przycisk} onClick={() => zakoncz("DEAD")} disabled={pending} aria-expanded={pytamOPrzyczyne}>{t("padla")}</button>
          </div>
        )}
        {pytamOPrzyczyne && (
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            <label htmlFor="przyczyna-smierci" style={drobny}>{t("podajPrzyczyne")}</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                id="przyczyna-smierci"
                type="text"
                value={przyczyna}
                onChange={(e) => setPrzyczyna(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void potwierdzPadla(); }}
                placeholder={t("przyczynaPlaceholder")}
                style={{ ...pole, flex: "1 1 220px" }}
                autoFocus
              />
              <button type="button" style={przyciskGlowny} onClick={() => void potwierdzPadla()} disabled={pending}>
                {t("zapiszPrzyczyne")}
              </button>
              <button
                type="button"
                style={przycisk}
                onClick={() => { setPytamOPrzyczyne(false); setBlad(null); }}
                disabled={pending}
              >
                {t("anuluj")}
              </button>
            </div>
          </div>
        )}
        {komunikat && <p style={{ ...drobny, margin: "8px 0 0", color: "var(--accent-green)" }}>{komunikat}</p>}
        {blad && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: "8px 0 0" }}>{blad}</p>}
      </section>

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>
          <ScanSearch size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          {t("rozpoznajTytul")}
        </h2>
        <p style={{ ...drobny, margin: "0 0 8px" }}>{t("rozpoznajOpis")}</p>
        <ImageUrlInput
          value={zdjecieRozpoznania}
          onChange={setZdjecieRozpoznania}
          module="rosliny"
          inputStyle={pole}
          placeholder={t("zdjeciePlaceholder")}
        />
        <button type="button" style={{ ...przyciskGlowny, marginTop: 8 }} onClick={rozpoznaj} disabled={pending || !zdjecieRozpoznania.trim()}>
          {t("rozpoznaj")}
        </button>
        {propozycje && (
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {propozycje.length === 0 && <li style={drobny}>{t("brakPropozycji")}</li>}
            {propozycje.map((p, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{p.namePl}</span>
                <span style={drobny}>{p.nameLatin}</span>
                <span style={drobny}>· {t(`pewnosc.${p.pewnosc}`)}</span>
                {p.uzasadnienie && <span style={{ ...drobny, flexBasis: "100%" }}>{p.uzasadnienie}</span>}
                {/* „Nie wiem" nie jest propozycją do przyjęcia — przyjęcie go wpisałoby roślinie
                    gatunek, którego model sam nie potwierdził. */}
                {p.pewnosc !== "unknown" && (
                  <button type="button" style={przycisk} onClick={() => przyjmij(p)} disabled={pending}>
                    {t("przyjmij")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(roslina.rodzic || roslina.potomstwo.length > 0) && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("rodowodTytul")}</h2>
          {roslina.rodzic && (
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>
              {t("pochodziZ")}{" "}
              <Link href={`/rosliny/${roslina.spaceId}/roslina/${roslina.rodzic.id}`} style={{ color: "var(--accent-green)" }}>
                {roslina.rodzic.name}
              </Link>
            </p>
          )}
          {roslina.potomstwo.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
              {roslina.potomstwo.map((o) => (
                <li key={o.id} style={{ fontSize: 13 }}>
                  <Link href={`/rosliny/${roslina.spaceId}/roslina/${o.id}`} style={{ color: "var(--text-primary)", textDecoration: "none" }}>
                    {o.name}
                  </Link>
                  <span style={{ ...drobny, marginLeft: 8 }}>{t(`status.${o.status}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>
          <Stethoscope size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          {t("diagnozaTytul")}
        </h2>
        <p style={{ ...drobny, margin: "0 0 8px" }}>{t("diagnozaOpis")}</p>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              value={objaw}
              onChange={(e) => setObjaw(e.target.value)}
              placeholder={t("objawPlaceholder")}
              aria-label={t("objawEtykieta")}
              style={{ ...pole, flex: "1 1 240px" }}
            />
            <button type="button" style={przyciskGlowny} onClick={diagnozuj} disabled={pending}>
              {t("oceń")}
            </button>
          </div>
          <ImageUrlInput
            value={zdjecieDiagnozy}
            onChange={setZdjecieDiagnozy}
            module="rosliny"
            inputStyle={pole}
            placeholder={t("zdjecieObjawuPlaceholder")}
          />
        </div>
        {diagnoza && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "0 0 4px" }}>{diagnoza.diagnoza}</p>
            <p style={{ ...drobny, margin: "0 0 8px" }}>{t(`pewnosc.${diagnoza.pewnosc}`)}</p>
            {diagnoza.zalecenia.length > 0 && (
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, display: "grid", gap: 4 }}>
                {diagnoza.zalecenia.map((z, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    <span style={drobny}>{t(`zalecenie.${z.rodzaj}`)}: </span>
                    {z.tresc}{" "}
                    {/* AC-19: zalecenie kończy się zaplanowanym zabiegiem, nie samym tekstem. */}
                    {zaplanowane.includes(String(i)) ? (
                      <span style={drobny}>{t("zaplanowano")}</span>
                    ) : (
                      <button
                        type="button"
                        style={{ ...przycisk, padding: "3px 8px", minHeight: 0, fontSize: 12 }}
                        onClick={() => zaplanuj(i, z.zabieg, z.tresc)}
                        disabled={pending}
                      >
                        <CalendarPlus size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
                        {t("zaplanujZabieg")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" style={przycisk} disabled={pending} onClick={() => startTransition(async () => { await markHealthOutcome(diagnoza.eventId, "helped"); })}>
                {t("pomoglo")}
              </button>
              <button type="button" style={przycisk} disabled={pending} onClick={() => startTransition(async () => { await markHealthOutcome(diagnoza.eventId, "no_change"); })}>
                {t("bezZmian")}
              </button>
              {diagnoza.usage && (
                <AiCostBadge usage={diagnoza.usage} akcja={t("akcjaDiagnoza")} swiezy />
              )}
            </div>
          </div>
        )}
      </section>

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>
          <NotebookPen size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          {t("dziennikTytul")}
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            type="text"
            value={wpis}
            onChange={(e) => setWpis(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") dodajWpis(); }}
            placeholder={t("wpisPlaceholder")}
            aria-label={t("wpisEtykieta")}
            style={{ ...pole, flex: "1 1 240px" }}
          />
          <button type="button" style={przycisk} onClick={dodajWpis} disabled={pending}>{t("dodaj")}</button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <ImageUrlInput
            value={zdjecieWpisu}
            onChange={setZdjecieWpisu}
            module="rosliny"
            inputStyle={pole}
            placeholder={t("zdjecieWpisuPlaceholder")}
          />
        </div>
        {dziennik.length === 0 ? (
          <p style={{ ...drobny, margin: 0 }}>{t("brakWpisow")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {dziennik.map((w) => (
              <li key={w.id} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                <span style={drobny}>{w.occurredAt.slice(0, 10)}</span>{" "}
                {w.text}
                {w.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.photoUrl} alt="" style={{ display: "block", maxWidth: "100%", borderRadius: 8, marginTop: 6 }} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>
          <Ruler size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          {t("pomiaryTytul")}
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <select value={rodzajPomiaru} onChange={(e) => setRodzajPomiaru(e.target.value as RodzajPomiaru)} aria-label={t("rodzajPomiaruEtykieta")} style={{ ...pole, flex: "0 1 190px" }}>
            {(["HEIGHT_CM", "LEAF_COUNT", "TRUNK_CM", "SOIL_MOISTURE", "TEMP_C", "PH", "LIGHT", "OTHER"] as RodzajPomiaru[]).map((k) => (
              <option key={k} value={k}>{t(`pomiar.${k}`)}</option>
            ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={wartosc}
            onChange={(e) => setWartosc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") dodajPomiar(); }}
            placeholder={t("wartoscPlaceholder")}
            aria-label={t("wartoscEtykieta")}
            style={{ ...pole, flex: "0 1 120px" }}
          />
          <button type="button" style={przycisk} onClick={dodajPomiar} disabled={pending}>{t("dodaj")}</button>
        </div>
        {pomiary.length === 0 ? (
          <p style={{ ...drobny, margin: 0 }}>{t("brakPomiarow")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
            {pomiary.slice(-10).reverse().map((p) => (
              <li key={p.id} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                <span style={drobny}>{p.measuredAt.slice(0, 10)}</span>{" "}
                {t(`pomiar.${p.kind}`)}: {p.value} {p.unit}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>
          <Wheat size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          {t("zbiorTytul")}
        </h2>
        <p style={{ ...drobny, margin: "0 0 8px" }}>{t("zbiorOpis")}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input
            type="text"
            inputMode="decimal"
            value={plon}
            onChange={(e) => setPlon(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") zapiszZbior(); }}
            placeholder={t("plonPlaceholder")}
            aria-label={t("plonEtykieta")}
            style={{ ...pole, flex: "0 1 110px" }}
          />
          <input
            type="text"
            value={jednostkaPlonu}
            onChange={(e) => setJednostkaPlonu(e.target.value)}
            aria-label={t("jednostkaPlonuEtykieta")}
            style={{ ...pole, flex: "0 1 90px" }}
          />
          <button type="button" style={przyciskGlowny} onClick={zapiszZbior} disabled={pending}>
            {t("zapiszZbior")}
          </button>
        </div>
        {zbiory.length > 0 && (
          <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0, display: "grid", gap: 10 }}>
            {zbiory.map((z) => (
              <li key={z.id} style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  <span style={drobny}>{z.occurredAt.slice(0, 10)}</span>{" "}
                  {z.quantity ?? "?"} {z.quantityUnit ?? ""}
                </span>
                {/* Trzy wyjścia z modułu — każde przez kontrakt innego modułu, żadne zbudowane u siebie. */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" style={przycisk} onClick={() => doSpizarni(z.id)} disabled={pending || z.wSpizarni}>
                    {z.wSpizarni ? t("juzWSpizarni") : t("doSpizarni")}
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={koszt[z.id] ?? ""}
                    onChange={(e) => setKoszt((k) => ({ ...k, [z.id]: e.target.value }))}
                    placeholder={t("kosztPlaceholder")}
                    aria-label={t("kosztEtykieta")}
                    style={{ ...pole, flex: "0 1 110px" }}
                  />
                  <button
                    type="button"
                    style={przycisk}
                    onClick={() => zapiszKoszt(z.id)}
                    disabled={pending || !(koszt[z.id] ?? "").trim()}
                  >
                    {t("zapiszKoszt")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button type="button" style={{ ...przycisk, marginTop: 8 }} onClick={naZakupy} disabled={pending}>
          {t("naZakupy")}
        </button>
      </section>

      {zdarzenia.length > 0 && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("historiaTytul")}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
            {zdarzenia.map((z) => (
              <li key={z.id} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                <span style={drobny}>{z.occurredAt.slice(0, 10)}</span>{" "}
                {t(`zabieg.${z.kind}`)}
                {z.outcome !== "DONE" && <span style={drobny}> ({t(`wynik.${z.outcome}`)})</span>}
                {z.note && <span style={drobny}> — {z.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </ModuleView>
  );
}
