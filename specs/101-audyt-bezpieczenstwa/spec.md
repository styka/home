# Spec: Audyt bezpieczeństwa infrastruktury + raport w aplikacji

- **ID:** 101-audyt-bezpieczenstwa
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-25
- **Moduł(y):** Raporty (istniejący) + zmiany przekrojowe w warstwie wejścia do aplikacji

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Omnia trzyma dane osobiste, zdrowotne i finansowe właściciela, loguje przez Google i rozmawia
z kilkoma usługami zewnętrznymi, ale **nikt nigdy nie przeszedł całej tej ścieżki pod kątem
bezpieczeństwa i nie zapisał wyniku**. Właściciel planuje otworzyć aplikację na szeroką publiczność
i chce **przed** tym momentem wiedzieć, co jest zabezpieczone, co nie jest, i czego brakuje — nie
z pamięci, tylko jako dokument, do którego można wrócić za pół roku.

Dziś na proste pytanie „czy połączenie przeglądarka → aplikacja → baza jest szczelne?" nie ma
w projekcie żadnej odpowiedzi na piśmie. Jest natomiast konkretna, potwierdzona luka: aplikacja
**nie wysyła przeglądarce żadnych nagłówków bezpieczeństwa**, więc nie egzekwuje HTTPS, nie broni
się przed osadzeniem w cudzej ramce i nie ogranicza wycieku adresów w nagłówku odsyłacza.

## 2. Cel i miary sukcesu

- **Cel:** właściciel ma w aplikacji jeden, kompletny dokument opisujący stan bezpieczeństwa całej
  ścieżki (przeglądarka → hosting → aplikacja → baza → usługi zewnętrzne), z ponumerowaną listą
  ustaleń i rekomendacji, a najpilniejsze braki niskiego ryzyka są przy okazji **naprawione**.
- **Sukces mierzymy:**
  - właściciel wchodzi do raportów w aplikacji i czyta audyt **bez pytania kogokolwiek o kontekst**;
  - każde ustalenie ma jednoznaczny stan (**w porządku / do poprawy / brak — rekomendacja**) i wagę,
    więc da się z niego zrobić listę zadań;
  - odpowiedź przeglądarce niesie komplet podstawowych nagłówków bezpieczeństwa, czego dziś nie robi;
  - raport odpowiada wprost na pytanie właściciela „czy da się wejść po SSH i czy tego potrzebujemy".

## 3. Historyjki użytkownika

- Jako właściciel chcę **jeden dokument** opisujący, jak wygląda droga danych od przeglądarki do bazy,
  żeby rozumieć własną infrastrukturę bez czytania kodu.
- Jako właściciel chcę wiedzieć, **które połączenia są szyfrowane, a które nie**, żeby nie zakładać
  bezpieczeństwa tam, gdzie go nie ma.
- Jako właściciel chcę **listę braków uszeregowaną po ważności**, żeby wiedzieć, co zrobić najpierw,
  zanim aplikacji zacznie używać wiele osób.
- Jako właściciel chcę wiedzieć, **czym są sekrety aplikacji, gdzie mieszkają i kto je widzi**, żeby
  ocenić skutek wycieku.
- Jako właściciel chcę odpowiedzi na pytanie o **dostęp powłoki/SSH** do środowiska produkcyjnego —
  czy jest, komu przysługuje i czy jest nam w ogóle potrzebny.
- Jako właściciel chcę, żeby **oczywiste, bezpieczne braki zostały od razu naprawione**, a nie tylko
  opisane.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given konto z uprawnieniem administratora, when właściciel otwiera listę raportów
      w aplikacji, then widzi na niej raport z audytu bezpieczeństwa i może go otworzyć i przeczytać
      w całości.
- [ ] **AC-2** — Given świeże środowisko bez tego raportu, when zostaje wdrożona ta zmiana, then
      raport pojawia się sam (dostarczony razem z wdrożeniem), a **powtórne** wdrożenie nie tworzy
      duplikatu ani nie nadpisuje treści w sposób niezamierzony.
- [ ] **AC-3** — Given otwarty raport, when właściciel go czyta, then znajduje w nim opis **każdego
      odcinka drogi danych**: przeglądarka → hosting → aplikacja → baza → usługi zewnętrzne, a przy
      każdym odcinku informację, czy połączenie jest szyfrowane.
- [ ] **AC-4** — Given otwarty raport, when właściciel szuka podsumowania, then znajduje **ponumerowaną
      listę ustaleń**, gdzie każde ma stan (w porządku / do poprawy / brak) oraz wagę (krytyczna /
      wysoka / średnia / niska), a osobno listę rzeczy **naprawionych w tej zmianie**.
- [ ] **AC-5** — Given otwarty raport, when właściciel szuka odpowiedzi na pytanie o dostęp powłoki
      i SSH do produkcji, then raport odpowiada wprost: czy taki dostęp istnieje, kto go ma, jak się
      go używa i czy jest potrzebny.
- [ ] **AC-6** — Given wdrożoną aplikację, when przeglądarka pobiera dowolną stronę aplikacji, then
      odpowiedź niesie nagłówki wymuszające połączenie szyfrowane, zakaz osadzania w cudzej ramce,
      zakaz zgadywania typu treści i ograniczenie danych w nagłówku odsyłacza.
- [ ] **AC-7** — Given zmianę z AC-6, when właściciel korzysta z aplikacji na telefonie i na
      komputerze, then **żadna dotychczasowa funkcja nie przestaje działać** (w szczególności
      logowanie Google, mapy w Pogodzie, czytnik w Wiadomościach, skanowanie kodów w Magazynowaniu).
- [ ] **AC-8** — Given otwarty raport, when właściciel czyta rozdział o sekretach, then wie, które
      dane wrażliwe aplikacja przechowuje, które z nich są szyfrowane, a które nie, i co się dzieje,
      gdy któryś wycieknie.

## 5. Zakres

**W zakresie:**
- Przegląd i opis: ruchu przeglądarka ↔ aplikacja, hostingu i jego dostępu administracyjnego,
  połączenia aplikacja ↔ baza danych, logowania Google, połączeń do usług zewnętrznych.
- Przegląd i opis mechanizmów, które projekt już ma: role i uprawnienia, bramkowanie tras, ograniczanie
  liczby żądań, szyfrowanie kluczy, dziennik zmian, retencja danych, usuwanie konta i danych.
- Ponumerowana lista ustaleń z wagą oraz rekomendacje na przyszłość (co zrobić przed otwarciem
  aplikacji na wiele osób).
- Dostarczenie raportu do aplikacji **razem z wdrożeniem**, idempotentnie.
- **Naprawa braków niskiego ryzyka**: komplet podstawowych nagłówków bezpieczeństwa odpowiedzi.

**Poza zakresem (świadomie):**
- **Pełna polityka bezpieczeństwa treści (CSP)** — decyzja właściciela: zbyt łatwo psuje działającą
  aplikację (skrypty osadzone, mapy, synteza mowy). Zostaje jako **rekomendacja w raporcie**.
- Testy penetracyjne, skanery podatności, audyt zewnętrznej firmy.
- Zmiany planu hostingu, migracja bazy, wprowadzanie nowych usług bezpieczeństwa.
- Zmiany w modelu ról i uprawnień — audyt je **opisuje**, nie przebudowuje.
- Drugi składnik logowania — rekomendacja, nie realizacja.
- Moduł YouTube — osobny spec `102-youtube-transkrypcje`.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego sluga. Raport trafia do istniejącej sekcji raportów, widocznej
  dla zalogowanych; treść adresowana do administratora (C-22 bez zmian).
- **Własność danych:** raport jest dokumentem systemowym, nie należy do żadnego użytkownika ani zespołu.
- **Asystent AI:** nie dotyczy — żadnej nowej akcji ani narzędzia odczytu (C-23 bez zmian).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.
- **Zmiana przekrojowa:** nagłówki odpowiedzi dotykają **każdej** strony aplikacji, więc ryzyko regresji
  jest realne i pokrywa je AC-7.

## 7. Zgodność z konstytucją

- **C-14** — raport dostarczany **idempotentną migracją SQL** (unikalny identyfikator dokumentu,
  ponowne wdrożenie nie tworzy duplikatu). To jedyny akceptowany sposób wprowadzenia raportu.
- **C-11** — numer migracji unikalny i sekwencyjny, pobrany z narzędzia repo.
- **C-13** — weryfikacja **wyłącznie** na lokalnej bazie; nigdy build ani migracja przeciw produkcji.
  Reguła jest tu podwójnie ważna: to zadanie z definicji dotyka konfiguracji produkcyjnej.
- **C-41** — audyt opisuje szyfrowanie i maskowanie kluczy; **raport nie może zawierać żadnej
  wartości sekretu, adresu bazy ani fragmentu klucza** — wyłącznie opis mechanizmu.
- **C-53** — minimalizm: naprawiamy braki wybrane przez właściciela, bez „przy okazji" przebudów.
- **C-50** — „gotowe" = `npm run build` przechodzi (pełny łańcuch bramek, lokalnie).
- **C-51** — wnioski nieoczywiste trafiają do `doświadczenia.md`.

## 8. Otwarte pytania / decyzje właściciela

- [x] **Zakres naprawy** — właściciel wybrał: **raport + naprawy niskiego ryzyka**. Naprawiamy komplet
      podstawowych nagłówków bezpieczeństwa; pełne CSP świadomie **poza zakresem** (ryzyko zepsucia
      działającej aplikacji), zapisane jako rekomendacja.
- [x] **Podział zadań** — dwa zgłoszenia właściciela są tematycznie rozłączne, więc dostają **dwa
      osobne katalogi specyfikacji** (`101` i `102`) i jadą jednym przebiegiem pipeline'u na wspólnej
      gałęzi roboczej. Żadne zadanie nie zostało pominięte.
- [x] **Założenie przyjęte domyślnie:** raport pisany po polsku, jak pozostałe raporty systemowe.
- [x] **Założenie przyjęte domyślnie:** „zrobić ssh" z opisu zgłoszenia czytamy jako pytanie
      *„czy mamy dostęp do maszyny produkcyjnej i czy go potrzebujemy"*, a nie jako polecenie
      wystawienia serwera SSH — wystawianie własnego SSH na hostingu zarządzanym byłoby
      **pogorszeniem** bezpieczeństwa. Raport odpowiada na pytanie (AC-5).

## 9. Ryzyka

- **Nagłówki bezpieczeństwa psują działającą funkcję** (najpoważniejsze ryzyko tej zmiany) → bierzemy
  wyłącznie nagłówki o przewidywalnym skutku, świadomie pomijamy CSP; pokrywa to AC-7.
- **Raport z czasem się zdezaktualizuje** → dokument niesie datę i zakres, do którego się odnosi,
  i wprost mówi, że opisuje stan na ten dzień.
- **Audyt wykona się „na oko"** → każde ustalenie musi wskazywać, na czym oparto wniosek (miejsce
  w projekcie albo konfiguracja), inaczej jest bezwartościowe.
- **Wyciek wrażliwych szczegółów przez sam raport** → zakaz umieszczania wartości sekretów, adresów
  i fragmentów kluczy; raport opisuje mechanizmy, nie dane.
- **Brak dostępu do panelu hostingu z tego środowiska** → to, czego nie da się potwierdzić z projektu,
  raport oznacza jako **do potwierdzenia przez właściciela** zamiast zgadywać.
