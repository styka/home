"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

/**
 * 037: wybór lokalizacji pogody przez wskazanie punktu na mapie.
 *
 * Dlaczego w ogóle: wyszukiwarka nazw nie zna części małych wsi, a geolokalizacja urządzenia bywa
 * niedostępna albo odmówiona — bez mapy takie miejsce jest dla modułu nieosiągalne.
 *
 * Dlaczego goły `leaflet`, a nie `react-leaflet`: potrzebujemy jednego prostego widoku z jednym
 * znacznikiem. Warstwa reactowa dołożyłaby drugą zależność i własny cykl życia komponentów, nie
 * dając tu nic (C-53).
 *
 * Komponent MUSI być ładowany przez `next/dynamic` z `ssr:false` — Leaflet dotyka `window` już przy
 * imporcie modułu.
 */

/** Wysokość mapy: na telefonie 60% ekranu, ale nigdy więcej niż 420 px na dużym monitorze. */
const MAP_HEIGHT = "min(60vh, 420px)";

export interface MapPoint {
  lat: number;
  lon: number;
}

export function LocationMapPicker({
  initial,
  busy,
  onSave,
}: {
  /** Punkt startowy — bieżąca lokalizacja użytkownika, żeby od razu widział, gdzie jest. */
  initial: MapPoint | null;
  busy?: boolean;
  onSave: (point: MapPoint) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [point, setPoint] = useState<MapPoint | null>(initial);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;
    let cancelled = false;

    // Import dynamiczny także wewnątrz efektu: nawet z `ssr:false` chcemy, żeby paczka mapy
    // dociągała się dopiero, gdy modal faktycznie się otworzy — a nie przy wejściu na /pogoda.
    void import("leaflet").then((mod) => {
      if (cancelled || !hostRef.current) return;
      const L = mod.default ?? mod;

      const start = initial ?? { lat: 52.2297, lon: 21.0122 };
      const map = L.map(host, {
        center: [start.lat, start.lon],
        zoom: initial ? 11 : 6,
        // Kółko myszy zostaje przy przewijaniu STRONY. Mapa w modalu, która porywa scroll, jest
        // na telefonie i touchpadzie wprost wrogo nieprzewidywalna.
        scrollWheelZoom: false,
        touchZoom: true,
        attributionControl: true,
      });

      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      });
      tiles.on("tileerror", () => setTilesFailed(true));
      tiles.addTo(map);

      // Znacznik jako `divIcon`, NIE domyślny `L.Icon`: domyślne ikony Leafletu wskazują na pliki
      // PNG spod `leaflet/dist/images`, których bundler Next nie przepisuje — kończy się to 404 i
      // niewidocznym znacznikiem. Własny HTML dodatkowo bierze kolor ze zmiennej skórki (C-30).
      const icon = L.divIcon({
        className: "",
        html:
          '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;' +
          "transform:rotate(-45deg);background:var(--accent-blue);" +
          'border:2px solid var(--on-accent);box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      });

      const marker = L.marker([start.lat, start.lon], { icon, keyboard: false }).addTo(map);
      markerRef.current = marker;

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const next = { lat: e.latlng.lat, lon: e.latlng.lng };
        marker.setLatLng([next.lat, next.lon]);
        setPoint(next);
      });

      mapRef.current = map;
      setReady(true);
      // Modal animuje wejście, więc kontener potrafi mieć w chwili montażu zerowy rozmiar —
      // bez tego mapa renderuje się jako szary prostokąt do pierwszego przesunięcia.
      setTimeout(() => map.invalidateSize(), 60);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div
        ref={hostRef}
        role="application"
        aria-label="Mapa wyboru lokalizacji"
        style={{
          height: MAP_HEIGHT,
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      />

      {!ready && (
        <p className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Loader2 size={13} className="animate-spin" /> Wczytuję mapę…
        </p>
      )}

      {tilesFailed && (
        <p className="mt-2 text-xs text-[var(--accent-amber)]">
          Nie udało się wczytać mapy. Wskaż lokalizację po nazwie lub przez GPS.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-muted)]">
          {point
            ? `Wybrany punkt: ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`
            : "Dotknij mapy, aby wskazać punkt."}
        </span>
        <Button
          size="sm"
          className="py-3"
          disabled={!point || busy}
          onClick={() => point && onSave(point)}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          Zapisz tę lokalizację
        </Button>
      </div>
    </div>
  );
}
