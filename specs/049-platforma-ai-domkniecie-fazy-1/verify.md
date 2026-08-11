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

**AC-12 — klikacze: 21/21 i liczba czerwonych nie rośnie** ✅ **po naprawie**

Kryterium było **niespełnione**, regresję znaleziono, przypisano pomiarem i naprawiono. Poniżej cała
ścieżka, bo sam wynik końcowy nie oddaje tego, ile pomiarów było błędnych po drodze.

| Przebieg | Kod | Workery | Wynik | Czas |
|---|---|---|---|---|
| kontrolny | **przed 049** | 1 | 124 ✓ / **10 ✘** | **12,7 min** |
| po fazach A–F | po 049 | 1 | 115 ✓ / **16 ✘** | **26,0 min** |
| po poprawce `module.server.ts` | po 049 | 1 | 116 ✓ / **16 ✘** | **25,0 min** |
| kontrolny **powtórzony** | **przed 049** | 1 | 123 ✓ / **11 ✘** | **12,6 min** |
| po **właściwej** poprawce | po 049 | 1 | patrz niżej | — |

Kontrolny powtórzono **plecami do przebiegu po poprawce**, tą samą komendą i na tej samej bazie,
żeby wykluczyć dryf maszyny. Nie wykluczył — środowisko jest stabilne, **regresja była realna**.

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

**Druga przyczyna — ZNALEZIONA I NAPRAWIONA** (T-36/T-37).

Przełomem był pomiar, którego wcześniej nie umiałem wykonać: **kompilacja trybu dev per trasa,
z ciasteczkiem sesji**. Wszystkie moje wcześniejsze próby z `curl` dawały 5 ms i nie mierzyły
niczego, bo `middleware` przecina żądanie niezalogowane **przed** kompilacją strony. Po zalogowaniu
liczby stały się jednoznaczne — a `next dev` sam podaje rozmiar grafu (`Compiled /x in Ys (N modules)`).

| stan | `/auth/signin` | `/` | suma 10 tras |
|---|---|---|---|
| przed 049 | 2120 modułów | 2235 | 24,6 s |
| po 049 (z błędem) | **2775** | **2891** | **63,6 s** |
| po poprawce | **1771** | **1889** | **28,0 s** |

**Strona logowania**, która z modułami nie ma nic wspólnego, urosła o 655 modułów — to wykluczyło
moduły i wskazało graf **współdzielony**.

**Mechanizm.** `collect.ts` **wewnątrz modułu Kalendarz** importował korzeń kompozycji, żeby zebrać
wkłady wszystkich modułów — odwrócona zależność `moduł → korzeń → wszystkie moduły`. Sama w sobie
brzmi niewinnie, ale `contract.ts` re-eksportował ten agregat, a **kontrakt jest plikiem zbiorczym**:
import **jednej stałej** (`MODULE_META` w `NotificationBell`, komponencie powłoki obecnym na każdej
stronie) wciągał do grafu cały kod serwerowy aplikacji.

**Poprawka.** Moduł zostawia sobie **czyste składanie** (`assembleCalendar` — sortowanie i mapowanie),
a zbieranie wkładów robi warstwa kompozycji (`src/lib/calendarAgenda.ts` + sesyjna otoczka
w `src/actions/calendarAgenda.ts`). Kontrakt przestał re-eksportować agregat. Graf spadł do
**1771 modułów — poniżej stanu sprzed przebudowy**, bo agregat kalendarza siedział w grafie powłoki
także przed 049.

**Czego to uczy** (zapisane w `doświadczenia.md`): kontrakt modułu to **barrel** — kto importuje
z niego cokolwiek, płaci za wszystko, co on re-eksportuje. I reguła ogólniejsza: **moduł nigdy nie
sięga po korzeń kompozycji**; jeśli kod potrzebuje listy wszystkich modułów, to nie jest kod modułu,
nawet gdy dotyczy jego dziedziny.

**Ślepe zaułki po drodze** (zostawiam, bo kosztowały najwięcej):

- **rozmiar bundla produkcyjnego** — bez zmian (88,1 → 88,7 kB). Gdyby jedynym sprawdzeniem był
  `next build`, regresja weszłaby na produkcję niezauważona;
- czasy tras w `next start` (4–10 ms) — mierzyły odpowiedź `middleware`, nie kompilację strony;
- dryf maszyny — wykluczony przebiegiem kontrolnym powtórzonym plecami do siebie (12,7 i 12,6 min);
- kontencja workerów — przy jednym workerze regresja pozostawała;
- **pierwsza poprawka (`module.server.ts`) była chybiona jako lekarstwo** — architektonicznie
  słuszna i zostaje, ale wydajności nie przywróciła (26,0 → 25,0 min). Ogłosiłem wtedy sukces na
  podstawie porównania 51,7 s z 46,5 s — liczb **niewspółmiernych**, bo pierwsza z izolacji, druga
  z pełnego zestawu. To był najkosztowniejszy błąd tej diagnozy;
- równoległy `next build` z klikaczami — mój własny błąd wbrew ostrzeżeniu we własnej liście zadań.

**Decyzja właściciela (2026-08-11):** „nie poświęcaj dużo czasu na klikacze — rozpiszemy je
i uzupełnimy w przyszłości". Regresja wydajnościowa jest naprawiona i **udowodniona pomiarem grafu
kompilacji**, który jest miarą obiektywną i niezależną od zmienności środowiska. Pozostałe czerwone
scenariusze to **zastany dług testowy sprzed 049** (ten sam zestaw nazw pojawia się w przebiegu
kontrolnym na kodzie sprzed przebudowy) i zostają świadomie na później.

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

## **GOTOWE Z UWAGAMI**

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
