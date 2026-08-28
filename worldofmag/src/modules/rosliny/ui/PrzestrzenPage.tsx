"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Sprout, Plus, MapPin, Settings2, Wand2, Share2 } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { AiContentMeta, AiContentPending } from "@/components/ui/AiContentMeta";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import type { PrzestrzenDTO } from "../actions/przestrzenie";
import type { MiejsceDTO } from "../actions/miejsca";
import { createPlace } from "../actions/miejsca";
import { createPlant, type RoslinaDTO } from "../actions/rosliny";
import { getSeasonPlan, getSpaceInsights, type PozycjaPlanu, type TrescAI, type WnioskiPrzestrzeni } from "../actions/analiza";
import { domyslnaJednostka, poleWidoczne } from "../lib/tryb";
import { etykietaFazy } from "../lib/fenologia";
import type { JednostkaLicznosci } from "../lib/typy";
import { drobny, naglowekSekcji, pole, przycisk, przyciskGlowny, sekcja } from "./style";

/**
 * 113 — widok jednej przestrzeni roślinnej (AC-2, AC-3).
 *
 * **Tryb przestrzeni steruje DOMYŚLNĄ widocznością pól, nigdy dostępem.** Przełącznik „pokaż
 * zaawansowane" odsłania wszystko w każdym trybie — reguła mieszka w `lib/tryb` i ma test, więc
 * kryterium akceptacji da się sprawdzić tablicą, a nie klikaniem. Tryb, który *blokuje*, zmuszałby
 * do zakładania drugiej przestrzeni po to, żeby raz wpisać pH.
 */
export function PrzestrzenPage({
  przestrzen,
  miejsca: poczatkoweMiejsca,
  rosliny: poczatkoweRosliny,
  plan: poczatkowyPlan,
  wnioski: poczatkoweWnioski,
}: {
  przestrzen: PrzestrzenDTO;
  miejsca: MiejsceDTO[];
  rosliny: RoslinaDTO[];
  plan: TrescAI<PozycjaPlanu[]>;
  wnioski: TrescAI<WnioskiPrzestrzeni>;
}) {
  const t = useTranslations("modules.rosliny.PrzestrzenPage");
  const [miejsca, setMiejsca] = useState(poczatkoweMiejsca);
  const [rosliny, setRosliny] = useState(poczatkoweRosliny);
  const [zaawansowane, setZaawansowane] = useState(false);
  const [formularz, setFormularz] = useState<"roslina" | "miejsce" | null>(null);
  const [udostepnianie, setUdostepnianie] = useState(false);
  const [plan, setPlan] = useState(poczatkowyPlan);
  const [wnioski, setWnioski] = useState(poczatkoweWnioski);
  const [pending, startTransition] = useTransition();

  const [nazwaRosliny, setNazwaRosliny] = useState("");
  const [ilosc, setIlosc] = useState("1");
  const [jednostka, setJednostka] = useState<JednostkaLicznosci>(domyslnaJednostka(przestrzen.kind));
  const [miejsceId, setMiejsceId] = useState("");
  const [nazwaMiejsca, setNazwaMiejsca] = useState("");

  const pokazLicznosc = poleWidoczne(przestrzen.kind, "licznosc", zaawansowane);
  const pokazFaze = poleWidoczne(przestrzen.kind, "faza", zaawansowane);

  function dodajRosline() {
    const nazwa = nazwaRosliny.trim();
    if (!nazwa) return;
    startTransition(async () => {
      const liczba = Number(ilosc.replace(",", "."));
      const { id } = await createPlant({
        spaceId: przestrzen.id,
        name: nazwa,
        placeId: miejsceId || null,
        quantity: Number.isFinite(liczba) && liczba > 0 ? liczba : 1,
        quantityUnit: jednostka,
      });
      setRosliny((r) => [
        ...r,
        {
          id, spaceId: przestrzen.id, placeId: miejsceId || null,
          placeName: miejsca.find((m) => m.id === miejsceId)?.name ?? null,
          speciesId: null, gatunek: null, rodzina: null, name: nazwa,
          quantity: Number.isFinite(liczba) && liczba > 0 ? liczba : 1, quantityUnit: jednostka,
          stage: null, status: "ACTIVE", statusReason: null, sownAt: null, acquiredAt: null,
          parentId: null, photoUrl: null, notes: null,
        },
      ]);
      setNazwaRosliny("");
      setFormularz(null);
    });
  }

  function dodajMiejsce() {
    const nazwa = nazwaMiejsca.trim();
    if (!nazwa) return;
    startTransition(async () => {
      const { id } = await createPlace({ spaceId: przestrzen.id, name: nazwa });
      setMiejsca((m) => [...m, { id, spaceId: przestrzen.id, name: nazwa, kind: "windowsill", sun: "unknown", soil: null, areaValue: null, areaUnit: null, notes: null, liczbaRoslin: 0 }]);
      setNazwaMiejsca("");
      setFormularz(null);
    });
  }

  function odswiezPlan() {
    startTransition(async () => setPlan(await getSeasonPlan(przestrzen.id, true)));
  }
  function odswiezWnioski() {
    startTransition(async () => setWnioski(await getSpaceInsights(przestrzen.id, true)));
  }

  return (
    <ModuleView
      icon={<Sprout size={18} />}
      iconColor="var(--accent-green)"
      title={przestrzen.name}
      breadcrumb={
        <Link href="/rosliny" style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {t("wroc")}
        </Link>
      }
      state="ready"
      actions={
        <>
          <button type="button" style={przycisk} onClick={() => setUdostepnianie(true)}>
            <Share2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {t("udostepnij")}
          </button>
          <button type="button" style={przycisk} onClick={() => setFormularz(formularz === "miejsce" ? null : "miejsce")}>
            <MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {t("noweMiejsce")}
          </button>
          <button type="button" style={przyciskGlowny} onClick={() => setFormularz(formularz === "roslina" ? null : "roslina")}>
            <Plus size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {t("nowaRoslina")}
          </button>
        </>
      }
      filters={
        <button
          type="button"
          style={{ ...przycisk, background: zaawansowane ? "var(--bg-hover)" : "var(--bg-elevated)" }}
          aria-pressed={zaawansowane}
          onClick={() => setZaawansowane((v) => !v)}
        >
          <Settings2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
          {t("zaawansowane")}
        </button>
      }
    >
      <p style={{ ...drobny, margin: "0 0 12px" }}>{t(`tryb.${przestrzen.kind}`)}</p>

      {/* To samo okno, co dla projektu zadań, notatki i zwierzęcia — `ShareDialog` jest w pełni
          generyczny i dostaje wyłącznie typ zasobu z deklaracji modułu (C-17, AC-28). */}
      {udostepnianie && (
        <ShareDialog
          resourceType="rosliny.space"
          resourceId={przestrzen.id}
          onClose={() => setUdostepnianie(false)}
        />
      )}

      {formularz === "roslina" && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("nowaRoslina")}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              value={nazwaRosliny}
              onChange={(e) => setNazwaRosliny(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") dodajRosline(); }}
              placeholder={t("nazwaRoslinyPlaceholder")}
              aria-label={t("nazwaRoslinyEtykieta")}
              style={{ ...pole, flex: "1 1 200px" }}
            />
            {miejsca.length > 0 && (
              <select value={miejsceId} onChange={(e) => setMiejsceId(e.target.value)} aria-label={t("miejsceEtykieta")} style={{ ...pole, flex: "0 1 160px" }}>
                <option value="">{t("bezMiejsca")}</option>
                {miejsca.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
            {pokazLicznosc && (
              <>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ilosc}
                  onChange={(e) => setIlosc(e.target.value)}
                  aria-label={t("iloscEtykieta")}
                  style={{ ...pole, flex: "0 1 90px" }}
                />
                <select value={jednostka} onChange={(e) => setJednostka(e.target.value as JednostkaLicznosci)} aria-label={t("jednostkaEtykieta")} style={{ ...pole, flex: "0 1 110px" }}>
                  <option value="szt">{t("jednostka.szt")}</option>
                  <option value="m2">{t("jednostka.m2")}</option>
                  <option value="ha">{t("jednostka.ha")}</option>
                </select>
              </>
            )}
            <button type="button" style={przyciskGlowny} onClick={dodajRosline} disabled={pending}>
              {t("dodaj")}
            </button>
          </div>
        </section>
      )}

      {formularz === "miejsce" && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("noweMiejsce")}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              value={nazwaMiejsca}
              onChange={(e) => setNazwaMiejsca(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") dodajMiejsce(); }}
              placeholder={t("nazwaMiejscaPlaceholder")}
              aria-label={t("nazwaMiejscaEtykieta")}
              style={{ ...pole, flex: "1 1 220px" }}
            />
            <button type="button" style={przyciskGlowny} onClick={dodajMiejsce} disabled={pending}>
              {t("dodaj")}
            </button>
          </div>
        </section>
      )}

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>{t("roslinyTytul", { ile: rosliny.length })}</h2>
        {rosliny.length === 0 ? (
          <p style={{ ...drobny, margin: 0 }}>{t("brakRoslin")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {rosliny.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/rosliny/${przestrzen.id}/roslina/${r.id}`}
                  style={{ display: "flex", gap: 8, alignItems: "baseline", textDecoration: "none", color: "var(--text-primary)", fontSize: 13, padding: "6px 0" }}
                >
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  {r.gatunek && <span style={drobny}>{r.gatunek}</span>}
                  {r.placeName && <span style={drobny}>· {r.placeName}</span>}
                  {pokazLicznosc && <span style={drobny}>· {r.quantity} {t(`jednostka.${r.quantityUnit}`)}</span>}
                  {pokazFaze && r.stage && <span style={drobny}>· {etykietaFazy(r.stage, przestrzen.kind)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {miejsca.length > 0 && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("miejscaTytul")}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {miejsca.map((m) => (
              <li key={m.id} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                {m.name}
                <span style={{ ...drobny, marginLeft: 8 }}>{t("miejsceLicznik", { ile: m.liczbaRoslin })}</span>
                {poleWidoczne(przestrzen.kind, "powierzchnia", zaawansowane) && m.areaValue && (
                  <span style={{ ...drobny, marginLeft: 8 }}>{m.areaValue} {m.areaUnit ?? "m²"}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>
          <Wand2 size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          {t("planTytul")}
        </h2>
        {plan.pending ? (
          <AiContentPending
            title={t("planTytul")}
            actionLabel={t("generuj")}
            busy={pending}
            onGenerate={odswiezPlan}
            sectionKind="rosliny.planSezonu"
          />
        ) : (
          <>
            {plan.value.length === 0 ? (
              <p style={{ ...drobny, margin: "0 0 8px" }}>{t("planPusty")}</p>
            ) : (
              <ol style={{ margin: "0 0 8px", paddingLeft: 18, display: "grid", gap: 6 }}>
                {plan.value.map((p, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    <strong>{p.miesiac}</strong> — {p.tytul}
                    <span style={{ ...drobny, display: "block" }}>{p.opis}</span>
                  </li>
                ))}
              </ol>
            )}
            <AiContentMeta
              generatedAt={plan.generatedAt ?? undefined}
              stale={plan.stale}
              busy={pending}
              onRefresh={odswiezPlan}
              usage={plan.usage ?? undefined}
              swiezy={!plan.fromMemory}
              sectionKind="rosliny.planSezonu"
            />
          </>
        )}
      </section>

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>{t("wnioskiTytul")}</h2>
        <p style={{ ...drobny, margin: "0 0 8px" }}>
          {t("statystyki", {
            aktywne: wnioski.value.liczbaAktywnych,
            zakonczone: wnioski.value.liczbaZakonczonych,
          })}
          {wnioski.value.przezywalnosc !== null && ` · ${t("przezywalnosc", { procent: wnioski.value.przezywalnosc })}`}
        </p>
        {wnioski.pending ? (
          <AiContentPending
            title={t("wnioskiTytul")}
            actionLabel={t("generuj")}
            busy={pending}
            onGenerate={odswiezWnioski}
            sectionKind="rosliny.wnioski"
          />
        ) : (
          <>
            {wnioski.value.wnioski.length > 0 && (
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, display: "grid", gap: 4 }}>
                {wnioski.value.wnioski.map((w, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text-primary)" }}>{w}</li>
                ))}
              </ul>
            )}
            <AiContentMeta
              generatedAt={wnioski.generatedAt ?? undefined}
              stale={wnioski.stale}
              busy={pending}
              onRefresh={odswiezWnioski}
              usage={wnioski.usage ?? undefined}
              swiezy={!wnioski.fromMemory}
              sectionKind="rosliny.wnioski"
            />
          </>
        )}
      </section>
    </ModuleView>
  );
}
