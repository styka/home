# Spec: Skrzynka odbiorcza i komunikator zespołowy

- **ID:** 107-skrzynka-i-komunikator
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-27
- **Moduł(y):** powłoka (chrom konta), Zaproszenia, Udostępnianie, **nowy moduł Czat**, Asystent AI

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Dziś w chromie Omnii stoi jedna ikona — dzwonek — i wpada do niej **wszystko jednym workiem**:
przypomnienia „masz coś zrobić" (termin zadania, przegląd auta, powtórka słówek). Rzeczy dotyczące
**relacji między ludźmi** są rozrzucone albo nie mają miejsca wcale:

- **zaproszenie do zespołu** widać wyłącznie jako bezimienna czerwona kropka na hamburgerze
  (telefon) — na komputerze nie widać go w chromie w ogóle; żeby je znaleźć, trzeba wiedzieć,
  że istnieje osobna strona z zaproszeniami,
- **zaproszenie do udostępnionego zasobu** (ktoś podzielił się listą, notatką, projektem) **nie ma
  dziś żadnej powierzchni** — nadanie po prostu pojawia się w danych, a zapraszany nie dostaje
  o nim żadnego sygnału,
- **rozmowy między użytkownikami nie istnieją** — Omnia ma współwłasność, zespoły i udostępnianie,
  ale nie ma jak zapytać domownika „kupiłeś to mleko?" inaczej niż poza aplikacją.

Do tego panel rozmów asystenta AI ma dwie wady zgłoszone wprost: przełącznik „Zapisane | Historia"
przewija się razem z listą (przy kilkunastu rozmowach znika z ekranu, czyli **stan wyboru przestaje
być widoczny dokładnie wtedy, gdy jest potrzebny**), a ikona nazywa się „historia sesji", choć
w środku wybiera się między *zapisanymi* a *historią* — nazwa podrzędna udaje nadrzędną.

Wspólny mianownik: **Omnia nie odróżnia „masz coś zrobić" od „ktoś czegoś od Ciebie chce"** i nie
daje ludziom kanału, żeby się dogadali. Teraz jest właściwy moment, bo współwłasność (przestrzenie),
udostępnianie zasobów i kanał czasu rzeczywistego są już zbudowane — komunikator nie wymaga nowej
infrastruktury, tylko nowego miejsca.

## 2. Cel i miary sukcesu

- **Cel:** jedna skrzynka na wszystko, co wymaga reakcji, wyraźnie rozdzielona na *sprawy do
  zrobienia* i *sprawy z ludźmi*, plus pełnoprawny komunikator do rozmów prywatnych i zespołowych.
- **Sukces mierzymy:**
  - użytkownik widzi, że ma zaproszenie (do zespołu albo do zasobu), **bez wchodzenia w menu** — na
    telefonie i na komputerze tak samo, z licznikiem,
  - przyjęcie lub odrzucenie zaproszenia zajmuje **maksymalnie 2 kliknięcia** od ikony w chromie,
  - napisanie wiadomości do domownika zajmuje **maksymalnie 3 kliknięcia** od dowolnego ekranu,
  - nowa wiadomość dociera do otwartej karty rozmówcy **bez odświeżania strony**,
  - w panelu rozmów asystenta przełącznik „Zapisane | Historia" jest widoczny **przy dowolnej
    długości listy**.

## 3. Historyjki użytkownika

**Skrzynka i zaproszenia**
- Jako użytkownik chcę mieć jedno miejsce na wszystkie sygnały wymagające reakcji, żeby nie musieć
  pamiętać, że zaproszenia mieszkają gdzie indziej niż przypomnienia.
- Jako użytkownik chcę odróżnić „przypomnienie o terminie" od „ktoś zaprasza mnie do zespołu",
  żeby nie przeglądać dziesięciu przypomnień w poszukiwaniu jednej sprawy z człowiekiem.
- Jako zapraszany chcę przyjąć albo odrzucić zaproszenie **z panelu**, bez przechodzenia na osobną
  stronę, żeby to była decyzja jednej chwili.
- Jako osoba, której ktoś udostępnił zasób, chcę dostać o tym sygnał i wejść w ten zasób jednym
  kliknięciem, żeby udostępnienie w ogóle było do czegoś.
- Jako właściciel chcę, żeby licznik przy ikonie mówił prawdę: liczy sprawy nieprzeczytane
  i oczekujące, a nie wszystko, co kiedykolwiek przyszło.

**Komunikator**
- Jako domownik chcę napisać prywatnie do innego użytkownika Omnii, żeby ustalić coś, co nie jest
  zadaniem ani notatką.
- Jako członek zespołu chcę pisać na kanale zespołu, żeby wszyscy widzieli ustalenia w jednym
  miejscu.
- Jako piszący chcę widzieć, że rozmówca **czyta i pisze** w tej chwili, żeby wiedzieć, czy czekać.
- Jako piszący chcę **poprawić albo usunąć** własną wiadomość, bo literówki się zdarzają.
- Jako uczestnik chcę **odpowiedzieć na konkretną wiadomość** i **zareagować emoji**, żeby
  w dłuższym wątku było wiadomo, do czego się odnoszę, i żeby „ok" nie musiało być osobną
  wiadomością.
- Jako użytkownik chcę widzieć licznik nieprzeczytanych rozmów w chromie i wejść w rozmowę jednym
  kliknięciem z każdego ekranu.
- Jako użytkownik telefonu chcę mieć rozmowę **na pełnym ekranie**, a nie w małym panelu.
- Jako użytkownik chcę, żeby wiadomość, której nie zdążyłem przeczytać, przypomniała się
  w skrzynce — ale żeby nie zasypywała mnie osobnym powiadomieniem od każdej linijki rozmowy.

**Asystent AI**
- Jako użytkownik chcę zawsze widzieć, którą listę rozmów asystenta oglądam, nawet przy długiej
  liście, żeby nie zgubić się w tym, co widzę.
- Jako użytkownik chcę, żeby nazwa ikony zgadzała się z tym, co jest w środku.

## 4. Kryteria akceptacji (testowalne)

**Skrzynka — rozdział rodzajów**
- [ ] **AC-1** — Given użytkownik ma zarówno przypomnienie o terminie, jak i oczekujące zaproszenie
  do zespołu, when otworzy panel dzwonka, then widzi **przełącznik segmentowy z dwoma listami**
  („Do zrobienia" i „Relacje"), każdy z własnym licznikiem, i obie listy są widoczne bez otwierania
  dodatkowego menu.
- [ ] **AC-2** — Given w panelu dzwonka, when użytkownik przełącza segment, then widoczna lista
  zmienia się, a zaznaczenie wybranego segmentu jest widoczne bez najeżdżania na cokolwiek.
- [ ] **AC-3** — Given segment ma licznik 0, when panel jest otwarty, then segment pozostaje
  **widoczny** (nie znika i nie zmienia szerokości paska), a jego pusta lista wyjaśnia, co się
  w niej pojawia.
- [ ] **AC-4** — Given przypomnienie i zaproszenie, when użytkownik patrzy na listę, then rodzaj
  pozycji jest rozpoznawalny bez czytania treści (znacznik rodzaju), a nie tylko po module.

**Zaproszenia w skrzynce**
- [ ] **AC-5** — Given oczekujące zaproszenie do zespołu, when użytkownik otworzy segment „Relacje",
  then widzi kto zaprasza i do czego, oraz **dwie akcje: przyjmij / odrzuć**, wykonalne bez opuszczania
  panelu.
- [ ] **AC-6** — Given użytkownik przyjmie zaproszenie w panelu, when akcja się powiedzie, then
  pozycja znika z listy, licznik maleje, a użytkownik od razu ma dostęp do zasobów tego zespołu
  (bez ręcznego odświeżania strony).
- [ ] **AC-7** — Given ktoś udostępnił użytkownikowi zasób, when zapraszany otworzy segment
  „Relacje", then widzi tę pozycję z nazwą zasobu i rolą, a kliknięcie prowadzi do tego zasobu.
  *(Poprawione na etapie weryfikacji, C-54: pierwotne brzmienie wymieniało obok nadania także
  „zaproszenie na adres e-mail, który należy do istniejącego konta". Taka pozycja **nigdy nie
  powstaje** — udostępnianie sprawdza konto PRZED zapisem i dla istniejącego tworzy od razu
  nadanie; zaproszenie e-mailowe dotyczy wyłącznie adresów BEZ konta, a takiego nie ma komu pokazać
  w skrzynce. Kryterium opisywało stan nieosiągalny, więc zawężamy je do tego, co realnie zachodzi,
  zamiast dokładać kod pod scenariusz, którego nie ma.)*
- [ ] **AC-8** — Given użytkownik nie ma żadnych oczekujących zaproszeń, when patrzy na ikonę
  w chromie, then nie widzi licznika ani kropki (sygnał nie kłamie o istnieniu spraw).
- [ ] **AC-9** — Given zaproszenie zostało przyjęte lub odrzucone na osobnej stronie zaproszeń,
  when użytkownik wróci do panelu, then panel pokazuje ten sam stan (jedno źródło prawdy, dwa widoki).

**Chrom: ikony i liczniki**
- [ ] **AC-10** — Given dowolny ekran na komputerze, when użytkownik patrzy na rząd chromu nad
  nawigacją, then widzi **dwie ikony komunikacyjne: dzwonek i czat**, każda z własnym licznikiem.
- [ ] **AC-11** — Given dowolny ekran na telefonie, when użytkownik patrzy na górny pasek, then widzi
  te same dwie ikony w tej samej kolejności co na komputerze, a obie respektują ustawienie
  dominującej ręki (lustrzenie chromu konta).
- [ ] **AC-12** — Given ikona czatu, when użytkownik ją kliknie, then otwiera się szybki podgląd
  rozmów (lista rozmów z nieprzeczytanymi na górze), a z niego można wejść w rozmowę na pełnym
  ekranie.
- [ ] **AC-13** — Given ikony chromu **na powierzchni dotykowej** (górny pasek telefonu), when
  mierzymy ich cel dotyku, then ma on co najmniej 44 × 44 px; obie ikony mają opis dla czytnika
  ekranu zawierający liczbę spraw.
  *(Poprawione na etapie implementacji, C-54: pierwotne brzmienie obejmowało też rząd chromu na
  komputerze. Reguła 44 px z C-31 dotyczy **dotyku**, a tam celuje mysz — podniesienie samej tej
  jednej ikony rozjechałoby rząd z czterema sąsiadkami, którego geometrię ustalono w 086. Zmiana
  zawęża wymóg tam, gdzie ma sens, zamiast zostawiać rozjazd „kod robi X, spec mówi Y".)*

**Komunikator — rozmowy**
- [ ] **AC-14** — Given użytkownik należy do zespołu, when wejdzie do modułu Czat, then widzi
  **kanał tego zespołu** na liście rozmów, bez ręcznego tworzenia.
- [ ] **AC-15** — Given użytkownik chce napisać do innej osoby, z którą dzieli zespół lub
  udostępniony zasób, when wybierze ją z listy rozmówców, then powstaje (albo otwiera się istniejąca)
  **rozmowa prywatna 1:1** — a lista możliwych rozmówców nie ujawnia użytkowników, z którymi nic go
  nie łączy.
- [ ] **AC-16** — Given otwarta rozmowa u dwóch osób, when jedna wyśle wiadomość, then druga widzi ją
  **bez odświeżania strony**, w ciągu kilku sekund.
- [ ] **AC-17** — Given nieprzeczytana wiadomość, when użytkownik patrzy na listę rozmów i na ikonę
  w chromie, then widzi licznik nieprzeczytanych; when otworzy rozmowę i ją przeczyta, then licznik
  maleje i **nie wraca** po zmianie ekranu.
- [ ] **AC-18** — Given rozmówca przeczytał wiadomość, when nadawca patrzy na swoją wiadomość, then
  widzi oznaczenie „przeczytano" (z informacją kto, gdy rozmowa ma więcej niż dwóch uczestników).
- [ ] **AC-19** — Given rozmówca pisze w tej chwili, when patrzę na otwartą rozmowę, then widzę
  wskaźnik pisania, który znika, gdy tamten przestaje pisać lub wyśle wiadomość.
- [ ] **AC-20** — Given własna wiadomość, when użytkownik ją edytuje, then treść się zmienia
  i wiadomość jest oznaczona jako edytowana; when ją usunie, then znika z rozmowy u wszystkich
  uczestników, a operacja jest odwracalna zgodnie z zasadą kosza obowiązującą w Omnii.
- [ ] **AC-21** — Given cudza wiadomość, when użytkownik próbuje ją edytować lub usunąć, then nie ma
  takiej możliwości (ani w interfejsie, ani przez bezpośrednie wywołanie).
- [ ] **AC-22** — Given wiadomość w rozmowie, when użytkownik na nią odpowie, then jego wiadomość
  pokazuje cytat/odwołanie do wiadomości źródłowej, a kliknięcie cytatu przewija do oryginału.
- [ ] **AC-23** — Given wiadomość w rozmowie, when użytkownik doda reakcję emoji, then reakcja jest
  widoczna dla wszystkich uczestników z licznikiem; when doda tę samą reakcję drugi raz, then
  reakcja zostaje cofnięta.
- [ ] **AC-24** — Given użytkownik nie jest uczestnikiem rozmowy, when spróbuje ją odczytać lub do
  niej napisać, then dostęp jest odmówiony po stronie serwera, niezależnie od interfejsu.
- [ ] **AC-25** — Given użytkownik opuścił zespół, when otworzy Czat, then nie widzi już treści
  kanału tego zespołu.
- [ ] **AC-26** — Given rozmowa z wieloma wiadomościami, when użytkownik ją otwiera, then widok
  ustawia się na pierwszej nieprzeczytanej (a przy jej braku — na końcu rozmowy), i doczytuje starsze
  wiadomości przy przewijaniu w górę.
- [ ] **AC-27** — Given nowa wiadomość, której użytkownik nie przeczytał przez dłuższą chwilę, when
  patrzy na skrzynkę, then widzi **jedną zbiorczą pozycję na rozmowę** („3 nowe wiadomości od …"),
  nigdy jednej pozycji na każdą wiadomość.
- [ ] **AC-28** — Given telefon, when użytkownik wejdzie w rozmowę, then rozmowa zajmuje pełny ekran,
  pole pisania nie zasłania ostatniej wiadomości, a pierwsze tapnięcie w przyciski pod polem nie
  chowa klawiatury.

**Asystent AI — panel rozmów**
- [ ] **AC-29** — Given panel rozmów asystenta z listą dłuższą niż ekran, when użytkownik przewija
  listę, then przełącznik „Zapisane | Historia" **pozostaje widoczny** przez cały czas.
- [ ] **AC-30** — Given nagłówek asystenta, when użytkownik patrzy na ikonę otwierającą ten panel,
  then jej nazwa i opis dla czytnika ekranu są **nadrzędne wobec obu list** (nie nazywają całości
  nazwą jednej z nich).

**Reguły przekrojowe**
- [ ] **AC-31** — Given cała funkcja, when sprawdzimy interfejs, then nie ma w nim zahardkodowanych
  kolorów ani tekstów zaszytych w komponentach (kolory z tokenów, teksty z warstwy tłumaczeń).
- [ ] **AC-32** — Given usunięcie konta użytkownika lub zespołu, when dane są czyszczone, then
  rozmowy, wiadomości i sygnały tego użytkownika/zespołu znikają razem z nim, bez osieroconych
  rekordów.
- [ ] **AC-33** — Given `npm run build` (bez ostatniego kroku ruszającego produkcyjną bazę), when go
  uruchomimy, then wszystkie bramki przechodzą.

## 5. Zakres

**W zakresie:**
- Rozdzielenie sygnałów na **rodzaje**: sprawy do zrobienia (przypomnienia) i sprawy z ludźmi
  (zaproszenia do zespołu, udostępnienia zasobu, zbiorcze sygnały z rozmów).
- Panel dzwonka jako **skrzynka z przełącznikiem segmentowym**, z akcjami przyjmij/odrzuć
  wykonywanymi na miejscu.
- Doprowadzenie **zaproszeń do zespołu** i **zaproszeń/nadań do zasobu** do skrzynki; strona
  zaproszeń zostaje jako pełny widok, ale przestaje być jedynym miejscem.
- **Nowy moduł Czat**: własne uprawnienie, trasa `/czat`, pozycja w nawigacji (sidebar, menu
  mobilne, wachlarz nawigacji), rozmowy 1:1 i kanały zespołów.
- Wiadomości tekstowe: wysyłanie, odbiór w czasie rzeczywistym, nieprzeczytane, „przeczytano",
  wskaźnik pisania, edycja i usunięcie własnej wiadomości, odpowiedź z cytatem, reakcje emoji.
- **Ikona czatu w chromie** (telefon i komputer) z licznikiem i szybkim podglądem rozmów.
- Zbiorcze sygnały o nieprzeczytanych wiadomościach w skrzynce (jedna pozycja na rozmowę).
- **Poprawka panelu rozmów asystenta**: przyklejony przełącznik + nadrzędna nazwa „Rozmowy".

**Poza zakresem (świadomie):**
- **Załączniki w rozmowie** (zdjęcia, pliki) — wymagają decyzji o miejscu składowania (Drive vs.
  baza) i limitach; osobny przebieg.
- **Grupy ad-hoc** niezwiązane z zespołem — zespół jest dziś jedyną trwałą grupą ludzi w Omnii,
  a druga równoległa forma grupy to drugi nośnik tej samej informacji.
- Połączenia głosowe/wideo, notatki głosowe, GIF-y, naklejki.
- Powiadomienia push poza aplikacją (systemowe/e-mail) dla wiadomości — dziś Omnia ma tylko
  powiadomienia lokalne przeglądarki; rozszerzenie ich na czat to osobna decyzja.
- Wyszukiwanie pełnotekstowe w historii rozmów.
- Przypinanie, archiwizowanie i wyciszanie rozmów.
- Tłumaczenie rozmów i wpięcie czatu w asystenta AI (asystent nie czyta ani nie pisze wiadomości).
- Zmiany w istniejących powiadomieniach modułowych (treść przypomnień, ich harmonogram) — dotykamy
  ich **klasyfikacji**, nie sposobu powstawania.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC (C-22):** nowy slug `module.*` dla Czatu, zaseedowany migracją SQL i wpięty
  w rejestr modułów, mapowanie ścieżek i nawigację (desktop + mobile). Skrzynka i zaproszenia
  zostają dostępne dla każdego zalogowanego (jak dziś dzwonek) — to chrom, nie moduł.
- **Własność danych (C-21 / przestrzenie):** rozmowa zespołowa należy do **przestrzeni zespołu**,
  rozmowa 1:1 ma wprost wymienionych uczestników. Sygnały skrzynki pozostają **per użytkownik**
  (tak jak dziś powiadomienia). Dostęp do rozmowy rozstrzygamy po stronie serwera przy każdej
  operacji — nigdy na podstawie tego, co przyszło od klienta.
- **Asystent AI (C-23):** **nie dotyczy** — świadomie nie dokładamy akcji ani narzędzi odczytu dla
  rozmów w tym przebiegu (prywatna korespondencja to nie jest dobre pierwsze miejsce na automat).
  Panel rozmów asystenta zmieniamy wyłącznie w warstwie interfejsu.
- **Kalendarz:** nie dotyczy.
- **Powiadomienia:** rdzeń zmiany — sygnały zyskują **rodzaj**, a skrzynka przestaje być jednym
  workiem. Wiadomości trafiają do niej **zbiorczo per rozmowa**.
- **Kosz (C-24):** usunięcie wiadomości idzie ścieżką miękkiego usuwania obowiązującą w Omnii;
  rozmowa zniknięta razem z zespołem/kontem znika kaskadą, nie zostaje sierotą.
- **Czas rzeczywisty:** korzystamy z **istniejącego** kanału zdarzeń i jego siatki bezpieczeństwa
  (awaryjne odpytywanie) — bez nowej zależności i bez nowego kanału transportowego.

## 7. Zgodność z konstytucją

- **C-36** — Czat jest **modułem** z jedną deklaracją (menu, uprawnienie, ścieżki, nawigacja boczna);
  nie dopisujemy go do żadnej równoległej listy. Chrom (dzwonek, ikona czatu) należy do powłoki
  i **nie importuje wnętrza modułu** — bierze dane z kontraktu. Platforma nie poznaje modułu Czat.
- **C-10 / C-11 / C-12 / C-14** — nowe tabele i nowy slug uprawnienia dowozimy **ręcznie napisanymi,
  idempotentnymi migracjami** z kolejnym wolnym numerem; rodzaje sygnałów i statusy to kolumny
  tekstowe z zawężającym typem TypeScript, **nigdy enumy Prisma**.
- **C-13** — weryfikujemy lokalnie do kroku budowania, nigdy przeciw produkcyjnej bazie.
- **C-20** — wszystkie mutacje jako Server Actions z unieważnieniem ścieżek.
- **C-21 / C-17** — dostęp do rozmowy i do zaproszenia rozstrzyga serwer; przy udostępnieniach
  korzystamy z istniejącej warstwy dostępu do zasobu, **nie budujemy własnych ról**.
- **C-30 / C-31 / C-32** — kolory wyłącznie z tokenów (skórki muszą działać), teksty przez warstwę
  tłumaczeń po polsku, cele dotyku ≥ 44 px, bezpieczny obszar na dole (rozmowa na telefonie
  z polem pisania nad kreską gestu), nigdy dwóch pasków bocznych na telefonie.
- **C-33** — widok Czatu deklaruje się przez wspólną ramę widoku ze stanami brzegowymi; gdy rama nie
  pasuje (dwupanelowa lista + rozmowa), **poszerzamy ramę istniejącym wariantem**, nie robimy
  wyjątku w module.
- **C-34** — potwierdzenia (np. usunięcie wiadomości, odrzucenie zaproszenia) przez wspólne okno
  dialogowe z jawną deklaracją destrukcyjności.
- **C-35** — jeżeli powstanie nowy wspólny komponent (np. skrzynka jako panel), dowozimy go
  **razem z pierwszym konsumentem**.
- **C-53** — minimalizm: czas rzeczywisty na istniejącym kanale, zaproszenia na istniejących
  tabelach, żadnej nowej zależności; wskaźnik pisania i „przeczytano" realizujemy najprostszym
  mechanizmem, jaki wystarcza.
- **C-51** — każdą nieoczywistą pułapkę napotkaną po drodze dopisujemy do dziennika doświadczeń.
- **C-52 / C-52a** — na końcu merge do gałęzi integracyjnej i automatyczna promocja na produkcję
  przewinięciem, ze znacznikiem wydania.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie pytania zadano w jednym momencie na etapie `/specify` (C-55). Odpowiedzi właściciela:

- [x] **Układ ikon w chromie** → **dzwonek + osobna ikona czatu**. Dzwonek jest jedną skrzynką na
  wszystko, co się „odhacza" (przypomnienia + relacje), rozdzieloną przełącznikiem segmentowym;
  rozmowy dostają własną ikonę, bo rozmowa to **miejsce, do którego się wraca**, a nie sygnał do
  zamknięcia.
- [x] **Zakres komunikatora** → **solidne MVP rozmów**: 1:1 + kanał zespołu, tekst, nieprzeczytane,
  czas rzeczywisty, „przeczytano", wskaźnik pisania, edycja/usunięcie własnej wiadomości, odpowiedź
  z cytatem, reakcje emoji. Bez załączników i grup ad-hoc.
- [x] **Forma komunikatora** → **pełny moduł** z własnym uprawnieniem i trasą, plus ikona w chromie
  z szybkim podglądem.
- [x] **Panel rozmów asystenta** → **nadrzędna nazwa „Rozmowy" + przyklejony przełącznik**.

Założenia przyjęte samodzielnie (nie wymagały pytania):
- **Nazwa trasy modułu**: „Wiadomości" jest zajęte przez moduł newsów, więc moduł nazywamy **Czat**
  z trasą `/czat` — nazwa musi być jednoznaczna w nawigacji, a dwa moduły o tej samej nazwie byłyby
  dokładnie tą niespójnością, którą to zgłoszenie każe usunąć.
- **Kto może z kim rozmawiać**: tylko osoby połączone zespołem albo udostępnionym zasobem. Otwarta
  lista wszystkich kont byłaby katalogiem użytkowników systemu — to zmiana o innym ciężarze niż czat.
- **Sygnały z rozmów w skrzynce są zbiorcze per rozmowa** — jedna pozycja aktualizowana w miejscu,
  nigdy jedna na wiadomość.
- **Środkowy przycisk paska kciuka (asystent) nie zmienia miejsca** — to jego jedyne miejsce na
  telefonie i nie oddajemy go czatowi.

## 9. Ryzyka

- **Ryzyko: przebieg jest szeroki (skrzynka + moduł + poprawka asystenta) i łatwo dowieźć trzy rzeczy
  po połowie.** Ograniczamy: kolejność prac idzie od najmniejszej samodzielnej całości (poprawka
  panelu asystenta), przez klasyfikację sygnałów i skrzynkę, po moduł Czat — każda z nich jest
  osobno użyteczna i osobno weryfikowalna.
- **Ryzyko: czas rzeczywisty przy wielu instancjach.** Istniejący kanał rozgłasza w obrębie jednego
  procesu; przy dwóch instancjach karta dostanie sygnał tylko ze swojej. Ograniczamy: opieramy się na
  tej samej siatce bezpieczeństwa co reszta aplikacji (awaryjne odpytywanie) i **nie obiecujemy
  w interfejsie natychmiastowości, której kanał nie gwarantuje** — brak sygnału ma kończyć się
  opóźnieniem, nigdy zgubioną wiadomością.
- **Ryzyko: powiadomienia z czatu zaleją skrzynkę.** Ograniczamy zbiorczą pozycją na rozmowę
  (AC-27) i tym, że wejście do rozmowy kasuje sygnał.
- **Ryzyko: wyciek treści cudzej rozmowy przez kanał czasu rzeczywistego.** Ograniczamy zasadą, która
  obowiązuje w Omnii już dziś: kanałem idzie **ubogi sygnał „coś się zmieniło"**, a treść klient
  zawsze pobiera z serwera, który sprawdza dostęp.
- **Ryzyko: rozdzielenie sygnałów na rodzaje zepsuje istniejące przypomnienia.** Ograniczamy tym, że
  rodzaj jest **dodatkiem** o bezpiecznej wartości domyślnej dla wszystkiego, co już jest w bazie —
  stare sygnały mają nadal trafiać na listę „Do zrobienia", a nie zniknąć.
- **Ryzyko: dwa miejsca na zaproszenia (panel i strona) rozjadą się.** Ograniczamy: jedno źródło
  prawdy i te same operacje w obu widokach (AC-9).
