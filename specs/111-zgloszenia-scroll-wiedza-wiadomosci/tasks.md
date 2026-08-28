# Zadania: Powrót do miejsca czytania, rosnąca wiedza o użytkowniku i uporządkowane Wiadomości

- **Plan:** ./plan.md (111-zgloszenia-scroll-wiedza-wiadomosci)
- **Status:** todo
- **Data:** 2026-08-27

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatki)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Fundament danych

- [x] **T-1** — Migracja `0269_streszczenia_per_poziom_i_automat_wiedzy` (plan §2.3): tabela
  `NewsItemSummary` (+ unikat `[itemId, length]`, indeks, FK `ON DELETE CASCADE`), przeniesienie
  bieżących streszczeń z `NewsItem` (`INSERT … SELECT … ON CONFLICT DO NOTHING`), trzy kolumny
  w `AssistantPref` (`autoFacts` domyślnie `true`, `factsLastRunAt`, `factsStamp`).
  **Gotowe, gdy:** plik istnieje, `grep -E "^(DROP|ALTER TABLE .* DROP)"` na nim jest pusty (C-15),
  `npm run check:migrations` przechodzi.
- [x] **T-2** — `schema.prisma`: model `NewsItemSummary`, relacja zwrotna w `NewsItem`, trzy pola
  w `AssistantPref`. Poziom jako `String` + union TS, **nigdy** enum (C-12).
  **Gotowe, gdy:** `npx prisma generate` czysto i `npm run check:schema-drift` nie zgłasza rozjazdu
  wobec migracji (lokalny Postgres, C-13).

## Faza 1 — Rzeczy małe i niezależne (naprawa ramy)

- [x] **T-3** `[P]` — **Akcja będąca samą ikoną nie rozciąga się** (plan §5.2, przyczyna
  zgłoszenia 3): `KLASA_AKCJI_IKONOWEJ` w `ViewBar.tsx` + reguła `.omnia-akcja-ikonowa
  { flex: none }` w `globals.css`. Domyślne rozciąganie z 087 **zostaje** — wyjątek jest po stronie
  ikony, żeby nie cofnąć tamtej poprawki (korekta planu, C-54). Ikony ramy dostają klasę zawsze.
  **Gotowe, gdy:** widoki bez ikonowych akcji wyglądają dokładnie jak przed zmianą.
- [x] **T-4** `[P]` — **`blocksKey` z treści, nie z samych tytułów** (`NewsReader.tsx:261`, plan
  §5.5, druga połowa zgłoszenia 5). Osobne zadanie, bo to samodzielna wada: bez niej AC-24 nie
  przejdzie nawet po naprawie nośnika tekstu.
  **Gotowe, gdy:** test jednostkowy pokazuje, że zmiana samej treści bloku (przy tym samym tytule)
  zmienia klucz.
- [x] **T-5** `[P]` — **`src/modules/news/lib/dlugoscStreszczenia.ts`** (plan §3.3): jedna definicja
  poziomów dla obu ścieżek — `instrukcjaDlugosci`, `maksSlow`, `czyZaDlugie`, `LIMIT_MATERIALU`
  + testy jednostkowe.
  **Gotowe, gdy:** funkcja `lengthInstruction` **znika** z `news.ts` i z `newsRefresh.ts` (koniec
  duplikatu), oba pliki importują wspólny moduł, `npm run test:unit` na nowym pliku zielony.

## Faza 2 — Przywracanie pozycji przewijania (zgłoszenie 1)

- [x] **T-6** — `src/platform/nawigacja/przewijanie.ts` (plan §5.1): czysta logika + pamięć sesji —
  `zapamietaj`, `odczytaj`, `oznaczPowrot`, `czyPowrot`, limit ~20 wpisów. Wzorzec `historia.ts`:
  **brak pamięci sesji jest stanem poprawnym**, nie wyjątkiem.
  **Gotowe, gdy:** testy w `__tests__/przewijanie.test.ts` pokrywają limit, `sessionStorage`
  rzucający przy samym dostępie (AC-3), oraz to, że flaga powrotu jest **jednorazowa**.
- [x] **T-7** — `src/hooks/usePrzywroceniePrzewijania.ts`: zapis dławiony klatką, jeden nasłuch
  `popstate` na okno, przywracanie po malowaniu z oknem ponowień do ~1 s (listy dociągane
  asynchronicznie nie mają wysokości w pierwszej klatce).
  **Gotowe, gdy:** hook nie tworzy niczego na poziomie modułu (`check:client-safe`) i nie robi
  nic, gdy pamięci nie ma.
- [x] **T-8** — Wpięcie hooka w kontener przewijania `ModuleView` (C-35: komponent razem
  z konsumentem). Obejmuje wszystkie widoki modułów **oraz `/admin`** (przez `RamaPanelu`).
  W komentarzu zapisz znane ograniczenie: `layout="fill"` przewija treść modułu, nie ramę.
  **Gotowe, gdy:** ręcznie na `/admin` i `/wiadomosci` powrót wstecz wraca w to samo miejsce,
  a wejście z odnośnika nadal ląduje na górze (AC-2).

## Faza 3 — Streszczenia per poziom (zgłoszenie 4)

- [x] **T-9** — `resummarizeItem` na nowo (plan §3.1): pamięć per poziom (zwrot bez wywołania
  modelu), `force` dla ręcznej regeneracji, materiał **wyłącznie źródłowy** (pełny artykuł →
  skrót z `NewsArticle`, **nigdy** `item.summary`), `upsert` do `NewsItemSummary`, jedna korekta
  przy wyniku ponad pułap, `revalidatePath`. Guard dostępu **bez zmian** (C-21).
  **Gotowe, gdy:** zwrotka niesie `fromMemory` i `fromArticle`; testy: drugi raz ten sam poziom =
  identyczny tekst i **zero** wywołań atrapy modelu (AC-18), przy nieudanym pobraniu artykułu
  materiałem jest opis z `NewsArticle` (AC-19), `force` nadpisuje (AC-20).
- [x] **T-10** — `newsRefresh.summarizeItems` (plan §3.2): dociąganie pełnego artykułu dla pozycji
  z ubogim skrótem (limit 12 na przebieg, sekwencyjnie, błąd pobrania nie przerywa etapu), zapis
  wyniku **także** do `NewsItemSummary`, pusty/skrajnie krótki wynik modelu = niepowodzenie pozycji.
  **Gotowe, gdy:** test pokazuje dociągnięcie dla pustego skrótu i respektowanie limitu (AC-21).
- [x] **T-11** — `src/lib/ai/content-memory-coverage.json`: przepisz uzasadnienie dla
  `src/modules/news/actions/news.ts` — dotychczasowe („pamięć zwróciłaby nie to, o co użytkownik
  poprosił") po tej zmianie **jest nieprawdziwe**, bo pamięć jest per poziom. Klasyfikacja zostaje
  `on-demand`.
  **Gotowe, gdy:** `npm run check:content-memory` zielone, a uzasadnienie opisuje kod, który stoi.

## Faza 4 — Jeden nośnik treści: karta i lektor (zgłoszenie 5)

- [x] **T-12** — `NewsStream` przejmuje stan streszczeń (`nadpisania` per pozycja); `readerBlocks`
  czyta przez nadpisania i ma je w zależnościach `useMemo` (plan §5.5).
  **Gotowe, gdy:** zmiana poziomu przy grającym lektorze zmienia czytany tekst (AC-24, razem z T-4).
- [x] **T-13** — `NewsItemCard` staje się **sterowana**: znika jej `useState` na streszczenie
  (usunięcie drugiego nośnika), dochodzą akcje „Wygeneruj ponownie" (AC-20) i „Spróbuj ponownie"
  przy `summaryFailed` (AC-22). Tekst z pamięci pojawia się bez wskaźnika kosztu — nic nie kosztował.
  **Gotowe, gdy:** karta nie trzyma żadnego stanu treści, a obie nowe akcje są odróżnialne od
  przełącznika poziomu.

## Faza 5 — Układ modułu Wiadomości (zgłoszenie 3)

- [x] **T-14** — Trzy zakładki: `feed` · `hot` · `timeline`; `ContentSwitch` i klucz `tresc` usunięte
  (plan §5.3). **Zgodność zapisanych widoków:** stare `?tresc=timeline` normalizuje się do
  `?widok=timeline`, `widok=sources` nadal renderuje zarządzanie źródłami.
  **Gotowe, gdy:** wejście na stary adres ląduje na osi czasu, nie na pustce (AC-10..AC-12).
- [x] **T-15** — Zarządzanie źródłami z panelu filtra portali (stopka „Zarządzaj źródłami" →
  `NewsSettings` w `Modal`, stopka respektuje `env(safe-area-inset-bottom)`) — AC-17.
- [x] **T-16** — Pasek stanu odświeżania: gałąź `DONE` zwija się do **samego czasu**, liczby idą do
  `title`/`aria-label`; gałęzie „trwa" i „nie powiodło się" **nietknięte** (AC-14, AC-15).
  `AiCostBadge` zostaje — jest meldunkiem na szynę kosztów.
- [x] **T-17** — Proporcje w pasku akcji Wiadomości: „Odśwież" dostaje `KLASA_AKCJI_ROZCIAGLIWEJ`
  z T-3, „Nowy temat" i koło zębate **nie** (AC-13).

## Faza 6 — Wiedza o użytkowniku (zgłoszenie 2)

- [x] **T-18** — `userFacts.ts`: poszerzone sygnały (plan §3.5) — nawyki, projekty zadań i ich grupy,
  tagi przepisów i książki kucharskie, talie językowe, warsztaty, `UserActivity` — **wyłącznie
  metadane**. W komentarzu wypisz, co jest **świadomie pominięte** (notatki, zdrowie, leki, finanse,
  kontakty, wiadomości) — AC-8. Próg „za mało materiału" liczony po wszystkich sygnałach (≥ 5).
  **Gotowe, gdy:** każde nowe `findMany` ma `take` (`check:pagination` jest regułą bezwzględną),
  a `check:owner-columns` przechodzi.
- [x] **T-19** — Odcisk materiału + `force` w payloadzie: bez `force` i przy równym `factsStamp`
  handler kończy `added: 0` **przed** wywołaniem modelu i bumpuje `factsLastRunAt` (AC-6).
  **Gotowe, gdy:** test z atrapą modelu potwierdza **zero** wywołań przy niezmienionym odcisku.
- [x] **T-20** — `src/platform/wiedza/harmonogram.ts`: atomowe odebranie prawa
  (`user_facts_last_sweep`, wzorzec retencji) + kolejkowanie do 20 kont z `dedupeKey`.
  **Gotowe, gdy:** test z 5 równoległymi wywołaniami przyznaje prawo **dokładnie raz** (AC-5).
- [x] **T-21** — Wpięcie przemiatania w `platform/jobs/worker.ts` (interwał okresowy, obok retencji).
  **Gotowe, gdy:** błąd przemiatania nie wygląda jak błąd przetwarzania zadań (osobny `catch`).
- [x] **T-22** — `assistantPrefs`: `autoFacts` w odczycie + `setAutoFacts` z `revalidatePath`;
  przełącznik w `UserFactsSection` nad „Poszukaj hipotez", z jednym zdaniem o tym, co system czyta,
  a czego nie. Ręczne szukanie woła teraz `{ force: true }` (AC-9, AC-7).

## Faza 7 — Bramki i domknięcie

- [x] **T-23** — Teksty: wszystkie nowe napisy do `messages/pl.json`, czytane przez
  `useTranslations`. **Gotowe, gdy:** `npm run check:i18n` zielone (od 097 reguła bezwzględna).
- [x] **T-24** — Testy jednostkowe zebrane i zielone: `przewijanie`, `dlugoscStreszczenia`,
  `harmonogram` wiedzy, `blocksKey`, akcja streszczeń. `npx tsc --noEmit -p tsconfig.test.json`.
- [ ] **T-25** — Klikacz e2e wg mapowania z planu §8 — **bez `networkidle`** (`check:e2e-waits`):
  powrót wstecz (AC-1/AC-2), trzy zakładki i stary adres (AC-10..AC-12), pasek przy 360 px
  (AC-13/AC-16), krótki pasek stanu (AC-14), źródła z panelu filtra (AC-17), ponowienie przy
  nieudanym streszczeniu (AC-22).
- [x] **T-26** — Komplet bramek: `check:migrations`, `check:schema-drift`, `check:actions`,
  `check:ai-coverage`, `check:cost-badge`, `check:content-memory`, `check:ui-contract`,
  `check:boundaries`, `check:module-registry`, `check:owner-columns`, `check:pagination`,
  `check:logs`, `check:i18n`, `check:client-safe`, `check:tailwind`, `check:e2e-waits`,
  `next lint`, `next build`. **Lokalny Postgres, nigdy prod DB (C-13)** — zatrzymujemy się przed
  `migrate.js`.
- [x] **T-27** — Wpis do `doświadczenia.md` (C-51): pięć zgłoszeń, z czego cztery mają przyczynę
  wartą zapamiętania — kontener przewijania niewidoczny dla przywracania przeglądarki, rozciąganie
  nałożone na wszystkie dzieci paska, dwie ścieżki streszczania o różnym materiale wejściowym,
  klucz odświeżania liczony z tytułów zamiast z treści.
- [ ] **T-28** — Mapowanie AC → dowód (wejście do `/verify`).

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|----|---------|
| AC-1, AC-2 | T-6, T-7, T-8, T-25 |
| AC-3 | T-6 |
| AC-4, AC-8 | T-18 |
| AC-5 | T-20, T-21 |
| AC-6 | T-19 |
| AC-7 | T-22 |
| AC-9 | T-22 |
| AC-10, AC-11, AC-12 | T-14, T-25 |
| AC-13 | T-3, T-17, T-25 |
| AC-14, AC-15 | T-16, T-25 |
| AC-16 | T-3, T-14, T-17, T-25 |
| AC-17 | T-15, T-25 |
| AC-18 | T-1, T-9 |
| AC-19 | T-9 |
| AC-20 | T-9, T-13 |
| AC-21 | T-10 |
| AC-22 | T-13, T-25 |
| AC-23 | T-5, T-9, T-10 |
| AC-24 | **T-4 + T-12** (dwie niezależne przyczyny — obie muszą paść) |
| AC-25 | T-12, T-13 |
| AC-26 | T-12 |

**Każde AC ma pokrycie.** AC-24 celowo wymaga dwóch zadań: nośnik tekstu i klucz odświeżania
lektora to dwie osobne wady tego samego objawu.

## Ścieżka krytyczna

```
T-1 → T-2 ─┬─────────────────────────────→ T-9 → T-10 → T-11 ──┐
           └────────────────────────→ T-18 → T-19 → T-20 → T-21 → T-22 ─┤
T-3 ─────────────────────────────────────────────→ T-17 ───────┤
T-5 ────────────────────────────────────→ T-9 ─────────────────┤
T-4 ───────────────────────────┐                                │
                                └→ T-12 → T-13 ─────────────────┤
T-6 → T-7 → T-8 ───────────────────────────────────────────────┤
T-14 → T-15, T-16 ─────────────────────────────────────────────┤
                                                                └→ T-23 → T-24 → T-25 → T-26 → T-27 → T-28
```

- **Blokady twarde:** T-2 blokuje wszystko, co dotyka nowych tabel (T-9, T-10, T-18..T-22).
  T-3 blokuje T-17. T-5 blokuje T-9 i T-10 (wspólna definicja długości). T-6 → T-7 → T-8 to łańcuch.
  T-12 blokuje T-13 (karta przestaje trzymać stan dopiero, gdy strumień go przejmie).
- **Równoległe:** T-3, T-4, T-5 to trzy niezależne pliki. Faza 2 (przewijanie), faza 5 (układ)
  i faza 6 (wiedza) nie stykają się plikami.

## Notatki / blokady
- Nic zablokowanego na starcie. Weryfikacja lokalna wymaga wystawionego Postgresa 16
  (`pg_ctlcluster 16 main start`) — bez niego `check:schema-drift` **przechodzi milcząco**, więc
  T-2 trzeba potwierdzić na działającej bazie, a nie na zielonym pominięciu.
