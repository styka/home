# Spec: Wiadomości — przebudowa pobierania i UX + baza wiedzy o użytkowniku

- **ID:** 039-wiadomosci-i-wiedza-o-userze
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-31
- **Moduł(y):** Wiadomości (główny) + nowy mechanizm przekrojowy: wiedza o użytkowniku

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

To druga i domykająca część zgłoszeń właściciela. Moduł **Wiadomości** ma cztery problemy, z których
trzy mają wspólny korzeń — **architekturę pobierania**:

- Odświeżenie tematu **pobiera te same kanały RSS raz na temat i raz na źródło**, a widok gorących
  tematów pobiera je **jeszcze raz**. Przy trzech tematach i pięciu źródłach to około dwudziestu
  pobrań tych samych kanałów w jednym cyklu — i tyle samo okazji, żeby zapłacić modelowi za analizę
  tego samego materiału.
- Odświeżenie nowego tematu **trwa tak długo, że interfejs się poddaje**: wskaźnik „generuję" znika,
  wiadomości nie ma, a po powrocie na stronę okazuje się, że dane jednak powstały. Użytkownik nie ma
  jak odróżnić „trwa" od „nie wyszło".
- Wiadomości są pobierane **z ostatnich 24 godzin**, zamiast od momentu poprzedniego pobrania — więc
  po dwóch dniach przerwy część materiału po prostu przepada.
- Baza wiedzy o temacie jest **narracyjnym opisem**, a właściciel potrzebuje **linii czasu**: data +
  suchy fakt, z datą braną z treści materiału, nie z chwili pobrania.

Do tego dochodzi **czwarty, niezwiązany brak**: treści wiadomości nie da się **odsłuchać**, a
przycisk „Wszystkie" w filtrze źródeł nie tłumaczy, do czego służy.

Osobno — i to jest fundament na przyszłość — aplikacja **nie wie nic o użytkowniku**. Jest jedno pole
tekstowe „stałe preferencje", którego nikomu nie chce się wypełniać. Bez usystematyzowanej wiedzy o
tym, co ktoś lubi i czego nie znosi, moduły takie jak Pogoda proponują wszystkim to samo.

## 2. Cel i miary sukcesu

- **Cel:** Wiadomości przestają marnować pobrania i tokeny, przestają gubić materiał między
  odświeżeniami i dają się odsłuchać; a aplikacja zaczyna **gromadzić wiedzę o użytkowniku** w
  sposób, który nie wymaga od niego wypełniania formularzy.
- **Sukces mierzymy:**
  - Jedno odświeżenie pobiera każde źródło **dokładnie raz**, niezależnie od liczby monitorowanych
    tematów — a widok gorących tematów korzysta z **już pobranego** materiału, bez sięgania do sieci.
  - Materiał pojawia się od **momentu poprzedniego pobrania** (przy pierwszym uruchomieniu: z ostatnich
    24 godzin), więc dwudniowa przerwa niczego nie gubi.
  - Odświeżenie **nigdy nie kończy się cicho**: użytkownik przez cały czas widzi, że trwa, a zamknięcie
    strony go nie przerywa.
  - Temat ma **linię czasu** z datami wziętymi z treści materiału; ta sama informacja nie pojawia się
    na niej dwa razy.
  - Wiadomość da się odsłuchać z pauzą, wznowieniem i przeskokiem, a **czytane zdanie jest widoczne**.
  - Gorący temat da się odrzucić („nie proponuj"), z listą odrzuconych i możliwością przywrócenia go
    do proponowanych **albo od razu do monitorowanych**.
  - Po tygodniu używania aplikacji profil użytkownika zawiera **co najmniej kilka faktów**, których
    użytkownik nigdzie nie wpisywał — a każdy z nich potwierdza lub odrzuca jednym dotknięciem.

## 3. Historyjki użytkownika

**Wiadomości**
- Jako użytkownik chcę, żeby odświeżenie **nie gubiło materiału** z dni, w których nie zaglądałem.
- Jako użytkownik chcę **widzieć, że pobieranie trwa**, i móc w tym czasie zamknąć stronę bez utraty
  wyniku — dziś wskaźnik znika, a ja nie wiem, czy coś jeszcze się dzieje.
- Jako użytkownik chcę **linię czasu tematu**: kiedy co się wydarzyło, w suchych faktach, po kolei —
  a nie kolejny akapit opisujący całość od nowa.
- Jako użytkownik chcę, żeby daty na tej linii pochodziły **z treści materiału**, bo artykuł pobrany
  dziś potrafi opisywać zdarzenie sprzed tygodnia.
- Jako użytkownik chcę **odsłuchać wiadomość** i widzieć, w którym miejscu jest lektor, żeby móc
  czytać i słuchać naraz albo wrócić do przeoczonego fragmentu.
- Jako użytkownik chcę **odrzucić gorący temat**, który mnie nie interesuje, i mieć możliwość zmiany
  zdania później.
- Jako użytkownik chcę **rozumieć, do czego służy przycisk „Wszystkie"** w filtrze źródeł.
- Jako właściciel systemu chcę **płacić za analizę materiału raz**, a nie tyle razy, ile mam tematów.

**Wiedza o użytkowniku**
- Jako użytkownik **nie chcę wypełniać ankiety o sobie** — ale chcę, żeby aplikacja z czasem wiedziała,
  co lubię.
- Jako użytkownik chcę móc **potwierdzić lub odrzucić** wniosek, który aplikacja o mnie wyciągnęła,
  jednym dotknięciem, przy okazji, bez wchodzenia w ustawienia.
- Jako użytkownik chcę **zobaczyć, co aplikacja o mnie wie**, i poprawić to, co się nie zgadza.
- Jako administrator chcę **wgląd i możliwość edycji** wiedzy o użytkowniku, łącznie z tym, skąd
  dany fakt się wziął.
- Jako użytkownik chcę, żeby moduły **korzystały z tej wiedzy** — żeby propozycje w Pogodzie
  odpowiadały temu, kim jestem.

## 4. Kryteria akceptacji (testowalne)

**Pobieranie: jedna pula materiału (zgłoszenie 12)**
- [ ] **AC-1** — Given kilka monitorowanych tematów i kilka źródeł, when uruchamiam odświeżenie, then
      każde źródło jest pobierane **dokładnie raz**, a liczba pobrań nie zależy od liczby tematów.
- [ ] **AC-2** — Given pobrany materiał, when trwa odświeżanie, then przypisanie materiału do tematów
      odbywa się **jednym przebiegiem** dla całej puli, a nie osobno dla każdego tematu.
- [ ] **AC-3** — Given odświeżenie zakończone, when wchodzę na widok gorących tematów, then powstają
      one z **już pobranego** materiału, **bez** ponownego sięgania do źródeł.
- [ ] **AC-4** — Given temat był już kiedyś odświeżany, when odświeżam ponownie, then pobierany jest
      materiał **od momentu poprzedniego pobrania**; przy pierwszym uruchomieniu — z ostatnich 24 godzin.

**Przebieg odświeżania nie ginie (zgłoszenie 3)**
- [ ] **AC-5** — Given uruchomiłem odświeżanie, when trwa ono dłużej niż kilkadziesiąt sekund, then
      interfejs **nadal pokazuje, że trwa** i informuje, na jakim jest etapie.
- [ ] **AC-6** — Given trwające odświeżanie, when zamknę stronę i wrócę na nią później, then widzę
      albo **nadal trwający** przebieg, albo jego **wynik** — nigdy stanu „nic się nie stało".
- [ ] **AC-7** — Given odświeżanie zakończone niepowodzeniem, when wracam na stronę, then widzę
      **komunikat o błędzie**, a nie pustą listę udającą brak wiadomości.

**Linia czasu tematu (zgłoszenie 12)**
- [ ] **AC-8** — Given monitorowany temat po odświeżeniu, when otwieram jego bazę wiedzy, then widzę
      **linię czasu**: pozycje z datą, jednozdaniowym faktem i wskazaniem źródła, ułożone od
      najnowszej.
- [ ] **AC-9** — Given materiał opublikowany dziś, ale opisujący zdarzenie sprzed tygodnia, when trafia
      na linię czasu, then jego pozycja ma datę **zdarzenia z treści**, nie datę pobrania.
- [ ] **AC-10** — Given informacja już obecna na linii czasu, when pojawia się w kolejnym materiale,
      then **nie jest dublowana** — linia rośnie tylko o to, czego na niej nie było.
- [ ] **AC-11** — Given dotychczasowa, narracyjna baza wiedzy, when wdrożenie się zakończy, then jest
      ona **usunięta** zgodnie z decyzją właściciela, a moduł działa wyłącznie na linii czasu.

**Oszczędność tokenów (zgłoszenie 12)**
- [ ] **AC-12** — Given pobrany materiał, when przypisujemy go do tematów, then dzieje się to
      **tanim przebiegiem** (sama klasyfikacja), a szczegółowe streszczenie powstaje **dopiero** gdy
      użytkownik poprosi o dłuższą wersję.
- [ ] **AC-13** — Given dowolne miejsce w module, w którym pracuje model, when patrzę na wynik, then
      widzę wskaźnik kosztu (mechanizm z 037).

**Lektor (zgłoszenie 2)**
- [ ] **AC-14** — Given wiadomość z treścią, when uruchamiam odsłuch, then słyszę ją i mogę
      **zatrzymać, wznowić oraz przeskoczyć** o zdanie w przód i w tył.
- [ ] **AC-15** — Given trwający odsłuch, when patrzę na tekst, then **czytane zdanie jest wyróżnione**
      i samo przewija się do widoku.
- [ ] **AC-16** — Given tekst wiadomości, when dotknę dowolnego zdania, then lektor **przeskakuje w to
      miejsce**.
- [ ] **AC-17** — Given telefon, when korzystam z lektora, then sterowanie jest osiągalne kciukiem i
      nie zasłania czytanego tekstu.

**Gorące tematy i filtr źródeł (zgłoszenia 1 i 12)**
- [ ] **AC-18** — Given lista gorących tematów, when odrzucam temat („nie proponuj"), then znika z
      listy i **nie wraca** w kolejnych generacjach.
- [ ] **AC-19** — Given lista odrzuconych tematów, when ją otwieram, then mogę przywrócić temat do
      proponowanych **albo dodać go od razu do monitorowanych**.
- [ ] **AC-20** — Given filtr źródeł, when patrzę na przycisk „Wszystkie", then jego działanie jest
      czytelne: pokazuje materiał ze wszystkich źródeł, a liczba źródeł jest widoczna; pozostałe
      zakładki zawężają do jednego portalu.

**Wiedza o użytkowniku (zgłoszenie 10)**
- [ ] **AC-21** — Given moje decyzje w aplikacji (zapisane i odrzucone pomysły, monitorowane tematy,
      odrzucone gorące tematy), when aplikacja wyciąga z nich wnioski, then powstają **fakty o mnie**
      z kategorią, treścią, pewnością i **wskazaniem, skąd pochodzą**.
- [ ] **AC-22** — Given wniosek wyciągnięty z moich zachowań, when pojawia się w interfejsie, then mogę
      go **potwierdzić lub odrzucić jednym dotknięciem**, bez opuszczania tego, co robię.
- [ ] **AC-23** — Given odrzucony wniosek, when aplikacja analizuje moje zachowania ponownie, then
      **nie proponuje go znowu**.
- [ ] **AC-24** — Given zebrane fakty o mnie, when otwieram ustawienia, then widzę je wszystkie
      pogrupowane w kategorie i mogę każdy poprawić lub usunąć.
- [ ] **AC-25** — Given jestem administratorem, when otwieram profil użytkownika w panelu, then widzę
      i mogę edytować jego fakty, łącznie z informacją, czy pochodzą z zachowań, z potwierdzenia, czy
      od administratora.
- [ ] **AC-26** — Given zebrane fakty o mnie, when moduł Pogoda proponuje, co robić, then propozycje
      **uwzględniają te fakty** — zastępując dzisiejszą namiastkę (jedno pole „stałe preferencje").
- [ ] **AC-27** — Given nowy użytkownik bez żadnych faktów, when korzysta z aplikacji, then wszystko
      działa jak dotąd — brak wiedzy o użytkowniku **nigdy** nie blokuje żadnej funkcji.

## 5. Zakres

**W zakresie:**
- **Przebudowa pobierania Wiadomości**: jedna pula materiału (każde źródło pobierane raz), tanie
  przypisanie materiału do tematów jednym przebiegiem, pobieranie **od momentu poprzedniego
  odświeżenia**, gorące tematy z już pobranego materiału.
- **Odświeżanie odporne na czas**: przebieg w tle, którego nie przerywa zamknięcie strony, z
  widocznym postępem i czytelnym błędem.
- **Linia czasu tematu** zamiast narracyjnej bazy wiedzy: data ze zdarzenia, suchy fakt, źródło, bez
  dublowania. **Dotychczasowa baza wiedzy zostaje usunięta** (decyzja właściciela — §8).
- **Leniwe streszczenia**: domyślna długość od razu, dłuższa wersja generowana dopiero na życzenie.
- **Lektor** z podświetlaniem zdań, sterowaniem i skokiem do wskazanego zdania, dobry na telefonie.
- **Odrzucanie gorących tematów** z listą odrzuconych i przywracaniem (do proponowanych lub od razu
  do monitorowanych).
- **Czytelny filtr źródeł** („Wszystkie" z licznikiem źródeł).
- **Wiedza o użytkowniku**: fakty w kategoriach z pewnością i pochodzeniem, wyciągane z zachowań,
  potwierdzane jednym dotknięciem, przeglądalne przez użytkownika, edytowalne przez administratora,
  wpięte w propozycje Pogody.
- Wskaźnik kosztu przy każdej treści generowanej przez model (mechanizm z 037) i pamięć treści tam,
  gdzie ma sens (mechanizm z 038).

**Poza zakresem (świadomie):**
- Powiadomienia push o nowych wiadomościach w monitorowanym temacie.
- Automatyczne odświeżanie w tle bez udziału użytkownika (cron) — przebieg nadal startuje kliknięciem.
- Tłumaczenie wiadomości i źródła obcojęzyczne.
- Wykrywanie i porównywanie narracji między portalami o różnym profilu — dziś wystarcza znacznik
  profilu przy źródle.
- Rozszerzanie wiedzy o użytkowniku na pozostałe moduły poza Pogodą — w tym przebiegu powstaje
  mechanizm i jedno realne wpięcie; kolejne moduły to osobna praca.
- Eksport i import profilu użytkownika.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** Wiadomości zostają pod `module.news`. Wiedza o użytkowniku jest częścią
  ustawień użytkownika (bez nowego sluga); podgląd i edycja cudzego profilu — wyłącznie `module.admin`.
- **Własność danych:** materiał, linia czasu, odrzucone gorące tematy i fakty o użytkowniku są
  **prywatne dla użytkownika** (`ownerId`), zgodnie ze wzorcem modułu.
- **Asystent AI:** fakty o użytkowniku mają zasilać kontekst asystenta tak samo jak dzisiejsze „stałe
  preferencje". Ewentualne nowe akcje wymagają wpisu w manifeście pokrycia AI (C-23).
- **Kalendarz / powiadomienia / trash:** kalendarz — nie dotyczy. Powiadomienia — poza zakresem.
  Trash — odrzucone gorące tematy i fakty o użytkowniku są odwracalne z poziomu własnych list
  (przywróć / usuń), więc **nie** wchodzą do kosza.
- **Prywatność:** profil użytkownika to wiedza o osobie. Nie trafia do żadnego miejsca, w którym
  widziałby go inny użytkownik; administrator ma dostęp jawnie i celowo (AC-25).

## 7. Zgodność z konstytucją

- **C-01 / C-02** — praca w `worldofmag/`, importy przez alias.
- **C-10 / C-11 / C-12** — pula materiału, linia czasu, odrzucone tematy i fakty o użytkowniku wymagają
  zmian schematu → **ręczne pliki migracji**; wszystkie rodzaje/stany jako `String` + union TypeScript,
  **nigdy** enum Prisma.
- **C-13** — weryfikacja lokalnie do kroku `next build`; zero operacji na produkcyjnej bazie.
- **C-20** — mutacje jako Server Actions z `revalidatePath()`.
- **C-21** — własność `ownerId` zgodnie ze wzorcem modułu.
- **C-23** — każda nowa `AIAction` musi mieć egzekutor; nowe akcje wymagają klasyfikacji w manifeście.
- **C-30 / C-31 / C-32** — linia czasu, sterowanie lektorem i karty faktów wyłącznie na zmiennych CSS,
  projektowane mobile-first, teksty po polsku.
- **C-40** — routing modeli wyłącznie przez konfigurację w bazie.
- **C-50 / C-51** — „gotowe" = zielony build ze wszystkimi bramkami; każdy naprawiony błąd → wpis do
  `doświadczenia.md`.
- **C-53** — minimalizm: korzystamy z **istniejących** mechanizmów zamiast budować nowe — kolejka zadań
  w tle (odświeżanie), pamięć treści z 038, licznik kosztu z 037, warstwa mowy z 032.
- **C-54 / C-55** — pytania zadane jednorazowo (§8).

## 8. Otwarte pytania / decyzje właściciela

Pytania zadano jednorazowo na etapie `/specify`.

- [x] **Linia czasu a dotychczasowa baza wiedzy** → **zastąpić całkowicie, starą wiedzę usunąć.**
      Właściciel wybrał ten wariant świadomie, odrzucając zalecany („zachować do wglądu w archiwum").
      **To jedyny nieodwracalny krok w całej zmianie** — patrz §9.
- [x] **Lektor** → **podświetlanie zdań** z pauzą, wznowieniem, skokiem o zdanie i przeskokiem po
      dotknięciu tekstu. Działa z każdym dostawcą mowy i z głosem przeglądarki, bo nie wymaga
      znaczników czasu.
- [x] **Postać wiedzy o użytkowniku** → **nazwane fakty w kategoriach** (zainteresowania, aktywność
      fizyczna, styl życia, ograniczenia, preferencje treści), każdy z treścią zdaniem, pewnością i
      pochodzeniem (z zachowań / potwierdzone / od administratora).
- [x] **Wspólna pula artykułów** → **tak, jedna pula + przypisania do tematów.** To warunek konieczny
      zarówno oszczędności tokenów, jak i tego, żeby gorące tematy miały z czego korzystać po
      zakończeniu odświeżania.

**Założenia przyjęte samodzielnie** (wzorzec sąsiednich modułów, C-53):
- Odświeżanie idzie przez **istniejącą kolejkę zadań w tle** — to ona rozwiązuje zgłoszenie 3 bez
  budowania czegokolwiek nowego.
- Materiał w puli **nie jest trzymany wiecznie** — starszy niż rozsądny okres jest sprzątany, bo
  służy wyłącznie do zbudowania linii czasu i gorących tematów.
- Pewność faktu o użytkowniku to **prosta, trzystopniowa skala** (przypuszczenie / prawdopodobne /
  potwierdzone), nie liczba — bo i tak trafia do promptu jako słowo.
- Fakty **potwierdzone przez użytkownika** zawsze wygrywają z wywnioskowanymi, a fakt **od
  administratora** nie jest nadpisywany automatycznie.

## 9. Ryzyka

- **Nieodwracalne usunięcie dotychczasowej bazy wiedzy (AC-11).** To świadoma decyzja właściciela,
  podjęta przy jawnie opisanej konsekwencji. Konsekwencje i ograniczenie ryzyka: usunięcie wykonuje
  migracja, więc na produkcji zadziała raz i bez pytania; **jedyną drogą odzyskania jest przywrócenie
  bazy do punktu w czasie** (Neon PITR, procedura w runbooku DevOps). Wdrożenie musi to odnotować w
  opisie zmiany, żeby nikt nie odkrył tego po fakcie.
- **Przebudowa pobierania dotyka serca modułu** — błąd tutaj psuje wszystko, co Wiadomości robią.
  Ograniczamy: zmiana idzie warstwami (najpierw pula i przypisania, potem linia czasu, potem UX), a
  każdą warstwę da się zweryfikować osobno.
- **Model źle odczyta datę zdarzenia z treści** i linia czasu się rozjedzie (AC-9). Ograniczamy:
  data musi być jawnie uzasadniona fragmentem materiału, a przy braku pewnej daty pozycja trafia na
  linię z datą publikacji i widocznym znacznikiem niepewności — nigdy ze zmyśloną datą.
- **Dublowanie pozycji na linii czasu** (AC-10) — porównanie faktów jest zadaniem dla modelu i bywa
  zawodne. Ograniczamy: przed dopisaniem model dostaje istniejące pozycje z tego samego okresu, a nie
  całą historię.
- **Wiedza o użytkowniku może irytować.** Pytanie o potwierdzenie w złym momencie jest gorsze niż brak
  pytania. Ograniczamy: karty hipotez pojawiają się **rzadko, pojedynczo i tylko przy okazji**, nigdy
  jako przerywnik ani osobny ekran startowy.
- **Wiedza o użytkowniku może być błędna i utrwalać błąd.** Ograniczamy: każdy fakt ma pochodzenie i
  daje się odrzucić, a odrzucony nie wraca (AC-23).
- **Zakres tego przebiegu jest duży** — przebudowa modułu plus nowy mechanizm przekrojowy. Jeśli w
  trakcie okaże się, że któraś część nie mieści się w sensownej jakości, uczciwiej jest **zgłosić to
  wprost w weryfikacji** niż dowieźć wszystko po łebkach.
