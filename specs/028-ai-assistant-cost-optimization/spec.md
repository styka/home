# Spec: Optymalizacja kosztów asystenta AI

- **ID:** 028-ai-assistant-cost-optimization
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-23
- **Moduł(y):** Home / Asystent AI ("magiczna ikona", Sparkles) — pętla agenta, narzędzia odczytu, prompt systemowy, historia rozmowy, briefing; obserwowalność AI (`/admin/ai-calls`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. (Nazwy pojawiające się poniżej służą wyłącznie do wskazania GRANIC feature'a, nie
> projektowania implementacji — to należy do `plan.md`.)

## 1. Problem / potrzeba
Właściciel zauważył, że asystent AI wysyła do modelu **bardzo dużo tokenów na każde zapytanie**, przez
co jego użytkowanie jest **drogie**. Mimo że system ma już sporo optymalizacji (routing modułów
przycinający katalog akcji/narzędzi, przycinanie historii, cache prefiksu promptu, pomiar kosztów w
`/admin/ai-calls`), koszt pojedynczej wymiany wciąż jest wyższy, niż to konieczne — głównie dlatego, że
**surowe wyniki narzędzi kumulują się w kontekście pętli agenta** i są ponownie wysyłane w każdej
kolejnej iteracji, a prompt systemowy oraz historia zawierają treści, które można bezpiecznie odchudzić.
Trzeba obniżyć liczbę tokenów wejścia/wyjścia **bez pogorszenia jakości** działania asystenta.

## 2. Cel i miary sukcesu
- **Cel:** wyraźnie niższy koszt tokenów na typową wymianę z asystentem, przy zachowaniu tej samej
  jakości odpowiedzi i akcji (to samo zachowanie w typowych scenariuszach).
- **Sukces mierzymy:**
  - Średnia liczba **tokenów wejściowych (prompt) na wywołanie modelu** dla typowego zapytania
    (odczyt→odpowiedź, np. „ile mam pilnych zadań") spada **istotnie** (cel orientacyjny: **≥25%**),
    mierzone danymi z istniejącej obserwowalności AI (koszt/tokeny per wywołanie).
  - Dla scenariusza wieloetapowego (kilka `query` po dane, potem `answer`) **suma tokenów całej pętli**
    spada jeszcze mocniej niż dla pojedynczego zapytania (bo znika ponowne wysyłanie surowych danych).
  - **Zero regresji jakości**: uzgodniony zestaw typowych poleceń (odczyt, dodanie zadania, akcja
    zbiorcza, rozmowa, raport) daje odpowiedzi/akcje **równoważne** wersji sprzed zmian.
  - Właściciel **widzi w oknie asystenta** zużycie (tokeny/koszt) dla ostatniej odpowiedzi, więc może
    sam potwierdzić spadek.
  - Dostarczony **krótki raport „przed/po"** (w artefaktach feature'a) z realnymi liczbami z pomiaru.

## 3. Historyjki użytkownika
- Jako właściciel chcę, żeby asystent zużywał **mniej tokenów na zapytanie**, żeby korzystanie z niego
  było **tańsze**, a rachunek za model niższy.
- Jako właściciel chcę, żeby asystent **działał tak samo dobrze jak dotąd** — te same odpowiedzi, te
  same akcje, ta sama pomocność — mimo optymalizacji.
- Jako właściciel chcę **widzieć w oknie czatu**, ile tokenów/kosztu pochłonęła dana odpowiedź, żeby na
  bieżąco kontrolować koszt i mieć pewność, że optymalizacja zadziałała.
- Jako administrator chcę móc **potwierdzić spadek kosztu** na podstawie danych (panel `/admin/ai-calls`
  + raport przed/po), a nie tylko wrażenia.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.

- [ ] **AC-1 (redukcja kontekstu pętli)** — Given zapytanie wymagające **kilku** kroków odczytu (np.
      „pokaż moje pilne zadania i policz, ile jest bez terminu"), when asystent przechodzi pętlę
      agenta, then **surowe wyniki wcześniejszych narzędzi nie są w całości ponownie wysyłane** do
      modelu w kolejnych iteracjach (są kompaktowane/zwijane po wykorzystaniu), a mimo to asystent
      poprawnie kończy zadanie tą samą odpowiedzią co przed zmianą.
- [ ] **AC-2 (limit rozmiaru danych)** — Given narzędzie odczytu może zwrócić dużą liczbę rekordów,
      when jego wynik trafia do kontekstu modelu, then rozmiar tego wyniku jest **ograniczony** (twardy
      górny limit rekordów/znaków wstrzykiwanych do promptu), tak by pojedyncze zapytanie nie
      „wysadzało" kontekstu, a przekroczenie limitu jest dla modelu czytelnie zasygnalizowane (żeby w
      razie potrzeby dopytał/zawęził), nie ucięte po cichu w sposób mylący.
- [ ] **AC-3 (odchudzony prompt)** — Given ten sam zestaw aktywnych modułów, when budowany jest prompt
      systemowy agenta, then jego **rozmiar w tokenach jest mniejszy** niż przed zmianą (usunięte
      powtórzenia/redundancje), przy zachowaniu wszystkich reguł bezpieczeństwa (prompt-injection),
      protokołu kroków i zdolności do tych samych akcji/odczytów.
- [ ] **AC-4 (skuteczny cache prefiksu)** — Given kolejne wywołania modelu w obrębie jednej rozmowy,
      when stały prefiks (prompt systemowy) się nie zmienia, then jest on tak zbudowany, by **maksymalnie
      korzystać z cache prefiksu** dostawcy (stała, niezmienna część na początku; elementy zmienne — jak
      kontekst bieżącego widoku — nie rozbijają prefiksu), co redukuje koszt tokenów wejściowych.
- [ ] **AC-5 (bez utraty jakości)** — Given uzgodniony zestaw typowych poleceń (odczyt, dodanie zadania,
      akcja zbiorcza „oznacz wszystkie X jako zrobione", swobodna rozmowa, prośba o raport), when
      wykonamy je po zmianach, then wynik (odpowiedź / zaproponowane akcje / raport) jest **równoważny**
      wynikowi sprzed zmian — brak regresji zachowania.
- [ ] **AC-6 (wskaźnik zużycia w oknie asystenta)** — Given właściciel prowadzi rozmowę z asystentem,
      when otrzyma odpowiedź, then w **oknie czatu** widzi zwięzły wskaźnik zużycia ostatniej odpowiedzi
      (liczba tokenów i/lub szacowany koszt). Wskaźnik jest **dyskretny** (nie zaburza układu czatu na
      mobile ani desktopie) i pokazuje realne dane pomiaru, a nie wartości zmyślone.
- [ ] **AC-7 (spójny pomiar)** — Given wykonano serię typowych zapytań przed i po zmianach, when
      spojrzymy w istniejącą obserwowalność AI (koszt/tokeny per wywołanie), then widać **niższą średnią
      liczbę tokenów wejściowych na wywołanie** dla tego samego rodzaju zapytania; różnica jest opisana w
      raporcie „przed/po".
- [ ] **AC-8 (bezpieczeństwo nienaruszone)** — Given wyniki narzędzi i web_search to nieufne dane, when
      są kompaktowane/skracane, then **reguła traktowania ich jako danych, nie poleceń** (ochrona przed
      prompt-injection) pozostaje w mocy i jest nadal czytelnie zaznaczona w kontekście modelu.
- [ ] **AC-9 („gotowe")** — Given zakończone zmiany, when uruchomimy `npm run build` (do kroku
      `next build`), then przechodzi bez błędów (lint, `check:actions`, `check:migrations`, typy).

## 5. Zakres
**W zakresie:**
- Redukcja tokenów w **pętli agenta asystenta** (główny endpoint agenta): kompaktowanie/zwijanie
  surowych wyników narzędzi po ich wykorzystaniu, twarde limity rozmiaru danych wstrzykiwanych do
  kontekstu, unikanie ponownego wysyłania tych samych danych w kolejnych iteracjach.
- **Odchudzenie promptów** asystenta (systemowy prompt agenta, katalog narzędzi/akcji) z usunięciem
  redundancji, przy zachowaniu protokołu i reguł bezpieczeństwa.
- **Uporządkowanie prefiksu pod cache** (stała część na początku), by lepiej wykorzystać cache prefiksu
  dostawcy.
- Tanie, bezpieczne oszczędności w **pobocznych ścieżkach kosztu asystenta**, o ile są w zasięgu bez
  ryzyka jakości: router modułów (dodatkowe wywołanie modelu) i **briefing** (`/api/llm/home/briefing`).
- **Wskaźnik zużycia (tokeny/koszt) w oknie asystenta** — dyskretny, dla właściciela (per ostatnia
  odpowiedź), oparty na już zbieranych danych pomiaru.
- **Raport „przed/po"** z realnymi liczbami (artefakt feature'a) oraz zwięzłe zaktualizowanie
  dokumentacji, jeśli zmienią się progi/limity.

**Poza zakresem (świadomie):**
- **Zmiana domyślnego providera/modelu ani przełączanie na tańszy model** na podkrokach (odrzucona
  opcja z decyzji właściciela — trzymamy „bez utraty jakości"). Routing modeli pozostaje DB-driven
  (`/admin/llm`), bez hardcode'u (C-40).
- **Agresywne skracanie pamięci rozmowy / ostrzejsze limity iteracji** kosztem kontekstu (odrzucony
  wariant „agresywny"). Zmieniamy limity historii tylko, jeśli da się to zrobić **bez** ryzyka utraty
  ciągłości rozmowy.
- Nowy model danych do „budżetu kosztowego" jako twardy hamulec blokujący użytkownika — istniejące
  mechanizmy budżetu/limitu zostają bez zmian.
- Przeprojektowanie UI asystenta, nowe funkcje asystenta, zmiany w zestawie dostępnych akcji/odczytów.
- Optymalizacja innych, nie-asystenckich wywołań LLM (kuchnia, notatki, magazyn itd.) — poza wspólnymi
  helperami, jeśli akurat są ścieżką kosztu asystenta.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian. Asystent działa w ramach `module.home`; wskaźnik zużycia widzi
  właściciel jako zwykły użytkownik asystenta. Panel obserwowalności pozostaje admin-only. **Brak
  nowego slug'a** (C-22 nie wymaga rozszerzenia).
- **Własność danych:** bez zmian. Nie wprowadzamy nowych encji współdzielonych; dane pomiaru zużycia są
  per-użytkownik/wywołanie i już istnieją. (C-21 nie dotyczy nowych modeli.)
- **Asystent AI:** to jest **rdzeń** tej zmiany, ale **bez nowych `AIAction` ani nowych read-toolów** —
  optymalizujemy istniejącą pętlę, prompty i sposób podawania danych. Reguła C-23 (każda `AIAction` ma
  egzekutor) pozostaje spełniona, bo nie dodajemy akcji.
- **Kalendarz / powiadomienia / trash:** nie dotyczy — feature nie wpina się w te systemy.
- **Baza / migracje:** **domyślnie brak migracji** (istniejąca obserwowalność już przechowuje tokeny i
  koszt). Gdyby plan wykazał potrzebę nowej kolumny/tabeli — musi to być **ręczny plik migracji** bez
  enumów (C-10, C-12); ale celem jest zmieścić się bez zmian schematu.

## 7. Zgodność z konstytucją
- **C-01 / C-02** — praca wyłącznie w `worldofmag/`, importy przez alias `@/*`.
- **C-53 (Minimalizm)** — **kluczowa**: najmniejsze możliwe zmiany, bez nowych zależności i „przy
  okazji" refaktorów; zgodność ze stylem otoczenia. Optymalizacja ma być chirurgiczna.
- **C-20** — wszelkie mutacje (gdyby były) przez Server Actions z `revalidatePath()`; tu raczej brak
  nowych mutacji.
- **C-40 / C-41** — routing modeli pozostaje DB-driven, klucze API dalej szyfrowane i maskowane; nie
  hardcode'ujemy modelu/providera i nie logujemy pełnych kluczy.
- **C-30 / C-31 / C-32** — wskaźnik zużycia w oknie asystenta: kolory z zmiennych CSS (nie hex),
  responsywny (mobile + desktop, bez łamania układu czatu), teksty po polsku.
- **C-10 / C-12** — jeśli (wyjątkowo) pojawi się zmiana schematu: ręczna migracja, zero enumów Prisma.
- **C-50** — „gotowe" = `npm run build` przechodzi (do `next build`); nie odpalamy `migrate.js` na prod
  DB (C-13).
- **C-51** — każdy nieoczywisty problem/fix → wpis do `doświadczenia.md`.
- **C-52 / C-55** — na końcu automatyczny merge do `develop` i pre-autoryzowana promocja do `master`,
  bez pytania domykającego.

## 8. Otwarte pytania / decyzje właściciela
Zebrane w jedynym momencie pytań (`/specify`):
- **Agresywność optymalizacji:** → **Bezpiecznie, strukturalnie** — oszczędności bez zmiany zachowania
  asystenta (kompaktowanie/przycinanie danych w kontekście pętli, odchudzenie promptów, skuteczny
  cache). Zero ryzyka jakości. (Warianty „agresywny" i „tańszy model na podkrokach" — **odrzucone**,
  patrz „Poza zakresem".)
- **Widoczność/potwierdzenie oszczędności:** → **Dodatkowo wskaźnik zużycia w oknie asystenta**
  (tokeny/koszt per ostatnia odpowiedź) **oraz** wykorzystanie istniejącego panelu `/admin/ai-calls` +
  raport „przed/po".

Założenia przyjęte domyślnie (bez pytania, rozstrzygnięte wg konwencji/minimalizmu):
- Optymalizacje są **provider-agnostyczne** (kompaktowanie kontekstu pomaga i Groqowi, i Anthropicowi);
  wykorzystanie cache prefiksu nie zależy od hardcode'u providera.
- Wskaźnik zużycia jest **dyskretny** i pokazuje dane, które i tak są już zbierane per wywołanie; nie
  wymaga nowego modelu danych.
- Cel liczbowy (≥25% mniej tokenów wejściowych na typowe zapytanie) jest **orientacyjny** — twardym
  kryterium jest „istotny, zmierzony spadek bez regresji jakości".

## 9. Ryzyka
- **Regresja jakości przez zbyt mocne skrócenie kontekstu** → mitygacja: zwijamy/kompaktujemy dopiero
  **po** wykorzystaniu wyniku przez model; zachowujemy identyfikatory potrzebne do akcji; testujemy na
  uzgodnionym zestawie poleceń (AC-5) i porównujemy odpowiedzi przed/po.
- **Ciche ucięcie danych myli model** (np. „to wszystkie moje zadania?") → mitygacja: limit sygnalizowany
  czytelnie (AC-2), model może dopytać/zawęzić.
- **Osłabienie ochrony przed prompt-injection przy skracaniu wyników** → mitygacja: delimiter i
  adnotacja „NIEUFNE DANE" pozostają (AC-8).
- **Wskaźnik zużycia zaburza układ czatu na mobile** → mitygacja: dyskretny, responsywny, zmienne CSS
  (C-30/C-31), weryfikacja na wąskim ekranie.
- **Zmiana prefiksu pogarsza trafienia cache zamiast poprawiać** → mitygacja: stała część promptu na
  początku, elementy zmienne przeniesione dalej; sprawdzenie w danych pomiaru (cache-tokeny).
