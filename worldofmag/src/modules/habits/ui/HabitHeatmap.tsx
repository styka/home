"use client";

import { useMemo } from "react";
import { isoDate, isScheduledOn, startOfWeek } from "@/lib/habitStats";

const WEEKDAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

interface HabitHeatmapProps {
  entryDates: string[];
  color: string;
  daysOfWeek: string | null;
  /** Liczba tygodni wstecz do pokazania. */
  weeks?: number;
}

/** Kalendarz wykonań w stylu „GitHub contributions" — kolumny=tygodnie, wiersze=dni (pn..nd). */
export function HabitHeatmap({ entryDates, color, daysOfWeek, weeks = 26 }: HabitHeatmapProps) {
  const done = useMemo(() => new Set(entryDates), [entryDates]);
  const todayStr = isoDate(new Date());

  // Siatka: zaczynamy od poniedziałku tygodnia sprzed `weeks-1` tygodni.
  const columns = useMemo(() => {
    const firstMonday = startOfWeek(new Date());
    firstMonday.setDate(firstMonday.getDate() - (weeks - 1) * 7);
    const cols: { monthLabel: string | null; cells: { date: string; future: boolean; scheduled: boolean; doneIt: boolean }[] }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const cells: { date: string; future: boolean; scheduled: boolean; doneIt: boolean }[] = [];
      let monthLabel: string | null = null;
      for (let d = 0; d < 7; d++) {
        const day = new Date(firstMonday);
        day.setDate(firstMonday.getDate() + w * 7 + d);
        const ds = isoDate(day);
        if (d === 0) {
          const m = day.getMonth();
          if (m !== lastMonth) {
            monthLabel = MONTHS[m];
            lastMonth = m;
          }
        }
        cells.push({
          date: ds,
          future: ds > todayStr,
          scheduled: isScheduledOn(daysOfWeek, day),
          doneIt: done.has(ds),
        });
      }
      cols.push({ monthLabel, cells });
    }
    return cols;
  }, [weeks, daysOfWeek, done, todayStr]);

  const cell = 13;
  const gap = 3;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
        {/* Etykiety miesięcy */}
        <div style={{ display: "flex", gap, marginLeft: 22 }}>
          {columns.map((col, i) => (
            <div key={i} style={{ width: cell, fontSize: 9, color: "var(--text-muted)", height: 11, lineHeight: "11px", overflow: "visible", whiteSpace: "nowrap" }}>
              {col.monthLabel ?? ""}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap }}>
          {/* Etykiety dni tygodnia */}
          <div style={{ display: "flex", flexDirection: "column", gap, marginRight: 4 }}>
            {WEEKDAY_LABELS.map((lbl, i) => (
              <div key={i} style={{ height: cell, width: 16, fontSize: 8, color: "var(--text-muted)", lineHeight: `${cell}px`, textAlign: "right" }}>
                {i % 2 === 0 ? lbl : ""}
              </div>
            ))}
          </div>
          {/* Kolumny tygodni */}
          {columns.map((col, ci) => (
            <div key={ci} style={{ display: "flex", flexDirection: "column", gap }}>
              {col.cells.map((c, di) => {
                let bg = "var(--bg-elevated)";
                let border = "1px solid var(--border)";
                let opacity = 1;
                if (c.future) {
                  opacity = 0.25;
                } else if (c.doneIt) {
                  bg = color;
                  border = `1px solid ${color}`;
                } else if (c.scheduled) {
                  bg = "var(--bg-base)";
                } else {
                  // niezaplanowany dzień — bardzo subtelny
                  bg = "transparent";
                  border = "1px solid var(--bg-elevated)";
                }
                return (
                  <div
                    key={di}
                    title={`${c.date}${c.doneIt ? " · zrobione" : c.scheduled && !c.future ? " · pominięte" : ""}`}
                    style={{ width: cell, height: cell, borderRadius: 3, background: bg, border, opacity }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
