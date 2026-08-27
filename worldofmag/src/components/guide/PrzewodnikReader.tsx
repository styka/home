"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, List, Search, X } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { MARKDOWN_STYLES } from "@/lib/markdown";
import { formatujDate } from "@/platform/i18n/format";

/**
 * 108 — CZYTNIK JEDNEGO PRZEWODNIKA.
 *
 * Wszystkie rozdziały stoją w JEDNYM dokumencie, każdy jako sekcja z kotwicą — a nie po jednym na
 * trasę, jak w książkach administracyjnych (`AudytBookReader`). Trzy powody, każdy z zachowania
 * czytelnika szukającego pomocy, a nie czytającego od deski do deski:
 *
 *  1. `Ctrl+F` przeglądarki działa na CAŁEJ treści. Przy rozdziale na trasę szukałby w jednej
 *     dwunastej przewodnika i milczał o reszcie — czyli kłamał.
 *  2. Odnośnik `#rozdzial` da się wysłać drugiej osobie i wraca dokładnie tam, gdzie był.
 *  3. Powrót do miejsca, w którym się było, jest przewinięciem, a nie ponowną nawigacją.
 *
 * Czego tu świadomie NIE ma: własnego przełącznika motywu czytania (jasny/ciemny/sepia z książek
 * audytu). Motyw jest już wyborem użytkownika — skórką. Drugi przełącznik obok byłby drugim
 * źródłem prawdy o tym samym.
 */

interface RozdzialHtml {
  slug: string;
  title: string;
  summary: string;
  html: string;
}

export function PrzewodnikReader({
  title,
  subtitle,
  rozdzialy,
  updatedAt,
}: {
  title: string;
  subtitle: string;
  rozdzialy: RozdzialHtml[];
  updatedAt: string | null;
}) {
  const t = useTranslations("components.guide.PrzewodnikReader");
  const router = useRouter();
  const [aktywny, setAktywny] = useState(rozdzialy[0]?.slug ?? "");
  const [filtr, setFiltr] = useState("");
  const [spisOtwarty, setSpisOtwarty] = useState(false);
  const przyciskSpisu = useRef<HTMLButtonElement>(null);

  /**
   * Który rozdział czytelnik ma przed oczami.
   *
   * `IntersectionObserver` z górnym marginesem ujemnym: sekcja liczy się jako „bieżąca" dopiero
   * wtedy, gdy jej nagłówek minie górną jedną czwartą okna. Bez tego marginesu przy każdym
   * przewinięciu widoczne byłyby dwie sekcje naraz i podświetlenie migałoby między nimi.
   */
  useEffect(() => {
    const sekcje = rozdzialy
      .map((r) => document.getElementById(r.slug))
      .filter((el): el is HTMLElement => !!el);
    if (!sekcje.length || typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (wpisy) => {
        const widoczne = wpisy
          .filter((w) => w.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (widoczne[0]?.target.id) setAktywny(widoczne[0].target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 }
    );
    sekcje.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [rozdzialy]);

  const widoczne = useMemo(() => {
    const q = filtr.trim().toLowerCase();
    if (!q) return rozdzialy;
    return rozdzialy.filter(
      (r) => r.title.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)
    );
  }, [filtr, rozdzialy]);

  /**
   * Odnośniki w TREŚCI przewodnika — wzorzec z `AICommandSheet.handleBubbleClick`.
   *
   * Treść jest markdownem zamienionym na HTML, więc jej odnośniki to zwykłe `<a>`, a nie `<Link>`.
   * Wewnętrzny adres przechodzimy nawigacją aplikacji (bez przeładowania i bez utraty stanu),
   * zewnętrzny otwieramy w nowej karcie — żeby przewodnik nie wyrzucał czytelnika z aplikacji.
   * Kotwice (`#rozdzial`) zostawiamy przeglądarce: to przewinięcie w obrębie tej samej strony.
   */
  function klikWTresc(e: React.MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("#")) return;
    if (href.startsWith("/") && !href.startsWith("//")) {
      e.preventDefault();
      router.push(href);
    } else if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  function doRozdzialu(slug: string) {
    setSpisOtwarty(false);
    const el = document.getElementById(slug);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setAktywny(slug);
  }

  const spisTresci = (
    <nav aria-label={t("spisTresci")} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search
          size={13}
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        />
        <input
          value={filtr}
          onChange={(e) => setFiltr(e.target.value)}
          placeholder={t("szukajWRozdzialach")}
          style={{
            width: "100%",
            padding: "8px 8px 8px 26px",
            fontSize: 12,
            borderRadius: "var(--radius-control)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-base)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {widoczne.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 8px" }}>
          {t("brakRozdzialowDlaFrazy")}
        </p>
      )}

      {widoczne.map((r, i) => {
        const czynny = r.slug === aktywny;
        return (
          <button
            key={r.slug}
            type="button"
            onClick={() => doRozdzialu(r.slug)}
            aria-current={czynny ? "true" : undefined}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "baseline",
              textAlign: "left",
              // C-31: cel dotyku — pozycja spisu jest na telefonie klikana kciukiem.
              minHeight: 44,
              padding: "8px 10px",
              borderRadius: "var(--radius-control)",
              border: "none",
              cursor: "pointer",
              backgroundColor: czynny ? "var(--bg-elevated)" : "transparent",
              color: czynny ? "var(--text-primary)" : "var(--text-secondary)",
              fontSize: 13,
              fontWeight: czynny ? 600 : 400,
              borderLeft: czynny ? "2px solid var(--accent-blue)" : "2px solid transparent",
            }}
          >
            <span style={{ color: "var(--text-muted)", fontSize: 11, flexShrink: 0, minWidth: 16 }}>
              {String(rozdzialy.indexOf(r) + 1).padStart(2, "0")}
            </span>
            <span>{r.title}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <ModuleView
      state="ready"
      icon={<List size={16} />}
      iconColor="var(--accent-blue)"
      title={title}
      subtitle={subtitle}
      breadcrumb={
        <Link
          href="/guide"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={14} />
          {t("przewodniki")}
        </Link>
      }
      actions={
        /* Spis treści na telefonie: przycisk + warstwa. Na komputerze spis stoi w kolumnie
           obok treści, więc ten przycisk jest tam zbędny (`lg:hidden`). */
        <>
          <button
            ref={przyciskSpisu}
            type="button"
            onClick={() => setSpisOtwarty((v) => !v)}
            aria-expanded={spisOtwarty}
            className="lg:hidden"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minHeight: 36,
              padding: "0 12px",
              fontSize: 12,
              borderRadius: "var(--radius-control)",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {spisOtwarty ? <X size={14} /> : <List size={14} />}
            {t("spisTresci")}
          </button>
          <AnchoredLayer
            anchorRef={przyciskSpisu}
            open={spisOtwarty}
            onClose={() => setSpisOtwarty(false)}
            side="dol"
            align="koniec"
            width={280}
            role="dialog"
            ariaLabel={t("spisTresci")}
          >
            <div style={{ padding: 8, maxHeight: "70vh", overflowY: "auto" }}>{spisTresci}</div>
          </AnchoredLayer>
        </>
      }
    >
      <style dangerouslySetInnerHTML={{ __html: MARKDOWN_STYLES }} />

      <div
        style={{
          display: "flex",
          gap: 32,
          alignItems: "flex-start",
          // Wypełnienie poziome należy do ramy (`0 var(--view-padding)`); własne dałoby podwójne.
          paddingBottom: 48,
        }}
      >
        {/* Spis treści na komputerze — przyklejony, więc towarzyszy czytaniu. */}
        <aside
          className="hidden lg:block"
          style={{
            position: "sticky",
            top: 8,
            width: 260,
            flexShrink: 0,
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
          }}
        >
          {spisTresci}
        </aside>

        <article style={{ flex: 1, minWidth: 0, maxWidth: 760 }} onClick={klikWTresc}>
          {rozdzialy.map((r, i) => (
            <section
              key={r.slug}
              id={r.slug}
              // Kotwica musi lądować pod paskiem widoku, a nie za nim.
              style={{ scrollMarginTop: "calc(var(--view-bar-h, 0px) + 16px)", marginBottom: 40 }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  margin: "0 0 4px",
                }}
              >
                {t("rozdzialZ", { numer: i + 1, wszystkich: rozdzialy.length })}
              </p>
              <div className="md-content" dangerouslySetInnerHTML={{ __html: r.html }} />
            </section>
          ))}

          {updatedAt && (
            <footer
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 12,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              {/* C-32: przez `formatujDate`, nie `toLocaleDateString("pl-PL")` — to drugie ignoruje
                  strefę przestrzeni i przy dacie granicznej pokazałoby dzień wcześniej. */}
              {t("ostatniaAktualizacja", { data: formatujDate(new Date(updatedAt)) })}
            </footer>
          )}
        </article>
      </div>
    </ModuleView>
  );
}
