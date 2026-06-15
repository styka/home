# Rozdział 23 — Nawyki (Habits)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/habits.ts`; modele `Habit`, `HabitEntry`; statystyki `src/lib/habitStats.ts`
  (serie/heatmapa).
- **Funkcje:** heatmapa, serie (streaks), **cele tygodniowe** (`Habit.weeklyGoal`), integracja
  **nawyk↔zadanie** (HA3), cykliczność (`recurrence.ts`).

## Mocne strony

- **Lekki, samowystarczalny** moduł o czystej logice (dobrze testowalnej — `habitStats`).
- **Integracja z zadaniami** — nawyk może rodzić zadanie; spójność ekosystemu.
- Heatmapa/serie — sprawdzony, motywujący wzorzec UX.

## Głos Zespołu A — Strażnicy

**Ewa (QA):** „`habitStats` (serie, heatmapa, strefy czasowe) to **idealny kandydat na pełne pokrycie
testami** — logika graniczna (przełom doby, pominięte dni) bywa źródłem błędów. Częściowo pokryte, warto
dokończyć.”

**Katarzyna (analityk):** „Nawyki to **najlepsze źródło sygnału retencji** — kto odhacza nawyki, ten
wraca. Wpiąć w North Star/metryki (Z-533).”

## Głos Zespołu B — Pionierzy

**Ola (UX):** „Dołóżmy **przypomnienia** (silnik jest) i **lekką grywalizację** (odznaki za serie) —
tanie, a mocno podnosi retencję. I **widżet na pulpicie/PWA** »dziś do odhaczenia«.”

**Hubert (AI/ML):** „AI-coach: »widzę, że gubisz nawyk X w weekendy — zmień porę?«. Tania, miła wartość.”

## Punkty sporne

- **Grywalizacja: ile.** Strażnicy: bez przesady, by nie zaśmiecić minimalistycznego UX. **Konsensus:**
  subtelne (serie/odznaki), opcjonalne.

## Głos użytkowników

**Zofia (16):** „Serie i heatmapa mnie nakręcają — dodajcie przypomnienia.”

## Konsensus i zalecenia

- **Z-280** *(P1 · S)* — **Przypomnienia o nawykach** (podpięcie do silnika powiadomień, Rozdz. 34).
- **Z-281** *(P1 · S)* — **Dokończyć testy `habitStats`** (serie, przełom doby, pominięte dni).
- **Z-282** *(P2 · S)* — **Subtelna grywalizacja** (odznaki za serie) — retencja bez zaśmiecania UX.
- **Z-283** *(P2 · S)* — **Wpiąć nawyki w metryki retencji** (North Star, Z-533).
- **Z-284** *(P2 · M)* — **AI-coach nawyków** (sugestie pór/korekt) — opcjonalnie.

## Dobre vs złe praktyki

**Dobre:** lekka, czysta logika; integracja z zadaniami; sprawdzony wzorzec heatmapy/serii.
**Złe / do poprawy:** brak przypomnień; niepełne testy logiki granicznej; niewykorzystany sygnał retencji.
