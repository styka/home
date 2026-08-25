"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Youtube, ExternalLink, FileText, MessageCircleQuestion } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { AiContentMeta } from "@/components/ui/AiContentMeta";
import { streszczenie, zapytajOFilm, type DlugoscStreszczenia } from "../actions/ai";
import type { FilmSzczegolDTO } from "../actions/filmy";

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
    </ModuleView>
  );
}
