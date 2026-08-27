# Weryfikacja: Ergonomia asystenta AI — chrom, sesje i tryb dokowania

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-27
- **Werdykt:** **GOTOWE Z UWAGAMI**
- **Uzupełnione po recenzji (2026-08-27):** recenzja świeżym okiem, prowadzona na **działającej**
  aplikacji, znalazła trzy defekty, których ta weryfikacja nie złapała — bo mierzyła kryteria
  akceptacji, a nie skutki uboczne zmiany w powłoce. Wszystkie trzy naprawione i objęte testami
  (`[106-R1]`, `[106-R2]`, `[106-R3]`); szczegóły w `review.md` §2. Najważniejszy wniosek dla
  następnej weryfikacji: **klikacz przy 360 px, który niczego nie przewija, nie sprawdza układu
  mobilnego** — brak `min-h-0` na nowym opakowaniu odbierał przewijanie wszystkim modułom na
  telefonie i nie ruszył ani jednej bramki.

## 1. Bramki

Wszystko na **lokalnym** Postgresie (C-13 — prod DB nietknięta; `npm run build` w całości nie
uruchamiany, bo jego ostatni krok `migrate.js` rusza produkcję).

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ następny wolny numer 0268 |
| `npm run check:schema-drift` | ✅ migracje odtwarzają dokładnie `schema.prisma` |
| `npm run check:actions` | ✅ 164 akcje, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ 598 akcji sklasyfikowanych (nowa `setAiConversationSaved` = `excluded`/`self`) |
| `npm run check:pagination` | ✅ każde `findMany` z granicą |
| `npm run check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `npm run check:ui-contract` | ✅ 23/23 moduły na `ModuleView` |
| `npm run check:owner-columns` | ✅ 2415 wywołań Prismy, żadne po skasowanych kolumnach |
| `npm run check:client-safe` | ✅ |
| `npm run check:logs` | ✅ 765 plików serwerowych bez surowego `console.*` |
| `npm run check:e2e-waits` | ✅ żaden test nie czeka na `networkidle` |
| `npm run check:perf` | ✅ najcięższa trasa 1172 kB, suma 67 502 kB — w paśmie ±5 % |
| `npx tsc --noEmit` (aplikacja i testy) | ✅ czysto |
| `npx next lint --dir src` | ✅ czysto |
| `npx next build` | ✅ **exit 0**, 141 stron |

## 2. Kryteria akceptacji

Dowody z klikacza pochodzą z `e2e/specs/asystent-ergonomia.spec.ts` (nowy plik, 10 testów,
**10/10 zielonych** — `/tmp/e2e-106i.log`). Numeracja testów w nawiasach.

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** brak nakładania przy 360 px, cele ≥ 44 px | ✅ | `[106-AC1]`: porównanie prostokątów **każdej pary** przycisków nagłówka — zero przecięć; każdy ≥ 43,5 × 43,5 px; `scrollWidth ≤ clientWidth` (pasek się nie przewija). |
| **AC-2** znacznik `auto` responsywny, z dostępną nazwą | ⚠️ częściowo | Kod: `AICommandSheet.tsx` — tekst w `<span className="hidden sm:inline">`, `title` + `aria-label` niosą pełną treść. **Nie sprawdzone klikaczem**: test przy 360 px biegnie z `autoApprove` domyślnie wyłączonym, więc znacznik nie jest wtedy renderowany. Realizacja jest jedną klasą Tailwinda i statycznymi atrybutami — ryzyko regresji minimalne, ale dowodu z uruchomienia **nie ma** i tak to raportuję. |
| **AC-3** komplet funkcji drugiego planu pod ⋮ | ✅ | `[106-AC3, AC-4]`: w menu obecne „Ustawienia asystenta", „Zgłoś problem", akcje rozmowy; w pasku ich nie ma. |
| **AC-4** `Esc` zamyka tylko menu | ✅ | `[106-AC3, AC-4]`: po `Escape` menu zniknięte, `[data-omnia-overlay="assistant"]` **nadal widoczny**. Działa bez naszego kodu — `AnchoredLayer` łapie `Escape` w fazie przechwytywania i zatrzymuje zdarzenie przed nasłuchem asystenta. |
| **AC-5** menu poziomu widoczne w całości | ✅ | `[106-AC5, AC-6]` przy 1280 × 800: `top ≥ 0` i `bottom ≤ innerHeight`; cztery pozycje `menuitemradio`. |
| **AC-6** niskie okno — przewijanie wewnątrz | ✅ | Ten sam test przy 1280 × **600**: prostokąt panelu nadal w całości w oknie. |
| **AC-7** zachowanie wyboru poziomu bez zmian | ⚠️ częściowo | Kod: treść menu przeniesiona bez zmian (te same `ASSISTANT_LEVELS`, `changeLevel`, `toggleAutoApprove`, ikona konfiguracji przy „Własnym"); zmienił się wyłącznie pojemnik. Klikacz potwierdza obecność czterech poziomów, **nie** przeklikuje zmiany poziomu i jej trwałości. |
| **AC-8** zapisanie trwałe, na koncie | ✅ | `[106-AC8, AC-10, AC-12]`: po zapisaniu licznik „Zapisane" > 0 i przeżywa **przeładowanie strony**. |
| **AC-9** dwie listy z licznikami, rozłączne | ✅ | `[106-AC9, AC-11]`: dokładnie dwa segmenty; `[106-AC8…]` pokazuje przepływ rozmowy między nimi (licznik jednej rośnie, drugiej maleje). Rozłączność wymuszona zapytaniami (`saved: true` / `saved: false`). |
| **AC-10** odwracalność | ✅ | `[106-AC8, AC-10, AC-12]`: „Usuń z zapisanych" → licznik zapisanych wraca do `0`, licznik historii > 0 — rozmowa **nie znika**. |
| **AC-11** pusta lista zapisanych wyjaśnia się sama | ✅ | `[106-AC9, AC-11]`: segment „Zapisane" jest **klikalny mimo zera**, a po wejściu widać tekst „Zapisz rozmowę z menu…". |
| **AC-12** komplet akcji + potwierdzenie niszczące | ✅ | `[106-AC3, AC-4]` (obecność akcji w ⋮) + `[106-AC8, AC-10, AC-12]`: „Usuń rozmowę" otwiera **skórkowany** dialog „Usunąć tę rozmowę?", anulowanie zostawia rozmowę. |
| **AC-13** istniejące rozmowy w historii, zapisane puste | ✅ | Baza e2e po `migrate deploy` na danych sprzed zmiany: 4 rozmowy, wszystkie `saved = false`; kolumna `NOT NULL DEFAULT false`. |
| **AC-14** tryb treści bez zmiany adresu | ✅ | `[106-AC14…]`: `location.href` identyczny przed i po przełączeniu; prostokąt panelu **węższy niż okno** i pokrywający się z `<main>` (a nie z całym ekranem). |
| **AC-15** stan modułu zachowany | ✅ | `[106-AC14…]`: `scrollTop` kontenera treści identyczny po wyjściu z trybu. |
| **AC-16** kontekst strony dostępny jak w oknie | ⚠️ pośrednio | Wynika z AC-14: nie ma nawigacji, komponent asystenta nie jest odmontowywany, `pathname` czytany tak samo. **Nie sprawdzono podglądem ładunku żądania do agenta** — wymagałoby wywołania modelu, którego klikacz nie robi. |
| **AC-17** wybór trybu zapamiętany na koncie | ✅ | `AssistantPref.presentation = 'content'` w bazie e2e po przełączeniu w interfejsie (odczyt SQL), kolumna `NOT NULL DEFAULT 'window'`. |
| **AC-18** telefon bez zmian | ✅ | `[106-AC18]`: przy zapisanym `presentation = "content"` i szerokości 360 px asystent otwiera się jako **arkusz na całą szerokość**, a `<main>` **nie** dostaje `inert`. |
| **AC-19** zawsze widoczne wyjście | ✅ | `[106-AC14…]`: przełącznik trybu widoczny **bez otwierania żadnego menu**; obok niego „Zamknij asystenta". |
| **AC-20** nawigacja działa, treść odcięta od fokusu | ✅ | `[106-AC14…]`: `<main>` ma `inert` **i** `aria-hidden="true"`; panel nie przykrywa nawigacji (pokrywa się z obszarem treści). |
| **AC-21** komplet bramek | ✅ | Tabela w §1. |

## 3. Zgodność z konstytucją

- **C-10/C-11/C-12/C-15** ✅ — ręcznie pisana migracja `0267` (numer z `next:migration`), zero
  `DROP`, `String` + union zamiast enuma, `schema.prisma` zmieniony razem z plikiem.
- **C-13** ✅ — wszystko na lokalnym/e2e Postgresie; pełny `npm run build` **nie** uruchamiany.
- **C-20/C-21** ✅ — `setAiConversationSaved` to Server Action z `revalidatePath("/")`; guardem
  własności jest filtr `userId` w `updateMany` (wzorzec sąsiednich akcji w tym pliku).
- **C-22** ✅ — RBAC nietknięty; warunek `isAdmin` przy przełączniku trybu administratora został
  dosłownie ten sam, zmieniło się tylko miejsce rysowania.
- **C-23** ✅ — brak nowej `AIAction`; zapisanie rozmowy to czynność człowieka, nie akcja modelu.
- **C-30** ✅ — `check:ui-contract` przechodzi; nowe elementy biorą kolory ze zmiennych CSS.
- **C-31** ✅ — cele dotyku ≥ 44 px zmierzone, nie zadeklarowane (AC-1).
- **C-32** ✅ — 20 nowych tekstów w `messages/pl.json`; `check:i18n` zielony.
- **C-34** ✅ — usuwanie rozmowy przez `confirmDialog({ destructive: true })`. **Naprawiono przy
  okazji zastane naruszenie**: dotąd rozmowa kasowała się bez pytania.
- **C-35** ✅ — nie powstał żaden nowy wspólny komponent; użyte trzy istniejące
  (`AnchoredLayer`, `PrzelacznikSegmentowy`, `ConfirmProvider`).
- **C-36** ✅ — zmiana mieści się w powłoce i `components/assistant`; nie sięga do wnętrza modułów.
- **C-51** ✅ — cztery lekcje dopisane do `doświadczenia.md`.
- **C-53** ✅ — dwie kolumny, jedna akcja, jeden 4-liniowy hook, jedno przesunięcie w drzewie powłoki.

## 4. Regresje

**Pełny zestaw klikaczy z ustaloną bazą odniesienia** (to samo środowisko, ten sam dzień):

| Przebieg | Przeszło | Padło |
|---|---|---|
| gałąź `claude/assistant-ui-spacing-dialog-fgw3p4` | 215 | 14 |
| commit sprzed zmiany (`745175e`) | 216 | 13 |

Różnica to **jeden** test — `[vs-AC4] ulubiony zapisany z filtrami wraca z filtrami`. Uruchomiony
**w izolacji pada tak samo na bazie** (9 przeszło / 1 padł, ten sam błąd), więc jest zależny od stanu
ulubionych zostawionego przez wcześniejszy przebieg, a nie od tej zmiany. Nazywa to wprost drugi
test padający **również w bazie**: „Nie udało się wyczyścić ulubionych w 40 iteracjach".
Pozostałe 13 to znane porażki specyfikacji funkcjonalnych, o których uprzedza `scripts/e2e-web.sh`.

**Regresji wprowadzonych przez 106: zero.**

Sprawdzone dodatkowo pod kątem sąsiedztwa:
- **Układ powłoki** — opakowanie w `AppShell` przejmuje klasy układu od `<main>`; klikacze paska
  widoku, powłoki i nawigacji zachowują się tak samo jak w bazie (te same testy, ten sam wynik).
- **Zmiana kształtu `listAiConversations`** — jedyny konsument to `AICommandSheet`; sprawdzone
  `grep`em i `tsc` (zwrotka jest typowana).
- **Migracja** — `IF NOT EXISTS` na obu kolumnach i indeksie; ponowne `migrate deploy` bezpieczne.

## 5. Uwagi (nie blokują)

1. **AC-2, AC-7, AC-16 mają dowód z kodu, nie z uruchomienia.** Każde jest realizowane statycznie
   (klasa Tailwinda, przeniesiona bez zmian treść menu, brak nawigacji), więc ryzyko jest małe —
   ale to jest różnica między „sprawdzone" a „wynika z kodu" i tak została zapisana.
2. **Trwałość preferencji utrudnia testowanie i to jest cecha, nie usterka.** Testy trybu treści
   ustawiają stan wyjściowy **wprost w bazie**, bo preferencje dojeżdżają z serwera asynchronicznie
   po otwarciu okna: kliknięcie „wróć do okna" trafiało w stan początkowy, a wczytane preferencje
   przestawiały wszystko z powrotem — objaw wyglądał jak znikający przycisk.
3. **Cztery rozmowy w bazie e2e zostały po wcześniejszych przebiegach.** Test zapisywania korzysta
   z nich, ale nie zakłada ich liczby — czeka na licznik segmentu, nie na konkretną wartość.
