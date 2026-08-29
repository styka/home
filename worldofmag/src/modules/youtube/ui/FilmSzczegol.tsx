"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Youtube, ExternalLink, FileText, MessageCircleQuestion, NotebookPen, Check, GraduationCap } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { AiContentMeta } from "@/components/ui/AiContentMeta";
import { AiCostBadge, type AiCostUsage } from "@/components/ui/AiCostBadge";
import { llm } from "@/lib/llm-client";
import { getDecks, bulkAddWords } from "@/modules/languages/contract";
import type { LanguageDeck } from "@/types";
import { streszczenie, zapytajOFilm, type DlugoscStreszczenia } from "../actions/ai";
import { zapiszFilmJakoNotatke, type FilmSzczegolDTO } from "../actions/filmy";

type PropozycjaFiszki = { term: string; translation: string; example: string | null; partOfSpeech: string | null };

const przyciskStyl: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8, background: "var(--bg-elevated)",
  color: "var(--text-secondary)", fontSize: 13, border: "1px solid var(--border)", cursor: "pointer",
};
const przyciskAktywny: React.CSSProperties = {
  ...przyciskStyl, background: "var(--accent-red)", color: "var(--on-accent)", borderColor: "transparent",
};
const sekcjaStyl: React.CSSProperties = {
  padding: 14, borderRadius: 10, background: "var(--bg-surface)",
  border: "1px solid var(--border)", marginBottom: 12,
};

/**
 * 102 — szczegół filmu: odnośnik, streszczenie w trzech długościach, transkrypcja, pytania.
 *
 * **Brak transkrypcji jest tu stanem opisanym słowami, a nie brakiem sekcji** (AC-8). Film bez
 * napisów wygląda na kompletny: ma streszczenie z opisu i zdanie mówiące wprost, czego nie ma —
 * zniknięcie sekcji czytałoby się jak usterka aplikacji.
 */
export function FilmSzczegol({ film, domyslnaDlugosc }: { film: FilmSzczegolDTO; domyslnaDlugosc: DlugoscStreszczenia }) {
  const t = useTranslations("modules.youtube.FilmSzczegol");
  const [dlugosc, setDlugosc] = useState<DlugoscStreszczenia>(domyslnaDlugosc);
  const [tresc, setTresc] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ generatedAt: string | null; stale: boolean; swiezy: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [pytanie, setPytanie] = useState("");
  const [odpowiedz, setOdpowiedz] = useState<string | null>(null);
  const [pokazTranskrypcje, setPokazTranskrypcje] = useState(false);
  // 115 (Z-INT-12): zapis do Notatek — po sukcesie przycisk zostaje ptaszkiem (duplikatom mówimy nie).
  const [notatka, setNotatka] = useState<"spoczynek" | "praca" | "ok" | "blad">("spoczynek");

  function doNotatki() {
    if (notatka === "praca" || notatka === "ok") return;
    setNotatka("praca");
    zapiszFilmJakoNotatke(film.videoId)
      .then(() => setNotatka("ok"))
      .catch(() => setNotatka("blad"));
  }

  // 115 (Z-INT-13): „Fiszki z filmu" — transkrypcja jako źródło słownictwa dla talii Języków.
  const maTranskrypcje = !!film.transkrypcja;
  const [talie, setTalie] = useState<LanguageDeck[] | null>(null);
  const [taliaId, setTaliaId] = useState("");
  const [propozycje, setPropozycje] = useState<PropozycjaFiszki[] | null>(null);
  const [wybrane, setWybrane] = useState<Set<number>>(new Set());
  const [fiszkiBusy, setFiszkiBusy] = useState(false);
  const [fiszkiBlad, setFiszkiBlad] = useState<string | null>(null);
  const [fiszkiUsage, setFiszkiUsage] = useState<AiCostUsage | undefined>();
  const [dodanoFiszek, setDodanoFiszek] = useState<number | null>(null);

  useEffect(() => {
    if (!maTranskrypcje) return;
    // Brak talii (albo brak uprawnienia do Języków) = sekcja się nie pokazuje — cichy zapas.
    getDecks()
      .then((d) => { setTalie(d); if (d.length) setTaliaId(d[0].id); })
      .catch(() => setTalie([]));
  }, [maTranskrypcje]);

  async function zaproponujFiszki() {
    const talia = talie?.find((x) => x.id === taliaId);
    if (!talia || !film.transkrypcja) return;
    setFiszkiBusy(true);
    setFiszkiBlad(null);
    setDodanoFiszek(null);
    try {
      const res = await llm.languages.extract({
        // Ten sam sufit co przy streszczeniu z grubsza: koszt ekstrakcji rośnie liniowo z materiałem.
        sourceText: film.transkrypcja.slice(0, 12_000),
        nativeLang: talia.nativeLang,
        targetLang: talia.targetLang,
        max: 20,
      });
      if (res.error) throw new Error(res.error);
      setFiszkiUsage(res.usage);
      const slowa = res.words ?? [];
      setPropozycje(slowa);
      setWybrane(new Set(slowa.map((_, i) => i)));
    } catch (e) {
      setFiszkiBlad(e instanceof Error && e.message ? e.message : t("fiszkiBlad"));
    } finally {
      setFiszkiBusy(false);
    }
  }

  async function dodajFiszki() {
    if (!propozycje || wybrane.size === 0) return;
    setFiszkiBusy(true);
    setFiszkiBlad(null);
    try {
      const n = await bulkAddWords(taliaId, propozycje.filter((_, i) => wybrane.has(i)));
      setDodanoFiszek(n);
      setPropozycje(null);
      setWybrane(new Set());
    } catch (e) {
      setFiszkiBlad(e instanceof Error && e.message ? e.message : t("fiszkiBlad"));
    } finally {
      setFiszkiBusy(false);
    }
  }

  function generuj(d: DlugoscStreszczenia, force = false) {
    setDlugosc(d);
    startTransition(async () => {
      const w = await streszczenie(film.videoId, d, force);
      setTresc(w.tresc);
      // `swiezy` mówi, czy treść pochodzi z ŚWIEŻEGO wywołania modelu, czy z pamięci — prop jest
      // wymagany bez domyślnika właśnie dlatego, że w sekcji AI połowa renderów to odczyt z pamięci.
      setMeta({ generatedAt: w.generatedAt, stale: w.stale, swiezy: !w.zPamieci });
    });
  }

  function zapytaj() {
    if (!pytanie.trim()) return;
    startTransition(async () => setOdpowiedz(await zapytajOFilm(film.videoId, pytanie)));
  }

  return (
    <ModuleView
      icon={<Youtube size={18} />}
      iconColor="var(--accent-red)"
      title={film.title}
      subtitle={film.kanal.title}
      breadcrumb={<a href="/youtube" style={{ color: "var(--text-muted)", fontSize: 12 }}>{t("wrocDoListy")}</a>}
      state="ready"
    >
      <section style={sekcjaStyl}>
        <a
          href={film.adresYoutube}
          target="_blank"
          rel="noreferrer"
          style={{ ...przyciskAktywny, display: "inline-block", textDecoration: "none" }}
        >
          <ExternalLink size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          {t("otworzNaYoutube")}
        </a>
        <button
          type="button"
          onClick={doNotatki}
          disabled={notatka === "praca"}
          style={{ ...przyciskStyl, marginLeft: 8 }}
        >
          {notatka === "ok" ? (
            <Check size={13} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--accent-green)" }} aria-hidden />
          ) : (
            <NotebookPen size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          )}
          {notatka === "ok" ? t("notatkaZapisana") : t("zapiszNotatke")}
        </button>
        {notatka === "blad" && (
          <p role="status" style={{ fontSize: 12, color: "var(--accent-red)", margin: "8px 0 0" }}>
            {t("notatkaBlad")}
          </p>
        )}
      </section>

      <section style={sekcjaStyl}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
          {t("streszczenieTytul")}
        </h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {(["krotkie", "srednie", "dlugie"] as DlugoscStreszczenia[]).map((d) => (
            <button
              key={d}
              type="button"
              style={dlugosc === d && tresc ? przyciskAktywny : przyciskStyl}
              onClick={() => generuj(d)}
              disabled={pending}
            >
              {t(`dlugosc.${d}`)}
            </button>
          ))}
        </div>
        {film.transkrypcjaStan === "niedostepna" && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>{t("brakTranskrypcjiOpis")}</p>
        )}
        {tresc ? (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{tresc}</p>
            {meta && (
              <AiContentMeta
                generatedAt={meta.generatedAt ?? undefined}
                stale={meta.stale}
                swiezy={meta.swiezy}
                busy={pending}
                onRefresh={() => generuj(dlugosc, true)}
              />
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {pending ? t("generuje") : t("wybierzDlugosc")}
          </p>
        )}
      </section>

      <section style={sekcjaStyl}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
          <FileText size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
          {t("transkrypcjaTytul")}
        </h2>
        {film.transkrypcja ? (
          <>
            <button type="button" style={przyciskStyl} onClick={() => setPokazTranskrypcje((v) => !v)}>
              {pokazTranskrypcje ? t("ukryj") : t("pokaz")}
            </button>
            {pokazTranskrypcje && (
              // Własny kontener przewijania — transkrypcja bywa na kilkadziesiąt tysięcy znaków,
              // a strona nie może się przez nią rozpychać w poziomie na telefonie (C-31).
              <div
                style={{
                  marginTop: 10, maxHeight: 380, overflowY: "auto", overflowX: "auto",
                  fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}
              >
                {film.transkrypcja}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{t("brakTranskrypcjiEtykieta")}</p>
        )}
      </section>

      {film.transkrypcja && (
        <section style={sekcjaStyl}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
            <MessageCircleQuestion size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
            {t("pytaniaTytul")}
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              value={pytanie}
              onChange={(e) => setPytanie(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") zapytaj(); }}
              placeholder={t("pytaniePlaceholder")}
              aria-label={t("pytanieEtykieta")}
              style={{
                flex: "1 1 220px", background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13,
              }}
            />
            <button type="button" style={przyciskAktywny} onClick={zapytaj} disabled={pending}>
              {t("zapytaj")}
            </button>
          </div>
          {odpowiedz && (
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)", marginTop: 10, whiteSpace: "pre-wrap" }}>
              {odpowiedz}
            </p>
          )}
        </section>
      )}

      {/* 115 (Z-INT-13): sekcja tylko przy transkrypcji ORAZ istniejących taliach — bez talii nie ma
          dokąd dodawać, a pusta sekcja namawiałaby do wycieczki do innego modułu w pół pracy. */}
      {maTranskrypcje && talie && talie.length > 0 && (
        <section style={sekcjaStyl}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
            <GraduationCap size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
            {t("fiszkiTytul")}
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={taliaId}
              onChange={(e) => setTaliaId(e.target.value)}
              aria-label={t("fiszkiTalia")}
              style={{
                background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6,
                padding: "8px 10px", color: "var(--text-primary)", fontSize: 13,
              }}
            >
              {talie.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.targetLang})</option>
              ))}
            </select>
            <button type="button" style={przyciskAktywny} onClick={zaproponujFiszki} disabled={fiszkiBusy}>
              {fiszkiBusy && !propozycje ? t("fiszkiPracuje") : t("fiszkiZaproponuj")}
            </button>
          </div>
          {fiszkiBlad && (
            <p role="status" style={{ fontSize: 12, color: "var(--accent-red)", margin: "8px 0 0" }}>{fiszkiBlad}</p>
          )}
          {propozycje && propozycje.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "10px 0 0" }}>{t("fiszkiBrak")}</p>
          )}
          {propozycje && propozycje.length > 0 && (
            <>
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 4 }}>
                {propozycje.map((w, i) => (
                  <li key={`${w.term}-${i}`}>
                    <label style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={wybrane.has(i)}
                        onChange={() =>
                          setWybrane((s) => {
                            const kopia = new Set(s);
                            if (kopia.has(i)) kopia.delete(i);
                            else kopia.add(i);
                            return kopia;
                          })
                        }
                      />
                      <span style={{ minWidth: 0 }}>
                        <strong>{w.term}</strong> — {w.translation}
                        {w.example && (
                          <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{w.example}</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" style={przyciskAktywny} onClick={dodajFiszki} disabled={fiszkiBusy || wybrane.size === 0}>
                  {t("fiszkiDodaj", { n: wybrane.size })}
                </button>
                {fiszkiUsage && <AiCostBadge akcja="Fiszki z filmu" usage={fiszkiUsage} />}
              </div>
            </>
          )}
          {dodanoFiszek !== null && (
            <p role="status" style={{ fontSize: 12, color: "var(--accent-green)", margin: "8px 0 0" }}>
              {t("fiszkiDodano", { n: dodanoFiszek })}
            </p>
          )}
        </section>
      )}
    </ModuleView>
  );
}
