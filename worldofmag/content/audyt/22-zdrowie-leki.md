# Rozdział 22 — Zdrowie + Leki

> Moduł z **najbardziej wrażliwymi danymi** w całym produkcie (szczególna kategoria RODO — zdrowie).

## Kontekst / stan z kodu

- **Wizyty + badania:** `src/actions/health.ts`; modele `HealthEvent`, **`HealthAttachment`**
  (repozytorium wyników PDF/obraz) z **analizą trendów** (`numericValue`/`unit` + sparkline).
- **Leki i pielęgnacja:** `src/actions/medications.ts`; modele `MedicationSchedule`/`MedicationLog`
  (`kind` MEDICATION|CARE, `freqType` DAILY|WEEKLY|HOURLY), dawkowanie, cykliczna pielęgnacja, agenda
  „dziś” z odhaczaniem; integracja z kalendarzem i asystentem AI.

## Mocne strony

- **Repozytorium badań + trendy** — realna wartość zdrowotna (śledzenie wyników w czasie).
- **Harmonogram leków/pielęgnacji z odhaczaniem** — dyscyplina, której brakuje w „apkach do wszystkiego”.
- Spięcie z kalendarzem i AI.

## Głos Zespołu A — Strażnicy

**Anna (security):** „To jest **pole minowe RODO**. Dane zdrowotne wymagają najwyższej ochrony:
szyfrowanie wrażliwych pól/załączników, **minimalizacja w promptach AI** (Z-055 — nie wysyłać wyników
badań do LLM bez wyraźnej potrzeby i zgody), twarde usunięcie (Z-051), zero reklam w tym module (Z-474).
Bez tego nie wolno wpuścić publicznych użytkowników.”

**Ewa (QA):** „Dawkowanie leków to **bezpieczeństwo zdrowia** — błąd w cykliczności/strefie czasowej
może oznaczać pominiętą dawkę. Wymaga testów (recurrence + `userTime`) i jasnego komunikatu »to nie jest
porada medyczna«.”

## Głos Zespołu B — Pionierzy

**Ola (UX):** „Agenda »dziś« z odhaczaniem jest świetna — rozwińmy o **przypomnienia push** (Z4 +
web-push) i **eksport PDF dla lekarza** (mamy wzorzec `petExport` — to samo dla człowieka).”

**Hubert (AI/ML):** „AI: »wyjaśnij wynik badania prostym językiem« i »przypomnij interakcje leków« —
ale **z dużą ostrożnością** i zastrzeżeniem (nie diagnozujemy).”

## Punkty sporne

- **AI na danych zdrowotnych: ile.** Strażnicy: minimum, z zgodą i zastrzeżeniem; Pionierzy: dużej
  wartości, ale ostrożnie. **Konsensus:** funkcje AI **opt-in per moduł**, jawna zgoda, zastrzeżenie
  medyczne, minimalizacja danych.

## Głos użytkowników

**Agnieszka (38):** „Trzymam tu zdrowie dzieci — musi być bezpieczne i bez reklam.”
**Helena (68):** „Przypomnienie o lekach o stałej porze to dla mnie najważniejsze.”

## Konsensus i zalecenia

- **Z-270** *(P0 · M)* — **Wzmożona ochrona danych zdrowotnych:** szyfrowanie wrażliwych pól/załączników,
  zero reklam (Z-474), minimalizacja w promptach AI (Z-055), opt-in AI. Warunek publicznego startu.
- **Z-271** *(P1 · S)* — **Przypomnienia leków/wizyt** (Z4): podpięcie `MedicationSchedule`/
  `HealthEvent` do powiadomień + web-push (Rozdz. 34).
- **Z-272** *(P1 · S)* — **Testy dawkowania** (recurrence + strefa czasowa) — bezpieczeństwo zdrowia.
- **Z-273** *(P2 · S)* — **Eksport PDF dla lekarza** (wzorzec `petExport`) — karta zdrowia do druku.
- **Z-274** *(P2 · M)* — **AI z zastrzeżeniem** („wyjaśnij wynik”, interakcje) — opt-in, nie diagnoza.

## Dobre vs złe praktyki

**Dobre:** repozytorium badań z trendami, harmonogram leków z odhaczaniem, integracja z kalendarzem/AI.
**Złe / do poprawy:** dane wrażliwe bez dodatkowego szyfrowania i bez jawnej polityki AI; brak
przypomnień push i eksportu PDF.
