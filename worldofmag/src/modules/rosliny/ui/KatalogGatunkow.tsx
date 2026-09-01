"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, Plus, Search } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { addSpeciesFromCatalog, createSpecies, searchCatalog, type GatunekDTO, type GatunekKatalogDTO } from "../actions/gatunki";
import type { KategoriaGatunku } from "../lib/typy";
import { drobny, naglowekSekcji, pole, przycisk, przyciskGlowny, sekcja } from "./style";

/**
 * 113 — katalog gatunków (AC-16, AC-17).
 *
 * **Pochodzenie wpisu jest widoczne przy każdym gatunku użytkownika.** Bez tego po pół roku nikt
 * nie odróżni faktu botanicznego z katalogu od nazwy, którą zaproponował model i ktoś kliknął
 * „zapisz" — ta sama lekcja, co przy wiedzy o użytkowniku.
 */
const KATEGORIE: KategoriaGatunku[] = ["houseplant", "vegetable", "herb", "fruit", "cereal", "ornamental", "other"];

export function KatalogGatunkow({
  katalog: poczatkowy,
  moje: poczatkoweMoje,
}: {
  katalog: GatunekKatalogDTO[];
  moje: GatunekDTO[];
}) {
  const t = useTranslations("modules.rosliny.KatalogGatunkow");
  const [katalog, setKatalog] = useState(poczatkowy);
  const [moje, setMoje] = useState(poczatkoweMoje);
  const [fraza, setFraza] = useState("");
  const [kategoria, setKategoria] = useState<KategoriaGatunku | "">("");
  const [wlasny, setWlasny] = useState(false);
  const [nowyPl, setNowyPl] = useState("");
  const [nowyLat, setNowyLat] = useState("");
  const [nowaRodzina, setNowaRodzina] = useState("");
  const [nowaKategoria, setNowaKategoria] = useState<KategoriaGatunku>("other");
  const [blad, setBlad] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function szukaj() {
    startTransition(async () => {
      setKatalog(await searchCatalog({ fraza, category: kategoria || undefined }));
    });
  }

  function dodaj(g: GatunekKatalogDTO) {
    startTransition(async () => {
      const { id } = await addSpeciesFromCatalog(g.key);
      setKatalog((k) => k.map((x) => (x.key === g.key ? { ...x, juzMam: true } : x)));
      setMoje((m) =>
        m.some((x) => x.id === id)
          ? m
          : [...m, {
              id, catalogKey: g.key, origin: "system", namePl: g.namePl, nameLatin: g.nameLatin,
              family: g.family, category: g.category, light: g.light, waterJson: null,
              soil: g.soil, tempMinC: g.tempMinC, notes: g.notes,
            }],
      );
    });
  }

  /**
   * AC-17: własny gatunek.
   *
   * **Rodzina botaniczna nie jest polem ozdobnym** — to na niej stoi ostrzeżenie płodozmianowe,
   * więc podpowiadamy ją wprost, zamiast chować pod „więcej pól". Wpis bez rodziny po prostu nie
   * wywoła ostrzeżenia i to jest w porządku; ukrycie pola sprawiłoby, że nikt by go nie wypełnił.
   */
  function dodajWlasny() {
    const pl = nowyPl.trim();
    const lat = nowyLat.trim();
    if (!pl || !lat) {
      setBlad(t("nazwyWymagane"));
      return;
    }
    setBlad(null);
    startTransition(async () => {
      try {
        const { id } = await createSpecies({
          namePl: pl,
          nameLatin: lat,
          family: nowaRodzina.trim() || null,
          category: nowaKategoria,
        });
        setMoje((m) =>
          m.some((x) => x.id === id)
            ? m
            : [...m, {
                id, catalogKey: null, origin: "user", namePl: pl, nameLatin: lat,
                family: nowaRodzina.trim() || null, category: nowaKategoria,
                light: null, waterJson: null, soil: null, tempMinC: null, notes: null,
              }],
        );
        setNowyPl("");
        setNowyLat("");
        setNowaRodzina("");
        setWlasny(false);
      } catch (e) {
        setBlad(e instanceof Error ? e.message : t("bladOgolny"));
      }
    });
  }

  return (
    <ModuleView
      icon={<BookOpen size={18} />}
      iconColor="var(--accent-green)"
      title={t("tytul")}
      breadcrumb={
        <Link href="/rosliny" style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {t("wroc")}
        </Link>
      }
      state="ready"
      actions={
        <button type="button" style={przyciskGlowny} onClick={() => setWlasny((v) => !v)}>
          <Plus size={13} aria-hidden />
          {t("wlasnyGatunek")}
        </button>
      }
      filters={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={fraza}
            onChange={(e) => setFraza(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") szukaj(); }}
            placeholder={t("szukajPlaceholder")}
            aria-label={t("szukajEtykieta")}
            style={{ ...pole, flex: "1 1 180px" }}
          />
          <select
            value={kategoria}
            onChange={(e) => setKategoria(e.target.value as KategoriaGatunku | "")}
            aria-label={t("kategoriaEtykieta")}
            style={{ ...pole, flex: "0 1 160px" }}
          >
            <option value="">{t("wszystkieKategorie")}</option>
            {KATEGORIE.map((k) => (
              <option key={k} value={k}>{t(`kategoria.${k}`)}</option>
            ))}
          </select>
          <button type="button" style={przycisk} onClick={szukaj} disabled={pending}>
            <Search size={13} aria-hidden />
            {t("szukaj")}
          </button>
        </div>
      }
    >
      {wlasny && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("wlasnyGatunek")}</h2>
          <p style={{ ...drobny, margin: "0 0 10px" }}>{t("wlasnyOpis")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="text" value={nowyPl} onChange={(e) => setNowyPl(e.target.value)} placeholder={t("nazwaPlPlaceholder")} aria-label={t("nazwaPlEtykieta")} style={{ ...pole, flex: "1 1 180px" }} />
            <input type="text" value={nowyLat} onChange={(e) => setNowyLat(e.target.value)} placeholder={t("nazwaLatPlaceholder")} aria-label={t("nazwaLatEtykieta")} style={{ ...pole, flex: "1 1 180px" }} />
            <input type="text" value={nowaRodzina} onChange={(e) => setNowaRodzina(e.target.value)} placeholder={t("rodzinaPlaceholder")} aria-label={t("rodzinaEtykieta")} style={{ ...pole, flex: "1 1 150px" }} />
            <select value={nowaKategoria} onChange={(e) => setNowaKategoria(e.target.value as KategoriaGatunku)} aria-label={t("kategoriaEtykieta")} style={{ ...pole, flex: "0 1 160px" }}>
              {KATEGORIE.map((k) => (<option key={k} value={k}>{t(`kategoria.${k}`)}</option>))}
            </select>
            <button type="button" style={przyciskGlowny} onClick={dodajWlasny} disabled={pending}>{t("zapisz")}</button>
          </div>
          <p style={{ ...drobny, margin: "8px 0 0" }}>{t("rodzinaPodpowiedz")}</p>
          {blad && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: "8px 0 0" }}>{blad}</p>}
        </section>
      )}

      {moje.length > 0 && (
        <section style={sekcja}>
          <h2 style={naglowekSekcji}>{t("mojeTytul", { ile: moje.length })}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {moje.map((g) => (
              <li key={g.id} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                {g.namePl} <span style={drobny}>{g.nameLatin}</span>
                <span style={{ ...drobny, marginLeft: 8 }}>{t(`pochodzenie.${g.origin}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={sekcja}>
        <h2 style={naglowekSekcji}>{t("katalogTytul")}</h2>
        <p style={{ ...drobny, margin: "0 0 10px" }}>{t("katalogOpis")}</p>
        {katalog.length === 0 ? (
          <p style={{ ...drobny, margin: 0 }}>{t("brakWynikow")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {katalog.map((g) => (
              <li key={g.key} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{g.namePl}</span>
                <span style={drobny}>{g.nameLatin}</span>
                {g.family && <span style={drobny}>· {g.family}</span>}
                <span style={{ ...drobny, marginLeft: "auto" }}>{t(`kategoria.${g.category}`)}</span>
                {g.juzMam ? (
                  <span style={drobny}>{t("juzMam")}</span>
                ) : (
                  <button type="button" style={przyciskGlowny} onClick={() => dodaj(g)} disabled={pending}>
                    <Plus size={13} aria-hidden />
                    {t("dodajDoSwoich")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ModuleView>
  );
}
