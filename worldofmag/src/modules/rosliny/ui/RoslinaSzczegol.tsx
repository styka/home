"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Sprout, Stethoscope, Ruler, NotebookPen, Trash2, Scissors } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import { deletePlant, propagatePlant, setPlantStatus, type RoslinaSzczegolDTO } from "../actions/rosliny";
import { addJournalEntry, addMeasurement, type PomiarDTO, type WpisDziennikaDTO } from "../actions/dziennik";
import { diagnosePlant, markHealthOutcome, type WynikDiagnozy } from "../actions/analiza";
import type { ZdarzenieDTO } from "../actions/opieka";
import { etykietaFazy } from "../lib/fenologia";
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
  tryb,
}: {
  roslina: RoslinaSzczegolDTO;
  dziennik: WpisDziennikaDTO[];
  pomiary: PomiarDTO[];
  zdarzenia: ZdarzenieDTO[];
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
  const [diagnoza, setDiagnoza] = useState<WynikDiagnozy | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function dodajWpis() {
    const tresc = wpis.trim();
    if (!tresc) return;
    startTransition(async () => {
      const { id } = await addJournalEntry({ plantId: roslina.id, text: tresc });
      setDziennik((d) => [{ id, occurredAt: new Date().toISOString(), text: tresc, photoUrl: null }, ...d]);
      setWpis("");
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
        setDiagnoza(await diagnosePlant({ plantId: roslina.id, objaw: objaw.trim() || null }));
      } catch (e) {
        setBlad(e instanceof Error ? e.message : t("bladOgolny"));
      }
    });
  }

  async function zakoncz(nowy: StatusRosliny) {
    // Powód jest wymagany tylko dla „padła" — i to jest różnica merytoryczna, nie formalna:
    // sprzedaż albo zbiór mówią same za siebie, a śmierć bez powodu nie mówi nic.
    let powod: string | null = null;
    if (nowy === "DEAD") {
      const zgoda = await confirmDialog({
        title: t("potwierdzPadla"),
        description: t("potwierdzPadlaOpis"),
        destructive: true,
      });
      if (!zgoda) return;
      powod = window.prompt(t("podajPrzyczyne")) ?? null;
      if (!powod?.trim()) {
        setBlad(t("przyczynaWymagana"));
        return;
      }
    }
    startTransition(async () => {
      await setPlantStatus(roslina.id, nowy, powod);
      setStatus(nowy);
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
          {roslina.gatunek && <span>{roslina.gatunek}</span>}
          {roslina.placeName && <span>{roslina.placeName}</span>}
          <span>{roslina.quantity} {t(`jednostka.${roslina.quantityUnit}`)}</span>
          {roslina.stage && <span>{etykietaFazy(roslina.stage, tryb)}</span>}
          <span>{t(`status.${status}`)}</span>
        </p>
        {roslina.statusReason && <p style={{ ...drobny, margin: "6px 0 0" }}>{roslina.statusReason}</p>}
        {status === "ACTIVE" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" style={przycisk} onClick={() => zakoncz("HARVESTED")} disabled={pending}>{t("zebrana")}</button>
            <button type="button" style={przycisk} onClick={() => zakoncz("SOLD")} disabled={pending}>{t("sprzedana")}</button>
            <button type="button" style={przycisk} onClick={() => zakoncz("DEAD")} disabled={pending}>{t("padla")}</button>
          </div>
        )}
        {blad && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: "8px 0 0" }}>{blad}</p>}
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
        {diagnoza && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "0 0 4px" }}>{diagnoza.diagnoza}</p>
            <p style={{ ...drobny, margin: "0 0 8px" }}>{t(`pewnosc.${diagnoza.pewnosc}`)}</p>
            {diagnoza.zalecenia.length > 0 && (
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, display: "grid", gap: 4 }}>
                {diagnoza.zalecenia.map((z, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    <span style={drobny}>{t(`zalecenie.${z.rodzaj}`)}: </span>
                    {z.tresc}
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
