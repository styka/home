# Spec: Wiadomości — porządek w widoku i nawigator tematów; koszty AI poza treścią (przekrojowo)

- **ID:** 083-wiadomosci-ux-i-koszty-ai
- **Status:** planned
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-19
- **Moduł(y):** Wiadomości (`module.news`), powłoka aplikacji i wspólny kontrakt widoku (wszystkie moduły), koszty AI (przekrojowo)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Właściciel przejrzał moduł Wiadomości po 082 i postawił diagnozę, która nie dotyczy jednej usterki,
tylko **gęstości chromu**: górna część strony jest zajęta elementami sterującymi zamiast treścią,
część z nich się dubluje (dwie gwiazdki ulubionych), część wygląda na zepsutą (ikona odświeżania,
która niczego nie robi, tuż nad przyciskiem „Odśwież"), a komponent kosztu AI stoi przy każdej
wygenerowanej treści i zabiera miejsce **wszystkim**, mimo że interesuje wyłącznie administratora.

Do tego dochodzi podwojenie tej samej informacji w nawigacji (bieżący temat widnieje i w pasku,
i w przyklejonym nagłówku sekcji) oraz sekcja „historia odświeżeń", której użytkownik nie potrzebuje.

Wymaganie nadrzędne właściciela: **poziom produktu konkurującego z globalnymi firmami** — „musimy
mieć najlepszy UX i wygląd". To znaczy: mniej chromu, jeden sposób zrobienia każdej rzeczy, i taki
sam układ akcji jak w pozostałych modułach.

## 2. Cel i miary sukcesu

- **Cel:** na wejściu do Wiadomości użytkownik widzi **wiadomości**, a nie panel sterowania; każda
  akcja ma dokładnie jedno miejsce; koszty AI są narzędziem administratora, nie elementem treści.
- **Sukces mierzymy:**
  - **liczba pikseli chromu nad pierwszą wiadomością spada co najmniej o połowę** (mierzone
    w przeglądarce: odległość od górnej krawędzi ramy widoku do pierwszej karty wiadomości);
  - w całej aplikacji jest **dokładnie jedna** gwiazdka ulubionych na ekranie;
  - żaden element nie wygląda na wyłączony, nie będąc wyłączonym;
  - komponent kosztu AI **nie zajmuje miejsca** u nikogo, dopóki administrator go nie włączy,
    a mimo to administrator dowiaduje się o **każdym** koszcie i wie, **za co** poleciał;
  - trzy zakładki modułu wyglądają jak jeden produkt, a moduł — jak reszta aplikacji.

## 3. Historyjki użytkownika

- Jako czytelnik chcę po wejściu do Wiadomości **od razu widzieć wiadomości**, a nie przewijać przez
  paski sterujące.
- Jako czytelnik chcę **jednej gwiazdki** ulubionych i **jednego** przycisku odświeżania, żeby nie
  zgadywać, który element co robi.
- Jako czytelnik chcę przełączać się między tematami **strzałkami albo z listy**, z opcją
  **„Wszystkie"** na pierwszym miejscu, i żeby zmiana tematu przesuwała treść **płynnie w bok** —
  jakby każdy temat był osobną kolumną.
- Jako czytelnik chcę **wybierać źródła bez oddawania im pół ekranu**, nawet mając ich kilkanaście.
- Jako czytelnik chcę **linii czasu także przy wszystkich tematach**, z czytelnym oznaczeniem, który
  wpis należy do którego tematu.
- Jako administrator chcę, żeby koszt AI **nie zaśmiecał widoku użytkownikom**, ale żebym po każdym
  wywołaniu zobaczył **kwotę i nazwę akcji**, która je wywołała — i mógł włączyć szczegóły, gdy chcę.
- Jako właściciel chcę, żeby nawigator po grupach elementów był **wspólnym komponentem**, a nie
  jednorazowym wynalazkiem Wiadomości.

## 4. Kryteria akceptacji (testowalne)

### A. Porządek w nagłówku (cała aplikacja)

- [x] **AC-1** — Given dowolny moduł na desktopie, when użytkownik patrzy na ekran, then widzi
      **dokładnie jedną** ikonę gwiazdki ulubionych (dziś są dwie: w górnym pasku powłoki i w pasku
      widoku).
- [x] **AC-2** — Given ta sama sytuacja na telefonie, then również **dokładnie jedna** gwiazdka.
- [x] **AC-3** — Given wskaźnik świeżości danych (ikona odświeżania z czasem), when użytkownik go
      widzi, then **nie wygląda jak wyłączony przycisk**: albo jest czytelnie oznaczony jako
      informacja (nie kontrolka), albo jest klikalny i faktycznie odświeża dane.
- [x] **AC-4** — Given moduł Wiadomości, when użytkownik szuka odświeżenia wiadomości, then jest
      **jedno** miejsce, które to robi, i nie sąsiaduje z elementem wyglądającym tak samo.
- [x] **AC-5** — Given dowolny inny moduł, when patrzymy na rozmieszczenie podstawowych akcji, then
      Wiadomości mają je **w tych samych miejscach** co reszta aplikacji.

### B. Koszty AI (przekrojowo)

- [x] **AC-6** — Given zalogowany użytkownik **bez** uprawnień administratora, when korzysta
      z dowolnej funkcji AI w aplikacji, then **nigdzie** nie widzi komponentu kosztu (jak dziś —
      to jest zachowanie do utrzymania, nie do zmiany).
- [x] **AC-7** — Given administrator, when wchodzi na dowolną stronę, then komponenty kosztu przy
      treściach AI są **domyślnie ukryte** i nie zajmują miejsca.
- [x] **AC-8** — Given administrator, when patrzy na górny pasek nawigacji (obok ulubionych
      i powiadomień), then widzi **ikonę-przełącznik** pokazywania kosztów; przełączenie natychmiast
      pokazuje/ukrywa komponenty kosztu przy treściach AI.
- [x] **AC-9** — Given administrator w miejscu z **innym** górnym paskiem (asystent AI), then ma tam
      dostęp do tego samego przełącznika.
- [x] **AC-10** — Given administrator z **włączonym** pokazywaniem kosztów, when patrzy na treść
      wygenerowaną przez AI, then widzi koszt oraz może rozwinąć **składowe/szczegóły** (jak dziś).
- [x] **AC-11** — Given administrator (niezależnie od stanu przełącznika), when jakakolwiek operacja
      AI wygeneruje koszt, then w **prawym górnym rogu aplikacji** pojawia się ulotne powiadomienie
      z **kwotą** oraz **nazwą biznesowej akcji użytkownika**, która je wywołała, i **samo znika**
      po chwili.
- [x] **AC-12** — Given kilka komponentów AI na jednej stronie, when każdy wygeneruje koszt, then
      z powiadomień da się jednoznacznie odczytać, **który** koszt należy do której akcji.
- [x] **AC-13** — Given ulotne powiadomienie o koszcie, when zniknie, then **nie ma sposobu**
      obejrzenia go ponownie — nie jest nigdzie trwale zapisywane jako powiadomienie.
- [x] **AC-14** — Given powiadomienie o koszcie, when na ekranie jest otwarty modal albo pływający
      przycisk asystenta, then powiadomienie jest **nad nimi** (najwyższa warstwa).
- [x] **AC-15** — Given wyłączony globalnie wskaźnik kosztów w konfiguracji administratora, when
      administrator korzysta z aplikacji, then nie widzi ani przełącznika, ani powiadomień —
      istniejący wyłącznik systemowy pozostaje nadrzędny.

### C. Widok wiadomości

- [x] **AC-16** — Given widok Wiadomości, when użytkownik go otwiera, then **nie ma już sekcji
      „historia odświeżeń"**.
- [x] **AC-17** — Given nawigacja po tematach, when użytkownik ją otwiera, then na **pierwszej
      pozycji** listy tematów jest **„Wszystkie"**, a osobny przełącznik „Strumień / Jeden temat"
      **nie istnieje**.
- [x] **AC-18** — Given przyklejony pasek nawigacji, when użytkownik czyta wiadomości, then pasek
      **nie powtarza nazwy bieżącego tematu** (ta jest w przyklejonym nagłówku sekcji); pasek ma
      strzałki wstecz/dalej i wejście do listy tematów.
- [x] **AC-19** — Given wybrany temat, when użytkownik przejdzie do sąsiedniego (strzałką lub
      z listy), then treść przesuwa się **płynnie w bok**, a nie skacze.
- [x] **AC-20** — Given przewijanie w dół przez kolejne tematy, when zmienia się temat bieżący, then
      strona **nie cofa się** i pasek nawigacji **pozostaje przyklejony** (zachowanie wywalczone
      w 082-poprawce nie może zniknąć).
      > **Korekta po decyzji z AC-18 (C-54).** Pierwotnie to kryterium wymagało też, żeby „wskaźnik
      > w pasku przesuwał się w bok za treścią". To było napisane pod pasek chipów z 082 — a AC-18
      > usuwa z paska nazwę tematu bieżącego, bo właśnie ona dublowała przyklejony nagłówek sekcji.
      > Bez chipów nie ma czego przesuwać: wyzwalacz listy pokazuje **wybrany filtr** („Wszystkie"
      > albo nazwę tematu), a to się przy przewijaniu nie zmienia. Zostaje istotna połowa —
      > brak szarpania stroną. Wrażenie ruchu w bok daje AC-19 (przejście przy zmianie tematu).
- [x] **AC-21** — Given akcje tematu (edycja, usunięcie, dodanie nowego), when użytkownik ich szuka,
      then są **przy temacie**, którego dotyczą, a nie w pasku nawigacji.
- [x] **AC-22** — Given użytkownik z kilkunastoma źródłami, when patrzy na widok, then wybór źródeł
      zajmuje **stałą, niewielką przestrzeń** niezależnie od ich liczby (nie rośnie z listą).
- [x] **AC-23** — Given wybór źródeł, when użytkownik go otworzy, then może zaznaczyć/odznaczyć
      pojedyncze źródła oraz **wszystkie naraz**, a stan („Wszystkie" albo „3 z 12") jest widoczny
      bez otwierania.
- [x] **AC-24** — Given wybrane **„Wszystkie" tematy**, when użytkownik przełącza widok na **linię
      czasu**, then przełącznik jest dostępny i linia czasu się wyświetla (dziś działa tylko dla
      pojedynczego tematu).
- [x] **AC-25** — Given linia czasu przy wszystkich tematach, when użytkownik ją czyta, then przy
      każdym wpisie **widać, do którego tematu należy**.

### G. Zakładka Źródła

- [x] **AC-26** — Given zakładka Źródła, when użytkownik patrzy na listę, then pozycje są **równo
      wyrównane** (jednakowa struktura wiersza), a nie „krzywe".
- [x] **AC-27** — Given ustawienie domyślnej długości streszczeń, when użytkownik go szuka, then
      **nie musi przewijać na sam koniec** długiej listy źródeł.
- [x] **AC-28** — Given wszystkie trzy zakładki modułu, when użytkownik je przełącza, then mają
      **ten sam** układ nagłówka, odstępów i rozmieszczenia akcji.

### H. Spójność i reużywalność

- [x] **AC-29** — Given nawigator po grupach elementów (tematy → wiadomości), when programista chce
      go użyć w innym kontekście, then jest **wspólnym komponentem** przyjmującym grupy i elementy
      jako dane, bez wiedzy o wiadomościach.
- [x] **AC-30** — Given ten wspólny komponent, when powstaje, then ma **co najmniej jednego
      konsumenta** w aplikacji (C-35 — komponent bez konsumenta jest gorszy niż jego brak).

### I. Ramki skórki

- [x] **AC-31** — Given skórka rysująca ozdobne narożniki widoku, when użytkownik przewija długą
      treść (np. Wiadomości), then narożniki **zostają na miejscu** i nie odjeżdżają z treścią.

## 5. Zakres

**W zakresie (przebieg 1):**

- Usunięcie duplikatu gwiazdki ulubionych i uporządkowanie wskaźnika świeżości — **dla całej
  aplikacji**, we wspólnym kontrakcie widoku.
- Nowe podejście do kosztów AI: przełącznik w pasku (także w asystencie), ulotne powiadomienie
  z kwotą i nazwą akcji, brak trwałego zapisu tych powiadomień.
- Wiadomości: usunięcie historii odświeżeń, nawigator tematów z „Wszystkie" zamiast przełącznika
  trybów, przeniesienie akcji tematu do sekcji tematu, filtr źródeł o stałej wysokości, linia czasu
  dla wszystkich tematów.
- Zakładka Źródła: uporządkowanie listy i ustawień.
- Spójność trzech zakładek i z resztą aplikacji; nawigator jako komponent wspólny z konsumentem.
- Naprawa przewijających się narożników skórki.

**Poza zakresem tego przebiegu — świadomie, decyzją właściciela (przebieg 2, osobny spec):**

- **Lektor** w całości: przyklejenie do dołu, usunięcie osobnej sekcji z czystą treścią, przełącznik
  śledzenia czytanego tekstu bezpośrednio na wiadomościach, automatyczne wyłączanie śledzenia przy
  ręcznym przewijaniu, pauza między wiadomościami, zapowiadanie źródła bez powtarzania go dla
  kolejnych wiadomości z tego samego portalu *(punkty E1–E6 zgłoszenia)*.
- **Gorące tematy** w całości: uporządkowanie zakładki, przegląd i zarządzanie monitorowanymi,
  zarządzanie odrzuconymi, automatyczne odsiewanie propozycji pokrywających się z monitorowanymi
  i odrzuconymi, przenoszenie dodanej propozycji do monitorowanych *(F1–F5)*.
- **Jakość treści AI**: automatyczna ponowna próba, gdy pierwsze streszczenie się nie uda, oraz
  tłumaczenie **tytułów** wiadomości na polski *(D1–D2)*.

Powód podziału (wybór właściciela): przebieg 1 to **fundament** — chrom, koszty i nawigacja, czyli
rzeczy, na których stoi wszystko inne i które dotykają całej aplikacji. Przebieg 2 to zachowania
zamknięte w module. Każdy przebieg trafia na produkcję osobno, więc efekt widać wcześniej i łatwiej
wskazać, co jeszcze nie gra.

**Poza zakresem trwale:**

- Zmiana modelu danych wiadomości, źródeł i tematów (poza tym, czego wymaga zapamiętanie wyboru
  filtrów).
- Nowe akcje asystenta AI dla nawigacji i filtrów.
- Wersja mobilna jako osobny układ — obowiązuje jeden mechanizm na oba ekrany (C-31).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Część użytkownika działa pod `module.news`; przełącznik
  kosztów i powiadomienia o koszcie są widoczne **wyłącznie dla administratora** — tak jak dziś
  rozstrzyga to istniejąca bramka widoczności kosztów (administrator **i** systemowy wyłącznik
  w konfiguracji). Uprawnienie nie może być liczone po stronie klienta: dane o modelu i tokenach nie
  mogą trafić do przeglądarki nie-administratora (AC-6).
- **Własność danych:** stan przełącznika kosztów i wybór filtrów w Wiadomościach to preferencje
  **per użytkownik**. Preferencja czysto widokowa może żyć w adresie strony/przeglądarce; jeśli ma
  przeżyć zmianę urządzenia — należy do przestrzeni osobistej użytkownika (C-21).
- **Asystent AI:** nie dotyczy — zero nowych `AIAction` i narzędzi odczytu (C-23). Asystent jest
  natomiast **konsumentem** zmiany B: jego własny górny pasek musi dostać przełącznik (AC-9),
  a jego wywołania — powiadomienia o koszcie z nazwą akcji.
- **Kalendarz / powiadomienia / trash:** ulotne powiadomienie o koszcie **nie jest** powiadomieniem
  systemowym — nie trafia do dzwonka ani do bazy (AC-13). Kosz i kalendarz: nie dotyczy.

## 7. Zgodność z konstytucją

- **C-33** — sedno przebiegu. Podwójna gwiazdka i mylący wskaźnik świeżości to **chrom powłoki**,
  więc poprawka należy do wspólnego kontraktu widoku, a nie do modułu. Gdy rama nie pasuje —
  poszerzamy ramę, nie robimy wyjątku w module.
- **C-35** — nawigator po grupach dowozimy **razem z konsumentem**; komponent bez konsumenta jest
  gorszy niż jego brak.
- **C-30 / C-31 / C-32** — kolory wyłącznie ze zmiennych CSS, jeden mechanizm na telefon i desktop,
  cele dotyku, teksty przez warstwę tłumaczeń.
- **C-34** — usunięcie tematu i inne operacje nieodwracalne przez wspólne okno potwierdzenia.
- **C-36** — nawigator i przełącznik kosztów to **zdolności platformy** (nie zna ich żaden moduł);
  moduł Wiadomości jest ich konsumentem. Powłoka nie sięga do wnętrza modułu.
- **C-53** — minimalizm: usuwamy elementy (historia odświeżeń, duplikat gwiazdki, przełącznik
  trybów), a nie dokładamy nowych warstw. Każdy usunięty element to mniej do utrzymania.
- **C-20 / C-21** — zapamiętanie preferencji przez Server Actions z odświeżeniem ścieżki i własność
  po przestrzeni osobistej.
- **C-50 / C-51 / C-52** — zielony build jako definicja „gotowe"; lekcje z nieoczywistych problemów
  do dziennika; merge do `develop` i promocja na produkcję.
- **C-54** — przebieg 2 jest **zapisany w tym specu** jako świadome „poza zakresem", więc podział nie
  gubi ani jednego punktu zgłoszenia.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie pytania zadane w jednym momencie (C-55). Odpowiedzi:

- [x] **Metafora „kolumn" w nawigacji tematów** → **jeden pionowy strumień + poziome przejście przy
      zmianie tematu**. Treść zostaje jednym strumieniem („Wszystkie" = tematy po kolei), a wybór
      tematu przesuwa ją płynnie w bok jak przejście między kolumnami; przy zwykłym przewijaniu
      wskaźnik tematu sam jedzie w bok. Zachowuje czytanie ciągiem i lektora przez wiele tematów.
- [x] **Wybór źródeł** → **ikona filtra w pasku nawigacji + rozwijana lista** z licznikiem
      („Wszystkie" / „3 z 12"), wyszukiwarką i zaznaczaniem wszystkich. Stała wysokość niezależnie
      od liczby źródeł.
- [x] **Gorące tematy — odsiewanie** → **tak, odsiewać propozycje podobne do monitorowanych
      i odrzuconych**, trzy sekcje (Monitorowane / Propozycje / Odrzucone), dodanie propozycji
      przenosi ją do monitorowanych. *(Realizacja w przebiegu 2 — decyzja zapisana tutaj, żeby
      przebieg 2 nie musiał pytać ponownie.)*
- [x] **Podział na przebiegi** → **dwa przebiegi**; zawartość każdego wypisana w sekcji „Zakres".

Założenia przyjęte samodzielnie (rozsądny domyślny, C-55), odnotowane zamiast pytania:

- **Duplikat gwiazdki znika z paska widoku, a zostaje w górnym pasku powłoki** — bo tam jest dostępna
  z każdej strony, także spoza modułów, i sąsiaduje z powiadomieniami, czyli z resztą chromu konta.
- **Wskaźnik świeżości przestaje wyglądać jak przycisk** — pozostaje informacją, a nie kontrolką;
  jedynym miejscem odświeżania Wiadomości zostaje przycisk w nagłówku modułu.
- **Nazwa biznesowej akcji w powiadomieniu o koszcie** jest podawana przez miejsce wywołania
  (np. „Streszczenie wiadomości", „Ocena obserwatorów pogody"), a nie zgadywana z typu operacji —
  typ operacji nie odróżnia dwóch komponentów na tej samej stronie.
- **Historia odświeżeń znika z widoku użytkownika**; jeśli dane o przebiegach są potrzebne
  administratorowi, ich miejscem jest panel administratora, nie moduł użytkownika.

## 9. Ryzyka

- **Zmiana chromu dotyka wszystkich 21 modułów** → poprawka idzie we wspólnym kontrakcie widoku,
  więc jest jedna; ryzykiem jest regresja w module, który polegał na dublującym się elemencie —
  sprawdzamy przeglądem wszystkich tras i klikaczem.
- **Ukrycie kosztów może je „schować" administratorowi na dobre** → dlatego ulotne powiadomienie
  jest **niezależne** od przełącznika: administrator dowiaduje się o koszcie zawsze, a przełącznik
  decyduje tylko o szczegółach przy treści.
- **Ulotne powiadomienia mogą zalać ekran** przy wielu wywołaniach naraz → potrzebna rozsądna
  kolejka/łączenie; to jest decyzja planu, ale ryzyko odnotowane tutaj.
- **Poziome przejście między tematami może wejść w konflikt z przewijaniem** — dokładnie ta klasa
  błędu, która wyszła w 082 (przewijanie szarpiące stroną) → obowiązuje zasada z lekcji: przewijamy
  **konkretny** kontener, nigdy przez mechanizm sięgający przodków; weryfikacja **w przeglądarce**,
  nie samym buildem.
- **Usunięcie elementów może zabrać komuś funkcję** → historia odświeżeń i przełącznik trybów są
  zastępowane (nawigator z „Wszystkie"), a nie po prostu kasowane; usunięcie bez zamiennika dotyczy
  wyłącznie duplikatów.
- **Narożniki skórki** rysują się dziś wewnątrz przewijanej treści; poprawka nie może zmienić ich
  wyglądu w modułach, gdzie problem nie występuje (bo treść jest krótka) → sprawdzamy na module
  krótkim i długim.
