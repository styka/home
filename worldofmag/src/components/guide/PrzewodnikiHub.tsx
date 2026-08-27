"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Lock, Search, Clock } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { normalizujFraze } from "@/lib/przewodnikiSzukanie";

/**
 * 108 — DZIAŁ PRZEWODNIKÓW: jedno miejsce ze wszystkimi przewodnikami użytkownika.
 *
 * Kafelki dzielą się na „gotowe" i „wkrótce", a lista „wkrótce" jest LICZONA z rejestru modułów
 * pomniejszonego o te, które mają przewodnik — nie wypisana ręcznie. To nie jest oszczędność
 * kodu, tylko warunek, żeby dział nie kłamał: przy drugiej liście nowy moduł Omnii byłby na niej
 * nieobecny i wyglądałby jak moduł, którego przewodnik już powstał.
 */

export interface KafelekPrzewodnika {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  rozdzialow: number;
  /** Ikona modułu przychodzi z serwera jako gotowy węzeł — hub nie zna rejestru modułów. */
  moduleId: string | null;
  kolor: string;
  /** Moduł, do którego czytelnik nie ma uprawnienia. Kafelek jest wtedy wygaszony (AC-12). */
  zablokowany: boolean;
}

export interface KafelekWkrotce {
  moduleId: string;
  label: string;
  kolor: string;
  zablokowany: boolean;
}

export interface WpisIndeksu {
  przewodnikSlug: string;
  przewodnikTitle: string;
  rozdzialSlug: string;
  rozdzialTitle: string;
  tekst: string;
}

export function PrzewodnikiHub({
  gotowe,
  wkrotce,
  indeks,
}: {
  gotowe: KafelekPrzewodnika[];
  wkrotce: KafelekWkrotce[];
  indeks: WpisIndeksu[];
}) {
  const t = useTranslations("components.guide.PrzewodnikiHub");
  const [fraza, setFraza] = useState("");

  const wyniki = useMemo(() => {
    const igla = normalizujFraze(fraza);
    if (igla.length < 2) return null;
    const out: { klucz: string; href: string; przewodnik: string; rozdzial: string; fragment: string }[] = [];
    for (const w of indeks) {
      const stog = `${w.rozdzialTitle} ${w.tekst}`;
      const poz = normalizujFraze(stog).indexOf(igla);
      if (poz < 0) continue;
      const start = Math.max(0, poz - 50);
      out.push({
        klucz: `${w.przewodnikSlug}/${w.rozdzialSlug}`,
        href: `/guide/${w.przewodnikSlug}#${w.rozdzialSlug}`,
        przewodnik: w.przewodnikTitle,
        rozdzial: w.rozdzialTitle,
        fragment:
          (start > 0 ? "…" : "") + stog.slice(start, start + 170).trim() + (start + 170 < stog.length ? "…" : ""),
      });
      if (out.length >= 24) break;
    }
    return out;
  }, [fraza, indeks]);

  const pustyWynik = wyniki !== null && wyniki.length === 0;

  return (
    <ModuleView
      width="narrow"
      icon={<BookOpen size={16} />}
      iconColor="var(--accent-blue)"
      title={t("przewodniki")}
      subtitle={t("podtytul")}
      state={pustyWynik ? "empty" : "ready"}
      empty={{
        icon: <Search size={20} />,
        title: t("nicNieZnaleziono"),
        description: t("nicNieZnalezionoOpis"),
      }}
      filters={
        <div style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: 420 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            value={fraza}
            onChange={(e) => setFraza(e.target.value)}
            placeholder={t("szukajWPrzewodnikach")}
            style={{
              width: "100%",
              minHeight: 36,
              padding: "0 10px 0 30px",
              fontSize: 13,
              borderRadius: "var(--radius-control)",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-base)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      }
    >
      <div style={{ padding: "0 var(--view-padding) 48px", display: "flex", flexDirection: "column", gap: 32 }}>
        {wyniki !== null ? (
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Naglowek tekst={t("wynikiWyszukiwania", { liczba: wyniki.length })} />
            {wyniki.map((w) => (
              <Link
                key={w.klucz}
                href={w.href}
                style={{
                  display: "block",
                  padding: 12,
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-surface)",
                  textDecoration: "none",
                }}
              >
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{w.przewodnik}</p>
                <p style={{ margin: "2px 0 4px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {w.rozdzial}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {w.fragment}
                </p>
              </Link>
            ))}
          </section>
        ) : (
          <>
            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Naglowek tekst={t("gotowePrzewodniki")} />
              {gotowe.map((p) => (
                <KafelekGotowy key={p.slug} p={p} />
              ))}
            </section>

            {wkrotce.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Naglowek tekst={t("wkrotce")} />
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {t("wkrotceOpis")}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {wkrotce.map((m) => (
                    <span
                      key={m.moduleId}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        borderRadius: "var(--radius-control)",
                        border: "1px dashed var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.kolor }} />
                      {m.label}
                      {m.zablokowany && <Lock size={11} />}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ModuleView>
  );
}

function Naglowek({ tekst }: { tekst: string }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--text-secondary)",
      }}
    >
      {tekst}
    </h2>
  );
}

function KafelekGotowy({ p }: { p: KafelekPrzewodnika }) {
  const t = useTranslations("components.guide.PrzewodnikiHub");

  const wnetrze = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.kolor, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{p.title}</span>
        {p.zablokowany && <Lock size={13} style={{ color: "var(--text-muted)" }} />}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
          {t("rozdzialow", { liczba: p.rozdzialow })}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{p.summary}</p>
      {p.zablokowany && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Clock size={12} />
          {t("brakDostepuDoModulu")}
        </p>
      )}
    </>
  );

  const styl = {
    display: "block",
    padding: 14,
    borderRadius: "var(--radius-card)",
    border: "1px solid var(--border)",
    backgroundColor: "var(--bg-surface)",
    textDecoration: "none",
  } as const;

  /**
   * Moduł bez uprawnienia: kafelek zostaje WIDOCZNY, ale przestaje być odnośnikiem (AC-12).
   *
   * Ukrycie byłoby gorsze — czytelnik nie dowiedziałby się, że taka część aplikacji istnieje,
   * i nie miałby o co poprosić administratora. To ta sama zasada, którą stosuje menu boczne:
   * pozycja bez uprawnienia jest wygaszona, a nie usunięta.
   */
  if (p.zablokowany) {
    return (
      <div aria-disabled="true" style={{ ...styl, opacity: 0.55 }}>
        {wnetrze}
      </div>
    );
  }
  return (
    <Link href={`/guide/${p.slug}`} style={styl}>
      {wnetrze}
    </Link>
  );
}

