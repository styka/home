# Biznesplan „Projekt Sekunda" — narzędzia KSeF dla mikrofirm

**Dokument zarządczy — raport dla właściciela.** Autor: Claude (AI, rola: prezes-strateg). Operator: Szymon Tyka (człowiek, rola: właściciel i wykonawca czynności wymagających osoby fizycznej). Data sporządzenia: 29 sierpnia 2026. Wersja 1.0.

> **Czym jest ten dokument.** Kompletny biznesplan przedsięwzięcia o wkładzie własnym 20 000 zł
> i celu 300 000 zł zysku po pierwszym roku. Zawiera: analizę otoczenia i rynku opartą na
> researchu z 29.08.2026 (źródła rządowe, giełdowe i branżowe — pełna bibliografia w rozdz. 13),
> wybór i uzasadnienie modelu biznesowego, plan produktów, plan marketingu bez aktywnej
> sprzedaży, formalności, model finansowy w trzech scenariuszach oraz analizę ryzyka.
> Dokument mówi wprost, co jest faktem (z cytatem i źródłem), a co założeniem.

---

## Spis treści

1. Streszczenie menedżerskie
2. Model operacyjny: AI-prezes + człowiek-operator
3. Dlaczego ten biznes — uzasadnienie wyboru
4. Otoczenie: makroekonomia i regulacje (KSeF)
5. Rynek i popyt — z dowodami
6. Konkurencja
7. Produkty i oferta
8. Marketing i sprzedaż bez kontaktu z klientem
9. Plan operacyjny i harmonogram
10. Formalności: rejestracja, podatki, ZUS, prawo
11. Finanse: budżet 20 000 zł i trzy scenariusze
12. Analiza ryzyka
13. Badania i źródła (bibliografia)
14. Następne kroki — checklista na pierwsze 30 dni

---

## 1. Streszczenie menedżerskie

**Decyzja:** budujemy jednoosobową firmę technologiczną (JDG + AI jako mózg operacyjny),
która sprzedaje w 100% online **proste narzędzia wokół obowiązkowego KSeF** polskim
mikrofirmom: e-book „KSeF bez księgowego" (od XI 2026), **Strażnika KSeF** — powiadomienia
o fakturach przychodzących (od XII 2026), aplikację **Faktura w Sekundę** — najprostsze
fakturowanie z KSeF, mobile-first (od I 2027) oraz, od Q2 2027, **KSeF Most** — API dla
twórców automatyzacji.

**Dlaczego to, dlaczego teraz.** Od 1.04.2026 e-fakturowanie w KSeF jest obowiązkowe dla
wszystkich przedsiębiorców; ostatnie odroczenie — dla firm o sprzedaży ≤10 000 zł/mies. —
kończy się **31.12.2026**, a od 1.01.2027 grożą kary do 100% VAT z faktury. W systemie jest
już ponad 2 mln wystawców i 340 mln faktur, a mimo to **co druga mikrofirma deklaruje, że
nie jest przygotowana** (badanie ifirmy, II/III 2026). To wymuszony przepisami popyt
milionowej skali, skumulowany dokładnie w naszym oknie startowym. Że na tym segmencie da
się zarabiać, wiemy nie z wiary, lecz ze sprawozdań: notowana na GPW **ifirma S.A.** miała
w 2025 r. 63,4 mln zł przychodu i 13 mln zł zysku netto, a **Fakturownia** — 28,7 mln zł
przychodu przy ~38% marży netto (rozdz. 5.3).

**Dopasowanie do ograniczeń właściciela** (ustalonych 29.08.2026): czas <10 h/tydz. z rampą
„zwiększę, gdy będą pieniądze" i minimum kontaktu z klientami. Model jest pod to
zaprojektowany: sprzedaż samoobsługowa (checkout online), marketing = treści i SEO
(pisze AI), support asynchroniczny z szablonów. Kod, analizy i marketing wytwarza AI;
człowiek wykonuje to, czego AI nie może: urzędy, konta, certyfikaty, wdrożenia (rozdz. 2).

**Finanse w trzech scenariuszach** (12 miesięcy, kasowo, podatek liczony ostrożnie — 12%
ryczałtu; rozdz. 11):

| Scenariusz | Prawdop. | Przychód rok 1 | Wynik rok 1 | Stan na koniec |
|---|---|---|---|---|
| Ostrożny | ~30% | ~40 tys. zł | ≈ +4 tys. zł | MRR ~5 tys. zł; firma bez długów |
| **Bazowy** | ~50% | ~135 tys. zł | **≈ +80–85 tys. zł** | MRR ~15 tys. zł i rośnie |
| Ambitny | ~10–20% | ~400 tys. zł | **≈ +300 tys. zł** | MRR ~60 tys. zł |

**Uczciwa odpowiedź na zadany cel.** 300 000 zł zysku w 12 miesięcy z 20 000 zł kapitału
przy starcie od zera to wynik z górnych ~15% rozkładu — osiągalny wyłącznie w scenariuszu
ambitnym, którego pięć warunków spisano w rozdz. 11.3 (m.in. brak kolejnego odroczenia KSeF,
top-3 w Google przed grudniem i rampa czasowa właściciela od stycznia). **Scenariusz bazowy
osiąga cel 300 tys. zł w roku drugim** — siłą rosnącej bazy abonamentowej, bez dodatkowego
kapitału. Plan celuje w ambitny, wykonuje się identycznie w obu, a różnicę rozstrzygają
liczby w punktach decyzyjnych (rozdz. 11.4), nie dzisiejsze nadzieje. Ryzyko kapitału jest
ścięte z góry: porażka walidacji w M1 kosztuje ~3 000 zł, nie 20 000 zł.

**Czego plan wymaga od właściciela w M0 (wrzesień 2026):** ~10 godzin na formalności
(CEIDG, bank, płatności, konta) wg checklisty z rozdz. 14 — reszta jest po stronie AI.

---

## 2. Model operacyjny: AI-prezes + człowiek-operator

### 2.1. Podział ról

Przedsięwzięcie jest prowadzone w nietypowym, ale świadomie zaprojektowanym modelu: **AI pełni
funkcję mózgu operacyjnego** (strategia, kod, treści, analizy, decyzje produktowe), a **człowiek
wykonuje czynności zarezerwowane dla osoby fizycznej** (podpisy, urzędy, konta bankowe,
certyfikaty, wdrożenia na produkcję, sporadyczny support). Ten model ma już dowód wykonalności:
system Omnia — aplikacja licząca ~20 modułów, ponad 270 migracji bazy danych i kilkadziesiąt
zautomatyzowanych bramek jakości — została zbudowana dokładnie w tym trybie pracy.

| Obszar | Claude (AI) | Szymon (człowiek) |
|---|---|---|
| Strategia i decyzje | przygotowuje analizy, rekomenduje, pisze ten plan | zatwierdza decyzje nieodwracalne i wydatki |
| Produkt (kod) | projektuje, programuje, testuje, pisze dokumentację | przegląda, wdraża na produkcję, trzyma klucze |
| KSeF / certyfikaty | przygotowuje integrację i instrukcje krok po kroku | uwierzytelnia firmę w KSeF (profil zaufany/pieczęć), pobiera tokeny |
| Marketing | pisze artykuły SEO, teksty reklam, e-booka, posty | zakłada konta (Google Ads, FB), podpina płatności, klika „publikuj" |
| Sprzedaż | buduje samoobsługowy sklep/checkout, automatyzuje | brak aktywnej sprzedaży — zgodnie z ograniczeniem właściciela |
| Support | pisze bazę wiedzy, szablony odpowiedzi, automatyczne FAQ | odpowiada na maile eskalowane (docelowo <1 h/tydz.) |
| Formalności | przygotowuje wnioski, pisma, ewidencje | CEIDG, bank, urząd skarbowy, ewentualne wizyty osobiste |
| Finanse | prowadzi model finansowy, liczy KPI, pilnuje budżetu | opłaca faktury, ZUS, podatki (z przygotowanych przelewów) |

### 2.2. Uczciwa nota prawna o „AI-prezesie"

Polskie prawo nie zna pojęcia „AI jako organ spółki" ani „AI jako przedsiębiorca". Formalnie
przedsiębiorcą jest **Szymon Tyka prowadzący JDG** — on ponosi odpowiedzialność prawną i
podatkową, on podpisuje dokumenty i tylko jego decyzje mają skutek prawny. „AI-prezes" jest
wewnętrznym podziałem pracy, nie konstrukcją prawną. Ten plan traktuje to jako **zaletę
operacyjną** (mózg pracujący 24/7, koszt krańcowy bliski zera), ale nigdzie nie opiera na tym
żadnego twierdzenia prawnego.

### 2.3. Rytm pracy przy ograniczeniu <10 h/tygodniowo

Ograniczenie czasowe właściciela jest **twardym parametrem projektowym**, nie przeszkodą do
obejścia. Plan zakłada:

- **2 sesje robocze po ~2 h tygodniowo** (np. wtorek wieczór + sobota rano): przegląd zadań
  przygotowanych przez AI, decyzje, wdrożenia, sprawy kontowe.
- **1 h tygodniowo asynchronicznie**: support z gotowych szablonów, drobne akceptacje.
- **Rampa czasowa** (decyzja właściciela z 29.08.2026): gdy miesięczny przychód przekroczy
  ustalone progi, właściciel zwiększa zaangażowanie — szczegóły w rozdz. 11.4.
- Wszystko, co da się zautomatyzować, jest automatyzowane (CI/CD, monitoring, alerty,
  odpowiedzi na typowe pytania, onboarding klienta bez udziału człowieka).

Zasada nadrzędna: **żaden element modelu biznesowego nie może wymagać aktywnej sprzedaży ani
regularnej dyspozycyjności człowieka w godzinach roboczych.** Klient kupuje, wdraża się i płaci
samoobsługowo.

---

## 3. Dlaczego ten biznes — uzasadnienie wyboru

### 3.1. Kryteria brzegowe (od właściciela)

1. Wkład własny: **20 000 zł** — wyklucza handel towarem, produkcję, lokal, flotę.
2. Cel: **300 000 zł zysku w 12 miesięcy** — wyklucza modele o niskiej marży i liniowej
   zależności przychodu od czasu pracy.
3. Czas właściciela: **<10 h/tydz., nieregularnie, z rampą** — wyklucza usługi rozliczane
   godzinowo, agencję, konsulting.
4. **Minimum kontaktu z klientem** — wyklucza aktywną sprzedaż, spotkania, telefony; sprzedaż
   musi być w 100% samoobsługowa (internet).
5. Kompetencje właściciela: **IT/programowanie + prace manualne** — pełne wykorzystanie
   pierwszej, druga jako rezerwa (montaż/serwis nie skaluje się bez czasu, więc nie jest osią).

### 3.2. Rozważone i odrzucone alternatywy

| Pomysł | Dlaczego odpada |
|---|---|
| Agencja automatyzacji AI dla firm | przychód = godziny × stawka; wymaga sprzedaży aktywnej i dyspozycyjności — łamie kryteria 3 i 4 |
| Inwestowanie 20 000 zł na giełdzie (GPW/ETF) | matematycznie niewiarygodne: 300 000 zł zysku z 20 000 zł to +1400% rocznie; długoterminowa średnia szerokiego rynku akcji to kilka–kilkanaście % rocznie, a strategie lewarowane grożą utratą całości kapitału. Giełdy używamy w tym planie jako źródła DOWODÓW rynkowych, nie jako wehikułu zysku |
| Handel / dropshipping | marże 10–30%, wymaga obsługi zwrotów i reklam od pierwszego dnia; 20 000 zł to za mało na zapas i marketing jednocześnie |
| Automaty vendingowe / myjnia | kapitałochłonne (jeden automat to 5–15 tys. zł, przychód z jednego: setki zł/mies.); 300 tys. zł zysku wymagałoby dziesiątek maszyn |
| Produkty cyfrowe globalne (EN) | przeszedł do finału; odrzucony decyzją właściciela z 29.08.2026 na rzecz rynku polskiego (mniejsza konkurencja, przewaga językowo-regulacyjna) |

### 3.3. Wybór: narzędzia online dla polskich mikrofirm wokół obowiązkowego KSeF

Wybieram ten kierunek, bo w jednym punkcie zbiegają się **cztery rzadkie okoliczności**:

1. **Przymus regulacyjny tworzy popyt.** Od 1.02/1.04.2026 e-fakturowanie w KSeF jest w Polsce
   obowiązkowe, a 1.01.2027 kończy się ostatnie odroczenie (najmniejsze firmy) i zaczynają
   kary — szczegóły i źródła w rozdz. 4.2. Setki tysięcy mikrofirm MUSZĄ zmienić sposób
   fakturowania w ciągu najbliższych 4 miesięcy od daty tego dokumentu. To popyt, którego nie
   trzeba wytwarzać reklamą — wystarczy stanąć tam, gdzie ci ludzie szukają pomocy.
2. **Samoobsługowa sprzedaż jest w tej kategorii normą.** Programy do faktur kupuje się online,
   bez handlowca (tak sprzedają wszyscy liczący się gracze — rozdz. 6). Model spełnia warunek
   „minimum kontaktu".
3. **Właściciel-programista + AI = koszt wytworzenia bliski zera.** Jedyny realny koszt
   konkurentów (zespoły deweloperskie) u nas nie występuje. 20 000 zł wystarcza, bo nie
   płacimy za kod.
4. **Rynek jest udowodniony publicznie.** Notowana na GPW ifirma S.A. i prywatni gracze
   (Fakturownia, inFakt) od lat zarabiają na tym segmencie realne pieniądze — liczby w
   rozdz. 5.3. Nie zgadujemy, czy Polacy płacą za fakturowanie online; wiemy to ze sprawozdań
   giełdowych.

Jednocześnie plan **nie ignoruje** dwóch niewygodnych faktów: istnieje darmowa aplikacja
rządowa (rozdz. 6.1) i istnieją więksi konkurenci (rozdz. 6.2). Odpowiedzią jest ostra
specjalizacja: robimy narzędzia **prostsze, węższe i tańsze**, dla ludzi, których tamte
rozwiązania przerastają — oraz produkty, których nikt nie robi jako samodzielnych (Strażnik
KSeF, rozdz. 7.2).

---

## 4. Otoczenie: makroekonomia i regulacje

### 4.1. Makroekonomia (tło)

Stan na 29.08.2026 (źródła w rozdz. 13.1):

- **Stopa referencyjna NBP: 3,75%** — utrzymana na czterech kolejnych posiedzeniach RPP
  (kwiecień–lipiec 2026); prezes NBP zasygnalizował możliwy wniosek o obniżkę o 25 pb na
  posiedzeniu 1–2 września 2026. Tanienie pieniądza sprzyja drobnym wydatkom firmowym.
- **Inflacja CPI: 3,0% r/r (lipiec 2026, GUS)** — głównym motorem paliwa (powrót 23% VAT);
  żywność -0,4% r/r. Projekcja NBP z lipca 2026: średniorocznie 2,9% (2026) i 2,7% (2027).
- **PKB:** projekcja NBP 3,7% (2026) i 2,8% (2027); Komisja Europejska (Spring Forecast,
  maj 2026): 3,5% i 2,8% — **najwyższy wzrost wśród dużych gospodarek UE**; inwestycje
  +6,9% w 2026.
- **GPW jako barometr sektora:** WIG zamknął 2025 r. wynikiem **+47,3% (najlepszy rok od
  1996)**, a WIG-informatyka był trzecim najlepszym indeksem sektorowym; w sierpniu 2026
  indeks jest ~40% nad dołkiem z 52 tygodni mimo bieżącej korekty.

**Wniosek:** otoczenie neutralne-do-sprzyjającego. Wzrost gospodarczy ~3%, spadające stopy
i rosnące koszty pracy w mikrofirmach raczej ZWIĘKSZAJĄ popyt na tanie narzędzia
oszczędzające czas, niż go tłumią. Żaden element planu nie wymaga hossy — produkt za
9–39 zł/mies. jest odporny na cykl koniunkturalny (to koszt rzędu jednej kawy, chroniący
przed karą skarbową).

### 4.2. Regulacje: KSeF — silnik całego planu

Krajowy System e-Faktur (KSeF) to rządowa platforma, przez którą faktury B2B w Polsce muszą
być wystawiane w formie ustrukturyzowanej. Harmonogram przymusu (potwierdzony 29.08.2026 w
kilku niezależnych źródłach — pełne odnośniki w rozdz. 13):

| Data | Kogo obejmuje obowiązek |
|---|---|
| **1 lutego 2026** | wystawianie w KSeF: podatnicy o obrocie za 2024 r. powyżej 200 mln zł |
| **1 kwietnia 2026** | wystawianie w KSeF: wszyscy pozostali przedsiębiorcy |
| **do 31 grudnia 2026** | wyjątek: firmy o sprzedaży do 10 000 zł brutto miesięcznie mogą jeszcze fakturować po staremu |
| **1 stycznia 2027** | koniec wyjątku — obowiązek obejmuje także najmniejszych; **startują kary** |

Cztery fakty z tego harmonogramu niosą cały plan:

1. **Obowiązek odbierania faktur przez KSeF dotyczy wszystkich firm już od lutego 2026** —
   także tych, które same jeszcze nie muszą wystawiać. Firma, która nie zagląda do KSeF,
   może nie wiedzieć o otrzymanej fakturze kosztowej. Na tym stoi produkt „Strażnik KSeF"
   (rozdz. 7.2).
2. **Najmniejsze firmy (sprzedaż ≤10 000 zł/mies.) wchodzą 1 stycznia 2027** — czyli
   dokładnie w oknie startowym naszych produktów (Q4 2026). To jest nasz segment docelowy:
   najliczniejszy, najmniej obsłużony przez drogie systemy, najbardziej spanikowany.
3. **Od 1 stycznia 2027 obowiązują sankcje** — administracyjne kary pieniężne sięgające
   do 100% kwoty VAT z faktury wystawionej poza systemem. Do końca 2026 r. trwa okres
   „edukacyjny" bez kar. Strach przed karą to najsilniejszy motor konwersji w historii
   tej kategorii produktów.
4. **Terminy bywały przesuwane** (pierwotnie obowiązek miał wejść w lipcu 2024 r.) — to
   ryzyko R1 w rozdz. 12; plan nie stoi wyłącznie na przymusie.

Dostęp techniczny: Ministerstwo Finansów publikuje otwartą dokumentację API KSeF 2.0 wraz ze
środowiskiem testowym — integracja nie wymaga niczyjej zgody handlowej ani opłat
licencyjnych. Dokumentacja i przykłady leżą publicznie na GitHubie (licencja MIT, specyfikacja
OpenAPI, oficjalne SDK w C# i Javie), a środowisko testowe `api-test.ksef.mf.gov.pl` przyjmuje
certyfikaty self-signed, czyli jest otwarte dla każdego dewelopera od zaraz. **Program do
fakturowania nie wymaga w Polsce żadnej certyfikacji ani zgłoszenia** — „certyfikat KSeF" to
środek uwierzytelnienia podatnika, nie atest oprogramowania (biznes.gov.pl, poz. 004651).
Jedna pułapka techniczna, którą plan od razu omija: **tokeny autoryzacyjne KSeF tracą ważność
31.12.2026** — od 1.01.2027 działają wyłącznie certyfikaty, więc budujemy od pierwszego dnia
na certyfikatach (szczegóły w rozdz. 6.3 i 7).

---

## 5. Rynek i popyt — z dowodami

### 5.1. Wielkość rynku (dane oficjalne)

- **2 875 994 aktywnych przedsiębiorstw** w Polsce (GUS, III kw. 2025), z czego **95,9% to
  mikrofirmy**. Raport PARP 2025: *„W 2024 r. w Polsce działało 2 307,8 tys.
  mikroprzedsiębiorstw, czyli 97,2% wszystkich przedsiębiorstw niefinansowych."*
- Dynamika przedsiębiorczości: w samym 2025 r. złożono **288,8 tys. wniosków o założenie
  JDG** — co roku przybywa świeżych firm, które od pierwszego dnia potrzebują fakturowania
  (nowy klient dla nas, bez konieczności odbijania go konkurencji).
- Obowiązek KSeF obejmuje docelowo **ponad 2,8 mln podmiotów**; już po czterech miesiącach
  działania systemu (luty–maj 2026) w KSeF było **ponad 2 mln wystawców i ~290 mln faktur**
  (komunikaty MF), a po ~pół roku ponad 340 mln dokumentów.

### 5.2. Popyt: rynek jest w połowie drogi i się boi

Badania gotowości z ostatnich miesięcy (pełne źródła w rozdz. 13.2):

| Badanie | Termin | Kluczowy wynik |
|---|---|---|
| inFakt „Indeks 2025" | XI 2025 | 78% firm słyszało o KSeF, ale **wdrożyło tylko 13%**; 18% „nie zamierza wcale" |
| SaldeoSMART | XII 2025 | **34% firm MŚP nieprzygotowanych** |
| ifirma (mikro/małe firmy) | II/III 2026 | *„co drugi ankietowany uważa, że jego firma w ogóle nie jest przygotowana"*; 45% ocenia wdrożenie KSeF negatywnie; tylko ~18% wystawia w nim faktury codziennie |
| SaldeoSMART (dane systemowe) | poł. 2026 | **~20% faktur korygujących zawiera błędy**, ~10% wszystkich faktur ma niekompletne XML |

Do tego twardy kalendarz: segment firm o sprzedaży ≤10 000 zł/mies. — najliczniejszy i
najsłabiej przygotowany — ma deadline **1 stycznia 2027**, dokładnie w oknie startowym
naszych produktów. Popyt „ostatniej chwili" skumuluje się w listopadzie–styczniu.

### 5.3. Dowód z giełdy: na tym segmencie zarabia się naprawdę

Nie opieramy się na deklaracjach — sprawdziliśmy sprawozdania spółek publicznych i rejestry:

- **ifirma S.A. (GPW: IFI)** — najbliższy publiczny odpowiednik naszego modelu (księgowość
  internetowa + fakturowanie dla mikrofirm, sprzedaż wyłącznie online): przychody 2025:
  **63,4 mln zł (+8,8% r/r)**, zysk netto **13,0 mln zł (+55% r/r)**, marża netto 21%,
  kapitalizacja ~160 mln zł, dywidenda 6,79 zł/akcję z zysku 2025. ~97% przychodów z
  abonamentów serwisu ifirma.pl.
- **Fakturownia sp. z o.o.** (czysty SaaS do faktur, bez księgowości — model najbliższy P2):
  przychody 2021→2023: **15,5 → 21,7 → 28,7 mln zł**, zysk netto 2023: **11,0 mln zł
  (marża ~38%)**; deklaruje ~600 tys. użytkowników. Tani abonament × duża liczba mikrofirm
  = kilkudziesięcioprocentowa marża netto — dokładnie mechanika naszego planu.
- **Asseco Business Solutions (GPW: ABS)**: I kw. 2026 przychody **+20,6% r/r**, zysk netto
  **+51% r/r** — zarząd wprost wskazuje KSeF; CFO Mariusz Lizon: *„Myślę, że KSeF będzie nam
  zasilał przychodami cztery kwartały."* Platforma Businesslink przesłała **ponad 2 mln
  e-faktur w pierwszym miesiącu** obowiązkowego KSeF.
- **Comarch** został w 2025 r. zdjęty z GPW przez fundusz **CVC Capital Partners** (wykup
  78,5% kapitału) — kapitał private equity uznał polskie oprogramowanie dla firm za aktywo
  warte wyjęcia z giełdy. Od 31.07.2026 Comarch **skończył darmowy okres KSeF** i pobiera
  opłaty za moduł (od 15 zł/mies.) — rynek przeszedł od rozdawania do monetyzacji.

**Wniosek:** pytanie nie brzmi „czy polskie mikrofirmy płacą za fakturowanie online" — płacą,
na skalę dziesiątek milionów złotych rocznie, z marżami 21–38%. Pytanie brzmi tylko, czy
umiemy odciąć własny, wąski kawałek tego rynku. Temu służy pozycjonowanie z rozdz. 6.3 i 7.

### 5.4. Cyfrowa luka — nasze pole gry

- KPMG & Microsoft (Monitor Transformacji Cyfrowej Biznesu): **38% polskich firm nadal
  opiera procesy finansowe na dokumentach papierowych**, a ponad 40% nie ma pełnej
  automatyzacji obiegu faktur; ~43% wciąż używa faktur papierowych.
- Raport BGK „Cyfryzacja w sektorze MŚP" (2026): *„Co piąte przedsiębiorstwo nie korzysta
  z żadnych narzędzi cyfrowych wymienionych w badaniu — są to prawie wyłącznie
  mikroprzedsiębiorstwa."*
- Od 1.04.2026 faktura z Worda/Excela **przestała być legalną formą** dla objętych
  obowiązkiem (poza wyłączeniem ≤10 tys. zł/mies. — do końca 2026).

Setki tysięcy firm, które dotąd „jakoś sobie radziły", muszą w ciągu miesięcy przejść na
narzędzie cyfrowe. Większość z nich nie chce systemu księgowego — chce wystawić fakturę
i mieć spokój. To jest definicja naszego klienta.

---

## 6. Konkurencja

### 6.1. Darmowe narzędzia państwowe — sufit możliwości

| Narzędzie | Co daje | Czego nie daje |
|---|---|---|
| **Aplikacja Podatnika KSeF 2.0** (MF, bezpłatna) | ręczne wystawienie prostej faktury zgodnej z KSeF | integracji z czymkolwiek, automatyzacji, bazy klientów i produktów, powiadomień |
| **e-mikrofirma** (MF, bezpłatna) | faktury + ewidencja VAT + JPK dla samodzielnie rozliczających się | faktur zagranicznych; wygody (ocena rynku niżej) |

Branżowa ocena pierwszej: *„Aplikacja Podatnika nie jest pełnoprawnym systemem do
fakturowania — jej głównym celem jest umożliwienie wystawienia ręcznie prostej faktury
zgodnie z wymogami KSeF"* (ksef.pl). Druga doczekała się celnej diagnozy: *„E-Mikrofirma
wystarcza, dopóki faktury to dla Ciebie tylko obowiązek podatkowy. Przestaje wystarczać,
gdy faktura ma pracować — przyspieszać płatność, pilnować terminu, spinać się z bankiem
i księgową"* (mizzox.com). Nasza strategia wobec darmowych narzędzi MF: **nie konkurujemy
z nimi — dziedziczymy ich rozczarowanych**. Treści huba (rozdz. 8.2) uczciwie pokazują,
jak używać narzędzi MF; kto się o nie otłucze, ma nas o jeden klik dalej.

### 6.2. Konkurencja komercyjna — mapa cen (zestawienia 2026, do weryfikacji na cennikach)

| Gracz | Darmowy plan | Płatne (netto/mies.) | Uwagi |
|---|---|---|---|
| Fakturownia | 0 zł do 3 faktur/mies. | 9,99 / 22,77 / 39,99 zł | lider niezależnych; ~600 tys. użytkowników |
| inFakt | 0 zł do 3 faktur/mies. | faktury 4,99 zł; księgowość od 49,99 zł | agresywna cena wejścia, up-sell do księgowości |
| wFirma | — | 19 / 49 / 99 zł | pełny kombajn księgowy |
| ifirma | 0 zł do 3 faktur/mies. | Faktura+ 12,50 zł; księgowość 49 zł | spółka z GPW (rozdz. 5.3) |
| Faktura.pl | plan „KSeF" 0 zł | od 18,99 zł | ceny przy cyklu 3-letnim |
| Streamsoft Firmino | 0 zł (z KSeF i CRM) | Basic 11,60 zł | darmowy plan bogaty |
| **Banki: mBank, PKO BP, ING** | **faktury KSeF bez limitu, 0 zł** dla klientów banku | pakiety księgowe płatne | najgroźniejszy „konkurent cenowy" |
| Comarch ERP XT | darmowy KSeF skończył się 31.07.2026 | od ~79 zł; moduł KSeF od 15 zł | segment wyżej |

Dwa wnioski strategiczne:

1. **„Darmowy plan" nie jest przewagą** — rozdają go wszyscy, z bankami na czele. Przewagą
   może być tylko produkt: szybkość, prostota, mobilność, automatyzacja.
2. **Nikt z powyższych nie jest mobile-first i nikt nie sprzedaje prostoty** — każdy
   dokłada funkcje księgowe, bo tam jest up-sell. Segment „chcę TYLKO fakturę, w 30 sekund,
   z telefonu" jest obsługiwany przez wszystkich przy okazji i przez nikogo na serio.

### 6.3. Luki rynkowe potwierdzone researchem (29.08.2026)

1. **Monitoring skrzynki KSeF jako samodzielna usługa** — obowiązek odbierania faktur mają
   wszyscy od lutego 2026, narzędzia MF **nie powiadamiają aktywnie**, a jakość danych w
   systemie jest niska (~10% niekompletnych XML). Nikt nie sprzedaje „strażnika" osobno,
   tanio, bez pakietu księgowego. → produkt P1 (rozdz. 7.2).
2. **Automatyzacje: żadnych konektorów KSeF w Make, Zapier ani n8n** — bo KSeF wymaga
   uwierzytelnienia certyfikatem (PKCS#12), którego platformy no-code nie obsługują.
   Istniejące obejścia społeczności stoją na tokenach, a **tokeny KSeF tracą ważność
   31.12.2026** (od 1.01.2027 wyłącznie certyfikaty) — cała ta prowizorka umrze w sylwestra.
   → produkt P4 „KSeF Most" (rozdz. 7.4) na rynku, który dopiero się otworzy.
3. **Skrajna prostota dla JDG** — okno cenowe 10–30 zł/mies. między darmowymi „3 faktury"
   a kombajnami. → produkt P2 (rozdz. 7.3).
4. **Segment „ostatniej chwili"** — najmniejsi (≤10 tys. zł/mies.) wchodzą 1.01.2027;
   szczyt paniki listopad 2026 – styczeń 2027 pokrywa się z naszym startem. → cała oś
   czasu marketingu (rozdz. 8–9).

### 6.4. Bariery wejścia — i dlaczego działają NA naszą korzyść

Integracja z KSeF 2.0 jest otwarta (publiczna dokumentacja API na licencji MIT, OpenAPI,
darmowe środowisko testowe, oficjalne SDK), ale **nietrywialna**: certyfikaty
kryptograficzne, XAdES/PKCS#12, sesje, UPO, tryby offline. Dla platform no-code i
niedzielnych klonów to zapora; dla zawodowego programisty wspieranego przez AI —
kilkanaście dni pracy. Rzadki układ: bariera dość wysoka, by odsiać masową konkurencję,
i dość niska, byśmy przeszli ją bez kapitału.

---

## 7. Produkty i oferta

### 7.0. Zasada portfela: jeden klin, jeden okręt flagowy, jedna dźwignia gotówki

Nie budujemy jednego produktu „na wszystko" — budujemy **portfel trzech produktów o wspólnym
rdzeniu** (konto firmy, uwierzytelnienie KSeF, płatności), uruchamianych w kolejności od
najszybszego do najambitniejszego. Każdy kolejny produkt sprzedaje się ruchowi zbudowanemu
przez poprzedni.

### 7.1. P3 (pierwszy strzał, listopad 2026): e-book + kurs „KSeF bez księgowego"

- **Co to jest:** praktyczny przewodnik dla właściciela JDG: jak wystawić pierwszą fakturę w
  KSeF, jak odbierać faktury kosztowe, jak nie dostać kary od 1.01.2027, z ilustrowanymi
  instrukcjami krok po kroku (profil zaufany, Aplikacja Podatnika, tokeny). Wersja rozszerzona:
  krótkie wideo-lekcje (ekran + lektor TTS, bez twarzy właściciela).
- **Cena:** 49 zł (e-book) / 99 zł (e-book + wideo). Sprzedaż własna strona + Allegro.
- **Po co w portfelu:** (a) najszybszy możliwy przychód — produkt powstaje w 2–3 tygodnie;
  (b) walidacja SEO — strona sprzedażowa e-booka to jednocześnie hub treści, który zaczyna
  budować pozycje w Google na frazy „ksef jak wystawić fakturę", „ksef 2027 mikrofirma" itd.;
  (c) każdy kupujący to lead na P1/P2.
- **Praca człowieka:** założenie konta sprzedażowego i płatności (jednorazowo), reszta
  automatyczna.

### 7.2. P1 (klin, grudzień 2026): „Strażnik KSeF" — powiadomienia o fakturach

- **Problem (potwierdzony w źródłach, rozdz. 4.2):** obowiązek ODBIERANIA faktur przez KSeF
  dotyczy wszystkich firm już od lutego/kwietnia 2026 — także tych, które same jeszcze nie
  muszą wystawiać. Mikrofirma, która nie zagląda do KSeF, nie wie, że dostała fakturę
  kosztową: termin płatności biegnie, kontrahent czeka, odliczenie VAT umyka. Duzi gracze
  mają tę funkcję ukrytą w środku pełnych pakietów księgowych; **jako samodzielnej, taniej
  usługi nie oferuje jej prawie nikt**.
- **Co robi:** łączy się z KSeF certyfikatem firmy (kreator krok po kroku w produkcie;
  celowo od razu certyfikat, nie token — tokeny tracą ważność 31.12.2026, rozdz. 4.2),
  sprawdza skrzynkę co godzinę i wysyła e-mail/SMS: „Masz nową fakturę od X na 1 230 zł,
  termin 14 dni". Raz w tygodniu podsumowanie. Zero księgowości, zero konfiguracji.
- **Cena:** 9 zł/mies. lub 79 zł/rok (impulsowa, „taniej niż jedna kawa"). 14 dni za darmo.
- **Po co w portfelu:** (a) produkt jest mały (tygodnie, nie miesiące pracy), więc szybko
  zaczyna zarabiać i uczy nas KSeF API na produkcji przed startem P2; (b) idealny klin
  marketingowy — konkretny strach („przegapisz fakturę → kara/odsetki") dobrze konwertuje;
  (c) niszowa fraza SEO bez konkurencji.
- **Praca człowieka:** rejestracja środowiska produkcyjnego KSeF (wymaga uwierzytelnienia
  osobą fizyczną), potem brak.

### 7.3. P2 (okręt flagowy, styczeń–luty 2027): „Faktura w Sekundę"

- **Dla kogo:** JDG i mikrofirmy wystawiające 1–30 faktur miesięcznie, bez księgowej lub z
  księgową zewnętrzną, dla których inFakt/wFirma to armata na wróbla, a rządowa aplikacja —
  formularz urzędowy.
- **Obietnica:** *wystaw poprawną fakturę do KSeF w 30 sekund, z telefonu.* Wpisujesz NIP —
  dane kontrahenta zaciągają się same (biała lista/GUS). Piszesz lub dyktujesz „montaż mebli
  2500 netto" — AI układa pozycje, stawkę VAT podpowiada z historii. Wyślij → w tle idzie do
  KSeF, wraca UPO, klient dostaje PDF/link. Przypomnienie, gdy minie termin płatności.
  Odbiór faktur kosztowych = wbudowany Strażnik.
- **Czego świadomie NIE robi:** pełnej księgowości, KPiR, deklaracji, magazynu, kadr. To nie
  jest „mały inFakt" — to najkrótsza droga od roboty do zapłaty. Eksport paczki faktur
  (CSV/JPK) dla księgowej zamyka temat współpracy z biurem.
- **Cennik:** Free — 3 faktury/mies. (nawyk + polecenia). **Solo 19 zł/mies.** (bez limitu,
  Strażnik w cenie). **Pro 39 zł/mies.** (wielu odbiorców, API/webhooki, automatyzacje,
  faktury cykliczne). Rocznie: 2 miesiące gratis. Early-bird dla pierwszych 500 kont:
  Solo 149 zł/rok — buduje bazę recenzji i gotówkę na starcie.
- **Praca człowieka:** wdrożenia produkcyjne, przegląd zgłoszeń raz w tygodniu.

### 7.4. P4 (od Q2 2027 — dźwignia wzrostu): „KSeF Most" — API i automatyzacje

Research ujawnił lukę wartą osobnego produktu: **w Make, Zapier ani n8n nie istnieją
konektory KSeF** (platformy no-code nie obsługują uwierzytelnienia certyfikatem PKCS#12),
a obejścia społeczności stoją na tokenach, które **umierają 31.12.2026**. „KSeF Most" to
bezpieczny pomost: klient wgrywa certyfikat u nas, a dostaje proste REST API + webhooki
(„nowa faktura przyszła") + oficjalny węzeł n8n i szablony automatyzacji. Cennik wyżej niż
konsumencki (49–99 zł/mies.), klient = twórcy automatyzacji i małe softwarehouse'y — rynek,
który 1.01.2027 obudzi się z niedziałającymi integracjami. Pozostałe dźwignie H2 2027:
- **Wersja dla biur rachunkowych** (panel wielu klientów) — tylko jeśli pojawi się ssanie z
  rynku; wymaga więcej supportu, więc decyzja przy rampie czasowej.
- **Białe etykiety / partnerstwa** — z ostrożnością, bo dotykają ograniczenia kontaktowego.

### 7.5. Zasady budowy (przewagi trwałe)

1. **Prostota jako pozycjonowanie**, nie brak funkcji: każda funkcja musi bronić 30 sekund do
   faktury.
2. **AI w środku, nie na plakacie:** parsowanie pozycji, podpowiedzi stawek, odpowiedzi
   supportu — tam, gdzie oszczędza sekundy, bez sloganu „AI-powered".
3. **Mobile-first:** konkurenci są desktop-first; nasz klient wystawia fakturę na budowie,
   w aucie, u klienta.
4. **Wszystko po polsku, w języku człowieka**, nie księgowej: „pieniądze, które Ci wiszą",
   nie „należności przeterminowane".

---

## 8. Marketing i sprzedaż bez kontaktu z klientem

### 8.1. Zasada naczelna: klient przychodzi sam albo nie przychodzi wcale

Ograniczenie właściciela („minimum kontaktu") zamieniamy w strategię: **cały marketing to
treści i wyszukiwarka, cała sprzedaż to samoobsługowy checkout.** Żadnego dzwonienia,
żadnych spotkań, żadnego „umów demo". To nie jest kompromis — w segmencie narzędzi za
9–39 zł/mies. handlowiec i tak się nie spina ekonomicznie; wszyscy liczący się gracze
sprzedają self-serve.

### 8.2. SEO i treści — główny kanał (koszt krańcowy ≈ 0)

Mechanika: ludzie, których w Q4 2026 i w 2027 r. przymus KSeF zastanie nieprzygotowanych,
będą **wpisywać pytania w Google**. Kto ma najlepsze odpowiedzi, temu nie potrzeba reklam.

- **Hub treści** (uruchamiany w M0–M2, rozdz. 9.1): docelowo 60–100 artykułów odpowiadających
  na konkretne pytania: „jak wystawić fakturę w KSeF krok po kroku", „KSeF 2027 mikrofirma
  limit 10 tys.", „kara za brak KSeF", „KSeF a zwolnienie z VAT", „jak odebrać fakturę z
  KSeF", „KSeF token jak wygenerować" itd. Research (29.08.2026) pokazał, że na frazę
  główną „KSeF" konkurencja SEO jest już silna (cały ekosystem serwisów porównawczych powstał
  w 2025–2026), ale **długie ogony są płytkie**: „KSeF dla nievatowca", „KSeF limit 10 tys.
  miesięcznie", „aplikacja podatnika ograniczenia", „KSeF certyfikat zamiast tokenu 2027" —
  tam wchodzimy. Dokładne wolumeny fraz wymagają konta w Keyword Planner/Senuto — zadanie
  [TY] w M0 (jednorazowo, ~30 min), progi decyzyjne w rozdz. 11.4.
- **Przewaga wykonawcza:** AI pisze i aktualizuje artykuły przy koszcie krańcowym bliskim
  zera; człowiek tylko publikuje. Konkurencja płaci agencjom za każdy tekst. Aktualizacja po
  każdym komunikacie MF w ciągu 24 h — w kategorii, gdzie przepisy zmieniają się co kwartał,
  świeżość treści jest czynnikiem rankingowym i czynnikiem zaufania.
- **Narzędzia darmowe jako magnesy:** kalkulator „czy obejmuje mnie KSeF od 2027?",
  generator wniosku o token (instrukcja interaktywna), sprawdzarka NIP na białej liście.
  Każde narzędzie to strona lądowania zbierająca e-maile i polecająca produkty.

### 8.3. Płatne reklamy — tylko jako dopalacz z twardym progiem opłacalności

- Google Ads na frazy o intencji zakupowej („program do faktur ksef", „ksef aplikacja dla
  jdg"). Benchmarki PL 2025/26: średni CPC wszystkich branż ~0,77 zł, ale finanse/prawo
  8–50 zł za klik; frazy fakturowe będą pomiędzy — zakładamy ostrożnie 3–8 zł. Meta Ads:
  CPM ~35 zł, CPL ~87 zł (średnie PL) — Meta traktujemy wyłącznie remarketingowo.
- Twardy próg: **CAC < 25% LTV**, sprawdzany co miesiąc; przekroczenie = pauza kampanii
  (automatyczny alert). Budżet w scenariuszach: rozdz. 11.
- Fala grudzień 2026–styczeń 2027 (kary od 1.01.2027) to jedyny moment planowo zwiększonego
  budżetu — wtedy intencja zakupowa jest najwyższa w całym roku.

### 8.4. Kanały bez twarzy i bez sprzedaży osobistej

- **Grupy FB dla przedsiębiorców** — wyłącznie merytoryczne odpowiedzi z linkiem do
  artykułu/kalkulatora (nie spam); posty pisze AI, publikuje właściciel 1×/tydz.
- **YouTube/Shorts bez twarzy:** nagrania ekranu „jak zrobić X w KSeF w 60 sekund", lektor
  TTS. Materiał źródłowy = artykuły huba; produkcja zautomatyzowana.
- **Program poleceń:** miesiąc gratis za skutecznie poleconego (klasyka SaaS; działa bez
  udziału człowieka).
- **Allegro** dla e-booka (P3) — rynek kupujących, którzy nie trafią na nas z Google.

### 8.5. Lejek i liczby docelowe

Lejek: ruch organiczny/płatny → strona (artykuł/kalkulator) → e-mail lub trial → płatny.
Założenia konwersji przyjęte w modelu finansowym (rozdz. 11.3) pochodzą z globalnych
benchmarków self-serve SaaS (źródła w rozdz. 13.4):

- 1000 odwiedzin → ~45 rejestracji na trial → ~4 płacących (free trial); freemium daje
  więcej rejestracji (~90), ale podobną liczbę płacących (~5).
- Trial→płatny: **8,9%** bez karty przy rejestracji, **31,4%** z kartą (ChartMogul, 2026,
  badanie 200 produktów) — wybieramy trial bez karty (mniejsze tarcie, polski klient nie
  ufa „podpinaniu karty na próbę"), więc liczymy konserwatywnie ~9–15%.
- Churn miesięczny SMB SaaS: **3–7%**; 70% odejść w pierwszych 90 dniach — dlatego
  onboarding (pierwsza faktura w <5 minut od rejestracji) jest metryką produktową nr 1.
- Arytmetyka przewagi kanałów: przy ARPU ~25 zł/mies. i churnie 4% LTV ≈ 600–750 zł;
  czysty płatny ruch przy CPC 3–8 zł i konwersji 0,4% daje CAC ~1500 zł+ — **nie spina
  się**; ruch organiczny ma koszt krańcowy ~0 zł — spina się zawsze. Stąd proporcja
  budżetu: treści przed reklamą, reklama tylko w szczycie intencji (XI 2026 – I 2027).

Sekwencje e-mail (onboarding, edukacja KSeF, przypomnienie przed 1.01.2027) pisze i testuje
AI; wysyłka automatyczna.

---

## 9. Plan operacyjny i harmonogram

### 9.1. Kamienie milowe

| Termin | Kamień milowy | Kryterium zaliczenia |
|---|---|---|
| wrz 2026 (M0) | Formalności + walidacja | CEIDG aktywne, bank, płatności testowe; landing z listą oczekujących zebrał ≥200 adresów przy koszcie ≤1 500 zł |
| lis 2026 (M2) | P3 e-book w sprzedaży | pierwsze 100 sprzedaży; hub SEO opublikowany (≥20 artykułów) |
| gru 2026 (M3) | P1 Strażnik KSeF live | ≥100 płacących lub w trialu; integracja KSeF produkcyjna działa |
| sty–lut 2027 (M4–5) | P2 Faktura w Sekundę live | publiczny start przed szczytem fali (kary od 1.01.2027); ≥300 kont, ≥150 płacących łącznie |
| kwi 2027 (M7) | Przegląd strategiczny nr 1 | decyzja skala/korekta/pivot wg progów z rozdz. 11.4 |
| wrz 2027 (M12) | Zamknięcie roku 1 | rozliczenie wobec scenariuszy z rozdz. 11 |

### 9.2. Tygodniowy rytm operacyjny (do rampy)

- **Sesja A (2 h):** przegląd metryk (dashboard automatyczny), akceptacja wdrożeń
  przygotowanych przez AI, sprawy kontowo-urzędowe z listy.
- **Sesja B (2 h):** publikacje treści (przygotowane przez AI), odpowiedzi na eskalowany
  support z szablonów, płatności/faktury kosztowe.
- **AI między sesjami:** kod, testy, artykuły, analizy, monitoring, przygotowane decyzje
  („zrób X czy Y — rekomenduję X, bo…").

### 9.3. Zasada „kill switch" na każdą fazę

Każda faza ma z góry zapisany warunek przerwania (rozdz. 11.4 i 12) — żeby porażka na etapie
walidacji kosztowała ≤3 000 zł, a nie 20 000 zł. To jest różnica między planem a nadzieją.

---

## 10. Formalności: rejestracja, podatki, ZUS, prawo

### 10.1. Forma prawna: JDG teraz, sp. z o.o. dopiero gdy liczby każą

Zaczynamy od **jednoosobowej działalności gospodarczej (CEIDG)**: rejestracja darmowa i
natychmiastowa, księgowość ~150 zł/mies., pełna zgodność z ulgami ZUS. Spółka z o.o. na
starcie dałaby ograniczenie odpowiedzialności kosztem podwójnego opodatkowania, pełnej
księgowości (~500+ zł/mies.) i składki zdrowotnej bez ulg — nieopłacalne przy naszej skali
ryzyka (produkt nie zaciąga zobowiązań, nie bierze towaru w komis, nie kredytuje się).
Punkt przeglądu: **M9 (rozdz. 11.4)** — przy MRR ≥12 tys. zł i rosnącej bazie klientów
przekształcenie/założenie sp. z o.o. wraca na stół (odpowiedzialność, wiarygodność,
ewentualna sprzedaż firmy).

**Rejestracja CEIDG (zadanie [TY], ~30 minut, 0 zł):** wniosek CEIDG-1 online na
biznes.gov.pl (profil zaufany / e-dowód / bankowość); wpis zwykle w ciągu 1 dnia roboczego;
NIP, REGON i zgłoszenie płatnika ZUS załatwiają się automatycznie (zgłoszenie do ubezpieczeń
ZUS ZZA z kodem ulgi na start 05 40 — w ciągu 7 dni, można razem z wnioskiem). Działalność
można prowadzić od dnia wskazanego we wniosku, nawet od dnia złożenia. Od 1.11.2026 wnioski
CEIDG są wyłącznie elektroniczne.

**Kody PKD (uwaga: od 1.01.2025 obowiązuje nowa klasyfikacja PKD 2025):**
- **62.10.B** — pozostała działalność związana z oprogramowaniem (rdzeń: nasze aplikacje),
- **62.20** — doradztwo w zakresie informatyki (zapas na przyszłe usługi okołoproduktowe),
- **63.10.D** — przetwarzanie danych, hosting i podobne (Strażnik/Most działają jako usługa),
- **63.91** — działalność portali internetowych (hub treści),
- kod dla sprzedaży e-booka — do potwierdzenia w oficjalnej wyszukiwarce PKD na
  biznes.gov.pl przy składaniu wniosku (zadanie [TY] w M0; w razie wątpliwości doradzi
  księgowość z 10.4).

### 10.2. Podatek dochodowy: ryczałt, ostrożnie 12%, z opcją 8,5%

- Wybieramy **ryczałt od przychodów ewidencjonowanych** — najprostsza forma dla biznesu o
  wysokiej marży i niskich kosztach (koszty i tak nie odliczają się od ryczałtu, a nasze są
  minimalne).
- **Stawka jest sporna**: ustawa mówi 12% dla „usług związanych z oprogramowaniem"
  (PKWiU ex 62.01.1), ale 8,5% to stawka rezydualna dla usług niesklasyfikowanych — i
  Dyrektor KIS w interpretacji z 4.09.2023 r. potwierdził, że *„przychody uzyskiwane ze
  świadczenia usług utrzymania aplikacji internetowych w modelu SaaS podlegają opodatkowaniu
  8,5% stawką ryczałtu"*. Linia interpretacyjna 2025 r. jest niejednolita („Ryczałt 8,5 proc.
  w IT ciągle możliwy, ale ryzykowny" — prawo.pl). **Decyzja planu:** liczymy wszystko po
  12%, a w M0 składamy wniosek o interpretację indywidualną (40 zł) dla naszego dokładnego
  stanu faktycznego; ewentualne 8,5% to czysty upside ~3,5 p.p. marży.
- Sprzedaż e-booka (P3) to odrębna kategoria przychodu — stawkę również obejmiemy wnioskiem
  o interpretację.

### 10.3. VAT i ZUS

- **VAT:** korzystamy ze **zwolnienia podmiotowego — limit od 1.01.2026 podniesiony do
  240 000 zł** rocznie (z 200 000 zł). Do tego progu nie doliczamy VAT do cen (przewaga
  cenowa 23% nad opodatkowaną konkurencją przy sprzedaży B2C!). Rejestracja do VAT dopiero
  przy zbliżaniu się do limitu — w scenariuszu ambitnym pod koniec roku 1 (uwzględnione
  w liczbach jako bufor ostrożności).
- **Nasz własny KSeF:** nowa JDG z niską sprzedażą mieści się w wyłączeniu ≤10 000 zł/mies.
  do 31.12.2026, a od 1.01.2027 wchodzimy do KSeF — **własnym produktem** (dogfooding:
  sami jesteśmy klientem nr 1 Faktury w Sekundę).
- **Składki ZUS:**

  Ważny kontekst 2026: reforma składki zdrowotnej **nie weszła w życie** (ustawa
  zawetowana przez prezydenta w 2025 r.) — obowiązują dotychczasowe zasady. Ścieżka ulg
  dla nowej JDG (kwoty 2026, źródła w rozdz. 13.6):

  | Okres | Co płacimy | Ile miesięcznie |
  |---|---|---|
  | Miesiące 1–6 (**ulga na start**) | tylko składka zdrowotna | 498,35 zł (ryczałt, przychód roczny do 60 tys. zł) |
  | Miesiące 7–30 (**ZUS preferencyjny**, podstawa 30% płacy minimalnej 4 806 zł) | społeczne 456,18 zł (z chorobowym) + zdrowotna | ~954,53 zł (przy II progu zdrowotnej: ~1 286,76 zł) |
  | Zdrowotna wg progów przychodu (ryczałt) | do 60 tys. → 498,35 zł; 60–300 tys. → 830,58 zł; powyżej 300 tys. → 1 495,04 zł | 50% zapłaconej zdrowotnej odliczamy od przychodu |

  Mały ZUS Plus nas nie dotyczy (wymaga wcześniejszego prowadzenia firmy). Ścieżka ulg
  oznacza, że w krytycznym pierwszym półroczu obciążenia stałe wobec państwa to **niecałe
  500 zł miesięcznie** — kapitał pracuje na produkt, nie na składki.

### 10.4. Księgowość i obowiązki bieżące

Księgowość online w pakiecie „ryczałt" (~100–200 zł/mies. — cenniki w rozdz. 13.6);
ewidencja przychodów prowadzona automatycznie z eksportów operatora płatności. Deklaracje
i przelewy podatkowe przygotowuje księgowość; człowiek tylko akceptuje. Szacowany czas
właściciela na formalności bieżące: **<1 h/mies.**

### 10.5. Prawo produktu: regulamin, RODO, marka

- **Certyfikacja produktu: niewymagana.** Program do fakturowania nie podlega w Polsce
  żadnej homologacji ani zgłoszeniu (biznes.gov.pl) — integrujemy się z publicznym API KSeF.
- **RODO:** przechowując faktury klientów jesteśmy **podmiotem przetwarzającym** — z każdym
  klientem zawieramy umowę powierzenia (DPA) akceptowaną w regulaminie (standard rynkowy,
  wzorzec jak u Fakturowni), z hostingiem podpisujemy własne DPA. Dane fakturowe
  przetwarzane są na podstawie obowiązku prawnego. Wzorce przygotowuje AI, weryfikuje radca
  (2 000 zł w budżecie).
- **Marka:** zgłoszenie znaku towarowego w UPRP (~950 zł, 1 klasa, 10 lat ochrony) po
  walidacji nazwy — tarcza przed podszywaniem się w wynikach wyszukiwania, gdy urośniemy.

### 10.6. Wsparcie publiczne (opcjonalny bonus, nie filar planu)

Plan finansuje się z 20 000 zł wkładu i bieżących przychodów — wsparcie publiczne to
opcja, nie założenie:

- **Dotacja z urzędu pracy na podjęcie działalności** — bezzwrotna, do 6-krotności
  przeciętnego wynagrodzenia (w okresie VI–VIII 2026: **do 57 377,28 zł**; kwota zmienia
  się co kwartał). Haczyk: wymaga statusu osoby bezrobotnej PRZED rejestracją firmy i
  zobowiązania prowadzenia działalności ≥12 mies. — dla właściciela łączącego biznes z
  pracą prawdopodobnie nieosiągalna; odnotowana dla kompletności.
- **Pożyczka „Pierwszy biznes — Wsparcie w starcie"** (BGK): do ~20-krotności przeciętnego
  wynagrodzenia (~184 tys. zł), oprocentowanie stałe **0,25% rocznie**. Świadomie NIE
  bierzemy: plan zakłada zero długu (rozdz. 12, „ryzyka, których nie bierzemy"), ale to
  najtańszy pieniądz na rynku, gdyby rampa wzrostu w roku 2 wymagała kapitału.
- Programy cyfryzacyjne PARP/FE — monitorowane kwartalnie przez AI (zadanie stałe);
  w 2026 r. brak programu skrojonego pod nasz przypadek.

---

## 11. Finanse: budżet 20 000 zł i trzy scenariusze

### 11.1. Zasada: kapitał nie buduje produktu — kapitał kupuje pewność i zasięg

W klasycznym starcie SaaS 20 000 zł nie starczyłoby na miesiąc pracy jednego programisty.
U nas koszt wytworzenia kodu ≈ 0 (rozdz. 2), więc kapitał idzie wyłącznie tam, gdzie
pieniądz jest niezastępowalny: walidacja, prawo, marketing w szczycie intencji, rezerwa.

### 11.2. Budżet startowy — alokacja 20 000 zł

| Pozycja | Kwota | Uwagi |
|---|---|---|
| Walidacja pomysłu (M0–M1): kampania testowa + landing | 1 500 zł | wydawane PRZED budową produktów; próg STOP w 11.4 |
| Domeny (2×, po cenie odnowienia) + e-mail firmowy | 400 zł | ceny odnowień .pl: ~50–169 zł netto/rok |
| Infrastruktura rok 1 (VPS ~40 zł/mies., backup, CDN) | 700 zł | Hetzner/Railway; skalowanie dopiero za przychodem |
| Narzędzia AI (praca + API produktowe) | 3 000 zł | API Claude: operacja typu „sparsuj pozycję faktury" ≈ ułamki grosza (Haiku 4.5: 1/5 USD za 1M tokenów) |
| Prawo: regulamin, umowa powierzenia (RODO/DPA), przegląd radcy | 2 000 zł | wzorce przygotowuje AI, radca weryfikuje |
| Księgowość online (12 mies.) | 1 800 zł | pakiet ryczałt ~150 zł/mies. |
| Reklama: szczyt intencji XI 2026 – I 2027 | 6 000 zł | tylko przy CAC < 25% LTV (rozdz. 8.3) |
| Znak towarowy UPRP (1 klasa, 10 lat) | 950 zł | 400 zł zgłoszenie + 400 zł ochrona + 90 zł publikacja |
| SMS/e-mail transakcyjny, drobne narzędzia | 650 zł | Strażnik wysyła SMS-y — koszt wliczony w cenę planu |
| **Rezerwa awaryjna** | **3 000 zł** | nieruszalna do M6; potem decyzja zarządu |
| **Razem** | **20 000 zł** | |

Składki ZUS nie obciążają kapitału startowego — dzięki uldze na start i preferencji są
niskie i płacone z bieżących przychodów; kwoty w rozdz. 10.3.

### 11.3. Trzy scenariusze — 12 miesięcy (wrzesień 2026 – sierpień 2027)

Wspólne założenia: ceny z rozdz. 7; konwersje z rozdz. 8.5 (benchmarki ChartMogul/Userpilot);
przychód liczony kasowo (tak jak widzi go ryczałtowiec); podatek liczony konserwatywnie wg
stawki 12% (wariant 8,5% — rozdz. 10.2 — traktujemy jako upside, nie plan).

**Scenariusz OSTROŻNY (pesymistyczny, ~30% prawdopodobieństwa):**
walidacja przechodzi na styk, SEO rośnie wolno, konkurencja dokręca darmowe plany.
Sprzedaż: ~250 e-booków, Strażnik ~120 płacących, P2 ~180 płacących na koniec roku.

- Przychód roczny: **~40 000 zł** · koszty (ograniczone: bez drugiej fali reklam): ~26 000 zł
  · ryczałt 12% + składki (zdrowotna 498,35 zł/mies., społeczne od M7 po uldze na start):
  ~10 000 zł · **wynik roku 1: ≈ +4 000 zł** (firma na plusie, MRR ~5 000 zł na koniec
  roku — baza na rok 2 albo decyzja o zwinięciu bez długów).
- Wariant skrajny: walidacja PONIŻEJ progów z 11.4 → STOP w M1, strata ograniczona do
  ~3 000 zł, w kieszeni zostaje ~17 000 zł kapitału. To też jest wynik planu, nie porażka
  planowania.

**Scenariusz BAZOWY (~50% prawdopodobieństwa):**
produkty wchodzą zgodnie z harmonogramem, SEO łapie długie ogony przed szczytem, fala
1.01.2027 dowozi klientów. Przebieg miesięczny (przychód kasowy, zaokrąglenia):

| Miesiąc | Wydarzenie | E-booki | MRR Strażnik | MRR P2 | Przychód m-ca |
|---|---|---|---|---|---|
| IX–X 2026 | walidacja, hub SEO, budowa | — | — | — | 0 zł |
| XI 2026 | start e-booka | 80 szt. | — | — | ~4 500 zł |
| XII 2026 | start Strażnika; szczyt paniki | 150 szt. | 500 zł | — | ~9 000 zł |
| I 2027 | start P2 + early-bird 149 zł/rok | 120 szt. | 1 400 zł | (150 kont rocznych) | ~30 000 zł |
| II 2027 | kary działają; ogon fali | 90 szt. | 1 900 zł | 2 500 zł | ~10 500 zł |
| III–V 2027 | wzrost organiczny | ~60/mies. | →2 700 zł | →7 000 zł | ~11–14 tys./mies. |
| VI–VIII 2027 | wzrost + roczne odnowienia | ~45/mies. | →3 200 zł | →11 500 zł | ~15–18 tys./mies. |

- Przychód roczny: **~135 000 zł** · koszty roczne (budżet 20 000 zł + nadwyżki
  operacyjne ~9 000 zł): ~29 000 zł · ryczałt 12% + składka zdrowotna: ~24 000 zł ·
  **wynik roku 1: ≈ +80 000–85 000 zł**.
- Stan na koniec roku: **MRR ~15 000 zł i rośnie** (annualizowane tempo ~200 000 zł
  przychodu), ~950 płacących klientów, churn w normie benchmarku. **Cel 300 000 zł zysku
  osiągany w tym scenariuszu w roku DRUGIM**, z rosnącej bazy abonamentowej — bez
  dodatkowego kapitału.

**Scenariusz AMBITNY — ścieżka do 300 000 zł w roku 1 (~10–20% prawdopodobieństwa):**
wszystko z bazowego plus: fala KSeF okazuje się silniejsza (segment „ostatniej chwili"
kupuje masowo), treści zdobywają top-3 na kilkunastu frazach przed grudniem, konwersje na
górnych benchmarkach, właściciel uruchamia rampę czasową w M4 i reinwestujemy bieżący
przychód w reklamę przy utrzymanym CAC.

| Składnik przychodu | Rok 1 |
|---|---|
| E-booki/kurs (2 500 szt., w tym Allegro) | ~140 000 zł |
| P2 Faktura w Sekundę (~2 500 płacących na koniec roku; duży udział planów rocznych) | ~200 000 zł |
| P1 Strażnik KSeF (~800 płacących) | ~40 000 zł |
| P4 KSeF Most (start Q2 2027, ~50 klientów B2B) | ~20 000 zł |
| **Przychód razem** | **~400 000 zł** |
| Koszty (marketing skalowany z przychodu: ~45 000 zł) + podatki/składki (~55 000 zł) | ~100 000 zł |
| **Wynik roku 1** | **≈ +300 000 zł** |

**Co musi być prawdą, żeby ten scenariusz się ziścił** (kontrakt uczciwości — rozdz. 1 i 12):
1. brak kolejnego odroczenia terminu 1.01.2027 (ryzyko R1);
2. top-3 Google na ≥10 frazach długiego ogona przed 15.12.2026 (mierzalne w Search Console);
3. konwersja trial→płatny ≥15% i churn ≤3%/mies. (górne pasmo benchmarków — wymaga
   naprawdę dobrego produktu);
4. rampa czasowa właściciela od stycznia 2027 (20–30 h/tydz. — decyzja zapadła 29.08.2026:
   „zwiększę czas, gdy będą pieniądze"; pieniądze będą właśnie wtedy);
5. reinwestycja ~połowy bieżących przychodów Q1–Q2 2027 w reklamę przy CAC ≤ 150 zł.

Żaden z tych warunków nie jest fantazją, ale koniunkcja pięciu naraz to właśnie różnica
między „ambitnym" a „bazowym". Plan wykonuje się identycznie w obu — różnica jest w tym,
jak mocno dociskamy gaz w Q1 2027, a to decyzja podejmowana wtedy, na podstawie liczb,
nie dziś na podstawie nadziei.

### 11.4. Progi decyzyjne (z góry umówione)

| Moment | Metryka | Próg GO | Próg STOP/korekta |
|---|---|---|---|
| M1 (X 2026) | walidacja: e-maile z kampanii ≤1 500 zł | ≥200 adresów, koszt ≤7,5 zł/adres, ≥25% deklaracji „zapłacę" | poniżej połowy progów → STOP (strata ~3 000 zł), analiza, ewent. pivot na inną niszę KSeF |
| M4 (XII 2026) | przychód skumulowany | ≥10 000 zł | <5 000 zł → korekta oferty/cen, wstrzymanie reklam |
| M6 (II 2027) | MRR | ≥5 000 zł → **rampa czasowa właściciela** (20 h/tydz.) | <2 000 zł → tryb utrzymaniowy, priorytet P4/pivot |
| M9 (V 2027) | MRR + CAC | ≥12 000 zł i CAC<150 zł → skalowanie reklam z zysków; decyzja o sp. z o.o. | churn >7% → stop akwizycji, naprawa retencji |
| M12 (VIII 2027) | wynik roczny | rozliczenie wobec scenariuszy; plan roku 2 | — |

### 11.5. Płatności i przepływy

- **Operator płatności:** Stripe (subskrypcje/Billing, karty 1,4–1,5% + 1 zł, BLIK 1,6% + 1 zł)
  jako kręgosłup; rozważenie Przelewy24/PayU (BLIK od ~1,19%) po przekroczeniu wolumenów,
  przy których różnica prowizji przekroczy koszt utrzymania drugiej integracji. Sprzedaż
  wyłącznie w Polsce ⇒ nie potrzebujemy merchant-of-record (Paddle 5% + 0,50 USD) — wraca
  do gry dopiero przy ekspansji zagranicznej.
- **Cashflow:** plany roczne (2 mies. gratis) i early-bird przyspieszają gotówkę w
  najdroższym okresie (Q4 2026–Q1 2027); rezerwa 3 000 zł pokrywa czarny scenariusz
  utrzymania infrastruktury przez >12 miesięcy.
- **Podatkowo (szczegóły rozdz. 10):** ryczałt liczony od przychodu — dyscyplina kosztowa
  nie zmniejsza podatku, więc tnie się koszty realnie, nie „na fakturę".

---

## 12. Analiza ryzyka

Ryzyka są uszeregowane wg iloczynu prawdopodobieństwa i wpływu. Każde ma zaplanowaną
odpowiedź — z góry, nie „gdy się zdarzy".

| # | Ryzyko | Prawdop. | Wpływ | Odpowiedź (zaplanowana dziś) |
|---|---|---|---|---|
| R1 | **Kolejne przesunięcie terminów KSeF.** Obowiązek był już przesuwany (pierwotnie lipiec 2024). Odroczenie kar z 1.01.2027 osłabiłoby falę popytu | średnie | wysoki | Produkty muszą bronić się wartością poza przymusem: Strażnik oszczędza realne pieniądze (terminy płatności, VAT) niezależnie od kar; P2 konkuruje wygodą, nie strachem. Treści SEO celują też we frazy „program do faktur", nie tylko „KSeF" |
| R2 | **Darmowa aplikacja rządowa „wystarczy"** dużej części rynku | wysokie | średni | Nie walczymy z ceną 0 zł u wszystkich — celujemy w segment, który ceni czas i prostotę (30 s vs formularz urzędowy) oraz funkcje, których aplikacja MF nie ma (przypomnienia, AI, Strażnik, mobile). Benchmark ograniczeń aplikacji rządowej w rozdz. 6.1 |
| R3 | **Incumbent obniża ceny / dodaje „tryb prosty"** | średnie | średni | Nasza struktura kosztów (zero zespołu) znosi wojnę cenową, której korporacja nie wytrzyma na tym segmencie; szybkość iteracji AI > komitety produktowe. Nisza „tylko faktury, mobile-first" jest dla nich kanibalizacją — dla nas rdzeniem |
| R4 | **Za wysoki koszt pozyskania klienta** (CAC) przy niskim ARPU | średnie | wysoki | Model stoi na SEO/treściach (koszt krańcowy ~0), nie na płatnych reklamach; reklamy tylko przy CAC < 1/4 LTV, sprawdzane co miesiąc. Walidacja za ≤1 500 zł PRZED budową produktu (rozdz. 9.1, M0) |
| R5 | **Ryzyko jednego człowieka** (choroba, wypadek właściciela) | niskie | krytyczny | Wszystko w kodzie i runbookach (AI utrzymuje dokumentację); infrastruktura auto-odnawialna; awaryjny tryb „tylko utrzymanie" wymaga <1 h/tydz. Ubezpieczenie: rezerwa finansowa z rozdz. 11.2 |
| R6 | **Zmiany w API KSeF 2.0** (wersjonowanie, certyfikaty) | średnie | średni | Warstwa integracji izolowana (adapter), środowisko testowe MF w CI; śledzenie komunikatów MF to cotygodniowe zadanie AI |
| R7 | **Churn po fali przymusu** (klienci kupują „na strach", odchodzą po roku) | średnie | średni | Wartość codzienna (przypomnienia o płatnościach, Strażnik) zamienia zakup „na strach" w nawyk; plany roczne z rabatem wygładzają odpływ; cel churn <4%/mies. monitorowany od M3 |
| R8 | **Stawka ryczałtu zakwestionowana** (12% zamiast 8,5%) | średnie | niski | Różnica wkalkulowana w scenariusz ostrożny (rozdz. 11.3); interpretacja indywidualna składana w M0 (rozdz. 14, pkt 12) — przed pierwszym istotnym przychodem |
| R9 | **RODO / bezpieczeństwo danych faktur** (incydent = utrata zaufania) | niskie | wysoki | Minimalizacja danych (nie przechowujemy więcej, niż trzeba), szyfrowanie at rest, kopie zapasowe, rejestr czynności; wzorce wprost z Omni (szyfrowanie kluczy, audyt). Przegląd prawny regulaminu i RODO w budżecie (rozdz. 11.2) |
| R10 | **Cel 300 000 zł nie zostaje osiągnięty w 12 mies.** | wysokie | żadny dla przetrwania | To ryzyko celu, nie firmy: scenariusz bazowy (rozdz. 11.3) daje firmę rentowną, rosnącą i wartą kontynuacji także poniżej celu. Z góry umówione: brak 300 tys. w roku 1 ≠ porażka przedsięwzięcia, jeśli spełnione są progi rampy (rozdz. 11.4) |

**Ryzyka, których świadomie NIE bierzemy:** kredyt/inwestor (cel osiągalny bez długu — dźwignią
jest kod, nie kapitał), zatrudnienie pracownika w roku 1 (koszty stałe zabiłyby scenariusz
ostrożny), budowa „pełnej księgowości" (walka czołowa z ifirma/inFakt na ich terenie).

---

## 13. Badania i źródła (bibliografia)

**Nota metodologiczna.** Research przeprowadzono 29.08.2026 (wyszukiwarki + bezpośrednie
pobrania stron). Część serwisów była w chwili badania niedostępna do pełnego pobrania —
fakty z nich pochodzą z indeksów wyszukiwarek i cytowań pośrednich; wszystkie URL-e podano,
by dało się je zweryfikować samodzielnie. Ceny konkurencji pochodzą z zestawień
porównawczych 2026 r. i przed podjęciem decyzji cenowych należy je potwierdzić na
cennikach producentów (zadanie [TY] w M0). Cytaty oznaczone kursywą są dosłowne.

### 13.1. Makroekonomia

- NBP — projekcja inflacji i PKB, lipiec 2026: https://nbp.pl/projekcja-inflacji-i-pkb-lipiec-2026/ (PKB 3,7%/2,8%, CPI 2,9%/2,7%)
- Stopy procentowe NBP (3,75%, stan VIII 2026): https://direct.money.pl/wskazniki/stopy-procentowe
- GUS/CPI lipiec 2026 (3,0% r/r): https://bank.pl/ceny-towarow-i-uslug-w-lipcu-26-wzrosly-o-30-r-r-szybki-szacunek-gus/
- Komisja Europejska, Spring Forecast 2026 (komentarz MF): https://www.gov.pl/web/finanse/komentarz-do-prognoz-komisji-europejskiej-spring-forecast-2026
- Podsumowanie roku 2025 na GPW (WIG +47,3%): https://www.bankier.pl/wiadomosc/WIG-konczy-2025-rok-z-nowym-rekordem-To-byl-najlepszy-gieldowy-rok-od-niemal-30-lat-9062207.html

### 13.2. KSeF — regulacje i skala

- Oficjalny serwis KSeF (terminy, podstawy prawne): https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/podstawy-prawne-oraz-kluczowe-terminy/
- Wyłączenie ≤10 000 zł/mies. do 31.12.2026: https://ksef.podatki.gov.pl/ponizej-10-000-zl/
- Kary od 1.01.2027 (do 100% VAT / 18,7% należności): https://ksiegowosc.infor.pl/ksef/7603120,od-1-stycznia-2027-r-poczatek-stosowania-kar-w-ksef-nie-bedzie-zlagodzenia-bo-przepisy-sa-juz-lagodne-wskaznik-100-i-187.html
- Certyfikaty KSeF / koniec tokenów 31.12.2026: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/certyfikaty-ksef/
- Komunikat MF: ~290 mln faktur, >2 mln wystawców (II–V 2026): https://www.wnp.pl/rynki/resort-finansow-w-ksef-wystawiono-juz-prawie-290-mln-faktur,1067447.html
- Pół roku KSeF: >340 mln dokumentów, jakość danych (~10% niekompletnych XML): https://filarybiznesu.pl/twoja-firma/ksef-po-pierwszych-miesiacach-funkcjonowania-ponad-340-milionow-faktur-i-potrzeba-zmian-technologicznych/a30426
- Dokumentacja API KSeF 2.0 (MIT, OpenAPI, środowiska): https://github.com/CIRFMF/ksef-api oraz https://github.com/CIRFMF/ksef-api/blob/main/srodowiska.md
- Brak wymogu certyfikacji programu do fakturowania: https://www.biznes.gov.pl/pl/portal/004651

### 13.3. Rynek i gotowość firm

- PARP, „Raport o stanie sektora MSP w Polsce 2025" (2 307,8 tys. mikrofirm = 97,2%): https://www.parp.gov.pl/component/publications/publication/raport-o-stanie-sektora-malych-i-srednich-przedsiebiorstw-w-polsce-2025 (PDF: https://fepw.parp.gov.pl/storage/publications/pdf/ROSS_2025.pdf)
- GUS III kw. 2025 (2 875 994 aktywnych firm; mikro 95,9%): https://centrumanaliz.pkobp.pl/analizy-sektorowe/mikroprzedsiebiorstwa-2025
- CEIDG 2025 (288,8 tys. nowych JDG): https://300gospodarka.pl/news/jdg-w-2025-roku
- inFakt Indeks 2025 (wdrożyło 13%, 18% nie zamierza): https://www.infakt.pl/blog/infakt-indeks-2025-78-firm-wie-o-ksef-tylko-45-wdraza/
- SaldeoSMART XII 2025 (34% MŚP nieprzygotowanych): https://www.pit.pl/aktualnosci/ksef-34-firm-wciaz-niegotowych-jakie-sa-glowne-bariery-przeszkadzajace-we-wdrazaniu-systemu-1011962
- Badanie ifirmy II/III 2026 (co druga mikrofirma „w ogóle nieprzygotowana"): https://ksiegowosc.infor.pl/ksef/7550433,ksef-2026-faktury-od-lutego-na-nowych-zasadach-badanie.html
- KPMG & Microsoft, Monitor Transformacji Cyfrowej Biznesu (38% firm na papierze): https://gf24.pl/46570/cyfryzacja-zarzadzania-firma-w-kontekscie-ksef-jak-polaczyc-obowiazek-z-przewaga-konkurencyjna-dzieki-integracji-z-erp/
- BGK, „Cyfryzacja w sektorze MŚP" (2026): https://www.bgk.pl/aktualnosc/cyfryzacja-w-sektorze-msp-szanse-i-ograniczenia-raport-z-badania-bgk/

### 13.4. Konkurencja, benchmarki, marketing

- Cenniki (zestawienia 2026): Fakturownia https://ksef-dla.pl/program/fakturownia-cennik-2026/ · inFakt https://ksef-dla.pl/program/infakt-cennik-2026/ · wFirma https://ksef-dla.pl/program/wfirma-cennik-2026/ · ifirma https://ksef-dla.pl/program/ifirma-cennik-2026/ · Faktura.pl https://faktura.pl/cennik/ · Firmino https://www.firmino.pl/ · Comarch KSeF https://www.systemyit.pl/koniec-darmowego-ksef-w-comarch-od-31-lipca-2026-zobacz-nowy-cennik-i-wybierz-wlasciwy-pakiet/
- Banki z darmowym KSeF: https://www.mbank.pl/firmy/ksef/ oraz https://moneteo.com/artykuly/ksef-konto-firmowe-zmiany-w-bankach
- Ograniczenia Aplikacji Podatnika: https://ksef.pl/blog/ksef-aplikacja-podatnika-od-mf-czy-profesjonalny-program-do-faktur-co-wybrac · e-mikrofirma: https://mizzox.com/baza-wiedzy/e-mikrofirma-co-to-jest-jak-dziala-i-czy-warto-z-niej-korzystac/
- Brak konektorów KSeF w no-code: https://ksefimport.pl/mozliwosci/integracje · https://baseai.pl/n8n/ksef
- Fakturownia ~600 tys. użytkowników: https://jakwybrachosting.pl/recenzja-fakturownia/
- Benchmarki konwersji SaaS: https://userpilot.com/blog/saas-average-conversion-rate/ · trial→paid (ChartMogul 8,9%/31,4%): https://www.pulseahead.com/blog/trial-to-paid-conversion-benchmarks-in-saas · churn SMB 3–7%: https://livmo.com/blog/saas-churn-benchmarks-valuation/
- Micro-SaaS solo (mediana ~500 USD/mies., 70% nie przekracza 1 000 USD): https://saasranger.com/blog/micro-saas-revenue-reality-what-1000-founders-actually-earn/ · droga do 1 tys. USD MRR ~8 mies.: https://www.indiehackers.com/post/it-takes-5-months-to-reach-1k-in-mrr-491742f806 · ChartMogul „Against the Odds": https://chartmogul.com/reports/saas-growth-the-odds-of-making-it/
- CPC/CPM Polska: https://premiumads.pl/premiumblog/benchmark-koszt-konwersji-google-ads-polska/ · https://artursmolicki.com/blog/stawki-cpc-w-polsce/ · https://divloy.pl/blog/ile-kosztuje-reklama-na-facebooku-cena-kampanii-meta-ads/
- CAC SaaS: https://www.saashero.net/google-ppc/saas-cac-benchmarks-2026/

### 13.5. Giełda i sprawozdania finansowe (dowody z rozdz. 5.3)

- ifirma S.A. — wstępne wyniki 2025 (ESPI 13.02.2026): https://www.stockwatch.pl/komunikaty-spolek/ifirma,wstepne-wyniki-finansowe-za-2025-2026-02-13,espi,20260213_170401_0000341400 · raport półroczny 2025 (PDF): https://www.ifirma.pl/wp-content/uploads/2025/09/Raport_polrocznySAP2025_caly.pdf · agregacja: https://simplywall.st/stocks/pl/software/wse-ifi/ifirma-shares/past · kapitalizacja/dywidendy: https://www.stockwatch.pl/gpw/ifirma,notowania,dywidendy.aspx
- Fakturownia sp. z o.o. — dane rejestrowe/sprawozdania: https://rejestr.io/krs/572426/fakturownia · https://www.bizraport.pl/krs/0000572426/fakturownia-spolka-z-ograniczona-odpowiedzialnoscia
- Asseco Business Solutions — I kw. 2026: https://www.stockwatch.pl/wiadomosci/asseco-business-solutions-wyniki-i-kwartal-2026-zysk-netto-przychody,akcje,371405 · cytat CFO o KSeF: https://crn.pl/aktualnosci/integrator-liczy-na-zniwa-dzieki-ksef/ · 2 mln faktur w miesiąc (Businesslink): https://assecobs.pl/pierwszy-miesiac-dzialania-ksef-ponad-2-mln-faktur-przeslanych-przez-businesslink/
- Comarch — wycofanie z GPW (CVC): https://www.bankier.pl/wiadomosc/Akcjonariusze-Comarchu-przeglosowali-uchwale-o-wycofaniu-akcji-z-obrotu-gieldowego-8858553.html
- WIG-informatyka: https://www.bankier.pl/inwestowanie/profile/quote.html?symbol=WIG-INFO
- Text S.A. (kontekst polskiego SaaS globalnego, ARR 84,8 mln USD): https://strefainwestorow.pl/wiadomosci/20251127/wyniki-grupy-text-w-i-pol-202526-roku-finansowego

### 13.6. Podatki, składki, formalności

- Limit zwolnienia podmiotowego VAT 240 000 zł od 1.01.2026: https://poradnikprzedsiebiorcy.pl/-limit-zwolnienia-podmiotowego-w-vat · https://www.abcfaktury.pl/blog/nowy-limit-zwolnienia-z-vat-od-2026-roku-240-000-zl-zamiast-200-000-ale-uwaga-na-rok-przejsciowy
- Ryczałt dla usług IT/SaaS — 8,5% vs 12%: https://www.ifirma.pl/blog/jaki-ryczalt-dla-programisty-85-czy-12-stawka-ryczaltu-dla-informatykow/ · interpretacja KIS z 4.09.2023 (SaaS 8,5%): https://omowienia.gazetaprawna.pl/interpretacje-podatkowe/artykuly/9294310,czy-stawka-podatku-dla-uslug-utrzymania-aplikacji-internetowych-w-modelu-saas-wynosi-85.html · „Ryczałt 8,5 proc. w IT ciągle możliwy, ale ryzykowny": https://www.prawo.pl/podatki/czy-mozna-placic-8-5-proc-ryczaltu-w-branzy-it,532812.html
- RODO dla SaaS przechowującego faktury (podmiot przetwarzający, DPA): https://creativa.legal/jak-wdrozyc-rodo-dla-aplikacji-saas/ · https://adwokat-orlicki.pl/ksef-a-rodo-jak-chronic-dane-w-krajowym-systemie-e-faktur/
- Znak towarowy UPRP (koszty): https://znakitowarowe-blog.pl/koszt-rejestracji-znaku-towarowego/
- Prowizje płatności: Stripe PL https://seomantyczny.pl/stripe-dla-polskich-sklepow-prowizje-blik-2026/ · PayU/P24: https://kcmobile.pl/baza-wiedzy/ecommerce/ile-kosztuje-payu-dla-sklepu-online/ · Paddle (MoR): https://dev.to/onsen/paddle-review-2026-pros-cons-pricing-explained-4cgk
- Cennik API Claude (Anthropic): https://claude.com/pricing
- Księgowość online (cenniki 2026): https://ksef-dla.pl/program/ifirma-cennik-2026/ · https://ksef-dla.pl/program/infakt-cennik-2026/
- Ulga na start 2026: https://www.ifirma.pl/blog/ulga-na-start-kto-moze-z-niej-skorzystac-w-2026-roku/ · https://effepro.pl/ulga-na-start-2026-kto-moze-skorzystac-ile-trwa-i-jaki-zus-placi-przedsiebiorca/
- Preferencyjny ZUS 2026 (płaca minimalna 4 806 zł, składki 456,18 zł): https://poradnikprzedsiebiorcy.pl/-wskazniki-preferencyjne-skladki-zus · https://firmove.pl/aktualnosci/finanse/zus/zmiany-w-preferencyjnym-zus-ie
- Składka zdrowotna 2026 po wecie prezydenta (ryczałt: 498,35 / 830,58 / 1 495,04 zł): https://www.infakt.pl/blog/skladka-zdrowotna-dla-ryczaltu-w-2026-r/ · https://www.gazetaprawna.pl/podatki/artykuly/10785884,skladka-zdrowotna-2026-po-wecie-prezydenta-zasady-stawki-i-odliczeni.html
- Pełny ZUS 2026 (dla porównania: 1 926,76 zł + zdrowotna): https://www.pitax.pl/wiedza/aktualnosci/skladki-zus-2026-dla-przedsiebiorcow/
- Mały ZUS Plus od 2026: https://www.zus.pl/en/-/%E2%80%9Ema%C5%82y-zus-plus-nowe-zasady-od-2026-r.
- Rejestracja JDG online 2026 (CEIDG, od 1.11.2026 tylko online): https://forsal.pl/biznes/firma/artykuly/11253081,jak-zalozyc-firme-w-2026-r-i-w-2027-r-rejestracja-ceidg-koszty-i-sk.html · https://europim.pl/rejestracja-jdg-online-2026/
- PKD 2025 dla branży IT (62.10.B, 62.20, 63.10.D, 63.91): https://www.ifirma.pl/blog/kody-pkd-2025-jakie-zmiany-czekaja-nas-w-kodach-pkd-od-2025-roku/ · https://lexaudyt.pl/zmiana-kodow-pkd-2025-dla-branzy-it/ · https://pkd.wenet.pl/kod/63-10-d/
- Dotacja z PUP 2026 (do 57 377,28 zł, VI–VIII 2026): https://www.krb.edu.pl/jaka-jest-aktualna-kwota-dotacji-z-urzedu-pracy-2026/ · pożyczka „Wsparcie w starcie" (0,25%): https://www.ifirma.pl/blog/wsparcie-w-starcie-2026-na-czym-polega-program-dla-zakladajacych-pierwszy-biznes/

---

## 14. Następne kroki — checklista na pierwsze 30 dni

Zadania oznaczone **[TY]** wykonuje Szymon (wymagają człowieka), **[AI]** — Claude w sesjach
roboczych, **[TY+AI]** — wspólnie w sesji.

**Tydzień 1 — decyzje i fundamenty**
1. **[TY]** Przeczytać ten dokument w całości; zgłosić sprzeciwy do decyzji z rozdz. 3 i 7
   (brak sprzeciwu = zatwierdzone).
2. **[TY+AI]** Wybrać nazwę i sprawdzić wolne domeny .pl (lista kandydatów przygotowana przez
   AI; rejestracja od ręki, ~10–80 zł/rok pierwszy rok).
3. **[TY]** Złożyć wniosek CEIDG online (profil zaufany; instrukcja krok po kroku w rozdz. 10.1)
   z PKD i formą opodatkowania wskazanymi w rozdz. 10.2. Czas: ~30 min, koszt: 0 zł.
4. **[TY]** Założyć firmowy rachunek bankowy (bank z prostym API/eksportem; rekomendacja w
   sesji) i zgłosić go do CEIDG/US.

**Tydzień 2 — infrastruktura sprzedaży**
5. **[TY]** Założyć konta: operator płatności (rozdz. 11.2), Google (Ads + Search Console +
   Analytics), Cloudflare, hosting (rekomendacje w sesji). Wszędzie 2FA.
6. **[AI]** Landing „lista oczekujących" + hub treści: 10 pierwszych artykułów SEO o KSeF
   (gotowe do publikacji po akceptacji).
7. **[TY]** Wystąpić o dostęp do środowiska testowego KSeF 2.0 i przejść uwierzytelnienie
   (instrukcja przygotowana przez AI).
8. **[TY]** Podpisać umowę z księgowością online (rozdz. 10.4) — pakiet ryczałt, ~100–200
   zł/mies.

**Tydzień 3–4 — walidacja za ≤1 500 zł**
9. **[AI]** Kampania walidacyjna: teksty reklam Google Ads na frazy KSeF (budżet 50 zł/dzień,
   14 dni), pomiar: koszt pozyskania adresu e-mail i deklaracji „zapłacę".
10. **[TY]** Uruchomić kampanię (kliknięcia akceptacyjne), spiąć płatność testową 1 zł.
11. **[TY+AI]** Przegląd wyników walidacji wobec progów z rozdz. 11.4: **GO** (budujemy P3+P1
    wg harmonogramu) / **korekta** (inna nisza KSeF) / **STOP** (strata ograniczona do ~3 000
    zł, wracamy do deski kreślarskiej z zachowanym kapitałem).
12. **[TY]** Wystąpić o interpretację indywidualną stawki ryczałtu dla przychodów z aplikacji
    (rozdz. 10.2; opłata 40 zł/pytanie) — odpowiedź przyjdzie w trakcie budowy, przed
    pierwszym poważnym przychodem.

**Rytuał stały od tygodnia 1:** dwie sesje robocze tygodniowo (9.2). Każda sesja kończy się
listą zadań na następną — przygotowaną przez AI, zatwierdzoną przez człowieka.

---

*Raport przygotował: Claude (AI) na zlecenie właściciela. Wszystkie liczby pochodzą ze źródeł
wymienionych w rozdz. 13 (stan na 29.08.2026) albo są jawnie oznaczone jako założenia. Ten
dokument nie jest poradą inwestycyjną ani podatkową; decyzje podatkowe potwierdzamy
interpretacją indywidualną, a prawne — u radcy (przewidziane w budżecie).*
