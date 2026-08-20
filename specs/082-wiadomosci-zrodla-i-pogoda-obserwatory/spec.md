# Spec: Wiadomości — naprawa odświeżania, biblioteka źródeł i nawigacja po tematach; Pogoda — obserwatory wg stanu

- **ID:** 082-wiadomosci-zrodla-i-pogoda-obserwatory
- **Status:** planned
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-19
- **Moduł(y):** Wiadomości (`module.news`), Pogoda (`module.weather`), panel administratora (`module.admin`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Właściciel zgłosił cztery rzeczy z dwóch modułów, wszystkie o jednym: **moduł Wiadomości jest dziś
nieużywalny, a Pogoda nieczytelna przy większej liczbie obserwatorów.**

1. **Odświeżanie wiadomości nie działa w ogóle.** Moduł pokazuje komunikat o nieudanym ostatnim
   przebiegu z surowym błędem bazy danych. To nie jest usterka kosmetyczna — pula artykułów nie jest
   zasilana, więc *żadna* funkcja modułu (tematy, linia czasu, gorące tematy, czytnik) nie ma z czego
   działać. Naprawa tego bloku jest warunkiem sensowności pozostałych trzech zadań.
2. **Dodanie źródła wymaga ręcznego wpisania konfiguracji.** Użytkownik musi sam znaleźć adres kanału
   RSS portalu, co w praktyce oznacza, że zostaje przy trzech źródłach zaseedowanych przy pierwszym
   wejściu. System powinien znać setki gotowych źródeł z Polski i ze świata, a administrator — móc tą
   biblioteką zarządzać bez wdrożenia nowej wersji aplikacji.
3. **Obserwatory pogody nie odpowiadają na najczęstsze pytanie.** Użytkownik patrzy na nie, żeby
   dowiedzieć się „co dziś wypala" — a dostaje listę w kolejności dodania, w której stan (spełniony /
   częściowo / niespełniony / brak danych) trzeba wyłuskać z każdej karty osobno.
4. **Przełączanie tematów wiadomości jest niewidoczne.** Aktualny temat stoi w przypiętym pasku sam;
   pozostałe są schowane za rozwijaną listą, więc z ekranu nie widać, że w ogóle są inne tematy.

## 2. Cel i miary sukcesu

- **Cel:** odświeżanie wiadomości kończy się sukcesem; użytkownik dokłada źródła z gotowej biblioteki
  albo ręcznie; administrator zarządza biblioteką z panelu; obserwatory pogody czyta się „po stanie";
  tematy wiadomości widać i przewija się w poziomie.
- **Sukces mierzymy:**
  - odświeżanie modułu Wiadomości kończy się statusem „zakończone" i pula rośnie o pobrane artykuły
    (dziś: 100% przebiegów kończy się błędem);
  - dodanie znanego źródła zajmuje **≤ 3 kliknięcia** i **zero wpisywania adresu URL**;
  - biblioteka startowa liczy **co najmniej 400 źródeł** z Polski i ze świata;
  - stan wszystkich obserwatorów widać **bez przewijania i bez klikania** — spełnione stoją na górze,
    a liczniki stanów są w nagłówku sekcji;
  - z przypiętego paska tematów widać **co najmniej dwa sąsiednie tematy** i przechodzi się do nich
    jednym dotknięciem.

## 3. Historyjki użytkownika

- Jako użytkownik chcę, żeby odświeżanie wiadomości **działało**, żeby moduł miał z czego budować
  tematy, linię czasu i gorące tematy.
- Jako użytkownik chcę **wybrać źródła z gotowej biblioteki** (szukając po nazwie, kraju, języku i
  kategorii), żeby nie szukać adresów kanałów RSS po portalach.
- Jako użytkownik chcę **nadal móc dodać własne źródło ręcznie**, żeby biblioteka mnie nie ograniczała,
  gdy czytam coś niszowego.
- Jako administrator chcę **zarządzać biblioteką źródeł z panelu** (dodać, poprawić adres, wyłączyć
  martwe, sprawdzić czy kanał odpowiada, wgrać/pobrać całość jako plik), żeby poprawka adresu nie
  wymagała wdrożenia nowej wersji aplikacji.
- Jako użytkownik chcę **zobaczyć obserwatory pogody uporządkowane po stanie** (i opcjonalnie
  zgrupowane albo przefiltrowane), żeby jednym spojrzeniem wiedzieć, które warunki dziś zachodzą.
- Jako użytkownik chcę **przewijać tematy wiadomości w poziomie w przypiętym pasku**, żeby widzieć,
  że mam inne tematy, i przeskakiwać między nimi jednym dotknięciem.

## 4. Kryteria akceptacji (testowalne)

**Odświeżanie wiadomości**

- [ ] **AC-1** — Given użytkownik z co najmniej jednym włączonym źródłem, when uruchomi odświeżanie
      modułu Wiadomości, then przebieg kończy się powodzeniem, a pobrane artykuły trafiają do puli
      (przebieg nie kończy się błędem zapisu do bazy).
- [ ] **AC-2** — Given przebieg odświeżania zakończył się kiedyś błędem, when użytkownik wejdzie na
      widok Wiadomości po udanym przebiegu, then komunikat o nieudanym odświeżaniu znika.
- [ ] **AC-3** — Given kod aplikacji, when uruchomimy bramki jakości pilnujące skasowanych kolumn
      własnościowych, then bramka **wyłapuje** ten rodzaj błędu (zapis do puli artykułów), a nie
      tylko warunki wyszukiwania — czyli ta sama pomyłka nie przejdzie ponownie na produkcję.

**Biblioteka źródeł — użytkownik**

- [ ] **AC-4** — Given użytkownik na widoku źródeł wiadomości, when otworzy przeglądarkę biblioteki,
      then widzi listę gotowych źródeł z możliwością wyszukania po nazwie oraz zawężenia po kraju,
      języku i kategorii.
- [ ] **AC-5** — Given użytkownik znalazł źródło w bibliotece, when je doda, then pojawia się na jego
      liście źródeł z gotową nazwą, adresem kanału, stroną i opisem — **bez wpisywania czegokolwiek**.
- [ ] **AC-6** — Given użytkownik ma już dane źródło dodane, when otworzy bibliotekę, then to źródło
      jest oznaczone jako już dodane i nie da się go dodać drugi raz.
- [ ] **AC-7** — Given użytkownik chce czytać kanał spoza biblioteki, when użyje ręcznego dodawania,
      then może podać własną nazwę, adres kanału, stronę i opis — droga ręczna działa jak dotąd.
- [ ] **AC-8** — Given nowy użytkownik wchodzi do modułu pierwszy raz, when moduł zaseeduje mu źródła
      startowe, then dostaje ten sam zestaw startowy co dotąd (zmiana nie podmienia nikomu źródeł).

**Biblioteka źródeł — administrator**

- [ ] **AC-9** — Given administrator w panelu, when otworzy zarządzanie biblioteką źródeł, then widzi
      pełny katalog z wyszukiwarką i filtrami oraz może **dodać, edytować, włączyć i wyłączyć** wpis.
- [ ] **AC-10** — Given administrator wyłączył wpis w katalogu, when użytkownik otworzy przeglądarkę
      biblioteki, then wyłączony wpis nie jest proponowany; źródła już dodane przez użytkowników
      działają dalej bez zmian.
- [ ] **AC-11** — Given administrator podejrzewa martwy kanał, when uruchomi sprawdzenie wpisu, then
      dostaje odpowiedź, czy kanał odpowiada i ile pozycji zwrócił, a wynik zapisuje się przy wpisie.
- [ ] **AC-12** — Given administrator chce przenieść lub zarchiwizować katalog, when użyje eksportu i
      importu pliku, then eksport zawiera cały katalog, a import go uzupełnia bez duplikowania
      istniejących wpisów.
- [ ] **AC-13** — Given katalog po wdrożeniu, when policzymy wpisy, then jest ich **co najmniej 400**,
      z pokryciem polskim (wiadomości, biznes, sport, technologia, nauka, kultura, regiony) i
      światowym (co najmniej kilkanaście krajów i kilka języków).
- [ ] **AC-14** — Given zmiana w katalogu wykonana przez administratora, when zajrzymy do dziennika
      audytu, then zmiana jest w nim odnotowana.
- [ ] **AC-15** — Given użytkownik bez uprawnienia administratora, when spróbuje wejść na adres
      zarządzania katalogiem, then dostaje odmowę dostępu.

**Obserwatory pogody**

- [ ] **AC-16** — Given użytkownik ma kilka obserwatorów i ocena stanu została policzona, when patrzy
      na sekcję, then obserwatory są ułożone wg stanu: spełnione → częściowo → niespełnione → brak
      danych, a wyłączone na końcu.
- [ ] **AC-17** — Given ta sama sytuacja, when patrzy na nagłówek sekcji, then widzi liczniki „ile w
      którym stanie" i może jednym dotknięciem zawęzić listę do wybranego stanu.
- [ ] **AC-18** — Given użytkownik woli czytać obserwatory sekcjami, when przełączy widok na
      grupowanie, then obserwatory są rozdzielone na sekcje po stanie, z nagłówkiem i liczbą w każdej.
- [ ] **AC-19** — Given użytkownik ustawił sposób układania listy i filtr, when wróci na widok Pogody
      później (także na innym urządzeniu), then jego wybór jest zapamiętany.
- [ ] **AC-20** — Given ocena stanu nie została jeszcze policzona (sekcja czeka na kliknięcie), when
      użytkownik patrzy na listę, then widzi ją w kolejności jak dotąd, bez fałszywych stanów, a
      sterowanie układem nie sugeruje nieistniejącej oceny.
- [ ] **AC-21** — Given kolorowy znacznik stanu, when użytkownik go czyta, then znaczenie stanu jest
      dostępne także tekstem (nie tylko kolorem) — zieleń nadal nie znaczy „ładna pogoda".

**Nawigacja po tematach wiadomości**

- [ ] **AC-22** — Given użytkownik ma więcej niż jeden temat, when patrzy na przypięty pasek tematów,
      then widzi poziomy pasek z nazwami tematów, przewijany w bok, z wyraźnie oznaczonym aktywnym.
- [ ] **AC-23** — Given użytkownik zmieni temat (dotknięciem chipa, strzałką albo gestem), when temat
      się zmieni, then aktywny temat sam wjeżdża w widoczny obszar paska.
- [ ] **AC-24** — Given użytkownik szuka tematu po nazwie lub po filtrze semantycznym, when otworzy
      dotychczasową rozwijaną listę, then wyszukiwarka i pełne nazwy działają jak dotąd — pasek jest
      skrótem, nie jedyną drogą.
- [ ] **AC-25** — Given telefon i desktop, when użytkownik korzysta z paska, then działa ten sam
      mechanizm (bez osobnego wariantu mobilnego), cele dotyku spełniają minimum, a `Esc` zamyka listę.

## 5. Zakres

**W zakresie:**

- Naprawa zapisu artykułów w przebiegu odświeżania Wiadomości + poszerzenie bramki jakości tak, żeby
  ten rodzaj pomyłki wychwytywała.
- Systemowa **biblioteka źródeł RSS** (≥ 400 wpisów, Polska + świat, z krajem, językiem, kategorią i
  opisem), zaseedowana wraz z wdrożeniem.
- **Przeglądarka biblioteki dla użytkownika** w module Wiadomości (szukanie, filtry, dodanie jednym
  ruchem, oznaczenie już dodanych) — obok zachowanej drogi ręcznej.
- **Panel administratora** do zarządzania biblioteką: lista z wyszukiwarką i filtrami, dodanie,
  edycja, włączenie/wyłączenie, sprawdzenie kanału, import/eksport pliku, wpisy w dzienniku audytu.
- **Obserwatory pogody**: domyślne sortowanie po stanie, liczniki stanów, filtr stanu i przełącznik
  grupowania; wybór zapamiętany per użytkownik.
- **Poziomy pasek tematów** w przypiętym nagłówku Wiadomości z automatycznym dosuwaniem aktywnego,
  przy zachowaniu rozwijanej listy z wyszukiwarką i strzałek.
- Wpis do dziennika lekcji (`doświadczenia.md`) o przyczynie błędu odświeżania i o luce w bramce.

**Poza zakresem (świadomie):**

- Automatyczne, cykliczne sprawdzanie żywotności wszystkich kanałów w tle — sprawdzenie jest **na
  żądanie administratora** (wpis po wpisie lub dla widocznej listy). Harmonogram to osobna decyzja
  o koszcie ruchu sieciowego.
- Propozycje źródeł zgłaszane przez użytkowników do katalogu (moderacja) — biblioteką zarządza
  wyłącznie administrator.
- Automatyczne wykrywanie adresu kanału ze strony portalu podanej przez użytkownika.
- Zmiany w klasyfikacji artykułów do tematów, w streszczeniach, linii czasu i gorących tematach —
  poza tym, że zaczną dostawać dane, bo odświeżanie znów działa.
- Zmiana istniejących zestawów startowych źródeł u obecnych użytkowników.
- Powiadomienia o spełnieniu obserwatora pogody i wpięcie obserwatorów w kalendarz.
- Nowe akcje asystenta AI dla katalogu źródeł i dla układu obserwatorów.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego slugu modułowego. Część użytkownika działa pod istniejącym
  `module.news` i `module.weather`; zarządzanie biblioteką pod istniejącym `module.admin` (C-22).
  Nowy adres administracyjny musi być bramkowany tak jak reszta panelu.
- **Własność danych:** biblioteka źródeł jest **systemowa** — nie należy do żadnej przestrzeni ani
  użytkownika; to katalog do podglądu dla wszystkich zalogowanych, edytowalny tylko przez
  administratora. Źródła **użytkownika** pozostają tam, gdzie są dziś (w jego przestrzeni) i nic w
  ich własności się nie zmienia; dodanie z biblioteki tworzy zwykłe źródło użytkownika, kopiując
  dane wpisu. Preferencja układu obserwatorów pogody jest **per użytkownik** (C-21).
- **Asystent AI:** nie dotyczy — żadnej nowej akcji ani narzędzia odczytu (C-23). Sekcja oceny
  obserwatorów nadal korzysta z istniejącej pamięci treści AI i jej trybów odświeżania; zmiana
  dotyczy wyłącznie **układu** listy, nie generowania.
- **Kalendarz / powiadomienia / trash:** bez wpięcia. Usunięcie wpisu z biblioteki przez
  administratora to operacja na katalogu systemowym, nie na danych użytkownika — zamiast kasowania
  domyślną drogą jest **wyłączenie** wpisu (odwracalne), więc kosz nie jest potrzebny (C-24).

## 7. Zgodność z konstytucją

- **C-01 / C-03** — cały kod w `worldofmag/`, artefakty w `specs/082-…/`.
- **C-10 / C-11 / C-14** — katalog źródeł to nowe dane w bazie: wymaga **ręcznie napisanego** pliku
  migracji z kolejnym wolnym numerem, a seed 400+ wpisów musi być **idempotentny** (ponowne
  uruchomienie nic nie duplikuje ani nie nadpisuje poprawek administratora).
- **C-12** — kraj/język/kategoria/status wpisu jako kolumny tekstowe + zawężający typ TypeScript,
  **nigdy** enum Prismy.
- **C-13** — weryfikujemy lokalnie do kroku budowania aplikacji; żadnego uruchamiania migracji
  przeciw produkcyjnej bazie.
- **C-20** — wszystkie zmiany danych przez Server Actions z odświeżeniem ścieżki.
- **C-21** — poprawka błędu z zadania 1 polega właśnie na tym, że własność nie jest już wyrażana
  skasowaną kolumną; nowe zapisy nie mogą jej przywrócić „bocznymi drzwiami".
- **C-22 / C-25** — adres administracyjny bramkowany uprawnieniem administratora; zmiany katalogu
  odnotowane w dzienniku audytu.
- **C-30 / C-31 / C-32 / C-33 / C-34** — kolory wyłącznie ze zmiennych CSS; jeden mechanizm dla
  telefonu i desktopu; teksty po polsku przez warstwę tłumaczeń; widoki przez wspólny kontrakt widoku
  ze stanami brzegowymi; potwierdzenia przez wspólne okno dialogowe.
- **C-36** — Wiadomości i Pogoda pozostają odrębnymi modułami; katalog źródeł jest danymi modułu
  Wiadomości, a panel administratora sięga po nie **przez kontrakt modułu**, nie po jego wnętrze.
- **C-50 / C-51 / C-52** — „gotowe" = zielony build; lekcja z błędu odświeżania dopisana do dziennika
  doświadczeń razem z poprawką; merge do `develop`, a na końcu promocja na `master`.
- **C-53** — minimalizm: jeden katalog, jedna przeglądarka, jeden panel; obserwatory dostają układ i
  filtr, a nie nowy podmoduł.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie pytania zadane w jednym momencie (`/specify`, C-55). Odpowiedzi właściciela:

- [x] **Gdzie żyje biblioteka źródeł i kto nią zarządza** → **tabela w bazie + panel administratora**.
      Wpisy zaseedowane migracją, pełne zarządzanie z panelu (dodaj/edytuj/wyłącz/import-eksport), a
      dla użytkownika przeglądarka z wyszukiwarką i filtrami obok zachowanej drogi ręcznej. Powód
      wskazany przez właściciela: poprawka adresu kanału nie może wymagać wdrożenia nowej wersji.
- [x] **Skala katalogu** → **400+ wpisów, maksymalnie szeroko**. Właściciel wybrał ten wariant mimo
      wskazanego ryzyka martwych kanałów; dlatego katalog dostaje **status wpisu i sprawdzenie kanału
      na żądanie administratora**, a wpisy potwierdzone jako martwe da się wyłączyć jednym ruchem
      (patrz „Ryzyka”).
- [x] **Obserwatory pogody** → **domyślne sortowanie po stanie + liczniki + filtr + przełącznik
      grupowania**, wybór zapamiętany per użytkownik.
- [x] **Nawigacja po tematach** → **poziomy pasek chipów z automatycznym dosuwaniem aktywnego**, przy
      **zachowanej** rozwijanej liście z wyszukiwarką i strzałkach.

Założenia przyjęte samodzielnie (rozsądny domyślny, C-55), odnotowane tutaj zamiast pytania:

- Zestaw startowy źródeł dla nowego użytkownika **nie zmienia się** — biblioteka jest drogą dodania,
  nie podmianą tego, co użytkownik już ma.
- Wpis katalogu usuwa się przez **wyłączenie** (odwracalne), a nie przez trwałe skasowanie.
- Sprawdzanie kanałów jest **na żądanie**, nie w tle (koszt ruchu sieciowego, poza zakresem).
- Katalog nie ma własnych akcji asystenta AI ani wpięcia w kalendarz i powiadomienia.

## 9. Ryzyka

- **Martwe kanały w katalogu 400+** → wpis niesie status i wynik ostatniego sprawdzenia; administrator
  sprawdza wpis (lub widoczną listę) jednym ruchem i wyłącza to, co nie odpowiada. Dodatkowo
  odświeżanie u użytkownika **już dziś** znosi milczącą awarię pojedynczego kanału (znacznik postępu
  liczony per źródło), więc jedno martwe źródło nie psuje przebiegu innym.
- **Duża migracja z setkami wpisów** → seed musi być idempotentny i nie może nadpisywać poprawek
  administratora przy ponownym uruchomieniu; wpisy identyfikowane stabilnym kluczem.
- **Powrót do odrzuconego układu tematów** → poziomy pasek już raz przegrał (ucinał nazwy przy wielu
  tematach). Dlatego **nie zastępuje** rozwijanej listy z wyszukiwarką, tylko stoi obok niej jako
  skrót; kryterium AC-24 pilnuje, żeby stara droga nie zniknęła.
- **Fałszywy stan obserwatora przed oceną** → dopóki ocena nie została policzona, lista nie może
  udawać, że zna stany (AC-20); układ „po stanie" włącza się dopiero z oceną.
- **Regresja bramki jakości** → poszerzenie bramki o zapisy (nie tylko warunki wyszukiwania) może
  wskazać istniejące miejsca w kodzie; każde trzeba obejrzeć osobno, a nie uciszać wyjątkiem.
