# Spec: Profesjonalny system przewodników użytkownika (pierwszy: Notatki)

- **ID:** 108-system-przewodnikow
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-27
- **Moduł(y):** nowy dział „Przewodniki" (rozbudowa `/guide`) + Notatki (pierwszy przewodnik) + rama widoku modułu (wspólne wejście dla wszystkich 21 modułów)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Omnia urosła do ~21 modułów, a użytkownik nie ma **żadnego** miejsca, w którym mógłby przeczytać,
co dany moduł potrafi. Dzisiejsze `/guide` to jedna strona z przykładami komend asystenta — pomoc
do jednej funkcji, nie do aplikacji. Skutek jest mierzalny w samym module Notatek: wikilinki
`[[Tytuł]]`, historia wersji, załączniki, grupy, tagi, wyszukiwarka ważona i wpięcie w asystenta
istnieją, ale użytkownik trafia najwyżej na „napisz notatkę" — reszta możliwości jest niewidoczna,
bo nic o niej nie mówi. Potrzebny jest **system** przewodników (bo modułów będzie dwadzieścia
kilka), a nie jedna strona pomocy.

## 2. Cel i miary sukcesu

- **Cel:** powstaje dział „Przewodniki" — jedno miejsce ze wszystkimi przewodnikami użytkownika —
  oraz pierwszy pełny przewodnik (Notatki), do którego można wejść **zarówno** z działu, **jak i**
  bezpośrednio z modułu, którego dotyczy.
- **Sukces mierzymy:**
  - z dowolnego widoku Notatek przewodnik jest oddalony o **jedno kliknięcie** (ikona pomocy stoi
    w tym samym miejscu, w którym stanie dla każdego kolejnego modułu),
  - przewodnik Notatek opisuje **wszystkie** funkcje modułu obecne w aplikacji — w tym te
    niewidoczne z listy notatek (wikilinki, wersje, załączniki, wyszukiwanie, udostępnianie,
    asystent, kosz) — plus zachowania brzegowe i pomysły na zastosowania,
  - dodanie przewodnika dla **kolejnego** modułu to dopisanie treści i jednego wpisu w katalogu
    przewodników — **bez** dotykania widoków tamtego modułu.

## 3. Historyjki użytkownika

- Jako użytkownik Notatek chcę z poziomu modułu otworzyć przewodnik po **tym** module, żeby nie
  szukać pomocy po całej aplikacji.
- Jako użytkownik chcę mieć jedno miejsce ze wszystkimi przewodnikami, żeby móc się rozejrzeć, co
  Omnia w ogóle potrafi, i zobaczyć, dla których modułów przewodnik jeszcze nie powstał.
- Jako użytkownik chcę w przewodniku spisu treści i skakania po rozdziałach, żeby wracać do
  konkretnej rzeczy, a nie czytać wszystkiego od nowa.
- Jako użytkownik chcę szukać w przewodnikach po słowie („wikilink", „załącznik"), żeby znaleźć
  odpowiedź szybciej niż przez spis treści.
- Jako użytkownik chcę czytać przewodnik na telefonie tak samo wygodnie jak na komputerze.
- Jako użytkownik chcę, żeby przewodnik nie kończył się na wyliczeniu funkcji — chcę **pomysłów**:
  od prostego „zapamiętaj to" po nieoczywiste zastosowania, na które sam bym nie wpadł.
- Jako właściciel produktu chcę, żeby ten przewodnik był **wzorcem** dla dwudziestu kolejnych.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given zalogowany użytkownik jest w dowolnym widoku modułu Notatki, when kliknie
      ikonę pomocy w pasku widoku, then otwiera się przewodnik po Notatkach (a nie ogólna pomoc ani
      strona główna działu).
- [ ] **AC-2** — Given moduł **nie ma** jeszcze przewodnika, when użytkownik ogląda jego pasek
      widoku, then ikony pomocy tam **nie ma** (nie prowadzi do pustej strony).
- [ ] **AC-3** — Given zalogowany użytkownik, when otworzy dział „Przewodniki", then widzi listę
      wszystkich modułów Omnii z wyraźnym rozróżnieniem „przewodnik gotowy" / „wkrótce", a wejście
      w gotowy otwiera jego treść.
- [ ] **AC-4** — Given użytkownik jest w dziale Ustawienia, when szuka pomocy, then znajduje tam
      odnośnik prowadzący do działu „Przewodniki".
- [ ] **AC-5** — Given otwarty przewodnik Notatek, when użytkownik korzysta ze spisu treści, then
      przechodzi do wybranego rozdziału, a spis wskazuje rozdział, w którym aktualnie jest.
- [ ] **AC-6** — Given otwarty dział przewodników, when użytkownik wpisze frazę występującą w
      treści (np. „wikilink"), then dostaje wyniki wskazujące rozdział, w którym ta fraza występuje.
- [ ] **AC-7** — Given przewodnik Notatek, when użytkownik go przeczyta, then znajdzie w nim opis
      **każdej** funkcji modułu dostępnej w aplikacji: tworzenie i edycja z podglądem markdown,
      grupy, tagi, wikilinki `[[Tytuł]]` wraz z odnośnikami zwrotnymi, wyszukiwanie pełnotekstowe,
      załączniki, historia wersji, udostępnianie notatki innej osobie, obsługa przez asystenta AI,
      usuwanie do kosza i odzyskiwanie, skróty klawiszowe.
- [ ] **AC-8** — Given przewodnik Notatek, when użytkownik szuka zachowań brzegowych, then znajduje
      wyjaśnione co najmniej: co się dzieje z wikilinkiem do nieistniejącej notatki, jak działa
      wikilink po zmianie tytułu notatki, co widzi osoba, której notatkę udostępniono, co dzieje się
      z notatką po usunięciu i po upływie retencji kosza, czym różni się tag od grupy.
- [ ] **AC-9** — Given przewodnik Notatek, when użytkownik dojdzie do części o zastosowaniach, then
      znajduje co najmniej 10 konkretnych pomysłów — od prostych (notatka na zakupy, zapisanie
      hasła do wifi) po nieoczywiste, wykorzystujące wikilinki i integracje z innymi modułami.
- [ ] **AC-10** — Given przewodnik, when użytkownik czyta go na ekranie szerokości 360 px, then
      treść jest czytelna bez przewijania w poziomie, a spis treści jest dostępny (nie znika bez
      zastąpienia).
- [ ] **AC-11** — Given przewodnik zawiera odnośniki do miejsc w aplikacji (np. do listy notatek),
      when użytkownik w nie kliknie, then trafia w to miejsce bez przeładowania całej aplikacji.
- [ ] **AC-12** — Given użytkownik **nie ma** uprawnienia do modułu Notatki, when otworzy dział
      przewodników, then przewodnik po Notatkach nie jest mu podsuwany jako dostępny do użycia
      (spójnie z tym, jak aplikacja traktuje moduły bez uprawnienia).
- [ ] **AC-13** — Given aplikacja jest zbudowana, when uruchomimy jej bramki jakości, then
      przechodzą (w tym kontrakt widoku i próg tekstów interfejsu).

## 5. Zakres

**W zakresie:**
- Dział „Przewodniki" jako **rozbudowa istniejącego `/guide`** (nie drugi adres z pomocą): strona
  główna działu z kafelkami modułów oraz czytnik pojedynczego przewodnika.
- Treść dzisiejszego `/guide` (przykłady komend asystenta) **nie ginie** — staje się jednym
  z przewodników w dziale.
- Wejścia do działu: z Ustawień (prośba właściciela) oraz zachowanie istniejących odnośników ze
  Strony głównej.
- Wejście z modułu: **wspólny slot pomocy w pasku widoku modułu** — jedno miejsce dla wszystkich
  modułów, wpięte na razie tylko w Notatkach.
- Pełna treść przewodnika po Notatkach: możliwości, integracje z resztą aplikacji, zachowania
  brzegowe, pomysły na zastosowania.
- Czytelnik: spis treści, nawigacja po rozdziałach, wyszukiwanie w treści, poprawne czytanie na
  telefonie.

**Poza zakresem (świadomie):**
- Przewodniki dla pozostałych 20 modułów — dział pokazuje je jako „wkrótce". Powód: płytkie
  zalążki ustawiłyby niski standard dla wzorca, który ma obowiązywać przez dwadzieścia kolejnych.
- Edycja przewodników z panelu administratora (treść żyje w repozytorium, wersjonowana z kodem).
- Śledzenie postępu czytania, „przeczytane", oznaczenia nowości w przewodnikach.
- Wersje językowe inne niż polska.
- Samouczki prowadzone w interfejsie (podpowiedzi krok po kroku nad prawdziwym widokiem).
- Generowanie przewodników przez AI.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** **bez nowego sluga**. Dział przewodników jest — jak `/trash` i `/reports`
  — dostępny dla każdego zalogowanego; treść to dokumentacja, nie dane. Przewodnik modułu, do
  którego użytkownik nie ma uprawnienia, jest oznaczony jako niedostępny (AC-12).
- **Własność danych:** **nie dotyczy** — feature nie tworzy żadnych danych użytkownika, więc nie ma
  ani właściciela, ani przestrzeni. Brak migracji.
- **Asystent AI:** **nie dotyczy** — żadnej nowej akcji ani narzędzia odczytu. (Sam asystent
  zyskuje tylko tyle, że jego dotychczasowa strona pomocy staje się jednym z przewodników.)
- **Kalendarz / powiadomienia / trash:** nie dotyczy — nie ma zdarzeń, terminów ani rzeczy do
  usuwania.

## 7. Zgodność z konstytucją

- **C-33 (kontrakt widoku)** — kluczowa. Wejście z modułu ma być **poszerzeniem ramy**, a nie
  wyjątkiem w Notatkach; inaczej po dwudziestu modułach powstałoby dwadzieścia miejsc na pomoc —
  dokładnie ten problem, który rozwiązał slot ustawień (087). Każdy nowy widok idzie przez
  `ModuleView` ze stanem brzegowym.
- **C-32 (teksty przez `t()`, polski jako źródło)** — interfejs działu (etykiety, przyciski,
  komunikaty) idzie przez tłumaczenia. **Treść przewodnika to nie interfejs** — to dokument, więc
  żyje jako treść, nie jako klucze tłumaczeń; ta granica musi być w planie nazwana wprost.
- **C-30 (motyw przez zmienne CSS)** — czytnik ma być skinowalny; zero hexów, tekst na akcentach
  przez `--on-accent`. Przewodnik jest długim tekstem, więc kontrast i typografia liczą się
  bardziej niż gdziekolwiek indziej.
- **C-31 (mobile-first, keyboard-first)** — spis treści musi mieć wariant na telefon, cele dotyku
  ≥44 px, `Esc` zamyka nakładki.
- **C-36 (granice modułów)** — treść przewodnika o Notatkach opisuje moduł, ale **czytnik należy do
  wspólnego działu**; dział nie może importować wnętrza Notatek, a Notatki nie mogą importować
  wnętrza działu. Slot pomocy dostaje to, czego potrzebuje, **parametrem** z deklaracji widoku.
- **C-53 (minimalizm)** — rozbudowa istniejącego `/guide` zamiast drugiego adresu z pomocą; żadnych
  nowych zależności, żadnej bazy danych, żadnej migracji.
- **C-50 / C-13** — „gotowe" = zielony `build` do kroku `next build`; nie ruszamy produkcyjnej bazy.
- **C-51** — potknięcia po drodze lądują w `doświadczenia.md`.
- **C-54 / C-55** — pytania właściciela zebrane w jednym momencie (poniżej); dalsze etapy jadą
  autonomicznie i trzymają spójność artefaktów.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jednym wywołaniu na starcie pipeline'u (C-55). **Wszystkie rozstrzygnięte:**

- [x] **Adres działu** — właściciel poprosił, żeby (a) w module był odnośnik do rozdziału przewodnika
      o **tym** module, (b) całość dokumentacji była dostępna dla użytkownika z **Ustawień**, i wprost
      zostawił wybór miejsca do decyzji wykonawcy. **Decyzja:** dział mieszka pod istniejącym
      `/guide`, a Ustawienia dostają do niego odnośnik. Uzasadnienie: `/guide` **już** jest adresem
      pomocy w tej aplikacji (linkuje do niego Strona główna) i już ma wpis w kontrakcie widoku;
      drugi adres z pomocą oznaczałby dwa miejsca, które użytkownik musi rozróżniać — a stara strona
      i tak wymagałaby przeniesienia. Ustawienia zostają **wejściem**, nie miejscem zamieszkania:
      przewodnik to lektura, a nie konfiguracja konta, i schowanie go w Ustawieniach ukryłoby go
      przed kimś, kto nigdy tam nie zagląda.
- [x] **Nośnik treści** — markdown w repozytorium + dedykowany czytnik (wersjonowanie w gicie,
      recenzja w diffie, zero migracji).
- [x] **Wejście z modułu** — ikona pomocy w pasku widoku modułu, jako wspólny slot ramy.
- [x] **Zakres wydania** — dział gotowy na przyszłość (wszystkie moduły widoczne, bez przewodnika
      oznaczone „wkrótce") + jeden pełny przewodnik: Notatki.

Założenia przyjęte samodzielnie (nie wymagały pytania):
- Brak nowego uprawnienia `module.*` — patrz sekcja 6.
- Dotychczasowa treść `/guide` zostaje zachowana jako przewodnik po asystencie, a nie skasowana.
- Przewodnik jest po polsku (C-32: polski jest językiem źródłowym).

## 9. Ryzyka

- **Ryzyko: przewodnik rozjedzie się z aplikacją.** Funkcja się zmieni, treść zostanie.
  *Ograniczamy:* treść żyje w repozytorium obok kodu, więc zmiana funkcji i zmiana opisu mogą
  jechać jednym commitem; przewodnik nosi datę ostatniej aktualizacji, żeby rozjazd był widoczny.
- **Ryzyko: „ładne UX" rozjedzie się w osobny system stylów.** Długi tekst kusi do własnej
  typografii. *Ograniczamy:* czytnik korzysta ze zmiennych motywu i istniejącej ramy widoku —
  poszerzamy ją, gdy nie pasuje (C-33), zamiast robić wyjątek.
- **Ryzyko: slot pomocy zostanie wpięty tylko w Notatkach i tam umrze.** *Ograniczamy:* slot jest
  częścią wspólnej ramy, a nie kodu Notatek, i sam znika dla modułu bez przewodnika (AC-2) — więc
  kolejny moduł włącza się dopisaniem treści, bez ruszania widoku.
- **Ryzyko: treść zaleje próg tekstów interfejsu.** Przewodnik to tysiące słów. *Ograniczamy:*
  granica „interfejs vs dokument" nazwana w planie — tłumaczone są etykiety, nie treść dokumentu.
- **Ryzyko: dział pełen kafelków „wkrótce" wygląda na niedokończony.** *Ograniczamy:* stan
  „wkrótce" jest opisany jako zapowiedź, a nie jako pusta pozycja, i mówi wprost, że przewodniki
  powstają moduł po module.
