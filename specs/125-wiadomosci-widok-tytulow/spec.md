# Spec: Wiadomości — widok samych tytułów do oznaczania „do doczytania"

- **ID:** 125-wiadomosci-widok-tytulow
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-04
- **Moduł(y):** Wiadomości (`/wiadomosci`, `module.news`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Feedback właściciela do 124: oznaczanie „do doczytania" na rozwiniętych kartach (tytuł + streszczenie
+ obrazek + akcje) **mija się z celem** — decyzja „czy tytuł mi wystarczy" ma zapadać, przeglądając
**same tytuły**, a nie pełne karty. Cytat: „to powinien być specjalny widok na który można się
przełączyć i tam same tytuły wiadomości i zaznaczanie które z nich będę chciał przeczytać. a potem
powinna być możliwość przejścia od razu do widoku tylko z tymi wiadomościami oznaczonymi". Co ważne,
sedno 124 się właścicielowi **podoba** i ma zostać nietknięte: zawężenie widoku do odłożonych oraz
lektor czytający tylko odfiltrowane pozycje. Twardy warunek: **nie przekombinować** — „to ma być UX
który ułatwia a nie komplikuje".

## 2. Cel i miary sukcesu

- Cel: użytkownik przełącza się jednym gestem na widok samych tytułów, tam jednym gestem na wiersz
  oznacza pozycje „doczytam", a stamtąd jednym gestem przechodzi do widoku wyłącznie oznaczonych —
  cały cykl „przejrzyj → wybierz → doczytaj" bez ani jednego zbędnego kroku.
- Sukces mierzymy:
  - triage 20 wiadomości (przejrzenie tytułów + oznaczenie kilku) wymaga wyłącznie: 1 gest wejścia
    w widok tytułów + 1 gest na każdą oznaczaną pozycję + 1 gest przejścia do odłożonych;
  - na jednym ekranie telefonu (360 px) widok tytułów mieści **kilkukrotnie więcej** pozycji niż
    widok pełnych kart;
  - zachowania z 124 działają bez zmian: zawężenie „do doczytania" na pełnym widoku, lektor po
    odfiltrowanych, odporność odłożonych na „oznacz wszystkie".

## 3. Historyjki użytkownika

- Jako czytelnik chcę przełączyć się na widok samych tytułów, żeby szybko przejrzeć całą porcję
  nowości bez przewijania przez streszczenia i obrazki.
- Jako czytelnik w widoku tytułów chcę oznaczać „doczytam" jednym gestem na wierszu, żeby decyzja
  „tytuł mi nie wystarczył" kosztowała jedno dotknięcie.
- Jako czytelnik chcę z widoku tytułów przejść jednym gestem wprost do widoku samych oznaczonych,
  żeby od razu zacząć doczytywanie (i móc włączyć na nich lektora — jak w 124).
- Jako czytelnik chcę widzieć w widoku tytułów, które pozycje już oznaczyłem, żeby nie oznaczać
  dwa razy i móc cofnąć pomyłkę tym samym gestem.
- Jako czytelnik chcę móc zapisać widok tytułów jako ulubiony, żeby zaczynać poranny przegląd
  prosto od niego.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given widok wiadomości, when użytkownik wykonuje jeden gest przełączenia w pasku
  modułu, then lista pokazuje **same tytuły** (kompaktowe wiersze: tytuł + minimalny kontekst
  źródło/czas), pogrupowane w te same tematy i obsługiwane przez ten sam nawigator tematów co widok
  pełny; wyjście to ten sam gest.
- [ ] **AC-2** — Given widok tytułów, when użytkownik dotyka/klika wiersz, then pozycja przełącza
  stan „doczytam" (w obie strony), stan jest widoczny na wierszu natychmiast i trwały (to ten sam
  znacznik co w 124 — pozycja oznaczona w tytułach jest oznaczona wszędzie).
- [ ] **AC-3** — Given widok tytułów, when użytkownik chce otworzyć artykuł u źródła, then ma na
  wierszu osobny, mniejszy cel dotyku do tego (otwarcie artykułu NIE przełącza oznaczenia).
- [ ] **AC-4** — Given widok tytułów z ≥1 oznaczoną pozycją, when użytkownik używa widocznego
  przejścia „do odłożonych", then jednym gestem ląduje na pełnym widoku zawężonym do oznaczonych
  (dokładnie ten widok z 124, z działającym lektorem po odfiltrowanych).
- [ ] **AC-5** — Given widok tytułów, when użytkownik oznacza/odznacza pozycje, then licznik
  odłożonych (w pasku i na przejściu „do odłożonych") aktualizuje się na bieżąco.
- [ ] **AC-6** — Given stan widoku tytułów, when użytkownik zapisuje widok jako ulubiony albo
  odświeża stronę, then widok tytułów daje się odtworzyć z adresu (jak `tresc`/`zrodla`/
  `czytanie`/`doczytania`).
- [ ] **AC-7** — Given telefon 360 px, when użytkownik korzysta z widoku tytułów, then każdy wiersz
  ma pełnoekranowy cel dotyku o wysokości zgodnej z normami modułu, pasek zachowuje stałą wysokość,
  a strona nie przewija się w bok.
- [ ] **AC-8** — Given zachowania z 124, when widok tytułów jest wyłączony, then nic się nie
  zmienia względem 124: karty pełne, przycisk „Doczytam" na karcie, zawężenie `do doczytania`,
  odporność na „oznacz wszystkie", lektor po odfiltrowanych.
- [ ] **AC-9** — Given widok tytułów i włączony filtr źródeł, then obowiązuje ten sam zbiór pozycji
  co w widoku pełnym (nawigator, liczniki sekcji i treść nie mogą się rozjechać).

## 5. Zakres

**W zakresie:**
- Przełączalny widok samych tytułów (triage) wewnątrz widoku wiadomości, ze stanem w adresie.
- Oznaczanie/odznaczanie „doczytam" jednym gestem na wierszu + osobny cel do otwarcia artykułu.
- Widoczne przejście „do odłożonych (N)" z widoku tytułów do zawężonego widoku pełnego z 124.
- Spójność z istniejącymi mechanizmami: filtr źródeł, nawigator tematów, licznik odłożonych.

**Poza zakresem (świadomie):**
- Jakiekolwiek zmiany w mechanice 124 (zawężenie, lektor po odfiltrowanych, akcje zbiorcze,
  naprawa tytułów w przebiegu) — właściciel je zaakceptował.
- Wzbogacanie samych tytułów (dłuższe/„konkretniejsze" tytuły) — osobny temat, poza tym przebiegiem.
- Akcje na wierszu tytułu inne niż oznaczenie i otwarcie artykułu (bez „Przeczytane", bez lektora
  per wiersz, bez streszczenia w dymku) — warunek „nie przekombinuj".
- Oznaczanie zbiorcze w widoku tytułów (zaznacz zakres itd.) — dopiero gdyby właściciel o nie poprosił.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** istniejące `module.news`; bez zmian.
- **Własność danych:** bez zmian — używamy znacznika „do doczytania" z 124 (osobisty, per pozycja);
  żadnych nowych danych.
- **Asystent AI:** nie dotyczy (żadnej nowej `AIAction`).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-36** — całość w module Wiadomości; zero nowych zależności międzymodułowych.
- **C-20/C-21** — bez nowych mutacji (przełączanie używa istniejącej akcji z 124 z jej guardem).
- **C-30/C-31/C-33** — zmienne CSS, cele dotyku (pełny wiersz), stała wysokość paska, stan
  w adresie widoku (ulubialność — wzorzec 084/087), stany brzegowe przez mechanizm widoku.
- **C-32** — nowe teksty przez `t()` / `messages/pl.json`.
- **C-53** — minimalizm wprost zamówiony przez właściciela: jeden przełącznik, jeden gest na wierszu,
  jedno przejście; bez nowych podstron, bez nowej nawigacji, bez schematu.
- **C-50/C-51/C-52** — build jako „gotowe", lekcje, merge `develop` + automatyczna promocja `master`.

## 8. Otwarte pytania / decyzje właściciela

Właściciel delegował UX („zrób jakiś dobry ux… tylko nie przekombinuj"); decyzje przyjęte
rekomendowanym domyślnym i odnotowane:

- **Gdzie żyje widok tytułów:** to TRYB istniejącego widoku wiadomości (przełącznik w pasku modułu,
  stan w adresie), nie osobna podstrona ani zakładka — najmniejsza możliwa nawigacja, a nawigator
  tematów i filtr źródeł działają bez dublowania.
- **Gest oznaczania:** dotknięcie CAŁEGO wiersza przełącza „doczytam" (największy możliwy cel
  dotyku przy przeglądzie kciukiem); otwarcie artykułu to osobna, mniejsza ikona na wierszu (AC-3),
  żeby przypadkowy klik nie wyrzucał z triage'u do przeglądarki.
- **Przejście „do odłożonych":** widoczny element z licznikiem w widoku tytułów (nie ukryty w menu);
  prowadzi do istniejącego zawężenia z 124 i wyłącza tryb tytułów — „przejrzyj → wybierz → czytaj"
  to jedna prosta pętla.
- **Karta pełna zachowuje przycisk „Doczytam" z 124** — widok tytułów jest szybszą drogą, nie
  jedyną; usunięcie przycisku z kart byłoby regresem dla kogoś, kto zdecyduje się w trakcie lektury
  streszczenia.
- **Relacja do zawężenia `doczytania`:** w widoku tytułów zawężenie do samych odłożonych nie jest
  potrzebne (stan widać na wierszach), ale jeśli ktoś je włączy adresem — działa na tym samym
  zbiorze (AC-9); zero specjalnych przypadków.

## 9. Ryzyka

- **Przekombinowanie** (wprost nazwane przez właściciela) → zakres ograniczony do trzech elementów:
  przełącznik, wiersz-przełącznik, przejście z licznikiem; sekcja „poza zakresem" świadomie wycina
  resztę pomysłów.
- **Przypadkowe oznaczenia przy przewijaniu kciukiem** → gest to dotknięcie (tap/click), nie
  najechanie ani przesunięcie; przełącznik jest odwracalny tym samym gestem, a stan widoczny
  natychmiast — pomyłka kosztuje jedno dotknięcie.
- **Rozjazd między widokiem tytułów a pełnym** → oba tryby konsumują TEN SAM zbiór pozycji
  (lekcja 085), różnica jest wyłącznie w sposobie rysowania wiersza; asercja w e2e.
