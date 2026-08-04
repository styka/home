# Spec: Wierne ikony pogody „teraz" + przeglądanie wszystkich nowych wiadomości na telefonie

- **ID:** 044-pogoda-ikony-i-wiadomosci-mobile
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-04
- **Moduł(y):** Pogoda (`/pogoda`), Wiadomości (`/wiadomosci`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

> **Feature parasolowy.** To jedno zgłoszenie właściciela obejmujące dwa niezależne moduły. Są tu
> świadomie razem, bo pochodzą z jednego przeglądu aplikacji i mają wspólny mianownik: **ekran mówi
> użytkownikowi co innego, niż jest naprawdę** (pogoda) albo **każe mu się domyślać, gdzie jest**
> (wiadomości). Części **A** i **B** są rozłączne i weryfikowalne osobno.

---

# CZĘŚĆ A — Pogoda: ikona i opis „Teraz" mają odpowiadać rzeczywistości

## A1. Problem / potrzeba
Właściciel zgłasza: **pada deszcz, a moduł Pogody pokazuje chmurkę i „82%"**. Kafel „Teraz"
opisuje bieżące warunki wyłącznie jednym, syntetycznym wskaźnikiem pogody dostarczanym przez
dostawcę prognozy. Ten wskaźnik potrafi się rozminąć z faktycznym opadem — model może raportować
„pochmurno", gdy w tej samej chwili notuje opad. Do tego liczba procentowa obok ikony jest
**maksimum dla całego dnia**, a nie szansą opadu teraz, więc czytana z ikoną tworzy trzeci,
nieprawdziwy komunikat. Osobno: warianty nocne ikon istnieją tylko dla pogody bezchmurnej
i częściowo pochmurnej — pozostałe stany wyglądają w nocy tak samo jak w dzień, mimo że kafel zna
porę doby.

Skutek: użytkownik przestaje ufać pierwszemu, najważniejszemu kafelkowi modułu.

## A2. Cel i miary sukcesu
- **Cel:** kafel „Teraz" (ikona + opis + liczby) opisuje **rzeczywiste, bieżące** warunki i porę doby.
- **Sukces mierzymy:**
  - gdy w danej chwili notowany jest opad, kafel „Teraz" pokazuje opad (ikona **i** słowny opis) —
    nigdy samą chmurę;
  - żadna liczba przy kafelku nie da się odczytać jako „szansa opadu teraz", jeśli nią nie jest;
  - po zmroku żaden element pogodowy nie pokazuje słońca.

## A3. Historyjki użytkownika
- Jako użytkownik chcę **jednym spojrzeniem** wiedzieć, czy pada, żeby nie sprawdzać przez okno.
- Jako użytkownik chcę widzieć **jak bardzo** pada teraz i jaka jest szansa opadu w najbliższej
  godzinie, żeby zdecydować, czy wyjść.
- Jako użytkownik chcę, żeby każda liczba przy kafelku miała **jawny podpis czasowy** („teraz" /
  „dziś"), żeby jej nie mylić.
- Jako użytkownik chcę, żeby ikony **po zmroku** wyglądały jak noc, żeby ekran nie sugerował słońca
  o 23:00.

## A4. Kryteria akceptacji (testowalne)
- [ ] **AC-A1** — Given w bieżących warunkach notowany jest opad (wartość opadu większa od zera),
      when otwieram `/pogoda`, then kafel „Teraz" pokazuje ikonę opadu i opis mówiący o opadzie —
      **nawet jeśli** syntetyczny wskaźnik pogody dostawcy mówi „pochmurno"/„bezchmurnie".
- [ ] **AC-A2** — Given bieżące warunki nie zawierają opadu, when otwieram `/pogoda`, then opis
      i ikona odpowiadają wskaźnikowi pogody dostawcy (zachowanie dotychczasowe, bez regresji).
- [ ] **AC-A3** — Given kafel „Teraz" pokazuje wartości procentowe, when je czytam, then każda
      z nich ma jednoznaczny podpis rozróżniający **„teraz / najbliższa godzina"** od **„dziś (maks.)"**.
- [ ] **AC-A4** — Given w danej chwili faktycznie pada, when patrzę na kafel „Teraz", then widzę
      **ilość opadu** w bieżącej godzinie (jednostka jawna), a nie wyłącznie wartość procentową.
- [ ] **AC-A5** — Given jest noc (dostawca raportuje porę nocną), when patrzę na kafel „Teraz"
      i na pasek najbliższych godzin, then **żadna** ikona nie zawiera słońca; stany, które w nocy
      wyglądają inaczej niż w dzień (bezchmurnie, niemal bezchmurnie, częściowe zachmurzenie,
      przelotne opady), mają odrębny wariant nocny.
- [ ] **AC-A6** — Given patrzę na prognozę **dzienną** (najbliższe dni), when oglądam ikony, then są
      to warianty dzienne — podsumowanie całej doby nie może być nocne.
- [ ] **AC-A7** — Given dostawca nie zwrócił danych o opadzie (pole nieobecne), when otwieram
      `/pogoda`, then strona działa normalnie i zachowuje się jak przed zmianą — brak danych nigdy
      nie może wywołać błędu ani pustego kafelka.
- [ ] **AC-A8** — Given warunki w danej chwili opisuje asystent AI lub czujka („czy pada?"),
      when korzysta z opisu pogody, then otrzymuje **ten sam** skorygowany opis co ekran — jedno
      źródło prawdy, bez rozjazdu ekran ⇄ AI.

## A5. Zakres (część A)
**W zakresie:**
- Wyznaczanie ikony i słownego opisu bieżących warunków **z pełnych parametrów** (opad, rodzaj
  opadu, pora doby), a nie z samego syntetycznego wskaźnika.
- Rozróżnienie i podpisanie wartości „teraz / najbliższa godzina" vs „dziś (maks.)"; pokazanie
  ilości opadu, gdy pada.
- Uzupełnienie wariantów nocnych tam, gdzie noc faktycznie wygląda inaczej niż dzień.
- Spójność opisu warunków między ekranem, czujkami i asystentem AI.

**Poza zakresem (świadomie):**
- Zamiana emoji na wektorowy zestaw ikon (odrzucone przez właściciela — nowa zależność, duża zmiana).
- Zmiana dostawcy prognozy, radar opadów, mapy opadowe, powiadomienia „zaraz zacznie padać".
- Przebudowa sekcji „Co robić?", czujek i biblioteki pomysłów.

---

# CZĘŚĆ B — Wiadomości: wygodne przeglądanie wszystkich nowych wiadomości na telefonie

## B1. Problem / potrzeba
Właściciel: *„Z wiadomości na mobile korzysta się niewygodnie"*. Dziś moduł pokazuje **jeden temat
naraz** — żeby przejrzeć nowe wiadomości po odświeżeniu, trzeba ręcznie przełączać temat po temacie
i za każdym razem czekać na wczytanie. Nie da się po prostu **przewijać** i przeczytać wszystkiego,
a jednocześnie wiedzieć, z jakiego tematu jest dana wiadomość. Lektor działa wyłącznie na
pojedynczej wiadomości, więc odsłuch całej porcji wymaga tylu kliknięć, ile jest wiadomości.

## B2. Cel i miary sukcesu
- **Cel:** po odświeżeniu źródeł właściciel przegląda **wszystkie** nowe wiadomości jednym
  przewijaniem, przez cały czas wiedząc, z jakiego są tematu, i może ich **słuchać** na dowolnym
  poziomie: pojedyncza wiadomość, cały temat, cały strumień.
- **Sukces mierzymy:**
  - przeczytanie wszystkich nowych wiadomości nie wymaga **żadnego** przełączania tematu;
  - w każdym momencie przewijania na ekranie widać nazwę tematu, którego dotyczy widoczna wiadomość;
  - skok do wybranego tematu to **jedno** dotknięcie (lub jedno przesunięcie palcem);
  - uruchomienie odsłuchu całej porcji nowych wiadomości to **jedno** dotknięcie.

## B3. Historyjki użytkownika
- Jako użytkownik na telefonie chcę **przewijać** i czytać wszystkie nowe wiadomości ze wszystkich
  moich tematów, żeby nadrobić poranek bez klikania po zakładkach.
- Jako użytkownik chcę **zawsze widzieć**, z jakiego tematu jest wiadomość, na którą właśnie patrzę.
- Jako użytkownik chcę **kliknąć temat** i zostać przewiniętym do jego wiadomości (a nie przeładować
  cały widok).
- Jako użytkownik chcę **przesunąć palcem w bok**, żeby przeskoczyć do sąsiedniego tematu.
- Jako użytkownik chcę **włączyć lektora** na trzech poziomach — jednej wiadomości, całego tematu
  albo całego strumienia — żeby słuchać dokładnie tyle, ile chcę.
- Jako użytkownik chcę **jednym gestem zamknąć** nadrobiony temat („oznacz wszystkie w temacie jako
  przeczytane"), żeby nie odklikiwać każdej wiadomości osobno.
- Jako użytkownik chcę, żeby nic **nie znikało samo** — dopóki nie powiem, że przeczytałem.

## B4. Kryteria akceptacji (testowalne)
**Strumień i orientacja w temacie**
- [ ] **AC-B1** — Given mam kilka tematów z nowymi wiadomościami, when wchodzę na `/wiadomosci`,
      then mogę przejrzeć **wszystkie** nowe wiadomości ze **wszystkich** tematów samym przewijaniem,
      bez przełączania tematu.
- [ ] **AC-B2** — Given przewijam strumień, when na ekranie widoczne są wiadomości danego tematu,
      then nazwa tego tematu jest **stale widoczna** u góry i zmienia się samoczynnie przy przejściu
      do wiadomości kolejnego tematu.
- [ ] **AC-B3** — Given przewijam strumień, when zmienia się widoczny temat, then wskazanie tematu
      w pasku/selektorze wyboru **podąża** za tym, co widać (bez mojego kliknięcia).
- [ ] **AC-B4** — Given jestem w dowolnym miejscu strumienia, when wybieram inny temat (dotknięciem
      w pasku lub w rozwijanym selektorze), then ekran **przewija się** do pierwszej wiadomości tego
      tematu; widok nie jest przeładowywany od zera.
- [ ] **AC-B5** — Given jestem na telefonie w strumieniu, when przesuwam palcem w lewo/prawo,
      then przechodzę odpowiednio do następnego/poprzedniego tematu (z przewinięciem jak w AC-B4);
      gest **nie może** blokować ani przechwytywać zwykłego przewijania w pionie.
- [ ] **AC-B6** — Given temat nie ma nowych wiadomości, when przeglądam strumień, then jest to
      widoczne (temat oznaczony jako pusty), a nie mylące „zniknięcie" tematu.
- [ ] **AC-B7** — Given nie mam żadnych nowych wiadomości, when wchodzę na `/wiadomosci`,
      then widzę jasny komunikat z podpowiedzią, żeby odświeżyć źródła (bez pustego ekranu).

**Lektor na trzech poziomach**
- [ ] **AC-B8** — Given patrzę na pojedynczą wiadomość, when włączam lektora **przy tej wiadomości**,
      then czytana jest tylko ona (zachowanie dotychczasowe, bez regresji).
- [ ] **AC-B9** — Given jestem w danym temacie, when włączam lektora **dla tematu**, then czytane są
      po kolei wszystkie nowe wiadomości tego tematu i lektor sam przechodzi do następnej.
- [ ] **AC-B10** — Given jestem w strumieniu, when włączam lektora **dla całego strumienia**,
      then czytane są po kolei wszystkie nowe wiadomości ze wszystkich tematów, a **zmiana tematu
      jest zapowiadana** słownie.
- [ ] **AC-B11** — Given lektor czyta, when patrzę na ekran, then widok **podąża** za czytanym
      fragmentem (przewija się do niego), a czytany fragment jest wyróżniony.
- [ ] **AC-B12** — Given lektor czyta w trybie tematu lub strumienia, when korzystam ze sterowania,
      then mam do dyspozycji: pauzę/wznowienie, poprzednie/następne **zdanie**, przeskok o całą
      **wiadomość** oraz zatrzymanie; stan (która wiadomość / które zdanie) jest widoczny.
- [ ] **AC-B13** — Given lektor czyta, when opuszczam stronę, przełączam widok albo zatrzymuję
      odczyt, then mowa **milknie** i nie wznawia się sama.

**Stan „przeczytane"**
- [ ] **AC-B14** — Given przewijam wiadomości lub słucham ich lektorem, when nie klikam nic więcej,
      then **żadna** wiadomość nie znika z listy nowych samoczynnie.
- [ ] **AC-B15** — Given nadrobiłem temat, when używam akcji „oznacz wszystkie w temacie jako
      przeczytane", then wszystkie nowe wiadomości **tylko tego** tematu znikają ze strumienia,
      a pozostałe tematy zostają nienaruszone.
- [ ] **AC-B16** — Given nadrobiłem całą porcję, when używam akcji zbiorczej dla całego strumienia,
      then wszystkie nowe wiadomości ze wszystkich tematów zostają oznaczone jako przeczytane;
      akcja wymaga **potwierdzenia**, bo jest masowa i nieodwracalna z poziomu ekranu.
- [ ] **AC-B17** — Given oznaczam pojedynczą wiadomość jako przeczytaną/odrzuconą w strumieniu,
      when akcja się wykona, then znika tylko ona, a **pozycja przewijania** pozostaje przy
      wiadomości, którą właśnie czytałem (ekran nie skacze na górę).

**Zgodność z resztą modułu**
- [ ] **AC-B18** — Given korzystam z modułu na desktopie, when otwieram `/wiadomosci`, then nowy
      strumień działa tak samo (jedna nawigacja dla telefonu i desktopu — bez osobnego układu).
- [ ] **AC-B19** — Given korzystam z filtra źródeł oraz z przełącznika „Nowe wiadomości ⇄ Linia
      czasu", when przechodzę na strumień, then te funkcje **nadal działają** i nie ma regresji
      w zakładkach „Gorące tematy" i „Źródła".
- [ ] **AC-B20** — Given wybrałem temat lub tryb przeglądania, when odświeżam stronę albo wracam do
      niej z innego widoku, then mój wybór **zostaje zachowany** (zgodnie z tym, jak moduł już dziś
      trzyma zakładkę widoku w adresie).

## B5. Zakres (część B)
**W zakresie:**
- Ciągły strumień nowych wiadomości ze wszystkich tematów, z trwale widoczną etykietą tematu.
- Dwukierunkowa synchronizacja „przewijanie ⇄ wybór tematu" oraz przewijanie do tematu po jego
  wybraniu.
- Przesuwanie palcem w bok jako skrót skoku między tematami (nie kolidujące z przewijaniem).
- Lektor na trzech poziomach: wiadomość / temat / cały strumień, z zapowiedzią zmiany tematu
  i nawigacją zdanie ↔ wiadomość.
- Akcje zbiorcze „oznacz jako przeczytane": dla tematu i dla całego strumienia.
- Zachowanie dotychczasowego filtra źródeł, linii czasu i zakładek modułu.

**Poza zakresem (świadomie):**
- Zmiany w pobieraniu i klasyfikacji wiadomości (jeden przebieg odświeżania zostaje bez zmian).
- Zmiany w linii czasu, gorących tematach, źródłach i historii kosztów odświeżeń.
- Powiadomienia push o nowych wiadomościach, harmonogram automatycznego odświeżania.
- Automatyczne oznaczanie jako przeczytane (odrzucone przez właściciela).
- Nowa własność danych, współdzielenie tematów z zespołem, offline.

---

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — `module.weather` i `module.news` już istnieją (C-22).
  Nie powstaje żaden nowy slug.
- **Własność danych:** bez zmian. Tematy, pozycje wiadomości i lokalizacje pogodowe pozostają
  **własnością użytkownika** w dotychczasowym modelu; feature nie wprowadza własności zespołowej
  (C-21). Akcje zbiorcze muszą respektować ten sam guard co akcje pojedyncze — użytkownik może
  oznaczyć **wyłącznie** swoje pozycje.
- **Asystent AI:** nowa `AIAction` **nie jest wymagana** — feature nie dokłada nowych mutacji
  dostępnych dla asystenta. **Ale** (AC-A8) skorygowany opis warunków pogodowych ma trafić także
  tam, gdzie asystent i czujki opisują pogodę, żeby ekran i AI nie mówiły dwóch różnych rzeczy.
  Jeżeli w trakcie planu okaże się, że powstaje nowa akcja mutująca lub odczytowa, obowiązuje
  C-23 (egzekutor + wpis w manifeście pokrycia).
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Oznaczenie wiadomości jako przeczytanej to
  zmiana statusu, a nie usunięcie — trash tu nie wchodzi (C-24 bez zastosowania). Zbiorcze
  oznaczanie musi jednak wymagać potwierdzenia (AC-B16), bo jest nieodwracalne z poziomu ekranu.
- **Koszt AI:** feature **nie dokłada** żadnego nowego wywołania modelu. Lektor korzysta
  z istniejącej ścieżki odczytu na głos; strumień i ikony pogody są czysto prezentacyjne.

## 7. Zgodność z konstytucją
- **C-01 / C-02** — cały kod w `worldofmag/`, importy przez alias `@/*`.
- **C-12** — jeśli powstanie jakikolwiek nowy stan/rodzaj (np. poziom lektora, tryb przeglądania),
  to **String + union TypeScript**, nigdy enum Prisma.
- **C-10 / C-11** — feature jest z założenia **bez zmian w schemacie**; gdyby plan wykazał
  konieczność nowej kolumny (np. zapamiętanie trybu przeglądania), wymaga ręcznego pliku migracji
  z numerem z `npm run next:migration`.
- **C-20** — akcje zbiorcze „oznacz jako przeczytane" to Server Actions z `revalidatePath()`.
- **C-21** — dostęp do pozycji liczony jak dotąd, przez właściciela tematu; akcja zbiorcza nie może
  być szerszym wektorem niż akcja pojedyncza.
- **C-23** — gdyby powstała nowa `AIAction`, musi mieć egzekutor; każda nowa Server Action wymaga
  wpisu w manifeście pokrycia AI i deklaracji kontroli dostępu (bramki w `build`).
- **C-30** — kolory ikon, podświetleń i przyklejonego nagłówka **wyłącznie** przez zmienne CSS;
  żadnych hexów. Kafel pogodowy już dziś używa tokenów akcentów — nowe stany też muszą.
- **C-31** — to jest **rdzeń** części B: mobile-first, cel dotyku `py-3`, sterowanie lektora
  w zasięgu kciuka i ponad `env(safe-area-inset-bottom)`, jedna nawigacja dla telefonu i desktopu,
  gest przesunięcia nie może psuć przewijania.
- **C-32** — wszystkie teksty i zapowiedzi lektora po polsku.
- **C-50 / C-51** — „gotowe" = zielony `npm run build` (do kroku `next build`, nigdy przeciw prod DB
  — C-13); oba naprawiane błędy trafiają jako wpisy do `doświadczenia.md`.
- **C-53** — minimalizm: **żadnej** nowej zależności (odrzucony zestaw ikon SVG; gest przesunięcia
  i przyklejony nagłówek realizujemy środkami, które repo już ma). Rozbudowujemy istniejące
  komponenty zamiast tworzyć równoległy moduł.

## 8. Otwarte pytania / decyzje właściciela
Zebrane w jednym momencie pytań (C-55) — **wszystkie rozstrzygnięte**, brak otwartych pozycji.

- [x] **D-1 — Zakres poprawki pogody:** *pełna korekta z parametrów + warianty nocne.* Ikona i opis
      „Teraz" liczone z faktycznych parametrów (opad, rodzaj opadu, pora doby), rozdzielenie
      „teraz" od „dziś (maks.)", warianty nocne tam, gdzie noc wygląda inaczej.
      **Odrzucono:** samą poprawkę nocnych ikon (nie rozwiązuje zgłoszenia) oraz zestaw ikon SVG
      (nowa zależność, sprzeczne z C-53).
- [x] **D-2 — Model przeglądania wiadomości:** *strumień **i** przesuwanie palcem.* Ciągły strumień
      z przyklejonym nagłówkiem tematu jako podstawa, a gest w bok jako **skrót** skoku do
      sąsiedniego tematu. Właściciel świadomie wybrał wariant bogatszy niż rekomendowany —
      wynika z tego wymóg, żeby gest **nie kolidował** z przewijaniem (AC-B5) i żeby był
      dodatkiem, a nie jedyną drogą (skok tematem musi działać też dotknięciem — AC-B4).
- [x] **D-3 — Zasięg lektora:** *trzy poziomy — wiadomość, temat, cały strumień.* Odpowiedź
      właściciela poszerzyła rekomendację (która obejmowała wiadomość + strumień) o poziom
      **tematu**. Wszystkie trzy poziomy są wymagane (AC-B8…B10).
- [x] **D-4 — Znikanie z listy „nowe":** *ręcznie + akcje zbiorcze.* Nic nie znika samo — ani przy
      przewijaniu, ani po odczytaniu przez lektora (AC-B14). Dochodzą „oznacz temat" i „oznacz
      wszystkie" (AC-B15, AC-B16).

**Założenia przyjęte samodzielnie** (nie wymagały pytania, rozstrzygnięte wzorcem sąsiedniego modułu
i minimalizmem C-53):
- **Z-1** — Strumień jest **domyślnym** trybem przeglądania nowych wiadomości; dotychczasowy widok
  jednego tematu zostaje osiągalny (żeby nie odbierać funkcji skupienia na jednym temacie), a wybór
  trybu przeżywa odświeżenie strony w ten sam sposób, w jaki moduł już trzyma zakładkę widoku.
- **Z-2** — Strumień obejmuje **nowe** wiadomości (te, które dziś widnieją w „Nowe wiadomości").
  Linia czasu pozostaje per temat — jest do nadrabiania kontekstu, nie do przeglądania porcji.
- **Z-3** — Kolejność w strumieniu: tematy w kolejności, w jakiej użytkownik je widzi na liście
  tematów; wiadomości wewnątrz tematu — od najnowszej, jak dziś.
- **Z-4** — Filtr źródeł działa **na cały strumień** (jest już dziś ustawieniem użytkownika, nie
  właściwością tematu).
- **Z-5** — Część A nie zmienia sposobu pobierania prognozy poza dociągnięciem parametrów bieżących,
  które ten sam dostawca udostępnia w tym samym zapytaniu — bez nowego wywołania sieciowego.

## 9. Ryzyka
- **R-1 — Gest przesunięcia zjada przewijanie.** Najczęstszy błąd tego wzorca na telefonie: poziomy
  gest przechwytuje ruch palca i pionowe przewijanie zaczyna „przeskakiwać". *Ograniczamy:* AC-B5
  wprost tego zabrania; gest ma być dodatkiem do dotknięcia tematu (AC-B4), więc w razie problemów
  z ergonomią da się go wyciszyć bez utraty funkcji.
- **R-2 — Pętla „przewijanie ↔ wybór tematu".** Skok do tematu zmienia przewijanie, a przewijanie
  zmienia wskazany temat — łatwo o zapętlenie albo „uciekający" wybór. *Ograniczamy:* AC-B3 i AC-B4
  opisują oba kierunki osobno, więc `/verify` sprawdzi je niezależnie.
- **R-3 — Cały strumień to więcej danych naraz.** Wczytanie wiadomości ze wszystkich tematów jest
  cięższe niż jednego tematu. *Ograniczamy:* to te same dane, które użytkownik i tak by wczytał,
  przechodząc temat po temacie; jeśli plan wykaże realny problem z ilością, rozwiązaniem jest
  doczytywanie kolejnych tematów przy przewijaniu — **nie** rezygnacja ze strumienia.
- **R-4 — Lektor ciągły a limity syntezy mowy na telefonie.** Długi łańcuch zdań bywa przerywany
  przez system (szczególnie na iOS). *Ograniczamy:* korzystamy z istniejącej, sprawdzonej ścieżki
  lektora (zdanie po zdaniu, łańcuch po zakończeniu zdania); AC-B12 wymaga widocznego stanu,
  więc przerwanie jest rozpoznawalne i da się wznowić.
- **R-5 — Korekta ikony pogody „na siłę".** Zbyt agresywna korekta mogłaby pokazywać deszcz przy
  śladowej, nieistotnej wartości opadu. *Ograniczamy:* AC-A2 wymaga braku regresji przy zerowym
  opadzie, a AC-A4 każe pokazać **ilość** — użytkownik widzi wtedy, jak bardzo pada, i sam ocenia.
- **R-6 — Rozjazd ekran ⇄ asystent AI.** Skorygowany opis pogody użyty tylko na ekranie sprawiłby,
  że asystent nadal mówiłby „pochmurno". *Ograniczamy:* AC-A8 wymaga jednego źródła prawdy.
