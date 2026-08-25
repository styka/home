# Weryfikacja: YouTube — moduł „co warto obejrzeć", transkrypcje i streszczenia

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-25

## 1. Bramki

Wszystko na **lokalnym** Postgresie (`127.0.0.1:5432/omnia_dev`), nigdy przeciw produkcji (C-13).

| Komenda | Wynik |
|---|---|
| `npm run build` (**pełny łańcuch**, log `/tmp/build102c.log`) | ✅ **35 bramek zielonych**, zero `npm ERR` |
| ├─ `tsc --noEmit` | ✅ |
| ├─ `next lint --dir src` | ✅ |
| ├─ `next build` | ✅ „Compiled successfully" |
| ├─ `check-perf-budget.js` | ✅ suma 67 421 kB — **w paśmie ±5 %** (+2,5 % za nowy moduł) |
| └─ `migrate.js` (migracje + seed) | ✅ (patrz uwaga niżej) |
| testy jednostkowe modułu | ✅ **25/25** (21 bibliotek pobierania + 4 warstwy reguł) |
| klikacze (`scripts/e2e-web.sh`) | ✅ 197 zaliczonych, 14 czerwonych — **zero regresji przypisywalnych tej zmianie** (rozdz. 4) |

> **Uwaga do ostatniego kroku.** Pierwszy przebieg `migrate.js` padł na „nie udało się połączyć
> z 127.0.0.1:5432" — lokalny Postgres zatrzymał się w trakcie równoległego builda. To awaria
> **środowiska**, nie zmiany: po wznowieniu klastra ten sam krok przeszedł (migracje + pełny seed).
> Wszystkie bramki, `tsc`, `next build` i budżet wydajnościowy przeszły **przed** tym momentem.

Bramki, które zażądały świadomej decyzji przy nowym module (wszystkie domknięte):
`check:module-registry` (+ klasyfikacja współdzielenia), `check:route-gating`, `check:ui-contract`,
`check:i18n`, `check:actions`, `check:ai-coverage`, `check:content-memory`, `check:cost-badge`,
`check:pagination`, `check:domain` (+ `domain-coverage.json`), `check:schema-drift`.

## 2. Kryteria akceptacji

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** — dodanie kanału po adresie | ✅ | `rozpoznajAdresKanalu` obsługuje `UC…`, `/channel/…`, `@uchwyt`, `/c/…`, `/user/…`; **8 testów**, w tym odrzucenie adresu spoza YouTube (`youtube.com.zlodziej.pl` → `null`) |
| **AC-2** — moduł działa **bez** zgody Google | ✅ | `KanalyPage` renderuje dodawanie ręczne **pierwsze**, a zaproszenie do połączenia niżej jako propozycję; `czyPolaczony()` steruje wyłącznie tą sekcją. Klikacz `[f0-open-youtube]` otwiera moduł na koncie bez `YoutubeConnection` |
| **AC-3** — import bez duplikatów | ✅ | **Sprawdzone w bazie:** dwa wstawienia tego samego kanału w jednej przestrzeni → **1 wiersz** (`@@unique([workspaceId, channelId])`). Idempotencja jest własnością schematu, nie pamięci programisty |
| **AC-4** — rozłączenie zostawia kanały | ✅ | **Sprawdzone w bazie:** po `DELETE` z `YoutubeConnection` kanały przestrzeni → **1 wiersz**. `rozlaczYoutube` dotyka wyłącznie tabeli zgody |
| **AC-5** — odświeżenie z postępem | ✅ | `youtubeRefresh` raportuje trzy etapy przez `ctx.progress` → `Job.progress`; `getStanOdswiezania` czyta go z kolejki (przeżywa przeładowanie strony), `YoutubePage` odpytuje co 2 s |
| **AC-6** — metadane + odnośnik | ✅ | `FilmSzczegol` renderuje tytuł, kanał, `adresFilmu(videoId)` jako „Otwórz na YouTube"; `adresFilmu` pokryty testem |
| **AC-7** — oryginalna transkrypcja | ⚠️ **częściowo** | Ścieżka zaimplementowana i pokryta **13 testami** na zapisanych próbkach (wycięcie ścieżek napisów, wybór języka, składanie tekstu z postaci XML **i** JSON, pełny przebieg). **Realnego pobrania z YouTube nie dało się sprawdzić** — patrz rozdz. 5 |
| **AC-8** — brak transkrypcji = etykieta, nie błąd | ✅ | Test „każde niepowodzenie kończy się `null` — NIGDY wyjątkiem" pokrywa cztery drogi awarii; zadanie zapisuje wtedy `transkrypcjaStan: "niedostepna"`, `FilmSzczegol` pokazuje zdanie wyjaśniające, a film **zostaje na liście** ze streszczeniem z opisu |
| **AC-9** — trzy długości, bez ponownego generowania | ✅ | `rememberedContent` z `scopeKey = "<film>:<długość>"` — trzy osobne zapisy, więc przełączenie długości nie kasuje poprzedniej. Ponowne wejście czyta z pamięci (`fromMemory`) |
| **AC-10** — moment powstania + świadome przeliczenie | ✅ | `AiContentMeta` z `generatedAt`, `stale` i `swiezy`; przeliczenie wyłącznie przez `onRefresh` → `generuj(dlugosc, force = true)`. Nic nie generuje się samo (brak `mode`, świadomie poza `AI_SECTION_KINDS`) |
| **AC-11** — ocena + sortowanie | ✅ | Ocena jest **kolumną** `YoutubeVideo.ocena` z indeksem `[workspaceId, ocena]`; `getFilmy(sort:"warto")` sortuje **w bazie** (`nulls: "last"` — „nieocenione" to nie to samo co „nie warto") |
| **AC-12** — uzasadnienie z wiedzy o użytkowniku | ✅ | Etap 3 zadania wstrzykuje `buildUserContext(ownerId)`; prompt **zabrania wprost** powoływać się na popularność i liczbę wyświetleń |
| **AC-13** — pytania bez zmyślania | ✅ | Prompt `zapytajOFilm` żąda odpowiedzi „Nie ma tego w transkrypcji." i zakazuje wiedzy spoza materiału; film bez transkrypcji dostaje odpowiedź wprost, bez wywołania modelu |
| **AC-14** — szukanie po transkrypcjach | ✅ | `getFilmy({szukaj})` przeszukuje `title` **i** `transkrypcja`; **indeks trigramowy potwierdzony w bazie** (`YoutubeVideo_transkrypcja_trgm_idx`). Ten sam mechanizm w narzędziu asystenta, które zwraca **fragment** wokół trafienia, nie całą transkrypcję |
| **AC-15** — rozdział danych między użytkownikami | ✅ | **Sprawdzone w bazie:** ten sam kanał w drugiej przestrzeni przechodzi (izolacja), a nie koliduje. Wszystkie odczyty przez `filtrMoichRekordow` (wariant **wąski**), `ustawStan` przez `updateMany` z filtrem przestrzeni — cudzy film nie pasuje do warunku |
| **AC-16** — bramka trasy | ✅ | `wymagajDostepuDoModulu` w **layoucie** (obejmuje `/youtube/[videoId]` i `/youtube/kanaly`); `check:route-gating` liczy teraz 20 tras |
| **AC-17** — wariant mobilny | ✅ | Brak drugiego paska bocznego (rama powłoki), cele dotyku `py-3`/`padding: 10px 12px`, transkrypcja we **własnym** kontenerze przewijania z `wordBreak`, filtry w `flexWrap`. Kolory wyłącznie ze zmiennych CSS, na kolorowych przyciskach `var(--on-accent)` |
| **AC-18** — usunięcie kanału przez kosz | ✅ | `usunKanal` zapisuje migawkę przez `recordTrash`, `restoreYoutubeChannel` przywraca (ze `skipDuplicates` — kanał mógł wrócić importem). **Kaskada potwierdzona w bazie:** usunięcie kanału kasuje jego filmy |

## 3. Zgodność z konstytucją

| Reguła | Stan |
|---|---|
| **C-10, C-11** | ✅ Ręczna migracja `0262`, numer z `next:migration` |
| **C-12** | ✅ Cztery kolumny statusowe (`zrodlo`, `stan`, `transkrypcjaStan`, `domyslnaDlugosc`) jako `String` + unia TS — **zero enumów Prismy** |
| **C-13** | ✅ Wyłącznie lokalny Postgres |
| **C-15** | ✅ **Zadziałało w praktyce:** wygenerowany `migrate diff` otwierał się siedmioma instrukcjami, które skasowałyby indeksy pełnotekstowe Notatek i tabelę kopii własności. Do migracji trafiła wyłącznie część dotycząca YouTube (`grep -E "^(DROP\|ALTER)"` na nowym pliku — czysto) |
| **C-20** | ✅ Wszystkie mutacje jako Server Actions z `revalidatePath` |
| **C-21 (po 079)** | ✅ `workspaceId`, zapis `wlasnoscOsobistaDoZapisu`, odczyt `filtrMoichRekordow` (wariant wąski — moduł osobisty). `check:owner-columns` zielone |
| **C-22** | ✅ Nowy slug seedowany migracją, wpięcie w **oba** korzenie kompozycji, bramka trasy |
| **C-23** | ✅ Trzy `AIAction` z egzekutorem i wpisem w kontrakcie — `check:actions`: 164 akcje |
| **C-24** | ✅ Usuwanie kanału przez kosz + przywracanie |
| **C-30..C-34** | ✅ Zmienne CSS, wariant mobilny, teksty przez `t()` (`check:i18n` zielone), `ModuleView` ze `state`, `confirmDialog({ destructive: true })` |
| **C-36** | ✅ **Wymuszone przez bramkę:** kod modułu wrócił z `src/lib/youtube/` do `src/modules/youtube/lib/`, a trasy dostały przez kontrakt **czynność** (`przygotujZgode`/`zapiszZgode`), nie kroki OAuth |
| **C-40** | ✅ `op: "generation"` / `op: "reasoning"` — model rozstrzygany po typie operacji, nigdy zaszyty |
| **C-41** | ✅ **Świadomie MOCNIEJ niż wzorzec:** token odświeżający Google trzymany **zaszyfrowany** (`encryptSecret`), choć `DriveConnection` trzyma go otwartym tekstem. Log niepowodzenia nie niesie wartości tokenu |
| **C-51** | ✅ Trzy wpisy w `doświadczenia.md` |
| **C-53** | ✅ **Zero nowych zależności.** `parseRss` i `resilientFetch` reużyte zamiast kopii; brak `dashboard.ts`, którego żadne AC nie wymaga |
| **C-54** | ✅ Odstępstwa od planu odnotowane (kolejność T-8↔T-11, `szukajWTranskrypcjach` scalone z `getFilmy`) |

## 4. Regresje

**Przebieg z tą zmianą:** 197 zaliczonych (było **186** przy 101), 14 czerwonych.

Trzynaście z czternastu to **dokładnie ten zestaw**, który przy specyfikacji 101 został udowodniony
jako istniejący wcześniej — wtedy porównano go z baselinem przy cofniętej zmianie i odtworzył się
identycznie (podłoże: brak danych z seeda i odcięta sieć dla specyfikacji Wiadomości).

**Czternasta była moja i została naprawiona:**
`[f0-registry] rejestr modułów ma spodziewaną liczbę wpisów`. Test trzyma liczbę modułów zapisaną
**wprost** i istnieje po to, żeby nowy moduł został świadomie odnotowany, a nie prześlizgnął się.
Podbita 21 → 22; specyfikacja przechodzi teraz **26/26**.

**Dowód, że moduł faktycznie działa w przeglądarce:** klikacz `[f0-open-youtube] otwiera moduł
YouTube bez błędu` przechodzi (736 ms) — trasa odpowiada, sesja się trzyma, brak błędów w konsoli.

## 5. Ograniczenia weryfikacji

Uczciwie, żeby raport nie sugerował większej pewności, niż daje:

- **Realne pobranie z YouTube nie zostało sprawdzone w tym środowisku** — sieć w piaskownicy jest
  odcięta. Sprawdzone jest *przetwarzanie* odpowiedzi (na zapisanych próbkach) i *zachowanie przy
  niepowodzeniu*; nie jest sprawdzone, czy YouTube odpowie serwerowi produkcyjnemu. **To jest
  główne ryzyko tego modułu i było nim od etapu specyfikacji** — dlatego zadanie loguje
  `youtube.transkrypcje.skutecznosc` (odsetek udanych pobrań): po pierwszym przebiegu na produkcji
  będzie z czego ocenić, czy wariant lekki wystarcza, zamiast zgadywać.
- **Przepływ zgody Google nie został przejechany od początku do końca** — wymaga prawdziwego ekranu
  zgody Google. Sprawdzone: zapis i odczyt połączenia w bazie, zachowanie przy rozłączeniu,
  szyfrowanie tokenu, porównanie stanu chroniące przed CSRF.
- **Ocena „czy warto obejrzeć" i streszczenia nie zostały wywołane na żywym modelu** — brak
  skonfigurowanego dostawcy w środowisku lokalnym. Sprawdzone: ścieżka kodu, obsługa pamięci treści,
  przekazanie zużycia i wpięcie w budżety.
- Testy jednostkowe **celowo** nie odpytują YouTube: test zależny od sieci nie przechodzi
  w piaskownicy, a w CI byłby migotliwy i sprawdzałby cudzy serwis zamiast naszego kodu.

## 6. Werdykt końcowy

## ✅ GOTOWE Z UWAGAMI

Siedemnaście z osiemnastu kryteriów spełnionych w pełni; **AC-7 częściowo** — implementacja
i obsługa niepowodzeń sprawdzone testami, samego pobrania z YouTube nie da się sprawdzić bez sieci.
Moduł jest zaprojektowany tak, że ten właśnie przypadek jest **normalnym stanem, nie awarią**
(AC-8), więc nawet całkowita odmowa YouTube'a zostawia działający moduł: listę nowych filmów, ocenę
„czy warto" i streszczenia z opisu.

Bramki zielone w komplecie, zero regresji przypisywalnych zmianie, zero nowych zależności.
