# Spec: Poprawki zgłoszeń administratora — słówka bez limitu, zadanie w dialogu, weryfikacja skórek

- **ID:** 121-zgloszenia-slowka-zadania-skorka
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-02
- **Moduł(y):** Języki / Zadania / Skórki (ustawienia wyglądu — wyłącznie weryfikacja)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Administrator zgłosił z aplikacji trzy problemy. (1) W module Języki funkcja „Dodaj słówka
z tekstu (AI)" przygotowuje najwyżej 25 słówek, choć podany tekst zawiera ich więcej —
użytkownik oczekuje **wszystkich** słówek z tekstu, a nie arbitralnej próbki. (2) Na stronie
modułu Zadania formularz tworzenia zadania jest wpięty na stałe w treść strony i zabiera jej
przestrzeń nawet wtedy, gdy nikt niczego nie dodaje; właściciel chce w tym miejscu przycisku
otwierającego okno dialogowe — dokładnie tak, jak działa już dodawanie projektu na tej samej
stronie i dodawanie zadania w widoku projektu (przebieg 118). (3) Generowanie skórki przez AI
z opisu słownego zakończyło się „błędem o formacie" — to zgłoszenie zostało już rozwiązane
przebiegiem `119-skin-generate-format-fix` (scalonym i wdrożonym na produkcję po dacie
zgłoszenia), więc wchodzi do tego przebiegu wyłącznie jako pozycja do zweryfikowania, żeby
żadne zgłoszenie nie zginęło.

## 2. Cel i miary sukcesu

- Cel: wszystkie trzy zgłoszenia administratora są zamknięte — dwa poprawką w produkcie,
  trzecie potwierdzoną weryfikacją, że wcześniejsza poprawka pokrywa zgłoszony przypadek.
- Sukces mierzymy:
  - z tekstu zawierającego wyraźnie więcej niż 25 słów nadających się do nauki funkcja
    „Dodaj słówka z tekstu (AI)" przygotowuje listę obejmującą słownictwo całego tekstu,
    a nie pierwsze/wybrane 25;
  - na stronie modułu Zadania nie ma stałego, rozwiniętego formularza tworzenia zadania;
    jest przycisk, po którego naciśnięciu zadanie dodaje się w oknie dialogowym — spójnie
    z dodawaniem projektu obok i z widokiem projektu;
  - weryfikacja potwierdza, że zgłoszony błąd formatu generowania skórki nie występuje
    na bieżącym kodzie (pokrycie przez 119), bez ponownej implementacji.

## 3. Historyjki użytkownika

- Jako uczący się języka wklejam dowolnie długi tekst (artykuł, transkrypcję, kod) i chcę
  dostać do przeglądu **wszystkie** słówka z tego tekstu warte nauki, żeby nic mi nie umknęło
  tylko dlatego, że tekst był dłuższy niż arbitralny próg.
- Jako użytkownik modułu Zadania wchodzę na stronę modułu i chcę mieć czytelny przycisk
  „dodaj zadanie", który otwiera okno dialogowe — a nie stały formularz zajmujący górę strony;
  po zapisaniu chcę trafić tam, gdzie dotąd (szczegóły nowego zadania w jego projekcie).
- Jako administrator, który zgłosił błąd formatu skórki, chcę mieć pewność, że problem jest
  rozwiązany na wdrożonym kodzie — bez zgadywania, czy moje zgłoszenie przepadło.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given tekst źródłowy zawierający wyraźnie więcej niż 25 różnych słów nadających
  się do nauki (np. 60+), when użytkownik uruchamia „Dodaj słówka z tekstu (AI)" na stronie
  talii, then przygotowana lista nie jest ucinana do 25 ani do żadnego innego sztywnego progu
  — obejmuje słownictwo całego tekstu (z zachowaniem dotychczasowej jakości: bez duplikatów,
  z tłumaczeniami; dalszy los listy — dopisanie do talii albo przegląd propozycji — pozostaje
  taki, jaki dane miejsce ma dzisiaj).
- [ ] **AC-2** — Given ta sama funkcja wywołana z innych miejsc, które z niej korzystają
  (np. fiszki z filmu w YouTube), when przygotowywane są słówka, then zachowanie tych miejsc
  pozostaje poprawne (nie ulega regresji), a żadne z nich nie narzuca użytkownikowi ukrytego
  limitu 25.
- [ ] **AC-3** — Given strona modułu Zadania (`/tasks`), when użytkownik ją otwiera, then nie
  widzi stałego, rozwiniętego formularza „Nowe zadanie"; widzi przycisk dodania zadania
  zaprezentowany spójnie z istniejącym przyciskiem dodania projektu.
- [ ] **AC-4** — Given przycisk dodania zadania na stronie modułu, when użytkownik go naciska,
  then otwiera się okno dialogowe z tym samym zakresem pól co dotychczasowy formularz (w tym
  wybór projektu docelowego z sensownym domyślnym), a po zapisaniu użytkownik trafia do
  szczegółów nowego zadania w jego projekcie — tak jak dotychczas.
- [ ] **AC-5** — Given okno dialogowe dodawania zadania, when użytkownik je zamyka bez zapisu
  (przycisk, `Esc`), then wraca na stronę modułu bez skutków ubocznych; okno respektuje
  konwencje aplikacji (motyw przez zmienne CSS, arkusz dolny na telefonie z bezpiecznym
  odstępem, dostępność).
- [ ] **AC-6** — Given bieżący kod na gałęzi integracyjnej, when weryfikowane jest zgłoszenie
  „błąd formatu przy generowaniu skórki przez AI", then potwierdzone jest (testami i śladem
  przebiegu 119), że znane niekanoniczne kształty odpowiedzi modelu nie kończą się już błędem
  formatu, a ostateczna porażka ma czytelny komunikat — bez zmian w kodzie w ramach tego
  przebiegu (chyba że weryfikacja wykaże realną lukę; wtedy luka wchodzi do zakresu).

## 5. Zakres

**W zakresie:**
- Zniesienie sztywnego limitu liczby słówek przygotowywanych z tekstu w module Języki —
  wszędzie tam, gdzie limit jest dziś narzucany użytkownikowi (żądanie z interfejsu, ucinanie
  wyniku, treść polecenia dla modelu).
- Zastąpienie stałego formularza „Nowe zadanie" na stronie modułu Zadania przyciskiem
  otwierającym okno dialogowe, spójne z istniejącym wzorcem dodawania zadania w widoku
  projektu (przebieg 118) i z dodawaniem projektu.
- Weryfikacja (bez implementacji), że zgłoszenie o błędzie formatu skórki jest pokryte przez
  wdrożony przebieg 119; dopiero gdyby weryfikacja wykazała lukę — jej naprawa.

**Poza zakresem (świadomie):**
- Ponowna implementacja odporności generatora skórek na kształt odpowiedzi modelu (zrobione
  w 119).
- Zmiany w samym formularzu zadania (pola, walidacja, zachowanie po zapisie) — przenosimy go
  do dialogu, nie przerabiamy.
- Zmiany jakości ekstrakcji słówek (dobór, tłumaczenia, poziomy trudności) — znosimy limit
  ilościowy, nie przeprojektowujemy funkcji.
- Jakiekolwiek zmiany schematu bazy danych, uprawnień, kalendarza czy powiadomień.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — istniejące `module.languages` i `module.tasks`;
  weryfikacja skórek dotyczy ustawień wyglądu dostępnych każdemu zalogowanemu.
- **Własność danych:** bez zmian — słówka trafiają do talii użytkownika jak dotąd, zadania do
  projektów wg istniejącego modelu przestrzeni (079).
- **Asystent AI:** nie dotyczy — żadna nowa `AIAction` ani read-tool; istniejące akcje
  asystenta pozostają bez zmian (C-23 bez nowych obowiązków).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-01/C-02/C-36** — praca wyłącznie w `worldofmag/`, granice modułów: zmiany w Językach
  i Zadaniach zostają w ich modułach; żadnych nowych list równoległych.
- **C-53 (minimalizm)** — zgłoszenie 2 realizujemy istniejącym wzorcem modalu z 118 (drugi
  konsument tego samego rozwiązania), nie nowym komponentem; zgłoszenie 3 bez kodu.
- **C-30/C-31/C-33/C-34** — dialog przez zmienne CSS, arkusz dolny na telefonie z
  `safe-area-inset-bottom`, widok modułu nadal deklaruje się przez ramę; bez natywnych okien.
- **C-32** — nowe/zmienione teksty interfejsu po polsku przez `t()` i `messages/pl.json`.
- **C-35** — komponent wspólny dowozimy wpięty: modal dodawania zadania zyskuje realnego
  drugiego konsumenta zamiast równoległego bytu.
- **C-50** — gotowe = `npm run build` przechodzi (do kroku `next build`; C-13 — bez migracji
  na prod z lokalu).
- **C-51** — jeśli w trakcie wyjdzie nieoczywisty problem, wpis do `doświadczenia.md`.
- **C-54** — zgłoszenie 3 rozstrzygnięte na etapie speca (już naprawione w 119) z jawnym
  śladem, żeby artefakty i historia decyzji się zgadzały.
- **C-10..C-14** — nie dotyczą wprost (zero migracji), co plan ma jawnie potwierdzić.

## 8. Otwarte pytania / decyzje właściciela

Brak pytań otwartych — zgłoszenia są jednoznaczne (C-55: nie pytamy, gdy nie ma realnej
decyzji). Przyjęte założenia (rekomendowane domyślne, do zmiany na życzenie właściciela):

- **Z-1 (słówka):** „bez ograniczenia" rozumiemy jako **brak arbitralnego progu ilościowego
  narzucanego użytkownikowi** — lista ma pokrywać cały podany tekst. Techniczne zabezpieczenia
  stabilności (np. obsługa bardzo długich tekstów) są dozwolone, o ile nie ucinają wyniku po
  cichu: użytkownik zawsze widzi słownictwo całego tekstu albo jasną informację, czemu nie.
- **Z-2 (zadania):** przycisk dodania zadania stoi na stronie modułu obok/analogicznie do
  przycisku „Nowy projekt", a dialog to ten sam wzorzec co w widoku projektu (118), z wyborem
  projektu docelowego i dotychczasowym domyślnym (ostatnio używany projekt, z bezpiecznym
  odstawieniem na Skrzynkę). Zachowanie po zapisie bez zmian: przejście do szczegółów zadania.
- **Z-3 (skórki):** zgłoszenie uznajemy za pokryte przez 119 (scalone na `develop` i `master`
  przed startem tego przebiegu); w tym przebiegu tylko weryfikacja. Gdyby na etapie
  weryfikacji wyszła luka — wraca do implementacji w ramach tego przebiegu (C-54).

## 9. Ryzyka

- **Bardzo długie teksty po zniesieniu limitu** → odpowiedź modelu może być obszerna lub
  ucięta budżetem wyjścia; ograniczamy przez świadome zaprojektowanie zachowania dla długich
  tekstów w planie (bez cichego ucinania wyniku) i kryterium AC-1 na tekście 60+ słów.
- **Regresja innych konsumentów ekstrakcji słówek** (np. fiszki z filmu) → AC-2 jawnie
  obejmuje pozostałe miejsca wywołań; plan ma je zinwentaryzować.
- **Utrata szybkiego dodawania na stronie modułu** (105 wprowadziło formularz właśnie po to,
  by dało się dodać zadanie od razu) → przycisk pozostaje na widoku od razu widoczny,
  a dialog otwiera się jednym naciśnięciem — liczba gestów rośnie o jeden, świadomie, na
  wyraźne życzenie właściciela; skróty klawiszowe dodawania mają nadal działać.
- **Rozjazd zgłoszenia 3 z rzeczywistością** (użytkownik trafił na błąd już po 119) → AC-6
  wymusza weryfikację na bieżącym kodzie; w razie luki — powrót do implementacji (C-54).
