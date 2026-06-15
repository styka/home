# Rozdział 21 — Zwierzęta (Pets)

> **Strategicznie najważniejszy moduł III części:** najbliżej gotowości do komercjalizacji jako
> branża **„Hodowca”** (Rozdz. 43, Z-490).

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/pets.ts`, `petCare.ts`, `petHusbandry.ts`, `petBreeding.ts`; ~13 modeli
  (`Pet`, `PetShare`, `PetMeasurement`, `PetHealthRecord`, `PetVetVisit`, `PetTreatment`, `PetCareTask`,
  `PetCareLog`, `PetEnclosure`, `PetEnvironmentReading`, `PetBreedingPair`, `PetClutch`, `PetSale`).
- **Zaawansowane:** **genetyka/morfy** (`Pet.genetics` JSON, `petGenetics.ts`), alarmy parametrów
  terrariów (`PetEnvironmentReading` → `classifyValue` → powiadomienie), **eksport weterynaryjny**
  (`src/lib/petExport.ts`: karta HTML→PDF + CSV pomiarów), kalendarz zwierzęcy.
- **Progressive disclosure:** `Pet.presetKey` + `featureFlags` (JSON) — **gotowy wzorzec nakładek**.

## Mocne strony

- **Wzorzec presetów/feature-flags** — fundament „silnika nakładek” branżowych (Z-491).
- **Genetyka + hodowla + sprzedaż + eksport wet** — głębia, której nie ma żadna „apka do wszystkiego”.
- **Alarmy terrariów** — realna wartość dla hodowców gadów (nisza o wysokim zaangażowaniu).

## Głos Zespołu A — Strażnicy

**dr inż. Tomasz (architekt):** „`genetics`/`targetRanges` jako JSON-String — gdy zechcemy »znajdź
zwierzęta z genem X« (kluczowe dla hodowcy!), trzeba **JSONB+GIN** (Z-034). Bez tego raport hodowlany
filtruje w aplikacji.”

**Anna (security):** „Dane sprzedaży/kontakty kupujących (`PetSale`) to dane osobowe stron trzecich —
przy branży B2B dochodzi RODO klientów hodowcy.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „To jest **nasza pierwsza branża**. Mamy 80% klocków: rodowody (drzewo z par/lęgów),
sprzedaż, koszty. Dołóżmy **ROI hodowli** (przychód ze sprzedaży − koszty z Portfela) i **certyfikaty/
rodowody do druku** (mamy już `petExport`). To gotowy produkt premium dla niszy.”

**Hubert (AI/ML):** „AI: »przewidź morfy z krzyżówki« (genetyka), »wygeneruj opis ogłoszenia sprzedaży«,
»przypomnij o terminach lęgów«. Tania głębia dzięki AI — dokładnie nasza teza.”

## Punkty sporne

- **Hodowca jako osobny produkt vs preset.** **Konsensus:** **preset/nakładka** na Pets (Z-490), nie
  osobna aplikacja — reużycie rdzenia, niski koszt krańcowy.

## Głos użytkowników

**Krzysztof (52):** „Znam hodowców gadów — płaciliby za rodowody, genetykę i przypomnienia lęgów.”

## Konsensus i zalecenia

- **Z-260** *(P1 · M)* — **`genetics` → JSONB + GIN** (Z-034) — warunek raportów/filtrów hodowlanych.
- **Z-261** *(P1 · L)* — **Preset „Hodowca”** (rodowody, lęgi, sprzedaż, certyfikaty, ROI) — pierwsza
  branża (szczegóły plan Z-490, Rozdz. 57).
- **Z-262** *(P1 · S)* — **ROI hodowli** (sprzedaż − koszty z Portfela) — spięcie z Portfelem.
- **Z-263** *(P2 · M)* — **AI hodowlane** (przewidywanie morf z krzyżówki, opis ogłoszenia, przypomnienia lęgów).
- **Z-264** *(P1 · S)* — **RODO danych kupujących** (`PetSale`) — minimalizacja, zgody (pod branżę B2B).

## Dobre vs złe praktyki

**Dobre:** wzorzec presetów/feature-flags, genetyka/hodowla/eksport, alarmy terrariów.
**Złe / do poprawy:** kluczowe dane (genetyka) jako JSON-String (brak filtrów DB); RODO stron trzecich
przy sprzedaży nieuregulowane.
