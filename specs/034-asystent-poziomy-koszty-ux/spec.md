# Spec: Asystent — poziomy pracy, rzetelne koszty, dopracowany UX czatu i właściciele encji

- **ID:** 034-asystent-poziomy-koszty-ux
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-27
- **Moduł(y):** Home / Asystent AI, Admin (konfiguracja LLM), Ustawienia użytkownika, Notatki + Zakupy (własność danych)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Po wdrożeniu poziomów pracy asystenta (oszczędny/standardowy/maksymalny) oraz wysiłku i temperatury
modeli zebrała się paczka ośmiu zgłoszeń administratora, które łączy jeden wątek: **asystent jest już
sprawny, ale nie jest jeszcze wiarygodny ani wygodny**. Administrator nie potrafi skonfigurować dwóch
z trzech poziomów, użytkownik nie ma własnego poziomu, koszt pokazywany pod odpowiedzią rozjeżdża się
z rzeczywistością (składowe o podobnej liczbie tokenów na tym samym modelu różnią się kosztem
dwudziestokrotnie), a w samym oknie czatu kilka drobiazgów psuje wrażenie dopracowania: techniczna
nazwa parametru w podglądzie akcji, kursor przebijający się przez rozwinięte menu, kursor na początku
przywróconej wersji roboczej, niespójne zachowanie ikon nagłówka i skrót do poprzedniej rozmowy
rozpychający nagłówek poza ekran telefonu. Do tego dochodzi decyzja właściciela w sprawie encji bez
właściciela (grupy notatek, etykiety, podpowiedzi zakupów), która była świadomie odłożona.

## 2. Cel i miary sukcesu

- **Cel:** asystent, którego koszt można ufnie czytać, którego moc obliczeniową da się świadomie
  wybrać (admin definiuje trzy poziomy, użytkownik może zbudować własny), a którego okno czatu nie
  zawiera już żadnego z wypunktowanych drobiazgów UX; dodatkowo dane tworzone przez użytkowników mają
  właściciela.
- **Sukces mierzymy:**
  - żadna kwota w rozbiciu kosztu nie da się „nie wytłumaczyć” z pokazanych obok liczb tokenów —
    każda składowa ceny jest widoczna,
  - administrator ustawia model/wysiłek/temperaturę/limit tokenów dla **każdego** z trzech poziomów
    bez opuszczania jednego ekranu,
  - użytkownik przełącza się na własny poziom i reguluje jakość ↔ koszt w ≤2 kliknięciach, bez
    dostępu do limitu tokenów,
  - w oknie czatu nie da się doprowadzić do stanu z dwiema otwartymi sekcjami nagłówka ani do
    poziomego przewijania na telefonie,
  - w podglądzie proponowanej akcji nie występuje **żadna** techniczna nazwa parametru,
  - każda grupa notatek, etykieta i podpowiedź zakupowa ma właściciela albo jest jawnie systemowa.

## 3. Historyjki użytkownika

- Jako **administrator** chcę zdefiniować, jakimi modelami i z jakim wysiłkiem pracuje asystent na
  poziomie oszczędnym, standardowym i maksymalnym, żeby móc świadomie zarządzać relacją koszt ↔ jakość
  całego systemu.
- Jako **użytkownik** chcę wybrać własny poziom pracy asystenta i sam ustawić model, wysiłek i
  temperaturę dla poszczególnych rodzajów działań, żeby dopasować asystenta do swojego stylu pracy —
  ale nie chcę odpowiadać za techniczne limity odpowiedzi.
- Jako **użytkownik** chcę widzieć pod odpowiedzią koszt, który zgadza się z pokazanymi liczbami, żeby
  ufać temu wskaźnikowi i móc na jego podstawie zmieniać poziom pracy.
- Jako **właściciel systemu** chcę, żeby ten sam sposób pokazywania kosztu dał się w przyszłości
  wstawić w innych modułach (np. przy generowaniu opisu pogody), żeby nie budować tego drugi raz.
- Jako **użytkownik** chcę, żeby podgląd proponowanej akcji mówił do mnie po polsku (a nie nazwami
  pól z kodu), żeby wiedzieć, na co się zgadzam.
- Jako **użytkownik na telefonie** chcę, żeby nagłówek asystenta mieścił się na ekranie i żeby ikony
  nagłówka zachowywały się przewidywalnie (klik otwiera, klik zamyka, otwarta zawsze najwyżej jedna
  sekcja).
- Jako **użytkownik** chcę wrócić do niedokończonej wiadomości i pisać dalej od razu — z kursorem na
  końcu tekstu.
- Jako **użytkownik** chcę, żeby rozwinięte menu wyboru trybu było naprawdę na wierzchu — bez kursora
  z pola wiadomości przebijającego się przez nie.
- Jako **właściciel danych** chcę, żeby grupy notatek, etykiety i podpowiedzi zakupowe należały do
  konkretnego konta, żeby przy dołączeniu kolejnych użytkowników nie zobaczyli oni moich danych.

## 4. Kryteria akceptacji (testowalne)

**Podgląd akcji (Z1)**

- [ ] **AC-1** — Given asystent proponuje dowolną akcję z parametrami, when otwieram jej podgląd,
      then przy każdym parametrze widnieje polska nazwa opisowa, a **żadna** nazwa techniczna
      (np. „groupName”) nie jest widoczna.
- [ ] **AC-2** — Given do systemu dodano nowy parametr dowolnej akcji bez polskiej nazwy, when
      uruchamiam bramkę jakości projektu, then bramka **nie przechodzi** i wskazuje brakującą nazwę
      (reguła systemowa, nie jednorazowa poprawka).
- [ ] **AC-2b** — Given asystent zaproponuje parametr, którego akcja w ogóle nie przewiduje (model
      potrafi go wymyślić), when otwieram podgląd akcji, then taki parametr **nie jest pokazywany**
      pod techniczną nazwą — bramka statyczna nie wystarcza, bo nie zna parametrów wymyślonych.
- [ ] **AC-2c** — Given proszę o dodanie notatki do istniejącej grupy notatek, when akcja zostanie
      wykonana, then notatka **faktycznie trafia do tej grupy** (dziś akcja tworzenia notatki nie
      przyjmuje grupy, więc notatka lądowała poza nią, a wymyślony parametr był tylko objawem).

**Poziomy pracy — administrator (Z2)**

- [ ] **AC-3** — Given jestem administratorem, when otwieram konfigurację LLM, then dla każdego z
      trzech poziomów (oszczędny/standardowy/maksymalny) mogę ustawić model, wysiłek, temperaturę i
      limit odpowiedzi osobno dla każdego rodzaju operacji.
- [ ] **AC-4** — Given nie wypełniłem ustawienia dla poziomu oszczędnego lub maksymalnego, when
      asystent pracuje na tym poziomie, then dziedziczy ustawienie z poziomu standardowego, a panel
      jasno pokazuje, że wartość jest dziedziczona (nie zgadujemy — informujemy).
- [ ] **AC-5** — Given zmieniam konfigurację poziomu, when zapisuję, then zmiana trafia do dziennika
      zmian konfiguracji wraz z informacją, którego poziomu dotyczy.

**Poziomy pracy — użytkownik (Z2)**

- [ ] **AC-6** — Given jestem zwykłym użytkownikiem, when otwieram ustawienia asystenta, then poza
      trzema poziomami zdefiniowanymi przez administratora mogę wybrać **własny** poziom.
- [ ] **AC-7** — Given wybrałem własny poziom, when go konfiguruję, then mogę wskazać model (wyłącznie
      spośród modeli udostępnionych przez administratora), ustawić wysiłek suwakiem i temperaturę —
      osobno dla poszczególnych rodzajów działań — a **nigdzie** nie mam możliwości ustawienia limitu
      odpowiedzi (tokenów).
- [ ] **AC-8** — Given wybrany przeze mnie model nie obsługuje wysiłku lub temperatury, when
      konfiguruję własny poziom, then odpowiedni suwak jest wyłączony wraz z czytelnym wyjaśnieniem
      dlaczego (zamiast cichego ignorowania ustawienia).
- [ ] **AC-9** — Given zapisałem własny poziom, when wysyłam wiadomość do asystenta, then rozmowa
      korzysta z moich ustawień, a wskaźnik poziomu w oknie czatu pokazuje, że działa poziom własny.
- [ ] **AC-10** — Given administrator zmieni modele dostępne w systemie tak, że mój wybór przestaje
      istnieć, when wysyłam wiadomość, then asystent działa dalej (wraca do poziomu standardowego) i
      nie kończy się to błędem.

**Okno czatu (Z3–Z6)**

- [ ] **AC-11** — Given rozwinąłem menu wyboru poziomu pracy, when menu zachodzi na pole wiadomości,
      then żaden element pola (w szczególności migający kursor) nie jest widoczny nad menu.
- [ ] **AC-12** — Given wracam do rozmowy z zapamiętaną, niewysłaną wiadomością, when okno czatu się
      otwiera, then kursor stoi **na końcu** przywróconego tekstu i mogę pisać dalej bez klikania.
- [ ] **AC-13** — Given otwarta jest dowolna sekcja nagłówka (ustawienia / zgłoszenie problemu /
      historia), when klikam tę samą ikonę ponownie, then sekcja się zamyka i wracam do rozmowy.
- [ ] **AC-14** — Given otwarta jest jedna sekcja nagłówka, when otwieram inną, then poprzednia
      zamyka się automatycznie — nigdy nie są otwarte dwie naraz.
- [ ] **AC-15** — Given otwieram historię rozmów, then zawiera ona **wyłącznie** listę rozmów; nowa
      rozmowa jest dostępna z osobnej ikony „+” w nagłówku.
- [ ] **AC-16** — Given jestem na telefonie i istnieje poprzednia rozmowa, when otwieram asystenta,
      then nagłówek mieści się w szerokości ekranu, a strona nie daje się przewijać w poziomie —
      skrót do poprzedniej rozmowy pozostaje dostępny.

**Koszty (Z7)**

- [ ] **AC-17** — Given odpowiedź asystenta wykorzystała pamięć podręczną promptu, when otwieram
      rozbicie kosztu, then widzę wszystkie składowe rozliczane osobno (wejście, wyjście, zapis do
      pamięci podręcznej, odczyt z pamięci podręcznej), więc różnica ceny między składowymi o podobnym
      „wejście+wyjście” jest wytłumaczalna z tego, co widać.
- [ ] **AC-18** — Given znam ceny modelu, when porównam je z kwotą wyliczoną przez aplikację dla
      danego wywołania, then kwoty są zgodne (weryfikowalne rachunkiem na liczbach z rozbicia).
- [ ] **AC-19** — Given administrator zmienia cennik modelu, when robi to z panelu administracyjnego,
      then nowe ceny obowiązują bez wdrożenia nowej wersji aplikacji; brak wpisu w cenniku jest
      **widocznie** oznaczony jako „koszt nieznany”, a nie pokazywany jako zero.
- [ ] **AC-20** — Given wysiłek modelu podnosi liczbę tokenów rozumowania, when patrzę na koszt,
      then tokeny te są ujęte w rozliczeniu (a spec/plan wprost stwierdza, czy i jak wysiłek oraz
      temperatura wpływają na cenę jednostkową).
- [ ] **AC-21** — Given inny moduł zechce w przyszłości pokazać koszt operacji AI, when programista
      sięga po istniejące rozwiązanie, then dysponuje jednym, wspólnym sposobem prezentacji kosztu
      niezwiązanym z oknem asystenta (w tym wdrożeniu użytym wyłącznie w asystencie).

**Właściciele encji (Z8)**

- [ ] **AC-22** — Given w systemie istnieją grupy notatek, etykiety i podpowiedzi zakupowe, when
      wdrożenie zostanie zastosowane, then każdy istniejący rekord ma jako właściciela konto
      administratora.
- [ ] **AC-23** — Given jestem zalogowanym użytkownikiem, when tworzę grupę notatek, etykietę lub gdy
      powstaje podpowiedź zakupowa, then powstały rekord należy do mnie (lub mojego zespołu).
- [ ] **AC-24** — Given istnieją rekordy oznaczone jako systemowe (bez właściciela), when korzystam z
      aplikacji, then nadal je widzę — wspólne słowniki systemowe pozostają wspólne.
- [ ] **AC-25** — Given inny użytkownik ma własne grupy/etykiety/podpowiedzi, when przeglądam swoje,
      then nie widzę jego rekordów ani przez interfejs, ani przez asystenta AI.
- [ ] **AC-26** — Given dokumentacja kontroli dostępu opisywała te encje jako „bez właściciela”, when
      wdrożenie się kończy, then dokumentacja odzwierciedla stan faktyczny.

## 5. Zakres

**W zakresie:**

- Z1 — polskie nazwy **wszystkich** parametrów akcji w podglądzie + bramka jakości pilnująca tego na
  przyszłość.
- Z2 — definiowanie przez administratora trzech poziomów pracy (z dziedziczeniem po standardowym) oraz
  własny poziom użytkownika (model z listy administratora, wysiłek, temperatura; bez limitu tokenów).
- Z3 — naprawa warstw: kursor pola wiadomości nie przebija się przez rozwinięte menu.
- Z4 — kursor na końcu przywróconej wersji roboczej.
- Z5 — spójne zachowanie ikon nagłówka: klik zamyka, jedna sekcja naraz, historia zawiera tylko
  historię, nowa rozmowa pod „+”.
- Z6 — nagłówek asystenta mieszczący się na telefonie mimo skrótu do poprzedniej rozmowy.
- Z7 — rzetelne liczenie i pokazywanie kosztu (pełne rozbicie tokenów, cennik konfigurowalny przez
  administratora, jawne „koszt nieznany”), wydzielenie wspólnego sposobu prezentacji kosztu.
- Z8 — właściciele dla grup notatek, etykiet i podpowiedzi zakupowych; backfill na konto
  administratora; rekordy bez właściciela traktowane jako systemowe.

**Poza zakresem (świadomie):**

- Pokazywanie kosztów w innych modułach (pogoda, kuchnia, magazyn…) — przygotowujemy tylko grunt,
  wdrożenia nie robimy.
- Rozliczanie kosztów w walutach innych niż dotychczasowe (USD + przelicznik PLN) i jakiekolwiek
  fakturowanie/limity kosztowe per użytkownik ponad istniejący budżet dzienny.
- Automatyczne pobieranie cenników od dostawców (ceny wprowadza administrator).
- Zmiana samego mechanizmu doboru modelu przez asystenta (fast-path, router, pętla agenta) poza tym,
  co wynika z poziomów pracy.
- Rozdzielanie istniejących danych między wielu użytkowników w sposób inny niż „wszystko do
  administratora” (właściciel wprost o to prosił, by uprościć migrację).
- Dodawanie właścicieli encjom, które nie były przedmiotem zgłoszenia.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego sluga. Konfiguracja poziomów i cennika = `module.admin`;
  ustawienia własnego poziomu = każdy zalogowany użytkownik (przy swoim koncie). C-22.
- **Własność danych:** grupy notatek i etykiety wchodzą w standardowy model współwłasności
  (właściciel-użytkownik albo właściciel-zespół, wzajemnie wykluczające się), brak właściciela =
  rekord systemowy; podpowiedzi zakupowe stają się per użytkownik. Ustawienia poziomu pracy i własny
  poziom są **wyłącznie** per użytkownik (nie dzielimy ich z zespołem). C-21.
- **Asystent AI:** brak nowych akcji AI i brak nowych narzędzi odczytu. Zmiany dotykają natomiast
  prezentacji akcji (nazwy parametrów) oraz — pośrednio — odczytów notatek/etykiet/podpowiedzi, które
  muszą zacząć respektować właściciela. C-23.
- **Kalendarz / powiadomienia / trash:** kalendarz — nie dotyczy. Powiadomienia — bez zmian poza
  istniejącym alertem kosztowym, który musi pozostać spójny z poprawionym liczeniem. Trash — grupy
  notatek i etykiety pozostają przy dotychczasowym trybie kasowania; feature go nie zmienia.

## 7. Zgodność z konstytucją

- **C-10, C-11, C-12, C-14** — nowe kolumny (właściciele, konfiguracja poziomów, cennik) wymagają
  ręcznie napisanych, idempotentnych plików migracji z unikalnym numerem; poziomy i rodzaje to kolumny
  tekstowe z zawężającym typem TypeScript, **nigdy** enum Prisma.
- **C-13** — weryfikacja wyłącznie na lokalnym Postgresie; żadnego builda ani migracji przeciw
  produkcyjnej bazie.
- **C-20** — wszystkie zapisy (ustawienia poziomu, cennik, właściciele) jako Server Actions z
  `revalidatePath`.
- **C-21** — właściciele nowych/uzupełnionych encji wg modelu `ownerId`/`ownerTeamId` i istniejących
  guardów dostępu, w tym dla odczytów asystenta.
- **C-25** — zmiany konfiguracji poziomów i cennika trafiają do dziennika zmian.
- **C-30, C-31, C-32** — nowe elementy (suwaki, karty poziomów, rozbicie kosztu) na zmiennych CSS, bez
  hardkodowanych kolorów; nagłówek asystenta i ustawienia poprawne na telefonie; wszystkie teksty po
  polsku.
- **C-50** — bramki jakości: istniejące kontrole akcji/dostępu/migracji plus nowa kontrola
  kompletności polskich nazw parametrów (AC-2).
- **C-51** — przyczyna rozjazdu kosztów (niewidoczne tokeny pamięci podręcznej) i pułapka warstw
  (kursor nad rozwiniętym menu) trafiają do `doświadczenia.md`.
- **C-53** — minimalizm: rozbudowujemy istniejący mechanizm przypisań modeli i istniejący wskaźnik
  kosztu zamiast budować równoległe byty.

## 8. Otwarte pytania / decyzje właściciela

Pytania zadano na etapie `/specify` (C-55). Właściciel wybrał **wszystkie cztery warianty
rekomendowane** — poniżej jako wiążące decyzje:

- [x] **Poziomy administratora** — trzy pełne zestawy ustawień per rodzaj operacji, z
      **dziedziczeniem** po poziomie standardowym (puste pole = dziedziczy). Powód: pełna kontrola bez
      trzykrotnego wypełniania tego samego.
- [x] **Własny poziom użytkownika** — model wyłącznie z listy udostępnionej przez administratora +
      wysiłek (suwak) + temperatura, per rodzaj działania, **bez** limitu tokenów. Widok prosty
      (jedna oś jakość ↔ koszt) z rozwijanym trybem zaawansowanym.
- [x] **Właściciele encji** — model `ownerId`/`ownerTeamId`; brak właściciela = rekord systemowy
      (nadal wspólny); wszystkie istniejące rekordy przypisane administratorowi (wprost wskazane przez
      właściciela w zgłoszeniu Z8).
- [x] **Koszty** — pełne rozbicie tokenów (wejście / wyjście / zapis do pamięci podręcznej / odczyt z
      pamięci podręcznej) **oraz** cennik przeniesiony z kodu do konfiguracji administratora, plus
      jawne oznaczenie modelu spoza cennika jako „koszt nieznany”. Wspólny sposób prezentacji kosztu
      wydzielony pod przyszłe moduły, ale użyty na razie tylko w asystencie.

## 9. Ryzyka

- **Backfill właścicieli na produkcji** — dane istnieją i są używane; źle napisana migracja może
  odciąć administratora od jego notatek/etykiet. → Migracja idempotentna, właściciel wyznaczany po
  faktycznym koncie z uprawnieniem administratora, rekordy bez dopasowania zostają systemowe; brak
  twardego wymogu właściciela na poziomie bazy.
- **Etykiety są dziś globalnie unikalne po nazwie** — po dodaniu właściciela dwoje użytkowników może
  chcieć tej samej etykiety. → Unikalność musi zostać przemyślana w planie (zakres unikalności
  zmienia się z globalnego na „per właściciel”), inaczej drugi użytkownik nie założy etykiety.
- **Rozbudowa konfiguracji o trzy poziomy** może rozsypać istniejące przypisania modeli. → Poziom
  standardowy pozostaje dokładnie tym, co jest dziś skonfigurowane; oszczędny i maksymalny startują
  jako w pełni dziedziczone, więc wdrożenie nie zmienia zachowania do czasu świadomej zmiany.
- **Cennik w konfiguracji** — pusty cennik po wdrożeniu wyzerowałby koszty. → Wartości z dzisiejszego
  cennika w kodzie zostają wgrane jako wartości startowe; kod ma z czego korzystać także bez wpisu.
- **Własny poziom użytkownika a koszty** — użytkownik może ustawić najdroższy model i najwyższy
  wysiłek. → Istniejący dzienny budżet AI oraz alert kosztowy administratora pozostają nadrzędne i
  obowiązują niezależnie od poziomu.
- **Warstwy w oknie czatu** — „naprawa” z-indexu bywa grą w kotka i myszkę. → Kryterium akceptacji
  jest obserwowalne (kursor niewidoczny nad menu), a rozwiązanie ma usuwać przyczynę (konflikt
  kontekstów nakładania), nie podbijać kolejnych liczb.
