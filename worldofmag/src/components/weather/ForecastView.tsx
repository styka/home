"use client";

import { wmo, type Forecast } from "@/lib/weather/openMeteo";

const PL_DAYS = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];

function weekday(dateIso: string): string {
  return PL_DAYS[new Date(dateIso + "T12:00:00").getDay()];
}

export function ForecastView({ forecast }: { forecast: Forecast }) {
  const now = Date.now();
  const nextHours = forecast.hourly.filter((h) => new Date(h.time).getTime() >= now).slice(0, 24);
  const cur = forecast.current;
  const today = forecast.daily[0];

  return (
    <div className="space-y-5">
      {/* Teraz */}
      {cur && (
        <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <span className="text-5xl">{wmo(cur.code).emoji}</span>
          <div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{Math.round(cur.temp)}°C</div>
            <div className="text-sm text-[var(--text-secondary)]">
              {wmo(cur.code).label} · odczuwalna {Math.round(cur.apparent)}°C · wiatr{" "}
              {Math.round(cur.windKph)} km/h
            </div>
            {today && (
              <div className="text-xs text-[var(--text-muted)]">
                Dziś {Math.round(today.tMin)}–{Math.round(today.tMax)}°C · opady{" "}
                {today.precipProbMax}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Godzinowo */}
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
              <span className="text-xl">{wmo(h.code).emoji}</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {Math.round(h.temp)}°
              </span>
              <span className="text-[10px] text-[var(--accent-blue)]">{h.precipProb}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7 dni */}
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
    </div>
  );
}
