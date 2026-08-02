# Spec: Strona główna jako centrum sterowania — ulubione widoki, briefing, asystent AI + porządki UX

- **ID:** 042-home-centrum-sterowania
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-02
- **Moduł(y):** Home (pulpit) · nawigacja globalna (powłoka aplikacji) · Zadania · Zakupy · Notatki

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

---

## 1. Problem / potrzeba

Omnia urosła do ~20 modułów i przestała mieć **punkt startowy**. Strona główna jest dziś zbiorem
kafelków–podsumowań: informuje, ale nie pozwala nic zrobić ani nigdzie szybko skoczyć. Właściciel
codziennie wraca do tych samych kilku miejsc (konkretny projekt zadań w konkretnym statusie, konkretna
lista zakupów, konkretny folder notatek) i za każdym razem musi się do nich **doklikiwać** przez
sidebar → moduł → filtr. Nie ma żadnego mechanizmu „zapisz to miejsce i wracaj tu jednym ruchem".

Do tego asystent AI — najmocniejsza funkcja systemu — jest schowany pod pływającym przyciskiem, więc
w praktyce bywa pomijany, a codzienny briefing wymaga świadomego kliknięcia.

Przy okazji zbieramy trzy drobne, ale codziennie irytujące usterki UX (checkboxy w zadaniach
pojawiające się przy przewijaniu palcem, nierozciągające się pole opisu zadania, brak potwierdzenia
przy kasowaniu pozycji zakupowej) oraz **niespójność nazewniczą** pojemników na treść („Grupy" znaczy
w Notatkach coś innego niż w Zadaniach, choć nazywa się tak samo).

**Dlaczego teraz:** ilość modułów przekroczyła próg, przy którym nawigacja „od korzenia" przestaje
działać. Bez skrótów do własnych miejsc system jest odbierany jako wolniejszy, niż jest naprawdę.

## 2. Cel i miary sukcesu

- **Cel:** strona główna staje się centrum sterowania (co się dzieje → co zrobić → dokąd skoczyć), a
  „ulubione widoki" stają się **globalnym systemem nawigacyjnym** dostępnym z każdego miejsca aplikacji
  — nie funkcją jednej strony.
- **Sukces mierzymy:**
  - dowolne miejsce w aplikacji (wraz z ustawionymi filtrami) da się zapisać jako ulubione **jednym
    kliknięciem**, bez wchodzenia w ustawienia;
  - powrót do zapisanego miejsca zajmuje **1 akcję** z dowolnej strony (klawiatura lub jeden klik) —
    zamiast dzisiejszych 3–4 kliknięć;
  - asystent AI jest na stronie głównej widoczny **bez żadnego kliknięcia** (desktop);
  - briefing dnia pokazuje na jednym ekranie zaległości, dzisiejsze terminy, leki/wizyty, posiłki,
    niskie stany i alerty pogodowe;
  - trzy zgłoszone usterki UX znikają, a nazwa pojemnika na treść w danym module **odpowiada jego
    zachowaniu**.

## 3. Historyjki użytkownika

**Ulubione widoki (nawigacja)**
- Jako użytkownik chcę **zapisać bieżące miejsce** (z filtrami, np. „Zadania → projekt Dom → status
  W toku") pod własną nazwą, żeby wracać do niego jednym ruchem zamiast odtwarzać filtry ręcznie.
- Jako użytkownik chcę **skakać między ulubionymi z dowolnego miejsca** aplikacji (nie tylko ze strony
  głównej), żeby przełączanie kontekstu było natychmiastowe.
- Jako użytkownik korzystający z klawiatury chcę **skrótu klawiszowego** do kilku pierwszych
  ulubionych, żeby przełączać widoki bez sięgania po mysz.
- Jako użytkownik chcę **zarządzać ulubionymi w jednym miejscu** (kolejność, nazwa, ikona/kolor,
  usunięcie), żeby lista nie zamieniła się w śmietnik.
- Jako użytkownik chcę, żeby ulubione **nie przytłaczały** — gdy nie mam żadnego, aplikacja nie może
  wyglądać na pustą ani zaśmieconą pustym miejscem po funkcji.

**Strona główna**
- Jako użytkownik chcę mieć **asystenta AI stale widocznego** na stronie głównej, żeby zadać pytanie
  bez szukania przycisku.
- Jako użytkownik chcę **briefing dnia** od razu po wejściu, żeby wiedzieć, co mnie dziś czeka i czego
  nie mogę przegapić.
- Jako użytkownik chcę **inteligentne sugestie**, co zrobić teraz, oparte o mój rzeczywisty stan danych.
- Jako użytkownik chcę **skróty do modułów**, ograniczone do tych, do których mam dostęp.
- Jako użytkownik na telefonie chcę tej samej treści w **sensownej kolejności pionowej**, bez
  poziomego przewijania i bez dwóch pasków nawigacji naraz.

**Porządki UX**
- Jako użytkownik na telefonie chcę **przewijać listę zadań palcem, nie wywołując checkboxów** — dziś
  pojawiają się przy samym dotknięciu i wyglądają na przypadkowe.
- Jako użytkownik chcę, żeby **pole opisu zadania rosło w pionie** wraz z tekstem, żeby nie czytać
  długiego opisu przez okienko na kilka linijek.
- Jako użytkownik chcę **potwierdzenia przed usunięciem** pozycji z listy zakupów, żeby nie kasować jej
  przypadkowym dotknięciem ikony kosza.
- Jako użytkownik chcę, żeby **nazwa pojemnika na treść mówiła prawdę o jego zachowaniu** — jeśli coś
  nazywa się folderem, to rzecz leży w jednym folderze; jeśli może należeć do wielu, to jest grupą.

## 4. Kryteria akceptacji (testowalne)

### Ulubione widoki — zapis i powrót
- [ ] **AC-1** — Given jestem na dowolnej stronie aplikacji z ustawionymi filtrami, when użyję akcji
  „dodaj do ulubionych" dostępnej w pasku tej strony, then bieżące miejsce **wraz z filtrami** zostaje
  zapisane pod zaproponowaną, edytowalną nazwą i akcja od razu pokazuje stan „w ulubionych".
- [ ] **AC-2** — Given mam zapisany ulubiony widok, when otworzę go z listy ulubionych, then trafiam
  **dokładnie w to samo miejsce z tymi samymi filtrami**, co przy zapisie.
- [ ] **AC-3** — Given jestem na stronie, którą już zapisałem, when ponownie użyję tej samej akcji,
  then widok zostaje usunięty z ulubionych (przełącznik działa w obie strony).
- [ ] **AC-4** — Given mam zapisane ulubione, when jestem na **dowolnej** stronie aplikacji, then mam
  dostęp do pełnej listy ulubionych bez wracania na stronę główną.
- [ ] **AC-5** — Given mam co najmniej jeden ulubiony widok, when użyję przypisanego mu skrótu
  klawiszowego, then aplikacja natychmiast przechodzi pod ten adres.
- [ ] **AC-6** — Given nie mam żadnego ulubionego widoku, when otwieram stronę główną i pozostałe
  miejsca, then funkcja nie zajmuje miejsca pustą sekcją — pokazuje najwyżej jedną, krótką zachętę do
  zapisania pierwszego widoku.
- [ ] **AC-7** — Given mam kilka ulubionych, when otworzę zarządzanie ulubionymi, then mogę zmienić ich
  **kolejność, nazwę oraz ikonę/kolor** i usunąć dowolny; zmiany są widoczne we wszystkich miejscach,
  gdzie ulubione się pokazują.
- [ ] **AC-8** — Given ulubiony widok wskazuje moduł, do którego **straciłem uprawnienie**, when
  wyświetlam listę ulubionych, then ten wpis nie jest oferowany jako klikalny skrót (nie da się przez
  ulubione ominąć RBAC).
- [ ] **AC-9** — Given zapisuję widok, którego adres jest już w ulubionych, when zatwierdzam zapis,
  then nie powstaje duplikat.
- [ ] **AC-10** — Given jestem zalogowany na innym urządzeniu, when otworzę aplikację, then widzę **te
  same** ulubione (są przypisane do konta, nie do przeglądarki).

### Strona główna
- [ ] **AC-11** — Given jestem na stronie głównej na szerokim ekranie, when strona się załaduje, then
  asystent AI jest **widoczny i gotowy do wpisania pytania bez żadnego kliknięcia** i nie znika przy
  przewijaniu strony.
- [ ] **AC-12** — Given jestem na stronie głównej na telefonie, when strona się załaduje, then
  asystent jest dostępny jednym dotknięciem stale widocznego elementu, a układ **nie** pokazuje dwóch
  pasków nawigacji naraz.
- [ ] **AC-13** — Given mam zaległe zadania, terminy na dziś/jutro, zaplanowane leki lub wizyty,
  posiłki, niskie stany magazynowe albo ostrzeżenie pogodowe, when otworzę stronę główną, then
  **briefing dnia** pokazuje te pozycje pogrupowane, a każda prowadzi do swojego miejsca w aplikacji.
- [ ] **AC-14** — Given nie mam dziś nic pilnego, when otworzę stronę główną, then briefing mówi to
  wprost (stan pusty), zamiast pokazywać puste nagłówki sekcji.
- [ ] **AC-15** — Given mam dostęp tylko do części modułów, when otworzę stronę główną, then skróty do
  modułów obejmują **wyłącznie** moduły, do których mam uprawnienie.
- [ ] **AC-16** — Given zmieniam szerokość okna od telefonu przez tablet do dużego desktopu, when
  patrzę na stronę główną, then treść układa się kolejno w 1 / 2 / 3 kolumny, **bez poziomego
  przewijania** i bez utraty żadnej sekcji — na wąskim ekranie sekcje idą w kolejności ważności.
- [ ] **AC-17** — Given mam włączoną dowolną skórkę (jasną lub ciemną), when oglądam nową stronę
  główną, then wszystkie kolory, obramowania i efekty pochodzą z motywu — nic nie zostaje nieczytelne
  po zmianie skórki.
- [ ] **AC-18** — Given korzystam z personalizacji pulpitu (kolejność i ukrywanie sekcji), when
  przebudowana strona główna się załaduje, then moje dotychczasowe ustawienia nadal działają, a nowe
  sekcje też da się przestawić lub ukryć.
- [ ] **AC-19** — Given otwieram stronę główną, when sekcje oparte o AI (sugestie, briefing) nie mają
  jeszcze wygenerowanej treści, then respektują ustawiony tryb odświeżania sekcji AI — nie generują
  się same wbrew ustawieniu użytkownika.

### Porządki UX
- [ ] **AC-20** — Given jestem na liście zadań na urządzeniu dotykowym i **nie** mam włączonego trybu
  zaznaczania, when dotknę wiersza zadania i przesunę palcem, żeby przewinąć listę, then **żaden
  checkbox się nie pojawia** ani nie zostaje widoczny po zakończeniu gestu.
- [ ] **AC-21** — Given jestem na liście zadań na urządzeniu z myszą i nie mam włączonego trybu
  zaznaczania, when najadę kursorem na wiersz, then checkbox zaznaczania pojawia się (dotychczasowe
  zachowanie na desktopie zostaje bez zmian).
- [ ] **AC-22** — Given włączę tryb zaznaczania, when patrzę na listę, then checkboxy są widoczne przy
  **wszystkich** wierszach niezależnie od urządzenia i sposobu wskazywania.
- [ ] **AC-23** — Given otwieram szczegóły zadania z opisem dłuższym niż domyślna wysokość pola, when
  wchodzę w edycję opisu, then pole **samo rozciąga się w pionie** do wysokości tekstu — bez
  wewnętrznego paska przewijania — i rośnie dalej w miarę dopisywania, do rozsądnej granicy.
- [ ] **AC-24** — Given mam na liście zakupów pozycję kupioną/zakończoną, when kliknę ikonę usuwania,
  then dostaję pytanie o potwierdzenie z nazwą pozycji, a usunięcie następuje **dopiero** po
  potwierdzeniu; rezygnacja zostawia pozycję nietkniętą.
- [ ] **AC-25** — Given w module Notatki korzystam z pojemników na notatki, when patrzę na interfejs,
  then wszędzie (nawigacja, nagłówki, przyciski, komunikaty, formularze) nazywają się **„Foldery"**,
  spójnie w liczbie pojedynczej i mnogiej — nigdzie nie zostaje słowo „Grupy" w tym znaczeniu.
- [ ] **AC-26** — Given w module Zadania korzystam z pojemników zbierających projekty, when patrzę na
  interfejs, then nadal nazywają się **„Grupy projektów"** — bo projekt może należeć do kilku naraz.
- [ ] **AC-27** — Given zmieniamy tylko nazwy widoczne dla użytkownika, when po zmianie otwieram
  Notatki, then **wszystkie istniejące dane są nienaruszone** (żaden pojemnik ani notatka nie znika,
  nie zmienia przypisania) i wszystkie dotychczasowe adresy stron nadal działają.

## 5. Zakres

**W zakresie:**

1. **Ulubione widoki jako globalny system nawigacyjny** (zadania 1.3 i 2 — ta sama funkcja z dwóch
   stron):
   - zapis dowolnego miejsca aplikacji wraz z filtrami, jednym kliknięciem z paska bieżącej strony;
   - dostęp do ulubionych z **każdej** strony (a nie tylko z pulpitu) oraz z globalnej wyszukiwarki
     poleceń;
   - skróty klawiszowe do kilku pierwszych ulubionych;
   - karty ulubionych jako sekcja strony głównej;
   - zarządzanie (kolejność, nazwa, ikona/kolor, usunięcie) w jednym miejscu;
   - respektowanie uprawnień przy wyświetlaniu i otwieraniu.
2. **Przebudowa strony głównej** (zadanie 1): stale widoczny asystent AI, briefing dnia (zaległości,
   terminy dziś/jutro, leki i wizyty, posiłki, niskie stany, alerty pogody), inteligentne sugestie,
   ulubione widoki, skróty do dostępnych modułów; responsywny układ 3 / 2 / 1 kolumny; spójna, wyciszona
   oprawa graficzna oparta wyłącznie o tokeny motywu; zachowanie dotychczasowej personalizacji pulpitu.
3. **Poprawka: checkboxy w liście zadań** (zadanie 3) — checkbox zaznaczania nie może reagować na sam
   dotyk przy przewijaniu; poza trybem zaznaczania pokazuje się tylko tam, gdzie istnieje prawdziwe
   najechanie wskaźnikiem.
4. **Poprawka: pole opisu zadania** (zadanie 4) — automatyczne rozciąganie w pionie do wysokości treści.
5. **Poprawka: potwierdzenie usunięcia pozycji zakupowej** (zadanie 5) — pytanie z nazwą pozycji przed
   skasowaniem.
6. **Ujednolicenie nazewnictwa pojemników na treść** (zadanie 6) — wprowadzenie i zastosowanie zasady
   „folder = rzecz leży w dokładnie jednym; grupa = rzecz może należeć do wielu", z konkretnym
   przemianowaniem w Notatkach (patrz §5a). Zmiana **wyłącznie warstwy widocznej dla użytkownika**.

**5a. Rozstrzygnięcie nazewnicze (audyt wszystkich modułów)**

Właściciel wybrał zasadę „nazwa odpowiada zachowaniu", nie „wszędzie to samo słowo". Przegląd
pojemników na treść w całej aplikacji i decyzje:

| Moduł | Pojemnik dziś | Zachowanie | Decyzja |
|---|---|---|---|
| Notatki | „Grupy" | notatka leży w **dokładnie jednym** pojemniku | **zmiana → „Foldery"** |
| Zadania | „Grupy projektów" | projekt może należeć do **wielu** grup naraz | **zostaje „Grupy projektów"** |
| Kuchnia | „Książki kucharskie" | przepis należy do jednej książki | **zostaje** — mocna, zrozumiała metafora dziedzinowa; „Folder przepisów" byłby regresem |
| Nauka języków | „Talie" | słówko należy do jednej talii | **zostaje** — standardowe słownictwo fiszek/SRS |
| Zakupy | „Listy" | pozycja należy do jednej listy | **zostaje** — „lista zakupów" to nazwa z rzeczywistości, nie żargon |
| Magazynowanie | „Magazyny" / „Lokalizacje" | fizyczne miejsca składowania | **zostaje** — to miejsca w świecie, nie pojemniki na treść |
| Portfel, Zdrowie, Zwierzęta, Flota, Warsztaty | brak ogólnego pojemnika „grupa/folder" | — | **bez zmian** |

Wniosek: jedyną realną niespójnością było użycie tego samego słowa „Grupy" na dwa różne zachowania.
Reszta nazw jest dziedzinowa i adekwatna — zmiana na siłę pogorszyłaby UX (C-53).

**Poza zakresem (świadomie):**

- **Stały panel asystenta na wszystkich stronach aplikacji** — właściciel wybrał wariant „stała kolumna
  na stronie głównej, pływający przycisk gdzie indziej". Doker na każdym widoku zabierałby stałą
  szerokość modułom z szerokimi tabelami (Magazynowanie, Portfel).
- **Współdzielenie ulubionych widoków z zespołem** — ulubione są prywatne dla konta. Współdzielone
  widoki wymagałyby własnego modelu uprawnień; można wrócić do tego osobnym specem.
- **Ulubione jako pełnoprawne „zapisane filtry" z własną logiką zapytań** — zapisujemy miejsce
  w aplikacji, a nie definicję zapytania. Filtry są odtwarzane dokładnie tak, jak wyglądały w adresie.
- **Automatyczne proponowanie ulubionych przez AI** na podstawie historii użycia — najpierw ręczne
  ulubione muszą się przyjąć; auto-propozycje bez tej podstawy byłyby zgadywaniem.
- **Zmiana nazw w warstwie danych i w kodzie** (nazwy modeli, kolumn, plików, adresów stron) przy
  ujednoliceniu nazewnictwa — przemianowaniu podlega tylko to, co widzi użytkownik. Migracja nazw
  technicznych byłaby ryzykiem bez korzyści dla użytkownika (C-53).
- **Przeprojektowanie stron wewnętrznych modułów** — ten spec dotyka strony głównej i powłoki
  nawigacyjnej; wygląd stron modułowych zostaje.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** **bez nowego sluga**. Strona główna działa na istniejącym `module.home`.
  Ulubione widoki są częścią powłoki aplikacji dostępnej dla każdej zalogowanej osoby, ale **każdy
  ulubiony wpis musi być filtrowany przez uprawnienie modułu, do którego prowadzi** (AC-8) — ulubione
  nie mogą stać się obejściem RBAC (C-22). Poprawki w Zadaniach, Zakupach i Notatkach działają na
  dotychczasowych uprawnieniach tych modułów.
- **Własność danych:** ulubione widoki są **wyłącznie prywatne dla użytkownika** — tak jak
  personalizacja pulpitu i menu. Świadomie **nie** wchodzimy w model współwłasności zespołowej
  (C-21): ulubione to prywatna ścieżka nawigacji, nie zasób do dzielenia.
- **Asystent AI:** feature **nie wprowadza nowej akcji AI ani nowego narzędzia odczytu** (C-23).
  Asystent zmienia tylko oprawę wizualną na stronie głównej — ta sama funkcjonalność, inne osadzenie.
  Sekcje oparte o AI na stronie głównej (sugestie, briefing) muszą nadal respektować ustawiony przez
  użytkownika tryb odświeżania sekcji AI oraz pokazywać koszt tam, gdzie pokazują go dziś (AC-19).
- **Kalendarz / powiadomienia / trash:** briefing dnia **czyta** istniejący zagregowany harmonogram
  (zadania, posiłki, leki i wizyty, opieka nad zwierzętami, przeglądy floty) — nie tworzy własnego
  źródła prawdy i niczego w nim nie zmienia. Powiadomienia zostają bez zmian. Usuwanie ulubionego
  widoku **nie** wchodzi do kosza — to prywatne ustawienie nawigacji, nie treść użytkownika, a
  usunięcie jest trywialnie odwracalne przez ponowny zapis (C-24 nie ma tu zastosowania).

## 7. Zgodność z konstytucją

- **C-01 / C-02 / C-03** — cała praca w `worldofmag/`, importy przez alias, artefakty w
  `specs/042-home-centrum-sterowania/`.
- **C-10 / C-11 / C-12** — ulubione widoki potrzebują trwałego zapisu per użytkownik → **wymagany
  ręcznie napisany plik migracji** z kolejnym wolnym numerem; żadnych enumów Prisma (ewentualne rodzaje
  wpisu to `String` + union w TypeScript).
- **C-13** — weryfikacja lokalna kończy się na kroku budowania aplikacji; **nigdy** nie uruchamiamy
  migracji ani builda przeciw produkcyjnej bazie.
- **C-20** — zapis, zmiana kolejności i usunięcie ulubionego to Server Actions z `revalidatePath()`;
  bez ręcznej inwalidacji cache gdzie indziej.
- **C-21** — ulubione są świadomie user-only (uzasadnienie w §6); nie udajemy współwłasności tam, gdzie
  jej nie ma.
- **C-22** — brak nowego sluga uprawnień, ale twarde filtrowanie ulubionych po uprawnieniach modułu
  docelowego.
- **C-23** — brak nowej `AIAction`, więc bramka pokrycia akcji nie wymaga nowych wpisów; jeśli cokolwiek
  po drodze dotknie akcji użytkownika, manifest pokrycia AI musi zostać uzupełniony, bo inaczej build padnie.
- **C-30** — nowa oprawa strony głównej (poświata, rozmycie, akcenty) **wyłącznie** na zmiennych CSS
  motywu; zero zahardkodowanych kolorów, tekst na kolorowych elementach z tokenu `--on-accent`.
  To warunek, żeby redesign nie rozsypał się przy jasnych skórkach.
- **C-31** — mobile-first i keyboard-first: nigdy dwa sidebary na wąskim ekranie, respekt dla
  bezpiecznego marginesu dolnego, minimalne cele dotyku; skróty klawiszowe do ulubionych nie mogą
  kolidować z istniejącymi (`j/k`, `x/Spacja`, `e`, `d`, `a/n`, `/`, `Ctrl+K`, `Esc`).
  **Poprawka checkboxów (AC-20) jest wprost realizacją tej reguły** — dotyk nie jest najechaniem.
- **C-32** — cały interfejs po polsku, łącznie z nowymi nazwami („Foldery", „Ulubione widoki").
- **C-50 / C-51** — „gotowe" = przechodzący build; trzy naprawione usterki i nieoczywisty wniosek
  o dotyku udającym najechanie **muszą** trafić jako wpisy do dziennika doświadczeń.
- **C-53 — minimalizm.** Reguła kluczowa dla tego specu: redesign nie może stać się pretekstem do
  przepisania asystenta ani modułów. Ten sam asystent w innej oprawie; nazewnictwo zmieniamy tam,
  gdzie nazwa **kłamie**, a nie wszędzie.
- **C-54 / C-55** — pytania zadano raz na starcie (§8); dalsze etapy jadą autonomicznie, a każde
  odkrycie zmieniające ten spec wraca tutaj, zanim ruszy dalej.

## 8. Otwarte pytania / decyzje właściciela

**Rozstrzygnięte w jedynym momencie pytań (2026-08-02):**

- [x] **Zakres przebiegu** → *„Wszystko razem, łącznie z nazewnictwem"*. Wszystkie sześć zgłoszonych
  zadań realizujemy w tym jednym specu. Konsekwencja przyjęta świadomie: **propozycje nazewnicze
  rozstrzygam rekomendowanym domyślnym** (§5a) zamiast pytać o każdą z osobna — właściciel wybrał tę
  opcję wiedząc o tym warunku.
- [x] **Głębokość „ulubionych widoków"** → *„Globalny system + karty na Home" (zalecane)*. Ulubione
  żyją w całej powłoce aplikacji: zapis gwiazdką z paska strony, karty na pulpicie, sekcja w nawigacji
  bocznej, grupa w globalnej wyszukiwarce poleceń, skróty klawiszowe, zarządzanie w ustawieniach.
- [x] **Asystent AI na stronie głównej** → *„Stała kolumna na Home, pływający przycisk gdzie indziej"
  (zalecane)*. Na szerokim ekranie strony głównej asystent ma własną, stale widoczną kolumnę; na
  tablecie, telefonie i wszystkich pozostałych stronach zostaje dotychczasowy pływający przycisk.
  Bez duplikowania asystenta — ten sam komponent w dwóch oprawach.
- [x] **Kierunek nazewniczy** → *„Rozróżniamy wg zachowania: Foldery vs Grupy" (zalecane)*.
  Notatki → „Foldery"; Zadania → zostają „Grupy projektów"; pozostałe moduły przebadane i bez zmian
  (§5a).

**Założenia przyjęte domyślnie (bez pytania, do korekty na dowolnym etapie):**

- Ulubione są **prywatne dla konta** i synchronizują się między urządzeniami (bo żyją przy koncie, nie
  w przeglądarce).
- Ulubione **nie trafiają do kosza** przy usunięciu (§6).
- Przemianowanie „Grupy" → „Foldery" w Notatkach dotyczy **tylko warstwy widocznej dla użytkownika**;
  dane, adresy stron i nazwy techniczne zostają nietknięte.
- Liczba ulubionych ze skrótem klawiszowym ogranicza się do pierwszych kilku pozycji — reszta jest
  dostępna z listy.

## 9. Ryzyka

- **Redesign strony głównej rozlewa się na przepisywanie asystenta.** Asystent to najbardziej złożony
  komponent w aplikacji — próba jego „przy okazji" refaktoryzacji zamieni ten feature w tygodniową
  operację. → Ograniczenie: asystent zostaje bez zmian funkcjonalnych, zmienia się **wyłącznie** jego
  osadzenie na stronie głównej (C-53). Naruszenie tej granicy to błąd blokujący w recenzji.
- **Ulubione widoki jako kolejny śmietnik.** Funkcja „zapisz cokolwiek" bez zarządzania szybko staje
  się listą trzydziestu nieaktualnych wpisów. → Ograniczenie: zarządzanie (kolejność, nazwa, usunięcie)
  jest częścią zakresu, nie dodatkiem; pusty stan nie zajmuje miejsca; wpisy bez uprawnień znikają same.
- **Ulubione jako obejście uprawnień.** Zapisany adres modułu, do którego użytkownik stracił dostęp, nie
  może być klikalnym skrótem. → Ograniczenie: AC-8 jako twarde kryterium, weryfikowane w `/verify`.
- **Nowa oprawa graficzna (poświata, rozmycie) rozsypuje jasne skórki.** Efekty projektowane „na
  ciemnym" bywają nieczytelne na jasnym tle. → Ograniczenie: AC-17 sprawdzany na skórce jasnej i
  ciemnej; wyłącznie tokeny motywu (C-30).
- **Poprawka checkboxów psuje zaznaczanie na desktopie.** Wyłączenie reakcji na dotyk może przy okazji
  zabrać zachowanie myszy. → Ograniczenie: AC-21 i AC-22 pilnują obu pozostałych ścieżek (mysz poza
  trybem zaznaczania, tryb zaznaczania na każdym urządzeniu).
- **Zmiana nazwy „Grupy" → „Foldery" gubi dane albo linki.** Przemianowanie kuszące do „posprzątania
  przy okazji" modelu. → Ograniczenie: AC-27 wymaga nienaruszonych danych i działających adresów;
  zmiana warstwy technicznej jest jawnie poza zakresem.
- **Personalizacja pulpitu przestaje działać po przebudowie.** Istniejące ustawienia kolejności i
  ukrycia sekcji mogą nie przenieść się na nowy układ. → Ograniczenie: AC-18 traktuje zachowanie
  dotychczasowych ustawień jako warunek odbioru.
- **Skrót klawiszowy koliduje z istniejącym.** Aplikacja jest keyboard-first i ma gęstą mapę skrótów.
  → Ograniczenie: dobór skrótu musi być sprawdzony wobec listy z C-31 na etapie planu.
