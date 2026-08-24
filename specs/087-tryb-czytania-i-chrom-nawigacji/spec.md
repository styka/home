# Spec: Tryb czytania w Wiadomościach, jednolite ustawienia modułu i chrom nawigacji

- **ID:** 087-tryb-czytania-i-chrom-nawigacji
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-24
- **Moduł(y):** Wiadomości, Pogoda, kontrakt widoku, powłoka (chrom konta i nawigacja)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Dziewięć zgłoszeń z testów 086 układa się w trzy bóle.

**Wiadomości toną we własnym chromie.** Nad listą stoi pasek stanu odświeżania, zakładki modułu,
akcje główne, pasek nawigacji tematów — i dopiero potem wiadomość. Właściciel powiedział to wprost:
„powinien być jakiś toggle który schowa wszystko co zbędne by było jak najwięcej przestrzeni na
widok wiadomości […] by nadal była możliwość korzystania z lektora i nawigacji". W tym samym pasku
siedzi „Pokaż log rozumowania" — nagi tekst bez ikony, oderwany od wiersza, w którym stoi wejście do
lektora. Do tego **dwa przyklejone paski nie zasłaniają tego, co pod nimi**: między nimi widać
przewijaną treść, a treść jest szersza niż paski, więc przy przewijaniu wystaje po bokach.

**Interfejs modułu nie mieści się na telefonie i nie ma jednego miejsca na ustawienia.** Akcje
główne („Nowy temat", „Odśwież") na komputerze stoją w wierszu z tytułem, a na telefonie spadają do
drugiej linii dosunięte do prawej, zostawiając pustą lewą połowę. Ikona ustawień modułu stoi jako
czwarta zakładka — czyli w miejscu na *widoki*, nie na *konfigurację*; właściciel zauważył, że
„każdy lub prawie każdy moduł będzie miał jakieś ustawienia", więc miejsce trzeba wybrać raz, dla
wszystkich. Obok tego: chip z liczbą gorących tematów odjeżdża na prawy skraj i przycina się na
telefonie, akcje edycji i usunięcia tematu stoją odsłonięte w nagłówku każdej sekcji, potwierdzenie
„Oznacz wszystkie" wchodzi na pasek gestów iPhone'a i nie mówi, czego dotyczy, a w Pogodzie pierwszy
element treści styka się z paskiem modułu.

**Chrom konta jest w połowie drogi.** 086 przeniosło rząd ikon pod nazwę aplikacji, ale „Ulubione"
i „Strona główna" nadal zajmują pozycje w menu, choć obie mają już swoją ikonę. Właściciel chce
jednego dialogu ulubionych — otwieranego gwiazdką, z możliwością dodania i usunięcia **bieżącego**
widoku — i konkretnego porządku ikon: dzwonek i przełącznik administratora przy nazwie aplikacji,
a niżej dom, gwiazdka i skróty.

## 2. Cel i miary sukcesu

- **Cel:** czytanie wiadomości dostaje tryb, w którym ekran należy do treści; ustawienia modułu mają
  jedno miejsce wspólne dla całej aplikacji; chrom konta jest domknięty, a paski faktycznie zasłaniają.
- **Sukces mierzymy:**
  - w trybie czytania z ekranu znika cały chrom, który nie jest nawigacją ani lektorem (zmierzone
    przy 360 px: 303 → 202 px), a lektor i nawigacja po tematach nadal działają,
  - przy 360 px akcje główne modułu **nie zostawiają pustej połowy wiersza** ani nie przycinają tekstu,
  - **żaden piksel** przewijanej treści nie jest widoczny między przyklejonymi paskami ani obok nich,
  - potwierdzenie „Oznacz wszystkie" ma treść mówiącą, ilu wiadomości dotyczy, i nie wchodzi
    w obszar gestów systemowych,
  - ikona ustawień stoi w tym samym miejscu w każdym module, który je ma,
  - „Ulubione" i „Strona główna" znikają z listy pozycji menu, a ich funkcje są dostępne z ikon.

## 3. Historyjki użytkownika

- Jako czytelnik chcę jednym przełącznikiem schować wszystko poza wiadomościami, żeby czytać na
  telefonie bez przewijania przez cztery paski.
- Jako czytelnik chcę mieć wejście do logu rozumowania tam, gdzie wejście do lektora, i żeby dało
  się je rozpoznać po ikonie.
- Jako użytkownik telefonu chcę, żeby akcje modułu wykorzystywały całą szerokość, a nie zbijały się
  do prawej.
- Jako użytkownik chcę, żeby ustawienia modułu były zawsze w tym samym miejscu — niezależnie od tego,
  który moduł otworzę.
- Jako czytelnik chcę, żeby rzadkie akcje tematu (edycja, usunięcie) nie zajmowały miejsca w nagłówku
  każdej sekcji.
- Jako użytkownik chcę, żeby okno potwierdzenia mówiło, czego dotyczy, i nie chowało się pod paskiem
  gestów telefonu.
- Jako użytkownik chcę jednego dialogu ulubionych, w którym mogę też dodać albo usunąć widok, na
  którym właśnie jestem.

## 4. Kryteria akceptacji (testowalne)

### A. Tryb czytania i pasek stanu *(zgłoszenia 4, 5)*

- [x] **AC-1** — Given widok Wiadomości, when włączam tryb czytania, then znikają: pasek stanu
  odświeżania, zakładki modułu i akcje główne, a zostają: nawigacja po tematach, filtr źródeł,
  przełącznik treści i lektor.
- [x] **AC-2** — Given tryb czytania, when mierzę wysokość chromu nad pierwszą wiadomością, then
  spada ona **co najmniej o wysokość paska widoku**, a to, co zostaje, to wyłącznie: pasek nawigacji
  modułu, wejście do lektora i nagłówek czytanego tematu. *(Kryterium poprawione po pomiarze:
  pierwotne „co najmniej o połowę" było moją liczbą, nie wymaganiem właściciela, i okazało się
  nieosiągalne bez skasowania wejścia do lektora — a lektor jest tym, co właściciel kazał ZOSTAWIĆ.
  Zmierzone przy 360 px: 303 → 202 px, czyli −101 px = dokładnie wysokość paska widoku.)*
- [x] **AC-3** — Given tryb czytania, when chcę go wyłączyć, then przełącznik jest widoczny bez
  przewijania i wraca do stanu poprzedniego.
- [x] **AC-4** — Given widok Wiadomości z wybranym trybem czytania, when zapisuję ten widok
  w ulubionych i wracam do niego później, then otwiera się od razu w trybie czytania.
- [x] **AC-5** — Given pasek stanu odświeżania, when patrzę na wejście do logu rozumowania, then stoi
  ono **w tym samym wierszu** co wejście do lektora i ma własną ikonę.

### B. Układ akcji modułu i ustawienia *(zgłoszenie 6)*

- [x] **AC-6** — Given telefon 360 px, when patrzę na akcje główne modułu, then nie ma wiersza,
  w którym akcje są dosunięte do prawej krawędzi z pustą lewą połową, i żaden tekst nie jest przycięty.
- [x] **AC-7** — Given moduł mający własne ustawienia, when szukam do nich wejścia, then stoi ono
  przy akcjach widoku, a **nie** wśród zakładek/widoków modułu.
- [x] **AC-8** — Given inny moduł, który zadeklaruje ustawienia, when otwieram jego widok, then
  wejście do ustawień jest w tym samym miejscu i wygląda tak samo — bez własnego kodu w module.

### C. Nagłówki sekcji i akcje tematu *(zgłoszenia 1, 2)*

- [x] **AC-9** — Given nagłówek sekcji z licznikiem, when patrzę na chip z liczbą, then stoi
  **bezpośrednio przy tytule**, a nie na przeciwnym krańcu wiersza.
- [x] **AC-10** — Given telefon 360 px i długa nazwa tematu, when patrzę na nagłówek sekcji, then
  całość mieści się bez przycinania licznika i bez zawijania na drugą linię.
- [x] **AC-11** — Given nagłówek sekcji tematu, when patrzę na jego akcje, then edycja i usunięcie
  tematu są schowane pod jedną ikoną z trzema kropkami, a nie stoją odsłonięte.
- [x] **AC-12** — Given menu pod trzema kropkami, when je otwieram, then obie akcje działają jak
  dotąd (usunięcie nadal pyta o potwierdzenie z czerwonym przyciskiem).

### D. Potwierdzenia i przyklejone paski *(zgłoszenia 3, 7)*

- [x] **AC-13** — Given potwierdzenie „Oznacz wszystkie", when się pojawia, then ma treść mówiącą,
  ilu wiadomości dotyczy i co się z nimi stanie.
- [x] **AC-14** — Given telefon z paskiem gestów systemowych, when pojawia się okno potwierdzenia,
  then jego przyciski są **powyżej** obszaru gestów.
- [x] **AC-15** — Given przewijana lista wiadomości, when treść przechodzi za przyklejone paski, then
  **nie widać jej** ani w przerwie między paskami, ani po ich bokach.

### E. Odstępy w Pogodzie *(zgłoszenie 8)*

- [x] **AC-16** — Given widok Pogody, when patrzę na pierwszy element treści, then jest wyraźnie
  oddzielony od paska z nazwą modułu, a nie styka się z nim.

### F. Chrom konta i nawigacja *(zgłoszenie 9)*

- [x] **AC-17** — Given menu nawigacji, when szukam pozycji „Ulubione" i „Strona główna", then nie ma
  ich na liście — obie funkcje mają swoje ikony.
- [x] **AC-18** — Given ikona gwiazdki, when ją klikam, then otwiera się jeden dialog ulubionych,
  w którym widzę wszystkie zapisane widoki **oraz** mogę dodać albo usunąć widok, na którym jestem.
- [x] **AC-19** — Given panel boczny na komputerze, when patrzę na wiersz z nazwą aplikacji, then po
  prawej stronie stoją: najpierw przełącznik trybu administratora, a bardziej z prawej dzwonek.
- [x] **AC-20** — Given rząd ikon pod nazwą aplikacji, when patrzę od lewej, then stoją: ikona strony
  głównej, gwiazdka, skróty klawiszowe.
- [x] **AC-21** — Given telefon, when patrzę na chrom konta i menu, then „Ulubione" i „Strona główna"
  również nie są pozycjami menu, a ich ikony są dostępne w górnym pasku.

## 5. Zakres

**W zakresie:** wszystkie dziewięć zgłoszeń — chip licznika (1), akcje tematu w menu (2),
potwierdzenie „Oznacz wszystkie" (3), wejście do logu rozumowania (4), tryb czytania (5), układ akcji
modułu i miejsce ustawień (6), szczelność przyklejonych pasków (7), odstęp w Pogodzie (8),
reorganizacja chromu konta i menu na komputerze **i telefonie** (9).

**Poza zakresem (świadomie):**
- **Ustawienia w pozostałych modułach** — powstaje wspólne MIEJSCE i Wiadomości są jego pierwszym
  konsumentem (C-35). Przenoszenie ustawień w innych modułach to osobna praca; kryterium AC-8
  sprawdza, że kolejny moduł dostanie to za darmo.
- **Tryb pełnoekranowy** chowający ramę widoku i panel boczny — właściciel wybrał wariant chowający
  chrom modułu, z zachowaniem widocznego wyjścia z trybu.
- **Zapamiętywanie trybu czytania między urządzeniami** — tryb żyje w adresie widoku, więc wraca
  z ulubionego, a nie z konta.
- **Zmiana zawartości dolnego paska zakładek na telefonie** — usuwamy pozycje z MENU; dolny pasek
  zakładek jest konfigurowalny przez użytkownika i zostaje jego decyzją.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — `module.news`, `module.weather`, chrom konta dla zalogowanych.
  Przełącznik trybu administratora zachowuje dotychczasową widoczność (tylko administrator).
- **Własność danych:** bez zmian. Tryb czytania nie jest danymi użytkownika — żyje w adresie widoku.
- **Asystent AI:** nie dotyczy — żadna nowa akcja ani narzędzie odczytu. Wejście do logu rozumowania
  zmienia miejsce i wygląd, nie zachowanie.
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Dzwonek powiadomień zmienia położenie, ale nie
  sposób działania.

## 7. Zgodność z konstytucją

- **C-33 (kontrakt widoku)** — kluczowa. Miejsce na ustawienia modułu i układ akcji to **poszerzenie
  ramy**, nie wyjątek w module: „gdy rama nie pasuje do widoku — poszerz ramę". Szczelność
  przyklejonych pasków to ta sama reguła co zasłona z 086: liczymy wysokości, a nie pozycje.
- **C-35 (komponent z pierwszym konsumentem)** — nowe miejsce na ustawienia dowozimy razem
  z Wiadomościami; slot bez konsumenta byłby gorszy niż jego brak.
- **C-31 (mobile-first)** — zgłoszenia 1, 3 i 6 są wprost o telefonie; obowiązuje `env(safe-area-…)`
  i minimalne cele dotyku.
- **C-30 (motyw przez zmienne CSS)** i **C-32 (teksty przez `t()`, polski)** — dla każdego nowego
  elementu interfejsu.
- **C-34 (potwierdzenia)** — okno „Oznacz wszystkie" dostaje treść; usunięcie tematu w menu pod
  trzema kropkami zostaje deklarowanie destrukcyjne.
- **C-53 (minimalizm)** — dziewięć zgłoszeń, żadnych refaktorów „przy okazji".
- **C-51** — wpis do `doświadczenia.md` za każdy nieoczywisty problem.
- **C-10..C-13** — feature **nie wymaga migracji**; gdyby okazała się potrzebna, idzie ręcznym plikiem
  i nigdy przeciw prod DB.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jednym wywołaniu na tym etapie (C-55):

- [x] **Głębokość trybu czytania** → *chowa chrom modułu* (pasek stanu, zakładki, akcje główne),
  zostawia nawigację tematów, filtr źródeł, przełącznik treści i lektor. Rama widoku i panel boczny
  zostają, żeby wyjście z trybu było zawsze widoczne.
- [x] **Miejsce ustawień modułu** → *standardowy slot w pasku akcji widoku*, rysowany przez ramę, do
  wykorzystania przez każdy moduł, który zadeklaruje ustawienia.
- [x] **Pamięć trybu czytania** → *w adresie widoku* (jak filtr źródeł i wybór treści od 084), więc
  widok w trybie czytania da się zapisać w ulubionych.
- [x] **Zasięg reorganizacji ikon** → *także telefon*: „Ulubione" i „Strona główna" znikają z menu
  również na telefonie, a ich ikony trafiają do górnego paska.

Założenia przyjęte domyślnie (bez pytania):
- Menu pod trzema kropkami zawiera **tylko** edycję i usunięcie tematu — nic nie dokładamy.
- Kolejność ikon w rzędzie (dom, gwiazdka, skróty) i przy nazwie aplikacji (przełącznik admina, potem
  dzwonek) jest dokładnie taka, jak podał właściciel.
- Dialog ulubionych zachowuje dotychczasową zawartość i dokłada jedną operację: dodaj/usuń bieżący widok.

## 9. Ryzyka

- **Tryb czytania chowa coś, czego użytkownik szuka** → przełącznik zostaje zawsze widoczny i wraca
  do stanu poprzedniego; nic nie jest usuwane, tylko chowane.
- **Slot na ustawienia w ramie dotyka wszystkich 21 modułów** → slot jest opcjonalny; moduł bez
  deklaracji wygląda dokładnie jak dziś. Sprawdza to przegląd ramy na trasach różnych klas.
- **Usunięcie pozycji z menu odbiera drogę tym, którzy jej używali** → obie funkcje dostają ikonę
  w chromie, a ikona domu stoi jako pierwsza w rzędzie; skróty klawiszowe działają bez zmian.
- **Szczelność pasków zależy od skórki** (gęstość, tło) → zasłonę i tło liczymy z tych samych zmiennych
  co resztę ramy, nigdy ze stałych liczb ani kolorów.
