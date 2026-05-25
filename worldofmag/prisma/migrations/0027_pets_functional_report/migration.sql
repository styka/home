-- Dokument funkcjonalny modułu Zwierzęta — wrzucony do /admin/reports.
-- Dollar-quoting — bezpieczny dla dużej zawartości markdown.
-- authorId = NULL → publiczne/systemowe, widoczne w panelu raportów.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Zwierzęta — Dokument funkcjonalny',
  'pets-functional-2026-05-25',
  $pets_functional_2026_05_25$# Zwierzęta — Dogłębny dokument funkcjonalny

**Wersja:** 1.0
**Data:** 2026-05-25
**Status:** Faza 1 zaimplementowana; Fazy 2–3 jako roadmap
**Autor:** Claude Code (sesja przygotowawcza)

---

## 1. Streszczenie

Moduł **Zwierzęta** (`/kitchen`-style dział pod `/pets`) to przestrzeń do
zarządzania dobrostanem, zdrowiem i opieką nad zwierzętami — od psa i kota,
przez węże i jaszczurki, po ryby akwariowe i ptaki. Założenia produktowe:

- **Najlepszy na świecie** zakres funkcji, ale prosty, klawiaturowo-przyjazny UX
  spójny z resztą WorldOfMag (dark theme, minimalizm, zero zbędnych kliknięć).
- **Pakiety widoczności funkcji per zwierzę** — hodowca węży widzi inne sekcje
  niż właściciel akwarium czy golden retrievera. Preset wybierany przy dodawaniu
  zwierzęcia, z możliwością ręcznego dostrojenia (tryb „custom").
- **AI wykonuje wszystkie akcje działu** (z parametrami) przez globalną magiczną
  ikonę — tekstem i głosem (PL).
- **Hybrydowy silnik dobrostanu** na stronie domowej: deterministyczne reguły
  liczą co zaległe/nadchodzące + warstwa LLM (Groq) na naturalne porady wg gatunku.
- **Współdzielenie** zwierzęcia z użytkownikiem lub zespołem (VIEWER/EDITOR).

Dostarczanie etapami: **Faza 1** (rdzeń) → **Faza 2** (husbandry: terrarium/
akwarium) → **Faza 3** (hodowla/genetyka/rodowody).

---

## 2. Mapa funkcji (rozdziały)

Sekcje oznaczone **(F2)/(F3)** wchodzą w danej fazie. Pakiety widoczności
(presety) decydują, które rozdziały są pokazane dla konkretnego zwierzęcia.

### 2.1 Profile zwierząt (Faza 1) — rdzeń
- **Tożsamość:** imię, gatunek (pies/kot/wąż/jaszczurka/żółw/ryba/ptak/gryzoń/
  królik/inne), rasa/morph/odmiana, płeć, data urodzenia/wyklucia (+ flaga
  „przybliżona"), data i źródło nabycia, identyfikatory (chip, obrączka, tag),
  umaszczenie/cechy szczególne, zdjęcie (URL).
- **Status życiowy:** aktywne / zmarłe (+ data) / oddane / sprzedane /
  zarchiwizowane. Filtrowanie i ukrywanie nieaktywnych.
- **Pakiet widoczności (preset):** wybierany przy tworzeniu, edytowalny; tryb
  „custom" z granularnymi przełącznikami sekcji.

### 2.2 Zdrowie i weterynaria (Faza 1)
- **Leki i terapie:** nazwa, rodzaj (lek/szczepienie/odrobaczanie/ochrona
  p-pasożytnicza/suplement), dawka, droga podania, start/koniec, harmonogram
  cykliczny, następny termin (`nextDueAt`), log podań.
- **Szczepienia:** jako podtyp leków — data podania + następny termin + numer serii.
- **Wizyty weterynaryjne:** data, lekarz/klinika, powód, diagnoza, koszt, następna
  wizyta, notatki, URL załącznika.
- **Dziennik zdrowia:** schorzenia przewlekłe, alergie, objawy, urazy, kamienie
  milowe — typ, opis, data, status (rozwiązane/aktywne).
- **Pomiary:** waga, długość/rozmiar, kondycja (BCS) — z trendem i alertami o
  nagłych zmianach.

### 2.3 Karmienie i żywienie (Faza 1)
- **Harmonogram karmienia:** typ pokarmu, porcja, cykliczność, następny termin.
- **Log karmienia:** data, pokarm/ilość; dla gadów: typ ofiary + wynik
  (zjedzone/odrzucone/zwrócone).
- **Suplementacja** (np. wapń/D3 dla gadów).

### 2.4 Rutyny opieki (Faza 1)
- **Zadania opieki:** czyszczenie, pielęgnacja, obcinanie pazurów, spacery,
  kąpiel, wymiana UVB/sprzętu, przypomnienie o ważeniu — cykliczne z terminem i
  logiem wykonania.
- **Dziennik zachowania / kamienie milowe.**

### 2.5 Husbandry / środowisko (F2) — preset gad/akwarium
- **Terraria/akwaria/klatki:** nazwa, typ, wymiary, lokalizacja, przypisane
  zwierzęta, sprzęt (grzałki, filtry, UVB z datą wymiany).
- **Parametry środowiska:** temperatura (strefa ciepła/zimna), wilgotność, UVB,
  cykl światła; dla akwarium: pH, amoniak, azotyny, azotany, temp., zasolenie,
  twardość — z logami i **alertami poza normą**.
- **Konserwacja:** wymiana wody/podłoża/filtra/żarówki UVB.

### 2.6 Hodowla i rodowody (F3) — preset hodowca
- **Pary/projekty hodowlane**, kojarzenia/kohabitacje.
- **Klutch/mioty:** data złożenia, liczba jaj, płodne/niepłodne, parametry
  inkubacji, daty wyklucia; potomstwo linkowane do nowych profili.
- **Rodowód / drzewo genealogiczne** (relacje matka/ojciec).
- **Genetyka:** kalkulator morphów/cech (het geny u węży), przewidywane wyniki.
- **Sprzedaż:** nabywca, cena, data.

### 2.7 Finanse i dokumenty (Faza 1; dokumenty URL-only)
- **Wydatki per zwierzę** (karma, wet, sprzęt) — sumy; koszty wizyt wet. wliczane.
- **Dokumenty/zdjęcia (URL):** pola na zewnętrzne URL-e + notatki.
  **Integracja Google Drive** (folder per użytkownik) — sekcja „wkrótce".

### 2.8 Kalendarz opieki i powiadomienia (Faza 1)
- **Zunifikowany „Kalendarz opieki"** — agregat wszystkich terminów ze wszystkich
  zwierząt: zaległe / dziś / nadchodzące (7 dni).
- **Powiadomienia w aplikacji** na stronie domowej działu.

### 2.9 Współdzielenie i współpraca (Faza 1)
- Udostępnianie zwierzęcia osobie (po e-mailu) lub zespołowi (VIEWER/EDITOR):
  współwłaściciel, opiekun/petsitter, rodzina. Zwierzęta team-owned.

### 2.10 Integracja AI (Faza 1)
- **Wszystkie akcje przez magiczną ikonę** (tekst + głos PL): dodaj zwierzę,
  zważ, zaplanuj/odhacz lek, zaplanuj karmienie/log karmienia, zapisz wizytę
  wet., dodaj wpis zdrowia, zaplanuj rutynę.
- **Hybrydowe sugestie dobrostanu** wg realnych danych i gatunku.

### 2.11 Pakiety widoczności (presety) (Faza 1)
Flagi sekcji: `MEASUREMENTS, HEALTH, TREATMENTS, VET, FEEDING, ROUTINES,
FINANCE, DOCUMENTS, HUSBANDRY(F2), AQUARIUM(F2), BREEDING(F3), GENETICS(F3)`
(PROFILE zawsze).
- **Pupil domowy** (pies/kot): pomiary, zdrowie, leki, wet., karmienie, rutyny,
  finanse, dokumenty.
- **Gad — hodowca-amator:** jw. + husbandry; karmienie „ofiara".
- **Gad — hodowca:** jw. + hodowla, genetyka.
- **Akwarium:** parametry wody, karmienie, finanse, dokumenty.
- **Ptak / Mały ssak:** warianty pupila.
- **Custom:** użytkownik włącza/wyłącza każdą flagę.

Sekcje faz 2/3 włączone presetem pokazują placeholder „wkrótce" — system
widoczności jest w pełni okablowany od Fazy 1.

---

## 3. Model danych (Faza 1)

8 modeli Prisma (konwencja: `String` zamiast enumów, JSON trzymany w `String`):

- **Pet** — profil + `presetKey` + `featureFlags` (JSON) + ownership
  (`ownerId`/`ownerTeamId`) + status.
- **PetShare** — współdzielenie z user/team (rola VIEWER/EDITOR).
- **PetMeasurement** — log wagi/długości/BCS.
- **PetHealthRecord** — schorzenia/alergie/objawy/urazy/notatki.
- **PetVetVisit** — wizyty + koszt + załącznik + następna wizyta.
- **PetTreatment** — zunifikowane planowane leczenie (leki/szczepienia/
  odrobaczanie/p-pasożytnicze/suplementy) z cyklicznością i `nextDueAt`.
- **PetCareTask** — rutyny cykliczne (karmienie/czyszczenie/pielęgnacja/
  spacer/wymiana wody/UVB/ważenie).
- **PetCareLog** — log wykonania + zdarzenia ad-hoc (karmienia, parametry).

Dostęp gated permisją `module.pets` (na start: ADMIN).

---

## 4. Roadmap

- **Faza 1 (gotowe):** profile, zdrowie, leki/szczepienia, wet., karmienie,
  rutyny, pomiary, finanse, dokumenty (URL), kalendarz opieki, hybrydowy
  dobrostan, AI tekst+głos, współdzielenie, pakiety widoczności.
- **Faza 2:** husbandry — terrarium (temp/wilgotność/UVB) + akwarystyka
  (parametry wody, wymiany), alerty poza normą.
- **Faza 3:** hodowla — pary, klutche/mioty, genetyka/morphy, rodowody, sprzedaż.
- **Później:** realna integracja Google Drive (folder per użytkownik na
  załączniki i zdjęcia).
$pets_functional_2026_05_25$,
  'pets',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
