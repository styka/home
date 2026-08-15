# Zadania: Warstwa `domain/` — reguły biznesowe dają się sprawdzić bez bazy

- **Plan:** ./plan.md (069-warstwa-domain)
- **Status:** done
- **Data:** 2026-08-14

> Kolejność podyktowana zależnościami: **najpierw wyprowadzenie reguł** (bo dopiero po nim znany
> jest próg zapadki), **potem bramka**, **na końcu testy negatywne i domknięcie**. Faza „migracja"
> nie istnieje — plan §2 mówi wprost: bez zmian w schemacie.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

## Faza 0 — Punkt odniesienia
- [x] **T-1** — Zapisz stan wyjściowy: liczba synchronicznych pomocników w plikach akcji (oczekiwane
  **55**), liczniki bramek (160/553/35/35), `npm run test:unit` (oczekiwane **749**), zapadka
  paginacji (263). *Gotowe, gdy:* liczby są w notatce przebiegu — bez nich AC-9 nie ma z czym
  porównać.

## Faza 1 — Wyprowadzenie reguł (plan §3.1, po jednym module na zadanie)

Każde zadanie w tej fazie ma identyczne „gotowe, gdy": reguła mieszka w `domain/`, plik akcji
importuje ją ścieżką względną, test bez bazy pokrywa **przypadek typowy i brzegowy**, `tsc --noEmit`
czysto, jeden commit.

- [x] **T-2** — **Nawyki**: `normalizeDays`, `normalizeGoal`, `normalizeReminder` →
  `habits/domain/harmonogram.ts`. Brzegowe: pełny tydzień → `null`, dzień spoza 0–6, cel 0 i 99,
  godzina `25:70`.
- [x] **T-3** `[P]` — **Zdrowie**: `normTimes`, `normDays`, `normFreq` →
  `health/domain/harmonogramLeku.ts`. Brzegowe: duplikaty godzin, `"8:05"` → `"08:05"`, pusty zbiór
  → `null`, nieznana częstotliwość → `DAILY`.
- [x] **T-4** `[P]` — **Kuchnia**: `dayKeyUTC` → `kitchen/domain/dzienPlanu.ts`; `slugify` →
  `kitchen/domain/slug.ts`. Brzegowe: data 23:30 w PL nie przesuwa dnia; tytuł z samych znaków
  niealfanumerycznych → `"przepis"`; tytuł >80 znaków.
- [x] **T-5** `[P]` — **Zwierzęta**: `nextDueFrom` → `pets/domain/terminOpieki.ts`. Brzegowe: brak
  reguły → `null`, termin za `endDate` → `null`, „teraz" podane parametrem (AC-8).
- [x] **T-6** `[P]` — **Portfel**: `signedBalance` → `domain/majatek.ts`; `startOfMonth` +
  `monthRange` → `domain/okres.ts`; `normCurrency` → `domain/waluta.ts`. Brzegowe: dług na minus,
  `offset` cofający przez styczeń → grudzień poprzedniego roku, waluta z białymi znakami i >8 znaków.
- [x] **T-7** `[P]` — **QA**: `normalizeSlug` → `qa/domain/slug.ts`. Brzegowe: polskie znaki,
  wielokrotne myślniki, myślnik na brzegach, zachowanie `_` (różnica wobec Kuchni — plan §9).
- [x] **T-8** `[P]` — **Trasy TIR**: granice profilu pojazdu (`clamp` + blok wymiarów) →
  `truck/domain/profilPojazdu.ts`; `nearestVertexDist2` → `truck/domain/korytarz.ts`. Brzegowe:
  `NaN` → dolna granica, masa 500 t → 120, pusta geometria trasy → `Infinity`.
- [x] **T-9** `[P]` — **Pogoda**: `resolveWhen` → `weather/domain/pora.ts`; `roundedBrief` →
  `weather/domain/odcisk.ts`. Brzegowe: data spoza prognozy → pierwszy dzień; pora bez godzin →
  wszystkie godziny dnia; pusta prognoza → data z „teraz" podanego parametrem (AC-8);
  **odcisk niezmieniony przy korekcie temperatury o 0,3 °C i zmieniony przy 1 °C** — to jest
  własność, dla której `roundedBrief` powstał (038).
- [x] **T-10** `[P]` — **Przekrojowe do platformy**: `deriveTitle` →
  `platform/ai/conversationTitle.ts`; `sanitizeColor` + `sanitizeIcon` →
  `platform/favorites/sanitize.ts`. Brzegowe: pusty tekst → `"Nowa rozmowa"`, tekst >60 znaków,
  hex spoza palety → `null`, ikona z trzech emoji → dwa. *Uwaga:* to jedyne zadanie dotykające
  `src/platform/**` — musi pozostać bez importu `@/modules/*` (C-36).

## Faza 2 — Bramka i manifest
- [x] **T-11** — Policz pomocniki pozostałe w plikach akcji po T-2…T-10. *Gotowe, gdy:* wynik
  wynosi **34**; jeśli nie — wróć do `plan.md` §3.1 i popraw klasyfikację (C-54), **nie** próg.
- [x] **T-12** — `src/lib/domain-coverage.json`: wpis dla **każdego** z 21 modułów
  (`domena` | `regula-w-lib` | `bez-regul` + `powod`), próg zapadki z T-11, lista obserwacji
  (`startOfToday`, dwa slugi, 12 czystych plików `lib/` bez testu).
- [x] **T-13** — `scripts/check-domain.js`: cztery kontrole z planu §8.1 (czystość, test obowiązkowy,
  manifest w obie strony, zapadka rosnąco **i** malejąco). Komunikaty po polsku (C-32).
- [x] **T-14** — Wpięcie: `package.json` → `check:domain` + krok w `build` (przed `tsc --noEmit`).
  *Gotowe, gdy:* `npm run check:domain` przechodzi na czysto.

## Faza 3 — Dowody (AC-3, AC-7)
- [x] **T-15** — **Test negatywny bramki, cztery razy osobno** (plan §8.2): import Prismy w domenie ·
  plik domeny bez testu · moduł usunięty z manifestu · próg zapadki zaniżony i zawyżony. *Gotowe,
  gdy:* każda sonda dała **niezerowy kod wyjścia z właściwym komunikatem**, a repo jest posprzątane.
- [x] **T-16** — **Dowód „bez bazy"**: zatrzymaj Postgresa, uruchom testy warstwy reguł, oczekiwane
  zielone, wystartuj bazę z powrotem. *Gotowe, gdy:* wynik zapisany dosłownie (AC-3).

## Faza 4 — Bramki i domknięcie
- [x] **T-17** — `npm run build` (lokalny Postgres, C-13) do kroku `next build` + `npm run test:unit`.
  *Gotowe, gdy:* zielone, liczniki bramek **nie spadły**, liczba testów **wzrosła** (AC-9).
- [x] **T-18** — Sprawdź AC-10: `git diff --stat` nie pokazuje zmian w `src/app/**` ani
  `src/components/**`.
- [x] **T-19** — Dziennik `content/architektura/15-dziennik.md`: wpis 069 + status zadania 19
  + obserwacje; przebakowanie `scripts/copy-architektura.js`.
- [x] **T-20** — `doświadczenia.md` (C-51) — co najmniej lekcja o tym, dlaczego reguła w pliku akcji
  jest niesprawdzalna z przyczyn strukturalnych, a nie z niedbalstwa.

## Mapowanie kryteriów akceptacji

| AC | Zadania |
|----|---------|
| AC-1 (klasyfikacja 55) | plan §3.1 + T-11 (weryfikacja liczbowa) |
| AC-2 (reguła importowalna + test z brzegiem) | T-2…T-10 |
| AC-3 (testy bez bazy) | T-16 |
| AC-4 (czystość warstwy) | T-13 kontrola 1, T-15 sonda 1 |
| AC-5 (plik bez testu = build pada) | T-13 kontrola 2, T-15 sonda 2 |
| AC-6 (manifest 21/21) | T-12, T-13 kontrola 3, T-15 sonda 3 |
| AC-6b (zapadka) | T-11, T-13 kontrola 4, T-15 sonda 4 |
| AC-7 (każdy niezmiennik na czerwono) | T-15 |
| AC-8 (zmiany kształtu przez zegar) | T-5, T-6, T-9 |
| AC-9 (liczniki nie spadają) | T-1 (punkt odniesienia) + T-17 |
| AC-10 (zero zmian dla użytkownika) | T-18 |

## Ścieżka krytyczna

`T-1` → **`T-2…T-10` (równoległe, tu jest cała robota)** → `T-11` (próg) → `T-12` (manifest) →
`T-13` (bramka) → `T-14` (wpięcie) → `T-15`/`T-16` (dowody) → `T-17` → `T-18` → `T-19`/`T-20`.

Blokady: `T-13` nie da się napisać przed `T-12` (bramka czyta manifest), a `T-12` nie przed `T-11`
(próg musi być zmierzony, nie założony). `T-15` wymaga kompletnej bramki. `T-19` wymaga wyniku
`T-17`, żeby dziennik podawał prawdziwe liczby.

## Notatki / blokady
- Poza zakresem (plan §9, C-53): przenoszenie 33 plików z `modules/*/lib/`, ujednolicenie dwóch
  implementacji sluga, naprawa `startOfToday` (strefa serwera zamiast strefy użytkownika).
  Wszystkie trzy trafiają do dziennika jako obserwacje w `T-19`.
