import { test } from "node:test";
import assert from "node:assert/strict";
import { buildICalendar, escapeICalText, toICalUtc, toICalDate } from "@/lib/calendar/ical";
import type { CalendarEvent } from "@/lib/calendar";

const STAMP = "2026-06-23T09:00:00.000Z";

function ev(over: Partial<CalendarEvent>): CalendarEvent {
  return { id: "x", module: "tasks", title: "T", date: "2026-06-23", at: null, href: "/", accent: "", ...over };
}

test("toICalUtc: ISO → kompaktowy UTC bez milisekund", () => {
  assert.equal(toICalUtc("2026-06-23T14:05:00.000Z"), "20260623T140500Z");
});

test("toICalDate: dzień → YYYYMMDD", () => {
  assert.equal(toICalDate("2026-06-23"), "20260623");
});

test("escapeICalText: przecinek, średnik, backslash, nowa linia", () => {
  assert.equal(escapeICalText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
});

test("zdarzenie z godziną → DTSTART UTC + DURATION", () => {
  const ics = buildICalendar([ev({ id: "task-1", title: "Spotkanie", at: "2026-06-23T14:00:00.000Z" })], { dtstamp: STAMP });
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /UID:task-1@worldofmag/);
  assert.match(ics, /DTSTART:20260623T140000Z/);
  assert.match(ics, /DURATION:PT30M/);
  assert.match(ics, /SUMMARY:Spotkanie/);
  assert.match(ics, /DTSTAMP:20260623T090000Z/);
});

test("zdarzenie bez godziny → całodniowe VALUE=DATE", () => {
  const ics = buildICalendar([ev({ id: "meal-1", title: "Obiad", at: null, date: "2026-06-24" })], { dtstamp: STAMP });
  assert.match(ics, /DTSTART;VALUE=DATE:20260624/);
  assert.doesNotMatch(ics, /DURATION/);
});

test("struktura: VCALENDAR opakowuje, liczba VEVENT = liczba zdarzeń, CRLF", () => {
  const ics = buildICalendar([ev({ id: "a" }), ev({ id: "b" })], { dtstamp: STAMP, name: "Mój kalendarz" });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /X-WR-CALNAME:Mój kalendarz/);
  assert.ok(ics.includes("\r\n"));
});

test("SUMMARY z przecinkiem jest zescapowane (nie rozbija pola)", () => {
  const ics = buildICalendar([ev({ title: "Mleko, chleb; masło" })], { dtstamp: STAMP });
  assert.match(ics, /SUMMARY:Mleko\\, chleb\\; masło/);
});
