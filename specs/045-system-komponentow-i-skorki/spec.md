# Spec: System komponentów, kontrakt widoku i profesjonalny silnik skórek

- **ID:** 045-system-komponentow-i-skorki
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-04
- **Moduł(y):** przekrojowo — warstwa wspólna UI (powłoka + wszystkie 21 modułów), Skórki, Playground (admin), dokument „Omnia 🧐 — architektura docelowa"

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

---

## 1. Problem / potrzeba

Omnia ma **dobry motyw i żadnego systemu komponentów**. Nagłówek widoku, stan pusty, stan ładowania,
stan błędu, potwierdzenie usunięcia — każdy z 21 modułów pisze je od nowa i trochę inaczej. To nie
jest kwestia estetyki, tylko **kosztu**: poprawka UX wymaga obejścia dwudziestu jeden miejsc, a nowy
moduł odtwarza rozwiązania, które już istnieją. Rozdział 10 dokumentu architektury docelowej nazywa
to wprost i wskazuje **konkretny, udokumentowany dług**: w wersji 043 właściciel poprosił, żeby
przycisk zapisu widoku był „wyraźnie widoczny w pasku bieżącego widoku" — nie dało się, bo **nie ma
wspólnego paska widoku**. Przycisk trafił nie tam, gdzie miał, a odstępstwo odnotowano w recenzji.

Druga potrzeba jest równoległa i wynika z tej samej luki. Skórka w Omnii to dziś **mapa dwudziestu
kilku kolorów**. To wystarcza, żeby aplikacja była jaśniejsza albo ciemniejsza, i nie wystarcza, żeby
mogła wyglądać jak coś — jak konsola statku, jak terminal, jak papier. Właściciel chce silnika,
którym da się zbudować motyw o wyrazistym charakterze, **nienachalny i nieszkodzący UX**, na poziomie
„skórka, która wygrywa konkurs". Bez tokenów typografii, gęstości, obramowań, cieni, tła i ruchu
takiego motywu nie da się wyrazić — a bez wspólnych komponentów nie miałby czego stylować spójnie,
bo każdy moduł rysuje po swojemu.

Trzecia, wynikowa: playground komponentów istnieje, ale jest listą kilku kafelków. Nie da się z niego
dowiedzieć, co aplikacja ma w zestawie ani jak to się zachowuje w innej skórce.

## 2. Cel i miary sukcesu

**Cel:** Omnia dostaje wspólną warstwę prezentacji — komplet komponentów, kontrakt widoku, w którym
moduł **deklaruje zamiast rysować**, oraz silnik skórek zdolny wyrazić motyw o mocnym charakterze bez
utraty czytelności; wszystko oglądalne w przepisanym od zera playgroundzie.

**Sukces mierzymy:**
- Każdy z 21 modułów renderuje nagłówek i pasek widoku przez wspólny kontrakt — sprawdzalne bramką
  budowania, nie deklaracją.
- Przycisk „zapisz widok" (ulubione), wskaźnik świeżości danych i wejście do ściągawki skrótów
  pojawiają się w pasku widoku **każdego** modułu, bez zmian w kodzie modułów — dług z 043 spłacony.
- Istnieją co najmniej dwie skórki flagowe, w tym jedna mocno stylizowana (konsola sci-fi), które
  przechodzą kontrast **AA** na tekście i celach dotyku — czyli charakter nie kosztował czytelności.
- Przeglądając playground na telefonie i na komputerze da się w ≤ 2 interakcjach dotrzeć do dowolnego
  komponentu i zobaczyć go w wybranej skórce.
- Dokument architektury docelowej ma rozdział-dziennik, z którego widać **co z 46 zadań zrobiono, a
  czego nie** — bez czytania historii gita.

## 3. Historyjki użytkownika

- Jako **właściciel** chcę wybrać skórkę o wyrazistym charakterze i nadal wygodnie pracować, żeby
  aplikacja była przyjemna, a nie tylko efektowna.
- Jako **właściciel** chcę zbudować własną skórkę z podglądem na żywo i zapisać ją, żeby nie
  potrzebować programisty do zmiany wyglądu.
- Jako **właściciel** chcę wyeksportować skórkę i wczytać cudzą, żeby dało się nimi wymieniać.
- Jako **właściciel** chcę opisać wygląd własnymi słowami („jak konsola ze Star Treka") i dostać
  gotową skórkę do podejrzenia, żeby nie dobierać kilkudziesięciu tokenów ręcznie.
- Jako **właściciel** chcę mieć przycisk zapisu bieżącego widoku tam, gdzie o niego prosiłem — w
  pasku widoku — w każdym module.
- Jako **właściciel/administrator** chcę przejrzeć w jednym miejscu wszystkie wspólne komponenty,
  pobawić się ich właściwościami i zobaczyć je w każdej skórce, żeby wiedzieć, czym dysponuję i czy
  motyw nie psuje żadnego z nich.
- Jako **kolejna sesja Claude Code** chcę otworzyć dokument architektury i zobaczyć stan 46 zadań,
  żeby wiedzieć, od czego zacząć, i nie zrobić czegoś dwa razy.

## 4. Kryteria akceptacji (testowalne)

**System komponentów i kontrakt widoku**

- [ ] **AC-1** — Given dowolny z 21 modułów, when otwieram jego widok główny, then nagłówek i pasek
      widoku pochodzą ze wspólnego kontraktu widoku (identyczna struktura, odstępy i zachowanie w
      każdym module).
- [ ] **AC-2** — Given moduł, który zadeklarował widok, when powłoka go renderuje, then w pasku
      widoku pojawiają się **bez udziału modułu**: przycisk zapisu widoku, wskaźnik świeżości danych
      i wejście do ściągawki skrótów.
- [ ] **AC-3** — Given moduł bez zadeklarowanych stanów brzegowych (pusty / ładowanie / błąd / brak
      dostępu), when uruchamiam budowanie, then bramka jakości **przerywa budowanie** i wskazuje
      brakujący moduł.
- [ ] **AC-4** — Given widok listowy bez danych, błędu albo w trakcie ładowania, when go otwieram,
      then widzę wspólny stan brzegowy z tytułem, wyjaśnieniem i — o ile jest sensowna — akcją
      wyjścia; wygląda tak samo w każdym module.
- [ ] **AC-5** — Given usunięcie rekordu w dowolnym module, when je wywołuję, then dostaję wspólne
      okno potwierdzenia o tym samym układzie, treści przycisków i obsłudze klawiatury.
- [ ] **AC-6** — Given zmiana jednego wspólnego komponentu, when ją wprowadzam, then zmiana jest
      widoczna we wszystkich modułach naraz (brak kopii tego samego rozwiązania).

**Silnik skórek**

- [ ] **AC-7** — Given edytor skórki, when zmieniam dowolny token, then podgląd aktualizuje się na
      żywo, a token obejmuje nie tylko kolor, lecz także typografię, gęstość, zaokrąglenia,
      obramowania, cienie, tło i ruch.
- [ ] **AC-8** — Given wybrana skórka, when korzystam z aplikacji, then **żaden kolor motywu** nie
      jest zaszyty w kodzie — paleta pochodzi ze zmiennych, więc skórka obejmuje powłokę, ramę widoku
      i stany brzegowe. Kolory będące **danymi** (paleta wybierana przez użytkownika dla tagu,
      ilustracja w poradniku) są wyjątkiem — muszą być **jawnie oznaczone**, a nie milcząco pominięte,
      i to oznaczenie jest jedyną dopuszczalną formą pozostawienia literału koloru.
- [ ] **AC-9** — Given skórka flagowa „konsola sci-fi", when jej używam, then tekst i cele dotyku
      spełniają kontrast **AA**, a nawigacja klawiaturą i czytelność są nie gorsze niż w skórce
      domyślnej.
- [ ] **AC-10** — Given włączona systemowa preferencja ograniczenia ruchu, when używam skórki z
      animacjami, then ruch jest wyłączony, a wygląd pozostaje spójny.
- [ ] **AC-11** — Given moja skórka, when ją eksportuję i wczytuję ponownie (także na innym koncie),
      then odtwarza się identycznie.
- [ ] **AC-12** — Given wczytany plik skórki z niepoprawną lub złośliwą wartością tokenu, when go
      importuję, then wartość jest odrzucana, a reszta skórki wczytuje się poprawnie — bez
      możliwości wstrzyknięcia czegokolwiek do stylów.
- [ ] **AC-13** — Given skórka nieustawiająca części tokenów, when jej używam, then brakujące
      wartości dziedziczą domyślne — skórka częściowa nigdy nie psuje układu.

**Generowanie skórki przez AI**

- [ ] **AC-14** — Given opis motywu własnymi słowami, when proszę o wygenerowanie skórki, then
      dostaję komplet tokenów widoczny w podglądzie **zanim** cokolwiek zapiszę.
- [ ] **AC-15** — Given wynik modelu zawierający token spoza whitelisty albo złośliwą wartość, when
      trafia on do aplikacji, then jest odrzucany dokładnie tak samo jak przy imporcie pliku — model
      nie jest źródłem bardziej zaufanym niż cudzy plik.
- [ ] **AC-16** — Given wygenerowana skórka, when ją oglądam, then widzę koszt wywołania modelu na
      tych samych zasadach co w reszcie aplikacji (wskaźnik kosztu dla administratora).
- [ ] **AC-17** — Given wygenerowana skórka, when nie odpowiada opisowi, then mogę poprawić opis
      i wygenerować ponownie albo dostroić pojedyncze tokeny ręcznie — generowanie nie zastępuje
      edytora, tylko daje mu punkt startowy.

**Playground**

- [ ] **AC-18** — Given playground na komputerze, when go otwieram, then komponenty są pogrupowane w
      czytelną hierarchię kategorii z nawigacją boczną i wyszukiwarką.
- [ ] **AC-19** — Given playground na telefonie, when go otwieram, then nawigacja jest dostępna bez
      poziomego przewijania, a cele dotyku spełniają minimum; **nigdy dwa panele boczne naraz**.
- [ ] **AC-20** — Given dowolny wspólny komponent w playgroundzie, when zmieniam jego właściwości w
      sterowaniu, then demonstracja reaguje na żywo i pokazuje wariant brzegowy (pusty, długi tekst,
      błąd), a nie tylko przypadek idealny.
- [ ] **AC-21** — Given playground, when przełączam w nim skórkę, then wszystkie demonstracje
      natychmiast pokazują się w tej skórce — bez zmiany skórki całego konta.
- [ ] **AC-22** — Given nowy wspólny komponent dodany do warstwy UI, when nie ma go w playgroundzie,
      then jest to wykrywalne (playground wywodzi listę z rejestru komponentów, nie z ręcznej listy).

**Dziennik przebudowy**

- [ ] **AC-23** — Given dokument „Omnia 🧐 — architektura docelowa", when go otwieram, then ma
      rozdział-dziennik ze stanem **wszystkich 46 zadań** z checklisty (zrobione / w toku / nietknięte)
      oraz wpisem opisującym zmiany z tego przebiegu.
- [ ] **AC-24** — Given zakończony ten przebieg, when czytam dziennik, then wiem, która faza jest
      następna i dlaczego — bez otwierania historii gita.

## 5. Zakres

**W zakresie:**

1. **Analiza istniejących widoków** — przegląd komponentów wszystkich 21 modułów pod kątem
   powtarzalnych rozwiązań; z niej wynika lista komponentów wspólnych (a nie odwrotnie).
2. **Warstwa wspólnych komponentów** — komplet z rozdziału 10.4.1 w części możliwej dziś, tj. bez
   zdolności wymagających Fazy 2/4 (patrz „poza zakresem"): rama widoku, pasek widoku, stany brzegowe
   (pusty / ładowanie / błąd / brak dostępu), okno potwierdzenia, lista danych z zaznaczaniem i
   skrótami, pola i formularz, pasek akcji zbiorczych.
3. **Kontrakt widoku** — moduł deklaruje tytuł, filtry, akcje i stany brzegowe; powłoka rysuje ramę i
   sama dokłada elementy wspólne (zapis widoku, świeżość danych, ściągawka skrótów).
4. **Migracja wszystkich 21 modułów** na kontrakt widoku — moduł po module, osobnymi commitami,
   **bez zmiany zachowania widocznego dla użytkownika**.
5. **Bramka jakości** wymuszająca kontrakt widoku i zadeklarowane stany brzegowe w każdym module
   (wzorem istniejących bramek pokrycia).
6. **Rozszerzenie silnika skórek** poza kolory: typografia, skala i gęstość, zaokrąglenia,
   obramowania, cienie i poświaty, tło (gradienty/tekstury generowane kodem), krzywe i czas ruchu,
   chrom powłoki. Wraz z sanityzacją każdej nowej rodziny tokenów.
7. **Edytor skórki** z podglądem na żywo, importem i eksportem.
8. **Dwie skórki flagowe** dowożone jako systemowe, w tym jedna mocno stylizowana (konsola sci-fi
   inspirowana estetyką LCARS, bez naruszania cudzych znaków), obie zweryfikowane pod kontrast i UX.
9. **Generowanie skórki opisem słownym przez AI** (decyzja właściciela z 2026-08-04). Użytkownik
   opisuje motyw własnymi słowami („jak konsola ze Star Treka", „jak stary terminal", „jak papier
   listowy"), a model zwraca **komplet tokenów**, który trafia do edytora jako propozycja do
   podejrzenia i zapisania. Wynik przechodzi tę samą sanityzację co import pliku — model jest
   źródłem **równie obcym** jak cudzy plik.
10. **Playground napisany od zera** — hierarchia kategorii, nawigacja boczna na desktopie i szufladą na
   telefonie, wyszukiwarka, sterowanie właściwościami na żywo, warianty brzegowe, przełącznik skórki
   lokalny dla playgroundu.
11. **Rozdział-dziennik w dokumencie architektury docelowej** — status wszystkich 46 zadań plus wpis
    o zmianach z tego przebiegu; utrzymywany przez kolejne przebiegi.

**Poza zakresem (świadomie):**

- **Fazy 1–9 przebudowy architektury** (przeniesienie do `modules/`+`platform/`, współdzielenie i
  workspace'y, warstwa domenowa i paginacja, zdarzenia i koniec odpytywania, skala i koszt,
  obserwowalność, i18n, gotowość produkcyjna, domknięcie). **Powód:** dokument architektury nakazuje
  „jedna faza = jeden przebieg pipeline'u, nigdy dwie naraz", a Faza 0 (siatka bezpieczeństwa) jest
  bezwarunkowo pierwsza przed refaktorem przenoszącym pliki. Ten przebieg jest **addytywny** — dokłada
  warstwę i migruje do niej widoki, nie przenosi modułów ani nie rusza danych — więc nie wchodzi w
  kolizję z tą zasadą. Zadanie 2 właściciela („zastosuj się do wszystkich zaleceń dokumentu") jest
  zatem realizowane **etapami**, a dziennik z pkt. 10 jest mechanizmem, który pilnuje, żeby żadne z 46
  zadań nie zginęło.
- **Faza 0 (siatka bezpieczeństwa)** — klikacze 21/21 modułów, generowany test izolacji najemcy,
  bramka rozjazdu schematu. Następny przebieg; nie jest warunkiem tej, addytywnej pracy.
- **Komponenty wymagające zdolności z Fazy 2/4:** okno konfliktu edycji, okno udostępniania i wskaźnik
  udostępnienia, awatary obecności. **Powód:** nie mają się o co oprzeć — nie istnieje ani
  wersjonowanie rekordów, ani jednolity model nadań, ani kanały czasu rzeczywistego. Kontrakt widoku
  jest projektowany tak, żeby dało się je dołożyć **bez zmian w modułach**.
- **Paginacja kursorowa** w listach — zadanie 20 z Fazy 3. Wspólna lista danych jest projektowana pod
  nią, ale zapytania listowe zmieniamy w tamtym przebiegu.
- **Wielojęzyczność.** Teksty zostają po polsku (`C-32`); i18n to Faza 7.
- **Generowanie skórki przez AI działające bez wyboru użytkownika** — model **proponuje**, nigdy nie
  zapisuje ani nie włącza skórki samodzielnie. Automatyczne podmienianie wyglądu aplikacji bez
  kliknięcia byłoby zaskoczeniem, nie funkcją.
- **Grafiki binarne** (bitmapy, pliki obrazów) w skórkach. Elementy graficzne powstają jako wektor i
  CSS: skalują się, ważą tyle co nic i same reagują na tokeny skórki.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego slugu. Playground zostaje narzędziem wewnętrznym pod `module.admin`;
  edytor skórki działa na dotychczasowych zasadach (skórki użytkownika w ustawieniach, skórki systemowe
  dla administratora). — por. `C-22`.
- **Własność danych:** bez zmian w modelu współwłasności. Skórki zachowują dotychczasowy podział
  systemowa / użytkownika / zespołu (`ownerId` / `ownerTeamId`) oraz per-użytkownikowy wybór skórki. —
  por. `C-21`.
- **Asystent AI:** feature **korzysta z LLM** (generowanie skórki z opisu), ale **nie** przez katalog
  akcji asystenta — to operacja odpalana kliknięciem w edytorze skórki, nie zdanie w czacie. Brak
  nowej `AIAction` i nowego read-toola; obowiązują za to bramki kosztu i pamięci treści. — por.
  `C-23`, `C-40`.
- **Kalendarz / powiadomienia / trash:** kalendarz i powiadomienia bez zmian. Skórki użytkownika
  wpinamy w kosz na dotychczasowych zasadach modułu, jeśli dziś tam trafiają; ten przebieg tego nie
  zmienia. — por. `C-24`.
- **Migracje:** potrzebne dla skórek flagowych i ewentualnych nowych pól tokenów — wyłącznie ręcznymi
  plikami, idempotentnie, z numerem z generatora. — por. `C-10`, `C-11`, `C-14`.

## 7. Zgodność z konstytucją

| Reguła | Dlaczego kluczowa tutaj |
|--------|------------------------|
| **C-30** — motyw przez zmienne CSS, zero zaszytych hexów, tekst na akcencie z tokenu | To jest **rdzeń** feature'a. Każdy zaszyty kolor to dziura w skórce; AC-8 sprawdza to wprost, a rozszerzony silnik podnosi stawkę — dziś dziura psuje kolor, po zmianie psuje charakter motywu. |
| **C-31** — mobile-first i keyboard-first | Playground i pasek widoku to nowe powierzchnie: nigdy dwa panele boczne na telefonie, respekt dla bezpiecznego marginesu, minimalne cele dotyku, pełna obsługa klawiaturą. Rozdział 10.7 podnosi cel dotyku do 44 px w **nowych** komponentach. |
| **C-32** — teksty UI po polsku | Wszystkie nowe etykiety, stany brzegowe i opisy w playgroundzie po polsku. |
| **C-53** — minimalizm | Największe ryzyko tego przebiegu. Budujemy komponenty, które **wynikają z analizy istniejących widoków**, a nie „na wszelki wypadek"; migracja modułów nie dokłada funkcji. Zero nowych zależności — silnik skórek stoi na zmiennych CSS, które już mamy. |
| **C-20** — mutacje przez Server Actions z `revalidatePath` | Zapis, import i wybór skórki idą istniejącym wzorcem akcji. |
| **C-10, C-11, C-14** — migracje ręcznymi plikami, numer z generatora, seed idempotentny | Skórki flagowe seedujemy migracją, jak pozostałe systemowe. |
| **C-12** — zero enumów Prisma | Nowe rodzaje/warianty (np. kategoria komponentu, rodzaj tokenu) jako `String` + unia TS. |
| **C-50** — „gotowe" = zielony `npm run build` | Nowa bramka kontraktu widoku wpina się w budowanie; weryfikujemy do kroku `next build`, nigdy przeciw prod DB (`C-13`). |
| **C-51** — wpis do `doświadczenia.md` | Migracja 21 modułów na wspólny nagłówek na pewno odsłoni nieoczywiste pułapki — każda ląduje w dzienniku lekcji. |
| **C-54** — spójność artefaktów i zawracanie | Analiza widoków (pkt 1 zakresu) może pokazać, że lista komponentów jest zła. Wtedy poprawiamy **ten spec i plan**, a nie obchodzimy problem w kodzie. |
| **C-55** — jeden moment pytań | Właściciel nie odpowiedział na pytania startowe; przyjęte rekomendowane domyślne są spisane w §8 i obowiązują do końca przebiegu. |

Dwie zasady z rozdziału 10.3 dokumentu architektury traktujemy jako **twarde**, bo obie już raz
wywróciły aplikację i są zapisane w `doświadczenia.md`: nigdy CSS jako tekstowe dziecko `<style>`
(rozjazd hydratacji kładzie **całą** aplikację) i nigdy odczyt parametrów adresu w powłoce (wymusza
granicę zawieszenia i degraduje renderowanie serwerowe). Silnik skórek i pasek widoku to dokładnie te
dwa miejsca, w których najłatwiej je złamać.

## 8. Otwarte pytania / decyzje właściciela

Pytania startowe zadano jednym wywołaniem (`C-55`); właściciel nie odpowiedział, więc **przyjęto
rekomendowane domyślne** i zapisano je poniżej jako wiążące dla całego przebiegu.

- [x] **Zakres przebiegu** → Zadanie 1 (komponenty + skórki + playground) **plus** rozdział-dziennik w
      dokumencie architektury. Faza 0 i dalsze idą osobnymi przebiegami, zgodnie z nakazem dokumentu.
      *Uzasadnienie:* praca addytywna nie łamie zasady „siatka bezpieczeństwa przed refaktorem", a
      dziennik sprawia, że Zadanie 2 jest od teraz śledzone, a nie zgadywane.
      Właściciel (2026-08-04) doprecyzował: *„zrób to tak, by efekt końcowy był najlepszy; możesz
      odpalać pipeline tyle razy, ile potrzeba"* — czyli **łańcuch przebiegów jest autoryzowany
      z góry**. Ten przebieg domyka Zadanie 1; Zadanie 2 (Fazy 0–9) realizują kolejne przebiegi,
      a dziennik jest tym, co je spina.
- [x] **Zasięg silnika skórek** → pełny silnik (typografia, gęstość, zaokrąglenia, obramowania,
      cienie, tło, ruch, chrom powłoki) + dwie skórki flagowe, grafika wyłącznie wektorowa/CSS,
      **oraz generowanie skórki opisem słownym przez AI**. *(Decyzja właściciela z 2026-08-04 —
      pierwotnie odłożone na osobny przebieg, świadomie włączone do zakresu; artefakty przeliczone
      w dół zgodnie z C-54.)*
- [x] **Zasięg migracji widoków** → **wszystkie 21 modułów**, moduł po module, osobnymi commitami, bez
      zmiany zachowania. Tylko przy pełnej migracji można włączyć bramkę na twardo i tylko wtedy
      znika dług z 043.
- [x] **Playground** → pozostaje narzędziem administratora, bez nowego slugu uprawnień.
- [x] **Gałąź robocza** → `claude/omnia-architecture-skins-qlv2ew`, merge do `develop` i promocja na
      `master` zgodnie z `C-52`.

## 9. Ryzyka

| Ryzyko | Ograniczenie |
|--------|--------------|
| **Migracja 21 modułów rozlewa się i psuje zachowanie.** Największe ryzyko przebiegu — ogromny, choć mechaniczny diff. | Moduł po module, **osobny commit na moduł**, żadnych zmian funkcjonalnych przy okazji (zasada „refaktor i zmiana funkcji nigdy w jednym commicie"). Kolejność od najprostszych widoków do najbardziej rozbudowanych. |
| **Brak siatki bezpieczeństwa** — Faza 0 jeszcze nie wykonana, więc regresję w widoku może wyłapać dopiero właściciel. | Zakres jest addytywny i prezentacyjny (nie rusza danych ani dostępu); istniejące klikacze uruchamiane po migracji; przy każdym module ręczna weryfikacja, że nagłówek i akcje działają jak przedtem. |
| **Nadmiarowa abstrakcja** — kontrakt widoku, którego moduły nie chcą używać, bo jest za sztywny. | Komponenty wyprowadzamy **z analizy istniejących widoków**, nie z wyobrażenia. Kontrakt musi obsłużyć najbardziej nietypowy widok (Wiadomości, Magazynowanie), zanim uznamy go za gotowy — inaczej wracamy do speca (`C-54`). |
| **Efektowna skórka kosztem czytelności** — dokładnie to, przed czym właściciel przestrzega („nienachalna, z zachowaniem estetyki i UX"). | Kontrast AA weryfikowany dla każdej skórki flagowej, nie tylko domyślnej; ruch wyłączany systemową preferencją; skórka stylizowana ma być **wyborem**, nigdy domyślną. |
| **Zaszyte kolory w istniejących widokach** ujawnią się dopiero pod mocno stylizowaną skórką i będą wyglądać jak dziury. | Skórka flagowa jest jednocześnie **testem** silnika — wyłapane zaszycia poprawiamy przy okazji migracji danego modułu, odnotowując je jako osobne poprawki. |
| **Rozjazd hydratacji przy dostarczaniu tokenów skórki** — znany, już raz położył aplikację. | Tokeny aplikowane tą samą, sprawdzoną drogą co dziś (styl inline na elemencie głównym), nigdy jako tekstowa zawartość znacznika stylu. |
| **Dziennik przebudowy zdezaktualizuje się** i stanie się mylący. | Ma być krótki i statusowy (tabela 46 zadań + wpisy przebiegów), aktualizowany na końcu każdego przebiegu — to część definicji „gotowe" dla kolejnych faz. |
