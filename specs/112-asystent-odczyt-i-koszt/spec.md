# Spec: Asystent — kompletny odczyt, domknięcie zadania i uczciwy koszt tury

- **ID:** 112-asystent-odczyt-i-koszt
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-28
- **Moduł(y):** Asystent AI (powłoka + pętla agenta), Zadania (narzędzia odczytu), Zwierzęta (katalog akcji)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Dwa zgłoszenia właściciela ze skrzynki zgłoszeń opisują **ten sam mechanizm widziany z dwóch stron**:
raz jako niedokończone zadanie, raz jako rachunek.

1. **Asystent nie dowiózł zadania, mimo że miał dane.** Właściciel poprosił: „przeczytaj wszystkie
   obowiązki dotyczące psa Raj z projektu zadań i załóż mi na ich podstawie zwierzę w module
   Zwierzęta; napisz też, czego nie dało się przenieść". Asystent wykonał **jedenaście odczytów w
   sześciu iteracjach** — za każdym razem tego samego rodzaju, coraz węziej (po statusie, po tagu, po
   priorytecie) — po czym wyczerpał limit kroków i odpowiedział: *„Nie dokończyłem tego zadania.
   Zdążyłem pobrać dane (11 odczytów), ale nie ułożyłem z nich odpowiedzi."* Tura kosztowała **1,36 zł**.
2. **Prosta tura kosztowała 30 groszy.** Właściciel zapytał wprost: *„czy to błąd twojego liczenia,
   czy coś działa nieoptymalnie? przeanalizuj i popraw"*. Jedno zdanie użytkownika i jeden krok
   asystenta kosztowały **23 755 tokenów / $0,0813**.

**Ustalenie wstępne (przeliczone na cenniku z bazy, nie z pamięci): kwoty są policzone POPRAWNIE.**
Obie zgadzają się co do czwartego miejsca po przecinku, a tokeny wejściowe nie są liczone podwójnie z
tokenami pamięci podręcznej. To nie jest błąd wyceny — to jest rachunek za realne zużycie. Rozbicie
tego rachunku pokazuje jednak, że **większość tej kwoty nie kupuje żadnej pracy**:

| Sesja | Co kosztowało | Kwota | Udział |
|---|---|---|---|
| „30 groszy" | wejście dużego modelu (katalogi w prompcie) | $0,0583 | 72 % |
| | routing modułów — samo **wyjście** (1326 tokenów, 15 s) | $0,0066 | 8 % |
| | zapis do pamięci podręcznej, z którego nic nie odczytano | $0,0048 | 6 % |
| „pies Raj" | ~12–13 tys. tokenów katalogu **przepłaconych w każdej z 6 iteracji** | ~$0,24 | 67 % |
| | zapis 11 860 tokenów do pamięci podręcznej w **ostatnim** wywołaniu przebiegu | $0,0445 | 12 % |

Wspólna przyczyna obu zgłoszeń: **z promptu systemowego oznaczona jako trwała jest tylko czołówka
(~1276 tokenów), a cały katalog narzędzi i akcji (~12–18 tys. tokenów) jest wysyłany i płacony od
nowa przy każdym wywołaniu modelu — także w kolejnych iteracjach tej samej tury, gdzie jest
identyczny co do znaku.** Sześć iteracji to sześć razy ten sam katalog w pełnej cenie.

Drugą przyczyną jest **ciasny budżet wyników odczytu**: do kontekstu trafia najwyżej dwanaście
rekordów na narzędzie, a komunikat o obcięciu mówi modelowi „**zawęź zapytanie**" — mimo że zawężanie
niczego nie odblokowuje, bo limit jest po stronie kontekstu, nie zapytania. Model robi więc dokładnie
to, co mu kazano, i tnie projekt na coraz drobniejsze plasterki. Tak powstało jedenaście odczytów.

Trzecią jest **sposób kończenia przebiegu**: gdy kroki się wyczerpią, asystent prosi model o
*streszczenie tego, czego nie zrobił*, zamiast o **dokończenie zadania z danych, które już ma**.
W zgłoszonej sesji komplet danych był zebrany — zabrakło wyłącznie polecenia, żeby ich użyć.

## 2. Cel i miary sukcesu

- **Cel:** asystent czyta komplet danych w niewielu krokach, kończy turę wynikiem (planem albo
  odpowiedzią) nawet gdy dobija do limitu kroków, a rachunek za turę odzwierciedla wykonaną pracę,
  a nie wielokrotnie przepłacony ten sam katalog.
- **Sukces mierzymy:**
  - Scenariusz „przeczytaj cały projekt zadań i załóż na jego podstawie zwierzę" kończy się
    **planem akcji do potwierdzenia**, a nie komunikatem „nie dokończyłem".
  - Ten sam scenariusz mieści się w **≤ 3 iteracjach odczytu** (dziś 6) i **≤ 4 odczytach** (dziś 11).
  - Koszt takiej tury spada o **≥ 50 %** wobec zmierzonych 1,36 zł, przy tym samym modelu i tej samej
    liczbie danych.
  - Właściciel dostaje **jawną odpowiedź na pytanie „czy to błąd liczenia"** — udokumentowaną w
    aplikacji, nie tylko w rozmowie.

## 3. Historyjki użytkownika

- Jako użytkownik chcę poprosić asystenta o coś, co wymaga przeczytania **całej** listy (projektu,
  działu), żeby dostać wynik, a nie relację z tego, jak asystent próbował te dane zdobyć.
- Jako użytkownik chcę, żeby asystent, któremu skończyły się kroki, **dowiózł to, co da się dowieźć**
  z zebranych danych i uczciwie wypisał, czego brakuje.
- Jako użytkownik chcę założyć zwierzę z **pełniejszym profilem** (nie tylko imię, gatunek, rasa,
  płeć) i usłyszeć wprost, których informacji moduł Zwierzęta nie potrafi przechować — żeby móc to
  zgłosić.
- Jako właściciel chcę **wiedzieć, za co zapłaciłem** w danej turze: ile poszło na katalog w
  prompcie, ile na routing, ile na pamięć podręczną — i mieć pewność, że kwota nie jest zmyślona.
- Jako właściciel chcę, żeby **tanie decyzje były tanie**: klasyfikacja i routing nie mają kosztować
  jak rozumowanie ani trwać kilkunastu sekund.

## 4. Kryteria akceptacji (testowalne)

**A. Kompletny odczyt zamiast spirali zawężania**

- [ ] **AC-1** — Given projekt zadań zawierający więcej rekordów, niż mieści się w jednorazowym
      budżecie wyników, when asystent czyta ten projekt, then dostaje **jawną informację o
      stronicowaniu**: ile rekordów pokazano, ile jest łącznie i **jak dobrać następną porcję** —
      a nie polecenie „zawęź zapytanie".
- [ ] **AC-2** — Given ta sama sytuacja, when asystent sięga po następną porcję wskazanym sposobem,
      then dostaje **kolejne, nienachodzące na siebie** rekordy, aż do wyczerpania zbioru.
- [ ] **AC-3** — Given zbiór mieszczący się w całości, when asystent go czyta, then wynik **nie
      zawiera** żadnego znacznika niekompletności (brak fałszywego alarmu „to nie wszystko").
- [ ] **AC-4** — Given wynik odczytu obcięty budżetem znaków, when trafia do kontekstu modelu, then
      pozostaje **poprawną, zamkniętą strukturą danych** — nigdy nie jest urwany w połowie rekordu.
- [ ] **AC-5** — Given polecenie „przeczytaj wszystkie zadania z projektu i zbuduj z nich profil",
      when asystent je wykonuje, then komplet danych (wraz z **treścią opisów** zadań, nie samą
      informacją, że opis istnieje) jest w kontekście po **nie więcej niż 3 iteracjach odczytu**.

**B. Domknięcie tury wynikiem**

- [ ] **AC-6** — Given przebieg, któremu skończyły się kroki, a w kontekście są zebrane dane, when
      przebieg się kończy, then asystent **dokańcza zadanie** z tego, co ma — proponuje plan akcji
      albo daje pełną odpowiedź — zamiast opisywać, czego nie zrobił.
- [ ] **AC-7** — Given przebieg jak wyżej, when asystent dowozi wynik, then **wymienia wprost**,
      czego zabrakło i czego nie dało się ustalić (uczciwość zamiast milczenia).
- [ ] **AC-8** — Given przebieg, w którym **nie zebrano żadnych danych** (np. same błędy dostępu),
      when się kończy, then użytkownik nadal dostaje uczciwy komunikat „nie dokończyłem + dlaczego"
      — dzisiejsze zachowanie **nie może zniknąć** dla tego przypadku.

**C. Zwierzę zakładane z profilem + raport braków**

- [ ] **AC-9** — Given polecenie założenia zwierzęcia z danymi wykraczającymi poza imię/gatunek/rasę/
      płeć (np. data urodzenia, notatka identyfikacyjna), when asystent proponuje akcję, then te dane
      **trafiają do profilu**, a nie giną po drodze.
- [ ] **AC-10** — Given polecenie „przenieś, co się da, i napisz czego nie dało się przenieść", when
      asystent kończy, then w odpowiedzi jest **wyodrębniona lista informacji nieprzenoszalnych**
      wraz z powodem („moduł nie ma takiego pola").
- [ ] **AC-11** — Given przebieg zakładający zwierzę na podstawie zadań, when asystent go wykonuje,
      then **żadne zadanie źródłowe nie zostaje zmienione ani usunięte** (projekt zostaje nietknięty).

**D. Koszt: uczciwy rachunek i koniec przepłacania**

- [ ] **AC-12** — Given tura, w której pętla asystenta wykonuje kilka wywołań modelu z **identycznym**
      promptem systemowym, when liczymy zużycie, then część katalogowa promptu jest **opłacana raz**
      (kolejne wywołania czytają ją z pamięci podręcznej), a nie w pełnej cenie za każdym razem.
- [ ] **AC-13** — Given **ostatnie** wywołanie w przebiegu (nic po nim nie nastąpi), when je
      wykonujemy, then **nie płacimy za zapis do pamięci podręcznej**, którego nikt nie odczyta.
- [ ] **AC-14** — Given decyzja klasyfikacyjna (wybór modułów / rozpoznanie prostego polecenia),
      when jest podejmowana, then jej **wyjście jest krótkie** — mierzalnie mniejsze niż zaobserwowane
      1326 tokenów — i nie zajmuje kilkunastu sekund.
- [ ] **AC-15** — Given wiadomość, która nie ma szans zostać rozpoznana jako proste polecenie, when
      tura się zaczyna, then **nie płacimy za klasyfikację**, która i tak nie może zmienić przebiegu.
- [ ] **AC-16** — Given zmierzona sesja „pies Raj" (te same dane, ten sam model), when powtórzymy ją
      po zmianie, then łączny koszt tury jest **niższy o co najmniej połowę**, a wynik jest **lepszy**
      (plan zamiast komunikatu o niedokończeniu).
- [ ] **AC-17** — Given administrator pyta „czy kwota jest policzona dobrze", when otwiera
      dokumentację kosztów asystenta w aplikacji, then znajduje **rozbicie rachunku na składowe**
      (wejście / wyjście / zapis i odczyt pamięci podręcznej) wraz z odpowiedzią dla obu zgłoszonych
      sesji: **wycena jest poprawna, nieoptymalne było zużycie**.
- [ ] **AC-18** — Given którakolwiek zmiana z tego zakresu, when patrzymy na kwoty pokazywane
      użytkownikowi, then **nie są ukrywane ani zaniżane** — poprawiamy zużycie, nie prezentację.

## 5. Zakres

**W zakresie:**

- Stronicowanie i czytelny opis niekompletności wyników odczytu asystenta (AC-1…AC-4).
- Dostęp asystenta do **treści** szczegółów wielu wskazanych rekordów zadań naraz, nie tylko do
  informacji, że szczegóły istnieją (AC-5).
- Podniesienie budżetu wyników odczytu na turę, wyważone oszczędnością z pamięci podręcznej (AC-5,
  AC-16).
- Domknięcie przebiegu, któremu skończyły się kroki: dokończenie zadania z zebranych danych +
  jawna lista braków, z zachowaniem uczciwego komunikatu, gdy danych nie ma (AC-6…AC-8).
- Bogatsze zakładanie zwierzęcia i wymóg raportu informacji nieprzenoszalnych (AC-9…AC-11).
- Naprawa pamięci podręcznej promptu, brak płatnego zapisu w ostatnim wywołaniu, tańsze decyzje
  klasyfikacyjne, pominięcie klasyfikacji tam, gdzie nie może pomóc (AC-12…AC-16).
- **Odpowiedź dla właściciela na pytanie „czy to błąd liczenia"** — udokumentowana w aplikacji,
  z rozbiciem obu zmierzonych sesji (AC-17).

**Poza zakresem (świadomie):**

- **Zmiana zachowania trybu zaznaczania wielu zadań po akcji zbiorczej.** Sugestia („po akcji
  zbiorczej tryb z checkboxami się wyłącza, a chciałbym zaznaczać dalej") **była treścią, którą
  użytkownik podyktował** w zgłoszonej sesji, ale właściciel przy ustalaniu zakresu wskazał wprost,
  że **to zgłoszenie dotyczy kosztu tury, nie tej zmiany w interfejsie**. Sugestia zostaje jako
  osobne zadanie w skrzynce zgłoszeń i nie ginie — po prostu nie należy do tego feature'a.
- Przebudowa modelu danych modułu Zwierzęta (nowe pola profilu w bazie). Katalog akcji Zwierząt jest
  bogaty (15 akcji: zabiegi, wizyty, karta zdrowia, pomiary, środowisko) — wąskim gardłem było samo
  zakładanie zwierzęcia i to, że asystent nigdy nie dobrnął do planu. Uzupełniamy w granicach tego,
  co moduł **już potrafi przechować**.
- Zmiana modelu, dostawcy ani poziomu pracy asystenta. Routing modeli zostaje sterowany z panelu
  administratora (C-40).
- Zmiana progów budżetu miesięcznego i limitów zużycia AI.
- Automatyczne zakładanie zwierząt „w tle" bez potwierdzenia planu przez użytkownika.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian. Korzystamy z istniejących slugów `module.tasks` i `module.pets`;
  odczyty asystenta pozostają ograniczone tymi samymi regułami dostępu co aplikacja. Dokumentacja
  kosztów jest powierzchnią administratora (`module.admin`).
- **Własność danych:** bez zmian — zasób należy do przestrzeni, w której powstaje. Rozszerzenie
  zakładania zwierzęcia nie wprowadza nowego nośnika własności.
- **Asystent AI:** to jest **rdzeń** tego feature'a. Dotykamy: kontraktu wyników narzędzi odczytu,
  sposobu kończenia przebiegu i katalogu akcji Zwierząt. Każda nowa albo zmieniona akcja musi mieć
  egzekutor, wpis w kontrakcie akcji i klasyfikację pokrycia (C-23) — inaczej build pada.
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Zabiegi i wizyty zakładane przez asystenta
  wpinają się w agendę **istniejącymi** ścieżkami modułu Zwierzęta; nie budujemy nowej integracji.
  Nic tu nie jest usuwane, więc kosz nie jest angażowany.

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — reguła prowadząca dla całego zakresu. Trzy zgłoszone objawy mają **jedną
  wspólną przyczynę** (prompt płacony od nowa w każdej iteracji) i jedną poboczną (budżet wyników).
  Naprawiamy przyczyny, nie dokładamy warstw abstrakcji ani nowych zależności.
- **C-23 (każda `AIAction` ma egzekutor)** — rozszerzenie zakładania zwierzęcia przechodzi przez
  kontrakt akcji, egzekutor i bramkę pokrycia. Bramka jest tu **właściwym zabezpieczeniem**: pole
  dodane do promptu bez obsługi po stronie wykonania byłoby obietnicą bez pokrycia.
- **C-40 (routing modeli jest sterowany z bazy)** — optymalizujemy **ile** i **co** wysyłamy do
  modelu, nigdy nie zaszywając w kodzie dostawcy, modelu ani poziomu wysiłku.
- **C-32 (teksty przez `t()`, polski jako źródło)** — wszystkie nowe komunikaty widoczne dla
  użytkownika (opis braków, potwierdzenia, dokumentacja kosztu) idą przez warstwę tłumaczeń.
- **C-51 (lekcja do `doświadczenia.md`)** — obowiązkowa. Ta sprawa jest podręcznikowym przykładem
  „objaw w innym miejscu niż przyczyna": zgłoszenie o **cenie** i zgłoszenie o **niedokończonym
  zadaniu** okazały się tym samym błędem.
- **C-50 / C-13 (definicja „gotowe", nigdy build z prod bazą)** — weryfikujemy do kroku `next build`
  na lokalnym Postgresie.
- **C-54 (spójność artefaktów)** — jeśli implementacja pokaże, że któreś ustalenie kosztowe jest
  nieprawdziwe, poprawiamy **ten spec**, a nie obchodzimy sprawę w kodzie.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie rozstrzygnięte w jedynym momencie pytań (C-55):

- [x] **Zakres modułu Zwierzęta** → *naprawa odczytu + bogatszy profil + raport braków.* Realizujemy
      pierwotną prośbę użytkownika w całości, łącznie z wypisaniem, czego nie dało się przenieść.
- [x] **Koniec kroków przebiegu** → *dokończyć zadanie z zebranych danych* (plan albo pełna
      odpowiedź) zamiast streszczać własną porażkę. Dzisiejszy uczciwy komunikat zostaje wyłącznie
      dla przypadku, w którym danych faktycznie nie ma (AC-8).
- [x] **Koszt vs. możliwości** → *podnieść budżet wyników + jawne stronicowanie + tańszy prompt.*
      Podwyżkę budżetu finansujemy naprawą pamięci podręcznej; netto tura ma być **tańsza** niż dziś,
      mimo że wolno jej przeczytać więcej.
- [x] **Zgłoszenie „30 groszy"** → właściciel doprecyzował, że pyta o **koszt tury**, a nie o zmianę
      trybu zaznaczania w Zadaniach. Sugestia UI wypada z zakresu (sekcja 5) i zostaje osobnym
      zadaniem w skrzynce.
- [x] **Założenie przyjęte domyślnie (do odnotowania):** kwoty pokazywane użytkownikowi **zostają
      widoczne i niezmienione co do zasady** — poprawiamy zużycie, nie prezentację (AC-18). Właściciel
      pytał „czy to błąd liczenia"; odpowiedź brzmi „nie", więc ukrywanie kwoty byłoby odpowiedzią na
      niezadane pytanie.
- [x] **Ustalenie z rekonesansu (naniesione na etapie planu, C-54):** strażnik pętli **istnieje**
      i to nie on zatrzymał zgłoszony przebieg. Asystent przerywa po dwóch jałowych iteracjach, ale
      w sesji „pies Raj" **każda** iteracja przynosiła nowe dane — przebieg zwyczajnie dobił do
      limitu kroków. Brakowało więc nie strażnika, lecz **domknięcia wynikiem** (AC-6); zakres
      pozostaje bez zmian, ale przyczyna jest inna, niż sugerowało zgłoszenie.
- [x] **Założenie przyjęte domyślnie:** ścieżka zgłoszenia z trybu wskazywania elementu **już nie
      woła modelu** (zmiana z przebiegu 099 — zgłoszenie zapisuje się natychmiast). Dokładnie ten
      przebieg, który kosztował 30 groszy, jest więc nieosiągalny. Nie unieważnia to zgłoszenia:
      wskazane przez nie nieoptymalności (pamięć podręczna, routing, klasyfikacja) obciążają **każdą
      zwykłą turę** i to je naprawiamy. Fakt „ten konkretny przebieg już nie istnieje" ma trafić do
      odpowiedzi dla właściciela, a nie zostać przemilczany.

## 9. Ryzyka

- **Ryzyko: większy budżet wyników podnosi koszt tury zamiast go obniżyć.** → Ograniczamy je
  kolejnością prac: **najpierw** pamięć podręczna promptu (mierzalna oszczędność), **potem**
  podniesienie budżetu; a AC-16 wymaga pomiaru netto na tej samej sesji, nie deklaracji.
- **Ryzyko: „dokończ z tego, co masz" produkuje plan na niepełnych danych i użytkownik dostaje akcje
  oparte o zgadywanie.** → AC-7 wymaga jawnej listy braków przy takim wyniku, a plan i tak trafia do
  panelu potwierdzenia przed wykonaniem; akcje niszczące pozostają domyślnie odznaczone.
- **Ryzyko: zmiana oznaczania pamięci podręcznej psuje trafienia zamiast je naprawiać** (blok
  oznaczony jako trwały musi być identyczny co do znaku między wywołaniami). → Traktujemy jako
  wymaganie weryfikowalne: dowodem jest **zmierzony odczyt z pamięci** w kolejnych iteracjach jednej
  tury, a nie sama zmiana kodu.
- **Ryzyko: skrócenie decyzji klasyfikacyjnych pogarsza trafność routingu modułów** i asystent
  przestaje widzieć właściwy moduł. → Wątpliwość zawsze rozstrzygamy na korzyść szerszego katalogu
  (zachowanie dzisiejsze: niepewność → pełna ścieżka), więc błąd degraduje koszt, nigdy poprawność.
- **Ryzyko: stronicowanie zostanie zignorowane przez model i spirala wróci.** → Komunikat o
  niekompletności musi **podawać gotowy sposób dobrania reszty**, a nie ogólnikowe „zawęź" — to
  właśnie ogólnik wyprodukował jedenaście odczytów.
