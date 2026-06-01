"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CloudSun,
  MapPin,
  Plus,
  Loader2,
  Sparkles,
  LocateFixed,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { FALLBACK_LOCATION } from "@/lib/weather/presets";
import type { Forecast } from "@/lib/weather/openMeteo";
import { ForecastView } from "./ForecastView";
import { WatchersPanel } from "./WatchersPanel";
import {
  getWeather,
  describeDay,
  addLocationByName,
  setDefaultLocation,
  deleteLocation,
  type LocationDTO,
  type WatcherDTO,
} from "@/actions/weather";

interface Coords {
  lat: number;
  lon: number;
  label: string;
}

export function WeatherPage({
  locations,
  watchers,
}: {
  locations: LocationDTO[];
  watchers: WatcherDTO[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [, startTransition] = useTransition();

  // Ustal startową lokalizację: zapisana domyślna → geolokalizacja przeglądarki → Warszawa.
  useEffect(() => {
    const def = locations.find((l) => l.isDefault) ?? locations[0];
    if (def) {
      setCoords({ lat: def.lat, lon: def.lon, label: def.label });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            label: "Moja lokalizacja",
          }),
        () => setCoords({ ...FALLBACK_LOCATION }),
        { timeout: 8000 }
      );
    } else {
      setCoords({ ...FALLBACK_LOCATION });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadForecast = useCallback(
    (c: Coords) => {
      setLoading(true);
      setAiText(null);
      getWeather(c.lat, c.lon)
        .then(setForecast)
        .catch((e) => {
          showToast(e.message ?? "Nie udało się pobrać prognozy", "error");
          setForecast(null);
        })
        .finally(() => setLoading(false));
    },
    [showToast]
  );

  useEffect(() => {
    if (coords) loadForecast(coords);
  }, [coords, loadForecast]);

  function generateAdvice() {
    if (!coords) return;
    setAiLoading(true);
    describeDay(coords.lat, coords.lon, coords.label)
      .then(setAiText)
      .catch((e) => showToast(e.message ?? "AI niedostępne", "error"))
      .finally(() => setAiLoading(false));
  }

  function useGeolocation() {
    if (!navigator.geolocation) {
      showToast("Geolokalizacja niedostępna", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Moja lokalizacja" }),
      () => showToast("Nie udało się ustalić lokalizacji", "error"),
      { timeout: 8000 }
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
          <CloudSun size={22} className="text-[var(--accent-amber)]" /> Pogoda
        </h1>
        <button
          onClick={() => setShowLocations(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <MapPin size={15} className="text-[var(--accent-blue)]" />
          {coords?.label ?? "Lokalizacja"}
        </button>
      </div>

      {loading || !forecast ? (
        <div className="flex flex-col items-center gap-2 py-16 text-[var(--text-muted)]">
          {loading ? <Loader2 className="animate-spin" /> : <CloudSun />}
          <span className="text-sm">{loading ? "Pobieram prognozę…" : "Brak danych pogodowych."}</span>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {/* Porada AI */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                  <Sparkles size={15} className="text-[var(--accent-purple)]" /> Co dziś robić?
                </h3>
                {!aiText && (
                  <Button size="sm" variant="secondary" onClick={generateAdvice} disabled={aiLoading}>
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : "Wygeneruj poradę"}
                  </Button>
                )}
              </div>
              {aiLoading && !aiText ? (
                <p className="text-sm text-[var(--text-muted)]">Analizuję prognozę godzinową…</p>
              ) : aiText ? (
                <>
                  <style>{MARKDOWN_STYLES}</style>
                  <div
                    className="markdown-body text-sm text-[var(--text-secondary)]"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(aiText) }}
                  />
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  Wygeneruj spersonalizowaną poradę na podstawie prognozy godzinowej i lokalizacji.
                </p>
              )}
            </div>

            <ForecastView forecast={forecast} />
          </div>

          <WatchersPanel watchers={watchers} coords={coords} />
        </div>
      )}

      {showLocations && (
        <LocationsModal
          locations={locations}
          onClose={() => setShowLocations(false)}
          onUseGeo={() => {
            useGeolocation();
            setShowLocations(false);
          }}
          onPick={(l) => {
            setCoords({ lat: l.lat, lon: l.lon, label: l.label });
            setShowLocations(false);
          }}
          run={(fn, ok) =>
            startTransition(async () => {
              try {
                await fn();
                if (ok) showToast(ok, "success");
                router.refresh();
              } catch (e: any) {
                showToast(e.message ?? "Błąd", "error");
              }
            })
          }
        />
      )}
    </div>
  );
}

function LocationsModal({
  locations,
  onClose,
  onUseGeo,
  onPick,
  run,
}: {
  locations: LocationDTO[];
  onClose: () => void;
  onUseGeo: () => void;
  onPick: (l: LocationDTO) => void;
  run: (fn: () => Promise<void>, ok?: string) => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  function add() {
    if (!name.trim()) return;
    setBusy(true);
    addLocationByName(name.trim())
      .then(() => {
        setName("");
        showToast("Dodano lokalizację", "success");
        run(async () => {});
      })
      .catch((e) => showToast(e.message ?? "Nie znaleziono", "error"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-primary)]">Lokalizacje</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        <button
          onClick={onUseGeo}
          className="mb-3 flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <LocateFixed size={15} className="text-[var(--accent-blue)]" /> Użyj mojej lokalizacji (GPS)
        </button>

        <div className="mb-3 space-y-1">
          {locations.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--bg-hover)]"
            >
              <button onClick={() => onPick(l)} className="flex flex-1 items-center gap-2 text-left">
                <MapPin size={14} className="text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-primary)]">{l.label}</span>
                {l.isDefault && <Star size={12} className="text-[var(--accent-amber)]" />}
              </button>
              {!l.isDefault && (
                <button
                  onClick={() => run(() => setDefaultLocation(l.id), "Ustawiono domyślną")}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-amber)]"
                  title="Ustaw jako domyślną"
                >
                  <Star size={13} />
                </button>
              )}
              <button
                onClick={() => run(() => deleteLocation(l.id))}
                className="text-[var(--text-muted)] hover:text-[var(--accent-red)]"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {locations.length === 0 && (
            <p className="px-2 py-2 text-xs text-[var(--text-muted)]">
              Brak zapisanych lokalizacji. Dodaj miasto poniżej lub użyj GPS.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Dodaj miasto (np. Kraków)"
            className="flex-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <Button size="sm" onClick={add} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
