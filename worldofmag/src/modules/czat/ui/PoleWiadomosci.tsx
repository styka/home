"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Send, X } from "lucide-react";
import { zglosPisanie } from "../actions/rozmowy";
import { edytujWiadomosc, wyslijWiadomosc, type WiadomoscDTO } from "../actions/wiadomosci";

/** Dławienie sygnału „piszę”: jeden zapis na tyle milisekund, niezależnie od liczby klawiszy. */
const ODSTEP_PISANIA_MS = 3_000;

/**
 * 107 — POLE WIADOMOŚCI.
 *
 * Trzy rzeczy, które na telefonie decydują o tym, czy komunikator jest używalny:
 *
 *  1. **Dolne wypełnienie liczy `env(safe-area-inset-bottom)`** — bez tego pole i przycisk wysyłki
 *     lądują na kresce do przełączania aplikacji (C-31; ta sama poprawka co w stopkach okien
 *     modalnych w 087).
 *  2. **Przycisk wysyłki reaguje na `onPointerDown` z `preventDefault`** — dotknięcie czegokolwiek
 *     poza polem tekstowym odbiera mu fokus i chowa klawiaturę, więc pierwszy tap „ginie" na jej
 *     schowaniu, a akcja wymaga drugiego. Ten sam chwyt, co pod kompozytorem asystenta.
 *  3. **Sygnał „piszę" jest dławiony** — inaczej każde uderzenie w klawisz byłoby zapisem do bazy.
 */
export function PoleWiadomosci({
  rozmowaId,
  odpowiadamNa,
  edytowana,
  onAnulujOdpowiedz,
  onAnulujEdycje,
  onWyslano,
}: {
  rozmowaId: string;
  odpowiadamNa: WiadomoscDTO | null;
  edytowana: WiadomoscDTO | null;
  onAnulujOdpowiedz: () => void;
  onAnulujEdycje: () => void;
  onWyslano: () => void | Promise<void>;
}) {
  const t = useTranslations("modules.czat.PoleWiadomosci");
  const [tresc, setTresc] = useState("");
  const [wysylam, setWysylam] = useState(false);
  const ostatniSygnal = useRef(0);
  const polerRef = useRef<HTMLTextAreaElement>(null);

  // Wejście w edycję wstawia dotychczasową treść — inaczej „edytuj" znaczyłoby „napisz od nowa".
  useEffect(() => {
    if (edytowana) {
      setTresc(edytowana.tresc);
      polerRef.current?.focus();
    }
  }, [edytowana]);

  const onZmiana = useCallback((wartosc: string) => {
    setTresc(wartosc);
    const teraz = Date.now();
    if (teraz - ostatniSygnal.current < ODSTEP_PISANIA_MS) return;
    ostatniSygnal.current = teraz;
    zglosPisanie(rozmowaId).catch(() => { /* wskaźnik pisania to wygoda, nie warunek rozmowy */ });
  }, [rozmowaId]);

  const wyslij = useCallback(async () => {
    const czysta = tresc.trim();
    if (!czysta || wysylam) return;
    setWysylam(true);
    try {
      if (edytowana) await edytujWiadomosc(edytowana.id, czysta);
      else await wyslijWiadomosc(rozmowaId, czysta, odpowiadamNa?.id ?? null);
      setTresc("");
      await onWyslano();
    } finally {
      setWysylam(false);
    }
  }, [tresc, wysylam, edytowana, rozmowaId, odpowiadamNa, onWyslano]);

  return (
    <div
      className="flex-shrink-0"
      style={{
        borderTop: "1px solid var(--border)",
        padding: "8px 10px",
        // Klawiatura na telefonie kończy się nad kreską gestu — bez tego przycisk wysyłki na niej ląduje.
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      {(odpowiadamNa || edytowana) && (
        <div
          className="flex items-center gap-2"
          style={{ marginBottom: 6, padding: "5px 8px", borderRadius: 6, background: "var(--bg-elevated)", borderLeft: "2px solid var(--accent-green)" }}
        >
          <span style={{ minWidth: 0, flex: 1, fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {edytowana ? t("edytujesz") : t("odpowiadaszNa", { autor: odpowiadamNa?.autor ?? "" })}
          </span>
          <button
            onPointerDown={(e) => { e.preventDefault(); if (edytowana) { setTresc(""); onAnulujEdycje(); } else onAnulujOdpowiedz(); }}
            aria-label={t("anuluj")}
            style={{ padding: 4, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={polerRef}
          value={tresc}
          onChange={(e) => onZmiana(e.target.value)}
          onKeyDown={(e) => {
            // Enter wysyła, Shift+Enter łamie wiersz — na telefonie klawiatura i tak daje „nowy
            // wiersz", więc jedyną drogą wysyłki tam jest przycisk obok.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void wyslij();
            }
          }}
          rows={1}
          placeholder={t("napisz")}
          aria-label={t("napisz")}
          style={{
            flex: 1, minWidth: 0, resize: "none", maxHeight: 120,
            fontSize: 13, lineHeight: 1.5, padding: "10px 10px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none",
          }}
        />
        <button
          // Wysyłka jest wyjątkiem od reguły `onPointerDown`: pojedyncze dotknięcie ma wysłać
          // i schować klawiaturę, więc zabieramy jej fokus celowo.
          onClick={() => void wyslij()}
          disabled={!tresc.trim() || wysylam}
          aria-label={edytowana ? t("zapisz") : t("wyslij")}
          title={edytowana ? t("zapisz") : t("wyslij")}
          className="flex items-center justify-center rounded"
          style={{
            width: 44, height: 44, flexShrink: 0, border: "none", cursor: tresc.trim() ? "pointer" : "default",
            background: tresc.trim() ? "var(--accent-green)" : "var(--bg-elevated)",
            color: tresc.trim() ? "var(--on-accent, #fff)" : "var(--text-muted)",
          }}
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
