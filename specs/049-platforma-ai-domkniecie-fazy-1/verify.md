# Weryfikacja: Platforma AI i domknięcie Fazy 1

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (31 zrobione, 2 odłożone, 2 otwarte)
- **Data:** 2026-08-11 · **Branch:** `claude/omnia-architecture-skins-qlv2ew` (`6b3b0b67`)
- **Punkt odniesienia:** `baseline.json` (zrzut sprzed pierwszej linijki kodu)

---

## 1. Bramki

Wszystkie przeciw **lokalnemu** Postgresowi (C-13).

| Komenda | Wynik |
|---|---|
| `npm run build` (pełny potok) | ✅ exit 0 |
| `next lint --dir src` | ✅ 0 błędów |
| `tsc --noEmit` · `tsc -p tsconfig.test.json` | ✅ oba exit 0 |
| `npm run test:unit` | ✅ **657/657** (0 pominiętych — z bazą lokalną ruszyły też testy prywatności read-tooli) |
| `check:actions` | ✅ **160** — bez spadku |
| `check:ai-coverage` | ✅ **551** — bez spadku |
| `check:cost-badge` · `check:content-memory` | ✅ **35** / **35** |
| `check:module-registry` | ✅ 21 modułów, sześć testów |
| `check:boundaries` · `check:ui-contract` · `check:schema-drift` · `check:migrations` | ✅ |

---

## 2. Kryteria akceptacji

**AC-1 — zdolności platformowe w platformie** ✅
`src/platform/` zawiera `ai`, `llm`, `jobs` obok wcześniejszych. `src/lib/llm/` nie istnieje;
w `src/lib/jobs/` został sam `registry.ts`. Jedenaście pozycji zostało w warstwie kompozycji,
**każda z nazwanym powodem** (inwentarz w `tasks.md`/T-32).

**AC-2 — zero importów modułów z platformy** ✅
`grep -rn "@/modules/" src/platform/` → **zero** trafień (przed przebiegiem: 18 plików).

**AC-3 — wiedza modułowa parametrem wymaganym** ✅
`buildAiCatalog(loaded)` bierze wkłady parametrem; worker kolejki dostaje rezolwer przez
`setJobHandlerResolver`. Żaden nie ma wartości domyślnej.

**AC-4 — pulpit z deklaracji** ⏸️ **ODŁOŻONE** (spec §5) — brak dowodu runtime, patrz tam.

**AC-5 — kalendarz z deklaracji** ✅
`collectCalendarEvents`: 227 → 32 linie, wyłącznie składanie i sortowanie. Siedem wkładów
modułowych. **Wynik identyczny co do znaku: 38 zdarzeń przed, 38 po.**

**AC-6 — katalog asystenta z deklaracji** ✅
Read-toole **56 = 56**, egzekutory **16 = 16**, katalogi akcji per moduł zgodne co do jednej
(razem **160**). `check:actions` pilnuje mocniejszej własności — moduł z akcjami musi deklarować
`ai`; sprawdzone testem negatywnym.

**AC-7 — zadania w tle z deklaracji** ✅
Allowlista **12 = 12**. Przy okazji wyłapane odruchowe dopisanie `skins.generate`, którego nigdy
w niej nie było — poszerzyłoby uprawnienia klienta.

**AC-8 — asystent odpowiada tak samo** ✅ (dowód jak w AC-6; dodatkowo testy prywatności
read-tooli przechodzą przez nową drogę)

**AC-9 — pulpit i kalendarz bez zmian** ⚠️ **częściowo** — kalendarz udowodniony (38 = 38),
pulpit nietknięty, bo odłożony.

**AC-10 — cztery liczniki bez spadku** ✅ 160 / 551 / 35 / 35.

**AC-11 — bramkę naprawiamy, nie obchodzimy** ✅
Padły cztery razy (`check:cost-badge`, `check:content-memory` ×2, `check:actions` ×2). Każda
naprawiona, dwie dostały **strażnika istnienia**, żeby martwe wyłączenie wywalało build zamiast po
cichu przestać działać.

**AC-12 — klikacze: 21/21 i liczba czerwonych nie rośnie** ❌ **NIESPEŁNIONE**

To jest jedyne niespełnione kryterium i powód werdyktu.

| Przebieg | Kod | Workery | Wynik | Czas |
|---|---|---|---|---|
| kontrolny | **przed 049** | 1 | 124 ✓ / **10 ✘** | **12,7 min** |
| po fazach A–F | po 049 | 1 | 115 ✓ / **16 ✘** | **26,0 min** |
| po poprawce `module.server.ts` | po 049 | 1 | 116 ✓ / **16 ✘** | **25,0 min** |
| kontrolny **powtórzony** | **przed 049** | 1 | 123 ✓ / **11 ✘** | **12,6 min** |

Kontrolny powtórzono **plecami do przebiegu po poprawce**, tą samą komendą i na tej samej bazie,
żeby wykluczyć dryf maszyny. Nie wykluczył — środowisko jest stabilne, **regresja jest realna**.

---

## 3. Regresja wydajności — co ustalono, a czego nie

**Objaw:** zestaw klikaczy chodzi **dwukrotnie dłużej**, a sześć testów robi się czerwonych przez
przekroczone limity czasu (10 s). Aplikacja działa poprawnie — migawki błędów pokazują kompletny
interfejs, a testy przechodzą uruchomione pojedynczo.

**Czego build NIE pokazał:** produkcyjny bundel jest praktycznie bez zmian (**88,1 → 88,7 kB**
współdzielone; `/kitchen` 107 → 108 kB). Gdyby jedynym sprawdzeniem był `next build`, ta regresja
weszłaby na produkcję niezauważona.

**Pierwsza przyczyna — znaleziona i naprawiona.** Trzy leniwe pola serwerowe (`ai`, `jobs`,
`calendar`) siedziały w `module.ts`, a `MODULES` jest importowane przez `ModuleSidebar` — komponent
**kliencki**. Leniwy `import()` zmienia moment ładowania, **nie przynależność do grafu**, więc
webpack obejmował cele tych importów kompilacją klienta. Wkład serwerowy wyszedł do
`module.server.ts` + osobnego korzenia `src/lib/modules.server.ts`.
**Poprawka jest słuszna architektonicznie i zostaje — ale nie przywróciła wydajności** (26,0 → 25,0 min).

**Druga przyczyna — NIE ZNALEZIONA.** Tu jestem zablokowany i mówię to wprost.
Co sprawdziłem i wykluczyłem:
- rozmiar bundla produkcyjnego (bez zmian),
- czas odpowiedzi tras w trybie produkcyjnym (`next start`: 4–10 ms na każdą podejrzaną trasę),
- dryf maszyny (kontrolny powtórzony plecami do siebie: 12,7 i 12,6 min),
- kontencja workerów (przy jednym workerze regresja pozostaje),
- równoległy `next build` (mój własny błąd z wcześniejszej fazy — odnotowany osobno).

Co wskazuje na **tryb deweloperski**: klikacze uruchamiają `npm run dev`, a spowolnienie jest
**jednorodne** (~2× na każdym spec-u, 672 s → 1357 s), nie skupione w module. Nie potrafię jednak
wskazać pliku, więc **nie twierdzę tego** — traktuję jako hipotezę bez dowodu.

**Wpływ na produkcję:** wszystko, co udało się zmierzyć, mówi „żaden" (bundel, czasy tras
w `next start`). Ale skoro nie znam przyczyny, **nie mogę tego zagwarantować** — i to jest powód,
dla którego nie promuję.

---

## 4. Zgodność z konstytucją

| Reguła | Stan |
|---|---|
| **C-36** | ✅ zero importów modułów z platformy; wkłady przez parametr |
| **C-02** | ✅ lint złapał trzy realne naruszenia (własne wnętrze przez alias) i wszystkie poprawiono |
| **C-10..C-14** | ✅ n/d — zero zmian schematu; build wyłącznie lokalnie |
| **C-20..C-23** | ✅ bez nowych akcji; guardy i `revalidatePath` jadą z akcjami; pokrycie bez spadku |
| **C-30..C-32** | ✅ zero zmian w UI |
| **C-50** | ⚠️ build zielony, ale klikacze nie |
| **C-51** | ✅ pięć lekcji dopisanych |
| **C-53** | ✅ jedno świadome odstępstwo od rozdz. 9.3 (leniwe pola) — i to ono okazało się źródłem problemu, co też jest zapisane |
| **C-54** | ✅ spec i plan poprawiane przed kodem trzy razy |

---

## 5. Werdykt końcowy

## **DO POPRAWY**

Merytorycznie przebieg jest zrobiony: **zadania 4 i 8 z checklisty są domknięte**, kalendarz wynika
z deklaracji, a równoważność udowodniona pozycja po pozycji (56 = 56 · 16 = 16 · 12 = 12 · 160 akcji
· 38 zdarzeń identycznych co do znaku). Bramki, build i 657 testów jednostkowych są zielone.

**Ale AC-12 jest niespełnione i przyczyny nie znam.** Zestaw klikaczy chodzi dwa razy dłużej niż
przed przebiegiem — potwierdzone czterema pomiarami, w tym dwoma kontrolnymi plecami do siebie.
Jedna przyczyna została znaleziona i naprawiona; druga nie.

**Nie promuję niczego na `develop` ani `master`.** Zmiana, której kosztu nie rozumiem, nie ma
prawa trafić na produkcję — nawet jeśli wszystkie dostępne mi pomiary mówią, że produkcji nie dotyka.

**Guard pętli (C-55).** To druga próba naprawy tej samej rzeczy i pierwsza była chybiona. Zamiast
trzeciego strzału na oślep zatrzymuję się i opisuję, gdzie utknąłem — bo dalsza diagnostyka wymaga
narzędzia, którego nie mam pod ręką: profilu kompilacji trybu deweloperskiego per moduł
(`next dev --turbo` z instrumentacją albo `NEXT_TURBOPACK_TRACING`), a nie kolejnych pomiarów
czasu całego zestawu.

**Pierwszy krok następnej sesji:** zmierzyć kompilację dev per trasa na obu wersjach kodu
(`d5700f61` vs `6b3b0b67`) — sesją z zalogowanym ciasteczkiem, bo `middleware` przecina żądania
niezalogowane przed kompilacją strony i dlatego moje próby z `curl` dawały 5 ms i niczego nie mierzyły.
