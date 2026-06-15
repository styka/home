# Rozdział 39 — Truck (routing ciężarowy)

## Kontekst / stan z kodu

- **Rdzeń:** `src/lib/ors.ts` (klient OpenRouteService — gotowy), `src/app/truck/` (UI **minimalny**);
  `VehicleProfile` (profil pojazdu do trasowania) współdzielony z Flotą.
- **Status (z macierzy, Rozdz. 3):** **dojrzałość 1** — klient gotowy, UI szkieletowy. Najmniej dojrzały
  „realny” moduł.

## Mocne strony

- **Klient ORS gotowy** — najtrudniejsza, integracyjna część już istnieje.
- **Wspólny `VehicleProfile`** z Flotą — fundament pod spięcie.

## Głos Zespołu A — Strażnicy

**Grzegorz (delivery):** „To **niedokończony moduł** — albo go domykamy, albo jawnie oznaczamy jako
»eksperymentalny«. Półprodukt w produkcji to dług wizerunkowy (»klikam, nic nie ma«). Decyzja
priorytetowa: dokończyć (TR1) czy ukryć do czasu.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „Truck nabiera sensu **dopiero z Flotą B2B** (V3, Rozdz. 43): trasowanie wielu
pojazdów, kierowcy, ograniczenia (masa/wysokość/ADR). Samodzielnie to nisza. Dokończmy go **jako część
branży Flota B2B**, nie osobno.”

**Damian (senior dev):** „Skoro klient gotowy, **MVP UI** (punkt A→B, profil ciężarowy, podgląd trasy)
to kilka dni — warto, by moduł przestał być pusty (TR1) i spiąć z Flotą (TR2).”

## Punkty sporne

- **Dokończyć teraz vs ukryć.** **Konsensus:** dać **minimalne, działające UI** (A→B + profil) albo
  oznaczyć „wkrótce” i ukryć — nie zostawiać pustego wejścia. Pełny rozwój = w ramach Floty B2B.

## Głos użytkowników

**Krzysztof (52):** „Trasy dla dostawczaka z ograniczeniami — tak, ale tylko jak realnie działa.”

## Konsensus i zalecenia

- **Z-440** *(P2 · M)* — **MVP UI trasowania** (TR1): punkt A→B, profil ciężarowy, podgląd trasy (klient
  ORS gotowy).
- **Z-441** *(P2 · S)* — **Spiąć Truck z Flotą** (TR2): profil pojazdu z Floty do trasowania.
- **Z-442** *(P1 · S)* — **Jawnie oznaczyć status** (eksperymentalny/„wkrótce”) do czasu MVP — nie pusty ekran.
- **Z-443** *(P2 · L)* — **Pełny rozwój w ramach Floty B2B** (V3) — wiele pojazdów, kierowcy, ograniczenia.

## Dobre vs złe praktyki

**Dobre:** najtrudniejsza część (klient ORS) gotowa; wspólny profil pojazdu z Flotą.
**Złe / do poprawy:** pusty/szkieletowy UI w produkcji (dług wizerunkowy); brak spięcia z Flotą.
