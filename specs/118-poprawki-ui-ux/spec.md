# Spec: Paczka poprawek UI/UX ze zgłoszeń administratora (11 zgłoszeń)

- **ID:** 118-poprawki-ui-ux
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-01
- **Moduł(y):** Tasks / Rośliny / powłoka (nawigacja boczna) / asystent AI (link do zgłoszenia)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Administrator zgłosił przez inspektor elementów 11 usterek UX, które razem obniżają codzienny komfort
pracy: chrome (filtry, formularz dodawania) zjada miejsce na treść w Zadaniach, przyciski i nagłówki
z ikonami łamią linię między ikoną a etykietą (wygląda to na wadę globalną, widoczną w Roślinach
w kilku miejscach naraz), akcje w Roślinach zachowują się niespójnie (część otwiera modal, część
rozsuwa treść), menu boczne na komputerze nie daje się zwinąć, a link po utworzeniu zgłoszenia przez
asystenta prowadzi tylko do listy zamiast do konkretnego zadania. To drobiazgi, ale każdy z nich
uderza w filozofię UX Omnii: zero zbędnych kliknięć, maksimum miejsca na treść.

## 2. Cel i miary sukcesu

- Cel: wszystkie 11 zgłoszeń zamknięte tak, że wskazane miejsca zachowują się zgodnie z oczekiwaniem
  zgłaszającego, bez regresji w pozostałych widokach.
- Sukces mierzymy:
  - w widokach list Zadań treść listy zaczyna się wyżej (chrome nad listą niższy) niż przed zmianą;
  - żaden przycisk ani nagłówek z ikoną w aplikacji nie łamie linii między ikoną a etykietą;
  - wszystkie akcje nagłówka przestrzeni w Roślinach otwierają się w modalach — jednym wzorcem;
  - menu boczne na komputerze daje się zwinąć do ikon i stan wraca po ponownym zalogowaniu na
    dowolnym urządzeniu;
  - link z potwierdzenia utworzonego zgłoszenia otwiera podgląd tego konkretnego zadania.

## 3. Historyjki użytkownika

- Jako użytkownik Zadań chcę, żeby filtr etykiet bez aktywnego wyboru był małym przyciskiem w pasku
  narzędzi, żeby lista zadań miała więcej miejsca.
- Jako użytkownik Zadań chcę dodawać zadanie przez modal otwierany przyciskiem (i skrótem
  klawiszowym), żeby stały formularz nie zabierał przestrzeni widoku listy.
- Jako użytkownik chcę, żeby przyciski i nagłówki sekcji z ikoną nigdy nie łamały tekstu pod ikonę,
  żeby interfejs wyglądał schludnie na każdej szerokości ekranu.
- Jako użytkownik Roślin chcę, żeby akcje „Nowe miejsce" i „Nowa roślina" otwierały modal tak samo
  jak „Udostępnij", żeby układ strony nie skakał przy każdej akcji.
- Jako użytkownik Roślin chcę móc ustawić lokalizację pogodową już w formularzu tworzenia
  przestrzeni, żeby nie wracać do ustawień po utworzeniu.
- Jako użytkownik Roślin chcę rozumieć, co zmienia przełącznik „Pokaż zaawansowane", zanim go
  włączę.
- Jako użytkownik na komputerze chcę zwinąć menu boczne do samych ikon i żeby ten wybór został
  zapamiętany na moim koncie, żeby mieć więcej miejsca na treść.
- Jako administrator zgłaszający usterki chcę, żeby link w potwierdzeniu „Utworzono zgłoszenie"
  otwierał podgląd tego zadania, a nie samą listę, żeby od razu zweryfikować/uzupełnić zgłoszenie.

## 4. Kryteria akceptacji (testowalne)

Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.

- [ ] **AC-1 (zgł. 1)** — Given widok listy/zestawu Zadań bez wybranej etykiety, when strona się
  renderuje, then filtr etykiet jest kompaktowym przyciskiem w istniejącym wierszu paska narzędzi
  (nie zajmuje osobnego pełnego wiersza), a chipy wybranych etykiet pojawiają się dopiero po wyborze.
- [ ] **AC-2 (zgł. 2)** — Given widok listy Zadań, when strona się renderuje, then stały formularz
  dodawania nie jest widoczny nad listą; when użytkownik kliknie przycisk dodawania lub użyje skrótu
  `a`/`n`, then otwiera się modal z pełnym formularzem dodawania zadania; when doda zadanie, then
  zadanie pojawia się na liście bez przeładowania strony, a Esc zamyka modal (C-31, C-33).
- [ ] **AC-3 (zgł. 3, 5, 8, 9)** — Given dowolny przycisk lub nagłówek sekcji z ikoną i etykietą
  (m.in. „Nowa przestrzeń" na /rosliny, „Usuń przestrzeń", pasek akcji „Udostępnij / Nowe miejsce /
  Nowa roślina / Pokaż zaawansowane", nagłówek „Pomiary"), when zwężamy okno do szerokości mobilnych
  i pośrednich, then etykieta nigdy nie łamie się pod ikonę ani po znaku „+" — element pozostaje
  jednowierszowy (całość może się zawinąć jako jeden klocek do następnego wiersza paska).
- [ ] **AC-4 (zgł. 4)** — Given widok przestrzeni w Roślinach, when użytkownik kliknie „Nowe
  miejsce" lub „Nową roślinę", then formularz otwiera się w modalu — analogicznie do „Udostępnij" —
  a treść strony pod spodem nie rozsuwa się ani nie przewija.
- [ ] **AC-5 (zgł. 6)** — Given formularz tworzenia nowej przestrzeni roślinnej, when użytkownik go
  otwiera, then dostępne jest opcjonalne pole wyboru lokalizacji pogodowej (te same lokalizacje, co
  w module Pogoda); when pominie pole, then przestrzeń tworzy się bez lokalizacji tak jak dziś i da
  się ją ustawić później.
- [ ] **AC-6 (zgł. 7)** — Given widok przestrzeni w Roślinach, when użytkownik widzi przełącznik
  „Pokaż zaawansowane", then przełącznik komunikuje, co odsłania (opis/etykieta pomocnicza widoczna
  lub dostępna bez włączania), a po włączeniu odsłonięte pola są rozpoznawalne.
- [ ] **AC-7 (zgł. 11)** — Given komputer (widok z bocznym menu), when użytkownik kliknie
  przełącznik zwijania menu, then menu zwija się do samych ikon modułów (z podpowiedziami nazw),
  wszystkie pozycje pozostają klikalne i dostępne z klawiatury; when zaloguje się na innym
  urządzeniu, then stan zwinięcia jest zapamiętany na koncie; when kliknie ponownie, then menu wraca
  do pełnej postaci. Na mobile nic się nie zmienia (C-31).
- [ ] **AC-8 (zgł. 10)** — Given asystent utworzył zgłoszenie (zadanie) ze wskazania elementu, when
  użytkownik kliknie link w potwierdzeniu, then aplikacja otwiera listę zadań z widocznym podglądem
  tego konkretnego zadania (nie samą listę).
- [ ] **AC-9 (regresja)** — Given zmiany globalne w przyciskach/nagłówkach, when przechodzimy przez
  widoki innych modułów (m.in. Pogoda, Wiadomości, Magazynowanie), then układy pasków akcji nie
  rozjeżdżają się i `npm run build` (do kroku `next build`) przechodzi.

## 5. Zakres

**W zakresie:**
- Zadania: kompaktowy filtr etykiet (zgł. 1), dodawanie zadania przez modal (zgł. 2).
- Globalny fix łamania linii ikona/etykieta w przyciskach i nagłówkach sekcji (zgł. 3, 5, 8, 9) —
  jedna przyczyna, jedna poprawka we wspólnych wzorcach + korekty miejsc zgłoszonych.
- Rośliny: akcje nagłówka przestrzeni w modalach (zgł. 4), lokalizacja pogodowa w formularzu
  tworzenia przestrzeni (zgł. 6), objaśnienie przełącznika „Pokaż zaawansowane" (zgł. 7).
- Powłoka: zwijanie menu bocznego do ikon z zapamiętaniem per użytkownik (zgł. 11).
- Asystent: link z potwierdzenia zgłoszenia otwiera podgląd utworzonego zadania (zgł. 10).

**Poza zakresem (świadomie):**
- Przebudowa semantyki filtrów Zadań (koniunkcja etykiet zostaje bez zmian).
- Zmiany w mobilnej nawigacji (pasek kciuka, wachlarz) — zwijanie dotyczy tylko desktopu.
- Automatyczne zwijanie menu zależne od szerokości okna (wybrano przełącznik ręczny).
- Nowe funkcje modułu Pogoda (używamy istniejących lokalizacji, nie budujemy nowego wyboru mapy
  w Roślinach ponad to, co już istnieje).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** żadnych nowych slugów — zmiany w istniejących modułach (`module.tasks`,
  `module.rosliny`) i w powłoce (bez uprawnienia).
- **Własność danych:** preferencja zwinięcia menu jest per użytkownik (jak pozostałe preferencje
  menu); żadnych nowych zasobów współdzielonych.
- **Asystent AI:** bez nowych akcji; zmiana dotyczy wyłącznie treści linku w istniejącym
  potwierdzeniu utworzenia zgłoszenia (C-23 nie wymaga nowego egzekutora).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-01** — cała praca w `worldofmag/`.
- **C-20** — zapis preferencji zwijania menu i ewentualne zmiany formularzy przez Server Actions
  z `revalidatePath()`.
- **C-30** — wszystkie style przez zmienne CSS motywu; zero hardcodowanych hexów.
- **C-31** — mobile-first: zwijanie menu nie dotyka mobile; modal dodawania zadania jako arkusz
  dolny na telefonie respektuje `env(safe-area-inset-bottom)`; cele dotyku bez zmian.
- **C-33** — widoki dalej deklarują się przez `ModuleView`; kompaktowy filtr żyje w strefie
  filtrów paska widoku, nie w osobnym wierszu.
- **C-34** — modale/potwierdzenia przez istniejące wzorce, nigdy `window.confirm()`.
- **C-35** — poprawka łamania ikona/etykieta ląduje we wspólnych komponentach razem z konsumentami
  (miejscami zgłoszonymi), nie jako martwy wariant.
- **C-53** — minimalizm: bez refaktorów „przy okazji"; naprawiamy zgłoszone zachowania.
- **C-50/C-52/C-52a** — build jako definicja „gotowe", merge do `develop`, promocja `--ff-only`.

## 8. Otwarte pytania / decyzje właściciela

Decyzje zebrane w jedynym momencie pytań (2026-09-01):

- **Dodawanie zadania z listy:** modal otwierany przyciskiem (wybór właściciela — wbrew
  rekomendacji zwijanego wiersza); skróty `a`/`n` otwierają modal.
- **Zwijanie menu bocznego:** przełącznik ręczny + zapamiętanie per użytkownik (zalecane).
- **Filtr etykiet:** kompaktowy przycisk w pasku narzędzi, chipy tylko dla wybranych (zalecane).
- **Lokalizacja pogodowa:** opcjonalne pole w formularzu tworzenia przestrzeni (zalecane).

Założenia przyjęte samodzielnie (domyślne, minimalne):
- Zgłoszenia 3/5/8/9 traktujemy jako jeden defekt łamania linii we wspólnych wzorcach przycisku
  i nagłówka sekcji; naprawa globalna + weryfikacja miejsc zgłoszonych.
- Zgłoszenie 7 rozwiązujemy objaśnieniem (opis pomocniczy przy przełączniku), bez zmiany zestawu
  pól odsłanianych przez tryb zaawansowany.
- Zgłoszenie 10: link prowadzi do listy zadań z otwartym podglądem wskazanego zadania (istniejący
  wzorzec adresowalnego widoku), bez nowego ekranu.
- „Udostępnij" w Roślinach zostaje wzorcem: pozostałe akcje przyjmują jego zachowanie (modal),
  a nie odwrotnie.

## 9. Ryzyka

- **Globalna zmiana zawijania w przyciskach może zepsuć inne widoki** → zmiana we wspólnym wzorcu
  + przegląd wizualny kluczowych modułów + AC-9 (build i przegląd regresji).
- **Modal dodawania zadania może spowolnić szybkie wpisywanie wielu zadań** → modal po dodaniu
  pozwala od razu dodać kolejne (focus wraca do pola tytułu), bulk-add pozostaje bez zmian.
- **Zwinięte menu może ukryć rzadko używane moduły** → ikony zachowują kolejność i podpowiedzi
  nazw; stan jest odwracalny jednym kliknięciem.
- **Zmiana filtru etykiet może zaburzyć wysokość przyklejonych pasków** → filtr zostaje w strefie
  filtrów paska widoku o stałej wysokości (lekcja 083/100 — stała wysokość paska).
