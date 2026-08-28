"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Sprout, Plus, CalendarCheck } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { createSpace, type PrzestrzenDTO } from "../actions/przestrzenie";
import type { PozycjaAgendy } from "../actions/opieka";
import { TRYBY_PRZESTRZENI, type TrybPrzestrzeni } from "../lib/typy";
import { drobny, kolorKubelka, naglowekSekcji, pole, przycisk, przyciskGlowny, sekcja } from "./style";

/**
 * 113 — lista przestrzeni roślinnych (AC-1).
 *
 * **„Do zrobienia dziś" stoi NAD listą przestrzeni**, a nie pod nią. Wzorzec wprost z Pogody (085):
 * pasek sterowania trafił tam nad listę obserwatorów, bo pod ścianą treści użytkownik dowiadywał
 * się o rzeczy pilnej dopiero po przewinięciu wszystkiego. Tu jest tak samo — segment hobby wchodzi
 * do modułu z jednym pytaniem („co dziś podlać?"), a nie po to, żeby oglądać spis przestrzeni.
 */
export function RoslinyPage({
  przestrzenie: poczatkowe,
  agenda,
}: {
  przestrzenie: PrzestrzenDTO[];
  agenda: PozycjaAgendy[];
}) {
  const t = useTranslations("modules.rosliny.RoslinyPage");
  const [przestrzenie, setPrzestrzenie] = useState(poczatkowe);
  const [nazwa, setNazwa] = useState("");
  const [tryb, setTryb] = useState<TrybPrzestrzeni>("home");
  const [formularz, setFormularz] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pilne = agenda.filter((a) => a.bucket === "OVERDUE" || a.bucket === "TODAY");

  function zaloz() {
    const wartosc = nazwa.trim();
    if (!wartosc) return;
    setBlad(null);
    startTransition(async () => {
      try {
        const { id } = await createSpace({ name: wartosc, kind: tryb });
        setPrzestrzenie((p) => [
          ...p,
          { id, name: wartosc, kind: tryb, weatherLocationId: null, notes: null, liczbaRoslin: 0, liczbaMiejsc: 0, zespol: null },
        ]);
        setNazwa("");
        setFormularz(false);
      } catch (e) {
        setBlad(e instanceof Error ? e.message : t("bladOgolny"));
      }
    });
  }

  return (
    <ModuleView
      icon={<Sprout size={18} />}
      iconColor="var(--accent-green)"
      title={t("tytul")}
      state={przestrzenie.length === 0 && !formularz ? "empty" : "ready"}
      empty={{
        title: t("pustoTytul"),
        description: t("pustoOpis"),
        icon: <Sprout size={22} />,
        action: { label: t("zalozPierwsza"), onClick: () => setFormularz(true) },
      }}
      actions={
        <button type="button" style={przyciskGlowny} onClick={() => setFormularz((v) => !v)}>
          <Plus size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
          {t("nowaPrzestrzen")}
        </button>
      }
    >
      {formularz && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("nowaPrzestrzen")}</h2>
          <p style={{ ...drobny, margin: "0 0 10px" }}>{t("trybOpis")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") zaloz();
              }}
              placeholder={t("nazwaPlaceholder")}
              aria-label={t("nazwaEtykieta")}
              style={{ ...pole, flex: "1 1 220px" }}
            />
            <select
              value={tryb}
              onChange={(e) => setTryb(e.target.value as TrybPrzestrzeni)}
              aria-label={t("trybEtykieta")}
              style={{ ...pole, flex: "0 1 180px" }}
            >
              {TRYBY_PRZESTRZENI.map((k) => (
                <option key={k} value={k}>
                  {t(`tryb.${k}`)}
                </option>
              ))}
            </select>
            <button type="button" style={przyciskGlowny} onClick={zaloz} disabled={pending}>
              {t("zaloz")}
            </button>
          </div>
          {blad && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: "8px 0 0" }}>{blad}</p>}
        </section>
      )}

      {pilne.length > 0 && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>
            <CalendarCheck size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
            {t("naDzisTytul", { ile: pilne.length })}
          </h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {pilne.slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link
                  href={a.plantId ? `/rosliny/${a.spaceId}/roslina/${a.plantId}` : `/rosliny/${a.spaceId}`}
                  style={{ display: "flex", gap: 8, alignItems: "baseline", textDecoration: "none", color: "var(--text-primary)", fontSize: 13, padding: "6px 0" }}
                >
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: kolorKubelka(a.bucket), flex: "0 0 auto" }} />
                  <span style={{ fontWeight: 600 }}>{a.title}</span>
                  {a.plantName && <span style={drobny}>{a.plantName}</span>}
                  {/* Uzasadnienie terminu (AC-9): aplikacja, która tłumaczy, uczy. */}
                  {a.reason && <span style={{ ...drobny, marginLeft: "auto" }}>{a.reason}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/rosliny/opieka" style={{ ...przycisk, display: "inline-block", marginTop: 8, textDecoration: "none" }}>
            {t("caleZestawienie")}
          </Link>
        </section>
      )}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {przestrzenie.map((p) => (
          <Link
            key={p.id}
            href={`/rosliny/${p.id}`}
            style={{ ...sekcja, marginBottom: 0, textDecoration: "none", display: "block" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Sprout size={15} style={{ color: "var(--accent-green)" }} aria-hidden />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span>
            </div>
            <p style={{ ...drobny, margin: 0 }}>{t(`tryb.${p.kind}`)}</p>
            <p style={{ ...drobny, margin: "4px 0 0" }}>
              {t("licznik", { rosliny: p.liczbaRoslin, miejsca: p.liczbaMiejsc })}
            </p>
            {p.zespol && <p style={{ ...drobny, margin: "4px 0 0" }}>{t("zespol", { nazwa: p.zespol.name })}</p>}
          </Link>
        ))}
      </div>
    </ModuleView>
  );
}
