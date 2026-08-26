"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Clock, Search, Settings, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { szukajCelow, type GalazNawigacji } from "@/lib/nawigacja/szukajCelow";

/**
 * 104: PANEL SZYBKIEJ NAWIGACJI — następca łukowego wachlarza z run 100/103.
 *
 * Zgłoszenie właściciela brzmiało wprost: „sposób wachlarza jest słaby, chaotyczny; zrób inny
 * design". Łuk podpowiedzi wokół palca miał trzy wady naraz i żadna nie dawała się poprawić bez
 * zmiany formy: **pozycje zależały od miejsca dotknięcia** (więc nie dawały się zapamiętać),
 * **etykiety były przycięte do ~84 px**, a przy większej liczbie celów dochodził **drugi
 * pierścień**, po którym trzeba było wodzić palcem. To był interfejs, którego trzeba się uczyć,
 * podczas gdy jego zadaniem jest skrócenie drogi.
 *
 * Panel odwraca każdą z tych trzech rzeczy: pozycje mają **stałe miejsca** (lista, nie łuk), nazwy
 * są **pełne**, a długa zawartość **przewija się w środku** zamiast rosnąć w drugi pierścień.
 *
 * **Stoi na `AnchoredLayer` (080), a nie na własnej warstwie** — i to jest oszczędność, nie
 * lenistwo. Tamten komponent ma już rozwiązane cztery rzeczy, które tutaj byłyby błędami do
 * popełnienia od nowa: portal do `body` (żaden przodek z `overflow: hidden` nie przytnie panelu),
 * **pion liczony z odbiciem**, `maxHeight` do krawędzi okna oraz zamykanie `Esc` i kliknięciem poza.
 *
 * Kolejność sekcji nie jest przypadkowa — od najczęstszego powodu otwarcia do najrzadszego:
 * wyszukiwarka, ostatnio odwiedzone, ulubione, dopiero potem pełne drzewo modułów.
 */

export interface PozycjaPanelu {
  id: string;
  etykieta: string;
  href: string;
}

export function PanelNawigacji({
  kotwicaRef,
  otwarty,
  onClose,
  onWybor,
  galezie,
  ostatnie,
  ulubione,
  hrefUstawien,
}: {
  kotwicaRef: React.RefObject<HTMLElement>;
  otwarty: boolean;
  onClose: () => void;
  /** Wybór pozycji: panel zamyka się, a powłoka nawiguje. */
  onWybor: (href: string) => void;
  /** Moduły dostępne dla roli, każdy ze swoimi szybkimi celami. */
  galezie: GalazNawigacji[];
  /** Ostatnio odwiedzone strony, najświeższa pierwsza. */
  ostatnie: PozycjaPanelu[];
  /** Zapisane widoki użytkownika. */
  ulubione: PozycjaPanelu[];
  hrefUstawien: string;
}) {
  const t = useTranslations("components.shell.PanelNawigacji");
  const [fraza, setFraza] = useState("");
  const [rozwiniety, setRozwiniety] = useState<string | null>(null);

  const wyniki = useMemo(() => szukajCelow(galezie, fraza), [galezie, fraza]);

  /**
   * Stan panelu kasujemy przy ZAMKNIĘCIU, nie przy otwarciu. Panel ma się otwierać zawsze tak samo
   * — pamiętanie, co ktoś rozwinął poprzednim razem, zamieniłoby stałe miejsca pozycji w ruchome,
   * czyli oddałoby dokładnie tę wadę, którą ta zmiana usuwa z wachlarza.
   */
  const zamknij = () => {
    setFraza("");
    setRozwiniety(null);
    onClose();
  };

  const idz = (href: string) => {
    zamknij();
    onWybor(href);
  };

  return (
    <AnchoredLayer
      anchorRef={kotwicaRef}
      open={otwarty}
      onClose={zamknij}
      side="gora"
      align="srodek"
      width={320}
      role="dialog"
      ariaLabel={t("tytul")}
      /**
       * `AnchoredLayer` domyślnie sam przewija swoją zawartość (`overflowY: auto`). Tutaj to
       * WYŁĄCZAMY, bo inaczej powstałyby DWA zagnieżdżone kontenery przewijania i przewijałby się
       * ten zewnętrzny — czyli wyszukiwarka i stopka odjechałyby razem z listą, zamiast zostać na
       * miejscu. Panel bierze przewijanie na siebie: nagłówek i stopka stoją, przewija się środek.
       */
      style={{ overflowY: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        {/* Wyszukiwarka — pierwsza, bo znając nazwę to najkrótsza droga. */}
        <div style={{ padding: 8, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 8, color: "var(--text-muted)" }} />
            <input
              autoFocus
              value={fraza}
              onChange={(e) => setFraza(e.target.value)}
              placeholder={t("szukaj")}
              aria-label={t("szukaj")}
              style={{
                width: "100%",
                minHeight: 36,
                padding: "6px 8px 6px 28px",
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 14,
              }}
            />
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: 4 }}>
          {wyniki !== null ? (
            /* Tryb wyszukiwania: płaska lista trafień z widoczną przynależnością do modułu. */
            wyniki.length === 0 ? (
              <p style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                {t("brakWynikow")}
              </p>
            ) : (
              wyniki.map((w) => (
                <Wiersz
                  key={`${w.modul ?? "modul"}:${w.id}`}
                  etykieta={w.etykieta}
                  podpis={w.modul ?? undefined}
                  kolor={w.kolor}
                  onKlik={() => idz(w.href)}
                />
              ))
            )
          ) : (
            <>
              {/* Sekcje „Ostatnie" i „Ulubione" ZNIKAJĄ, gdy są puste — nagłówek nad pustką
                  to informacja o niczym, a panel ma wtedy od razu pokazać moduły. */}
              {ostatnie.length > 0 && (
                <Sekcja Icon={Clock} tytul={t("ostatnie")}>
                  {ostatnie.slice(0, 5).map((p) => (
                    <Wiersz key={p.id} etykieta={p.etykieta} onKlik={() => idz(p.href)} />
                  ))}
                </Sekcja>
              )}

              {ulubione.length > 0 && (
                <Sekcja Icon={Star} tytul={t("ulubione")}>
                  {ulubione.map((p) => (
                    <Wiersz key={p.id} etykieta={p.etykieta} onKlik={() => idz(p.href)} />
                  ))}
                </Sekcja>
              )}

              <Sekcja tytul={t("moduly")}>
                {galezie.map((g) => {
                  const otwarte = rozwiniety === g.id;
                  return (
                    <div key={g.id}>
                      <div style={{ display: "flex", alignItems: "stretch" }}>
                        <Wiersz etykieta={g.etykieta} kolor={g.kolor} onKlik={() => idz(g.href)} rosnie />
                        {g.cele.length > 0 && (
                          <button
                            type="button"
                            aria-expanded={otwarte}
                            aria-label={otwarte ? t("zwin", { modul: g.etykieta }) : t("rozwin", { modul: g.etykieta })}
                            onClick={() => setRozwiniety(otwarte ? null : g.id)}
                            style={{
                              minWidth: 44,
                              minHeight: 44,
                              background: "none",
                              border: "none",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {otwarte ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        )}
                      </div>
                      {otwarte &&
                        g.cele.map((c) => (
                          <Wiersz key={c.id} etykieta={c.etykieta} wciecie onKlik={() => idz(c.href)} />
                        ))}
                    </div>
                  );
                })}
              </Sekcja>
            </>
          )}
        </div>

        {/* Stopka: „Ustawienia paska". Przeniesione tu z wachlarza, bo to było ich jedyne wejście
            z paska — kasując wachlarz bez tego, odcięlibyśmy je bez zapowiedzi. */}
        <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <Wiersz etykieta={t("ustawieniaPaska")} Icon={Settings} onKlik={() => idz(hrefUstawien)} />
        </div>
      </div>
    </AnchoredLayer>
  );
}

function Sekcja({ Icon, tytul, children }: { Icon?: LucideIcon; tytul: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 8px 4px",
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-muted)",
        }}
      >
        {Icon && <Icon size={12} />}
        {tytul}
      </h3>
      {children}
    </section>
  );
}

/** Wiersz listy — cel dotyku ≥ 44 px wysokości (C-31), nazwa w pełnym brzmieniu. */
function Wiersz({
  etykieta,
  podpis,
  kolor,
  Icon,
  wciecie,
  rosnie,
  onKlik,
}: {
  etykieta: string;
  /** Moduł, do którego należy trafienie — pokazywany w trybie wyszukiwania. */
  podpis?: string;
  kolor?: string;
  Icon?: LucideIcon;
  wciecie?: boolean;
  rosnie?: boolean;
  onKlik: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onKlik}
      className="focus:outline-none"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: rosnie ? undefined : "100%",
        flex: rosnie ? 1 : undefined,
        minHeight: 44,
        padding: wciecie ? "6px 8px 6px 28px" : "6px 8px",
        background: "none",
        border: "none",
        borderRadius: 6,
        color: "var(--text-primary)",
        fontSize: 14,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {Icon && <Icon size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      {kolor && !Icon && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: kolor, flexShrink: 0 }} />
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etykieta}</span>
      {podpis && (
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{podpis}</span>
      )}
    </button>
  );
}
