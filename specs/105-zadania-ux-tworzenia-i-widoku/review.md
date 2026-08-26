# Recenzja: Moduł Zadania — UX tworzenia i przeglądania zadań

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-26
- **Diff:** `origin/develop...HEAD` — 23 pliki, +2386 / −704

## Zakres i sposób recenzji

Recenzja objęła cały diff feature'a, z naciskiem na dwa miejsca o największym ryzyku: przebudowę
`TaskDetail` (1163 zmienione linie — mechaniczne przeniesienie 13 sekcji do stałych) oraz nową
obsługę szerokości i trybu pełnego w `TasksPage`.

**Przeniesienie sekcji `TaskDetail` sprawdzone maszynowo, nie wzrokiem.** Porównałem treść 13 stałych
złożonych w kolejności wariantu wąskiego z ciałem panelu sprzed zmiany (`6c4fe69`), po normalizacji
białych znaków, komentarzy i zewnętrznych klamer JSX. Wynik: **treść identyczna znak w znak**
(16 822 znaki), wszystkie 13 sekcji obecne, żadna nie zgubiona ani nie zmieniona. To była jedyna
sensowna kontrola — 500 linii przeniesionego JSX-a nie da się rzetelnie sprawdzić czytaniem.

## Ustalenia

### 1. `FormularzZadania.tsx:48` — `simplification` — eksport bez konsumenta *(poprawione w recenzji)*
`PRIORYTETY` była eksportowana, a żaden plik poza tym modułem jej nie importował. Martwe API w pliku
modułu to dokładnie ten dług, przed którym ostrzega C-35: ogłasza wspólne rozwiązanie, którego nikt
nie używa, więc następna osoba i tak napisze swoje. **Poprawka naniesiona:** zdjęty `export`.
Skutek: żaden — nie było czego zepsuć.

### 2. `FormularzZadania.tsx` — `convention` — `URGENT` i `HIGH` mają ten sam kolor *(świadome)*
Przed zmianą `URGENT` był zaszytym `#dc2626`, a `HIGH` — `var(--accent-red)`. Zaszyty hex łamał C-30
(skórka nie mogła go nadpisać) i miał wyjątek w manifeście kolorów. Teraz oba jadą na
`var(--accent-red)`, więc różni je wyłącznie znak (`‼` kontra `↑`). To jest **świadomy** wybór na
korzyść skinowalności; gdyby okazało się za mało czytelne, właściwą drogą jest nowy token motywu,
a nie powrót do hexa. Martwy wpis w `view-contract.json` usunięty — bramka `check:ui-contract`
sama go wskazała.

### 3. `QuickAddTask.tsx:35` — `convention` — rzutowanie typu uchwytu *(zostawione)*
`ref as React.Ref<FormularzZadaniaHandle>` — oba typy uchwytu są strukturalnie identyczne
(`{ focus: () => void }`), więc rzutowanie jest bezpieczne. Alternatywą byłoby wyeksportowanie
jednego typu i podmiana w `TasksPage`, czyli zmiana wywołania — a cały sens tej nakładki polega na
tym, że `TasksPage` nie zmienia się ani o linię. Zostawione świadomie.

### 4. `TasksPage.tsx` — `correctness` — ostrzeżenia `exhaustive-deps` *(zastane, klasa istniejąca)*
Trzy ostrzeżenia lintu w dotkniętych plikach (`zakonczZaznaczanie` w zależnościach efektu i memo).
Funkcje są odtwarzane przy każdym renderze, więc dodanie ich do zależności nic nie naprawia bez
`useCallback` — a to pociągnęłoby przepisanie sąsiednich handlerów, czyli refaktor „przy okazji"
zakazany przez C-53. To ta sama klasa co ~64 zastane ostrzeżenia w repo, wypisana w roadmapie
`CLAUDE.md` jako osobne zadanie.

### Sprawdzone i **bez** ustaleń

- **Guardy dostępu (C-21/C-17):** jedyna mutacja idzie istniejącym `createTask`, który woła
  `assertProjectAccess`. Widget nie omija guarda — podaje `projectId` tą samą drogą co dotychczasowy
  formularz.
- **`revalidatePath` (C-20):** bez zmian — `createTask` i `deleteTask` mają swoje; nowego zapisu nie
  ma.
- **Migracje (C-10..C-12):** brak. `check:schema-drift` zielony, `schema.prisma` nietknięty, zero
  enumów Prisma.
- **`AIAction` (C-23):** brak nowych; `check:actions` przechodzi (164 akcje).
- **Bezpieczeństwo:** brak nowych wejść użytkownika renderowanych jako HTML; opis zadania idzie tą
  samą, istniejącą ścieżką `markdownToHtml`. Żadnych kluczy ani logów (C-41).
- **`Modal.tsx`** — zmiana jest **zawężająca** (mniej DOM przy pustym ciele), więc nie może dołożyć
  niczego oknu, które treść ma. Potwierdzone przejściem pełnego zestawu, w którym modale otwiera
  kilkanaście specyfikacji.
- **Hydratacja:** oba miejsca czytające przeglądarkę (`localStorage`, `window.innerWidth`) robią to
  **wyłącznie w efekcie**; pierwszy render zawsze idzie z wartościami domyślnymi. To był defekt
  złapany na etapie implementacji i naprawiony przed weryfikacją.
- **Praca poza `worldofmag/` (C-01):** poza artefaktami pipeline'u w `specs/` i dziennikiem
  `doświadczenia.md` (oba z definicji w katalogu głównym) — nic. Legacy `src/`, `_old/`, `pom.xml`
  nietknięte.

## Werdykt

**APPROVE Z UWAGAMI.**

Zmiana robi dokładnie to, co opisuje spec, i nie robi nic ponadto. Trzy rzeczy warte odnotowania na
przyszłość, żadna nie blokująca: kolor `URGENT` zrównany z `HIGH` (świadomie, na korzyść
skinowalności), rzutowanie typu uchwytu w nakładce (cena za niezmienianie wywołania) i trzy
ostrzeżenia lintu tej samej klasy co zastane w repo.

Jedna poprawka naniesiona w recenzji: zdjęty `export` z `PRIORYTETY` (martwe API).
