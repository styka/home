"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { CloudSun, MapPin, Plus, Loader2, LocateFixed, Star, Trash2, Map, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ModuleView } from "@/components/ui/view";
import { cn } from "@/lib/cn";
import { FALLBACK_LOCATION } from "../lib/presets";
import type { Forecast } from "../lib/openMeteo";
import { ForecastNow, ForecastHours, ForecastDays } from "./ForecastView";
import { WatchersPanel } from "./WatchersPanel";
import { IdeasPanel } from "./IdeasPanel";
import {
  getWeather,
  addLocationByName,
  addLocationByPoint,
  setDefaultLocation,
  deleteLocation,
  type LocationDTO,
  type WatcherDTO,
  type WeatherPrefDTO,
} from "../actions/weather";

interface Coords {
  lat: number;
  lon: number;
  label: string;
}

export function WeatherPage({
  locations,
  watchers,
  usdPlnRate,
  canAddToTasks,
  weatherPref,
}: {
  locations: LocationDTO[];
  watchers: WatcherDTO[];
  /** Przelicznik USD→PLN dla licznika kosztu AI (ustawiany przez administratora). */
  usdPlnRate?: number;
  /** Czy pokazywać „Dodaj do zadań" — zależy od uprawnienia do modułu Zadania. */
  canAddToTasks: boolean;
  /** 082: zapamiętany układ listy obserwatorów (kolejność, grupowanie, filtr stanów). */
  weatherPref: WeatherPrefDTO;
}) {
  const t = useTranslations("modules.weather.WeatherPage");
  const router = useRouter();
  const { showToast } = useToast();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
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

  function requestGeolocation() {
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
    <ModuleView
      icon={<CloudSun size={22} />}
      iconColor="var(--accent-amber)"
      title="Pogoda"
      href="/pogoda"
      state={loading ? "loading" : !forecast || !coords ? "empty" : "ready"}
      loadingRows={3}
      empty={{
        icon: <CloudSun size={22} />,
        title: "Brak danych pogodowych",
        description: "Wskaż lokalizację, żeby pobrać prognozę.",
        action: { label: "Wybierz lokalizację", onClick: () => setShowLocations(true) },
      }}
      headerAction={
        /* 086 (AC-18): długa nazwa lokalizacji („Kocoń, województwo śląskie") przycinała TYTUŁ
           modułu. Przyczyna jest ta sama, co w 084: element `flex` ma domyślnie `min-width: auto`,
           więc NIE POTRAFI zwęzić się poniżej swojej treści i rośnie kosztem sąsiada. `min-w-0`
           odblokowuje zwężanie, a `truncate` przycina nazwę — czyli tę część, którą można przyciąć
           bez straty (pełna nazwa zostaje w podpowiedzi). */
        <button
          onClick={() => setShowLocations(true)}
          title={coords?.label ?? undefined}
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <MapPin size={15} className="shrink-0 text-[var(--accent-blue)]" />
          <span className="truncate">{coords?.label ?? "Lokalizacja"}</span>
        </button>
      }
    >
      <div className="mx-auto min-w-0 w-full max-w-5xl">
      {forecast && coords && (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            {/* Degradacja: Open-Meteo nie odpowiedziało, więc serwer oddał ostatnią udaną prognozę.
                Pasek mówi o tym wprost — stara prognoza bez ostrzeżenia byłaby kłamstwem. */}
            {forecast.stale && (
              <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                <TriangleAlert size={15} className="shrink-0 text-[var(--accent-amber)]" />
                <span>
                  Serwis pogodowy chwilowo nie odpowiada — pokazuję ostatnią pobraną prognozę
                  {forecast.fetchedAt
                    ? ` (z ${new Date(forecast.fetchedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })})`
                    : ""}
                  .
                </span>
              </div>
            )}

            {/* 037: kolejność sekcji wg zgłoszenia właściciela — najpierw pogoda na teraz, potem
                „Co robić?", a dopiero pod tym najbliższe godziny i prognoza tygodniowa. */}
            <ForecastNow forecast={forecast} />

            {/* 037: „Co robić?" to teraz LISTA propozycji z trwałymi szczegółami, a nie jeden
                wygenerowany akapit. Cała logika (generowanie, blokowanie, biblioteka) mieszka w
                IdeasPanel — WeatherPage odpowiada wyłącznie za układ strony. */}
            <IdeasPanel
              forecast={forecast}
              coords={coords}
              usdPlnRate={usdPlnRate}
              canAddToTasks={canAddToTasks}
            />

            <ForecastHours forecast={forecast} />
            <ForecastDays forecast={forecast} />
          </div>

          <WatchersPanel
            watchers={watchers}
            coords={coords}
            usdPlnRate={usdPlnRate}
            pref={weatherPref}
          />
        </div>
      )}

      {showLocations && (
        <LocationsModal
          locations={locations}
          current={coords}
          onClose={() => setShowLocations(false)}
          onUseGeo={() => {
            requestGeolocation();
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
    </ModuleView>
  );
}

// 037: mapa ładowana leniwie i wyłącznie po stronie klienta — Leaflet dotyka `window` już przy
// imporcie, a paczka nie ma po co obciążać pierwszego wejścia na /pogoda.
const LocationMapPicker = dynamic(
  () => import("./LocationMapPicker").then((m) => m.LocationMapPicker),
  { ssr: false, loading: () => <p className="text-xs text-[var(--text-muted)]">Wczytuję mapę…</p> }
);

function LocationsModal({
  locations,
  current,
  onClose,
  onUseGeo,
  onPick,
  run,
}: {
  locations: LocationDTO[];
  current: Coords | null;
  onClose: () => void;
  onUseGeo: () => void;
  onPick: (l: LocationDTO) => void;
  run: (fn: () => Promise<void>, ok?: string) => void;
}) {
  const t = useTranslations("modules.weather.WeatherPage");
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMap, setShowMap] = useState(false);

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

  function savePoint(p: { lat: number; lon: number }) {
    setBusy(true);
    addLocationByPoint(p.lat, p.lon)
      .then((l) => {
        showToast(`Dodano lokalizację „${l.label}"`, "success");
        // `run` odświeża dane serwerowe — bez tego nowa lokalizacja nie pojawiłaby się na liście
        // w oknie aż do przeładowania strony (props `locations` przychodzi z serwera).
        run(async () => {});
        onPick(l);
      })
      .catch((e) => showToast(e.message ?? "Nie udało się zapisać punktu", "error"))
      .finally(() => setBusy(false));
  }

  return (
    <Modal onClose={onClose} title="Lokalizacje" wide={showMap}>
      <button
        onClick={onUseGeo}
        className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
      >
        <LocateFixed size={15} className="text-[var(--accent-blue)]" /> {t("uzyjMojejLokalizacjiGps")}
      </button>

      {/* Trzecia droga obok nazwy i GPS: wskazanie punktu na mapie. Potrzebna, bo wyszukiwarka nazw
          nie zna części małych wsi, a GPS bywa niedostępny. */}
      <button
        onClick={() => setShowMap((v) => !v)}
        aria-expanded={showMap}
        className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
      >
        <Map size={15} className="text-[var(--accent-green)]" />
        {showMap ? "Ukryj mapę" : "Wskaż na mapie"}
      </button>

      {showMap && (
        <LocationMapPicker
          initial={current ? { lat: current.lat, lon: current.lon } : null}
          busy={busy}
          onSave={savePoint}
        />
      )}

      <div className="space-y-1">
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
                title={t("ustawJakoDomyslna")}
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
            {t("brakZapisanychLokalizacjiDodaj")}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("dodajMiastoNpKrakow")}
          className="flex-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <Button size="sm" onClick={add} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </Button>
      </div>
    </Modal>
  );
}
