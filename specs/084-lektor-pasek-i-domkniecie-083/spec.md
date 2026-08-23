# Spec: Lektor, pasek widoku i domknięcie listy z przebiegu 083

- **ID:** 084-lektor-pasek-i-domkniecie-083
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-23
- **Moduł(y):** Wiadomości + kontrakt widoku (powłoka, dotyczy wszystkich modułów)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Dwie sprawy naraz, w tej kolejności — tak jak prosi właściciel.

**Po pierwsze, dług z przebiegu 083.** Tamten przebieg świadomie odłożył trzy grupy zgłoszeń
(lektor, gorące tematy, jakość treści AI), żeby najpierw postawić fundament: chrom, koszty
i nawigację. Fundament stoi i pojechał na produkcję — ale odłożone grupy nadal są tym, o co
właściciel prosił, a nie dostał. Zostawianie ich na „kiedyś" zamienia świadomy podział na cichą
utratę zakresu.

**Po drugie, cztery usterki z testów właściciela na produkcji.** Lektor w ogóle nie gra („niby leci
a nie słyszę"). Drop-down tematu **zawęża widok** zamiast po prostu do niego przeskoczyć — czyli
robi coś innego, niż właściciel chciał. Gwiazdka ulubionych i wskaźnik świeżości odbierają szerokość
zakładkom modułu w **każdym** module. A na telefonie pasek Wiadomości rozpycha stronę tak, że trzeba
przewijać ją w bok — to jest błąd twardy (C-31), nie kwestia gustu.

## 2. Cel i miary sukcesu

- **Cel:** lista zgłoszeń z 083 jest domknięta w całości, a cztery usterki z testów naprawione —
  moduł Wiadomości daje się obsłużyć jedną ręką na telefonie i posłuchać bez patrzenia na ekran.
- **Sukces mierzymy:**
  - lektor **wydaje dźwięk** na telefonie właściciela albo mówi wprost, dlaczego nie może — cisza
    bez wyjaśnienia jest niedopuszczalna,
  - strona **nigdy** nie przewija się w poziomie na szerokości 360–390 px (pomiar, nie wrażenie),
  - wybrana nazwa tematu jest **czytelna** w pasku na telefonie,
  - żadna wiadomość nie zostaje bez streszczenia z powodu jednej nieudanej próby,
  - propozycja gorącego tematu, którą już monitorujesz albo odrzuciłeś, **nie wraca** na listę.

## 3. Historyjki użytkownika

- Jako czytający chcę **włączyć lektora i odłożyć telefon**, żeby przesłuchać porcję wiadomości
  w drodze — bez patrzenia w ekran i bez czytania tego samego tekstu drugi raz w osobnym okienku.
- Jako czytający chcę **widzieć, którą wiadomość lektor właśnie czyta**, w miejscu tej wiadomości,
  a nie w oderwanym od niej pudełku.
- Jako czytający chcę **przeskoczyć do tematu**, który mnie interesuje, **nie tracąc z oczu
  pozostałych** — bo po to mam jeden strumień.
- Jako użytkownik telefonu chcę, żeby **strona nie jeździła na boki** i żeby nazwy zakładek dało się
  przeczytać.
- Jako użytkownik dowolnego modułu chcę, żeby **filtry modułu miały całą szerokość paska**, a rzeczy
  powłoki nie zabierały im miejsca.
- Jako czytający chcę, żeby **tytuły były po polsku** tak jak streszczenia, i żeby brak streszczenia
  nie zdarzał się z powodu jednej nieudanej próby.
- Jako czytający chcę **zarządzać tym, co monitoruję i co odrzuciłem**, i nie oglądać w propozycjach
  tematów, które już mam.

## 4. Kryteria akceptacji (testowalne)

### A. Lektor — usterka odtwarzania *(zgłoszenie 1, część nowa)*

- [ ] **AC-1** — Given telefon, na którym głos serwerowy jest niedostępny albo zawodzi, when
      użytkownik uruchomi lektora **jednym dotknięciem**, then słychać głos systemowy urządzenia.
- [ ] **AC-2** — Given sytuacja, w której **żadna** droga odtwarzania nie zadziała, when użytkownik
      uruchomi lektora, then na ekranie pojawia się zrozumiały komunikat, **co** nie zadziałało —
      lektor nigdy nie pokazuje, że „leci", gdy nie ma dźwięku.
- [ ] **AC-3** — Given przejście z głosu serwerowego na systemowy w trakcie odsłuchu, when zmiana
      nastąpi, then odsłuch **trwa dalej** od tego samego miejsca, a użytkownik dowiaduje się
      o zmianie głosu raz, nie przy każdym zdaniu.

### B. Lektor — UX odsłuchu *(grupa E z listy 083: E1–E6)*

- [ ] **AC-4** — Given włączony lektor, when użytkownik przewija stronę, then sterowanie lektorem
      jest **przyklejone do dołu ekranu** i pozostaje dostępne przez cały czas.
- [ ] **AC-5** — Given włączony lektor, when użytkownik patrzy na ekran, then **nie ma** osobnej
      sekcji powtarzającej treść wiadomości gołym tekstem — czytany fragment jest podświetlony
      **w karcie tej wiadomości**.
- [ ] **AC-6** — Given lista wiadomości, when użytkownik chce włączyć podążanie za czytanym tekstem,
      then przełącznik jest **przy wiadomościach**, a nie schowany w ustawieniach lektora.
- [ ] **AC-7** — Given włączone podążanie, when użytkownik **sam** przewinie stronę, then podążanie
      wyłącza się samo i widok zostaje tam, gdzie użytkownik go zostawił.
- [ ] **AC-8** — Given odsłuch kilku wiadomości pod rząd, when lektor kończy jedną i zaczyna
      następną, then między nimi jest **słyszalna przerwa**, a nie sklejenie w jedno zdanie.
- [ ] **AC-9** — Given kolejne wiadomości, when lektor je czyta, then **przed tytułem** zapowiada
      źródło, ale **nie powtarza** nazwy dla kolejnych wiadomości z tego samego portalu pod rząd.
- [ ] **AC-10** — Given porcja wiadomości, when użytkownik chce ją odsłuchać albo zamknąć w całości,
      then „słuchaj" i „oznacz wszystkie jako przeczytane" są **rozróżnialne** i nie da się kliknąć
      jednego, mierząc w drugie.

### C. Nawigacja po tematach *(zgłoszenie 2 — odwrócenie decyzji z 083)*

- [ ] **AC-11** — Given widok Wiadomości, when użytkownik wybierze temat z listy, then widok
      **przewija się** do sekcji tego tematu, a wiadomości **wszystkich pozostałych tematów zostają
      na ekranie**.
- [ ] **AC-12** — Given pasek nawigacji, when użytkownik na niego patrzy, then **nie ma** strzałek
      „poprzednia / następna grupa".
- [ ] **AC-13** — Given widok Wiadomości, when użytkownik go otworzy w dowolny sposób (wejście
      wprost, powrót, zapisany ulubiony widok), then **zawsze** widzi wiadomości ze wszystkich
      tematów — nie istnieje stan, w którym część tematów jest niewidoczna z powodu wyboru tematu.

### D. Pasek widoku w całej aplikacji *(zgłoszenie 3)*

- [ ] **AC-14** — Given dowolny moduł, when użytkownik patrzy na pasek widoku, then gwiazdka
      ulubionych, wskaźnik świeżości i ściągawka skrótów zajmują **miejsce jednej ikony**, a nie
      trzech.
- [ ] **AC-15** — Given ta sama sytuacja, when użytkownik potrzebuje którejś z tych rzeczy, then
      wszystkie są nadal dostępne **jednym dotknięciem** i żadna nie znika z aplikacji.
- [ ] **AC-16** — Given moduł z filtrami (Zadania, Wiadomości), when porównamy szerokość dostępną dla
      filtrów przed zmianą i po niej, then filtry mają **mierzalnie więcej** miejsca.

### E. Telefon *(zgłoszenie 4)*

- [ ] **AC-17** — Given szerokość ekranu 360 px, when użytkownik otworzy Wiadomości i przewinie
      stronę, then strona **nie przewija się w poziomie** w żadnym momencie.
- [ ] **AC-18** — Given ta sama szerokość, when użytkownik patrzy na wybór tematu, then **widzi
      nazwę wybranego tematu** (a nie sam skrawek).
- [ ] **AC-19** — Given ta sama szerokość, when użytkownik patrzy na zakładki modułu, then widzi
      **nazwy wszystkich trzech**, ewentualnie przewijając sam pasek zakładek — nigdy całą stronę.
- [ ] **AC-20** — Given ta sama szerokość, when użytkownik przełącza Wiadomości ⇄ Linia czasu, then
      przełącznik mieści się na ekranie.

### F. Jakość treści *(grupa D z listy 083)*

- [ ] **AC-21** — Given wiadomość, dla której pierwsza próba streszczenia się nie powiodła, when
      trwa odświeżanie, then podejmowana jest **automatyczna ponowna próba**, a użytkownik nie musi
      niczego klikać.
- [ ] **AC-22** — Given wiadomość ze źródła obcojęzycznego, when użytkownik czyta listę, then
      **tytuł jest po polsku**, tak samo jak streszczenie.
- [ ] **AC-23** — Given wiadomość, której mimo ponowienia nie udało się streścić, when użytkownik ją
      widzi, then wie, że streszczenia zabrakło — pozycja nie udaje kompletnej.

### G. Gorące tematy *(grupa F z listy 083)*

- [ ] **AC-24** — Given zakładka gorących tematów, when użytkownik ją otwiera, then układ jest ten
      sam co w pozostałych zakładkach modułu.
- [ ] **AC-25** — Given lista propozycji, when system ją buduje, then **pomija** propozycje pokryte
      przez temat, który użytkownik już monitoruje, oraz te wcześniej odrzucone.
- [ ] **AC-26** — Given propozycja, when użytkownik doda ją do monitorowanych, then **znika**
      z propozycji i pojawia się wśród monitorowanych tematów.
- [ ] **AC-27** — Given zakładka gorących tematów, when użytkownik chce zobaczyć, co monitoruje i co
      odrzucił, then obie listy są dostępne **stąd**, wraz z możliwością cofnięcia odrzucenia.

## 5. Zakres

**W zakresie — najpierw domknięcie długu z 083, potem usterki z testów:**

1. **Jakość treści (D1–D2):** automatyczne ponowienie nieudanego streszczenia, tłumaczenie tytułów.
2. **Lektor (E1–E6 + usterka odtwarzania):** przyklejenie do dołu, likwidacja osobnej sekcji
   z treścią, podświetlanie w karcie wiadomości, przełącznik podążania przy wiadomościach,
   automatyczne wyłączanie podążania po ręcznym przewinięciu, przerwa między pozycjami, zapowiedź
   źródła bez powtórzeń, uporządkowanie punktu wejścia obok „oznacz wszystkie", **diagnoza i naprawa
   braku dźwięku**.
3. **Gorące tematy (F1–F5):** układ zakładki, zarządzanie monitorowanymi i odrzuconymi, odsiewanie
   propozycji już pokrytych, przeniesienie dodanej propozycji do monitorowanych.
4. **Nawigacja po tematach:** drop-down jako **skok**, usunięcie strzałek, usunięcie zawężania
   widoku do jednego tematu.
5. **Pasek widoku:** zwinięcie chromu powłoki do jednej kontrolki — zmiana w **kontrakcie widoku**,
   więc obejmuje wszystkie moduły.
6. **Telefon:** układ paska Wiadomości bez poziomego przewijania strony.

**Poza zakresem (świadomie):**

- Zmiana modelu danych wiadomości, źródeł i tematów poza tym, czego wymagają powyższe punkty.
- Nowe akcje asystenta AI dla lektora i nawigacji.
- Osobny układ mobilny jako druga implementacja — obowiązuje jeden mechanizm na oba ekrany (C-31).
- Zmiana dostawcy syntezy mowy ani dokładanie nowego — pracujemy na tym, co konfiguruje `/admin/llm`.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — `module.news`; zmiana paska widoku nie dotyka uprawnień.
- **Własność danych:** bez nowych właścicieli. Ustawienia lektora (prędkość, podążanie) już należą
  do użytkownika; odrzucone tematy już są zapamiętane per przestrzeń.
- **Asystent AI:** nie dotyczy — bez nowych `AIAction`. Tłumaczenie tytułów i ponowienie streszczeń
  dzieją się w istniejącym zadaniu odświeżania, więc nie tworzą nowej powierzchni dla asystenta.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-31** — to jest oś zgłoszenia 4. Poziome przewijanie strony na telefonie jest naruszeniem tej
  reguły wprost, a nie niedogodnością. Cele dotyku `py-3` obowiązują też nowe menu chromu.
- **C-33** — zwinięcie gwiazdki, świeżości i skrótów to zmiana **ramy**, nie wyjątek w module.
  Rama ma zostać poszerzona raz, dla wszystkich dwudziestu widoków; wyjątek w Wiadomościach byłby
  długiem w pozostałych.
- **C-32** — wszystkie nowe teksty (komunikat o głosie systemowym, etykiety menu) przez `t()`.
- **C-30** — podświetlenie czytanego zdania wyłącznie przez zmienne CSS; skórka musi móc je zmienić.
- **C-53** — minimalizm. Usterka lektora ma być **zdiagnozowana**, a nie obejmowana kolejną warstwą
  „na wszelki wypadek”; drop-down przestający być filtrem ma **usunąć** stan, a nie dołożyć drugi.
- **C-54** — ten spec **odwraca** decyzję z 083 (drop-down jako filtr). Zapisujemy to jako świadomą
  zmianę wymagań właściciela, a nie usterkę implementacji, i przeliczamy w dół to, co z niej wynika.
- **C-51** — usterka braku dźwięku po zdiagnozowaniu trafia do `doświadczenia.md`.
- **C-10..C-13** — jeśli ponowienie streszczeń wymaga zapamiętania nieudanej próby, idzie to ręcznym
  plikiem migracji; weryfikacja wyłącznie na lokalnym Postgresie.

## 8. Decyzje właściciela

Zebrane w jednym pytaniu na starcie (C-55):

1. **Filtr tematu znika całkiem.** Drop-down przewija do sekcji i nic poza tym. Widok zawsze pokazuje
   wszystkie tematy. *Uzasadnienie właściciela: jedna kontrolka ma mieć jedno znaczenie.*
2. **Chrom powłoki zwija się do jednego menu „⋯"** na końcu paska — gwiazdka, świeżość i skróty pod
   jedną ikoną. Nic nie znika, filtry modułu odzyskują szerokość.
3. **Na telefonie pasek ma dwa wiersze:** zakładki modułu osobno (przewijane poziomo we własnym
   kontenerze), pod nimi nawigacja po tematach z filtrami.
4. **Zakres — decyzja zmieniona po pierwszej odpowiedzi (C-54).** W pierwszym wywołaniu właściciel
   wybrał „zostawić zaległości na osobny przebieg". Zaraz potem polecił wprost: *„to co nie zrobiłeś
   wcześniej co wykryliśmy że nie dokończyłeś to najpierw dokończ a potem zajmij się tymi czterema
   nowymi zadaniami"*. Późniejsze polecenie jest nadrzędne, więc **084 obejmuje całą listę**:
   grupy D, E i F z przebiegu 083 **przed** czterema nowymi zgłoszeniami. Kolejność realizacji ma
   odzwierciedlać tę kolejność.

**Założenia przyjęte samodzielnie** (nie wymagały pytania):

- Komunikat o zejściu na głos systemowy pokazujemy **raz na odsłuch**, nie przy każdym zdaniu —
  taki mechanizm już istnieje i był tak zaprojektowany.
- Przerwa między wiadomościami: krótka i stała, bez ustawienia dla użytkownika. Suwak do regulowania
  ciszy byłby kontrolką, której nikt nie dotknie drugi raz (C-53).
- Tytuł tłumaczymy **przy okazji streszczania**, w tym samym wywołaniu — osobne wywołanie na tytuł
  podwoiłoby liczbę zapytań do modelu przy zerowym zysku.

## 9. Ryzyka

- **Brak dźwięku może nie być usterką kodu.** iOS blokuje odtwarzanie zainicjowane poza gestem
  użytkownika, więc przyczyna może leżeć w tym, że przejście na głos systemowy następuje **po**
  odpowiedzi z sieci, czyli gdy gest już minął. *Ograniczamy tak:* diagnoza przed poprawką, a AC-2
  wymaga, żeby cisza **bez komunikatu** była niemożliwa — nawet gdyby przyczyny nie dało się usunąć
  na wszystkich urządzeniach.
- **Nie da się tego sprawdzić na prawdziwym iPhonie.** W środowisku pracy nie ma silnika WebKit ani
  urządzenia. *Ograniczamy tak:* weryfikujemy zachowanie mechanizmu (kolejność wywołań, komunikat
  zastępczy) w dostępnej przeglądarce i **mówimy wprost**, czego nie zmierzyliśmy — końcowe
  potwierdzenie należy do właściciela na jego telefonie.
- **Zwinięcie chromu dotyka dwudziestu modułów naraz.** *Ograniczamy tak:* zmiana idzie w jednym
  miejscu (rama widoku), a pełny przebieg klikacza jest warunkiem domknięcia.
- **Duży zakres jednego przebiegu.** Siedem obszarów to więcej niż zwykle. *Ograniczamy tak:*
  kolejność jak w zakresie — dług z 083 najpierw, każdy obszar osobnym commitem, żeby dało się
  cofnąć pojedynczy kawałek bez ruszania reszty.
