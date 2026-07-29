# Spec: Asystent — pełny ekran na telefonie, lektor w trybie rozmowy i optymalizacja kosztów

- **ID:** 036-asystent-pelny-ekran-lektor-i-optymalizacja
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-28
- **Moduł(y):** Home / Asystent AI (okno czatu, lektor, ścieżka wywołań modelu), Admin → Modele LLM

## 1. Problem / potrzeba

Trzy niezależne bolączki asystenta. **Po pierwsze** okno na telefonie zajmuje 85% wysokości i jest
przypięte do dołu ekranu — a gdy wysuwa się klawiatura, całe okno jedzie w górę zamiast po prostu
zmaleć. Efekt uboczny tego samego mechanizmu: kursor po tapnięciu w pole wiadomości ciągle pojawia się
w złym miejscu. Właściciel chce zachowania znanego z ChatGPT i Claude: okno na cały ekran, a klawiatura
odbiera miejsce **obszarowi wiadomości**, który i tak ma własne przewijanie. **Po drugie** lektor
serwerowy (płatny, ustawiony w konfiguracji) czyta odpowiedzi po kliknięciu ikony — ale w trybie
rozmowy głosowej na telefonie odzywa się głos systemowy, choć na komputerze wszystko działa.
**Po trzecie** audyt z 035 wyliczył, że odpowiedź na „hej" kosztuje 7734 tokeny, i wskazał pięć
konkretnych oszczędności — czas je wdrożyć. Do tego follow-upy (propozycje kolejnych pytań) mają
przestać być bezwarunkowe: administrator ma móc je wyłączyć, bo kosztują tokeny przy każdej odpowiedzi.

## 2. Cel i miary sukcesu

- **Cel:** asystent, który na telefonie zachowuje się jak dojrzały czat (pełny ekran, klawiatura
  zabiera miejsce tylko wiadomościom, kursor tam, gdzie ma być), mówi wybranym głosem **w każdym
  trybie**, i kosztuje wyraźnie mniej przy prostych poleceniach.
- **Sukces mierzymy:**
  - okno asystenta na telefonie wypełnia ekran i **nie przesuwa się** przy otwarciu klawiatury,
  - kursor po tapnięciu w pole stoi w polu — bez skoków po pierwszym znaku,
  - w trybie rozmowy na telefonie słychać ten sam głos, co po kliknięciu „czytaj",
  - odpowiedź na zwykłe „cześć" zużywa **istotnie mniej** tokenów niż 7734 z audytu,
  - administrator włącza i wyłącza follow-upy bez wdrożenia nowej wersji aplikacji,
  - **zachowanie merytoryczne asystenta pozostaje takie samo** — optymalizacje nie zmieniają treści
    jego instrukcji.

## 3. Historyjki użytkownika

- Jako użytkownik telefonu chcę, żeby asystent zajmował cały ekran i żeby klawiatura zabierała miejsce
  tylko wiadomościom — żeby nie tracić nagłówka i pola pisania.
- Jako użytkownik telefonu chcę, żeby po tapnięciu w pole kursor był w polu, a nie „gdzieś obok".
- Jako użytkownik rozmawiający głosowo chcę słyszeć głos, który wybrałem — niezależnie od tego, czy
  jestem przy komputerze, czy z telefonem w ręce.
- Jako właściciel systemu chcę, żeby proste „cześć" nie uruchamiało trzech wywołań modelu.
- Jako administrator chcę móc wyłączyć propozycje kolejnych pytań, gdy uznam, że nie są warte swoich
  tokenów — i włączyć je z powrotem jednym kliknięciem.
- Jako właściciel chcę mieć pewność, że cięcie kosztów **nie zmieniło** tego, co asystent ma wpisane
  w zasadach zachowania.

## 4. Kryteria akceptacji (testowalne)

**Okno na telefonie (Z1)**

- [x] **AC-1** — Given jestem na telefonie, when otwieram asystenta, then zajmuje on **całą szerokość
      i całą wysokość** ekranu (bez przyciemnionego tła po bokach i bez paska nad oknem).
- [x] **AC-2** — Given asystent jest otwarty, when tapnę w pole wiadomości i wysunie się klawiatura,
      then okno **nie przesuwa się w górę** — nadal wypełnia widoczny obszar ekranu, a miejsce oddaje
      wyłącznie obszar wiadomości.
- [x] **AC-3** — Given klawiatura jest otwarta, when patrzę na okno, then nagłówek jest widoczny u góry,
      a pole wiadomości tuż nad klawiaturą — żadne z nich nie jest przesłonięte ani wypchnięte poza ekran.
- [x] **AC-4** — Given klawiatura się chowa, when wracam do rozmowy, then okno płynnie odzyskuje pełną
      wysokość, bez przeskoku i bez pozostawionej pustej przestrzeni.
- [x] **AC-5** — Given tapnę w puste pole wiadomości, when pojawia się klawiatura, then kursor jest
      **w polu**, we właściwej wysokości, i nie zmienia położenia po wpisaniu pierwszego znaku.
- [x] **AC-6** — Given jestem na komputerze, when otwieram asystenta, then wygląda i zachowuje się jak
      dotąd (wyśrodkowane okno o ograniczonej szerokości, przyciemnione tło, zamykanie kliknięciem obok).
- [x] **AC-7** — Given właściciel pyta, co w kodzie „kombinuje" z kursorem, when kończymy wdrożenie,
      then dostaje **jednoznaczną odpowiedź**: czy zostały jakiekolwiek zabiegi dotyczące fokusu lub
      karetki, a jeśli tak — jakie i dlaczego.

**Lektor w trybie rozmowy (Z2)**

- [x] **AC-8** — Given ustawiłem lektora serwerowego, when uruchamiam tryb rozmowy **na telefonie**,
      then odpowiedzi asystenta czyta ten sam głos co po kliknięciu ikony „czytaj" — nie głos systemowy.
- [x] **AC-9** — Given jestem w trybie rozmowy, when asystent wypowiada kolejne odpowiedzi w tej samej
      sesji, then **każda** z nich idzie wybranym głosem (nie tylko pierwsza).
- [x] **AC-10** — Given lektor serwerowy jest niedostępny (brak konfiguracji, błąd sieci, odmowa
      odtwarzania), when asystent ma coś powiedzieć, then nadal odzywa się głosem przeglądarki —
      tryb rozmowy **nigdy nie milknie**.
- [x] **AC-11** — Given przerwałem wypowiedź asystenta, when zaczyna się kolejna, then nie słychać
      dwóch głosów naraz ani resztki poprzedniej wypowiedzi.

**Optymalizacja kosztów (Z3)**

- [x] **AC-12** — Given wysyłam zwykłe powitanie („cześć", „hej", „dzięki"), when asystent odpowiada,
      then w dzienniku diagnostycznym widać **mniej wywołań modelu** niż dotychczasowe trzy.
- [x] **AC-13** — Given wysyłam powitanie, when patrzę na rozbicie kosztu, then łączna liczba tokenów
      jest **istotnie niższa** niż 7734 z audytu, a różnicę da się wskazać w rozbiciu.
- [ ] **AC-14** — Given asystent wykonuje wiele poleceń pod rząd, when patrzę na kolumnę pamięci
      podręcznej w diagnostyce, then widać **odczyty**, a nie wyłącznie zapisy — czyli część promptu
      jest faktycznie ponownie wykorzystywana.
- [x] **AC-15** — Given polecenie jest zwykłą rozmową (nie prośbą o zmianę danych), when asystent
      je obsługuje, then nie wysyła do modelu katalogu akcji zapisu — a mimo to potrafi wykonać akcję,
      gdy okaże się, że jednak jest potrzebna.
- [x] **AC-16** — Given proszę o zmianę danych („dodaj zadanie…"), when asystent odpowiada, then
      **wszystko działa jak wcześniej** — akcja jest proponowana i wykonywalna.
- [x] **AC-17** — Given porównuję treść instrukcji dla modelu sprzed i po zmianie, when sprawdzam
      zasady zachowania asystenta, then **są identyczne** — optymalizacje nie ruszają treści promptów.

**Przełącznik follow-upów (Z3)**

- [x] **AC-18** — Given jestem administratorem, when otwieram konfigurację modeli, then widzę
      przełącznik propozycji kolejnych pytań wraz z wyjaśnieniem, że kosztują tokeny.
- [x] **AC-19** — Given wyłączam follow-upy, when asystent odpowiada, then pod odpowiedzią **nie ma**
      propozycji kolejnych pytań, a instrukcja wysyłana do modelu ich nie zamawia.
- [x] **AC-20** — Given włączam follow-upy z powrotem, when asystent odpowiada, then propozycje
      wracają — bez wdrażania nowej wersji aplikacji.
- [x] **AC-21** — Given zmieniam ten przełącznik, when sprawdzam dziennik zmian konfiguracji, then
      zmiana jest w nim odnotowana.
- [x] **AC-22** — Given wdrożenie właśnie się zakończyło i nikt nic nie zmieniał, when korzystam
      z asystenta, then follow-upy **działają jak dotąd** (wartość startowa nie zmienia zachowania).

## 5. Zakres

**W zakresie:**

- Z1 — okno asystenta na pełny ekran na telefonie, przypięte do widocznego obszaru (klawiatura zmniejsza
  obszar wiadomości), zachowanie na komputerze bez zmian; wyjaśnienie sprawy kursora.
- Z2 — lektor serwerowy działający w trybie rozmowy również na telefonie, z zachowanym zejściem na głos
  przeglądarki, gdy się nie uda.
- Z3 — optymalizacje **P1, P2 i P4** z raportu „Asystent — audyt zużycia tokenów (2026-07-28)":
  poprawa wykorzystania pamięci podręcznej promptu, pominięcie zbędnych wywołań przy zwykłej uprzejmości,
  niewysyłanie katalogu akcji, gdy polecenie na pewno jest rozmową.
- Z3 — przełącznik follow-upów w konfiguracji modeli (administrator), z odnotowaniem zmiany.

**Poza zakresem (świadomie):**

- **P3 i P5 z raportu** (skrócenie bloku zasad agenta i promptu klasyfikatora) — to jedyne propozycje,
  które **zmieniają treść instrukcji**, a więc mogą zmienić zachowanie asystenta. Raport oznaczył je
  jako ryzykowne; zostają do osobnej decyzji.
- Zmiana zachowania okna asystenta na komputerze.
- Przepisanie trybu rozmowy głosowej ponad naprawę doboru głosu.
- Nowe ustawienia kosztowe poza przełącznikiem follow-upów.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego sluga. Przełącznik follow-upów pod `module.admin` (konfiguracja
  modeli); reszta to zachowanie okna asystenta dostępnego dla zalogowanych.
- **Własność danych:** bez zmian. Przełącznik follow-upów jest ustawieniem **systemowym** (jedno dla
  całej instalacji), nie per użytkownik — tak jak pozostałe ustawienia modeli.
- **Asystent AI:** brak nowych akcji i narzędzi. Zmienia się **ścieżka wywołań** (ile razy pytamy model)
  oraz **złożenie** promptu, ale **nie jego treść** (AC-17).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-10, C-11, C-14** — ustawienie follow-upów zaseedowane idempotentną migracją SQL z unikalnym,
  sekwencyjnym numerem.
- **C-12** — wartość przełącznika jako tekst/flaga bez enumów Prisma.
- **C-13** — weryfikacja wyłącznie na lokalnym Postgresie.
- **C-20** — zapis ustawienia jako Server Action z `revalidatePath`.
- **C-25** — zmiana ustawienia trafia do dziennika zmian konfiguracji (AC-21).
- **C-30, C-31** — **C-31 jest tu regułą wiodącą**: pełny ekran, `env(safe-area-inset-bottom)`,
  zachowanie przy klawiaturze; kolory wyłącznie ze zmiennych CSS.
- **C-32** — teksty po polsku.
- **C-40** — dobór modeli nadal po stronie konfiguracji; optymalizacje nie przestawiają przypisań.
- **C-51** — przyczyna problemu z lektorem na telefonie oraz mechanizm przypięcia okna do widocznego
  obszaru trafiają do `doświadczenia.md`.
- **C-53** — korzystamy z istniejących mechanizmów (konfiguracja systemowa, wskaźnik kosztu, istniejący
  strażnik intencji odczytu) zamiast budować nowe byty.

## 8. Otwarte pytania / decyzje właściciela

Pytania zadano na etapie `/specify` (C-55). Właściciel nie odpowiedział — zgodnie z jego stałą
instrukcją („odpowiedz albo pozwól przyjąć rekomendowane domyślne") **przyjęto warianty rekomendowane**:

- [x] **Zakres optymalizacji** — **P1 + P2 + P4**, czyli wyłącznie te, które **nie ruszają treści
      promptów**. P3 i P5 (skracanie instrukcji) świadomie poza zakresem — raport wskazał je jako
      jedyne ryzykowne dla zachowania asystenta.
- [x] **Follow-upy** — przełącznik w **konfiguracji modeli** (tam, gdzie zarządza się kosztem),
      wartość startowa **włączone**, żeby wdrożenie samo z siebie niczego nie wygasiło.
- [x] **Okno na telefonie** — **pełny ekran**, bez zaokrąglonej góry, uchwytu i przyciemnionego tła
      (wzorzec z ChatGPT/Claude wskazany w zgłoszeniu). Na komputerze bez zmian.

Założenia przyjęte samodzielnie:

- Przełącznik follow-upów jest systemowy (jedna wartość dla instalacji), bo dotyczy kosztu ponoszonego
  przez właściciela, a nie preferencji pojedynczego konta.
- Wyjaśnienie sprawy kursora (AC-7) trafia do podsumowania dla właściciela **oraz** do
  `doświadczenia.md`, żeby nie trzeba było go odtwarzać przy kolejnym zgłoszeniu.

## 9. Ryzyka

- **Przypięcie okna do widocznego obszaru** — mechanizm bywa kapryśny między przeglądarkami; źle zrobiony
  daje migotanie albo okno „uciekające" przy przewijaniu. → Zachowanie na komputerze pozostaje
  nietknięte, a rozwiązanie ma degradować się do dzisiejszego, gdy przeglądarka nie udostępnia
  potrzebnych informacji.
- **Pominięcie wywołań przy powitaniu** — zbyt szeroki strażnik mógłby przechwycić polecenie, które
  naprawdę czegoś dotyczy („cześć, dodaj mleko"). → Strażnik obejmuje **wyłącznie** czystą uprzejmość
  bez żadnej dodatkowej treści; AC-16 pilnuje, że polecenia zmiany działają jak wcześniej.
- **Niewysyłanie katalogu akcji przy rozmowie** — jeśli klasyfikacja się pomyli, asystent nie mógłby
  zaproponować akcji. → Wymagana ścieżka odwrotu: gdy okaże się, że akcja jednak jest potrzebna,
  polecenie idzie ponownie z pełnym katalogiem (AC-15).
- **Zmiana układu pamięci podręcznej** — źle podzielony prompt potrafi pogorszyć sprawę (same zapisy).
  → AC-14 wymaga **zmierzonych odczytów**, a nie deklaracji; sprawdzamy to na realnych danych.
- **Pokusa „przy okazji" skrócenia promptu** — P3/P5 są kuszące i proste. → AC-17 wprost tego zabrania:
  treść instrukcji przed i po musi być identyczna.
- **Odblokowanie dźwięku na telefonie** — mechanizmy autoodtwarzania różnią się między systemami.
  → AC-10 wymaga, żeby przy każdej porażce nadal odzywał się głos przeglądarki; cisza jest niedopuszczalna.
