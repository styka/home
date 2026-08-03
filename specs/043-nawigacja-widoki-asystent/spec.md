# Spec: Nawigacja po widokach, widget asystenta i układ strony głównej

- **ID:** 043-nawigacja-widoki-asystent
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-03
- **Moduł(y):** powłoka nawigacyjna · Home · Zadania · Zakupy · Notatki · Raporty

> **Zasada speca:** CO i DLACZEGO, nigdy JAK.

---

## 1. Problem / potrzeba

Cztery zgłoszenia z **realnego użycia** funkcji wdrożonej w specu 042. Trzy z nich to zgłoszenia
błędów w tym, co właśnie oddałem, i rekonesans w kodzie potwierdził, że właściciel ma rację
w każdym punkcie:

1. **Ulubione „nie istnieją" na desktopie.** Sekcja ulubionych w pasku bocznym nie renderuje się
   wcale, dopóki nie ma ani jednego wpisu (moja decyzja z 042 o „pustym stanie, który nie zajmuje
   miejsca"), a jedyny punkt zapisu to niepozorny wiersz tekstu na samym dole paska. Nie ma też
   żadnego miejsca „zarządzaj ulubionymi" widocznego z poziomu nawigacji.
2. **Zapisany widok gubi filtry.** Właściciel chce wracać do „zadań projektu X w statusie Y", ale
   **żaden moduł nie trzyma stanu widoku w adresie** — w Zadaniach status, tagi, grupowanie i układ
   (lista/kanban/oś czasu) to zwykły stan komponentu. Ulubione zapisują więc gołą ścieżkę modułu,
   bez filtrów, i po powrocie widok jest inny niż zapisany.
3. **Skróty klawiszowe kolidują — potwierdzone.** Wspólny mechanizm skrótów reaguje na gołe cyfry
   1–5 (zakładki filtrów) i **nie sprawdza modyfikatorów**, więc `Alt+1` jednocześnie skacze do
   ulubionego **i** przełącza zakładkę filtra. To błąd wprowadzony w 042.
4. **Widget asystenta jest niewidoczny na telefonie** (renderuje się dopiero od bardzo szerokiego
   ekranu), stoi w dowolnym miejscu pulpitu i zawiera pole tekstowe, którego właściciel tam nie chce.

Piąte zgłoszenie jest innego rodzaju: właściciel prosi o **raport analityczny** — czy aplikacja jest
sterowana zdarzeniami, czy zmiany danych da się cofać jak w dokumentach Google, i co trzeba zmienić,
żeby dane odświeżały się na żywo na wszystkich urządzeniach.

## 2. Cel i miary sukcesu

- **Cel:** nawigacja po własnych miejscach w aplikacji ma być odkrywalna, kompletna (z filtrami)
  i wolna od kolizji, a wejście w asystenta ma być pierwszą rzeczą widoczną na pulpicie — na każdym
  urządzeniu.
- **Sukces mierzymy:**
  - ulubione i zarządzanie nimi są widoczne na desktopie **bez żadnego wpisu na start**;
  - zapisany widok Zadań odtwarza **te same filtry i tę samą zakładkę**, a nie samą ścieżkę modułu;
  - żaden skrót ulubionych nie wywołuje jednocześnie akcji modułu;
  - widget asystenta jest widoczny na telefonie i stoi **pierwszy** na pulpicie;
  - kafelki pulpitu układają się bez pustych dziur między wierszami;
  - właściciel dostaje raport, który odpowiada na pytanie „czy i jak przejść na architekturę
    zdarzeniową z cofaniem zmian i podglądem na żywo".

## 3. Historyjki użytkownika

- Jako użytkownik na komputerze chcę **od razu widzieć**, gdzie są ulubione i jak nimi zarządzać —
  także zanim zapiszę pierwszy widok.
- Jako użytkownik chcę zapisać **konkretny widok z filtrami** („Zadania: projekt Dom, status W toku,
  widok kanban") i wrócić do niego dokładnie w tym stanie.
- Jako użytkownik chcę, żeby skrót do ulubionego **robił tylko to jedno** i nie przełączał mi przy
  okazji zakładki na stronie.
- Jako użytkownik chcę **widzieć, jakie skróty są aktywne** na danej stronie, zamiast zgadywać.
- Jako użytkownik na telefonie chcę mieć **wejście w asystenta na samej górze pulpitu**, jako
  pierwszą rzecz.
- Jako użytkownik chcę, żeby widget asystenta pokazywał **gotowe akcje**, a kliknięcie w jedną z nich
  otwierało asystenta i **od razu ją uruchamiało** — bez przepisywania polecenia.
- Jako użytkownik chcę, żeby kafelki na pulpicie **układały się ciasno**, a nie zostawiały pustych
  dziur między wierszami.
- Jako administrator chcę **raport** oceniający, czy aplikacja jest sterowana zdarzeniami, czy zmiany
  są cofalne i co trzeba przebudować, żeby uzyskać automatyczny zapis, historię wersji i podgląd na
  żywo na wielu urządzeniach.

## 4. Kryteria akceptacji (testowalne)

### Ulubione — odkrywalność i zarządzanie
- [ ] **AC-1** — Given nie mam **ani jednego** ulubionego widoku, when otwieram aplikację na
  komputerze, then w nawigacji widzę sekcję ulubionych z krótką zachętą oraz **widoczny punkt
  zarządzania** — nie muszę niczego odgadywać.
- [ ] **AC-2** — Given jestem na dowolnej stronie, when szukam sposobu zapisania jej, then punkt
  zapisu jest **wyraźnie widoczny w pasku bieżącego widoku**, a nie ukryty wśród pozycji na dole
  nawigacji.
- [ ] **AC-3** — Given mam zapisane ulubione, when otworzę zarządzanie z nawigacji, then mogę w jednym
  miejscu zmienić nazwę, ikonę, kolor i kolejność oraz usunąć wpis.

### Zapisywanie widoku z filtrami
- [ ] **AC-4** — Given w Zadaniach ustawię status, tagi, grupowanie i układ, when zapiszę ten widok
  jako ulubiony, then po powrocie z innego miejsca aplikacji **wszystkie te ustawienia są odtworzone**.
- [ ] **AC-5** — Given ustawiam filtry w Zadaniach, when patrzę na adres strony, then odzwierciedla on
  bieżący stan widoku, więc adres da się skopiować i otworzyć ponownie z tym samym efektem.
- [ ] **AC-6** — Given ustawiłem filtry i użyłem przycisku „wstecz" przeglądarki, when strona się
  odświeży, then wracam do **poprzedniego stanu filtrów**, a nie do stanu domyślnego.
- [ ] **AC-7** — Given to samo dotyczy Zakupów i Notatek, when zapiszę tam widok z ustawionym
  filtrem/sortowaniem, then powrót odtwarza ten sam stan.
- [ ] **AC-8** — Given wchodzę na adres modułu **bez** parametrów, when strona się załaduje, then
  widok zachowuje się dokładnie jak przed zmianą (domyślne ustawienia, brak regresji).
- [ ] **AC-8a** — Given mechanizm sprawdził się na trzech pierwszych modułach, when zostanie wpięty
  w **pozostałe moduły z widokami filtrowanymi**, then w każdym z nich zapisany widok odtwarza
  ustawienia, a wejście bez parametrów nie zmienia dotychczasowego zachowania.
- [ ] **AC-8b** — Given przeglądam listę modułów aplikacji, when sprawdzam pokrycie, then **każdy
  moduł mający filtry, zakładki lub przełączany układ** albo obsługuje stan widoku w adresie, albo ma
  odnotowane w artefaktach uzasadnienie, dlaczego go nie potrzebuje (np. widok bez żadnych filtrów).

### Skróty klawiszowe
- [ ] **AC-9** — Given jestem na stronie z zakładkami filtrów, when użyję skrótu do ulubionego, then
  następuje **wyłącznie** przejście do ulubionego — zakładka filtra **nie** zmienia się.
- [ ] **AC-10** — Given jestem na stronie z zakładkami filtrów, when naciskam samą cyfrę, then
  przełącza się zakładka (dotychczasowe zachowanie bez zmian).
- [ ] **AC-11** — Given chcę sprawdzić, co jest pod jakim klawiszem, when otworzę ściągawkę skrótów,
  then widzę **aktualną listę skrótów dla bieżącej strony** wraz z globalnymi.
- [ ] **AC-12** — Given piszę w polu tekstowym, when używam skrótów i polskich znaków, then żaden
  skrót nie przechwytuje pisania.

### Widget asystenta
- [ ] **AC-13** — Given otwieram pulpit na telefonie, when strona się załaduje, then widget asystenta
  jest widoczny **bez przewijania** i stoi jako **pierwszy** element.
- [ ] **AC-14** — Given otwieram pulpit na komputerze, when strona się załaduje, then widget asystenta
  również stoi jako pierwszy.
- [ ] **AC-15** — Given patrzę na widget, when go oglądam, then **nie zawiera pola tekstowego** —
  pokazuje zestaw gotowych akcji oraz czytelne wejście „otwórz asystenta".
- [ ] **AC-16** — Given klikam jedną z akcji w widgecie, when asystent się otworzy, then wskazana
  akcja jest **od razu uruchomiona**, bez konieczności wpisywania czegokolwiek.
- [ ] **AC-17** — Given akcje w widgecie mają odpowiadać tym z asystenta, when porównam oba miejsca,
  then pochodzą z **jednego źródła** — nie są osobną, rozjeżdżającą się listą.

### Układ pulpitu
- [ ] **AC-18** — Given mam na pulpicie kafelki o **różnej wysokości**, when patrzę na układ
  wielokolumnowy, then kafelki układają się ciasno, **bez pustych dziur** wynikających z wyrównywania
  wierszy do najwyższego elementu.
- [ ] **AC-19** — Given wchodzę w tryb personalizacji pulpitu, when go zamknę, then układ poza trybem
  edycji jest **co najmniej równie uporządkowany** jak w trybie edycji.
- [ ] **AC-20** — Given zmieniam szerokość okna, when patrzę na pulpit, then nie ma poziomego
  przewijania, a kolejność kafelków pozostaje sensowna.

### Raport architektoniczny
- [ ] **AC-21** — Given jestem administratorem, when otworzę raporty, then znajduję raport oceniający
  **stan faktyczny**: czy aplikacja jest sterowana zdarzeniami, czy zmiany danych są cofalne i czy
  dane odświeżają się na żywo.
- [ ] **AC-22** — Given czytam raport, when szukam konkretów, then zawiera on **wskazanie miejsc
  w aplikacji** do zmiany oraz warianty podejścia wraz z kosztem i ryzykiem każdego z nich.
- [ ] **AC-23** — Given raport ma być uczciwy, when opisuje korzyści, then wprost nazywa też **czego
  nie da się osiągnąć tanio** i co jest pułapką przy tej skali aplikacji.

## 5. Zakres

**W zakresie:**
1. Ulubione widoki: stale widoczna sekcja w nawigacji (z zachętą przy zerze wpisów), wyraźny punkt
   zapisu w pasku widoku, punkt zarządzania dostępny z nawigacji.
2. Stan widoku w adresie strony + zapisywanie i odtwarzanie go przez ulubione — **w dwóch fazach**
   (decyzja właściciela):
   - **faza A:** wspólny mechanizm + wpięcie w **Zadania, Zakupy, Notatki** (moduły używane
     najczęściej — na nich mechanizm się weryfikuje),
   - **faza B:** wpięcie w **wszystkie pozostałe moduły** mające filtry, zakładki lub przełączany
     układ; moduł bez żadnych filtrów jest pomijany z odnotowanym uzasadnieniem.
3. Uporządkowanie skrótów: usunięcie kolizji, pierwszeństwo skrótów strony, ściągawka skrótów.
4. Widget asystenta: widoczny na wszystkich szerokościach, pierwszy na pulpicie, bez pola tekstowego,
   z akcjami uruchamianymi natychmiast po otwarciu asystenta.
5. Układ pulpitu bez pustych dziur.
6. Raport administracyjny o architekturze zdarzeniowej, cofaniu zmian i podglądzie na żywo.

**Poza zakresem (świadomie):**
- **Nic z zakresu stanu widoku nie jest pomijane** — właściciel zdecydował, że po trzech pierwszych
  modułach mechanizm ma objąć **wszystkie pozostałe**. Fazowanie jest kolejnością pracy, nie
  ograniczeniem zakresu: faza B kończy się dopiero, gdy każdy moduł z filtrami jest pokryty albo ma
  odnotowane uzasadnienie pominięcia (AC-8b).
- **Wdrożenie architektury zdarzeniowej, cofania zmian i podglądu na żywo** — w tym specu powstaje
  **raport**, a nie implementacja. To zmiana u podstaw aplikacji i musi mieć własny spec po decyzji
  właściciela.
- **Zmiana zestawu akcji asystenta** — widget pokazuje te, które asystent już ma.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego sluga. Ulubione nadal filtrowane po uprawnieniu modułu
  docelowego. Raport widoczny dla administratora.
- **Własność danych:** bez zmian — ulubione pozostają prywatne dla konta.
- **Asystent AI:** widget **nie** dodaje nowych akcji AI; uruchamia te, które asystent już wystawia.
  Źródło listy akcji musi być jedno, wspólne dla widgetu i asystenta.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — kluczowa: stan widoku w adresie wchodzi jako **jeden wspólny mechanizm**
  wpięty w trzy moduły, a nie jako osobna implementacja w każdym; widget asystenta nie duplikuje listy
  akcji.
- **C-31 (mobile-first, keyboard-first)** — sedno zgłoszeń 1 i 4: widget musi działać na telefonie,
  a skróty nie mogą kolidować.
- **C-30 / C-32** — oprawa wyłącznie na zmiennych motywu, teksty po polsku.
- **C-20 / C-21 / C-22** — bez zmian w modelu własności i RBAC; ewentualne mutacje jako Server Actions
  z `revalidatePath`.
- **C-14** — raport seedowany idempotentną migracją SQL z globalnie unikalnym slugiem.
- **C-51** — kolizja skrótów i przyczyna „dziur" w układzie to nieoczywiste problemy → wpisy do
  dziennika doświadczeń.
- **C-54 / C-55** — spec powstał po rekonesansie w kodzie; założenia z §8 podlegają korekcie, gdy
  właściciel zdecyduje inaczej.

## 8. Otwarte pytania / decyzje właściciela

> **Decyzje właściciela z 2026-08-03.** Pierwsze cztery próby wysłania formularza wróciły bez
> odpowiedzi (problem interfejsu); piąta się powiodła i poniższe są **rzeczywistymi decyzjami**, a nie
> moimi założeniami. Punkt 1 **rozszerzył zakres** względem mojej rekomendacji — spec został
> poprawiony zgodnie z C-54 (§4, §5, §9).

- [x] **Zasięg stanu widoku w adresie** → *„To co zalecane najpierw, a potem wszystkie pozostałe."*
  Czyli **dwie fazy**: najpierw Zadania + Zakupy + Notatki (na nich weryfikujemy wspólny mechanizm),
  następnie **wszystkie pozostałe moduły** z filtrami. To rozszerzenie mojej rekomendacji — celem jest
  pełne pokrycie, a fazowanie ma tylko zmniejszyć ryzyko regresji.
- [x] **Kolizja skrótów** → **wspólny rejestr z pierwszeństwem skrótów strony + ściągawka**. Powód:
  naprawia przyczynę (brak sprawdzania modyfikatorów i brak jednego miejsca prawdy), a nie objaw.
  *Alternatywa: sekwencja „g" + cyfra albo rezygnacja ze skrótów do ulubionych.*
- [x] **Ulubione na desktopie** → **stała sekcja + punkt zarządzania + wyraźny zapis w pasku widoku**.
  Powód: wprost odpowiada na „nie ma tego na komputerze". *Alternatywa: sama ikona zarządzania albo
  osobny ekran.*
- [x] **Raport** → **w tym samym przebiegu**. Powód: jest samodzielny, nie dotyka UI i nie blokuje
  reszty. *Alternatywa: osobny spec albo pominięcie.*
- [x] **Widget asystenta** → bez pola tekstowego, z akcjami uruchamianymi natychmiast, pierwszy na
  pulpicie, widoczny na każdej szerokości. To **wprost polecenie właściciela** ze zgłoszenia, nie moje
  założenie.

## 9. Ryzyka

- **Przeniesienie stanu widoku do adresu psuje istniejące zachowanie modułów.** Filtry są dziś
  w stanie komponentu i część logiki może zakładać, że startują od wartości domyślnych. → AC-8 jako
  twarde kryterium „bez regresji przy wejściu bez parametrów"; mechanizm wspólny, więc jedno miejsce
  do poprawienia zamiast trzech.
- **Adres puchnie od parametrów** i staje się nieczytelny. → Do adresu trafiają **tylko ustawienia
  różne od domyślnych**.
- **Faza B dotyka kilkunastu modułów naraz** — to największe ryzyko regresji w tym specu. → Faza B
  rusza dopiero po zielonej fazie A, moduł po module, każdy z osobnym sprawdzeniem „wejście bez
  parametrów działa jak dotąd" (AC-8). Wspólny mechanizm oznacza jedno miejsce do poprawki, a nie
  kilkanaście kopii.
- **Rejestr skrótów to zmiana u podstaw nawigacji klawiaturowej** — łatwo zepsuć działające skróty
  w wielu modułach. → AC-10 i AC-12 pilnują, że dotychczasowe zachowanie zostaje; ściągawka (AC-11)
  daje narzędzie do samodzielnego sprawdzenia.
- **Widget asystenta jako pierwszy element** może zepchnąć briefing poniżej pierwszego ekranu na
  telefonie. → Widget ma być zwięzły; briefing zostaje bezpośrednio pod nim.
- **Raport o architekturze zdarzeniowej może stać się „ładnym esejem" bez wartości.** → AC-22 i AC-23
  wymagają wskazania konkretnych miejsc w aplikacji oraz jawnego nazwania kosztów i tego, czego nie da
  się osiągnąć tanio.
