# Spec: Warstwa `domain/` — reguły biznesowe dają się sprawdzić bez bazy

- **ID:** 069-warstwa-domain
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-14
- **Moduł(y):** wszystkie 21 (klasyfikacja), realne wyodrębnienie w podzbiorze wyłonionym pomiarem

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Reguły biznesowe Omnii mieszkają dziś **wewnątrz plików akcji serwerowych** i są tam
**przymusowo prywatne**. Nie jest to kwestia stylu ani niedbalstwa — to konsekwencja twardej
reguły frameworka: plik oznaczony jako serwerowy **nie może wyeksportować niczego poza funkcją
asynchroniczną**. Reguła, która nie jest asynchroniczną akcją (a reguła biznesowa z definicji nie
jest — to czyste liczenie), **nie ma jak opuścić tego pliku**.

Skutek jest konkretny i policzalny: **55 funkcji pomocniczych w 30 plikach akcji**, których
**nie da się zaimportować do testu**. Jedyny sposób sprawdzenia którejkolwiek z nich to postawić
bazę, założyć użytkownika, założyć rekordy i przejść całą akcją — czyli zapłacić kilkaset
milisekund i sporo fixture'u za sprawdzenie funkcji, która liczy znak liczby.

W praktyce więc **nie są sprawdzane wcale**. Wśród nich są rzeczy, których pomyłka jest cicha
i kosztowna: znak salda zależny od rodzaju elementu portfela (kredyt vs oszczędności), wyznaczanie
następnego terminu opieki nad zwierzęciem, normalizacja harmonogramu leków (godziny, dni tygodnia,
rodzaj częstotliwości), granice okresu rozliczeniowego, geometria korytarza robót drogowych.

Rozdz. 10.1 dokumentu docelowego opisuje warstwę, która ma dokładnie ten problem rozwiązywać:
`domain/` — *„reguły biznesowe; nie zna Prismy, Reacta, sesji; testowana jednostkowo, bez bazy,
w milisekundach"*. **Dziś w żadnym z 21 modułów taki katalog nie istnieje.**

**Uzupełnienie po pomiarze wykonanym na etapie planowania (C-54).** Pierwotny opis problemu był
niepełny w jednym istotnym punkcie. Reguły, które **zdołały** opuścić pliki akcji, mają się dobrze:
w `src/modules/*/lib/` jest **33 czystych plików reguł, z czego 21 ma już test bez bazy**
(`parseQuantity`, `srs`, `petGenetics`, `storeRoute`, `recipeCost`, `searchRank`, `moon`,
`serviceSlots`…). Omnia **umie** pisać takie testy i je pisze.

To wzmacnia, a nie osłabia, diagnozę: różnicy nie robi dyscyplina zespołu, tylko **to, czy regułę
dało się wyeksportować**. Reguła w `lib/` jest testowana w dwóch przypadkach na trzy; reguła
uwięziona w pliku akcji — **w zero na 55**. Wniosek zmienia kształt rozwiązania: sednem nie jest
„zaprowadzić dyscyplinę", tylko **wyprowadzić uwięzione reguły tam, gdzie eksport jest możliwy,
i nie dopuścić, żeby przybywały nowe**.

Dlaczego teraz: to ostatnie odblokowane zadanie Fazy 3. Faza 4 (zdarzenia domenowe) będzie
wymagała, żeby akcja liczyła ładunek zdarzenia **regułą**, którą da się sprawdzić osobno — wzorzec
akcji z rozdz. 10.2 ma dla tego kroku osobne miejsce („3. Reguła biznesowa — domena, bez bazy,
testowalna osobno"). Wchodzenie w Fazę 4 bez tej warstwy oznaczałoby dokładanie do niesprawdzalnej
logiki kolejnej niesprawdzalnej logiki.

## 2. Cel i miary sukcesu

- **Cel:** reguły biznesowe Omnii są **oddzielone od infrastruktury** i **sprawdzone testem, który
  nie dotyka bazy** — a to, że nowa reguła nie może już wylądować w miejscu, gdzie jest
  niesprawdzalna, jest **pilnowane mechanicznie**, nie dobrą wolą.

- **Sukces mierzymy:**
  1. Każda reguła uznana za biznesową jest importowalna i ma test **przechodzący bez uruchomionej
     bazy danych** (dowód: zestaw testów domeny przechodzi przy zatrzymanym Postgresie).
  2. **Wszystkie 21 modułów** ma rozstrzygniętą klasyfikację — „ma wyodrębnione reguły" albo
     „nie ma czego wyodrębniać, z podanym powodem". Zero pozycji nierozstrzygniętych.
  3. Warstwa ma **niezmienniki egzekwowane bramką**: kod domeny nie sięga po bazę, sesję ani
     warstwę widoku, a plik domeny bez testu wywala build.
  4. Bramka została **zobaczona na czerwono** — dla każdego niezmiennika osobno.
  5. **Zero zmian widocznych dla użytkownika** i zero spadku istniejących liczników bramek.

## 3. Historyjki użytkownika

Bezpośrednim odbiorcą jest osoba rozwijająca Omnię (dziś: właściciel i Claude Code), ale skutek
sięga użytkownika końcowego.

- Jako **rozwijający Omnię** chcę móc sprawdzić regułę biznesową w milisekundach, bez stawiania
  bazy, żeby jej poprawianie nie było hazardem.
- Jako **rozwijający Omnię** chcę, żeby dołożenie reguły w miejscu, w którym jest niesprawdzalna,
  **zapaliło się na czerwono na buildzie**, a nie przeszło niezauważone — bo dokładnie tak powstało
  obecne 55.
- Jako **właściciel Omnii** chcę mieć pewność, że znak salda w Portfelu albo termin podania leku
  liczy się poprawnie **także w przypadkach brzegowych**, których ręcznie się nie klika (przełom
  miesiąca, pusty harmonogram, wartość spoza zakresu).
- Jako **użytkownik** chcę, żeby ta zmiana była dla mnie **niewidoczna** — nie proszę o nową
  funkcję, tylko o to, żeby istniejące dalej liczyły to samo.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given pełny przegląd wszystkich 55 funkcji pomocniczych z plików akcji, when
  każda zostanie zakwalifikowana wg jawnego kryterium (reguła biznesowa ⇄ adapter infrastruktury),
  then powstaje **rozstrzygnięcie dla każdej z nich** z podanym powodem, a liczba faktycznie
  przeniesionych wynika z tego przeglądu — **nie jest z góry założona**.

  *Uzupełnienie po implementacji (C-54) — OGRANICZENIE POMIARU, nazwane wprost:* liczba 55 obejmuje
  wyłącznie reguły, które mają **nazwę**. Reguła napisana wprost w ciele akcji żadnej nazwy nie ma,
  więc w tym liczniku nie występuje — a jest **tak samo niesprawdzalna**. Przykład znaleziony przy
  weryfikacji klasyfikacji: klasyfikacja ABC magazynu (progi 80/95 liczone od udziału narastającego)
  i martwy zapas, oba pisane w ciele `getStorageAnalytics`. Zostały wyprowadzone razem z resztą.
  Zapadka z AC-6b **nie chroni** przed regułami pisanymi bez nazwy i to jest jej znana granica,
  zapisana tutaj zamiast przemilczana.

- [ ] **AC-2** — Given regułę uznaną za biznesową, when zostanie wyodrębniona z pliku akcji,
  then jest **importowalna poza tym plikiem** i ma **test sprawdzający jej zachowanie**
  (przypadek typowy **i** co najmniej jeden brzegowy) — a nie samo jej istnienie.

- [ ] **AC-3** — Given zatrzymaną bazę danych, when uruchomimy testy warstwy reguł, then
  **wszystkie przechodzą**. To jest właściwy dowód „bez bazy" — nie deklaracja w opisie.

- [ ] **AC-4** — Given kod warstwy reguł, when spróbuje sięgnąć po bazę danych, sesję
  użytkownika, warstwę widoku albo oznaczy się jako kod serwerowy, then **build pada** ze
  wskazaniem pliku i powodu.

- [ ] **AC-5** — Given plik reguł bez odpowiadającego mu testu, when uruchomimy build, then
  **build pada**. Warstwa, w której wolno zostawić regułę nieprzetestowaną, nie rozwiązuje
  problemu, który jest powodem tego przebiegu.

- [ ] **AC-6** — Given wszystkie 21 modułów, when sprawdzimy manifest klasyfikacji, then
  **każdy moduł ma wpis** z jedną z dwóch decyzji i uzasadnieniem, a **moduł pominięty w manifeście
  wywala build**. Zadanie zamyka się rozstrzygnięciem, nie zostaje pozycją wiecznie otwartą.

- [ ] **AC-6b** — Given liczbę reguł pozostających uwięzionych w plikach akcji po tym przebiegu,
  when ktoś doda kolejną, then **build pada**. Bez tego przebieg posprząta stan dzisiejszy i pozwoli
  odtworzyć go od nowa — dokładnie tak powstało obecne 55. Licznik **może maleć** (i wtedy próg
  schodzi w dół), **nie może rosnąć**. Wzorzec zapadki sprawdzony w 068.

  *Uzasadnienie kształtu (C-54, po pomiarze):* niezmiennik dotyczy **miejsca narodzin** reguły, nie
  wyboru katalogu. Reguła w `domain/` i reguła w module w `lib/` są **obie** eksportowalne
  i testowalne — problemem jest wyłącznie plik akcji, z którego wyjścia nie ma. Bramka pilnująca
  „nowe reguły tylko w `domain/`" mierzyłaby styl, nie bezpieczeństwo (lekcja z 065).

- [ ] **AC-7** — Given każdy z niezmienników z AC-4/AC-5/AC-6/AC-6b osobno, when celowo go złamiemy,
  then bramka **realnie zgłasza błąd** — sprawdzone i opisane dla każdego z osobna. Zielona bramka,
  której nie widziano na czerwono, nie jest dowodem.

- [ ] **AC-8** — Given regułę, której kształt musiał się zmienić, żeby dała się sprawdzić
  (np. przestaje sama czytać bieżący czas, a zaczyna go przyjmować), when zmiana zostanie
  wprowadzona, then jest **wymieniona z nazwy** wraz z powodem, a wywołujące ją miejsce podaje
  wartość, którą reguła brała wcześniej sama — **wynik dla użytkownika pozostaje ten sam**.

- [ ] **AC-9** — Given cały przebieg, when zakończy się, then **żaden licznik istniejących bramek
  nie spada** (pokrycie akcji, dostęp AI, kontrakt widoku, zapadka paginacji z 068), liczba testów
  jednostkowych **rośnie**, a build jest zielony.

- [ ] **AC-10** — Given aplikację po zmianie, when przejdziemy ścieżki dotkniętych modułów, then
  **zachowanie jest identyczne** — żadnego nowego ekranu, komunikatu ani zmiany wyniku.

## 5. Zakres

**W zakresie:**
- Przegląd i **rozstrzygnięcie klasyfikacyjne** wszystkich 55 funkcji pomocniczych uwięzionych
  w plikach akcji.
- Wyodrębnienie tych, które są regułą biznesową, do warstwy reguł wewnątrz **ich własnego modułu**.
- **Test bez bazy** dla każdej wyodrębnionej reguły.
- **Bramka + manifest** obejmujące wszystkie 21 modułów, z niezmiennikami warstwy **i zapadką**
  na liczbie reguł pozostających w plikach akcji (AC-6b).
- **Test negatywny bramki** — osobno dla każdego niezmiennika.
- Wpis w dzienniku przebudowy i aktualizacja tabeli statusu zadań.

**Poza zakresem (świadomie):**
- **Etap 4 zadania 11** (usunięcie kolumn własnościowych) i **etap 2 zadania 12** (przełączenie
  odczytów na nadania) — zablokowane warunkiem produkcyjnym, którego z tej sesji spełnić się nie da.
- **Cała Faza 4** (zdarzenia domenowe, SSE) — ten przebieg ją tylko przygotowuje.
- **Spłata długu paginacyjnego** (263 zapytania bez ograniczenia) — 068 zamroziło go zapadką,
  spłata idzie modułami w osobnych przebiegach.
- **Przenoszenie współdzielonych pomocników z warstwy wspólnej** (`recurrence`,
  `medicationSchedule`, `habitStats`, `srs`). Mają konsumentów z kilku różnych modułów, a reguła
  z CLAUDE.md jest jednoznaczna: *plik należy do modułu, w którym umieścili go KONSUMENCI*.
  Wepchnięcie ich do jednego modułu **złamałoby granicę** wywalczoną w Fazie 1. Jeśli coś tu warto
  zmienić — zapisujemy jako obserwację, nie robimy.
- **Przepisywanie reguł.** Przenosimy zachowanie **bez zmian**; jedyne dopuszczalne odstępstwo
  to AC-8 i musi być nazwane.
- **Zmiana wzorca akcji na pełny pięciokrokowy z rozdz. 10.2** — wymaga zdarzeń domenowych
  (Faza 4) i wersjonowania na wszystkich modelach (zadanie 15 jest dopiero pilotem).
- **Przenoszenie istniejących, czystych plików z `modules/*/lib/` do `domain/`** (decyzja po
  pomiarze, C-54). Jest ich 33; sam ruch to kilkaset zmienionych importów **bez zmiany żadnej
  własności**, którą ten spec obiecuje: te pliki już są eksportowalne i już są testowane bez bazy
  (21 z 33). Zapłacilibyśmy dużym, ryzykownym diffem za zmianę nazwy katalogu. Manifest odnotuje
  ten stan przy każdym module, a **12 czystych plików bez testu** trafia do dziennika jako
  obserwacja i naturalny materiał na kolejne przebiegi — nie do tego.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** brak zmian. Warstwa reguł **z definicji nie zna sesji ani uprawnień** —
  dostęp rozstrzyga się warstwę wyżej, w akcji, i tam zostaje. To jest wręcz niezmiennik, którego
  pilnuje bramka (C-21 nie jest naruszone: guardy pozostają dokładnie tam, gdzie były).
- **Własność danych:** brak zmian. Nie dotykamy schematu ani zapytań; nie powstaje żadna migracja.
- **Asystent AI:** nie dotyczy — zero nowych akcji AI i zero nowych narzędzi odczytu. Manifesty
  pokrycia AI pozostają bez zmian (AC-9 pilnuje, żeby ich liczniki nie spadły).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.
- **Widoczność dla użytkownika:** **żadna** — to jest wymóg, nie skutek uboczny (AC-10).

## 7. Zgodność z konstytucją

- **C-01** — praca wyłącznie w `worldofmag/`.
- **C-53 (minimalizm)** — kluczowa dla tego przebiegu i najłatwiejsza do złamania. Pokusa brzmi:
  „skoro robimy warstwę, zróbmy ją wszędzie". Odpowiedzią jest AC-1: **przenosimy to, co pomiar
  wskaże jako regułę**, i ani jednej funkcji więcej. Wzorzec z przebiegu 064, gdzie „19 modułów"
  po pomiarze okazało się sześcioma.
- **C-54 (spójność artefaktów)** — jeśli pomiar wywróci założenie speca (np. reguł biznesowych
  okaże się dramatycznie mniej albo więcej), poprawiamy spec, a nie naginamy kod do speca.
- **C-50 (bramki)** — nowa bramka wchodzi do buildu; wszystkie istniejące muszą zostać zielone.
- **C-13** — build wyłącznie przeciw lokalnej bazie.
- **C-51** — nieoczywiste ustalenia lądują w `doświadczenia.md` razem ze zmianą.
- **C-20/C-21** — akcje zachowują `revalidatePath` i guardy dostępu; wyodrębnienie reguły **nie
  może** przy okazji wynieść poza akcję czegokolwiek, co decyduje o dostępie.
- **C-30/C-32** — nie dotyczy warstwy reguł (brak UI), ale opisy i komunikaty bramki po polsku.

## 8. Otwarte pytania / decyzje właściciela

Brak pytań — właściciel polecił prowadzić przebieg autonomicznie do końca. Decyzje przyjęte
domyślnie, wszystkie zgodne z utartym w Omnii wzorcem:

- **Kryterium klasyfikacji** — regułą biznesową jest funkcja, która **odpowiada na pytanie
  z dziedziny użytkownika** (ile, kiedy, czy wolno, w jakiej kolejności) i której wynik dałoby się
  zakwestionować w rozmowie z właścicielem. Adapterem jest funkcja, która **tłumaczy kształty**
  (rekord bazy → obiekt widoku), **woła infrastrukturę** (unieważnienie pamięci podręcznej) albo
  **broni się przed złym typem wejścia** bez podejmowania decyzji dziedzinowej.
- **Reguła mieszkająca w module, nie w warstwie wspólnej** — zgodnie z granicą z Fazy 1. Warstwa
  wspólna dostaje regułę dopiero wtedy, gdy ma konsumentów z **kilku** modułów.
- **Zamknięcie manifestem, nie deklaracją** — tak jak w 064 (klasyfikacja współdzielenia),
  065 (dostęp AI) i 068 (zapadka paginacji). Bez tego zadanie 19 zostałoby pozycją, o której za
  pół roku nie wiadomo, czy jest zrobiona.
- **Test negatywny osobno dla każdego niezmiennika** — bramka pilnująca trzech rzeczy, sprawdzona
  na jednej, jest bramką pilnującą jednej rzeczy.

## 9. Ryzyka

- **Przeniesienie zmienia zachowanie po cichu.** Reguła wyrwana z kontekstu akcji może dostać inne
  dane wejściowe niż miała (np. datę w innej strefie). → Przenosimy **bez przepisywania**; każdy
  wymuszony przez testowalność wyjątek jest nazwany (AC-8) i pokryty testem. Zestaw testów
  integracyjnych i klikacze stoją jako siatka.
- **Test, który niczego nie dowodzi.** Łatwo napisać test sprawdzający, że funkcja zwraca to, co
  zwraca. → AC-2 wymaga przypadku brzegowego; przy regułach z realnym ryzykiem pomyłki (znak salda,
  przełom miesiąca) test ma trafiać w ten właśnie przypadek.
- **Bramka zielona, bo nic nie sprawdza.** Najczęstszy tryb awarii bramek w tym projekcie
  (046: nieprawidłowa konfiguracja lintera kończyła się kodem 0; 065: wzorzec znający jeden idiom
  dawał fałszywe alarmy). → AC-7: każdy niezmiennik zobaczony na czerwono osobno.
- **Rozlanie zakresu.** „Skoro i tak dotykamy akcji, poprawmy przy okazji…". → C-53 plus jawna
  lista „poza zakresem"; wszystko inne zapisujemy jako obserwację w dzienniku.
- **Fałszywe poczucie domknięcia.** Manifest może zaklasyfikować moduł jako „bez reguł" tylko
  dlatego, że nikt nie zajrzał głębiej niż do plików akcji. → Uzasadnienie w manifeście ma mówić,
  **gdzie reguły tego modułu są**, jeśli nie w domenie (np. w warstwie wspólnej, w katalogu
  statycznym, albo moduł jest cienką nakładką na zewnętrzne API).
