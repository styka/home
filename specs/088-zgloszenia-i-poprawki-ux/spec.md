# Spec: Zgłoszenia bez czekania i pakiet poprawek UX

- **ID:** 088-zgloszenia-i-poprawki-ux
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-24
- **Moduł(y):** Wiadomości, Zadania (skrzynka zgłoszeń), asystent AI + tryb wskazywania („robaczek"), rama widoku (`ModuleView`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Właściciel zgłosił pięć rzeczy z jednego, wspólnego korzenia: **droga „zauważam usterkę → mam z niej
zadanie" jest dziś wolna, niepewna i gubi kontekst**, a trzy z zauważonych usterek dotyczą tego, co
widać po drodze (przyklejone paski w Wiadomościach, pusty wiersz w nagłówku na telefonie, ciasny
nagłówek „Gorące tematy").

Najdotkliwszy jest sam mechanizm zgłoszeń. Dziś opis wskazanego miejsca jedzie **pełną pętlą
agenta** (model rozumujący, narzędzia, strumień myśli), która zwraca *propozycję planu*, a plan
dopiero drugim żądaniem tworzy zadanie. Skutki, wszystkie odczute przez właściciela:

- **trzeba czekać z zamknięciem asystenta** — zamknięcie okna **przerywa trwające żądanie**, więc
  zadanie faktycznie nie powstaje; obawa właściciela jest uzasadniona, nie wyobrażona,
- **nie ma natychmiastowego potwierdzenia**, że zgłoszenie zostało przyjęte,
- **płacimy za rozumowanie tam, gdzie decyzji nie ma** — jedyne, czego model jest tu naprawdę
  potrzebny, to zwięzły **tytuł** zadania,
- **do zadania nie trafia obraz** wskazanego miejsca, tylko jego opis tekstowy (ścieżka, sekcja,
  element, tekst w pobliżu) — administrator odtwarza usterkę z opisu, zamiast ją zobaczyć,
- **nie da się od razu nadać priorytetu** zgłoszeniu, choć zadania priorytet mają.

## 2. Cel i miary sukcesu

- **Cel:** zgłoszenie z trybu wskazywania powstaje **natychmiast i pewnie**, z obrazem wskazanego
  miejsca i wybranym priorytetem, przy jednym tanim wywołaniu modelu; a trzy wskazane usterki UI
  znikają.
- **Sukces mierzymy:**
  - potwierdzenie „zgłoszenie utworzone" widoczne **bez oczekiwania na model**, a zamknięcie
    asystenta zaraz po wysłaniu **nie kasuje** zgłoszenia (zadanie jest w skrzynce),
  - liczba wywołań modelu na jedno zgłoszenie: **1** (dziś: pętla agenta + osobne wykonanie planu),
    i to na tanim typie operacji zamiast na rozumującym,
  - w utworzonym zadaniu jest **obraz wskazanego elementu** i **priorytet** wybrany przez
    zgłaszającego,
  - w Wiadomościach przy przewijaniu **nic nie przesuwa się obok przyklejonych pasków**,
  - nagłówek widoku na telefonie **nie zawiera pustego wiersza**,
  - nagłówek proponowanych tematów mieści się w **jednym wierszu przy 360 px**.

## 3. Historyjki użytkownika

- Jako administrator chcę, żeby po wysłaniu opisu zgłoszenie **od razu** było potwierdzone, żebym
  mógł zamknąć asystenta i wrócić do swojej pracy, nie zastanawiając się, czy zadanie powstało.
- Jako administrator chcę **zobaczyć** w zadaniu wskazany fragment ekranu, żeby nie odtwarzać
  usterki z opisu.
- Jako administrator chcę nadać zgłoszeniu **priorytet już w chwili opisywania**, żeby lista „Omnia"
  od razu była uporządkowana.
- Jako właściciel systemu chcę, żeby zgłoszenie **nie uruchamiało rozumowania modelu**, skoro jedyną
  decyzją jest tytuł — nie chcę płacić za pracę, której nie ma.
- Jako czytelnik Wiadomości chcę, żeby przewijana treść **znikała pod paskami**, a nie przesuwała
  się widocznie obok nich.
- Jako użytkownik telefonu chcę nagłówek **bez pustego wiersza** i **bez ciasnoty** w sekcji
  proponowanych tematów.

## 4. Kryteria akceptacji (testowalne)

**Zgłoszenie bez czekania (zad. 5)**
- [ ] **AC-1** — Given tryb wskazywania z wybranym elementem, when wysyłam opis, then zgłoszenie
      zostaje utworzone **zanim** cokolwiek trafi do modelu, a asystent pokazuje potwierdzenie
      z identyfikatorem/nazwą utworzonego zadania.
- [ ] **AC-2** — Given wysłany opis, when **natychmiast zamknę asystenta**, then zadanie i tak
      istnieje w skrzynce zgłoszeń (zamknięcie nie może go anulować).
- [ ] **AC-3** — Given utworzone zgłoszenie, when model dogra ładniejszy tytuł, then tytuł zadania
      zostaje podmieniony; a gdy model zawiedzie lub jest wyłączony, **zadanie zostaje z tytułem
      roboczym** i nigdzie nie widać błędu wymagającego reakcji.
- [ ] **AC-4** — Given zgłoszenie z trybu wskazywania, when policzę wywołania modelu, then jest
      **dokładnie jedno**, na typie operacji przeznaczonym do krótkiego przetwarzania tekstu, i
      **żadnego** przy wykonaniu planu — bo planu nie ma.
- [ ] **AC-5** — Given zgłoszenie, when otworzę utworzone zadanie, then jego opis zawiera opis
      zgłaszającego **słowo w słowo** oraz kontekst wskazanego miejsca (tak jak dziś), a tytuł
      zaczyna się od 🐛.

**Zrzut wskazanego elementu (zad. 4)**
- [ ] **AC-6** — Given wskazany element, when powstaje zgłoszenie, then do zadania dołączony jest
      **obraz obejmujący dokładnie ten element** (jego prostokąt), a nie całą stronę.
- [ ] **AC-7** — Given zadanie ze zrzutem, when otworzę jego szczegóły, then widzę miniaturę i mogę
      obejrzeć obraz w powiększeniu; usunięcie zadania usuwa też zrzut.
- [ ] **AC-8** — Given element, którego z jakiegoś powodu nie da się zrzucić, when wysyłam
      zgłoszenie, then **zgłoszenie i tak powstaje** (bez obrazu) — brak zrzutu nigdy nie blokuje
      zgłoszenia ani nie pokazuje błędu.
- [ ] **AC-9** — Given wygenerowany zrzut, when jest większy niż przyjęty limit, then zostaje
      zmniejszony/skompresowany przed zapisem, żeby nie rozdymać zadania.

**Priorytet przy opisywaniu (zad. 4)**
- [ ] **AC-10** — Given tryb zgłoszenia, when patrzę na pole opisu, then **widzę wybór priorytetu**
      (bez wchodzenia w ustawienia i bez dodatkowego kliknięcia), z sensowną wartością domyślną.
- [ ] **AC-11** — Given wybrany priorytet, when zgłoszenie powstanie, then utworzone zadanie ma
      **ten** priorytet.

**Wiadomości — oś czasu pod paskami (zad. 1)**
- [ ] **AC-12** — Given widok osi czasu w Wiadomościach, when przewijam stronę, then **żaden
      element treści (w tym punkty osi) nie jest widoczny obok przyklejonych pasków** — treść znika
      pod nimi na całej ich szerokości.
- [ ] **AC-13** — Given ten sam widok, when patrzę na oś, then punkty nadal leżą **na linii osi**
      (poprawka nie może zamienić usterki na krzywo ustawione kropki).

**Nagłówek widoku — pusty wiersz na telefonie (zad. 2)**
- [ ] **AC-14** — Given widok modułu, który w pasku nie ma ani akcji, ani ustawień, when oglądam go
      na telefonie, then **nie ma pustego wiersza** pod nazwą modułu.
- [ ] **AC-15** — Given widoki, które akcje mają, when oglądam je na telefonie i na komputerze,
      then układ paska pozostaje **niezmieniony** względem stanu sprzed poprawki.

**Proponowane tematy (zad. 3)**
- [ ] **AC-16** — Given zakładkę z gorącymi tematami, when patrzę na nagłówek sekcji, then czyta on
      **„Proponowane"** (z licznikiem) — słowo „gorące" niesie już zakładka.
- [ ] **AC-17** — Given telefon (360 px), when patrzę na ten nagłówek, then mieści się on
      **w jednym wierszu**, a „Monitorowane" i „Odrzucone" są dostępne z **menu trzykropkowego**
      (ten sam wzorzec, co edycja/usuwanie tematu).
- [ ] **AC-18** — Given menu trzykropkowe, when nie ma ani monitorowanych, ani odrzuconych tematów,
      then menu nie pokazuje pustych pozycji.

## 5. Zakres

**W zakresie:**
- Nowa, **deterministyczna droga zgłoszenia** z trybu wskazywania: zapis natychmiast, jedno tanie
  wywołanie modelu po tytuł, dogrywane w tle; natychmiastowe potwierdzenie w asystencie.
- **Zrzut wskazanego elementu** dołączany do utworzonego zadania jako **załącznik zadania** (nowy
  rodzaj załącznika, analogiczny do istniejących w Notatkach / Zdrowiu / Flocie) + podgląd
  w szczegółach zadania.
- **Wybór priorytetu** w trybie zgłoszenia i przeniesienie go na utworzone zadanie.
- Poprawka **przyklejonych pasków vs. punkty osi czasu** w Wiadomościach.
- Poprawka **pustego wiersza** w pasku widoku na telefonie.
- **Zmiana nazwy** sekcji na „Proponowane" + przeniesienie jej dwóch przełączników do menu ⋮.
- Wpis w `doświadczenia.md` (C-51) — co najmniej o przerywanym żądaniu przy zamknięciu asystenta.

**Poza zakresem (świadomie):**
- Zmiana zachowania asystenta **poza** trybem zgłoszenia — zwykła rozmowa dalej idzie pętlą agenta.
- Załączniki zadań jako **funkcja ogólna** (ręczne dodawanie plików przez użytkownika w widoku
  zadań) — dowozimy nośnik razem z jego pierwszym konsumentem, czyli zrzutem (C-35); ręczne
  dodawanie może przyjść później.
- Zrzut **całego ekranu** albo nagranie — prosiliśmy o wskazany element.
- Zmiana skrzynki zgłoszeń, jej uprawnień i wyjątku dostępu (zostaje dokładnie jak jest).
- Przebudowa listy „Gorących tematów" poza nagłówkiem sekcji.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Zgłoszenie dalej idzie **wąskim, świadomym wyjątkiem**
  skrzynki zgłoszeń (każdy zalogowany może **wrzucić**, nikt nie zyskuje prawa **odczytu**).
  Sam tryb wskazywania pozostaje narzędziem administratora (widoczny tylko w trybie administratora).
  Nowy załącznik dziedziczy dostęp po zadaniu — kto nie widzi zadania, nie widzi zrzutu.
- **Własność danych:** bez nowej własności — zrzut jest **częścią zadania** i żyje/ginie razem z nim
  (kaskada). Zadanie należy do przestrzeni skrzynki, jak dziś.
- **Asystent AI:** **ubywa**, nie przybywa. Tryb zgłoszenia przestaje korzystać z pętli agenta
  i z planu akcji; istniejąca akcja zgłoszeniowa pozostaje w katalogu dla wywołań z rozmowy
  (kontrakt akcji i pokrycie egzekutorem bez zmian — C-23). Jedyne wywołanie modelu to krótkie
  wygenerowanie tytułu, rozliczane jak każde inne (koszt/limity/budżet).
- **Kalendarz / powiadomienia / trash:** kalendarz i powiadomienia — nie dotyczy. Kosz: usunięcie
  zadania działa jak dziś; zrzut jest częścią zadania i nie ma własnej ścieżki odzysku.

## 7. Zgodność z konstytucją

- **C-01, C-53 (minimalizm)** — praca wyłącznie w `worldofmag/`; każda z pięciu pozycji dostaje
  najmniejszą możliwą poprawkę. Jedyna nowa zależność (rasteryzacja DOM → obraz) jest **świadomą
  decyzją właściciela**: własny rasteryzator to więcej kodu i więcej pułapek niż jedna mała paczka.
- **C-10, C-11, C-12** — nośnik załącznika wymaga **ręcznie napisanej migracji** z kolejnym wolnym
  numerem; rodzaje/statusy jako `String` + union, **zero enumów Prisma**.
- **C-13** — żadnego builda ani migracji przeciw produkcyjnej bazie; weryfikacja na lokalnym
  Postgresie.
- **C-20** — mutacje przez Server Actions z `revalidatePath()`.
- **C-23** — katalog akcji asystenta i jego egzekutor pozostają spójne (bramka pokrycia akcji).
- **C-30, C-31** — kolory wyłącznie ze zmiennych CSS; poprawki 1–3 są z definicji **mobile-first**
  (dotyczą telefonu), cele dotyku i obszary bezpieczne bez regresji.
- **C-32** — wszystkie nowe teksty (nazwa „Proponowane", potwierdzenie zgłoszenia, etykiety
  priorytetu, opis zrzutu) idą do zasobów tłumaczeń, **żadnych literałów w komponentach**.
- **C-33** — poprawka pustego wiersza dotyczy **ramy widoku**, więc idzie **w ramie**, a nie
  wyjątkiem w module; poprawka osi czasu nie może naruszyć zasady „zasłona = suma wysokości,
  wyrażona w CSS".
- **C-35** — nośnik załącznika dowozimy **razem z jego pierwszym konsumentem** (zrzut ze zgłoszenia).
- **C-50, C-51, C-52/C-52a** — „gotowe" = zielony `npm run build`; lekcja do `doświadczenia.md`;
  merge do `develop`, a na końcu promocja `--ff-only` na `master` z tagiem.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jedynym momencie pytań (C-55) — wszystkie odpowiedzi: **wariant zalecany**.

- [x] **Technika zrzutu** → mała biblioteka rasteryzująca klon DOM do obrazu (MIT, bez zależności
      przechodnich). Odrzucone: własny rasteryzator (więcej kodu niż jedna paczka), sam HTML
      elementu (to nie jest to, o co właściciel prosił).
- [x] **Miejsce zapisu zrzutu** → **załącznik zadania**, obraz osadzony jak w istniejących
      załącznikach innych modułów; miniatura w szczegółach zadania, kasowany kaskadą z zadaniem.
      Odrzucone: obrazek w opisie przez publiczną trasę.
- [x] **Tworzenie zgłoszenia** → **natychmiast**, tytuł roboczy z opisu, ładny tytuł dogrywany
      w tle jednym tanim wywołaniem. Odrzucone: synchroniczne wywołanie po tytuł (dalej każe
      czekać), całkowita rezygnacja z modelu (surowe tytuły na liście).
- [x] **„Gorące tematy"** → nagłówek **„Proponowane"**, oba przełączniki do **menu ⋮**. Odrzucone:
      drugi wiersz na telefonie, sama zmiana układu bez zmiany nazwy.

**Założenia przyjęte samodzielnie** (nie były warte osobnego pytania):
- Domyślny priorytet zgłoszenia = **średni**, żeby zgłoszenia nie lądowały na dnie ani nie udawały
  wszystkie awarii; wybór jest jednym dotknięciem obok pola opisu.
- Tytuł roboczy = pierwsze zdanie/fragment opisu z prefiksem 🐛, przycięty do rozsądnej długości.
- Format zrzutu: obraz rastrowy ze skalą ekranu, z górnym limitem rozmiaru; przy przekroczeniu —
  zmniejszenie, nie odrzucenie.
- Potwierdzenie zgłoszenia w asystencie pokazuje tytuł i — jeśli zgłaszający ma dostęp do skrzynki
  — przejście do zadania (tak jak dziś działa informacja o skrzynce).

## 9. Ryzyka

- **Rasteryzacja DOM bywa zawodna** (czcionki, tła, elementy poza ekranem) → zrzut jest
  **dodatkiem**, nigdy warunkiem: awaria zrzutu nie może zablokować zgłoszenia (AC-8), a jego
  wielkość jest ograniczona (AC-9).
- **Nowa zależność w przeglądarce powiększa paczkę JS**, a mamy na to bramkę budżetu → ładujemy ją
  **leniwie**, wyłącznie w narzędziu administratora, i sprawdzamy budżet po zmianie.
- **Podmiana tytułu w tle może się rozminąć z otwartym widokiem zadania** (ktoś patrzy na listę
  w chwili podmiany) → podmiana jest jednorazowa i idzie zwykłą ścieżką odświeżenia danych; gorszy
  wariant (tytuł roboczy zostaje) jest akceptowalny i widoczny.
- **Poprawka osi czasu może rozjechać kropki** (usterka zamieniona na inną usterkę) → AC-13 pilnuje
  położenia kropek na linii, a poprawka idzie w obrębie własnego kontenera treści, bez ruszania
  zasady zasłony z C-33.
- **Poprawka pustego wiersza dotyka ramy używanej przez ~20 widoków** → AC-15 wymaga braku zmian
  tam, gdzie akcje są; sprawdzamy oba warianty gęstości paska.
- **Zmiana drogi zgłoszenia może „zgubić" tryb wskazywania** przy szybkim ponownym użyciu → stan
  trybu jest jednorazowy i zerowany po wysłaniu, tak jak dziś.
