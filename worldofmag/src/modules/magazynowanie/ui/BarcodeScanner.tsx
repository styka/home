"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, CameraOff } from "lucide-react";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
  /** Etykieta pod ramką (np. „Tryb: Przyjęcie"). */
  hint?: string;
}

/**
 * Pełnoekranowy skaner kodów (1D/2D) z kamery, oparty o @zxing/browser.
 * Dekoduje ciągle; debounce identycznego kodu zostawiamy konsumentowi.
 * Bibliotekę ładujemy dynamicznie (tylko po stronie klienta, mniejszy bundle).
 */
export function BarcodeScanner({ onDetected, onClose, hint }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (cancelled) return;
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result) onDetected(result.getText());
        });
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(
          e instanceof Error && /permission|denied|notallowed/i.test(e.message)
            ? "Brak dostępu do kamery. Zezwól na kamerę w przeglądarce."
            : "Nie udało się uruchomić kamery. Wpisz kod ręcznie."
        );
      }
    })();

    return () => {
      cancelled = true;
      try {
        controls?.stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: "#000" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ color: "var(--on-accent)" }}>
        <span className="text-sm font-medium">{hint ?? "Skanuj kod"}</span>
        <button type="button" onClick={onClose} aria-label="Zamknij skaner" className="p-1">
          <X size={22} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />

        {status === "loading" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: "var(--on-accent)" }}>
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">Uruchamiam kamerę…</span>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ color: "var(--on-accent)" }}>
            <CameraOff size={28} />
            <span className="text-sm max-w-xs">{errorMsg}</span>
          </div>
        ) : null}

        {status === "ready" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-lg"
              style={{
                width: "70%",
                maxWidth: 360,
                height: 160,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                border: "2px solid rgba(255,255,255,0.9)",
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
