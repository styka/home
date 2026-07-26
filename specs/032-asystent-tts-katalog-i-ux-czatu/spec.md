# Spec: Asystent AI — katalog syntezy mowy, cykl życia czatu i domknięcie usterek UX

- **ID:** 032-asystent-tts-katalog-i-ux-czatu
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-26
- **Moduł(y):** Home / asystent AI (czat, panel akcji, ustawienia, pętla agenta), Admin (konfiguracja syntezy mowy)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Paczka 031 („asystent mówi językiem aplikacji") zostawiła sześć zgłoszeń, które administrator zebrał
w realnym użyciu i które psują asystenta w trzech różnych warstwach:

1. **Konfiguracja lektora jest wiedzą tajemną.** Administrator, żeby włączyć czytanie odpowiedzi na
   głos, musi z pamięci wpisać nazwę dostawcy i nazwę modelu syntezy mowy — bez informacji, który
   dostawca jest darmowy, który wymaga klucza i który w ogóle mówi dobrze po polsku. Efekt: funkcja
   jest w aplikacji, ale praktycznie niekonfigurowalna.
2. **Asystent potrafi się zapętlić i spalić pieniądze bez wyniku.** Przy prośbie „znajdź najważniejsze
   zadanie i opisz, dlaczego jest ważne" agent wykonał sześć wywołań modelu bez żadnego wyniku,
   wyczerpał limit kroków, wydał ~0,81 zł i oddał użytkownikowi komunikat „nie udało się dokończyć w
   limicie kroków", który nie mówi ani co ustalił, ani co zablokowało. **Ustalenie z etapu
   planowania (patrz p. 8):** bezpośrednią przyczyną nie było — jak pierwotnie zakładaliśmy — podanie
   nazwy projektu zamiast identyfikatora, bo rozwiązywanie nazwy dla zadań już działa. Odpowiedź
   asystenta była **ucinana na limicie długości**, przez co przestawała być poprawnym komunikatem
   protokołu; aplikacja czytała to jako „zły format" i kazała modelowi odpowiedzieć jeszcze raz — w
   kółko, aż do wyczerpania kroków. Ucięcie jest dziś dla aplikacji **niewidoczne**: nie odróżnia
   „model się pomylił" od „modelowi zabrakło miejsca".
3. **Drobne, ale codzienne usterki interfejsu** — dwie listy rozwijane wychodzą poza ekran, w panelu
   akcji świeci techniczne pole, którego zwykły użytkownik nie rozumie, w ustawieniach wisi zbędna
   podpowiedź, a na telefonie każda akcja pod polem wiadomości wymaga **dwóch** dotknięć, bo pierwsze
   tylko zamyka klawiaturę. Do tego rozmowa nie ma czytelnego cyklu życia: po zamknięciu i otwarciu
   asystenta użytkownik wraca w środek starej rozmowy, z rozwiniętymi sekcjami, a niedokończony tekst
   z pola wiadomości przepada.

Robimy to teraz, bo (1) blokuje funkcję, którą już opłaciliśmy kodem, (2) generuje realny koszt przy
każdym trafieniu, a (3) dotyka najczęściej używanego wejścia do aplikacji — asystenta na telefonie.

## 2. Cel i miary sukcesu

- **Cel:** lektora asystenta konfiguruje się wyborem z listy (z widocznym kosztem i wymaganiami), agent
  nie zapętla się na nierozwiązanej nazwie i zawsze mówi, co ustalił, a czat asystenta na telefonie
  zachowuje się przewidywalnie — jedno dotknięcie = jedna akcja, nowa sesja = nowa rozmowa, rozpoczęty
  tekst nie przepada.
- **Sukces mierzymy:**
  - Administrator włącza czytanie na głos **bez wpisywania czegokolwiek z pamięci** — wybiera dostawcę
    i głos z listy, a jeśli dostawca wymaga klucza, dokłada go w tym samym miejscu i widzi, czy działa.
  - Przy każdej pozycji listy widać, **czy jest darmowa** i **co trzeba dokonfigurować**.
  - Prośba z zgłoszenia Z-2 („znajdź najważniejsze zadanie i opisz, dlaczego jest ważne, ale zapisz to
    od tyłu") kończy się odpowiedzią, a nie komunikatem o limicie kroków.
  - Powtórzenie identycznego, bezowocnego odczytu nie zdarza się więcej niż raz — agent zmienia
    podejście albo kończy z częściowym wynikiem.
  - Żadna lista rozwijana w asystencie nie jest przycięta krawędzią ekranu (telefon i komputer).
  - Na telefonie akcje pod polem wiadomości reagują na **pierwsze** dotknięcie.
  - Wszystkie 6 zgłoszeń administratora z tej paczki jest zamkniętych i sprawdzalnych.

## 3. Historyjki użytkownika

- Jako **administrator** chcę wybrać dostawcę i model syntezy mowy z listy, widząc od razu koszt i
  wymagania, żeby włączyć lektora bez szukania nazw modeli w dokumentacji dostawców.
- Jako **administrator** chcę dołożyć brakujący klucz dostępowy w tym samym miejscu, w którym wybieram
  dostawcę, żeby nie krążyć między dwoma ekranami konfiguracji.
- Jako **administrator** chcę usłyszeć próbkę wybranego głosu przed zapisaniem, żeby nie ustawiać
  lektora „na słowo honoru".
- Jako **użytkownik** chcę, żeby asystent zamiast komunikatu o wyczerpanym limicie kroków powiedział mi,
  co już ustalił i co konkretnie go zablokowało, żebym wiedział, jak dokończyć rozmowę.
- Jako **użytkownik** chcę móc odwoływać się do projektu, listy czy zwierzaka **po nazwie**, tak jak w
  rozmowie z człowiekiem, i dostać wynik, a nie pętlę.
- Jako **właściciel, który płaci za zapytania**, chcę, żeby asystent przerwał bezowocne powtarzanie tego
  samego kroku, zamiast dopalać limit iteracji.
- Jako **użytkownik na telefonie** chcę, żeby dotknięcie mikrofonu, załącznika czy innej akcji pod polem
  wiadomości od razu ją uruchamiało, bez „pierwsze dotknięcie zamyka klawiaturę".
- Jako **użytkownik na telefonie** chcę, żeby listy wyboru w asystencie (m.in. poziom pracy) mieściły się
  na ekranie.
- Jako **użytkownik** chcę, żeby po ponownym otwarciu asystenta czekała na mnie **nowa** rozmowa, a
  poprzednia była jedno dotknięcie dalej, żeby nie zaczynać w środku wczorajszego wątku.
- Jako **użytkownik** chcę, żeby rozpoczęty i nieodesłany tekst wrócił do pola wiadomości, kiedy wracam
  do tej rozmowy — także na innym urządzeniu.
- Jako **użytkownik** chcę, żeby przy zmianie rozmowy zwinęły się rozwinięte sekcje (ustawienia, zgłoszenie
  problemu), żeby nowy wątek startował z czystym ekranem.
- Jako **zwykły użytkownik** nie chcę widzieć w panelu akcji parametrów pomocniczych, których nie rozumiem
  i których nie powinienem poprawiać.
- Jako **administrator** chcę mieć te parametry nadal dostępne (zwinięte), żeby móc diagnozować, po czym
  asystent faktycznie szukał.

## 4. Kryteria akceptacji (testowalne)

### Katalog i konfiguracja syntezy mowy (Z-4)

- [ ] **AC-1** — Given administrator jest na ekranie konfiguracji modeli, when otwiera przypisanie dla
  syntezy mowy (lektora), then wybiera **dostawcę z listy** i **model/głos z listy**, bez pola, w które
  trzeba wpisać nazwę modelu z pamięci.
- [ ] **AC-2** — Given lista dostawców syntezy mowy, when administrator ją przegląda, then przy każdej
  pozycji widzi po polsku: czy jest **darmowa czy płatna** (z orientacyjnym kosztem), **czy wymaga klucza
  dostępowego**, oraz **jak radzi sobie z polskim**.
- [ ] **AC-3** — Given administrator wybiera dostawcę, dla którego nie ma jeszcze skonfigurowanego dostępu,
  when zapisuje wybór, then aplikacja jasno mówi, czego brakuje, i **pozwala to uzupełnić na tym samym
  ekranie** — bez wychodzenia do innej sekcji administracyjnej.
- [ ] **AC-4** — Given skonfigurowany dostawca syntezy mowy, when administrator prosi o próbkę wybranego
  głosu, then słyszy krótkie nagranie po polsku albo dostaje czytelny komunikat, dlaczego się nie udało
  (bez ujawniania fragmentów konfiguracji ani klucza).
- [ ] **AC-5** — Given którykolwiek z obsługiwanych dostawców syntezy mowy jest wybrany i poprawnie
  skonfigurowany, when użytkownik prosi o przeczytanie odpowiedzi asystenta na głos, then słyszy tę
  odpowiedź przeczytaną po polsku.
- [ ] **AC-6** — Given brak jakiegokolwiek przypisania syntezy mowy, when użytkownik prosi o czytanie na
  głos, then funkcja korzysta z głosów przeglądarki jak dotąd (brak przypisania nie jest błędem).
- [ ] **AC-7** — Given administrator przegląda listę głosów, when zmienia dostawcę, then lista głosów
  pokazuje **głosy tego dostawcy** (nie głosy innego), a wybrany wcześniej głos nieistniejący u nowego
  dostawcy nie zostaje zapisany po cichu.

### Pętla agenta, nazwy zamiast identyfikatorów, komunikat o niedokończeniu (Z-2)

- [ ] **AC-8** — Given rozmowa, w której użytkownik odwołuje się do projektu / listy / kolekcji **po
  nazwie** („w projekcie Omnia"), when asystent sięga po jej zawartość, then dostaje właściwe dane —
  nazwa jest rozwiązywana na wskazanie konkretnego zbioru, bez pustego wyniku.
- [ ] **AC-9** — Given nazwa podana przez użytkownika pasuje do **więcej niż jednego** zbioru lub do
  żadnego, when asystent próbuje po niej sięgnąć, then otrzymuje o tym jednoznaczną informację (co
  dopasowano / czego brakuje) i **dopytuje albo wybiera jawnie**, zamiast powtarzać ten sam odczyt.
- [ ] **AC-10** — Given asystent wykonał odczyt, który nie wniósł nic nowego, when zamierza wykonać
  **identyczny** odczyt po raz kolejny, then powtórzenie jest wstrzymane, a asystent dostaje wskazówkę,
  żeby zmienić podejście lub zakończyć — łączna liczba wywołań LLM w takim przebiegu jest **niższa** niż
  limit iteracji.
- [ ] **AC-11** — Given asystent nie zdążył dokończyć w limicie kroków, when oddaje odpowiedź, then
  zawiera ona (a) to, co **udało się ustalić**, (b) **co konkretnie zablokowało** dokończenie i (c)
  konkretną podpowiedź, jak dopytać — nigdy samego zdania o limicie kroków.
- [ ] **AC-12** — Given prośba z zgłoszenia Z-2 („znajdź najważniejsze zadanie, opisz, dlaczego jest
  ważne, i zapisz to od tyłu"), when użytkownik ją wyśle, then dostaje odpowiedź merytoryczną (wskazane
  zadanie + uzasadnienie w żądanej formie), a nie komunikat o niedokończeniu.
- [ ] **AC-28** — Given odpowiedź asystenta zostaje **ucięta**, bo nie zmieściła się w dopuszczalnej
  długości, when aplikacja ją odbiera, then rozpoznaje ucięcie jako ucięcie (a nie jako „zły format"),
  daje modelowi **jedną** szansę dokończenia z instrukcją skrócenia, a przy kolejnym ucięciu oddaje
  użytkownikowi to, co udało się uzyskać, wraz z informacją, że odpowiedź była zbyt długa — bez
  powtarzania w pętli.

### Panel akcji — parametry pomocnicze (Z-5)

- [ ] **AC-13** — Given użytkownik **bez** uprawnień administratora, when otwiera panel przeglądania /
  poprawiania proponowanych akcji, then widzi wyłącznie parametry, które ma sens poprawiać (np. nazwa
  listy, produkt, ilość) — parametry pomocnicze/techniczne (np. wartość, po której backend wyszukuje
  encję) **nie są widoczne**.
- [ ] **AC-14** — Given **administrator**, when otwiera ten sam panel, then parametry pomocnicze są
  dostępne, ale **domyślnie zwinięte** pod jednym, wyraźnie opisanym rozwinięciem.
- [ ] **AC-15** — Given parametr o długiej wartości, when jest wyświetlany w panelu akcji, then jego
  treść **zawija się wewnątrz** panelu — nie wychodzi poza jego obszar i nie powoduje przewijania w
  poziomie.

### Listy rozwijane w asystencie (Z-1)

- [ ] **AC-16** — Given telefon o typowej szerokości ekranu, when użytkownik otwiera w asystencie listę
  wyboru poziomu pracy (standardowy / oszczędny), then cała lista jest widoczna w obszarze ekranu —
  żadna opcja nie jest przycięta ani niedostępna.
- [ ] **AC-17** — Given asystent otwarty na komputerze, when użytkownik otwiera którąkolwiek listę wyboru
  w asystencie, then zachowuje się jak wyżej (lista mieści się w widocznym obszarze).

### Ustawienia asystenta (Z-3)

- [ ] **AC-18** — Given ustawienia asystenta, when użytkownik je otwiera, then **nie ma** tam zdania
  „Zapisywane na Twoim koncie — widoczne na każdym urządzeniu. Zmiany zapisują się automatycznie.", a
  pozostała treść ustawień jest bez zmian.

### Klawiatura i cykl życia rozmowy na telefonie (Z-6)

- [ ] **AC-19** — Given telefon z otwartą klawiaturą i kursorem w polu wiadomości, when użytkownik
  dotknie akcji leżącej pod polem (np. mikrofon, załącznik), then akcja uruchamia się przy **pierwszym**
  dotknięciu, a klawiatura pozostaje otwarta.
- [ ] **AC-20** — Given telefon z otwartą klawiaturą i wpisaną wiadomością, when użytkownik dotknie
  wysłania, then wiadomość zostaje wysłana **jednym** dotknięciem, a klawiatura się zamyka.
- [ ] **AC-21** — Given w asystencie rozwinięta jest sekcja (ustawienia albo zgłoszenie problemu), when
  użytkownik przełącza się na inną rozmowę (historyczną lub nową) albo zamyka bieżącą, then rozwinięte
  sekcje są zwinięte.
- [ ] **AC-22** — Given rozmowa z co najmniej jedną wiadomością, when użytkownik zamknie asystenta i
  otworzy go ponownie, then widzi **nową, pustą rozmowę**, a poprzednia jest dostępna w historii.
- [ ] **AC-23** — Given rozmowa **bez ani jednej** wiadomości, when użytkownik zamknie asystenta i otworzy
  go ponownie, then wraca do tej samej pustej rozmowy — w historii **nie powstaje** kolejny pusty wpis.
- [ ] **AC-24** — Given użytkownik otworzył asystenta i ma przed sobą nową rozmowę, when chce wrócić do
  poprzedniej, then robi to **jednym** dotknięciem elementu widocznego bez otwierania historii, opisanego
  tak, że widać, do której rozmowy wraca (np. jej tytuł).
- [ ] **AC-25** — Given użytkownik wpisał tekst w polu wiadomości i **nie** wysłał go, when zamknie
  asystenta (albo przełączy się na inną rozmowę) i wróci do tej rozmowy, then wpisany tekst jest z
  powrotem w polu wiadomości i można go dokończyć.
- [ ] **AC-26** — Given niewysłany tekst zapisany w rozmowie na jednym urządzeniu, when użytkownik otworzy
  tę rozmowę na **innym** urządzeniu, then tekst też tam wraca do pola wiadomości.
- [ ] **AC-27** — Given rozmowa z zapamiętanym niewysłanym tekstem, when użytkownik wyśle wiadomość, then
  zapamiętany tekst przestaje istnieć (po powrocie pole jest puste).

## 5. Zakres

**W zakresie:**

- Katalog znanych dostawców syntezy mowy z informacją o koszcie, wymaganiach i jakości polskiego głosu,
  wybór dostawcy i głosu z listy, uzupełnienie brakującego dostępu na tym samym ekranie, próbka głosu.
- **Obsługa wszystkich dostawców z katalogu** — czyli faktyczna możliwość czytania na głos u każdego z
  nich, nie tylko u tych zgodnych z dotychczasowym sposobem wołania (decyzja właściciela, p. 8).
- Rozwiązywanie nazw (projekt / lista / kolekcja) na konkretny zbiór przy odczytach asystenta, w tym
  jednoznaczna informacja o braku dopasowania i o wielu dopasowaniach.
- Wykrywanie bezowocnego powtarzania tego samego odczytu i przerywanie pętli.
- Użyteczna odpowiedź, gdy asystent nie zdąży dokończyć: co ustalił, co zablokowało, jak dopytać.
- Ukrycie parametrów pomocniczych panelu akcji przed nie-administratorem, zwinięty dostęp dla
  administratora, zawijanie długich wartości.
- Naprawa list rozwijanych asystenta wychodzących poza ekran (telefon i komputer).
- Usunięcie zbędnej podpowiedzi z ustawień asystenta.
- Telefon: pierwsze dotknięcie uruchamia akcję pod polem wiadomości; wysłanie jednym dotknięciem zamyka
  klawiaturę.
- Cykl życia rozmowy: nowa rozmowa po ponownym otwarciu (z reużyciem pustej), zwijanie sekcji przy
  zmianie rozmowy, jednodotknięciowy powrót do poprzedniej rozmowy.
- Zapamiętywanie niewysłanego tekstu przy rozmowie, na koncie użytkownika (wraca na każdym urządzeniu).

**Poza zakresem (świadomie):**

- Podnoszenie limitu kroków agenta — celem jest **nie potrzebować** więcej kroków, nie kupować ich więcej.
- Zmiana sposobu wyboru modeli dla pozostałych typów operacji (rozumowanie, obraz, generowanie) — katalog
  dotyczy tylko syntezy mowy; ujednolicenie reszty to osobny temat.
- Rozpoznawanie mowy (dyktowanie) — pozostaje na dotychczasowym rozwiązaniu przeglądarkowym.
- Trwałe przechowywanie nagrań audio — nadal nic nie zapisujemy.
- Automatyczne dobieranie najtańszego dostawcy syntezy mowy — wybór zostaje decyzją administratora.
- Zmiana zachowania rozmowy poza asystentem (czat w module Usługi).
- Wersjonowanie/historia niewysłanych tekstów — pamiętamy **ostatni** stan pola, nie jego historię.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Katalog i konfiguracja syntezy mowy pozostają za
  `module.admin`; asystent i panel akcji — jak dotąd (sesja + uprawnienia modułów, których dotyczą
  akcje). Nowość: panel akcji **różnicuje widok** według tego, czy użytkownik ma uprawnienia
  administratora (C-22).
- **Własność danych:** niewysłany tekst i cykl życia rozmowy dotyczą rozmów asystenta, które są
  **per użytkownik** (bez współwłasności zespołowej) — zostaje tak, jak jest (C-21). Konfiguracja
  syntezy mowy jest systemowa (administracyjna), nie per użytkownik.
- **Asystent AI:** nie dodajemy nowych akcji zapisu. Zmieniamy zachowanie odczytów (rozwiązywanie nazw)
  i pętli agenta oraz sposób prezentacji parametrów w panelu akcji — czyli **kontrakt akcji** i pokrycie
  akcji muszą pozostać kompletne i przechodzić bramki (C-23).
- **Kalendarz / powiadomienia / trash:** nie dotyczy — feature nie tworzy encji podlegających
  przywracaniu ani zdarzeń kalendarza. Rozmowy asystenta zachowują dotychczasowy sposób usuwania.

## 7. Zgodność z konstytucją

- **C-01, C-02** — cała praca w `worldofmag/`, importy przez alias; nic w legacy.
- **C-10, C-11, C-12** — zapamiętywanie niewysłanego tekstu na koncie oznacza zmianę schematu, więc
  wymaga **ręcznie napisanego pliku migracji** z unikalnym, kolejnym numerem; żadnych enumów Prisma
  (rodzaj dostawcy syntezy mowy to `String` + zawężający typ TypeScript).
- **C-13** — weryfikujemy lokalnie do kroku budowania aplikacji, **nigdy** przeciw produkcyjnej bazie.
- **C-20** — zapis niewysłanego tekstu i konfiguracji syntezy mowy przez Server Actions z
  `revalidatePath()`; bez ręcznej inwalidacji gdzie indziej.
- **C-22** — różnicowanie widoku panelu akcji opiera się na istniejącym RBAC, nie na nowym flagowaniu.
- **C-23** — kontrakt akcji zostaje źródłem prawdy dla tego, które parametry są „pomocnicze"; bramki
  pokrycia akcji muszą dalej przechodzić.
- **C-30, C-31, C-32** — kolory tylko przez zmienne CSS; poprawki list rozwijanych i klawiatury muszą
  działać na telefonie z zachowaniem minimalnych celów dotyku i obszaru bezpiecznego; wszystkie teksty
  po polsku.
- **C-40, C-41** — katalog syntezy mowy **nie może** wprowadzać hardcodowanego dostawcy/modelu w kodzie
  wołającym: dobór dalej rozstrzyga konfiguracja administratora; klucze pozostają szyfrowane w spoczynku
  i maskowane w interfejsie, a treść błędu dostawcy nie wycieka do klienta.
- **C-50, C-51** — „gotowe" = przechodzi budowanie; każda naprawiona usterka trafia jako wpis do
  `doświadczenia.md`.
- **C-53** — minimalizm: przy dostawcach syntezy mowy trzymamy **jeden** wspólny sposób opisu i jak
  najmniejszą warstwę różnicującą; nie refaktorujemy „przy okazji" pozostałych typów operacji.
- **C-54, C-55** — pytania zadane raz, na starcie; dalsze etapy jadą na decyzjach z p. 8 i poprawiają
  artefakty w górę łańcucha, jeśli coś je unieważni.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie zadane w jednym momencie na starcie (C-55). Odpowiedzi właściciela:

- [x] **D-1 — zakres syntezy mowy:** *„Katalog + adaptery wszystkich znanych dostawców"*. Katalog obejmuje
  wszystkich znanych dostawców syntezy mowy i **każdy z nich ma faktycznie działać** (nie tylko ci, którzy
  pasują do dotychczasowego sposobu wołania). Właściciel wybrał to świadomie, mimo zaproponowanego
  węższego wariantu.
  - **Zastrzeżenie odnotowane:** to najszerszy z trzech wariantów — każdy dostawca poza rodziną zgodną z
    dotychczasowym sposobem wołania to osobny tor kodu, własna lista głosów i własny format błędów, a
    część torów może nigdy nie zostać użyta (C-53). Realizujemy w całości zgodnie z decyzją, ale plan
    **musi** ograniczyć koszt utrzymania: jeden wspólny opis dostawcy, cienkie warstwy różnicujące,
    identyczne zachowanie przy braku klucza. Dostawcę, którego nie da się uruchomić bez płatnego konta,
    oznaczamy w katalogu i weryfikujemy zachowanie „brak dostępu" zamiast realnego nagrania.
- [x] **D-2 — parametry pomocnicze w panelu akcji:** ukryte przed zwykłym użytkownikiem, dla
  administratora dostępne, ale domyślnie zwinięte; plus naprawa wychodzenia poza obszar (AC-13..AC-15).
- [x] **D-3 — cykl życia rozmowy:** ponowne otwarcie asystenta = nowa rozmowa, **z wyjątkiem** rozmowy
  całkiem pustej (wtedy reużywamy jej, żeby nie zaśmiecać historii); powrót do poprzedniej rozmowy jednym
  dotknięciem, bez otwierania historii (AC-22..AC-24).
- [x] **D-4 — niewysłany tekst:** zapamiętywany przy rozmowie **na koncie** (wraca na każdym urządzeniu),
  co oznacza zmianę schematu i ręczną migrację (AC-25..AC-27).

Założenia przyjęte samodzielnie (nie wymagały pytania, C-55):

- **Z-2 rozwiązujemy bez podnoszenia limitu kroków** — naprawiamy przyczynę (nierozwiązana nazwa,
  powtarzany odczyt), nie objaw.
- **Rozwiązywanie nazw dotyczy odczytów asystenta ogółem**, nie tylko zadań — ta sama pomyłka („nazwa
  zamiast wskazania") może wystąpić przy listach zakupów, kolekcjach czy zwierzakach.
- **Sposób prezentacji „co ustalił / co zablokowało"** korzysta z tego samego, ludzkiego języka co
  reszta odpowiedzi asystenta po 031 — bez surowych danych technicznych.

**Korekta ustalona na etapie `/plan` (C-54):** rozpoznanie przyczyny Z-2 z p. 1 zostało poprawione po
przeczytaniu kodu. Rozwiązywanie **nazwy** projektu na wskazanie zbioru jest już zrobione (wdrożone w
paczce 025) i w zgłoszonym przebiegu zadziałało — dane wróciły. Prawdziwą przyczyną było **ucięcie
odpowiedzi na limicie długości**, nierozpoznawane przez aplikację (nowe **AC-28**). AC-8/AC-9
pozostają w zakresie w **dwóch** rolach: (a) jako zabezpieczenie przed regresją tego, co działa dla
zadań, i (b) jako **rozszerzenie** na pozostałe odczyty (listy zakupów, notatki, przepisy, zwierzęta,
talie…), gdzie takiego rozwiązywania nazw **nadal nie ma** — tam nierozpoznana nazwa daje albo pustą
odpowiedź, albo dane spoza intencji użytkownika.

## 9. Ryzyka

- **Rozrost liczby dostawców syntezy mowy (D-1) rozjeżdża utrzymanie.** → Jeden wspólny opis dostawcy w
  katalogu, jak najcieńsza warstwa różnicująca, wspólna obsługa braku klucza i błędu; dostawcy niedostępni
  bez płatnego konta jawnie oznaczeni.
- **Nie każdego dostawcę da się realnie sprawdzić** (brak konta / klucza w środowisku). → Dla takich
  weryfikujemy poprawne zachowanie „brak dostępu / nieskonfigurowany" i oznaczenie w katalogu, a fakt
  niesprawdzenia realnego nagrania zapisujemy w raporcie weryfikacji.
- **Zapamiętywanie niewysłanego tekstu na koncie może generować ruch przy każdym znaku.** → Zapis
  rzadki i zbiorczy (przy opuszczeniu rozmowy / zamknięciu asystenta), nie przy każdym naciśnięciu.
- **Utrzymanie klawiatury otwartej na telefonie jest wrażliwe na przeglądarkę** (Safari/iOS zachowuje się
  inaczej niż Chrome). → Sprawdzenie na obu rodzinach przeglądarek; zachowanie awaryjne to stan dzisiejszy
  (akcja i tak się wykonuje), nigdy zablokowana akcja.
- **Reużycie pustej rozmowy może przypadkiem „wskrzesić" starą rozmowę**, jeśli za szeroko zdefiniujemy
  „pustą". → „Pusta" = bez ani jednej wiadomości; sam zapamiętany, niewysłany tekst nie czyni rozmowy
  niepustą w sensie historii, ale nie znika przy powrocie (AC-23 + AC-25 razem).
- **Ukrycie parametrów przed nie-administratorem może ukryć coś potrzebnego.** → Podział opiera się na
  kontrakcie akcji (jedno źródło prawdy), więc jest przeglądalny i łatwy do skorygowania.
