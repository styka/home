-- Raport Fazy 2 modułu Zwierzęta (Husbandry) → /admin/reports.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Zwierzęta — Faza 2: Husbandry (raport realizacji)',
  'pets-phase2-husbandry-2026-05-25',
  $pets_phase2_2026_05_25$# Zwierzęta — Faza 2: Husbandry (terrarium / akwarium)

**Wersja:** 1.0 · **Data:** 2026-05-25 · **Status:** Zaimplementowane i zmergowane

---

## 1. Cel fazy

Dodanie zarządzania **środowiskiem życia zwierząt** — zbiornikami (terrarium,
akwarium, paludarium, klatka, woliera) wraz z monitoringiem parametrów i
**inteligentnymi alertami poza normą**. To kluczowy element dobrostanu gadów,
płazów i ryb, którego brak w konkurencyjnych aplikacjach jest częsty.

## 2. Co trzeba było zrobić

1. Model zbiornika współdzielonego przez wiele zwierząt (akwarium = wiele ryb).
2. Log parametrów środowiska: terrarium (temp. stref, wilgotność, UVB) oraz
   akwarium (pH, amoniak, azotyny, azotany, temp. wody, zasolenie, GH, KH).
3. Klasyfikacja odczytów względem bezpiecznych zakresów (z możliwością
   nadpisania per zbiornik) + wizualne oznaczenia OK/ostrzeżenie/niebezpieczne.
4. Ewidencja sprzętu (grzałka, filtr, **żarówka UVB**) z terminem wymiany.
5. Rozszerzenie silnika dobrostanu o sygnały środowiskowe i przeterminowany sprzęt.
6. Pełna obsługa przez AI (tekst/głos): tworzenie zbiornika, log parametrów.
7. Spójny, intuicyjny UX wpięty w istniejący system zakładek per zwierzę.

## 3. Co zostało zrobione

### Model danych (migracja `0028_pets_husbandry`)
- **PetEnclosure** — zbiornik: `name`, `type`, wymiary (`lengthCm/widthCm/
  heightCm/volumeL`), `location`, `equipment` (JSON), `targetRanges` (JSON),
  `notes`, ownership `ownerId`/`ownerTeamId`. Relacja: wiele zwierząt → jeden
  zbiornik (`Pet.enclosureId`).
- **PetEnvironmentReading** — odczyt parametrów (12 pól: 4 terrarium + 8 akwarium),
  `measuredAt`, `note`. Powiązany ze zbiornikiem (kaskadowe usuwanie).
- Konwencja projektu zachowana: brak enumów, JSON w `String`.

### Logika i reguły (`src/lib/petEnvironment.ts`, `petWelfare.ts`)
- Katalog parametrów (etykiety PL, jednostki, liczba miejsc po przecinku) z
  podziałem terrarium/akwarium.
- Domyślne bezpieczne zakresy (np. amoniak/azotyny: cel 0, niebezpieczne > 0.25;
  pH 6.5–8.0; UVI 1–7) + klasyfikator `classifyValue` (OK/warn/danger).
- `buildEnvironmentSuggestions` — sygnały dobrostanu: parametr poza zakresem
  (ostrzeżenie/alarm) oraz sprzęt z minionym terminem wymiany.

### Server Actions (`src/actions/petHusbandry.ts`)
- `getEnclosures`, `createEnclosure` (z opcjonalnym przypisaniem zwierzęcia),
  `updateEnclosure`, `deleteEnclosure`, `assignPetToEnclosure`,
  `addEnvironmentReading`, `deleteEnvironmentReading` — z kontrolą dostępu
  (`assertEnclosureAccess`, owner/zespół).

### UX (`src/components/pets/PetHusbandry.tsx`)
- Zakładki **Terrarium** i **Akwarium** (zależnie od presetu zwierzęcia).
- Brak zbiornika → przypisanie istniejącego lub utworzenie nowego w 2 kliknięcia.
- Karta zbiornika (typ, wymiary, lokalizacja, odłączanie).
- Siatka **aktualnych parametrów** z kolorowym statusem i celem; formularz
  „Dodaj pomiar"; edytowalne **zakresy docelowe**; ewidencja **sprzętu** z
  alertem wymiany; **historia pomiarów** z podświetleniem wartości.

### AI (magiczna ikona, tekst + głos)
- `add_enclosure` — tworzy zbiornik, opcjonalnie przypisuje do zwierzęcia.
- `log_environment` — zapisuje parametry środowiska dla zbiornika zwierzęcia.

## 4. Weryfikacja
- `tsc --noEmit` bez błędów; `next build` kompiluje się; migracja `0028`
  zastosowana na prawdziwym Postgresie (tabele utworzone).
- Test E2E przez API: `add_enclosure` (utworzenie + przypisanie) i
  `log_environment` (amoniak 0.5 = alarm) zakończone sukcesem; alert
  środowiskowy „Akwarium: Amoniak = 0.5" pojawił się na stronie domowej działu.

## 5. Poza zakresem (świadomie)
- Realna integracja z Google Drive (załączniki) — pozostaje w planach.
- Wykresy historyczne parametrów (sparkline) — kandydat na późniejsze ulepszenie.
$pets_phase2_2026_05_25$,
  'pets',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
