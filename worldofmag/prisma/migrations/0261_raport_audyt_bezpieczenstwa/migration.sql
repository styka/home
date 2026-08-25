-- 101 (spec 101-audyt-bezpieczenstwa, AC-1..AC-5, AC-8) — RAPORT Z AUDYTU BEZPIECZEŃSTWA.
--
-- Raport trafia tam, gdzie właściciel już czyta o systemie: do `/reports`, seedowany idempotentną
-- migracją SQL — konwencją opisaną w CLAUDE.md i użytą m.in. przez 0239 i 0252.
--
-- Migracja NIE zmienia kształtu bazy: wyłącznie jeden `INSERT` z `ON CONFLICT DO NOTHING`.
-- Nie ma tu żadnego CREATE / ALTER / DROP i nie powinno się pojawić przy edycji.
--
-- Zawartość świadomie NIE zawiera żadnej wartości sekretu, adresu bazy ani fragmentu klucza (C-41);
-- opisuje mechanizmy, nie dane. Rzeczy, których nie da się potwierdzić z repozytorium, są oznaczone
-- „[do potwierdzenia]" — w audycie zgadywanie jest gorsze niż jawnie zaznaczona luka.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "storage", "authorId", "teamId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Audyt bezpieczeństwa — sierpień 2026',
  'audyt-bezpieczenstwa-2026-08',
  $raport_audyt$# Audyt bezpieczeństwa Omnii

**Stan na:** sierpień 2026 · **Zakres:** cała droga danych — przeglądarka → hosting → aplikacja → baza → usługi zewnętrzne

Ten raport powstał, żeby odpowiedzieć na pytanie zadane przed otwarciem aplikacji na szersze grono: *czy mamy wszystkie potrzebne zabezpieczenia i czy wszystkie połączenia są chronione*. Opisuje stan na dzień powyżej — nie jest dokumentem wiecznym.

---

## 1. Podsumowanie w pięciu zdaniach

Fundamenty są **w dobrym stanie**: dostęp do danych jest liczony po właścicielu i przestrzeni, uprawnienia odświeżają się przy każdym dotknięciu sesji, klucze API są szyfrowane, a osobne bramki w budowaniu pilnują rzeczy, o których człowiek zapomina. Aplikacja **nie wysyłała jednak przeglądarce żadnych nagłówków bezpieczeństwa** i miała dwie luki, które w architekturze jednoosobowej były niegroźne, a przy wielu użytkownikach przestają takie być. Wszystkie trzy zostały **naprawione w tej samej zmianie**, w której powstał ten raport. Najpilniejsza rzecz, jaka pozostaje, to **aktualizacja zależności** — jest wśród nich podatność krytyczna w bibliotece odpowiadającej za logowanie. Poza tym aplikacja nie ma polityki bezpieczeństwa treści (CSP), co jest największym pojedynczym brakiem do nadrobienia w przyszłości.

**Trzy rzeczy do zrobienia w tej kolejności:**

1. Zaktualizować podatne zależności (naprawa **nie jest** zmianą łamiącą — patrz U-04).
2. Włączyć drugi składnik logowania na kontach: Google, hosting, baza (patrz rozdział 6).
3. Zaplanować politykę bezpieczeństwa treści jako osobną zmianę z własną weryfikacją (U-06).

---

## 2. Architektura — którędy płyną dane

```
Przeglądarka
   │  TLS (certyfikat hostingu, ruch po HTTP przekierowywany na HTTPS)
   ▼
Usługa web na Renderze (Frankfurt)
   │  ├─ warstwa web (Next.js, App Router)
   │  ├─ kolejka zadań w tle
   │  └─ zadania cykliczne (retencja, metryki)
   │     rozdzielane zmienną roli procesu
   │
   │  TLS (sslmode=require)
   ▼
Neon PostgreSQL (Frankfurt)
```

**Obok tej osi** aplikacja rozmawia jeszcze z: logowaniem Google (OAuth — hasła nigdy nie trafiają do Omnii), Dyskiem Google (osobna, dobrowolna zgoda o wąskim zakresie: tylko pliki założone przez aplikację), dostawcami modeli językowych i syntezy mowy (klucze trzymane w bazie, szyfrowane), oraz kilkoma usługami bezkluczowymi (pogoda, kanały RSS, trasowanie, mapy).

**Środowiska są dwa i to jest celowe:** gałąź testowa na planie darmowym (usypia po kwadransie) i produkcja na planie płatnym (nie usypia — od tego zależy działanie kolejki zadań).

**Każdy odcinek tej drogi jest szyfrowany.** Ruch przeglądarka ↔ hosting chroni certyfikat wystawiany automatycznie przez hosting; połączenie aplikacja ↔ baza wymaga TLS-u po stronie sterownika. *[do potwierdzenia]* — czy produkcyjny adres bazy faktycznie niesie wymóg TLS: w repozytorium jest to udokumentowane, ale sama wartość jest sekretem po stronie hostingu i nie da się jej odczytać z kodu.

---

## 3. Ustalenia

Waga oznacza skutek **przy wielu użytkownikach**, a nie przy dzisiejszym jednym.

### 3.1 Naprawione w tej zmianie

| # | Ustalenie | Waga | Stan |
|---|---|---|---|
| U-01 | **Brak jakichkolwiek nagłówków bezpieczeństwa.** Aplikacja nie wymuszała HTTPS, nie broniła się przed osadzeniem w cudzej ramce, nie blokowała zgadywania typu treści i nie ograniczała adresów wyciekających w nagłówku odsyłacza | wysoka | naprawione |
| U-02 | **Treść ikony kategorii trafiała do przeglądarki innego użytkownika bez filtrowania.** Ikonę zapisuje dowolny zalogowany użytkownik, a lista aktywnych ikon obejmuje **także ikony zespołów** — więc treść jednej osoby renderowała się u drugiej. To jest podręcznikowa droga do przejęcia cudzej sesji | wysoka | naprawione |
| U-03 | **Zastępczy sekret podpisujący sesje leżał w repozytorium.** Kod podstawiał stałą wartość, gdy brakowało zmiennej środowiskowej. Gdyby zabrakło jej na produkcji, aplikacja **działałaby normalnie**, podpisując sesje sekretem znanym każdemu, kto widział kod — czyli pozwalając podrobić cudzą sesję. Nic tego nie pilnowało | wysoka (warunkowa) | naprawione |

**Co konkretnie zrobiono:** dołożono komplet podstawowych nagłówków odpowiedzi; treść ikon przechodzi teraz przez białą listę elementów rysunkowych — i przy zapisie, i przy wyświetleniu, bo w bazie leżą już wiersze sprzed poprawki; a start aplikacji **zatrzymuje się z czytelnym błędem**, gdy sekret sesji nie jest ustawiony (budowanie nadal działa bez niego).

### 3.2 Do zrobienia — rekomendacje

| # | Ustalenie | Waga |
|---|---|---|
| U-04 | **12 podatnych zależności: 3 krytyczne, 8 wysokich.** Krytyczna dotyczy **biblioteki logowania** — m.in. ciasteczka kontrolne protokołu OAuth niepowiązane z dostawcą, który je wystawił. **Naprawa nie jest zmianą łamiącą.** Świadomie nie weszła do tej zmiany: aktualizacja biblioteki uwierzytelniania musi iść osobnym commitem, żeby — gdy zepsuje logowanie — nie szukać jej w zmianach z nagłówkami. **To jest rekomendacja numer jeden** | krytyczna |
| U-05 | Podatność w silniku aplikacji (ujawnianie punktów końcowych funkcji serwerowych) wymaga przejścia na następną **główną** wersję. Zadanie planowe, z własną weryfikacją | wysoka |
| U-06 | **Brak polityki bezpieczeństwa treści (CSP).** Świadomie odłożone: aplikacja używa stylów osadzanych, map i syntezy mowy, więc restrykcyjna polityka wymaga osobnego przebiegu z listą wyjątków — źle wdrożona psuje działającą aplikację | wysoka |
| U-07 | **Feed kalendarza: token w adresie, bez ograniczenia liczby żądań.** Trasa jest celowo poza bramką sesji (klient kalendarza nie ma sesji), token jest odwoływalny, a zakres danych poprawny — ale nic nie ogranicza zgadywania tokenu. Dodany w tej zmianie nagłówek odsyłacza zmniejsza ryzyko wycieku samego adresu | średnia |
| U-08 | **Sekrety zapisane przed wprowadzeniem szyfrowania zostają jawne** do czasu pierwszego ponownego zapisu. Wskazane jednorazowe przepisanie wszystkich kluczy w panelu | średnia |
| U-09 | Klucz szyfrowania sekretów miał awaryjne oparcie o stałą z repozytorium. **Domknięte pośrednio** przez naprawę U-03 (gałąź stała się nieosiągalna), ale docelowo klucz powinien mieć własną zmienną — dziś jego rotacja unieważnia zapisane klucze API, o czym aplikacja ostrzega przy starcie | średnia |
| U-10 | **Logowanie wyłącznie przez Google, bez drugiego składnika po stronie aplikacji.** Siła zabezpieczenia równa się ustawieniom konta Google — patrz rozdział 6 | średnia |
| U-11 | Uproszczone logowanie na potrzeby testów jest wyłączane **jedną zmienną środowiskową**. Zabezpieczenie działa, ale jest jednopunktowe; warto dodatkowo odciąć je warunkiem środowiska produkcyjnego | średnia |

### 3.3 Sprawdzone i w porządku

| Obszar | Ustalenie |
|---|---|
| Bramkowanie tras | Sesja sprawdzana warstwą pośrednią dla całej aplikacji, uprawnienie modułu — w układzie trasy, dodatkowo pilnowane osobną bramką w budowaniu (U-12) |
| Role i uprawnienia | Model ról z zabezpieczeniem przed odcięciem ostatniego administratora (U-13) |
| Odbieranie dostępu | Uprawnienia czytane przy **każdym** dotknięciu sesji — odebranie roli działa natychmiast, bez czekania na wygaśnięcie (U-14) |
| Wstrzyknięcia SQL | Cztery użycia surowego SQL-a; wszystkie parametryzowane, a wstawki pochodzą wyłącznie ze stałych wewnętrznych. **Brak powierzchni ataku** (U-15) |
| Treść od użytkownika | Renderowanie znaczników escapuje znaki sterujące globalnie, przed złożeniem dokumentu (U-16) |
| Klucze API | Szyfrowane algorytmem z uwierzytelnianiem treści, maskowane w interfejsie (U-17) |
| Sekrety w konfiguracji | Wszystkie oznaczone jako niesynchronizowane z repozytorium; w repozytorium **nie ma** pliku ze zmiennymi, jedynie wzór (U-18) |
| Nadużycia | Ograniczanie liczby żądań oparte na bazie (okna czasowe + dzierżawy slotów) — działa poprawnie także przy wielu instancjach aplikacji (U-19) |
| Koszty AI | Budżety z wyłącznikiem awaryjnym sprawdzanym bezwarunkowo, także dla zadań w tle (U-20) |
| Dziennik zmian | Zmiany uprawnień i konfiguracji zapisywane bez powiązania z kontem — historia przeżywa usunięcie użytkownika (U-21) |
| Retencja | Automatyczne czyszczenie z atomowym przejmowaniem prawa do przebiegu (U-22) |
| Prawa użytkownika | Eksport danych i usunięcie konta wraz z danymi (U-23) |
| Logi | Strukturalne, z czyszczeniem danych osobowych; surowe wypisywanie na konsolę zablokowane bramką (U-24) |
| Zapisy z formularzy | Lista dozwolonych źródeł ograniczona do trzech znanych adresów (U-25) |
| Otwartość API | Brak nagłówków zezwalających na wywołania z innych stron — API jest wyłącznie wewnętrzne (U-26) |

---

## 4. Sekrety — co przechowujemy i co się stanie, gdy wyciekną

| Sekret | Gdzie | Chroniony | Skutek wycieku |
|---|---|---|---|
| Sekret podpisujący sesje | zmienna środowiskowa hostingu | nie dotyczy (nie jest w bazie) | **najgorszy** — pozwala podrobić sesję dowolnego użytkownika; wymaga natychmiastowej rotacji i wylogowania wszystkich |
| Dane logowania Google (aplikacji) | zmienne środowiskowe hostingu | nie dotyczy | podszycie się pod aplikację w procesie logowania |
| Adres bazy z hasłem | zmienna środowiskowa hostingu | nie dotyczy | pełny dostęp do danych wszystkich użytkowników |
| Klucze API modeli | baza | **szyfrowane**, maskowane w interfejsie | rachunek u dostawcy, bez dostępu do danych |
| Dane dostępowe do Dysku użytkownika | baza | zakres wąski (tylko pliki aplikacji) | dostęp do plików założonych przez Omnię, nie do całego Dysku |
| Token feedu kalendarza | baza | odwoływalny | odczyt agendy jednego użytkownika; unieważniany wymianą tokenu |

**Zasada, która się tu broni:** żaden sekret nie jest w repozytorium, a te trzymane w bazie są szyfrowane. Rotacja sekretu sesji jest operacją bezpieczną, ale wylogowuje wszystkich — i, dopóki nie ma osobnej zmiennej na klucz szyfrujący (U-09), unieważnia też zapisane klucze API.

---

## 5. Czego ten audyt nie obejmował

Żeby raport nie sugerował większej pewności, niż daje: **nie było** testów penetracyjnych, skanowania podatności z zewnątrz ani audytu firmy trzeciej. Nie weryfikowano też ustawień w panelach hostingu, bazy i Google — środowisko, w którym powstał ten raport, nie ma do nich dostępu. Wszystko, co wymaga takiego potwierdzenia, jest w tekście oznaczone *[do potwierdzenia]*.

---

## 6. Dostęp do maszyny i baz — odpowiedź na pytanie „czy zrobić SSH"

**Krótko: nie należy stawiać własnego serwera SSH.** Hosting jest usługą zarządzaną. Własny serwer SSH nie dołożyłby żadnego zabezpieczenia, a dołożyłby **kolejną drogę wejścia** do pilnowania, łatania i monitorowania — czyli pogorszyłby stan, który ten audyt ma poprawić.

**Dostęp do powłoki już istnieje i wystarcza:** panel hostingu udostępnia konsolę w działającym kontenerze (tam wykonuje się jednorazowe czynności, np. zasilenie danymi po wdrożeniu), a do bazy łączy się zwykłym klientem po TLS.

**Wniosek, który z tego płynie, jest ważniejszy niż samo SSH.** Skoro dostęp do powłoki i do bazy daje **konto w panelu**, to faktycznym zabezpieczeniem produkcji nie jest żaden mechanizm w kodzie Omnii, tylko siła logowania do trzech kont: Google, hosting, baza. Stąd rekomendacja: **włączyć na wszystkich trzech drugi składnik logowania** i sprawdzić, kto poza właścicielem ma do nich dostęp.

*[do potwierdzenia]* — czy drugi składnik jest włączony na tych kontach i czy lista osób z dostępem jest aktualna.

---

## 7. Co zrobić przed otwarciem aplikacji na wiele osób

1. **Zaktualizować zależności** (U-04) — osobną zmianą, zaczynając od biblioteki logowania.
2. **Drugi składnik logowania** na kontach Google / hosting / baza (U-10, rozdział 6).
3. **Polityka bezpieczeństwa treści** (U-06) — osobny przebieg z listą wyjątków.
4. **Ograniczyć liczbę żądań do feedu kalendarza** (U-07).
5. **Przepisać zapisane klucze API**, żeby dokończyć ich szyfrowanie (U-08).
6. **Własna zmienna na klucz szyfrujący sekrety** (U-09).
7. **Odciąć uproszczone logowanie testowe** dodatkowym warunkiem środowiska (U-11).
8. **Zaplanować powtórkę tego audytu** — dokument opisuje stan na sierpień 2026 i zestarzeje się razem z kodem.
$raport_audyt$,
  'system',
  'db',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
