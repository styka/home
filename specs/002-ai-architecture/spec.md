# Spec: Architektura AI dla Asystenta Osobistego (fast-path, caching, obserwowalność kosztów)

- **ID:** 002-ai-architecture
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-15
- **Moduł(y):** AI / asystent domowy (`/api/llm/home/*`), warstwa LLM (`src/lib/llm/*`, `src/lib/ai/*`), panel admina (`/admin/llm`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Szczegóły implementacyjne poniżej pojawiają się wyłącznie jako *kontekst istniejącego
> stanu* (co już jest), nie jako projekt rozwiązania — ten należy do `plan.md`.

## 1. Problem / potrzeba

Asystent Omnii ma być „mózgiem" systemu operacyjnego dla codziennego życia — warstwą, która rozumie
intencję użytkownika i koordynuje działanie aplikacji, a nie silnikiem wykonującym każdą czynność.
Dziś **każde** polecenie — nawet trywialne („dodaj mleko", „oznacz zadanie jako zrobione") — przechodzi
przez pełną, wieloetapową pętlę dużego modelu rozumującego. To generuje zbędny koszt i opóźnienie tam,
gdzie zwykły, deterministyczny kod backendu w pełni wystarcza. Brakuje też wglądu w koszt pojedynczych
wywołań (widzimy dzienne sumy tokenów, ale nie koszt/czas/rozbicie per wywołanie, model i typ operacji),
przez co nie da się świadomie sterować wydatkami. Rekomendowana architektura (dokument właściciela)
mówi wprost: tanie operacje bez LLM, tani model do klasyfikacji intencji, duży model tylko do
rzeczywistego rozumowania, cache stałego kontekstu i twarda obserwowalność kosztów.

## 2. Cel i miary sukcesu

- **Cel:** doprowadzić istniejącą architekturę AI do zgodności z rekomendacją „LLM to mózg, nie silnik":
  proste polecenia rozstrzygane szybką klasyfikacją intencji + deterministyczną ścieżką backendu (bez
  uruchamiania dużego modelu), duży model rezerwowany do zapytań wymagających rozumowania, stały prefiks
  promptu cache'owany tam, gdzie dostawca to wspiera, a każde wywołanie LLM zalogowane z kosztem i czasem.
- **Sukces mierzymy:**
  - Trywialne polecenie (np. „dodaj mleko do zakupów", „oznacz zadanie X jako zrobione") jest obsłużone
    **bez** wywołania dużego modelu rozumującego — widoczne w logu wywołań jako brak wpisu `reasoning`
    dla tego polecenia (co najwyżej jeden tani wpis klasyfikacji intencji).
  - Panel admina pokazuje, dla wybranego okresu, **koszt, liczbę tokenów (wejście/wyjście) i średni czas
    odpowiedzi** w rozbiciu na model i typ operacji.
  - Anthropic Sonnet/Haiku da się włączyć jako komplet **jednym gotowym profilem** w `/admin/llm`, bez
    zmian w kodzie i bez zmiany domyślnego providera (Groq) dla środowisk bez klucza Anthropic.

## 3. Historyjki użytkownika

- Jako właściciel chcę, żeby proste polecenia („dodaj X", „usuń Y", „oznacz zrobione") wykonywały się
  szybko i tanio, bez angażowania dużego modelu, żeby codzienne użycie było natychmiastowe i niedrogie.
- Jako właściciel chcę, żeby złożone prośby („zaplanuj mi weekend", „przeanalizuj zadania z 2 miesięcy",
  „znajdź zadania o remoncie mimo braku tagu") nadal trafiały do modelu rozumującego, żeby jakość
  odpowiedzi się nie pogorszyła.
- Jako administrator chcę widzieć koszt, tokeny i czas każdego wywołania LLM (z rozbiciem na model i typ
  operacji) oraz dostać sygnał, gdy dzienny koszt przekroczy próg, żeby świadomie kontrolować wydatki.
- Jako administrator chcę móc przełączyć asystenta na Anthropic Sonnet (rozumowanie) + Haiku (klasyfikacja)
  jednym gotowym profilem, żeby skorzystać z rekomendowanego zestawu modeli bez grzebania w kodzie.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given skonfigurowany asystent, when użytkownik wysyła trywialne polecenie zapisu
  (np. „dodaj mleko do zakupów"), then polecenie jest sklasyfikowane jako prosta intencja i przygotowane
  deterministycznie **bez** wywołania modelu typu `reasoning`; w logu wywołań LLM dla tego polecenia nie
  ma wpisu `reasoning` (najwyżej jeden tani wpis klasyfikacji).
- [ ] **AC-2** — Given trywialne polecenie zapisu obsłużone fast-path, when jest gotowe do wykonania,
  then trafia do istniejącego panelu potwierdzenia (ActionDrawer) na dotychczasowych zasadach (operacje
  destrukcyjne odznaczone domyślnie); fast-path **nie** wykonuje zapisu z pominięciem panelu.
- [ ] **AC-3** — Given polecenie wymagające rozumowania (planowanie, analiza, wyszukiwanie semantyczne,
  Q&A wieloetapowe), when zostanie rozpoznane jako złożone, then jest obsłużone pełną pętlą agenta na
  modelu `reasoning` — jak dotychczas, bez regresji funkcjonalnej.
- [ ] **AC-4** — Given dostawca wspierający cache stałego prefiksu promptu (Anthropic), when asystent
  wykonuje kolejne wywołania z tym samym stałym kontekstem (instrukcja systemowa, opis aplikacji, katalog
  narzędzi), then stały prefiks jest oznaczony do cache'owania, a log wywołania odnotowuje tokeny odczytane
  z cache (gdy dostawca je raportuje). Dla dostawcy bez wsparcia cache zachowanie jest niezmienione.
- [ ] **AC-5** — Given wykonane dowolne wywołanie LLM (fast-path, klasyfikacja, agent, inny moduł), when
  otwieram widok kosztów w panelu admina, then widzę dla okresu: liczbę wywołań, tokeny wejścia/wyjścia,
  szacowany koszt i średni czas odpowiedzi, z rozbiciem na **model** i **typ operacji**.
- [ ] **AC-6** — Given ustawiony próg dziennego kosztu, when dzienny szacowany koszt AI go przekroczy,
  then administrator otrzymuje sygnał (powiadomienie/oznaczenie w panelu); przekroczenie progu nie blokuje
  działania asystenta poza istniejącymi limitami budżetu per użytkownik.
- [ ] **AC-7** — Given administrator w `/admin/llm`, when wybiera gotowy profil „Anthropic (Sonnet + Haiku)"
  i zapisuje klucz Anthropic, then typy operacji `reasoning`/`generation` wskazują Sonnet, a `dispatch`
  wskazuje Haiku, bez zmian w kodzie; domyślny provider dla środowiska bez klucza Anthropic pozostaje Groq.
- [ ] **AC-8** — Given asystent budujący kontekst dla modelu, when zbiera dane i historię rozmowy, then
  do modelu trafia **ograniczony** zestaw (dane z bazy limitowane, historia przycięta do istotnego okna),
  a nie cała baza/pełna historia — zgodnie z zasadą „nie wysyłaj całej bazy".
- [ ] **AC-9** — Given `npm run build`, when uruchamiam go po zmianach, then przechodzi (łącznie z
  `check:actions`, `check:migrations`, `next build`), a każda nowa `AIAction` ma egzekutor.

## 5. Zakres

**W zakresie:**
- Warstwa klasyfikacji intencji na tanim modelu (typ operacji `dispatch`) **przed** uruchomieniem modelu
  rozumującego, z deterministycznym fast-path backendu dla zdefiniowanego zestawu prostych intencji
  (m.in. dodanie prostego elementu, oznaczenie wykonania, usunięcie, proste liczenie/wyszukiwanie po
  nazwie/ID) — bez uruchamiania modelu `reasoning`, z zachowaniem panelu potwierdzenia (ActionDrawer).
- Prompt caching stałego prefiksu (instrukcja systemowa, opis aplikacji, katalog narzędzi) dla dostawcy,
  który go wspiera (Anthropic), z bezpiecznym brakiem zmian dla dostawców bez wsparcia.
- Obserwowalność kosztów: log **per-wywołanie** (tokeny wejścia/wyjścia, czas odpowiedzi, szacowany koszt,
  model, typ operacji, ewentualnie tokeny z cache), agregacja w widoku panelu admina oraz prosty próg
  dziennego kosztu z sygnałem alertowym.
- Gotowy, jednoklikowy profil „Anthropic (Sonnet + Haiku)" w `/admin/llm` (przypisania modeli do typów
  operacji), przy zachowaniu Groqa jako domyślnego providera.
- Utrwalenie/wzmocnienie guardów na rozmiar danych i historii wysyłanych do modelu (limity zapytań do bazy,
  przycięcie okna historii) tam, gdzie jeszcze ich nie ma.

**Poza zakresem (świadomie):**
- Pełny, sztywny two-tier rebuild agenta (Haiku→Sonnet dla wszystkich zapytań) — odrzucony jako sprzeczny
  z minimalizmem (C-53) i ryzykowny regresyjnie.
- Zmiana domyślnego providera na Anthropic w seedzie (wymuszony płatny klucz) — Groq pozostaje domyślny.
- Autoexekucja operacji zapisu z pominięciem panelu potwierdzenia — zachowujemy dotychczasowy ActionDrawer.
- Pełna abstrakcja „dowolny dostawca w przyszłości" ponad istniejący DB-driven routing — architektura jest
  już na to przygotowana; nie dokładamy nowej złożoności w wersji 1.0.
- Twarde limity/hard-block kosztowe na poziomie globalnym (poza istniejącym budżetem per użytkownik) —
  na razie tylko sygnał/alert po przekroczeniu progu.
- Rozbudowa katalogu narzędzi agenta o nowe moduły (małe, wyspecjalizowane narzędzia już istnieją) —
  poza korektami wynikającymi z fast-path.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** brak nowego sluga modułu. Widok kosztów i profil modeli żyją pod istniejącym
  `module.admin` (`/admin/llm`). Asystent pozostaje pod `module.home`. (C-22)
- **Własność danych:** log wywołań LLM i liczniki kosztów są danymi systemowymi/administracyjnymi
  (per użytkownik-aktor tam, gdzie ma to sens do budżetu), nie zasobem użytkownika ze wzorcem
  `ownerId`/`ownerTeamId`. (C-21 nie dotyczy bezpośrednio)
- **Asystent AI:** rdzeń feature'a. Klasyfikacja intencji + fast-path korzystają z istniejącego typu
  `AIAction` i egzekutorów — **każda** nowa/zmieniona akcja musi mieć egzekutor (C-23). Read-toole i
  routing modeli pozostają DB-driven (C-40).
- **Kalendarz / powiadomienia / trash:** alert kosztowy może wykorzystać istniejący silnik powiadomień
  (bell) dla administratora. Kalendarz i trash — nie dotyczy. Usuwanie przez fast-path korzysta z
  istniejącego soft-delete (C-24), bez zmian w regułach retencji.

## 7. Zgodność z konstytucją

- **C-40 (routing DB-driven)** — kluczowa: klasyfikacja intencji (`dispatch`) i rozumowanie (`reasoning`)
  rozwiązywane przez istniejący resolver per typ operacji; profil Anthropic to dane w `LlmProvider`/
  `LlmAssignment`, nie hardcode.
- **C-41 (klucze szyfrowane/maskowane)** — klucz Anthropic przez istniejący mechanizm szyfrowania i
  maskowania; log kosztów nie zapisuje ani nie zwraca pełnych kluczy.
- **C-23 (każda `AIAction` ma egzekutor)** — fast-path produkuje `AIAction[]`; bramka `check:actions`.
- **C-10..C-14 (migracje)** — log per-wywołanie i ewentualne pola progu wymagają **ręcznych** plików
  migracji, bez enumów Prisma (statusy/typy jako `String` + union TS).
- **C-20 (Server Actions + revalidatePath)** — mutacje konfiguracji/profilu przez Server Actions.
- **C-53 (minimalizm)** — najmniejsze rozwiązanie: rozbudowa istniejącej pętli agenta i warstwy LLM,
  bez nowych zależności ani refaktorów „przy okazji".
- **C-30..C-32 (UX/PL)** — widok kosztów i wybór profilu w ciemnym motywie przez zmienne CSS, teksty po
  polsku, responsywność.
- **C-50/C-52 (build + merge do develop)** — „gotowe" = zielony `npm run build`, potem merge do `develop`.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie kluczowe decyzje rozstrzygnięte w jedynym momencie pytań (C-55) — wybrano rekomendowane domyślne:

- **Zakres 1.0:** pełen fast-path (klasyfikator intencji + deterministyczna ścieżka) + prompt caching +
  logowanie kosztów per-wywołanie. (nie: sam caching; nie: pełny two-tier rebuild)
- **Domyślny provider:** Groq pozostaje domyślny; Anthropic Sonnet/Haiku jako gotowy, wybieralny profil w
  `/admin/llm` + instrukcja. (nie: Anthropic w seedzie)
- **Fast-path a potwierdzanie:** zachowujemy ActionDrawer dla prostych operacji; oszczędzamy tylko na
  modelu (nie uruchamiamy Sonneta). (nie: autoexekucja bez panelu)
- **Głębokość logowania kosztów:** log per-wywołanie (tokeny in/out, czas, szacowany koszt, model, typ
  operacji) + widok admina + próg alertu. (nie: tylko rozszerzenie agregatów dziennych)

Brak dalszych otwartych pytań; kolejne etapy jadą autonomicznie (C-55).

## 9. Ryzyka

- **Błędna klasyfikacja intencji** (prosta uznana za złożoną lub odwrotnie) → fast-path zawsze ma
  bezpieczny fallback do pełnej pętli agenta; przy niepewności klasyfikatora wybieramy agenta, nie zgadujemy.
- **Regresja jakości/UX asystenta** → fast-path działa tylko dla wąskiego, zdefiniowanego zestawu intencji;
  wszystko inne bez zmian; zachowany ActionDrawer i destructive opt-in.
- **Szacowany koszt ≠ realny koszt** (cennik zależny od modelu/dostawcy) → koszt liczony z konfigurowalnego
  cennika per model; jasno oznaczony jako „szacowany"; brak twardego blokowania na jego podstawie.
- **Prompt caching niedostępny/niepoprawny u części dostawców** → oznaczenie cache tylko dla dostawcy, który
  je wspiera; brak zmiany zachowania i brak błędów dla pozostałych.
- **Migracje/koszt DB przy logu per-wywołanie** → log projektowany oszczędnie (retencja/agregacja), zgodnie
  z minimalizmem; ręczne migracje wg C-10..C-14.
