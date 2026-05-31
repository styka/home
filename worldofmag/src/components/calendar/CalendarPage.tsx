"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle } from "@/components/ui/home";
import { getCalendarEvents } from "@/actions/calendar";
import { isoDay, MODULE_META, type CalendarEvent, type CalendarModule } from "@/lib/calendar";

const MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

interface Props {
  initialYear: number;
  initialMonth0: number;
  initialEvents: CalendarEvent[];
}

export function CalendarPage({ initialYear, initialMonth0, initialEvents }: Props) {
  const [year, setYear] = useState(initialYear);
  const [month0, setMonth0] = useState(initialMonth0);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selected, setSelected] = useState<string>(isoDay(new Date()));
  const [pending, startTransition] = useTransition();

  function go(deltaMonths: number) {
    const d = new Date(year, month0 + deltaMonths, 1);
    const ny = d.getFullYear();
    const nm = d.getMonth();
    setYear(ny);
    setMonth0(nm);
    startTransition(async () => {
      setEvents(await getCalendarEvents(ny, nm));
    });
  }

  // Mapa dzień → zdarzenia.
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const arr = byDay.get(e.date) ?? [];
    arr.push(e);
    byDay.set(e.date, arr);
  }

  const cells = buildGrid(year, month0);
  const todayKey = isoDay(new Date());
  const selectedEvents = byDay.get(selected) ?? [];
  const activeModules = Array.from(new Set(events.map((e) => e.module)));

  return (
    <div style={pageContainerStyle}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <PageHeader
          icon={<CalendarIcon size={22} />}
          iconColor="var(--accent-purple)"
          title="Kalendarz"
          subtitle="Terminy ze wszystkich modułów w jednym miejscu"
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => go(-1)} style={navBtn} aria-label="Poprzedni miesiąc"><ChevronLeft size={16} /></button>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", minWidth: 130, textAlign: "center" }}>
                {MONTHS[month0]} {year}
              </span>
              <button onClick={() => go(1)} style={navBtn} aria-label="Następny miesiąc"><ChevronRight size={16} /></button>
            </div>
          }
        />

        {/* Legenda modułów obecnych w miesiącu */}
        {activeModules.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {activeModules.map((m) => (
              <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: MODULE_META[m as CalendarModule].accent }} />
                {MODULE_META[m as CalendarModule].label}
              </span>
            ))}
          </div>
        )}

        {/* Siatka miesiąca */}
        <div style={{ opacity: pending ? 0.6 : 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "2px 0" }}>{w}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((cell, i) => {
              if (!cell) return <div key={`e${i}`} />;
              const key = isoDay(cell);
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = key === selected;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  style={{
                    minHeight: 64,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    padding: 6,
                    borderRadius: 8,
                    border: `1px solid ${isSelected ? "var(--accent-purple)" : "var(--border)"}`,
                    background: isToday ? "color-mix(in srgb, var(--accent-purple) 10%, var(--bg-surface))" : "var(--bg-surface)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--accent-purple)" : "var(--text-secondary)" }}>
                    {cell.getDate()}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    {dayEvents.slice(0, 4).map((ev) => (
                      <span key={ev.id} style={{ width: 6, height: 6, borderRadius: 99, background: ev.accent }} />
                    ))}
                    {dayEvents.length > 4 && <span style={{ fontSize: 9, color: "var(--text-muted)" }}>+{dayEvents.length - 4}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista wybranego dnia */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
            {formatDayHeading(selected)}
          </div>
          {selectedEvents.length === 0 ? (
            <EmptyState icon={<CalendarIcon size={26} />} message="Brak zaplanowanych zdarzeń tego dnia" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={ev.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ width: 4, alignSelf: "stretch", borderRadius: 99, background: ev.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{ev.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {MODULE_META[ev.module].label}
                      {ev.at && ` · ${new Date(ev.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

/** Siatka 6×7 z poniedziałkiem jako pierwszym dniem; null = pole spoza miesiąca. */
function buildGrid(year: number, month0: number): (Date | null)[] {
  const first = new Date(year, month0, 1);
  // getDay(): 0=niedz..6=sob → przesunięcie tak, by Pn=0.
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month0, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatDayHeading(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
