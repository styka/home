# Spec: Poprawki UX — edytor skórek w dialogu, panel szczegółów zadania bez zbędnej linii, jeden mechanizm zakresu projektów

- **ID:** 122-ux-skorki-zadania-filtr
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-02
- **Moduł(y):** Settings/Wygląd (skórki) + Tasks (panel szczegółów, grupy projektów / filtr zakresu)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Trzy zgłoszenia właściciela z trybu „wskaż element":

1. **Skórki (`/settings/wyglad`).** Kliknięcie „Utwórz własną skórkę" (oraz „Duplikuj i edytuj" /
   „Edytuj") wysuwa formularz **inline pod przyciskiem**, na samym dole strony. Gdy przycisk jest
   przy dolnej krawędzi okna, sekcja otwiera się **poza ekranem** — użytkownik nie widzi żadnej
   reakcji na kliknięcie i myśli, że nic się nie stało.
2. **Zadania — panel szczegółów.** Panel szczegółów zadania ma osobny wiersz nagłówka (etykieta
   „Szczegóły zadania" + przyciski rozwiń/usuń/zamknij, na telefonie „Wróć"), który zabiera
   ~48 px pionu na sam chrom, nie niosąc treści.
3. **Zadania — duplikacja mechanizmów zakresu projektów.** Ten sam fakt („z jakich projektów są
   zadania w tym widoku") jest dziś wyrażony w kilku miejscach naraz: dropdown multiselect filtra
   projektów (z możliwością zapisu wyboru), pasek chipów „Projekty: …" w widoku zapisanego zestawu,
   oraz osobne UI edycji grup projektów (formularz nazwa+projekty). Właściciel odbiera to jako
   chaos i chce **jednego** mechanizmu.

## 2. Cel i miary sukcesu

- Cel: trzy wskazane miejsca działają bez utraty żadnej funkcji, ale bez opisanych wad UX —
  formularz skórki zawsze widoczny, panel szczegółów bez pustej linii chromu, zakres projektów
  wyrażony jednym mechanizmem.
- Sukces mierzymy:
  - kliknięcie „Utwórz własną skórkę" **zawsze** pokazuje formularz w widocznym miejscu, niezależnie
    od pozycji przewinięcia i wysokości okna;
  - panel szczegółów zadania ma o jeden wiersz chromu mniej (mierzalnie ~48 px więcej na treść),
    a wszystkie dotychczasowe akcje pozostają dostępne;
  - w widoku zapisanego zestawu informacja o zakresie i jego edycja są w **jednym** miejscu
    (dropdown filtra), pasek chipów „Projekty: …" nie istnieje, a zapisane widoki są nadal dostępne
    z nawigacji bocznej.

## 3. Historyjki użytkownika

- Jako użytkownik personalizujący wygląd chcę, żeby formularz nowej/edytowanej skórki otwierał się
  w oknie dialogowym, żebym zawsze widział, że aplikacja zareagowała, i mógł edytować bez szukania
  sekcji na dole strony.
- Jako użytkownik przeglądający zadanie chcę, żeby panel szczegółów zaczynał się od treści (tytułu),
  a przyciski panelu były obok tytułu, żeby więcej zadania mieściło się na ekranie.
- Jako użytkownik pracujący na kilku projektach naraz chcę jednego mechanizmu: w dropdownie
  zaznaczam projekty, mogę ten wybór zapisać pod nazwą, a otwierając zapisany widok — zobaczyć
  i **zmienić** jego zakres w tym samym dropdownie, żeby nie uczyć się dwóch pojęć („grupa"
  i „filtr") na jedną rzecz.
- Jako użytkownik chcę mieć zapisane widoki dostępne z nawigacji bocznej modułu Zadania (jak dziś),
  żeby wejść w nie jednym kliknięciem.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given strona `/settings/wyglad` przewinięta tak, że przycisk „Utwórz własną skórkę"
  jest przy dolnej krawędzi okna, when użytkownik klika przycisk, then formularz nowej skórki jest
  natychmiast **w całości widoczny** jako okno dialogowe (na telefonie arkusz dolny, zgodnie
  z konwencją modali Omnii), z zamknięciem przez Esc i przycisk.
- [ ] **AC-2** — Given otwarty dialog skórki, when użytkownik zapisuje lub anuluje, then dialog się
  zamyka, a lista skórek odzwierciedla wynik (nowa/zmieniona skórka widoczna; po zapisie nowa
  skórka zostaje aktywowana jak dotychczas).
- [ ] **AC-3** — Given akcje „Duplikuj i edytuj" oraz „Edytuj" na karcie skórki, when użytkownik
  ich używa, then otwiera się ten sam dialog (odpowiednio z kopią tokenów / z edycją istniejącej) —
  zachowanie funkcjonalne bez zmian względem dzisiejszego formularza.
- [ ] **AC-4** — Given otwarty panel szczegółów zadania (desktop), when użytkownik go ogląda, then
  panel **nie ma** osobnego wiersza nagłówka z etykietą „Szczegóły zadania"; przyciski
  rozwiń/zwiń, usuń i zamknij są dostępne w pierwszym wierszu treści (obok tytułu zadania),
  a wszystkie działają jak dotychczas (w tym `Esc` = zamknij).
- [ ] **AC-5** — Given panel szczegółów zadania na telefonie, when użytkownik go otwiera, then
  przycisk powrotu „Wróć" pozostaje widoczny i działa, bez osobnego wiersza-etykiety; cel dotyku
  przycisków ≥ 44 px.
- [ ] **AC-6** — Given widok zapisanego zestawu projektów, when użytkownik go otwiera, then **nie ma**
  paska chipów „Projekty: …"; dropdown filtra projektów pokazuje zakres zestawu (zaznaczone
  projekty i licznik) i pozwala go **zmienić oraz zapisać** (aktualizacja zestawu pod tą samą
  nazwą), a także zapisać jako nowy zestaw.
- [ ] **AC-7** — Given zapisane zestawy użytkownika, when użytkownik otwiera nawigację boczną modułu
  Zadania, then zapisane widoki są tam widoczne i prowadzą do swoich adresów (jak dziś); zmiana
  nazwy i usunięcie zestawu pozostają możliwe z poziomu tego jednego mechanizmu.
- [ ] **AC-8** — Given dotychczasowe zapisane grupy projektów (dane istniejących użytkowników),
  when zmiana wchodzi, then wszystkie działają bez migracji ręcznej — adresy `/tasks/zestaw/…`
  nadal otwierają swoje widoki, a zakres z nich nie znika.
- [ ] **AC-9** — Given widok zbiorczy (np. „Wszystkie") z filtrem ad hoc (bez zapisu), when
  użytkownik zaznacza/odznacza projekty w dropdownie, then lista zawęża się jak dotychczas,
  a pusty wybór pokazuje wszystkie projekty (zakres nigdy nie degraduje do zera).
- [ ] **AC-10** — Given całość zmian, when uruchamiany jest `npm run build` (do kroku `next build`),
  then przechodzi bez błędów (bramki UI-contract, i18n, boundaries itd.).

## 5. Zakres

**W zakresie:**
- Przeniesienie formularza tworzenia/edycji/duplikacji skórki do okna dialogowego (desktop: modal,
  telefon: arkusz dolny — konwencja Omnii).
- Usunięcie osobnego wiersza nagłówka panelu szczegółów zadania i scalenie jego akcji z wierszem
  tytułu zadania (desktop i telefon).
- Ujednolicenie zakresu projektów: dropdown multiselect jako jedyne miejsce pokazywania i edycji
  zakresu (w tym edycja zapisanego zestawu), usunięcie paska chipów „Projekty: …" i osobnego
  formularza edycji grupy; zapisane widoki pozostają w nawigacji bocznej.

**Poza zakresem (świadomie):**
- Zmiany w samym edytorze tokenów skórki (pola, walidacja, generator AI) — przenosimy go tylko
  w inne miejsce.
- Zmiany w funkcji „obszary" (spec 117) — obszary porządkują zadania **wewnątrz** projektu i nie
  kolidują z zakresem **między** projektami; nic tu nie zmieniamy.
- Zmiany modelu danych zapisanych zestawów (pozostaje dotychczasowy byt „grupa projektów" jako
  nośnik zapisanego wyboru — zmienia się wyłącznie sposób prezentacji i edycji).
- Przenoszenie filtrowania na serwer / paginacja list zadań (osobna pozycja roadmapy).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — istniejące `module.settings` i `module.tasks` (C-22 nie
  wymaga nowego sluga; żadna nowa trasa modułowa nie powstaje).
- **Własność danych:** bez zmian — skórki i zapisane zestawy zachowują dotychczasową własność
  (per użytkownik / przestrzeń); żadnych nowych tabel ani kolumn.
- **Asystent AI:** nie dotyczy — żadna nowa `AIAction` ani read-tool; istniejące akcje pozostają.
- **Kalendarz / powiadomienia / trash:** nie dotyczy; usuwanie zestawu i skórki działa jak dziś
  (potwierdzenie przez `confirmDialog`, C-34).

## 7. Zgodność z konstytucją

- **C-01** — całość w `worldofmag/`.
- **C-53** — minimalizm: zero nowych bytów danych; zgłoszenie 3 to **redukcja** UI, nie rozbudowa.
- **C-30/C-31** — dialog skórki i scalony wiersz akcji panelu zadania: zmienne CSS, arkusz dolny na
  telefonie z `env(safe-area-inset-bottom)`, cele dotyku ≥ 44 px.
- **C-33** — widoki nadal deklarują się przez `ModuleView`; zmiany nie dotykają ramy ani nie
  wprowadzają wyjątków w module.
- **C-32** — nowe/zmienione teksty UI przez `t()` do `messages/pl.json`.
- **C-34** — potwierdzenia destrukcyjne (usunięcie zestawu/skórki) bez zmian, przez `confirmDialog`.
- **C-35** — żaden nowy wspólny komponent nie powstaje bez konsumenta; używamy istniejących
  (modal, warstwa zakotwiczona).
- **C-50** — gotowe = `npm run build` przechodzi (lokalnie do `next build`, bez `migrate.js` — C-13).
- **C-10..C-14** — nie dotyczą wprost (brak migracji), co plan ma jawnie potwierdzić.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jedynym momencie pytań (C-55), 2026-09-02:

- [x] **Formularz skórki → dialog/modal** (wybór właściciela; na telefonie arkusz dolny).
- [x] **Wiersz „Szczegóły zadania" → scalić z wierszem tytułu** (wybór właściciela; osobna linia
  znika całkowicie, funkcje przechodzą do wiersza tytułu).
- [x] **Zakres projektów → jeden mechanizm: dropdown multiselect z zapisem** (wybór właściciela,
  z zastrzeżeniem „sprawdź, czy obszary tego nie zdezaktualizowały"). **Sprawdzone:** obszary
  (spec 117) porządkują zadania *wewnątrz jednego* projektu; grupy/filtr dotyczą zakresu *między*
  projektami — zgłoszenie pozostaje aktualne, oba mechanizmy się uzupełniają i nie kolidują.
  Branch roboczy zweryfikowany jako zgodny z `origin/develop` (ten sam commit czubka).

Założenia przyjęte domyślnie (rekomendowane, bez osobnego pytania):
- Pasek chipów „Projekty: …" znika w całości (informację i nawigację przejmuje dropdown); szybkie
  przejście do pojedynczego projektu pozostaje możliwe z nawigacji bocznej.
- Zapisany zestaw pozostaje tym samym bytem danych co dziś (bez migracji) — zmiana jest wyłącznie
  prezentacyjna, co gwarantuje AC-8.
- Edycja nazwy/usunięcie zestawu pozostają dostępne (z nawigacji bocznej i/lub dropdownu w widoku
  zestawu) — żadna funkcja nie znika.

## 9. Ryzyka

- **Regres funkcji przy scalaniu wiersza akcji panelu zadania** (tryb szeroki, skróty klawiszowe,
  powrót na telefonie) → kryteria AC-4/AC-5 wymieniają wszystkie akcje wprost; weryfikacja
  w `/verify` punkt po punkcie.
- **Utrata wejścia w edycję zestawu** po usunięciu osobnego formularza → AC-6/AC-7 wymagają, by
  edycja zakresu, nazwy i usunięcie były osiągalne w nowym mechanizmie zanim stary zniknie.
- **Dialog skórki na telefonie** (długi formularz w arkuszu dolnym) → arkusz przewijalny wewnątrz,
  stopka z przyciskami nad `safe-area` (konwencja 087).
- **Bramka UI/i18n** wyłapie zaszyte literały lub brak `state` — budujemy do `next build` przed
  merge (AC-10).
