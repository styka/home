# Umiędzynarodowienie, bezpieczeństwo i zgodność

## 1. Wielojęzyczność — dlaczego teraz albo nigdy

Koszt wyciągnięcia tekstów z komponentów jest **liniowy względem rozmiaru kodu** i **niezależny od
liczby użytkowników**. To nietypowa krzywa: każdy tydzień rozwoju to więcej tekstów do wyciągnięcia
i więcej miejsc, w których nowy kod wprowadzi je z powrotem.

Przy zamrożonym repozytorium to praca mechaniczna, wykonywana modułami. Przy aktywnym rozwoju —
nieustanne konflikty scaleń.

### 1.1. Zakres

| Wchodzi | Nie wchodzi |
|---------|-------------|
| `next-intl` (obsługuje komponenty serwerowe App Routera) | tłumaczenia na inne języki |
| Wyciągnięcie tekstów do `messages/pl.json`, moduł po module | lokalizacja treści użytkownika |
| Formatowanie dat, liczb, walut przez `Intl` | tłumaczenie odpowiedzi AI |
| Język i strefa czasowa w ustawieniach **przestrzeni** (rozdz. 8.2) | RTL (dopiero przy rynku wymagającym) |

**Sygnał kontrolny:** jeśli po tej fazie dodanie języka to praca **tłumacza, a nie programisty** —
cel osiągnięty.

### 1.2. Zmiana konstytucji — krok obowiązkowy

Reguła `C-32` mówi dziś **„teksty UI po polsku"**. Po tej fazie musi znaczyć:

> **`C-32` — teksty UI przez `t()`, polski jako język źródłowy. Żadnych literałów w komponentach.**

**Bez tej zmiany kolejne sesje Claude Code będą przywracać stary wzorzec, bo tak każe im
konstytucja.** To nie jest formalność — to warunek trwałości całej fazy.

### 1.3. Uwaga o AI

Prompty traktują nazwy kategorii jako **polskie słowa** (`C-32`). Przy wielu językach model musi
dostać język przestrzeni w kontekście, inaczej kategoryzacja będzie się mylić. To osobne zadanie
w Fazie 7, nie efekt uboczny.

## 2. Izolacja najemców — funkcja krytyczna

**Przy współdzieleniu ta kwestia zmienia charakter.** Wcześniej pytanie brzmiało: „czy użytkownik B
widzi dane użytkownika A?". Teraz brzmi:

> **„Czy użytkownik B widzi dokładnie to, co mu udostępniono — nie mniej i nie więcej?"**

To trudniejsze pytanie i wymaga trzech warstw testów:

| Test | Co sprawdza | Generowany z |
|------|-------------|--------------|
| **Izolacja podstawowa** | B nie widzi prywatnych danych A | manifest akcji (545 pozycji) |
| **Poprawność nadania** | B z rolą `viewer` czyta, ale nie edytuje | deklaracje `resources` w `module.ts` |
| **Odwołanie dostępu** | po odebraniu nadania B traci dostęp **natychmiast**, także przy aktywnym SSE | scenariusz E2E |

**Trzeci test jest nowy i nieoczywisty** — cache dostępu (11.5) wprowadza ryzyko, że odebranie
uprawnień zadziała dopiero po wygaśnięciu wpisu. To byłaby dziura bezpieczeństwa **wprowadzona przez
optymalizację**.

### 2.1. Asystent AI jako droga obejścia

Read-toole asystenta muszą przechodzić przez `requireAccess`, a nie przez `where: { ownerId }`.
Inaczej użytkownik z dostępem `viewer` do projektu mógłby poprosić asystenta o zmianę zadania —
i asystent by ją wykonał, bo działa „w imieniu użytkownika" bez sprawdzenia roli.

**To jest realne zagrożenie i musi mieć własny test.** Przy 160 akcjach AI nie da się tego
zweryfikować ręcznie.

## 3. Zgodność prawna (RODO)

Przy 100 tys. kont w Unii Europejskiej to **obowiązki**, nie funkcje:

| Obowiązek | Realizacja | Komplikacja przy współdzieleniu |
|-----------|------------|----------------------------------|
| Eksport danych | ZIP z JSON per moduł, generowany zadaniem w tle | Czy eksportować zasoby **udostępnione** użytkownikowi? **Nie** — należą do właściciela; eksportujemy fakt nadania |
| Usunięcie konta | Kaskada + anonimizacja tam, gdzie kaskada niemożliwa | Zasoby w przestrzeni osobistej → usunięcie. **Zasoby w przestrzeni zespołowej → przekazanie właścicielowi przestrzeni**, nie usunięcie |
| Ślad audytowy | `AuditLog` bez FK do `User` (snapshot e-maila) — **już zrobione** | Nadania i odwołania dostępu do dziennika |
| Retencja | Rozdział 11.6 | — |
| Zgody | `ConsentBanner` istnieje | Rozszerzyć o zgodę na przetwarzanie przez model AI |

**Uwaga o usunięciu konta jest istotna produktowo:** jeśli członek zespołu usunie konto, zespół nie
może stracić wspólnych danych. To decyzja projektowa, którą trzeba podjąć **przed** wdrożeniem
usuwania, a nie po pierwszym zgłoszeniu.

## 4. Bezpieczeństwo przy otwartej rejestracji

Dziś rejestracja jest przez Google OAuth i faktycznie zamknięta. Przy otwarciu:

| Ryzyko | Ograniczenie |
|--------|--------------|
| Masowe zakładanie kont | rate-limit rejestracji (rozdz. 11.2) |
| Spam zaproszeniami | limit zaproszeń per użytkownik/dobę |
| Nadużycie kosztu AI | budżety (rozdz. 11.3) |
| Linki do udostępnień odgadywane | token losowy ≥128 bitów, termin ważności, odwoływalność |
| Eskalacja przez zasób współdzielony | test poprawności nadania (punkt 2) |
| Wyciek klucza API | już szyfrowane i maskowane (`C-41`) — bez zmian |

## 5. Kopie zapasowe i odtwarzanie

Neon ma PITR — ale **„ma PITR" to nie to samo co „umiemy odtworzyć"**.

**Wymóg:** przeprowadzona **próba odtworzenia**, opisana w `docs/devops/`, z podanym realnym czasem
i listą kroków. Bez tego jest to założenie, nie zabezpieczenie.

Do sprawdzenia przy próbie: czy po odtworzeniu zgadzają się nadania dostępu i przestrzenie — bo to
nowe tabele, których dzisiejszy runbook nie zna.

## 6. Koszty — rząd wielkości

| Pozycja | Dziś | Po przebudowie, 100 tys. kont | Uwaga |
|---------|------|-------------------------------|-------|
| Hosting | 1 instancja płatna | 2–4 × web + 1 worker + 1 cron | rozdzielenie procesów |
| Baza | Neon | Neon z pulą + replika odczytu | partycjonowanie dopiero przy Progu C |
| Redis | brak | mały | limity + pub/sub; da się zastąpić bazą |
| **LLM** | grosze | **największa pozycja** | bez budżetów nieprzewidywalna |
| Obserwowalność | brak | mała | bez niej diagnozowanie to zgadywanie |

**Najważniejsza obserwacja kosztowa:** po przebudowie największym kosztem operacyjnym **nie będzie
hosting, tylko model językowy**. Dlatego budżety AI mają priorytet równy zagrożeniom technicznym.
