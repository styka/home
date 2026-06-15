# Rozdział 33 — Kalendarz (Calendar)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/calendar.ts` (`getCalendarEvents`) + `src/lib/calendar.ts` — **read-only
  agregator** odpytujący równolegle wiele modułów: zadania (terminy), posiłki, leki+opieka zdrowotna,
  opieka nad zwierzętami, powtórki SRS, serwis floty.
- **UI:** siatka miesiąca `/calendar` z **filtrem modułu** (klikalna legenda + `?module=`).

## Mocne strony

- **Zunifikowana agenda** z całego systemu w jednym widoku — realizacja obietnicy „wszystko w jednym”.
- **Agregator równoległy** (`Promise.all`) — czysty wzorzec, świadoma decyzja architektoniczna (brak
  osobnego modelu zdarzeń).

## Głos Zespołu A — Strażnicy

**Marek (DBA):** „Agregator skanuje **pełne zbiory per moduł** na każde otwarcie miesiąca — N zapytań,
potencjalne N+1. Przy skali: indeksy po datach (Z-031), cache (Z-072), eliminacja N+1 (Z-073).”

**Joanna (UX):** „Brak **tworzenia zdarzeń** w kalendarzu — jest tylko odczyt z modułów. Dla wielu
użytkowników kalendarz to miejsce, gdzie się *dodaje* terminy. To luka oczekiwań.”

## Głos Zespołu B — Pionierzy

**Marek (użytkownik, 29):** „Najważniejsze: **dwukierunkowy Google Calendar** (Rozdz. 13) i **eksport
iCal**. Bez tego trzymam terminy w Google, nie u was.”

**Ola (UX):** „Widoki tydzień/dzień + przeciąganie zdarzeń — to by zrównało nas z dedykowanymi
kalendarzami.”

## Punkty sporne

- **Kalendarz: agregator vs pełny kalendarz.** **Konsensus:** zostaje agregatorem (siła „wszystko w
  jednym”), ale dodać **iCal/Google** (Z-150/Z-151) i ewentualnie szybkie dodawanie zdarzenia ad-hoc.

## Głos użytkowników

**Agnieszka (38):** „Terminy rodziny w jednym kalendarzu widocznym w telefonie.” → iCal/Google.

## Konsensus i zalecenia

- **Z-380** *(P1 · S)* — **Eksport iCal** (Z-150) — kalendarz Omnia w telefonie/Google/Apple.
- **Z-381** *(P1 · M)* — **Odczyt Google Calendar do agendy** (Z-151) — wydarzenia Google obok danych Omnia.
- **Z-382** *(P1 · S)* — **Cache + indeksy dat + eliminacja N+1** w agregatorze (Z-072/Z-031/Z-073).
- **Z-383** *(P2 · M)* — **Szybkie dodawanie zdarzenia ad-hoc** + widoki tydzień/dzień.

## Dobre vs złe praktyki

**Dobre:** zunifikowana agenda, agregator równoległy, filtr modułu.
**Złe / do poprawy:** skanowanie pełnych zbiorów bez cache; brak tworzenia zdarzeń i integracji Google/iCal.
