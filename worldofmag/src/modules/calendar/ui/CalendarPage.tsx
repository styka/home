"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback, useTransition } from "react";
import { useViewState } from "@/hooks/useViewState";
import { text, type RawParams } from "@/platform/viewState/viewState";
import Link from "next/link";
import { dodajPozycjeDoZadan } from "../actions/doZadan";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ListTodo, Check } from "lucide-react";
import { EmptyState } from "@/components/ui/home";
import { ModuleView } from "@/components/ui/view";
import { getCalendarEvents } from "@/actions/calendarAgenda";
import type { DzienPrognozyKalendarza } from "@/modules/weather/contract";
import { isoDay, MODULE_META, type CalendarEvent, type CalendarModule } from "../lib";

const MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

interface Props {
  initialYear: number;
  initialMonth0: number;
  initialEvents: CalendarEvent[];
  /** 115 (Z-INT-15): prognoza z Pogody do komórek siatki (≤7 najbliższych dni; pusta = brak paska). */
  prognoza?: DzienPrognozyKalendarza[];
  /**
   * 043: parametry adresu z serwera. Zastąpiły prop `initialModule` — filtr `?module=` czyta
   * i waliduje teraz `useViewState` po stronie klienta, więc serwer nie musi go liczyć drugi raz.
   */
  viewParams?: RawParams;
}

export function CalendarPage({ initialYear, initialMonth0, initialEvents, prognoza = [], viewParams = {} }: Props) {
  const t = useTranslations("modules.calendar.CalendarPage");
  const [year, setYear] = useState(initialYear);
  const [month0, setMonth0] = useState(initialMonth0);
  // 115 (Z-INT-01): pozycje już zamienione na zadanie w tej sesji — przycisk zmienia się w ✓.
  const [dodaneDoZadan, setDodaneDoZadan] = useState<Set<string>>(new Set());
  const [bladDoZadan, setBladDoZadan] = useState<string | null>(null);
  async function doZadan(ev: { id: string; title: string; date: string; at: string | null; href: string; module: CalendarModule }) {
    try {
      await dodajPozycjeDoZadan({ title: ev.title, date: ev.date, at: ev.at, href: ev.href, moduleLabel: MODULE_META[ev.module].label });
      setDodaneDoZadan((prev) => new Set(prev).add(ev.id));
      setBladDoZadan(null);
    } catch (e) {
      setBladDoZadan(e instanceof Error ? e.message : t("doZadanBlad"));
      setTimeout(() => setBladDoZadan(null), 5000);
    }
  }
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selected, setSelected] = useState<string>(isoDay(new Date()));
  // 043: filtr modułu w adresie. Reużywamy ISTNIEJĄCEGO parametru `module` (wejście z linku
  // `/calendar?module=pets`), zamiast dokładać drugi o tym samym znaczeniu. Pusty tekst = brak
  // filtra, więc adres bez parametru zostaje adresem bez parametru (AC-8).
  const viewSpec = useMemo(() => ({ module: text("") }), []);
  const [view, setView] = useViewState(viewSpec, viewParams);
  const filter: CalendarModule | null = view.module in MODULE_META ? (view.module as CalendarModule) : null;
  const setFilter = useCallback((value: CalendarModule | null) => setView({ module: value ?? "" }), [setView]);
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

  // P4: filtr po module (klik w legendę). Wszystkie moduły obecne w miesiącu (do legendy).
  const allModules = Array.from(new Set(events.map((e) => e.module)));
  const shown = filter ? events.filter((e) => e.module === filter) : events;

  // Mapa dzień → zdarzenia (po filtrze).
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of shown) {
    const arr = byDay.get(e.date) ?? [];
    arr.push(e);
    byDay.set(e.date, arr);
  }

  const cells = buildGrid(year, month0);
  const todayKey = isoDay(new Date());
  // 115 (Z-INT-15): prognoza per dzień — mapa zamiast szukania w tablicy przy każdej komórce.
  const prognozaByDay = useMemo(() => new Map(prognoza.map((d) => [d.date, d])), [prognoza]);
  const selectedEvents = byDay.get(selected) ?? [];
  const activeModules = allModules;

  return (
    <ModuleView
      width="narrow"
      state="ready"
      icon={<CalendarIcon size={22} />}
      iconColor="var(--accent-purple)"
      title="Kalendarz"
      subtitle="Terminy ze wszystkich modułów w jednym miejscu"
      headerAction={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => go(-1)} style={navBtn} aria-label={t("poprzedniMiesiac")}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", minWidth: 130, textAlign: "center" }}>
            {MONTHS[month0]} {year}
          </span>
          <button onClick={() => go(1)} style={navBtn} aria-label={t("nastepnyMiesiac")}><ChevronRight size={16} /></button>
        </div>
      }
    >

      {/* Legenda modułów obecnych w miesiącu — klik filtruje (P4) */}
      {activeModules.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {activeModules.map((m) => {
            const active = filter === m;
            return (
              <button
                key={m}
                onClick={() => setFilter(active ? null : (m as CalendarModule))}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 9px", borderRadius: 99, cursor: "pointer",
                  border: `1px solid ${active ? MODULE_META[m as CalendarModule].accent : "var(--border)"}`,
                  background: active ? "color-mix(in srgb, " + MODULE_META[m as CalendarModule].accent + " 14%, var(--bg-surface))" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 99, background: MODULE_META[m as CalendarModule].accent }} />
                {MODULE_META[m as CalendarModule].label}
              </button>
            );
          })}
          {filter && (
            <button onClick={() => setFilter(null)} style={{ fontSize: 11, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer" }}>
              {t("pokazWszystkie")}
            </button>
          )}
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
                <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--accent-purple)" : "var(--text-secondary)", display: "flex", alignItems: "baseline", gap: 4 }}>
                  {cell.getDate()}
                  {prognozaByDay.has(key) && (
                    <span title={prognozaByDay.get(key)!.opis} style={{ fontSize: 9, fontWeight: 400, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {prognozaByDay.get(key)!.emoji} {Math.round(prognozaByDay.get(key)!.tMax)}°
                    </span>
                  )}
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
        {bladDoZadan && <div role="status" style={{ fontSize: 12, color: "var(--accent-red)", marginBottom: 8 }}>{bladDoZadan}</div>}
        {selectedEvents.length === 0 ? (
          <EmptyState icon={<CalendarIcon size={26} />} message="Brak zaplanowanych zdarzeń tego dnia" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedEvents.map((ev) => (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                }}
              >
                <span style={{ width: 4, alignSelf: "stretch", borderRadius: 99, background: ev.accent, flexShrink: 0 }} />
                <Link href={ev.href} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{ev.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {MODULE_META[ev.module].label}
                    {ev.at && ` · ${new Date(ev.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                </Link>
                {/* 115 (Z-INT-01): dowolna pozycja agendy → zadanie z terminem i odnośnikiem. */}
                <button
                  onClick={() => doZadan(ev)}
                  disabled={dodaneDoZadan.has(ev.id)}
                  title={t("doZadan")}
                  aria-label={t("doZadan")}
                  style={{ padding: 8, borderRadius: 8, border: "none", background: "none", color: dodaneDoZadan.has(ev.id) ? "var(--accent-green)" : "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}
                >
                  {dodaneDoZadan.has(ev.id) ? <Check size={15} /> : <ListTodo size={15} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleView>
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
