"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle, X } from "lucide-react";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { subskrybujSygnal } from "@/platform/events/sygnalKlienta";
import { getLicznikNieprzeczytanych, getRozmowy, type RozmowaDTO } from "@/modules/czat/contract";

/**
 * 107 — IKONA CZATU W CHROMIE KONTA.
 *
 * **Dlaczego osobna ikona, a nie trzeci segment skrzynki.** Skrzynka zbiera sprawy, które się
 * ODHACZA — przeczytane znika. Rozmowa jest MIEJSCEM, do którego się wraca, także wtedy, gdy nic
 * w niej nowego nie ma. Wrzucenie jej do skrzynki znaczyłoby, że rozmowa kończy się w chwili
 * przeczytania ostatniej wiadomości.
 *
 * Stoi **za dzwonkiem**, w tej samej kolejności na telefonie i na komputerze — ręka szuka jej
 * w tym samym miejscu na obu szerokościach. Lustrzenie za ręką dominującą robi klasa
 * `.omnia-chrom-konta` na rodzicu, więc tutaj nie ma o nim ani słowa.
 *
 * Dane bierze z **kontraktu** modułu (C-36) — powłoka nie ma prawa zaglądać do jego wnętrza.
 */
export function IkonaCzatu({ placement = "topbar" }: { placement?: "topbar" | "chrome" }) {
  const t = useTranslations("components.shell.IkonaCzatu");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [rozmowy, setRozmowy] = useState<RozmowaDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const kotwicaRef = useRef<HTMLDivElement>(null);

  const odswiezLicznik = useCallback(() => {
    getLicznikNieprzeczytanych().then(setCount).catch(() => { /* powłoka działa dalej bez licznika */ });
  }, []);

  useEffect(() => { odswiezLicznik(); }, [odswiezLicznik]);

  // Sygnał ze strumienia zdarzeń — licznik ma się zmienić bez przeładowania strony (AC-16, AC-17).
  useEffect(() => subskrybujSygnal((s) => {
    if (s.type === "czat.rozmowa") odswiezLicznik();
  }), [odswiezLicznik]);

  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (next) {
        setLoading(true);
        getRozmowy()
          .then((r) => { setRozmowy(r); setCount(r.filter((x) => x.nieprzeczytane > 0).length); })
          .catch(() => {})
          .finally(() => setLoading(false));
      }
      return next;
    });
  }, []);

  const otworz = useCallback((id: string) => {
    setOpen(false);
    router.push(`/czat?r=${id}`);
  }, [router]);

  // Nieprzeczytane na górze; przy równym stanie decyduje świeżość (kolejność z serwera).
  const posortowane = [...rozmowy].sort((a, b) => Number(b.nieprzeczytane > 0) - Number(a.nieprzeczytane > 0));
  const rozmiarPrzycisku = placement === "topbar" ? 44 : 34;
  const opis = count > 0 ? t("czatZLicznikiem", { ile: count }) : t("czat");

  return (
    <div ref={kotwicaRef} className="relative" style={{ display: "flex" }}>
      <button
        onClick={toggle}
        aria-label={opis}
        title={opis}
        className="flex items-center justify-center rounded-full"
        style={{ width: rozmiarPrzycisku, height: rozmiarPrzycisku, background: "transparent", border: "none", color: "var(--text-secondary)", position: "relative" }}
      >
        <MessageCircle size={19} />
        {count > 0 && (
          <span
            style={{
              position: "absolute", top: placement === "topbar" ? 4 : -1, right: placement === "topbar" ? 4 : -1,
              minWidth: 16, height: 16, padding: "0 4px", borderRadius: 99,
              background: "var(--accent-green)", color: "var(--on-accent, #fff)",
              fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      <AnchoredLayer
        anchorRef={kotwicaRef}
        open={open}
        onClose={() => setOpen(false)}
        role="dialog"
        ariaLabel={t("czat")}
        side="dol"
        align="koniec"
        width={320}
        style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg, 10px)", boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
      >
        <div>
          <div
            className="flex items-center justify-between"
            style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-surface)" }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t("czat")}</span>
            <button onClick={() => setOpen(false)} aria-label={t("zamknij")} style={{ color: "var(--text-muted)", padding: 4 }}>
              <X size={15} />
            </button>
          </div>

          {loading && rozmowy.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>{t("ladowanie")}</div>
          ) : posortowane.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {t("brakRozmow")}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {posortowane.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => otworz(r.id)}
                    className="flex w-full items-start gap-2 text-left"
                    style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: r.nieprzeczytane > 0 ? "var(--bg-hover)" : "transparent" }}
                  >
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--text-primary)", fontWeight: r.nieprzeczytane > 0 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.rodzaj === "zespol" ? `# ${r.etykieta}` : r.etykieta}
                      </span>
                      {r.ostatniaWiadomosc && (
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.ostatniaWiadomosc}
                        </span>
                      )}
                    </span>
                    {r.nieprzeczytane > 0 && (
                      <span style={{ flexShrink: 0, background: "var(--accent-green)", color: "var(--on-accent, #fff)", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "1px 6px" }}>
                        {r.nieprzeczytane}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => { setOpen(false); router.push("/czat"); }}
            style={{ display: "block", width: "100%", padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer", textAlign: "center" }}
          >
            {t("otworzCzat")}
          </button>
        </div>
      </AnchoredLayer>
    </div>
  );
}
