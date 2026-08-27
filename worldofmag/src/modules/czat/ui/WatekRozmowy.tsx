"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, CornerUpLeft, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { subskrybujSygnal } from "@/platform/events/sygnalKlienta";
import { getRozmowa, oznaczPrzeczytane, type SzczegolRozmowyDTO } from "../actions/rozmowy";
import { czyMozeEdytowac, ktoPrzeczytal } from "../domain/rozmowa";
import {
  getWiadomosci,
  przelaczReakcje,
  usunWiadomosc,
  type WiadomoscDTO,
} from "../actions/wiadomosci";
import { PoleWiadomosci } from "./PoleWiadomosci";

/** Reakcje pod ręką. Zamknięta lista, bo pełna paleta emoji to osobna funkcja, nie efekt uboczny. */
const REAKCJE = ["👍", "❤️", "😂", "🎉", "👀"];

/**
 * 107 — WĄTEK ROZMOWY.
 *
 * Wiadomości przychodzą od NAJNOWSZYCH (kursor), a rysujemy je od najstarszych — stąd `toReversed`
 * przy renderze. Starsze doczytują się przy przewijaniu **w górę**, bo tam jest granica historii.
 *
 * **Pozycja startowa: pierwsza nieprzeczytana, a przy jej braku koniec rozmowy** (AC-26). Dopiero
 * po ustawieniu widoku oznaczamy rozmowę jako przeczytaną — odwrotna kolejność skasowałaby
 * znacznik, względem którego liczymy, gdzie ustawić widok.
 */
export function WatekRozmowy({
  rozmowaId,
  etykieta,
  onWstecz,
  onZmiana,
}: {
  rozmowaId: string;
  etykieta: string;
  onWstecz: () => void;
  onZmiana: () => void;
}) {
  const t = useTranslations("modules.czat.WatekRozmowy");
  const confirmDialog = useConfirm();
  const [szczegol, setSzczegol] = useState<SzczegolRozmowyDTO | null>(null);
  const [wiadomosci, setWiadomosci] = useState<WiadomoscDTO[]>([]);
  const [kursor, setKursor] = useState<string | null>(null);
  const [jestWiecej, setJestWiecej] = useState(false);
  const [ladowanie, setLadowanie] = useState(true);
  const [odpowiadamNa, setOdpowiadamNa] = useState<WiadomoscDTO | null>(null);
  const [edytowana, setEdytowana] = useState<WiadomoscDTO | null>(null);
  const [reakcjeDla, setReakcjeDla] = useState<string | null>(null);
  const przewijanieRef = useRef<HTMLDivElement>(null);
  const doDoluRef = useRef(true);

  const wczytaj = useCallback(async () => {
    const [strona, glowa] = await Promise.all([getWiadomosci(rozmowaId), getRozmowa(rozmowaId)]);
    setWiadomosci(strona.pozycje);
    setKursor(strona.nastepnyKursor);
    setJestWiecej(strona.jestWiecej);
    setSzczegol(glowa);
    setLadowanie(false);
  }, [rozmowaId]);

  useEffect(() => { void wczytaj(); }, [wczytaj]);

  // Wejście do rozmowy JEST jej przeczytaniem — licznik ma zgasnąć i nie wracać przy zmianie
  // ekranu (AC-17). Robimy to po pierwszym wczytaniu, żeby pozycja startowa zdążyła policzyć się
  // ze znacznika sprzed odczytu.
  useEffect(() => {
    if (ladowanie) return;
    oznaczPrzeczytane(rozmowaId).then(onZmiana).catch(() => {});
  }, [ladowanie, rozmowaId, onZmiana]);

  // Sygnał ze strumienia: dociągamy TYLKO wtedy, gdy dotyczy tej rozmowy. Bez tego warunku każda
  // cudza wiadomość w innym wątku kosztowałaby tu pełne zapytanie.
  //
  // Po dociągnięciu **odnotowujemy odczyt** (U-4 z recenzji 107). Bez tego wiadomość pojawiała się
  // na ekranie i JEDNOCZEŚNIE zapalała odznakę „1 nieprzeczytana" — przy wiadomości, na którą
  // właśnie patrzę. Warunek widoczności karty jest istotny: rozmowa otwarta w tle nie jest czytana,
  // więc znaczenie odczytu miałoby tam wartość nieprawdziwą.
  useEffect(() => subskrybujSygnal((s) => {
    if (s.type !== "czat.rozmowa" || s.rozmowaId !== rozmowaId) return;
    void wczytaj().then(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      return oznaczPrzeczytane(rozmowaId).then(onZmiana).catch(() => {});
    });
  }), [rozmowaId, wczytaj, onZmiana]);

  // Do dołu tylko wtedy, gdy użytkownik NIE przewinął w górę — inaczej czytanie historii
  // przerywałaby każda nowa wiadomość.
  useEffect(() => {
    const el = przewijanieRef.current;
    if (el && doDoluRef.current) el.scrollTop = el.scrollHeight;
  }, [wiadomosci]);

  const doczytajStarsze = useCallback(async () => {
    if (!kursor || !jestWiecej) return;
    const strona = await getWiadomosci(rozmowaId, kursor);
    setWiadomosci((prev) => [...prev, ...strona.pozycje]);
    setKursor(strona.nastepnyKursor);
    setJestWiecej(strona.jestWiecej);
  }, [kursor, jestWiecej, rozmowaId]);

  const onUsun = useCallback(async (w: WiadomoscDTO) => {
    if (!(await confirmDialog({ title: t("usunacWiadomosc"), description: t("usunacOpis"), destructive: true }))) return;
    await usunWiadomosc(w.id);
    await wczytaj();
    onZmiana();
  }, [confirmDialog, t, wczytaj, onZmiana]);

  const onReakcja = useCallback(async (id: string, emoji: string) => {
    setReakcjeDla(null);
    await przelaczReakcje(id, emoji);
    await wczytaj();
  }, [wczytaj]);

  const piszacy = szczegol?.piszacy ?? [];
  const kolejnosc = [...wiadomosci].reverse();

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-surface)" }}>
      <div className="flex flex-shrink-0 items-center gap-1" style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
        {/* Wyjście z wątku na telefonie. Poniżej `md` wątek zajmuje cały ekran, więc bez tego
            przycisku jedyną drogą powrotu byłby systemowy „wstecz" — a widok bez własnej klamki
            to dokładnie to, czego zabrania kontrakt widoku. */}
        <button
          onClick={onWstecz}
          className="flex items-center justify-center rounded md:hidden"
          style={{ width: 44, height: 44, color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}
          aria-label={t("wrocDoListy")}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {szczegol?.etykieta || etykieta}
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", minHeight: 14 }}>
            {piszacy.length > 0 ? t("pisze", { kto: piszacy.join(", ") }) : ""}
          </span>
        </div>
      </div>

      <div
        ref={przewijanieRef}
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 8 }}
        onScroll={(e) => {
          const el = e.currentTarget;
          doDoluRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          if (el.scrollTop < 40) void doczytajStarsze();
        }}
      >
        {jestWiecej && (
          <button
            onClick={() => void doczytajStarsze()}
            style={{ alignSelf: "center", fontSize: 11.5, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", padding: 6 }}
          >
            {t("starsze")}
          </button>
        )}

        {ladowanie ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>{t("ladowanie")}</p>
        ) : kolejnosc.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5, margin: "auto 0" }}>{t("pusto")}</p>
        ) : (
          kolejnosc.map((w) => {
            // Reguły idą z warstwy `domain/` — tam mają test, tutaj miałyby wyłącznie okazję
            // rozjechać się z serwerem. Daty odtwarzamy z tekstu, bo DTO przekroczyło granicę
            // serwer→klient, gdzie `Date` nie przeżywa.
            const jaJestemAutorem = szczegol ? czyMozeEdytowac({ autorId: w.autorId, deletedAt: w.usunieta ? new Date() : null }, szczegol.jaId) : false;
            const przeczytanaPrzez = szczegol
              ? ktoPrzeczytal(
                  { createdAt: new Date(w.createdAt) },
                  szczegol.uczestnicy.map((u) => ({
                    userId: u.userId, nazwa: u.nazwa,
                    przeczytaneDo: u.przeczytaneDo ? new Date(u.przeczytaneDo) : null,
                    pisalAt: null,
                  })),
                  w.autorId,
                )
              : [];
            return (
              <div key={w.id} id={`w-${w.id}`} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)" }}>{w.autor}</span>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                    {new Date(w.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {w.editedAt && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("edytowano")}</span>}
                </div>

                {w.odpowiedzNa && (
                  <a
                    href={`#w-${w.odpowiedzNa.id}`}
                    style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", borderLeft: "2px solid var(--border)", paddingLeft: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {w.odpowiedzNa.autor}: {w.odpowiedzNa.tresc || t("wiadomoscUsunieta")}
                  </a>
                )}

                <div
                  style={{
                    fontSize: 13, lineHeight: 1.5, color: w.usunieta ? "var(--text-muted)" : "var(--text-primary)",
                    fontStyle: w.usunieta ? "italic" : undefined, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
                    background: "var(--bg-elevated)", borderRadius: 8, padding: "7px 9px",
                  }}
                >
                  {w.usunieta ? t("wiadomoscUsunieta") : w.tresc}
                </div>

                {w.reakcje.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {w.reakcje.map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => void onReakcja(w.id, r.emoji)}
                        aria-pressed={r.moja}
                        style={{
                          fontSize: 11.5, padding: "2px 7px", borderRadius: 99, cursor: "pointer",
                          border: `1px solid ${r.moja ? "var(--accent-green)" : "var(--border)"}`,
                          background: r.moja ? "var(--bg-hover)" : "transparent", color: "var(--text-secondary)",
                        }}
                      >
                        {r.emoji} {r.ile}
                      </button>
                    ))}
                  </div>
                )}

                {!w.usunieta && (
                  <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <button onClick={() => setOdpowiadamNa(w)} title={t("odpowiedz")} aria-label={t("odpowiedz")}
                      style={{ padding: 6, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
                      <CornerUpLeft size={13} />
                    </button>
                    <button onClick={() => setReakcjeDla((id) => (id === w.id ? null : w.id))} title={t("zareaguj")} aria-label={t("zareaguj")}
                      aria-expanded={reakcjeDla === w.id}
                      style={{ padding: 6, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
                      <SmilePlus size={13} />
                    </button>
                    {/* Edycja i usunięcie tylko przy WŁASNEJ wiadomości. Serwer sprawdza autorstwo
                        niezależnie — gdyby reguła istniała wyłącznie tutaj, wystarczyłoby wywołać
                        akcję wprost (AC-21). */}
                    {jaJestemAutorem && (
                      <>
                        <button onClick={() => setEdytowana(w)} title={t("edytuj")} aria-label={t("edytuj")}
                          style={{ padding: 6, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => void onUsun(w)} title={t("usun")} aria-label={t("usun")}
                          style={{ padding: 6, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                    {przeczytanaPrzez.length > 0 && jaJestemAutorem && (
                      <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-muted)" }}>
                        {t("przeczytanePrzez", { kto: przeczytanaPrzez.join(", ") })}
                      </span>
                    )}
                  </div>
                )}

                {reakcjeDla === w.id && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {REAKCJE.map((e) => (
                      <button key={e} onClick={() => void onReakcja(w.id, e)}
                        style={{ fontSize: 15, padding: "3px 6px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", cursor: "pointer" }}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <PoleWiadomosci
        rozmowaId={rozmowaId}
        odpowiadamNa={odpowiadamNa}
        edytowana={edytowana}
        onAnulujOdpowiedz={() => setOdpowiadamNa(null)}
        onAnulujEdycje={() => setEdytowana(null)}
        onWyslano={async () => { setOdpowiadamNa(null); setEdytowana(null); doDoluRef.current = true; await wczytaj(); onZmiana(); }}
      />
    </div>
  );
}
