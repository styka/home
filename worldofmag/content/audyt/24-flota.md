# Rozdział 24 — Flota (Vehicles)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/flota.ts`; modele `Vehicle`, `FuelLog`, `ServiceRecord`, `VehicleProfile`
  (profil ORS do trasowania), **`VehicleAttachment`** (faktury, OC, dowód).
- **Funkcje:** rejestr pojazdów, logi paliwa (spalanie), serwis, załączniki; auto-wydatki paliwa/serwisu
  księgowane w Portfelu (`sourceModule/sourceId`).

## Mocne strony

- **Spięcie z Portfelem** (paliwo/serwis → wydatki) i z Truckiem (`VehicleProfile`).
- Załączniki dokumentów (OC/dowód) — praktyczne „wszystko o aucie w jednym”.

## Głos Zespołu A — Strażnicy

**Grzegorz (delivery):** „Brakuje **TCO** (F1) — całkowity koszt posiadania (paliwo+serwis+
ubezpieczenia+amortyzacja). Silnik auto-wydatków już księguje koszty; TCO to agregacja + widok. To
domknięcie wartości, nie nowy moduł.”

**Anna (security):** „Załączniki = dowód/OC = dane wrażliwe (numery, PESEL na dokumentach). Autoryzacja
dostępu (Z-052) i ewentualne maskowanie.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „**Przypomnienia o przeglądzie/OC** (F2) — silnik powiadomień jest, brakuje podpięcia.
To realna wartość (kara za brak OC!) i zalążek **Floty B2B** (Rozdz. 43, V3): wiele pojazdów, kierowcy,
przeglądy regulacyjne.”

## Punkty sporne

- **B2B teraz vs później.** **Konsensus:** najpierw domknąć osobistą Flotę (TCO + przypomnienia), B2B
  (V3) jako późniejsza branża łącząca z Truckiem.

## Głos użytkowników

**Krzysztof (52):** „Przypomnienie o przeglądzie i OC + koszt utrzymania auta — to bym chciał.”

## Konsensus i zalecenia

- **Z-290** *(P1 · S)* — **Przypomnienia przegląd/OC/serwis** (F2): podpiąć terminy do powiadomień (Rozdz. 34).
- **Z-291** *(P1 · M)* — **TCO pojazdu** (F1): agregacja paliwo+serwis+ubezpieczenia + widok; spięcie z budżetem.
- **Z-292** *(P2 · S)* — **Autoryzacja/maskowanie wrażliwych załączników** (OC/dowód) — spójne z Z-052.
- **Z-293** *(P2 · L)* — **Flota B2B** (V3): wiele pojazdów, kierowcy, przeglądy regulacyjne (z Truckiem).

## Dobre vs złe praktyki

**Dobre:** spięcie z Portfelem i Truckiem, załączniki dokumentów.
**Złe / do poprawy:** brak TCO i przypomnień terminów (gotowe klocki, niewykorzystane).
