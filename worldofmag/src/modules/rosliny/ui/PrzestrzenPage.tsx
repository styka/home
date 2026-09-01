"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sprout, Plus, MapPin, Settings2, Wand2, Share2, ListPlus, CloudSun, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { AiContentMeta, AiContentPending } from "@/components/ui/AiContentMeta";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { deleteSpace, updateSpace, type PrzestrzenDTO } from "../actions/przestrzenie";
import type { MiejsceDTO } from "../actions/miejsca";
import { createPlace, deletePlace, updatePlace } from "../actions/miejsca";
import { createPlant, type RoslinaDTO } from "../actions/rosliny";
import { getSeasonPlan, getSpaceInsights, planToTask, type PozycjaPlanu, type TrescAI, type WnioskiPrzestrzeni } from "../actions/analiza";
import { getPlaceHistory, type HistoriaMiejscaDTO } from "../actions/miejsca";
import type { GatunekDTO } from "../actions/gatunki";
import { domyslnaJednostka, poleWidoczne } from "../lib/tryb";
import { etykietaFazy } from "../lib/fenologia";
import { NASLONECZNIENIA, type JednostkaLicznosci, type Naslonecznienie } from "../lib/typy";
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
  lokalizacje,
  gatunki,
}: {
  przestrzen: PrzestrzenDTO;
  miejsca: MiejsceDTO[];
  rosliny: RoslinaDTO[];
  plan: TrescAI<PozycjaPlanu[]>;
  wnioski: TrescAI<WnioskiPrzestrzeni>;
  lokalizacje: { id: string; label: string }[];
  gatunki: GatunekDTO[];
}) {
  const t = useTranslations("modules.rosliny.PrzestrzenPage");
  const confirmDialog = useConfirm();
  const router = useRouter();
  const [miejsca, setMiejsca] = useState(poczatkoweMiejsca);
  const [rosliny, setRosliny] = useState(poczatkoweRosliny);
  const [zaawansowane, setZaawansowane] = useState(false);
  const [formularz, setFormularz] = useState<"roslina" | "miejsce" | null>(null);
  const [udostepnianie, setUdostepnianie] = useState(false);
  const [ustawienia, setUstawienia] = useState(false);
  const [lokalizacja, setLokalizacja] = useState(przestrzen.weatherLocationId ?? "");
  const [wyslane, setWyslane] = useState<string[]>([]);
  const [ostrzezenie, setOstrzezenie] = useState<HistoriaMiejscaDTO["ostrzezenie"]>(null);
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [plan, setPlan] = useState(poczatkowyPlan);
  const [wnioski, setWnioski] = useState(poczatkoweWnioski);
  const [pending, startTransition] = useTransition();

  const [nazwaRosliny, setNazwaRosliny] = useState("");
  const [ilosc, setIlosc] = useState("1");
  const [jednostka, setJednostka] = useState<JednostkaLicznosci>(domyslnaJednostka(przestrzen.kind));
  const [miejsceId, setMiejsceId] = useState("");
  const [gatunekId, setGatunekId] = useState("");
  const [nazwaMiejsca, setNazwaMiejsca] = useState("");
  /** Które miejsce jest właśnie edytowane i jego brudnopis — edycja w miejscu, bez osobnej trasy. */
  const [edytowane, setEdytowane] = useState<{ id: string; name: string; sun: Naslonecznienie } | null>(null);

  const pokazLicznosc = poleWidoczne(przestrzen.kind, "licznosc", zaawansowane);
  const pokazFaze = poleWidoczne(przestrzen.kind, "faza", zaawansowane);

  function dodajRosline() {
    const nazwa = nazwaRosliny.trim();
    if (!nazwa) return;
    startTransition(async () => {
      const liczba = Number(ilosc.replace(",", "."));
      // Gatunek trafia do zapisu, bo to z niego reguła terminu bierze CZTERY liczby odstępu
      // podlewania. Bez niego harmonogram zawsze startowałby z wartości domyślnych.
      const { id } = await createPlant({
        spaceId: przestrzen.id,
        name: nazwa,
        placeId: miejsceId || null,
        speciesId: gatunekId || null,
        quantity: Number.isFinite(liczba) && liczba > 0 ? liczba : 1,
        quantityUnit: jednostka,
      });
      setRosliny((r) => [
        ...r,
        {
          id, spaceId: przestrzen.id, placeId: miejsceId || null,
          placeName: miejsca.find((m) => m.id === miejsceId)?.name ?? null,
          speciesId: gatunekId || null,
          gatunek: gatunki.find((g) => g.id === gatunekId)?.namePl ?? null,
          rodzina: gatunki.find((g) => g.id === gatunekId)?.family ?? null,
          name: nazwa,
          quantity: Number.isFinite(liczba) && liczba > 0 ? liczba : 1, quantityUnit: jednostka,
          stage: null, status: "ACTIVE", statusReason: null, sownAt: null, acquiredAt: null,
          parentId: null, photoUrl: null, notes: null,
        },
      ]);
      setNazwaRosliny("");
      setOstrzezenie(null);
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

  /**
   * AC-26: ostrzeżenie płodozmianowe SPRAWDZAMY W CHWILI WYBORU, a nie po zapisie.
   * Po zapisie byłoby wyrzutem sumienia, a nie ostrzeżeniem — użytkownik ma dowiedzieć się, zanim
   * posadzi. Nadal jest to OSTRZEŻENIE: formularz działa dalej, nic nie jest blokowane.
   *
   * **Rodzina musi pochodzić z gatunku, który użytkownik WŁAŚNIE wybiera** — nie z rośliny, która
   * w tym miejscu już stoi. To drugie liczyłoby ryzyko dla czegoś, czego nikt nie sadzi, i dawałoby
   * ostrzeżenie o rodzinie, której planowana uprawa może w ogóle nie dotyczyć. Dlatego przeliczamy
   * przy zmianie MIEJSCA i przy zmianie GATUNKU, a bez wybranego gatunku reguła milczy — tak samo
   * jak milczy dla wpisu bez rodziny (patrz `domain/plodozmian`).
   */
  function sprawdzPlodozmian(idMiejsca: string, idGatunku: string) {
    setOstrzezenie(null);
    if (!idMiejsca || !idGatunku) return;
    const rodzina = gatunki.find((g) => g.id === idGatunku)?.family ?? null;
    if (!rodzina) return;
    startTransition(async () => {
      try {
        setOstrzezenie((await getPlaceHistory(idMiejsca, rodzina)).ostrzezenie);
      } catch {
        /* brak historii nie może zablokować dodania rośliny */
      }
    });
  }

  function wybierzMiejsce(id: string) {
    setMiejsceId(id);
    sprawdzPlodozmian(id, gatunekId);
  }

  function wybierzGatunek(id: string) {
    setGatunekId(id);
    sprawdzPlodozmian(miejsceId, id);
  }

  /**
   * AC-7: przestrzeń da się usunąć Z INTERFEJSU.
   *
   * Akcja istniała od pierwszego dnia i była **nieosiągalna** — kryterium akceptacji spełnione
   * w kodzie, a nie u użytkownika. Potwierdzenie jest jawnie niszczące (C-34), bo znika cała
   * zawartość przestrzeni; kasowanie idzie do kosza, więc treść komunikatu to mówi.
   */
  function usunPrzestrzen() {
    startTransition(async () => {
      if (!(await confirmDialog({ title: t("usunPytanie", { nazwa: przestrzen.name }), destructive: true }))) return;
      await deleteSpace(przestrzen.id);
      // Po usunięciu nie ma czego pokazywać pod tym adresem — wracamy na listę, zamiast zostawiać
      // widok, który przy odświeżeniu skończy się błędem.
      router.push("/rosliny");
      router.refresh();
    });
  }

  function zapiszMiejsce() {
    if (!edytowane) return;
    const nazwa = edytowane.name.trim();
    if (!nazwa) return;
    const { id, sun } = edytowane;
    startTransition(async () => {
      await updatePlace(id, { name: nazwa, sun });
      setMiejsca((lista) => lista.map((m) => (m.id === id ? { ...m, name: nazwa, sun } : m)));
      setEdytowane(null);
    });
  }

  /**
   * Usunięcie miejsca nie zabiera roślin — `placeId` idzie na `SET NULL`. Potwierdzenie mówi to
   * wprost, bo pytanie „usunąć grządkę?" bez tej informacji brzmi jak pytanie o usunięcie uprawy.
   */
  function usunMiejsce(m: MiejsceDTO) {
    startTransition(async () => {
      if (!(await confirmDialog({ title: t("usunMiejscePytanie", { nazwa: m.name }), destructive: true }))) return;
      await deletePlace(m.id);
      setMiejsca((lista) => lista.filter((x) => x.id !== m.id));
      setRosliny((lista) => lista.map((r) => (r.placeId === m.id ? { ...r, placeId: null, placeName: null } : r)));
    });
  }

  function zapiszLokalizacje(id: string) {
    setLokalizacja(id);
    startTransition(async () => {
      await updateSpace(przestrzen.id, { weatherLocationId: id || null });
      setKomunikat(id ? t("lokalizacjaZapisana") : t("lokalizacjaUsunieta"));
    });
  }

  function doZadan(p: PozycjaPlanu, i: number) {
    startTransition(async () => {
      await planToTask(przestrzen.id, p);
      setWyslane((w) => [...w, String(i)]);
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
      settings={{ onClick: () => setUstawienia((v) => !v), active: ustawienia, label: t("ustawienia") }}
      actions={
        <>
          <button type="button" style={przycisk} onClick={() => setUdostepnianie(true)}>
            <Share2 size={13} aria-hidden />
            {t("udostepnij")}
          </button>
          <button type="button" style={przycisk} onClick={() => setFormularz(formularz === "miejsce" ? null : "miejsce")}>
            <MapPin size={13} aria-hidden />
            {t("noweMiejsce")}
          </button>
          <button type="button" style={przyciskGlowny} onClick={() => setFormularz(formularz === "roslina" ? null : "roslina")}>
            <Plus size={13} aria-hidden />
            {t("nowaRoslina")}
          </button>
        </>
      }
      filters={
        <button
          type="button"
          style={{ ...przycisk, background: zaawansowane ? "var(--bg-hover)" : "var(--bg-elevated)" }}
          aria-pressed={zaawansowane}
          // 118 (zgł. 7): przełącznik mówi, CO odsłania — bez tego użytkownik musiał go włączyć,
          // żeby się dowiedzieć. Tooltip + pełna nazwa dostępna; zestaw pól bez zmian (lib/tryb).
          title={t("zaawansowaneOpis")}
          aria-label={`${t("zaawansowane")} — ${t("zaawansowaneOpis")}`}
          onClick={() => setZaawansowane((v) => !v)}
        >
          <Settings2 size={13} aria-hidden />
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

      {ustawienia && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>
            <CloudSun size={13} aria-hidden />
            {t("lokalizacjaTytul")}
          </h2>
          <p style={{ ...drobny, margin: "0 0 10px" }}>{t("lokalizacjaOpis")}</p>
          {lokalizacje.length === 0 ? (
            <p style={{ ...drobny, margin: 0 }}>{t("brakLokalizacji")}</p>
          ) : (
            <select
              value={lokalizacja}
              onChange={(e) => zapiszLokalizacje(e.target.value)}
              aria-label={t("lokalizacjaEtykieta")}
              style={{ ...pole, maxWidth: 280 }}
              disabled={pending}
            >
              <option value="">{t("bezLokalizacji")}</option>
              {lokalizacje.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          )}
          {komunikat && <p style={{ ...drobny, margin: "8px 0 0", color: "var(--accent-green)" }}>{komunikat}</p>}

          <h2 style={{ ...naglowekSekcji, marginTop: 18 }}>{t("usunTytul")}</h2>
          <p style={{ ...drobny, margin: "0 0 10px" }}>{t("usunOpis")}</p>
          <button type="button" style={przycisk} onClick={usunPrzestrzen} disabled={pending}>
            <Trash2 size={13} aria-hidden />
            {t("usunPrzestrzen")}
          </button>
        </section>
      )}

      {/* 118 (zgł. 4): oba formularze w MODALU — jak „Udostępnij". Rozsuwana sekcja spychała
          treść strony przy każdym otwarciu; modal leży NAD treścią i niczego nie przesuwa. */}
      {formularz === "roslina" && (
        <Modal
          title={t("nowaRoslina")}
          onClose={() => { setFormularz(null); setOstrzezenie(null); }}
          footer={
            <button type="button" style={przyciskGlowny} onClick={dodajRosline} disabled={pending}>
              {t("dodaj")}
            </button>
          }
        >
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
              <select value={miejsceId} onChange={(e) => wybierzMiejsce(e.target.value)} aria-label={t("miejsceEtykieta")} style={{ ...pole, flex: "0 1 160px" }}>
                <option value="">{t("bezMiejsca")}</option>
                {miejsca.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
            {gatunki.length > 0 && (
              <select value={gatunekId} onChange={(e) => wybierzGatunek(e.target.value)} aria-label={t("gatunekEtykieta")} style={{ ...pole, flex: "0 1 170px" }}>
                <option value="">{t("bezGatunku")}</option>
                {gatunki.map((g) => (
                  <option key={g.id} value={g.id}>{g.namePl}</option>
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
          </div>
          {ostrzezenie && (
            <p
              style={{
                fontSize: 12,
                margin: 0,
                color: ostrzezenie.poziom === "warn" ? "var(--accent-amber)" : "var(--text-secondary)",
              }}
            >
              <AlertTriangle size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
              {ostrzezenie.tresc}
            </p>
          )}
        </Modal>
      )}

      {formularz === "miejsce" && (
        <Modal
          title={t("noweMiejsce")}
          onClose={() => setFormularz(null)}
          footer={
            <button type="button" style={przyciskGlowny} onClick={dodajMiejsce} disabled={pending}>
              {t("dodaj")}
            </button>
          }
        >
          <input
            type="text"
            value={nazwaMiejsca}
            onChange={(e) => setNazwaMiejsca(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") dodajMiejsce(); }}
            placeholder={t("nazwaMiejscaPlaceholder")}
            aria-label={t("nazwaMiejscaEtykieta")}
            style={pole}
          />
        </Modal>
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
                {edytowane?.id === m.id ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      value={edytowane.name}
                      onChange={(e) => setEdytowane({ ...edytowane, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") zapiszMiejsce(); }}
                      aria-label={t("nazwaMiejscaEtykieta")}
                      style={{ ...pole, flex: "1 1 180px" }}
                    />
                    <select
                      value={edytowane.sun}
                      onChange={(e) => setEdytowane({ ...edytowane, sun: e.target.value as Naslonecznienie })}
                      aria-label={t("naslonecznienieEtykieta")}
                      style={{ ...pole, flex: "0 1 170px" }}
                    >
                      {NASLONECZNIENIA.map((n) => (
                        <option key={n} value={n}>{t(`naslonecznienie.${n}`)}</option>
                      ))}
                    </select>
                    <button type="button" style={przyciskGlowny} onClick={zapiszMiejsce} disabled={pending}>
                      {t("zapisz")}
                    </button>
                    <button type="button" style={przycisk} onClick={() => setEdytowane(null)} disabled={pending}>
                      {t("anuluj")}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span>{m.name}</span>
                    <span style={drobny}>{t("miejsceLicznik", { ile: m.liczbaRoslin })}</span>
                    {/* Nasłonecznienie nie jest ozdobnikiem: to ono mnoży odstęp podlewania, więc
                        użytkownik musi móc je poprawić tam, gdzie miejsce widzi. */}
                    <span style={drobny}>{t(`naslonecznienie.${m.sun}`)}</span>
                    {poleWidoczne(przestrzen.kind, "powierzchnia", zaawansowane) && m.areaValue && (
                      <span style={drobny}>{m.areaValue} {m.areaUnit ?? "m²"}</span>
                    )}
                    <button
                      type="button"
                      style={{ ...przycisk, marginLeft: "auto" }}
                      onClick={() => setEdytowane({ id: m.id, name: m.name, sun: m.sun })}
                      disabled={pending}
                    >
                      <Pencil size={12} aria-hidden />
                      {t("edytuj")}
                    </button>
                    <button type="button" style={przycisk} onClick={() => usunMiejsce(m)} disabled={pending}>
                      <Trash2 size={12} aria-hidden />
                      {t("usun")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>
          <Wand2 size={13} aria-hidden />
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
                    {/* AC-20: bez tego plan byłby tekstem do przeczytania i zapomnienia. */}
                    {wyslane.includes(String(i)) ? (
                      <span style={drobny}>{t("wZadaniach")}</span>
                    ) : (
                      <button
                        type="button"
                        style={{ ...przycisk, padding: "3px 8px", minHeight: 0, fontSize: 12, marginTop: 4 }}
                        onClick={() => doZadan(p, i)}
                        disabled={pending}
                      >
                        <ListPlus size={12} aria-hidden />
                        {t("doZadan")}
                      </button>
                    )}
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
