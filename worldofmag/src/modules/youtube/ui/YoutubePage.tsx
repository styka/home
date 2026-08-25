"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Youtube, Search, RefreshCw, Eye, EyeOff } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { useViewState } from "@/hooks/useViewState";
import { text, type RawParams } from "@/platform/viewState/viewState";
import {
  getFilmy, ustawStan, odswiezYoutube, getStanOdswiezania,
  type FilmDTO, type StanFilmu, type SortFilmow,
} from "../actions/filmy";

const kartaStyl: React.CSSProperties = {
  display: "flex", gap: 12, padding: 12, borderRadius: 10,
  background: "var(--bg-surface)", border: "1px solid var(--border)",
};
const przyciskStyl: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8, background: "var(--bg-elevated)",
  color: "var(--text-secondary)", fontSize: 13, border: "1px solid var(--border)", cursor: "pointer",
};
const przyciskAktywny: React.CSSProperties = {
  ...przyciskStyl, background: "var(--accent-red)", color: "var(--on-accent)", borderColor: "transparent",
};

/**
 * 102 — lista filmów z obserwowanych kanałów.
 *
 * Odpowiada na jedno pytanie: „czy mam dziś co oglądać". Dlatego domyślnym porządkiem jest
 * **ocena „czy warto obejrzeć"**, a nie data — od daty jest sam YouTube.
 *
 * Stan widoku (filtr, porządek, szukana fraza) żyje w ADRESIE, więc widok da się zapisać
 * w ulubionych — tak samo jak w Wiadomościach.
 */
export function YoutubePage({
  poczatkowe,
  viewParams = {},
}: {
  poczatkowe: FilmDTO[];
  viewParams?: RawParams;
}) {
  const t = useTranslations("modules.youtube.YoutubePage");
  const router = useRouter();
  const [filmy, setFilmy] = useState<FilmDTO[]>(poczatkowe);
  const [pending, startTransition] = useTransition();
  const [postep, setPostep] = useState<string | null>(null);

  const viewSpec = useMemo(() => ({ stan: text("nowy"), sort: text("warto"), q: text("") }), []);
  const [view, setView] = useViewState(viewSpec, viewParams);

  const stan = view.stan as StanFilmu;
  const sort = view.sort as SortFilmow;

  const przeladuj = useCallback(
    (nadpisz?: { stan?: StanFilmu; sort?: SortFilmow; q?: string }) => {
      const p = {
        stan: (nadpisz?.stan ?? stan) as StanFilmu,
        sort: (nadpisz?.sort ?? sort) as SortFilmow,
        szukaj: nadpisz?.q ?? view.q,
      };
      startTransition(async () => setFilmy(await getFilmy(p)));
    },
    [stan, sort, view.q]
  );

  // Postęp odświeżania czytamy z zadania w tle — dzięki temu przeżywa przeładowanie strony.
  useEffect(() => {
    if (!postep) return;
    const id = setInterval(async () => {
      const s = await getStanOdswiezania();
      if (!s || s.status === "DONE" || s.status === "FAILED") {
        setPostep(null);
        przeladuj();
        clearInterval(id);
      } else {
        setPostep(s.progress ?? t("odswiezanie"));
      }
    }, 2000);
    return () => clearInterval(id);
  }, [postep, przeladuj, t]);

  async function odswiez() {
    setPostep(t("odswiezanie"));
    await odswiezYoutube();
  }

  async function zmienStan(videoId: string, nowy: StanFilmu) {
    await ustawStan(videoId, nowy);
    setFilmy((f) => f.filter((x) => x.videoId !== videoId));
  }

  const filtry = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {(["nowy", "obejrzany", "odrzucony"] as StanFilmu[]).map((s) => (
        <button
          key={s}
          type="button"
          style={stan === s ? przyciskAktywny : przyciskStyl}
          onClick={() => { setView({ stan: s }); przeladuj({ stan: s }); }}
        >
          {t(`stan.${s}`)}
        </button>
      ))}
      <span style={{ width: 1, height: 20, background: "var(--border)" }} />
      {(["warto", "data"] as SortFilmow[]).map((s) => (
        <button
          key={s}
          type="button"
          style={sort === s ? przyciskAktywny : przyciskStyl}
          onClick={() => { setView({ sort: s }); przeladuj({ sort: s }); }}
        >
          {t(`sort.${s}`)}
        </button>
      ))}
      <label style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 160 }}>
        <Search size={14} style={{ color: "var(--text-muted)" }} aria-hidden />
        <input
          type="search"
          defaultValue={view.q}
          placeholder={t("szukajPlaceholder")}
          aria-label={t("szukajEtykieta")}
          onChange={(e) => setView({ q: e.target.value }, { replace: true })}
          onKeyDown={(e) => { if (e.key === "Enter") przeladuj(); }}
          style={{
            width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13,
          }}
        />
      </label>
    </div>
  );

  const akcje = (
    <button type="button" onClick={odswiez} disabled={!!postep} style={przyciskStyl}>
      <RefreshCw size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden />
      {postep ?? t("odswiez")}
    </button>
  );

  return (
    <ModuleView
      icon={<Youtube size={18} />}
      iconColor="var(--accent-red)"
      title={t("tytul")}
      filters={filtry}
      actions={akcje}
      settings={{ href: "/youtube/kanaly", label: t("kanaly") }}
      state={pending ? "loading" : filmy.length === 0 ? "empty" : "ready"}
      empty={{ title: t("pustoTytul"), description: t("pustoOpis"), action: { label: t("kanaly"), href: "/youtube/kanaly" } }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filmy.map((f) => (
          <article key={f.id} style={kartaStyl}>
            {f.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.thumbnailUrl}
                alt=""
                width={120}
                height={68}
                style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "var(--bg-elevated)" }}
              />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <button
                type="button"
                onClick={() => router.push(`/youtube/${f.videoId}`)}
                style={{
                  background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer",
                  color: "var(--text-primary)", fontSize: 14, fontWeight: 600, lineHeight: 1.35,
                }}
              >
                {f.title}
              </button>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {f.kanal.title}
                {f.transkrypcjaStan === "niedostepna" && ` · ${t("brakTranskrypcji")}`}
              </div>
              {f.ocenaPowod && (
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 0" }}>
                  {typeof f.ocena === "number" && (
                    <strong style={{ color: "var(--accent-red)" }}>{f.ocena}/100 · </strong>
                  )}
                  {f.ocenaPowod}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button type="button" style={przyciskStyl} onClick={() => zmienStan(f.videoId, "obejrzany")}>
                  <Eye size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
                  {t("oznaczObejrzany")}
                </button>
                <button type="button" style={przyciskStyl} onClick={() => zmienStan(f.videoId, "odrzucony")}>
                  <EyeOff size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
                  {t("oznaczOdrzucony")}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </ModuleView>
  );
}
