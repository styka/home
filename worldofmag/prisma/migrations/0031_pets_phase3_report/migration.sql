-- Raport Fazy 3 modułu Zwierzęta (Hodowla/Genetyka) → /admin/reports.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Zwierzęta — Faza 3: Hodowla i genetyka (raport realizacji)',
  'pets-phase3-breeding-2026-05-25',
  $pets_phase3_2026_05_25$# Zwierzęta — Faza 3: Hodowla, rodowody, genetyka, sprzedaż

**Wersja:** 1.0 · **Data:** 2026-05-25 · **Status:** Zaimplementowane i zmergowane

---

## 1. Cel fazy

Domknięcie modułu o funkcje **hodowlane** na poziomie profesjonalnym: rodowody,
pary hodowlane, klutche/mioty z inkubacją, **kalkulator genetyczny morphów**
oraz ewidencję **sprzedaży**. To funkcje, które wyróżniają aplikację wśród
hodowców gadów (węże, gekony) i nie tylko.

## 2. Co trzeba było zrobić

1. Rodowód (ojciec/matka) i automatyczne wiązanie potomstwa.
2. Pary hodowlane ze statusami i historią klutchy/miotów (inkubacja, wyklucie).
3. Tworzenie potomstwa jako nowych profili z ustawionym rodowodem.
4. Kalkulator genetyczny: poprawne prawdopodobieństwa potomstwa dla dziedziczenia
   recesywnego, kodominującego i dominującego (niezależne geny).
5. Ewidencja sprzedaży + oznaczanie zwierzęcia jako sprzedanego.
6. Obsługa przez AI (tekst/głos) i spójny UX.

## 3. Co zostało zrobione

### Model danych (migracja `0030_pets_breeding`)
- **Pet**: `sireId`, `damId` (rodowód, self-relacja), `genetics` (JSON genotypu).
- **PetBreedingPair** — para: `name`, `species`, `maleId`, `femaleId`, `status`
  (PLANNED/PAIRED/COOLING/PRODUCTIVE/RETIRED), ownership.
- **PetClutch** — klutch/miot: data złożenia, liczba jaj/płodne, temp./wilgotność
  inkubacji, oczekiwane i faktyczne wyklucie, liczba wyklutych, status.
- **PetSale** — sprzedaż: nabywca, kontakt, cena, waluta, data.

### Kalkulator genetyczny (`src/lib/petGenetics.ts`)
- Model per gen z trybami: recesywny, kodominujący, dominujący.
- `calculateOffspring` liczy rozkład genotypów potomstwa (Punnett) na podstawie
  prawdopodobieństw przekazania allelu. Zweryfikowane: het × het (recesywny) →
  25% widoczny / 50% het / 25% normalny; widoczny × normalny → 100% het.

### Server Actions (`src/actions/petBreeding.ts`)
- `getPetBreeding` (rodowód, potomstwo, pary z klutchami, sprzedaż, kandydaci),
  `setParentage`, `setGenetics`, CRUD par i klutchy, `markClutchHatched`,
  `createOffspring`, `recordSale`, `deleteSale` — z kontrolą dostępu.

### UX (`src/components/pets/PetBreeding.tsx`)
- Zakładka **Hodowla**: rodowód (wybór rodziców), lista potomstwa (linki), pary
  hodowlane ze statusem, klutche (dodawanie + oznaczanie wyklucia), dodawanie
  potomka z poziomu pary, ewidencja sprzedaży.
- Zakładka **Genetyka**: edytor genotypu (gen + tryb + zygotyczność) oraz
  **kalkulator pary** z wizualnymi słupkami prawdopodobieństw potomstwa.

### AI (magiczna ikona, tekst + głos)
- `record_sale` — zapis sprzedaży + oznaczenie SOLD.
- `add_breeding_pair` — utworzenie pary (dobór płci automatyczny).

## 4. Weryfikacja
- `tsc --noEmit` bez błędów; `next build` kompiluje się; migracja `0030`
  zastosowana na prawdziwym Postgresie.
- Logika genetyki sprawdzona testem (wyniki Punnett poprawne).
- Test E2E przez API: utworzenie pary „Para Pytony" (Kaa♂ × Nagini♀), zapis
  sprzedaży Nagini (Jan Kowalski, 500 PLN) — w bazie para poprawnie powiązana,
  zwierzę oznaczone jako SOLD, rekord sprzedaży utworzony.

## 5. Stan modułu
Wszystkie trzy fazy (rdzeń, husbandry, hodowla) są wdrożone. Pakiety widoczności
pozwalają każdemu użytkownikowi pokazać tylko potrzebne sekcje. Pozostaje w
planach realna integracja z Google Drive (załączniki) — zgodnie z ustaleniami.
$pets_phase3_2026_05_25$,
  'pets',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
