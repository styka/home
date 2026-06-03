"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Printer, QrCode, Plus } from "lucide-react";

interface LocationOption {
  key: string;
  warehouse: string;
  location: string;
}

interface QrLabelsProps {
  locations: LocationOption[];
}

export function QrLabels({ locations }: QrLabelsProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(locations.map((l) => l.key)));
  const [customWh, setCustomWh] = useState("");
  const [customLoc, setCustomLoc] = useState("");
  const [extra, setExtra] = useState<LocationOption[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const all = useMemo(() => [...locations, ...extra], [locations, extra]);
  const chosen = useMemo(() => all.filter((l) => selected.has(l.key)), [all, selected]);

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const l of chosen) {
        const loc = [l.warehouse, l.location].filter(Boolean).join(" / ");
        const url = `${origin}/magazynowanie/szukaj?loc=${encodeURIComponent(loc)}`;
        next[l.key] = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#000000", light: "#ffffff" } });
      }
      if (!cancelled) setQrMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [chosen]);

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addCustom() {
    const wh = customWh.trim();
    const loc = customLoc.trim();
    if (!wh && !loc) return;
    const key = `custom:${wh}|${loc}`;
    if (!all.some((l) => l.key === key)) {
      setExtra((e) => [...e, { key, warehouse: wh, location: loc }]);
      setSelected((s) => new Set(s).add(key));
    }
    setCustomWh("");
    setCustomLoc("");
  }

  return (
    <div className="px-4 md:px-6 py-4 max-w-3xl mx-auto flex flex-col gap-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qr-print-sheet, #qr-print-sheet * { visibility: visible !important; }
          #qr-print-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          .qr-label { break-inside: avoid; border: 1px solid #000 !important; color: #000 !important; }
        }
      `}</style>

      <div className="no-print flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <QrCode size={20} style={{ color: "var(--accent-blue)" }} /> Etykiety QR
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Wydrukuj etykiety dla półek/pudeł. Zeskanuj telefonem, by zobaczyć zawartość danej lokalizacji.
          </p>
        </div>

        {all.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {all.map((l) => {
              const label = [l.warehouse, l.location].filter(Boolean).join(" / ") || "—";
              const active = selected.has(l.key);
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => toggle(l.key)}
                  className="px-2.5 py-1 rounded text-xs border"
                  style={{
                    borderColor: active ? "var(--accent-blue)" : "var(--border)",
                    backgroundColor: active ? "var(--accent-blue)" : "var(--bg-surface)",
                    color: active ? "#0d0d0d" : "var(--text-secondary)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Brak lokalizacji w magazynie — dodaj własną etykietę poniżej.
          </p>
        )}

        <div className="flex items-center gap-2">
          <input
            value={customWh}
            onChange={(e) => setCustomWh(e.target.value)}
            placeholder="Magazyn (np. Garaż)"
            className="flex-1 px-2.5 py-1.5 rounded border text-sm"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <input
            value={customLoc}
            onChange={(e) => setCustomLoc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="Lokalizacja (np. Regał A3)"
            className="flex-1 px-2.5 py-1.5 rounded border text-sm"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <button type="button" onClick={addCustom} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <Plus size={14} /> Dodaj
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={chosen.length === 0}
          className="self-start inline-flex items-center gap-2 px-4 py-2 rounded text-sm disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}
        >
          <Printer size={16} /> Drukuj ({chosen.length})
        </button>
      </div>

      <div id="qr-print-sheet" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {chosen.map((l) => {
          const label = [l.warehouse, l.location].filter(Boolean).join(" / ") || "—";
          return (
            <div
              key={l.key}
              className="qr-label flex flex-col items-center gap-2 p-3 rounded border bg-white"
              style={{ borderColor: "var(--border)" }}
            >
              {qrMap[l.key] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrMap[l.key]} alt={label} className="w-28 h-28" />
              ) : (
                <div className="w-28 h-28" style={{ backgroundColor: "#eee" }} />
              )}
              <div className="text-center text-xs font-medium text-black leading-tight">
                {l.warehouse ? <div className="font-semibold">{l.warehouse}</div> : null}
                {l.location ? <div>{l.location}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
