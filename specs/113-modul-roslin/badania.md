# Badania i mapa koncepcji — moduł Rośliny

- **ID:** 113-modul-roslin
- **Rodzaj dokumentu:** research (podstawa dla `spec.md`, `plan.md` i całej dalszej pracy)
- **Data:** 2026-08-28
- **Zlecenie właściciela:** „musisz zrobić głęboki research i mapę myśli i funkcjonalności z przemyśleniami
  na każdym poziomie czy można w danym poziomie jeszcze coś wymyśleć by moduł był dość kompleksowy dla
  każdego z trybów wykorzystywania tego modułu".

> **Po co ten plik.** Właściciel dostarczył wstępną mapę (10 obszarów × 6 segmentów). Ten dokument jej
> nie przepisuje — **weryfikuje ją**, dokłada to, czego w niej brakuje, i przede wszystkim odpowiada na
> pytanie, którego wstępna mapa nie stawia: **czego z tej mapy Omnia NIE powinna budować w module
> Rośliny, bo już to ma.** To ostatnie jest najważniejszym wynikiem badań i to ono ustawia zakres.

---

## 0. Streszczenie ustaleń (dla kogoś, kto czyta tylko ten rozdział)

1. **Wstępna mapa jest trafna co do obszarów, ale myli warstwy.** Pomieszane są w niej rzeczy
   *roślinne* (fenologia, podlewanie, choroba liścia, plon z metra) z rzeczami *ogólnobiznesowymi*
   (faktury, zapasy, dostawcy, P&L, CRM). Te drugie w Omnii **już istnieją** i są dojrzałe:
   Magazynowanie Pro (partie/FEFO, dostawcy, dokumenty PZ/WZ, analityka ABC), Portfel (budżety,
   raporty miesięczne, wielowalutowość, auto-księgowanie), Usługi (marketplace, wyceny, płatności),
   Kontakty (CRM). Zbudowanie ich drugi raz wewnątrz Roślin dałoby **dwie prawdy o pieniądzach**
   jednego użytkownika. → Decyzja: Rośliny liczą to, co roślinne, a pieniądze i zapasy **księgują
   przez istniejące moduły** (wzorzec Floty i Usług, które tak robią z `bookAutoExpense`).
2. **Prawdziwą osią różnicującą segmenty nie jest „ile masz roślin", tylko JEDNOSTKA OBSERWACJI.**
   Mieszkaniec obserwuje **egzemplarz** („moja Monstera"). Rolnik obserwuje **łan na powierzchni**
   („pszenica, pole 3, 4,2 ha") — pojedyncza roślina nie istnieje jako pojęcie. Kwiaciarnia
   obserwuje **partię** („partia 001: 100 szt. Monstera w fazie doniczkowania"). To trzy różne
   liczności tego samego bytu, nie trzy różne moduły. → Model danych musi to unieść **jednym**
   pojęciem z polem liczności, inaczej powstaną trzy rozjeżdżające się poddrzewa.
3. **Właściciel ma rację co do wielu przestrzeni i to jest wymóg strukturalny, nie wygoda.**
   Wzorzec „Dom/Pro na użytkownika" z Magazynu i Warsztatów **nie da się tu zastosować** — bo
   kwiaciarnia i prywatny parapet istnieją **jednocześnie w tym samym koncie**. Tryb musi siedzieć na
   przestrzeni.
4. **Jest jeden element mapy z twardym terminem prawnym i on jest najmocniejszym uzasadnieniem
   modułu:** od 1 stycznia 2026 profesjonalni użytkownicy środków ochrony roślin w Polsce (ok. 1,3 mln
   osób) prowadzą ewidencję zabiegów z nowymi polami, z obowiązkiem doprowadzenia jej do formy
   elektronicznej do 31 stycznia roku następnego. Żadna aplikacja „do doniczek" tego nie robi.
5. **Konkurencja (Planta, Greg, PictureThis) wygrywa jedną rzeczą: harmonogram podlewania nie jest
   stałą z gatunku.** Liczy go z gatunku **plus** wielkości doniczki, zmierzonego światła i lokalnej
   pogody. Omnia ma już moduł Pogoda z lokalizacjami i prognozą — to daje adaptacyjny harmonogram
   **za darmo**, podczas gdy konkurenci muszą go dowozić własną integracją.
6. **AI ma w tym module cztery realne zastosowania, nie jedno.** Identyfikacja (obraz), diagnoza
   (obraz + kontekst), harmonogram/plan sezonu (rozumowanie z danych użytkownika) i podsumowania
   (tekst). Każde jest innym typem operacji w rozumieniu `resolver.ts` (`vision` / `vision` /
   `reasoning` / `generation`) — to nie jest jedna funkcja z czterema promptami.

---

## 1. Metoda

Materiał, na którym stoi ten dokument:

| Źródło | Co z niego wzięliśmy |
|---|---|
| Wstępna analiza właściciela | Punkt wyjścia: 6 segmentów, 10 obszarów, rozpiska per segment |
| Kod Omnii (`src/modules/*`, kontrakty, `sharing.ts`, `dashboard.ts`, `calendar.ts`) | Co już istnieje i czego **nie wolno** budować drugi raz; wzorzec nowego modułu (102 YouTube) |
| `CLAUDE.md` + `constitution.md` | Twarde reguły: brak enumów, migracje ręczne, `ModuleView`, i18n, granice modułów |
| Przepisy PL o ewidencji ŚOR (zmiana od 2026‑01‑01) | Wymagany zestaw pól rejestru zabiegów i termin |
| Skala BBCH (monografia, 10 głównych faz 0–9) | Uniwersalny słownik faz wzrostu — jeden dla parapetu i dla pola |
| Pl@ntNet API / GBIF | Realność „zdjęcie → gatunek" bez własnego modelu; dane taksonomiczne w 54 językach |
| Przegląd rynku aplikacji roślinnych 2026 (Planta, Greg, PictureThis, Botanicaly) | Poprzeczka funkcjonalna i to, co wygrywa: model podlewania z doniczki + światła + pogody |

Metoda oceny każdego poziomu mapy jest zawsze ta sama i wprost odpowiada na pytanie właściciela
(„czy można w danym poziomie jeszcze coś wymyśleć"):

> **(a)** co proponuje wstępna mapa → **(b)** czego w niej brakuje (dokładka z badań) → **(c)** co z
> tego Omnia już ma gdzie indziej → **(d)** werdykt zakresowy: teraz / etapem / nigdy, z powodem.

---

## 2. Segmenty — korekta wstępnego podziału

Wstępna mapa wymienia sześć segmentów. Badanie pokazuje, że **sześć to za dużo o dwa** i że dzielą
się nie tam, gdzie sugerują nazwy.

### 2.1 Co naprawdę różni segmenty

| Wymiar | HOBBY‑CITY | HOBBY‑GARDEN | SEMI‑PRO | PRO‑FARMER |
|---|---|---|---|---|
| **Jednostka obserwacji** | egzemplarz | egzemplarz + grządka | **partia** (n szt.) | **powierzchnia** (ha) |
| Co znaczy „zdrowie" | roślina żyje | plon się uda | partia nadaje się na sprzedaż | plon ≥ progu opłacalności |
| Horyzont planowania | dni | sezon (rok) | cykl produkcyjny (6–12 tyg.) | płodozmian (3–5 lat) |
| Cena błędu | jedna roślina | jeden sezon w ogrodzie | partia = pieniądze | hektary = utrata dochodu **i kara** |
| Tolerancja na parametry | **zero** (żadnych pH/EC) | średnia | wysoka | wymagana |
| Kto wpisuje dane | użytkownik, gdy pamięta | użytkownik, sezonowo | pracownik, rutynowo | obowiązek prawny |

**Wniosek 1 — PRO‑GROWER i BUSINESS nie są osobnymi segmentami tego modułu.**
- *PRO‑GROWER* (plantator specjalizowany) to SEMI‑PRO z większą skalą i większym naciskiem na
  optymalizację — te same byty (partia, cykl, warunki), inna liczba zer. Osobny segment
  wygenerowałby równoległe poddrzewo bez nowego pojęcia.
- *BUSINESS* (garden center, hurtownia) to w istocie **handel**, nie uprawa. Jego potrzeby (katalog
  z cenami, B2B, zamówienia, faktury) to Magazynowanie Pro + Usługi + Portfel. Rośliny wnoszą tam
  wyłącznie *dane o roślinie*, nie własny sklep.

**Wniosek 2 — cztery tryby wystarczą, ale muszą siedzieć na PRZESTRZENI, nie na koncie.**
Właściciel podał to sam jako wymaganie („swoja kwiaciarnia i swój dom z ogrodem prywatny") i badanie
je potwierdza od drugiej strony: gdyby tryb był ustawieniem konta (wzorzec Magazynu/Warsztatów),
włączenie „Pro" dla kwiaciarni **zasypałoby parametrami także parapet w mieszkaniu** — czyli zepsuło
segment, który jako jedyny ma *zerową* tolerancję na parametry.

### 2.2 Docelowe tryby przestrzeni

```
PRZESTRZEŃ ROŚLINNA (rodzaj = tryb)
├── MIESZKANIE   — egzemplarze, doniczki, parapety. Bez parametrów. Cel: roślina ma żyć.
├── OGRÓD        — egzemplarze + grządki/strefy, sezon, pogoda, płodozmian w małej skali.
├── PRODUKCJA    — partie (n szt.), cykl produkcyjny, koszt jednostkowy, warunki hodowli.
└── POLE         — powierzchnie (ha), fazy BBCH, zabiegi z ewidencją, plon z hektara.
```

Jedno konto ma ich tyle, ile chce („Mieszkanie", „Działka u rodziców", „Kwiaciarnia").
Tryb **nie odbiera funkcji — steruje domyślnymi i widocznością pól**. To jest ważne rozróżnienie:
tryb, który *blokuje*, zmusza użytkownika do zakładania drugiej przestrzeni po to, żeby raz wpisać
pH. Tryb, który *domyślnie chowa*, kosztuje jedno kliknięcie „pokaż zaawansowane".

---

## 3. Mapa myśli — warstwa po warstwie, z oceną kompletności

Notacja werdyktu: **[TERAZ]** — w tej realizacji · **[ETAP N]** — świadomie odłożone z planem ·
**[OBCE]** — realizuje inny moduł Omnii, tu tylko integracja · **[NIE]** — odrzucone, z powodem.

---

### Poziom 1 — Przestrzenie i byty roślinne

**(a) Wstępna mapa:** „Moje kolekcje": mieszkanie / ogród / kwiaciarnia / plantacja / kolekcje
udostępnione.

**(b) Czego brakuje — dokładka z badań:**
1. **Mapa nie ma pojęcia „gdzie w przestrzeni".** Mówi o kolekcjach, ale roślina stoi *gdzieś*:
   parapet południowy, grządka B, sektor A półka 3, pole nr 4. To jedno pojęcie (**miejsce**) w
   czterech skalach — i to ono, a nie kolekcja, niesie warunki (nasłonecznienie, gleba, powierzchnia).
   Bez niego nie da się później zrobić ani płodozmianu („co tu rosło rok temu"), ani adaptacyjnego
   podlewania (światło jest cechą miejsca, nie rośliny).
2. **Mapa nie rozstrzyga liczności.** „Roślina" u mieszkańca to 1 szt., u kwiaciarni 100 szt. w
   partii, u rolnika 4,2 ha. Bez pola liczności powstaną trzy równoległe tabele.
3. **Brak cyklu życia bytu.** Roślina jest kupowana/wysiewana, rozmnażana (sadzonka → nowy byt z
   rodzicem), przesadzana, sprzedawana, **umiera**. Zwłaszcza śmierć: aplikacje roślinne notorycznie
   nie mają jak zapisać, że roślina padła — a to najcenniejsza dana zwrotna („co mi się nie udaje").
4. **Brak pojęcia „archiwum sezonu".** W ogrodzie i na polu byt kończy się co roku, ale jego historia
   musi zostać, bo z niej wynika płodozmian.

**(c) Co Omnia już ma:** własność przez `Workspace` (osobista/zespołowa), udostępnianie przez
`platform/sharing` z czterema rolami, kosz z retencją. **Przestrzeń roślinna to NIE jest
`Workspace`** — to byt wewnątrz modułu (użytkownik ma kilka w jednej przestrzeni własnościowej),
dokładnie jak `Workshop` w Warsztatach i `Store` w Zakupach.

**(d) Werdykt:**
- **[TERAZ]** przestrzeń roślinna z trybem; miejsce (o zmiennej skali) z warunkami; byt roślinny z
  licznością, stanem cyklu życia i rodzicem (rozmnażanie); archiwum przez stan, nie przez kasowanie.
- **[TERAZ]** udostępnianie przestrzeni — przez `platform/sharing`, bez własnych ról (C‑17).
- **[ETAP 2]** mapa 2D z przeciąganiem roślin (wymaga edytora graficznego — Omnia ma precedens w
  edytorze grafu sklepów, ale to samodzielny kawał pracy).
- **[NIE]** „kolekcje udostępnione od botaników" jako osobny byt — to zwykłe udostępnienie
  przestrzeni; osobne pojęcie byłoby drugą prawdą o dostępie.

> **Czy da się na tym poziomie wymyślić coś jeszcze?** Tak, i to jedna rzecz z dużą dźwignią:
> **byt roślinny z rodzicem** (sadzonka wie, z czego pochodzi). To za darmo daje kwiaciarni
> rodowód partii, hobbyście „rozmnożyłem Monsterę na 4 sztuki, 3 się przyjęły" (a więc realną
> skuteczność rozmnażania), a hodowcy szkielet pod genetykę w kolejnym etapie. Wstępna mapa umieszcza
> genetykę dopiero w poziomie 10 jako narzędzie zaawansowane — badanie mówi, że **samo pole rodzica
> jest tanie teraz i drogie potem** (dokładanie relacji do istniejących wierszy = migracja z
> backfillem).

---

### Poziom 2 — Wiedza o gatunkach (katalog)

**(a) Wstępna mapa:** 50 000+ profili roślin, wyszukiwarka, identyfikator AI, porównywarka, rekomendator.

**(b) Czego brakuje / co jest nierealne:**
1. **„50 000+ profili" to nie jest funkcja, to jest zobowiązanie do utrzymywania bazy botanicznej.**
   Badanie pokazuje trzeźwą alternatywę: dane taksonomiczne są otwarte (GBIF, Pl@ntNet — nazwy
   zwyczajowe w 54 językach), ale **dane pielęgnacyjne już nie** (ile podlewać, jakie światło — to
   jest własność komercyjnych aplikacji). Zatem: albo mały, ręcznie utrzymany słownik, albo LLM jako
   źródło wiedzy pielęgnacyjnej, albo import z zewnętrznego API.
2. **Mapa nie zauważa, że Omnia ma już wzorzec na dokładnie ten problem.** `NewsSourceCatalog` (419
   zaseedowanych źródeł RSS, systemowe, bez właściciela, zarządzane w `/admin`) i
   `src/lib/warsztat/catalog.ts` (statyczny katalog wyposażenia per profil). To jest gotowa,
   sprawdzona odpowiedź: **systemowy słownik gatunków zaseedowany migracją, rozszerzalny przez
   użytkownika i admina.**
3. **Brak pojęcia „profil pielęgnacyjny" oddzielonego od gatunku.** Ta sama Monstera w mieszkaniu i
   w szklarni ma inne potrzeby. Profil = gatunek × warunki miejsca.
4. **Rekomendator jest mocniejszy, niż mapa zakłada** — bo Omnia zna już użytkownika: ma jego
   lokalizację (Pogoda), jego istniejące rośliny i to, co mu padło. „Co posadzić" z takim kontekstem
   to inna jakość niż quiz w obcej aplikacji.

**(c) Co Omnia ma:** wzorzec katalogu systemowego (`NewsSourceCatalog` + `/admin/zrodla-rss`),
`vision` jako typ operacji LLM (OCR w Kuchni i Magazynie — więc ścieżka „zdjęcie → model" jest
przetarta), `buildUserContext` (wiedza o użytkowniku wchodząca do promptów).

**(d) Werdykt:**
- **[TERAZ]** systemowy katalog gatunków zaseedowany migracją (rząd wielkości: 150–250 pozycji
  pokrywających realne polskie użycie — rośliny doniczkowe, warzywa, zioła, owoce, zboża), z polami
  pielęgnacyjnymi i wymaganiami; użytkownik może dodać własny gatunek.
- **[TERAZ]** identyfikacja ze zdjęcia przez LLM (`vision`) — nie własny model, nie zewnętrzne API.
- **[TERAZ]** rekomendator „co posadzić" karmiony kontekstem użytkownika i przestrzeni.
- **[ETAP 2]** import/synchronizacja z Pl@ntNet/GBIF (wymaga klucza i polityki cache'owania).
- **[ETAP 3]** porównywarka A vs B — użyteczna dopiero, gdy katalog jest duży.
- **[NIE]** własna baza 50 000 gatunków utrzymywana ręcznie — koszt utrzymania nieproporcjonalny,
  a LLM + mały słownik pokrywa realne zapytania.

> **Czy da się wymyślić coś jeszcze?** Tak: **słownik musi mieć „skąd to wiem"**. Wiersz z migracji,
> wiersz od użytkownika i wiersz wygenerowany przez LLM to trzy różne poziomy zaufania. Bez tego pola
> po pół roku nikt nie odróżni faktu botanicznego od halucynacji, którą ktoś kliknął „zapisz".
> To jest dokładnie lekcja `UserFact` (`confidence`/`origin`) zastosowana do gatunków.

---

### Poziom 3 — Opieka, obserwacja, harmonogram

**(a) Wstępna mapa:** harmonogram (podlewanie/nawożenie/przycinanie), przypomnienia, dziennik,
tracking wzrostu, IoT, integracja pogody.

**(b) Dokładka z badań — tu jest najważniejsze pojedyncze ustalenie całego dokumentu:**
1. **Harmonogram nie może być stałą liczbą dni z gatunku.** Rynek (Planta, Greg) rozstrzygnął to
   już: interwał liczy się z **gatunku × wielkości doniczki × światła w miejscu × pory roku ×
   pogody**. Aplikacja mówiąca „podlewaj co 7 dni" jest w styczniu szkodliwa (zalanie), a w lipcu
   spóźniona. **Omnia ma tu przewagę strukturalną, o której wstępna mapa nie wie: moduł Pogoda z
   lokalizacjami i prognozą już istnieje.** Konkurencja musi tę integrację kupić; tu jest wewnątrz.
2. **Wykonanie zabiegu to zdarzenie, a nie „odhaczenie".** Ta sama tabela musi unieść: podlanie w
   mieszkaniu, oprysk na polu (z preparatem, dawką, powierzchnią) i przesadzenie partii. Jeśli
   powstaną dwie tabele („czynności hobbysty" i „zabiegi rolnika"), ewidencja ŚOR z poziomu 7 nie
   będzie miała skąd czytać danych.
3. **Brak „pominąłem/przesunąłem".** Harmonogram, którego nie da się odłożyć, po tygodniu pokazuje
   50 zaległych pozycji i użytkownik przestaje go czytać. To jest znany sposób, w jaki umierają
   aplikacje z przypomnieniami.
4. **Pomiar to nie tylko wysokość.** Liczba liści, obwód pnia, wilgotność podłoża, plon — jeden byt
   „pomiar" z rodzajem i jednostką, nie kolumna na każdą wielkość.
5. **Zdjęcie w czasie to osobna wartość.** Ta sama roślina, to samo ujęcie, co tydzień — to jedyny
   sposób, w jaki hobbysta *widzi*, że jego opieka działa. Wstępna mapa wymienia to jako „progress
   shots"; badanie podnosi to do rangi funkcji pierwszej klasy, bo to najsilniejszy mechanizm
   utrzymania użytkownika przy module.

**(c) Co Omnia ma:** `src/lib/recurrence.ts` (wspólna logika powtarzalności — zadania, nawyki,
zabiegi u zwierząt, leki), `MedicationSchedule`/`MedicationLog` jako **gotowy, sprawdzony wzorzec
„harmonogram + log wykonania"**, `Notification` + `syncReminders`, wkład do wspólnego kalendarza,
`userTime.ts` (granice doby w strefie użytkownika — inaczej „dzisiaj" kłamie), Pogoda.

**(d) Werdykt:**
- **[TERAZ]** harmonogram opieki na wzorcu `MedicationSchedule` (rodzaj zabiegu, powtarzalność,
  następny termin) + log wykonania jako **jedno** zdarzenie‑zabieg, dość szerokie, by unieść oprysk.
- **[TERAZ]** adaptacja interwału do pory roku i pogody (deszcz odsuwa podlewanie ogrodu; sezon
  spoczynku wydłuża interwał w mieszkaniu) — z jawnym wskazaniem, **dlaczego** termin się przesunął.
- **[TERAZ]** pomiary z rodzajem i jednostką; dziennik ze zdjęciami; „pominąłem / przesuń".
- **[TERAZ]** wpięcie w kalendarz i powiadomienia (moduł deklaruje wkład — C‑36).
- **[ETAP 2]** IoT / sensory. Powód odłożenia jest konkretny: to nie jest funkcja UI, tylko
  **przyjmowanie danych z zewnątrz** — potrzebne uwierzytelnianie urządzenia, limitowanie i polityka
  retencji szeregu czasowego. Model danych (pomiar z rodzajem i jednostką) jest jednak projektowany
  **tak, by sensor tylko dopisywał do tej samej tabeli** — dzięki temu etap 2 nie będzie migracją.
- **[ETAP 3]** automatyczne podlewanie (sterowanie urządzeniem — odpowiedzialność i bezpieczeństwo).

> **Czy da się wymyślić coś jeszcze?** Tak, dwie rzeczy, których nie ma ani wstępna mapa, ani
> konkurencja:
> **(i) „Dlaczego dziś?"** — przy każdym zadaniu opieki jedno zdanie uzasadnienia („bo od 9 dni bez
> deszczu i temperatura > 25°"). Aplikacja, która każe, jest posłuszna raz; aplikacja, która
> tłumaczy, **uczy** — a użytkownik, który rozumie, przestaje pytać AI o to samo (realna oszczędność
> tokenów, nie tylko UX).
> **(ii) Rejestr porażek.** Roślina, która padła, zostaje z przyczyną. Po roku moduł umie powiedzieć
> „trzy razy przelałeś sukulenty" — i to jest jedyna funkcja w całej mapie, która **poprawia
> użytkownika**, a nie tylko go obsługuje.

---

### Poziom 4 — Diagnoza i zdrowie

**(a) Wstępna mapa:** AI diagnoza ze zdjęcia, baza symptomów, rekomendacje leczenia, historia
zdrowia, forum eksperckie, wideo‑tutoriale.

**(b) Dokładka:**
1. **Diagnoza musi mieć kontekst, inaczej jest zgadywanką.** Żółty liść to może być przelanie,
   niedobór azotu, przesuszenie albo naturalne starzenie. Samo zdjęcie tego nie rozstrzyga —
   rozstrzyga zdjęcie **plus** historia podlewania, pora roku i miejsce. Omnia ma tę historię;
   samodzielna aplikacja od zdjęć jej nie ma. To jest drugi (po pogodzie) strukturalny powód, dla
   którego ten moduł ma sens akurat tutaj.
2. **Zalecenie musi mieć wariant naturalny/biologiczny PRZED chemicznym.** Nie z ideologii — bo
   segment hobby nie ma dostępu do środków profesjonalnych, a segment zawodowy podlega ewidencji.
3. **Diagnoza musi umieć powiedzieć „nie wiem".** Model, który zawsze nazywa chorobę, doprowadzi do
   opryskania zdrowej rośliny.
4. **Brak połączenia diagnozy z działaniem.** Diagnoza kończy się zwykle tekstem; powinna kończyć
   się **zaproponowanym zabiegiem w harmonogramie** (i, dla profesjonalisty, wpisem w ewidencji).
5. **Historia zdrowia musi trzymać także wynik.** Bez „czy pomogło" cała diagnostyka jest jednorazowa.

**(c) Co Omnia ma:** `vision` jako typ operacji, `rememberedContent` (pamięć treści AI ze znacznikiem
„nieaktualne”), `AiContentMeta` + `AiCostBadge` (koszt widoczny), `HealthEvent`/`HealthAttachment`
jako wzorzec „zdarzenie zdrowotne + załącznik".

**(d) Werdykt:**
- **[TERAZ]** diagnoza ze zdjęcia **z kontekstem** rośliny (gatunek, miejsce, ostatnie zabiegi,
  pogoda), z jawnym poziomem pewności i dopuszczalnym „nie wiem”; wynik zapisywany jako zdarzenie
  zdrowotne; **z przyciskiem „zaplanuj zalecany zabieg"**.
- **[TERAZ]** zalecenia w kolejności: naturalne → biologiczne → chemiczne, z ostrzeżeniem o ewidencji
  przy środkach profesjonalnych.
- **[ETAP 2]** przeszukiwalny katalog symptomów (ma sens, gdy jest już materiał z realnych diagnoz).
- **[NIE]** forum ekspertów, wideo‑tutoriale, czat z ekspertem — to buduje **społeczność**, a Omnia
  jest z założenia systemem jednego właściciela i jego zespołów. Patrz poziom 8.

> **Czy da się wymyślić coś jeszcze?** Tak: **diagnoza porównawcza w czasie.** Skoro dziennik trzyma
> zdjęcia tej samej rośliny co tydzień, model może dostać *dwa* zdjęcia („tak było 3 tygodnie temu,
> tak jest dziś") zamiast jednego. Postęp zmiany odróżnia chorobę od uszkodzenia mechanicznego lepiej
> niż jakikolwiek opis. Żadna z przejrzanych aplikacji tego nie robi, bo żadna nie ma pewności, że ma
> starsze zdjęcie **tej samej** rośliny — a moduł, w którym roślina jest bytem, ma.

---

### Poziom 5 — Planowanie i sezon

**(a) Wstępna mapa:** kalendarz sezonowy, rotacja upraw, planowanie przestrzeni 2D, budżetowanie,
listy zakupów, timeline projektów.

**(b) Dokładka:**
1. **Kalendarz ogrodniczy jest funkcją STREFY, nie kraju.** „Siej pomidory w marcu" jest fałszywe o
   3–4 tygodnie między Suwałkami a Wrocławiem. Omnia zna lokalizację użytkownika z Pogody — więc
   plan sezonu może być liczony dla *jego* miejsca, a nie przepisany z poradnika.
2. **Płodozmian to nie „ładna funkcja dla rolnika" — to reguła, którą da się sprawdzić.** Wymaga
   dokładnie jednej rzeczy: **historii miejsca** (co tu rosło w poprzednich sezonach) plus rodziny
   botanicznej gatunku. Jeśli poziom 1 zapisuje historię, a poziom 2 zna rodzinę, ostrzeżenie „psianka
   po psiance trzeci rok" kosztuje kilkadziesiąt linii. Jeśli któregoś z tych dwóch brakuje —
   płodozmian jest niewykonalny w ogóle. To jest argument za tym, żeby oba pola **były od początku**.
3. **Sąsiedztwo roślin (companion planting)** to ta sama mechanika co płodozmian, tylko w przestrzeni
   zamiast w czasie.
4. **Brak „co z tego wyszło".** Plan sezonu bez rozliczenia po sezonie to kalendarz, nie planowanie.

**(c) Co Omnia ma:** Kalendarz (wspólna agenda, moduł deklaruje wkład), Zadania (`createTask` w
kontrakcie — Pogoda już z tego korzysta przy „dodaj pomysł do zadań"), Zakupy
(`resolveOrCreateList`, `assertListAccess` — Kuchnia i Magazyn już tak robią listy zakupów), Portfel
(`bookAutoExpense` — Flota i Usługi już tak księgują koszty).

**(d) Werdykt:**
- **[TERAZ]** plan sezonu generowany przez AI **dla lokalizacji i przestrzeni użytkownika**, zapisany
  jako treść pamiętana (`rememberedContent`), z pozycjami dającymi się wysłać do Zadań.
- **[TERAZ]** historia miejsca + rodzina botaniczna gatunku → ostrzeżenie płodozmianowe. Prosta
  reguła, nie model.
- **[TERAZ, przez integrację]** listy zakupów (nasiona, nawozy) → Zakupy; koszty → Portfel.
  **[OBCE]** — moduł niczego takiego nie buduje u siebie.
- **[ETAP 2]** projektowanie przestrzeni 2D; sąsiedztwo roślin (wymaga danych o interakcjach).
- **[ETAP 3]** timeline projektu od nasienia do zbioru jako osobny widok.

> **Czy da się wymyślić coś jeszcze?** Tak: **plan sezonu powinien znać to, co już masz.** Wszystkie
> przejrzane aplikacje generują plan „dla ogrodu w twojej strefie". Moduł osadzony w Omnii może
> wygenerować plan, który uwzględnia, że w zeszłym roku pomidory ci padły na zarazę (dziennik), że
> masz już 12 doniczek bez miejsca (przestrzeń) i że przekroczyłeś budżet ogrodowy (Portfel).
> To jest różnica między poradnikiem a planem.

---

### Poziom 6 — Analityka

**(a) Wstępna mapa:** wydajność (kg/m²), ROI, trendy wzrostu, efektywność zasobów, benchmarking,
prognozy ML.

**(b) Dokładka i weryfikacja realności:**
1. **Benchmarking („porównanie z innymi ogrodnikami") wymaga wielu użytkowników z porównywalnymi
   danymi.** Omnia jest systemem osobistym. Dopóki nie ma populacji, ta funkcja pokazywałaby
   statystykę z próby n=1. **[NIE]** — nie z powodu trudności, tylko dlatego, że **nie ma z czego**.
2. **„Prognozy ML" na danych jednego użytkownika to nadużycie słowa.** Uczciwy odpowiednik to
   **porównanie rok do roku** i **ekstrapolacja z fenologii** („zeszły rok: pierwszy pomidor
   12 sierpnia; w tym roku kwitnienie ruszyło 6 dni wcześniej"). To jest wykonalne i prawdziwe.
3. **Najcenniejsza analityka w tym module jest najprostsza i mapa jej nie wymienia:**
   **przeżywalność** (ile roślin padło, których gatunków, w którym miejscu) i **koszt utrzymania
   przy życiu**. To odpowiada na pytanie, które użytkownik naprawdę sobie zadaje.

**(c) Co Omnia ma:** `platform/cache/stempel.ts` (agregaty cache'owane stemplem przestrzeni),
`platform/observability` (metryki), wzorzec sekcji AI z podsumowaniem (`AiContentMeta` +
`rememberedContent` + tryb odświeżania).

**(d) Werdykt:**
- **[TERAZ]** podstawowa analityka przestrzeni: przeżywalność, plon łączny, porównanie z poprzednim
  sezonem, koszt (czytany z Portfela) — plus **jedna sekcja AI z wnioskami**, na wzorzec „AI
  takeaways" z Magazynowania.
- **[ETAP 2]** wydajność na jednostkę powierzchni i rentowność per uprawa (wymaga pełnej warstwy
  produkcyjnej).
- **[NIE]** benchmarking społecznościowy — brak populacji.
- **[NIE]** „prognozy ML" pod tą nazwą — zastąpione uczciwym porównaniem rok do roku.

> **Czy da się wymyślić coś jeszcze?** Tak, i jest to *odejmowanie*: analityka w tym module powinna
> domyślnie pokazywać **trzy liczby, nie trzydzieści**. Wzorzec z Pogody (085) jest tu wprost
> pouczający — właściciel kazał usunąć filtry statusu, bo zawijały się do drugiego rzędu, i przenieść
> pasek sterowania **nad** listę, bo wcześniej dowiadywał się o nieaktualności oceny dopiero po
> przewinięciu wszystkiego. Ta sama pułapka czeka analitykę roślin.

---

### Poziom 7 — Warstwa zawodowa: produkcja, ewidencja, zgodność

**(a) Wstępna mapa:** rozdziela to na „zarządzanie biznesem" (semi‑pro) i „dokumentację" (rolnik).

**(b) Dokładka — tu badanie zmienia obraz najmocniej:**
1. **Ewidencja zabiegów ŚOR ma twardy termin i konkretny zestaw pól.** Od 1 stycznia 2026
   profesjonalni użytkownicy środków ochrony roślin (ok. 1,3 mln osób w PL) muszą w prowadzonej
   ewidencji uwzględnić **nowe pola: rodzaj zastosowania środka, numer zezwolenia i dokładną
   lokalizację zabiegu**; zapisy mogą powstawać na papierze, ale muszą trafić do formy elektronicznej
   **do 31 stycznia roku następującego** po roku zastosowania. Kontrola weryfikuje kompletność
   danych, zgodność dawek i lokalizację.
   → To jest **jedyny element całej mapy z zewnętrznym, datowanym przymusem**. Jednocześnie jest
   tani: to rejestr zdarzeń z eksportem, a nie integracja z systemem rządowym.
2. **Skala BBCH daje wspólny słownik faz** — 10 głównych faz (0 kiełkowanie … 6 kwitnienie …
   8 dojrzewanie, 9 starzenie/spoczynek), rozwijanych o drugą cyfrę. Kluczowe: **ta sama skala działa
   dla pszenicy i dla pomidora na parapecie.** Zamiast osobnych „stadiów" per segment — jeden słownik,
   pokazywany profesjonaliście jako kod (`BBCH 65`), a hobbyście jako słowo („pełnia kwitnienia").
3. **Partia produkcyjna to ten sam byt co roślina, z licznością i kosztem.** Patrz poziom 1 —
   trzymanie tego w jednej tabeli jest warunkiem, żeby ewidencja i harmonogram działały wszędzie.
4. **Certyfikaty i ubezpieczenia to załączniki z datą ważności.** Omnia ma dokładnie ten wzorzec
   trzy razy (`VehicleAttachment` — ubezpieczenie/dowód, `HealthAttachment`, `NoteAttachment`).

**(c) Co Omnia ma i czego NIE wolno budować drugi raz:** Magazynowanie Pro (partie/FEFO, dostawcy,
dokumenty PZ/WZ z OCR, zamówienia, analityka ABC), Portfel (koszty, budżety, raporty, waluty,
auto‑księgowanie), Usługi (sprzedaż, wyceny, płatności, faktury), Kontakty (CRM).

**(d) Werdykt:**
- **[TERAZ]** **rejestr zabiegów z polami wymaganymi od 2026** (data, miejsce/uprawa, powierzchnia,
  preparat, dawka, rodzaj zastosowania, numer zezwolenia, wykonujący, warunki) + **eksport do pliku**.
  Bez integracji z systemem rządowym — sam rejestr i eksport, zgodnie z decyzją właściciela.
- **[TERAZ]** fazy BBCH jako wspólny słownik, z dwiema prezentacjami (kod / słowo).
- **[TERAZ]** partia jako liczność bytu + koszt jednostkowy liczony z zabiegów.
- **[OBCE → integracja]** zapasy, dostawcy, dokumenty, zamówienia → Magazynowanie; koszty i
  rentowność → Portfel; sprzedaż → Usługi; klienci → Kontakty.
- **[ETAP 2]** certyfikaty i dokumenty z datą ważności (wzorzec `VehicleAttachment`).
- **[ETAP 3]** ceny rynkowe, dotacje, umowy kontraktacyjne.

> **Czy da się wymyślić coś jeszcze?** Tak, jedna rzecz warta więcej niż reszta poziomu:
> **karencja i prewencja.** Zabieg środkiem ochrony roślin niesie okres karencji (ile dni do zbioru)
> i prewencji (ile do wejścia). Skoro rejestr i tak zapisuje preparat i datę, moduł może **zablokować
> zbiór albo ostrzec** — i to jest funkcja, której nie ma ani w papierowej ewidencji, ani w
> aplikacjach do doniczek, a która realnie zapobiega szkodzie. Wpisana **[ETAP 2]** wyłącznie dlatego,
> że wymaga danych o preparatach, których nie mamy z czego zaseedować; **pole na karencję w rejestrze
> zakładamy jednak od razu**, żeby etap 2 nie był migracją.

---

### Poziom 8 — Społeczność i wiedza

**(a) Wstępna mapa:** forum, marketplace, blog, webinary, wiki, wyzwania.

**(b) Weryfikacja:** cały ten poziom zakłada **populację użytkowników**. Omnia jest systemem
osobistym Szymona z zespołami — nie ma forum, nie ma treści publicznych, wszystkie strony poza
logowaniem wymagają sesji („No public/anonymous mode"). Marketplace w Omnii **istnieje** (moduł
Usługi), ale jest marketplace'em usług, a nie sklepem z roślinami.

**(d) Werdykt:**
- **[NIE]** forum, blog, webinary, wyzwania, ranking „kto ma najstarszą roślinę" — sprzeczne z naturą
  systemu, a nie tylko drogie.
- **[TERAZ, w innej formie]** to, co z tego poziomu jest realne, sprowadza się do **dzielenia się
  przestrzenią lub rośliną z konkretną osobą** — czyli do udostępniania, które platforma już ma
  (`ShareDialog`, `platform/sharing`). Zamiast forum: „mój ogród widzi żona", „opiekun podlewa mi
  kwiaty przez tydzień".
- **[ETAP 3]** własna wiki roślinna — w Omnii to są Notatki (wikilinki `[[Tytuł]]`), więc raczej
  **linkowanie roślin do notatek** niż osobny byt.

> **Czy da się wymyślić coś jeszcze?** Tak, i to zamiana o dużym zysku: **„opieka zastępcza"**.
> Wyjazd na urlop to najczęstszy moment, w którym rośliny giną. Udostępnienie przestrzeni w roli
> `viewer`/`editor` na czas wyjazdu, z widokiem „co podlać dziś", zastępuje kartkę na lodówce i jest
> **zerowym kosztem** — cała mechanika stoi już w platformie. Wstępna mapa tego nie widzi, bo szuka
> społeczności tam, gdzie potrzebna jest jedna osoba.

---

### Poziom 9 — Integracje i automatyka

**(a) Wstępna mapa:** IoT, smart watering, API, eksport CSV/PDF, alerty, integracja z mediami
społecznościowymi.

**(b) Dokładka:** najcenniejsze integracje tego modułu są **wewnętrzne**, nie zewnętrzne — i wstępna
mapa ich nie wymienia ani razu:

| Integracja | Kierunek | Wartość |
|---|---|---|
| Pogoda → Rośliny | odczyt prognozy dla lokalizacji | adaptacyjny harmonogram, alarm przymrozkowy |
| Rośliny → Zadania | `createTask` | „dokup nawóz" trafia tam, gdzie użytkownik i tak patrzy |
| Rośliny → Zakupy | `resolveOrCreateList` | nasiona i nawozy na liście zakupów |
| Rośliny → Portfel | `bookAutoExpense` | koszt uprawy bez drugiej księgowości |
| Rośliny → Kuchnia | zbiór → spiżarnia | **zamknięcie pętli: z grządki na talerz** |
| Rośliny → Kalendarz | wkład do agendy | zabiegi obok wizyt i zadań |
| Rośliny → Magazynowanie | pozycje | nasiona/nawozy jako zapas, gdy użytkownik tego chce |

Pozycja „Rośliny → Kuchnia" jest tą, która najmocniej uzasadnia istnienie modułu **akurat w Omnii**:
żadna samodzielna aplikacja ogrodnicza nie może zapisać zbioru do spiżarni i podpowiedzieć przepisu,
bo nie ma spiżarni. Omnia ma (`PantryItem`, `suggestFromPantry`).

**(d) Werdykt:**
- **[TERAZ]** Pogoda, Zadania, Kalendarz, Powiadomienia, Portfel, Zakupy — wszystkie przez kontrakty.
- **[TERAZ]** zbiór → spiżarnia Kuchni (jedna funkcja z kontraktu Kuchni, ogromny efekt).
- **[TERAZ]** eksport danych przestrzeni (rejestr zabiegów — wymóg prawny; reszta przy okazji).
- **[ETAP 2]** IoT/sensory (patrz poziom 3 — model danych już na to gotowy).
- **[ETAP 3]** API zewnętrzne, sterowanie nawadnianiem.
- **[NIE]** integracja z Instagramem — Omnia nie publikuje na zewnątrz.

---

### Poziom 10 — Narzędzia zaawansowane

**(a) Wstępna mapa:** symulator wzrostu ML, genetyka/hodowla, modelowanie pól, sensoryka
multispektralna, badania botaniczne z uczelniami.

**(b) Weryfikacja:** to jest poziom aspiracyjny i **taki powinien zostać**. Dwie uwagi z badań:
1. **Genetyka nie jest tu potrzebna jako narzędzie — jest potrzebna jako POLE.** Moduł Zwierzęta ma
   `petGenetics.ts` i pary hodowlane; w roślinach odpowiednikiem jest relacja rodzic → sadzonka,
   którą poziom 1 wprowadza **teraz**. Reszta genetyki (krzyżowanie odmian, przewidywanie cech) to
   nadbudowa na tej relacji, nie osobny byt.
2. **„Symulator wzrostu" ma tani, uczciwy odpowiednik: suma temperatur efektywnych.** Klasyczna,
   niemodelowa metoda przewidywania terminu zbioru — sumowanie średnich dobowych ponad progiem
   gatunku. Dane pogodowe już są. To nie jest ML i nie udaje ML, a odpowiada na to samo pytanie
   („kiedy zbierać").

**(d) Werdykt:**
- **[TERAZ]** relacja rodzic → potomstwo (fundament pod genetykę).
- **[ETAP 2]** suma temperatur efektywnych → przewidywany termin zbioru.
- **[ETAP 3+]** modelowanie pól, NDVI, sensoryka multispektralna, współpraca badawcza.
- **[NIE]** „symulator wzrostu ML" pod tą nazwą — patrz wyżej.

---

## 4. Przegląd konkurencji — gdzie jest poprzeczka i gdzie jest luka

| Aplikacja | W czym wygrywa | Czego strukturalnie nie może zrobić |
|---|---|---|
| **PictureThis** | identyfikacja gatunku ze zdjęcia | nie prowadzi uprawy ani dokumentacji |
| **Planta** | kalendarz opieki + światłomierz; model podlewania z doniczki, światła i pogody | jeden segment (rośliny domowe); brak warstwy zawodowej |
| **Greg** | najlepszy model podlewania (doniczka + światło + gatunek), skan otoczenia | j.w. |
| **Systemy rolnicze (FMS)** | pola, zabiegi, ewidencja, plony | nieużywalne dla parapetu; drogie; osobny świat |
| **Omnia — moduł Rośliny** | **jedno konto obsługuje parapet i kwiaciarnię**; harmonogram karmiony istniejącym modułem Pogody; diagnoza z HISTORIĄ rośliny; ewidencja ŚOR; zbiór → spiżarnia | — |

**Wniosek:** luka rynkowa nie leży w żadnej pojedynczej funkcji — wszystkie istnieją gdzieś osobno.
Leży w **ciągłości**: te same pojęcia od parapetu do hektara, w systemie, który zna już pogodę
użytkownika, jego zadania, jego spiżarnię i jego pieniądze. To jest teza, którą realizuje spec.

---

## 5. Co z tego wynika dla zakresu (decyzje właściciela)

Właściciel rozstrzygnął cztery pytania; wszystkie zgodnie z rekomendacją wynikającą z powyższego:

| Pytanie | Decyzja | Konsekwencja dla realizacji |
|---|---|---|
| Zakres tej realizacji | **Rdzeń wielosegmentowy + AI** | Poziomy 1–5 w całości, 6 częściowo, 7 w części ewidencyjnej; 8–10 etapami |
| Tryby | **Tryb per przestrzeń** (Mieszkanie/Ogród/Produkcja/Pole) | Tryb steruje domyślnymi i widocznością pól, nie odbiera funkcji |
| Warstwa handlowa | **Integracja z Magazynem/Portfelem/Usługami** | Moduł nie buduje zapasów, faktur ani księgowości |
| Ewidencja ŚOR | **Tak — rejestr + eksport** | Rejestr zabiegów z polami wymaganymi od 2026‑01‑01, bez integracji rządowej |

---

## 6. Ryzyka wykryte w badaniach (z konkretnym środkiem zaradczym)

| Ryzyko | Dlaczego realne | Środek |
|---|---|---|
| **Moduł rozlewa się na wszystkie 10 poziomów** | Mapa właściciela jest wielkości całej Omnii | Zakres domknięty decyzją; wszystko poza nim wypisane w `spec.md` z numerem etapu |
| **Trzy równoległe poddrzewa (hobby / partia / pole)** | Naturalna pokusa modelowania każdego segmentu osobno | **Jeden** byt roślinny z licznością i skalą miejsca — sprawdzalne w recenzji |
| **Interfejs Pro zasypuje hobbystę** | Segment hobby ma zerową tolerancję na parametry | Tryb na przestrzeni; pola zaawansowane domyślnie schowane, nie zablokowane |
| **AI kosztuje przy każdym otwarciu widoku** | Cztery zastosowania LLM × wiele widoków | `rememberedContent` + tryb odświeżania + `AiCostBadge` z nazwą akcji (wymóg bramki `check:cost-badge`) |
| **Diagnoza AI zawsze coś nazywa** | Model niechętnie mówi „nie wiem" | Wymuszony poziom pewności i dopuszczalne „nie wiem" w kontrakcie akcji |
| **Ewidencja niekompletna wobec przepisu** | Kontrola sprawdza kompletność pól | Pola rejestru wprost z wymogu (rodzaj zastosowania, numer zezwolenia, lokalizacja) + eksport |
| **Roślina „na wszelki wypadek" dubluje Magazyn** | Nasiona i nawozy wyglądają jak zapas | Granica: Rośliny = to, co rośnie; Magazyn = to, co leży na półce |

---

## 7. Ślad źródeł

- Zmiana w ewidencji stosowania środków ochrony roślin od 1 stycznia 2026 (nowe pola: rodzaj
  zastosowania, numer zezwolenia, dokładna lokalizacja; forma elektroniczna do 31 stycznia roku
  następnego; ok. 1,3 mln użytkowników profesjonalnych) — komunikaty branżowe i samorządowe, m.in.
  `farmer.pl`, `agrofakt.pl`, `samorzad.gov.pl`, `zodr.pl`.
- Skala BBCH — monografia „Growth stages of mono- and dicotyledonous plants" (10 głównych faz 0–9,
  druga cyfra jako faza szczegółowa; zastosowania: ochrona roślin, nawożenie, nawadnianie, termin
  zbioru, modelowanie fenologiczne).
- Pl@ntNet API / GBIF — identyfikacja z 1–5 zdjęć ze wskaźnikiem pewności; dane taksonomiczne i nazwy
  zwyczajowe w ponad 50 językach; obserwacje publikowane do GBIF (`my.plantnet.org/doc/api`,
  `docs.plantnet.org`, `gbif.org`).
- Przegląd rynku aplikacji roślinnych 2026 (Planta, Greg, PictureThis, Botanicaly, Tazart) — model
  podlewania liczony z gatunku, wielkości doniczki, zmierzonego światła i lokalnej pogody.
- Kod i konwencje Omnii — `CLAUDE.md`, `.claude/spec-pipeline/constitution.md`, moduły `pets`,
  `weather`, `kitchen`, `magazynowanie`, `warsztaty`, `youtube` (102 — wzorzec nowego modułu).
