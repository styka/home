"use client";

import { wmo, type Forecast } from "@/lib/weather/openMeteo";
import { moonPhase } from "@/lib/weather/moon";

const PL_DAYS = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];

function weekday(dateIso: string): string {
  return PL_DAYS[new Date(dateIso + "T12:00:00").getDay()];
}

/**
 * 037: prognoza jest rozbita na trzy NIEZALEŻNE sekcje, bo strona Pogody przeplata je kaflem
 * „Co robić?" (Teraz → Co robić? → Najbliższe godziny → Najbliższe dni). Wcześniej wszystkie trzy
 * siedziały w jednym komponencie, więc nie dało się wsunąć niczego pomiędzy nie.
 */

/** „Teraz" — bieżące warunki + jednolinijkowe podsumowanie dnia. */
export function ForecastNow({ forecast }: { forecast: Forecast }) {
  const cur = forecast.current;
  const today = forecast.daily[0];
  if (!cur) return null;

  // 038: `isDay` było pobierane, ale nieużywane — stąd słońce po zmroku.
  const meta = wmo(cur.code, !cur.isDay);
  const moon = moonPhase();

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-center gap-4">
        <span className="text-5xl">{meta.emoji}</span>
        <div className="min-w-0">
          <div className="text-3xl font-bold text-[var(--text-primary)]">{Math.round(cur.temp)}°C</div>
          <div className="text-sm text-[var(--text-secondary)]">
            {meta.label} · odczuwalna {Math.round(cur.apparent)}°C · wiatr {Math.round(cur.windKph)} km/h
          </div>
          {today && (
            <div className="text-xs text-[var(--text-muted)]">
              Dziś {Math.round(today.tMin)}–{Math.round(today.tMax)}°C · opady {today.precipProbMax}%
            </div>
          )}
        </div>
      </div>

      {/* 038: wschód/zachód i faza księżyca. Zawija się na wąskim ekranie zamiast wymuszać
          przewijanie w poziomie (C-31). */}
      {today && (today.sunrise || today.sunset) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-secondary)]">
          {today.sunrise && (
            <span className="whitespace-nowrap" title="Wschód słońca">
              🌅 {hhmm(today.sunrise)}
            </span>
          )}
          {today.sunset && (
            <span className="whitespace-nowrap" title="Zachód słońca">
              🌇 {hhmm(today.sunset)}
            </span>
          )}
          <span className="whitespace-nowrap" title="Faza księżyca">
            {moon.emoji} {moon.name}
          </span>
        </div>
      )}
    </div>
  );
}

/** „2026-07-31T20:15" → „20:15". Open-Meteo zwraca czas lokalny lokalizacji, więc bez przeliczeń. */
function hhmm(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : iso;
}

/** „Najbliższe godziny" — poziomy pasek najbliższych 24 godzin. */
export function ForecastHours({ forecast }: { forecast: Forecast }) {
  const now = Date.now();
  const nextHours = forecast.hourly.filter((h) => new Date(h.time).getTime() >= now).slice(0, 24);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Najbliższe godziny
      </h3>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-2">
        {nextHours.map((h) => (
          <div
            key={h.time}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-2 text-center"
          >
            <span className="text-xs text-[var(--text-muted)]">{h.time.slice(11, 16)}</span>
            <span className="text-xl">{wmo(h.code, !h.isDay).emoji}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {Math.round(h.temp)}°
            </span>
            <span className="text-[10px] text-[var(--accent-blue)]">{h.precipProb}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** „Najbliższe dni" — tabela prognozy 7-dniowej. */
export function ForecastDays({ forecast }: { forecast: Forecast }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Najbliższe dni
      </h3>
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        {forecast.daily.map((d, i) => (
          <div
            key={d.date}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
              i % 2 ? "bg-[var(--bg-surface)]" : "bg-[var(--bg-base)]"
            }`}
          >
            <span className="w-12 font-medium text-[var(--text-primary)]">{weekday(d.date)}</span>
            <span className="text-xl">{wmo(d.code).emoji}</span>
            <span className="hidden flex-1 text-[var(--text-secondary)] sm:block">
              {wmo(d.code).label}
            </span>
            <span className="text-[var(--accent-blue)]">{d.precipProbMax}%</span>
            <span className="text-[var(--text-muted)]">{Math.round(d.windMaxKph)} km/h</span>
            <span className="w-20 text-right text-[var(--text-primary)]">
              {Math.round(d.tMin)}° / {Math.round(d.tMax)}°
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
