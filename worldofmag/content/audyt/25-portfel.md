# Rozdział 25 — Portfel (Finanse)

## Kontekst / stan z kodu

Jeden z najbardziej rozbudowanych modułów.

- **Rdzeń:** `src/actions/portfel.ts`, `portfelBudgets.ts`, `portfelReports.ts`, `portfelCurrency.ts`,
  `portfelAuto.ts`; modele `WalletElement`, `WalletEntry` (z `sourceModule/sourceId`), `Budget`,
  `FinanceGoal`, `FinanceSettings`, `ExchangeRate`.
- **Funkcje:** budżety + cele oszczędnościowe, **raporty miesięczne**, **wielowalutowość** (kursy, NBP
  `refreshRatesFromNBP`), **auto-wydatki** księgowane z innych modułów (`src/lib/portfel/autoExpense.ts`).

## Mocne strony

- **Auto-wydatki** (paliwo, serwis, zakupy → wpis) — automatyzacja, której nie ma w prostych aplikacjach.
- **Wielowalutowość + raporty + cele** — poziom dedykowanej aplikacji finansowej.
- Idempotencja auto-wydatków po `sourceModule/sourceId` — czysty wzorzec.

## Głos Zespołu A — Strażnicy

**Anna (security):** „Dane finansowe = wrażliwe. **Zero reklam** w tym module (Z-474), eksport/usunięcie
(RODO), autoryzacja (Z-052). I uwaga: `currency.ts/toBase` value-importuje prisma → problem aliasu w
testach (Z-171).”

**Marek (DBA):** „`refreshRatesFromNBP` zależy od sieci — na produkcji OK, w sandboxie degraduje. Trzeba
pilnować `missingRates` i nie blokować UI brakiem kursu.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „Dwie rzeczy: **import CSV z banku** (Z-153 — widzę wydatki bez ręcznego wpisywania) i
**wspólny budżet domowy** (Z-196) dla rodziny. To spina Portfel z personą rodzinną i podnosi retencję.”

**Hubert (AI/ML):** „AI: »na co najwięcej wydaję«, »czy zmieszczę się w budżecie«, kategoryzacja
transakcji z importu. Tania wartość doradcza.”

## Punkty sporne

- **Open banking vs CSV.** **Konsensus:** **CSV teraz** (offline, Z-153), API banków (drogie/regulowane)
  dopiero przy realnym popycie.

## Głos użytkowników

**Agnieszka (38):** „Wspólny budżet domowy + import z banku = mam finanse rodziny ogarnięte.”
**Tadeusz (60):** „Dla firmy chcę raporty i eksport — i pewność, że dane są bezpieczne.”

## Konsensus i zalecenia

- **Z-300** *(P1 · M)* — **Import CSV z banku** (Z-153): parser + mapowanie kolumn → `WalletEntry`,
  idempotencja.
- **Z-301** *(P1 · S)* — **Zero reklam + RODO + autoryzacja** w module finansowym (Z-474/Z-050/Z-052).
- **Z-302** *(P2 · M)* — **Wspólny budżet domowy** (Z-196) — pierwszoklasowy widok dla rodziny.
- **Z-303** *(P1 · S)* — **Naprawić alias w testach `currency.ts`** (Z-171) + testy `toBase`/kursów.
- **Z-304** *(P2 · M)* — **AI-doradca wydatków** (analiza, kategoryzacja importu) — opcjonalnie.

## Dobre vs złe praktyki

**Dobre:** auto-wydatki (idempotentne), wielowalutowość, raporty, cele.
**Złe / do poprawy:** brak importu z banku; problem aliasu w testach; brak wspólnego budżetu rodzinnego.
