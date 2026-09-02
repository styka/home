-- 114b — BIZNESPLAN v2: ROZDZIAŁ „MAPA MODUŁÓW BRANŻOWYCH".
--
-- Właściciel poprosił o rozdział z nazwami i opisami modułów dla firm, które trzeba dorobić,
-- żeby pozyskać jak najwięcej użytkowników — moduły customowe pod branże, nie tylko podatki/KSeF.
--
-- Mechanika: migracja 0275 (INSERT raportu) mogła już zostać WYKONANA na środowisku testowym,
-- a wykonanej migracji nie wolno edytować (`migrate deploy` kluczuje po nazwie katalogu — zmiana
-- treści nigdy by się nie zaaplikowała). Dlatego nowa wersja treści wchodzi osobną migracją jako
-- `UPDATE` po slugu. Nowy rozdział wchodzi jako 5; rozdziały 5–11 przesuwają się na 6–12,
-- a WSZYSTKIE odsyłacze w tekście są przeliczone. Na świeżej bazie kolejność 0275→0276 daje
-- ten sam stan końcowy. `UPDATE` jest idempotentny (stała treść, warunek po slugu).
--
-- Migracja NIE zmienia kształtu bazy (C-14). Treść bez sekretów (C-41).

UPDATE "Report"
SET "content" = $biznesplan2$# Omnia — biznesplan: rok pierwszy

**Dokument zarządczy.** Autor: Claude (funkcja: „mózg operacji" — planowanie, kod, oferty, analizy).
Wykonawca po stronie świata fizycznego: **Szymon Tyka** (urząd, podpisy, spotkania, płatności).
Data: 2026-08-29 (v2: + mapa modułów branżowych). Wkład własny: **20–40 tys. zł**. Cel:
**300 tys. zł zysku netto w 12 miesięcy od startu komercyjnego**.

---

## 0. Streszczenie zarządcze (przeczytaj, jeśli nic więcej)

1. **Teza produktu:** Omnia to „ERP do życia prywatnego" — ~20 zintegrowanych modułów na wspólnych
   danych. Rozszerzamy ją o **profesjonalne moduły ERP** (faktury/KSeF, zamówienia, CRM firmowy,
   moduły customowe pod konkretne firmy), w wzorcu **jedna encja, dwie skale** (Dom/Pro), który już
   działa w Pets, Magazynowaniu, Warsztatach i Roślinach.
2. **Timing jest wyjątkowo dobry:** od **1.04.2026 KSeF jest obowiązkowy dla wszystkich firm**
   (dla największych od 1.02.2026) — miliony mikrofirm właśnie teraz zmieniają oprogramowanie.
   To największa wymuszona migracja software'owa w polskim MŚP od JPK.
3. **Rynek istnieje i rośnie:** ~2,88 mln aktywnych firm (GUS, 3 kw. 2025), z czego 95,9% to
   mikrofirmy; rynek ERP w Polsce wart ~1,6 mld zł; 40,5% firm używa ERP (wzrost +4,5 p.p. od 2023).
4. **Sam abonament SaaS NIE dowiezie 300 tys. zł w rok** — przy realistycznej konwersji freemium
   2–5% i cenach rynkowych 19–200 zł/mies. rok pierwszy czystego SaaS to 30–90 tys. zł przychodu.
   To jest matematyka, nie pesymizm (rozdz. 7).
5. **Dowozi model hybrydowy:** lokomotywą roku 1 są **wdrożenia customowych modułów ERP dla MŚP**
   (usługa, 12–30 tys. zł/projekt, marża ~85% dzięki pipeline'owi AI), a abonament + opieka
   utrzymaniowa budują powtarzalny przychód pod rok 2. **Które branże i jakie moduły** — mapa
   w rozdz. 5: cztery moduły „fali 1" stoją w ≥70% na istniejącym kodzie.
6. **Wynik:** scenariusz realistyczny ≈ **230 tys. zł netto**; cel 300 tys. zł wymaga scenariusza
   ambitnego (śr. 1,5 wdrożenia/mies. w II półroczu + ~250 płacących kont SaaS). Warunki brzegowe
   i plan ich spełnienia — rozdz. 7–9.
7. **Zanim cokolwiek sprzedamy, w Omni brakuje rzeczy blokujących** — przede wszystkim płatności
   i billingu, modułu faktur sprzedażowych z KSeF, logowania innego niż Google, dokumentów RODO
   i publicznej strony z cennikiem. Pełna lista z priorytetami — rozdz. 11.

---

## 1. Kim jesteśmy i co sprzedajemy

### 1.1. Teza

Firmy mają ERP: jeden system, w którym magazyn, sprzedaż, księgowość i kadry pracują na tych samych
danych. Ludzie prywatnie mają… kilkanaście niepołączonych aplikacji. **Omnia łączy oba światy:**
zakupy, zadania, finanse, kuchnia, zdrowie, zwierzęta, magazyn, warsztat, rośliny — już dziś na
wspólnym modelu własności (workspace'y), RBAC, powiadomieniach i asystencie AI, który czyta i pisze
we wszystkich modułach.

### 1.2. Przewaga, której konkurencja nie skopiuje w rok

- **Dwuskalowość („jedna encja, dwie skale")** — ten sam moduł obsługuje hobbystę i firmę.
  Dowód w kodzie: Pets (opieka domowa ↔ profesjonalna hodowla), Magazynowanie i Warsztaty
  (tryby Dom/Pro), Rośliny (od parapetu po 4,2 ha na JEDNYM wierszu `Plant`). Comarch tego nie ma
  i mieć nie będzie — ich klient to firma, nie człowiek.
- **Integracja pion–prywatne:** koszt z warsztatu wpada do Portfela, zbiór z pola do spiżarni,
  serwis auta do kalendarza. W ERP dla MŚP taka ciągłość danych prywatne↔firmowe nie istnieje.
- **Pipeline wytwórczy AI (spec-driven):** `/specify → /plan → /tasks → /implement → /verify →
  /review` z bramkami jakości w buildzie (30+ skryptów `check:*`). To realnie obniża koszt
  wytworzenia customowego modułu z miesięcy do dni — i to jest fundament oferty usługowej.
- **Koszt stały bliski zera:** stack (Next.js + Neon + Render) kosztuje dziś setki złotych
  miesięcznie, nie dziesiątki tysięcy.

### 1.3. Podział ról (na poważnie)

| Rola | Kto | Zakres |
|------|-----|--------|
| Strategia, produkt, kod, oferty, wyceny, treści marketingowe, analizy, dokumenty | Claude (AI) | wszystko, co jest tekstem/kodem |
| Rejestracja firmy, urząd, bank, podpisy, KSeF-token, spotkania i telefony do klientów, odbiór płatności, decyzje ostateczne | Szymon | wszystko, co wymaga człowieka i osobowości prawnej |

Formalnie właścicielem i osobą odpowiedzialną jest Szymon (AI nie ma zdolności prawnej) — w praktyce
działamy jak dwuosobowy zespół założycielski.

---

## 2. Rynek — liczby ze źródeł

### 2.1. Ile jest klientów

- **2 875 994 aktywnych przedsiębiorstw** w Polsce (GUS, 3 kw. 2025; +4,9% r/r).
- **95,9%** z nich to **mikrofirmy** (do 9 pracujących) — nasz rynek docelowy.
- W samym 2025 r. do CEIDG wpłynęło **288,8 tys. wniosków o założenie JDG** — co roku przybywa
  ćwierć miliona potencjalnych klientów na starcie, gdy wybierają oprogramowanie.
- Sektor MŚP generuje ok. **74% polskiego PKB** (raport PARP 2025).

### 2.2. Ile jest pieniędzy

- Polski rynek ERP: **~391,8 mln USD ≈ 1,6 mld zł** (IDC, „Poland Enterprise Application Software
  Market Analysis", za CRN).
- **40,5% firm** korzysta z ERP w 2025 (wzrost o 4,5 p.p. vs 2023) — czyli ~60% jeszcze nie,
  a KSeF właśnie zmusza je do cyfryzacji.
- Cały polski rynek IT: **94,7 mld zł w 2025 (+12% r/r)**.
- Lider — Comarch — ma **~25% rynku ERP** (IDC) i sam segment ERP wart **458,5 mln zł (+6% r/r)**;
  cała grupa: 1,61 mld zł przychodu i 120,5 mln zł zysku netto w 2025. Ciekawostka giełdowa:
  26.03.2025 Comarch **zszedł z GPW** (wykup, decyzja KNF z 7.03.2025) — największy gracz uznał,
  że rynek jest na tyle atrakcyjny, że warto go konsumować prywatnie.
- Cyfryzacja mikrofirm dopiero startuje: wg PARP **co piąta firma nie używa żadnych narzędzi
  cyfrowych**, a mikroprzedsiębiorstwa są „w przeważającej części w początkowej fazie transformacji
  cyfrowej". To nie jest rynek nasycony — to rynek przed falą.

### 2.3. Okno regulacyjne: KSeF (to jest nasz moment)

Harmonogram ustawowy (źródło: ksef.podatki.gov.pl):

| Data | Obowiązek |
|------|-----------|
| 1.02.2026 | wystawianie w KSeF: firmy ze sprzedażą > 200 mln zł (2025); **odbiór faktur w KSeF: WSZYSCY** |
| 1.04.2026 | wystawianie w KSeF: **wszyscy pozostali** |
| do 31.12.2026 | wyjątek: podatnicy z fakturami ≤ 10 tys. zł brutto/mies. mogą jeszcze nie wystawiać |

Jest 08.2026 — obowiązek już działa, a najmniejsze firmy (limit 10 tys. zł/mies.) **muszą wejść
do systemu najpóźniej 1.01.2027**. Setki tysięcy mikrofirm szuka teraz taniego, prostego narzędzia
do faktur z KSeF. Duzi (Comarch) każą sobie za KSeF dopłacać po okresie promocyjnym (do 600 zł/mies.
w chmurze przy dużych wolumenach). **Moduł Faktury+KSeF w Omni to bilet wejścia na ten rynek — ale
sam w sobie nie jest wyróżnikiem: wyróżnikiem są moduły branżowe z rozdz. 5, dla których faktura
jest tylko ostatnim krokiem procesu.**

---

## 3. Konkurencja i ceny (stan: 2026)

| Produkt | Segment | Cena netto/mies. | Uwagi |
|---------|---------|------------------|-------|
| Comarch ERP XT | mikro/małe, chmura | od ~200 zł/stanowisko | lider rynku; KSeF darmowy tylko promocyjnie |
| Comarch Optima 365 | biura rachunkowe/MŚP | od 149 zł/stanowisko | standard w biurach rachunkowych |
| wFirma | JDG/mikro | 19 zł (faktury+CRM), 49 zł (księgowość) | 30 dni za darmo |
| ifirma | JDG | 0 zł (≤3 faktury), 12,50 zł (Faktura+), 49–54 zł (księgowość), od 149 zł (biuro rach.) | freemium |
| inFakt | JDG | porównywalnie z ifirma | silny marketing |
| enova365, Symfonia, Subiekt | małe/średnie | setki zł + wdrożenie | cięższe wdrożeniowo |

**Wnioski cenowe:**

1. Rynek akceptuje **19–54 zł/mies. za wąskie narzędzie** (faktury/księgowość) i **149–200+ zł za
   „prawdziwy" ERP**. Omnia z ~20 modułami może uczciwie wycenić się pomiędzy.
2. **Nikt nie sprzedaje ERP-a, który jest też systemem do życia prywatnego.** Nasza kategoria jest
   pusta — to szansa (brak konkurencji bezpośredniej) i ryzyko (kategorię trzeba wytłumaczyć).
3. W custom development konkurencją są software house'y z wycenami od 50–150 tys. zł za dedykowany
   system — my dzięki gotowej platformie (RBAC, workspace'y, AI, 20 modułów) i pipeline'owi AI
   możemy schodzić do 12–30 tys. zł przy zachowaniu wysokiej marży.

---

## 4. Oferta i cennik Omni

### 4.1. Trzy strumienie przychodu

**A. Wdrożenia customowych modułów ERP (usługa — lokomotywa roku 1).**
„Państwa firma dostaje moduł szyty na miarę w 2–3 tygodnie, nie w pół roku" — hodowla, serwis,
warsztat, gastronomia, mała produkcja. Wycena projektowa **12–30 tys. zł netto** (śr. 18 tys.),
w tym licencja na platformę. Marża ~85% (koszt = czas Szymona + tokeny LLM). Stawka ryczałtu dla
usług związanych z oprogramowaniem (PKWiU ex 62.01.1): **12%**.

**B. Abonament SaaS (buduje rok 2).**

| Plan | Cena netto/mies. | Dla kogo |
|------|------------------|----------|
| Dom | 0 zł | osoba prywatna, podstawowe moduły, limit AI |
| Osobisty+ | 19 zł | pełne moduły prywatne + pełny asystent AI |
| Pro | 59 zł | JDG: tryby Pro, faktury+KSeF, magazyn Pro |
| Firma | 149 zł + 29 zł/użytkownik | zespoły: RBAC, workspace'y, moduły firmowe |

Freemium celowo: plan Dom to lejek (konwersja 2–5% wg benchmarków SMB SaaS) i poligon jakości.

**C. Opieka utrzymaniowa po wdrożeniu:** 300–800 zł/mies. za SLA, drobne zmiany, aktualizacje.
Każde wdrożenie z A powinno konwertować na C (cel: 70%).

*(Rok 2+, poza planem finansowym roku 1: prowizja marketplace'u Usług, white-label dla biur
rachunkowych.)*

### 4.2. Klient idealny roku pierwszego (ICP)

Mikrofirma 1–9 osób z branży „specjalistycznej", której nie obsługuje żaden gotowy ERP:
hodowcy (mamy najlepszy moduł Pets na rynku), warsztaty i pracownie (moduł Warsztaty Pro),
gospodarstwa i szkółki roślin (moduł Rośliny z ewidencją zabiegów wymaganą prawem od 1.01.2026!),
mali usługodawcy (marketplace + CRM). **Wchodzimy tam, gdzie już mamy przewagę modułową,
a nie na czerwony ocean księgowości.** Konkretna mapa modułów pod te branże — rozdz. 5.

---

## 5. Mapa modułów branżowych — co dorabiamy, żeby przyciągnąć firmy

KSeF i faktury to fundament wspólny (rozdz. 11, P0) — ale firmy nie wybierają systemu dla
podatków, tylko dla obsługi **swojego procesu**: zlecenia, wizyty, mioty, partie roślin,
rezerwacje. Ten rozdział to lista modułów branżowych do dorobienia, w kolejności wynikającej
z trzech kryteriów:

1. **Przewaga już w kodzie** — moduł stoi w ≥70% na istniejących klockach (wzorzec „jedna encja,
   dwie skale"); dorabiamy warstwę firmową, nie budujemy od zera.
2. **Wielkość i osiągalność branży** — dużo mikrofirm (GUS: sam handel to 17,2% wszystkich firm;
   usługi osobiste, budownictwo i naprawy to setki tysięcy JDG), do których da się dotrzeć przez
   niszowe społeczności, bez budżetu korporacyjnego.
3. **Słaba konkurencja branżowa** — branża jest obsługiwana Excelem, zeszytem i Messengerem albo
   drogim oprogramowaniem pisanym pod duże firmy.

Każdy moduł **musi mieć wariant Dom** (hobbysta, za darmo lub 19 zł) — to jest nasz lejek
freemium i zarazem teza produktu. I każdy pierwszy klient branżowy to **wdrożenie custom**
(przychód ze strumienia A, rozdz. 4.1), którego kod następnie uogólniamy do modułu w abonamencie —
klienci finansują budowę produktu.

### Fala 1 (Faza 0 – Q1 2027) — stoi w ≥70% na istniejącym kodzie

**1. Hodowla Pro** *(na bazie: Pets — genetyka, mioty, sprzedaże już są)*
Dla hodowców psów, kotów, gadów, ptaków i zwierząt gospodarskich. Dorabiamy: umowy sprzedaży
i rezerwacje miotów z zaliczkami, kartotekę nabywców z historią kontaktu, dokumenty (metryki,
rodowody, CITES dla gatunków chronionych), publiczną wizytówkę hodowli z dostępnymi zwierzętami.
Dziś ta branża żyje w Excelu i na Facebooku — a moduł Pets już teraz jest głębszy niż cokolwiek
na polskim rynku.

**2. Serwis i naprawy** *(na bazie: Warsztaty Pro + Flota + Magazynowanie)*
Dla warsztatów samochodowych i rowerowych, serwisów AGD/RTV/elektroniki, pracowni naprawczych.
Dorabiamy: zlecenie naprawy ze statusami (przyjęte → diagnoza → wycena → akceptacja → gotowe),
kartotekę pojazdu/urządzenia klienta z pełną historią, kosztorys z częściami zdejmowanymi
z magazynu, powiadomienie klienta „gotowe do odbioru". Rejestr narzędzi, przeglądów i stanów
minimalnych już istnieje.

**3. Szkółka i uprawa** *(na bazie: Rośliny — tryby production/field, ewidencja zabiegów już są)*
Dla szkółek, gospodarstw ogrodniczych, plantacji i producentów rozsady. Przewaga regulacyjna już
w kodzie: ewidencja zabiegów ochrony roślin z polami wymaganymi prawem od 1.01.2026 + eksport CSV.
Dorabiamy: sprzedaż partii (z pola/tunelu do faktury), etykiety i paszporty roślin, plan produkcji
sezonu z kosztem na partię.

**4. Terminarz i gabinet** *(na bazie: Calendar + Contacts + wzorce z Health)*
Dla fryzjerów, kosmetyczek, fizjoterapeutów, masażystów, korepetytorów, psychologów — najliczniejsza
grupa mikrofirm usługowych. Dorabiamy: rezerwacje online (klient sam wybiera termin), kartotekę
klienta z historią wizyt i notatkami, przypomnienia o wizycie, pakiety i karnety. Silnik slotów już
istnieje w module Usługi (`ServiceAvailability`) — tu dostaje branżowy interfejs.

### Fala 2 (Q2–Q3 2027) — częściowo na istniejącym kodzie

**5. Gastro-zaplecze** *(na bazie: Kitchen + Magazynowanie z partiami FEFO)*
Dla małej gastronomii, cateringu, food trucków, cukierni. Dorabiamy: receptury z food-costem
(przepisy i wartości odżywcze już są), magazyn surowców z datami przydatności (FEFO już jest),
kalkulację ceny menu, zamówienia do dostawców (szkielet w Magazynowaniu Pro). Świadomie **nie**
budujemy kasy/POS — integrujemy się z istniejącymi.

**6. Wynajem i rezerwacje** *(nowy silnik, współdzielony z modułem 4)*
Dla wypożyczalni sprzętu, przyczep, kajaków, sal, pokoi gościnnych. Kalendarz dostępności zasobów,
umowy najmu i kaucje, protokół wydania/zwrotu ze zdjęciami, cenniki sezonowe i rabaty. Rezerwacja
to ta sama encja co wizyta w module 4 — jeden silnik, dwa interfejsy (zasada „jedna encja, dwie
skale" zastosowana do czasu).

**7. Ekipa i budowa** *(na bazie: Tasks + Magazynowanie + Portfel)*
Dla ekip remontowych, instalatorów, brukarzy, stolarzy na wymiar. Budowa = projekt z etapami
i rozliczeniami częściowymi, materiały zdejmowane z magazynu na konkretną budowę, dziennik budowy
ze zdjęciami dla klienta, odpowiedź na pytanie, którego Excel nie daje: „ile NAPRAWDĘ zarobiliśmy
na tej budowie".

**8. Zajęcia i klub** *(na bazie: Calendar + Contacts; Languages jako przewaga w szkołach językowych)*
Dla szkół językowych, trenerów personalnych, klubów sportowych, szkółek pływackich, ognisk
muzycznych. Grafik zajęć grupowych, lista obecności, karnety i płatności cykliczne, komunikacja
z grupą. Szkoła językowa dostaje bonus nie do skopiowania: uczniowie mogą dostawać talie SRS
z modułu Languages.

### Fala 3 (rok 2 / na zamówienie klienta) — budowane, gdy przyjdzie projekt

**9. Handel wielokanałowy** *(na bazie: Magazynowanie Pro — SKU/EAN, partie, dokumenty już są)*
Synchronizacja stanów z platformami sprzedaży (Allegro, integratorzy typu BaseLinker), obsługa
zamówień i wysyłek. Rynek ogromny (handel = 17,2% firm), ale konkurencja najmocniejsza — wchodzimy
wyłącznie jako płatne wdrożenie, gdy klient je przyniesie.

**10. HR-lite** *(na bazie: Teams/Workspace + Calendar)*
Urlopy, ewidencja czasu pracy, dokumenty pracownicze dla firm 5–20 osób. Budujemy dopiero, gdy plan
Firma będzie miał trakcję — wcześniej nie ma komu tego sprzedać.

### Jak czytać tę mapę

Fala 1 to jednocześnie **lista celów na wdrożenia referencyjne w Fazie 0** (rozdz. 9): pierwsze
2 wdrożenia po kosztach robimy w branżach 1–4, bo tam czas budowy jest najkrótszy, a przewaga
największa. Mapa nie jest zobowiązaniem sztywnym — jeśli klient z fali 2 przyjdzie z budżetem
w Q1, budujemy jego moduł (strumień A płaci za rozwój produktu); mapa mówi tylko, gdzie
AKTYWNIE szukamy klientów najpierw.

---

## 6. Marketing i sprzedaż

1. **KSeF jako haczyk SEO/content** — poradniki „KSeF dla hodowcy/warsztatu/szkółki" (koszt: czas
   AI ≈ 0 zł). Fala wyszukiwań trwa właśnie teraz.
2. **Niszowe społeczności zamiast szerokiej reklamy** — grupy hodowlane, fora warsztatowe,
   stowarzyszenia branżowe. Mikrobudżet 1–2 tys. zł/mies. na targetowane kampanie.
3. **Partnerstwa z biurami rachunkowymi** — one mają setki mikrofirm i dostają pytania „czym
   fakturować w KSeF"; prowizja 20% za polecenie wdrożenia.
4. **2 case studies zanim zaczniemy sprzedawać** — pierwsze 2 wdrożenia po kosztach (5–8 tys. zł)
   w zamian za referencję i zgodę na opis. Bez dowodu nikt nie kupi „ERP od jednoosobowej firmy".
5. **Demo publiczne** — piaskownica z danymi przykładowymi, bo produkt broni się pokazem, nie opisem.
6. Budżet marketingowy roku 1: **18–24 tys. zł** (mieści się we wkładzie własnym).

---

## 7. Model finansowy — trzy scenariusze

Założenia wspólne: JDG na ryczałcie 12% (usługi związane z oprogramowaniem, PKWiU ex 62.01.1);
ulga na start (6 mies. bez składek społecznych), potem ZUS preferencyjny (podstawa 1441,80 zł,
~456 zł/mies.) + zdrowotna (min. 432,54 zł/mies., na ryczałcie wg progów przychodu); koszty
infrastruktury 300–600 zł/mies. (Render paid + Neon + domeny + e-mail); LLM API 300–800 zł/mies.;
księgowość online ~150 zł/mies. Start komercyjny: **1.01.2027** (4 mies. na produktyzację,
rozdz. 9). Rok 1 = 2027.

### 7.1. Scenariusz PESYMISTYCZNY — „nie zadziałało"

6 wdrożeń × 15 tys. = 90 tys.; SaaS: 60 płacących na koniec roku ≈ 15 tys.; opieka ≈ 8 tys.
**Przychód ≈ 113 tys. zł** · koszty ≈ 45 tys. · ryczałt+ZUS ≈ 22 tys. → **zysk netto ≈ 45 tys. zł.**
Firma przeżywa (koszty stałe są niskie), wkład własny niezagrożony, ale cel odległy. Decyzja
w mies. 9: pivot oferty albo dołożenie kanału partnerskiego.

### 7.2. Scenariusz REALISTYCZNY — „solidny rok"

- Wdrożenia: 2+3+4+5 kwartalnie = **14 × śr. 18 tys. = 252 tys. zł**
- Opieka: narastająco do 10 umów × śr. 500 zł ≈ **25 tys. zł**
- SaaS: liniowy wzrost do 200 płacących (śr. cena 49 zł) ≈ **59 tys. zł**
- **Przychód ≈ 336 tys. zł**
- Koszty operacyjne ≈ 52 tys. (marketing 20, infra+LLM 12, ZUS+zdrowotna ≈ 11, księgowość 2,
  prawne/RODO 4, bufor 3)
- Ryczałt 12% ≈ 40 tys.
- **Zysk netto ≈ 230–245 tys. zł**

### 7.3. Scenariusz AMBITNY — „cel osiągnięty" (300 tys.+)

- Wdrożenia: 18 × śr. 20 tys. = **360 tys.** (śr. 1,5/mies., w II półroczu 2/mies.)
- Opieka: 14 umów, ≈ **35 tys.** · SaaS: 280 płacących, ≈ **80 tys.**
- **Przychód ≈ 475 tys. zł** · koszty ≈ 62 tys. · ryczałt ≈ 57 tys. · zdrowotna próg III
- **Zysk netto ≈ 330–345 tys. zł ✅**

**Co musi być prawdą, żeby zaszedł scenariusz ambitny** (to jest lista kontrolna, nie życzenie):
1. Pipeline AI realnie skraca wdrożenie do ≤ 15 dni roboczych (dziś: moduł Rośliny powstał w dni —
   dowód wewnętrzny istnieje).
2. Od Q2 stale ≥ 6 leadów/mies., z konwersją ≥ 25% — wymaga działających partnerstw z rozdz. 6.
3. Szymon poświęca na firmę ≥ 30 h/tyg. (sprzedaż i spotkania są wąskim gardłem, nie kod).
4. Braki z rozdz. 11 (P0) zamknięte przed 1.01.2027.

### 7.4. Wykorzystanie wkładu 20–40 tys. zł

| Pozycja | Kwota |
|---------|-------|
| Marketing + materiały + demo | 18–24 tys. |
| Prawne: regulamin, RODO/DPA, wzory umów | 4–6 tys. |
| Infrastruktura na 12 mies. z zapasem | 6–8 tys. |
| Rezerwa | reszta |

**Dźwignia bez rozwodnienia:** dotacja z PUP na podjęcie działalności — do 6-krotności przeciętnego
wynagrodzenia, **57 377,28 zł (VI–VIII 2026)**. Warunek: status osoby bezrobotnej PRZED rejestracją
JDG i zgoda lokalnego PUP — **decyzja właściciela do podjęcia przed rejestracją firmy** (jeśli
Szymon ma etat, ścieżka odpada; wtedy alternatywnie programy PARP dla startupów).

---

## 8. Ryzyka (nazwane wprost)

| Ryzyko | Prawdopodob. | Mitygacja |
|--------|--------------|-----------|
| Bus factor = 1 człowiek (Szymon) | wysokie | opieka utrzymaniowa wyceniona z SLA „reakcja 48 h", nie „naprawa w 2 h"; dokumentacja wdrożeń w repo; ubezpieczenie OC |
| Sprzedaż nie rusza (brak leadów) | średnie | 2 case studies przed sprzedażą; partnerstwa; punkt decyzji w mies. 9 |
| Wzrost cen LLM API | średnie | limit `ai_monthly_budget_usd` już w platformie; ceny w abonamencie z buforem; modele tańsze do operacji `dispatch` |
| Konkurent kopiuje pomysł | niskie w rok 1 | przewaga = 20 istniejących modułów + tempo pipeline'u, nie sekret |
| Regulacje (KSeF 2.0, RODO) | średnie | KSeF to dla nas popyt, nie koszt; RODO zamykamy w P0 (rozdz. 11) |
| Utrata danych klienta | niskie/krytyczne skutki | Neon PITR + testowane odtworzenie backupu PRZED pierwszym klientem |
| Wypalenie founder'a | średnie | firma stoi na marży, nie na godzinach: pipeline AI robi robotę wytwórczą |

---

## 9. Harmonogram

**Faza 0 — produktyzacja (wrz–gru 2026, przed rejestracją przychodów):** zamknięcie braków P0
z rozdz. 11, 2 wdrożenia referencyjne po kosztach **w branżach fali 1 (rozdz. 5)**, strona +
cennik + demo, decyzja ws. dotacji PUP, rejestracja JDG (grudzień).

**Q1 2027:** start sprzedaży; 2 płatne wdrożenia; SaaS otwarty publicznie; partnerstwo z 1 biurem
rachunkowym. **Q2:** 3 wdrożenia; 50+ płacących SaaS; content KSeF działa (mierzalny ruch organiczny).
**Q3:** 4 wdrożenia; przegląd w mies. 9 — jeśli < 60% planu przychodu, korekta strategii wg 7.1.
**Q4:** 5 wdrożeń; 200+ płacących; zamknięcie roku, decyzja o zatrudnieniu pierwszej osoby.

---

## 10. Dlaczego ten plan jest wiarygodny

- Wszystkie liczby rynkowe mają **źródła publiczne** (rozdz. 12), a prognozy są policzone jawnie
  (rozdz. 7) — każdy wiersz można zakwestionować i przeliczyć.
- Plan **nie zakłada** niczego, czego jeszcze nie zademonstrowaliśmy: pipeline AI już wytwarza
  moduły (Rośliny: model 12 tabel + UI + AI + ewidencja prawna w jednym przebiegu), platforma już
  ma multi-tenancy (workspace'y), RBAC, budżety AI, obserwowalność i 30+ bramek jakości w buildzie.
  Mapa branżowa (rozdz. 5) trzyma się tej samej zasady: fala 1 to wyłącznie moduły stojące
  w ≥70% na istniejącym kodzie.
- Scenariusz realistyczny **świadomie nie dowozi celu** (230–245 tys. vs 300 tys.) — zamiast
  naginać arkusz, nazywamy 4 warunki scenariusza ambitnego (7.3) i po nich mierzymy postęp.

---

## 11. CZEGO BRAKUJE W OMNI przed prawdziwą produkcją

To jest lista blokad między „działa dla Szymona" a „bierze pieniądze od obcych ludzi".
Priorytety: **P0 = blokuje pierwszą złotówkę · P1 = blokuje skalę · P2 = ważne, nie blokuje.**

### P0 — bez tego nie wolno wystartować

1. **Płatności i billing** — nie istnieją. Potrzebne: subskrypcje (Stripe lub Przelewy24/PayU),
   plany z rozdz. 4, egzekwowanie limitów planu (zalążek jest: `plan.aiMonthlyTokens`), faktury za
   abonament, windykacja nieopłaconych kont.
2. **Moduł Faktury sprzedażowe + KSeF** — nie istnieje (Portfel to finanse osobiste, nie
   fakturowanie). To jednocześnie pierwszy „profesjonalny" moduł ERP i warunek własnej sprzedaży
   (sami musimy fakturować w KSeF od 2027) — a moduły branżowe z rozdz. 5 kończą swój proces
   właśnie fakturą.
3. **Rejestracja/logowanie poza Google OAuth** — dziś jedyna droga to konto Google; firma z własną
   domeną pocztową musi mieć e-mail+hasło (lub Microsoft SSO) i weryfikację adresu.
4. **Dokumenty prawne i RODO** — regulamin, polityka prywatności, umowa powierzenia (DPA) dla firm,
   rejestr czynności. *Częściowo jest:* eksport danych i usunięcie konta (`actions/privacy`) już
   działają — brakuje warstwy formalnej (do kupienia u prawnika, 4–6 tys. zł).
5. **Publiczna strona produktu** — landing, cennik, demo. Dziś aplikacja wymaga logowania od
   pierwszego ekranu; nie ma czego pokazać w linku.
6. **E-mail transakcyjny** — potwierdzenia, faktury, alerty limitów (dziś powiadomienia żyją tylko
   w dzwonku w aplikacji; zaproszenia do zespołu wymagają, by adresat już miał konto).
7. **Przetestowane odtworzenie backupu** — Neon PITR istnieje, ale procedura przywrócenia musi być
   wykonana próbnie i opisana w runbooku ZANIM będzie klient (runbook deploy/rollback już jest:
   `docs/devops/runbook-deploy-rollback.md` — brakuje ćwiczenia DR).

### P1 — blokuje skalę / sprzedaż B2B

8. **2FA** i polityka haseł dla planu Firma (RBAC i audyt log już są — przewaga).
9. **Zewnętrzny przegląd bezpieczeństwa** (min. pentest podstawowy) — pierwszy klient B2B o to
   zapyta; wewnętrzne bramki (`check:route-gating`, `check:ai-access`, szyfrowanie kluczy) są
   dobrym punktem wyjścia, nie certyfikatem.
10. **Alerting** — obserwowalność (logi, metryki `OperationMetric`) jest, ale nikt nie zostanie
    obudzony, gdy produkcja padnie; potrzebny monitoring zewnętrzny + kanał alarmowy + status page.
11. **Onboarding nowego użytkownika** — dziś nowe konto ląduje w pustym systemie 20 modułów;
    potrzebny kreator startowy i dane przykładowe per plan.
12. **Kanał wsparcia klienta** — wewnętrzna skrzynka zgłoszeń (`feedback`) jest; potrzebny
    publiczny helpdesk/e-mail z SLA zapisanym w regulaminie.
13. **Testy obciążeniowe** — budżet wydajności (`check:perf`) pilnuje bajtów JS, ale nikt nie
    sprawdził zachowania przy 500 równoczesnych workspace'ach; wąskie gardła: joby w procesie
    web (rozdzielenie ról `OMNIA_ROLE` już przygotowane — trzeba je włączyć na osobnych usługach).

### P2 — ważne, nie blokuje startu

14. **Dokończenie i18n** (~820 fragmentów `t.rich`) — dziś UI jest po polsku; dla rynku PL
    wystarcza, wersja EN to opcja na rok 2.
15. **Aplikacje sklepowe** — PWA działa i wystarcza; sklepy (App Store/Play) to rok 2.
16. **Automatyczne seedy demo** dla piaskownicy sprzedażowej.
17. **Panel zarządzania kontami klientów** dla nas (dziś admin widzi wszystko, ale operacje
    „zawieś konto za brak płatności" wymagają billingu z P0.1).

**Szacunek zamknięcia P0:** 6–9 tygodni pracy pipeline'em (moduł Faktury+KSeF jest największy —
~3 tygodnie; billing ~2; auth+e-mail ~1; prawne równolegle u prawnika; strona+demo ~1).
Mieści się w Fazie 0 (wrz–gru 2026) z zapasem na 2 wdrożenia referencyjne.

---

## 12. Źródła

**Dane rządowe i urzędowe:**
- GUS — [Przedsiębiorstwa aktywne w 3 kw. 2025](https://stat.gov.pl/obszary-tematyczne/podmioty-gospodarcze-wyniki-finansowe/przedsiebiorstwa-niefinansowe/przedsiebiorstwa-aktywne-w-3-kwartale-2025-r-,42,4.html) (2 875 994 firm; 95,9% mikro; handel 17,2% ogółu) i [1 kw. 2025](https://stat.gov.pl/obszary-tematyczne/podmioty-gospodarcze-wyniki-finansowe/przedsiebiorstwa-niefinansowe/przedsiebiorstwa-aktywne-w-1-kwartale-2025-r-,42,2.html)
- Ministerstwo Finansów — [terminy obowiązkowego KSeF](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/podstawy-prawne-oraz-kluczowe-terminy/) i [zakres obowiązku](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/zakres-obowiazkowego-ksef/) (ksef.podatki.gov.pl)
- PARP — [Raport o stanie sektora MŚP w Polsce 2025](https://www.parp.gov.pl/component/publications/publication/raport-o-stanie-sektora-malych-i-srednich-przedsiebiorstw-w-polsce-2025) oraz [analiza cyfryzacji polskich firm](https://www.parp.gov.pl/component/content/article/90199:cyfryzacja-polskich-firm-widoczny-postep-ale-wiele-obszarow-wciaz-wymaga-poprawy)

**Rynek i giełda:**
- CRN — [Polski rynek ERP wart 1,6 mld zł](https://crn.pl/aktualnosci/polski-rynek-erp-jest-warty-16-miliarda-zlotych/) (IDC) i [odsetek firm z ERP: 40,5%](https://crn.pl/aktualnosci/wiecej-polskich-firm-ma-erp-spadl-udzial-crm-system-erp/)
- Comarch — [segment ERP 458,5 mln zł, ranking ITwiz Best100](https://www.comarch.pl/erp/aktualnosci/comarch-z-najwieksza-sprzedaza-systemow-erp-w-polsce-wyniki-rankingu-itwiz-best100/), [~25% rynku wg IDC](https://www.comarch.pl/erp/aktualnosci/comarch-ma-juz-niemal-25-rynku-erp-w-polsce-wyniki-raportu-idc/)
- StockWatch — [dane finansowe Comarch SA](https://www.stockwatch.pl/gpw/comarch,notowania,dane-finansowe.aspx); Bankier — [wyniki finansowe](https://www.bankier.pl/gielda/notowania/akcje/COMARCH/wyniki-finansowe) (przychody 1,61 mld zł, zysk netto 120,5 mln zł w 2025; delisting 26.03.2025)

**Cenniki konkurencji:**
- [Comarch ERP XT — cennik](https://erpxt.com.pl/cennik-comarch-erp-xt/) · [Comarch Optima — cennik](https://kluczesoft.pl/wiedza/aplikacje/cennik-comarch-optima) · [ifirma — cennik 2026](https://ksef-dla.pl/program/ifirma-cennik-2026/) · [wFirma — cennik 2026](https://ksef-dla.pl/program/wfirma-cennik-2026/) · [porównanie cen programów do KSeF](https://www.vatax.pl/blog/obsluga-ksef-porownanie-cen)

**Podatki, ZUS, finansowanie:**
- [Składki ZUS przedsiębiorców 2026](https://ksiegowosc.infor.pl/zus-kadry/skladki/7500894,skladki-zus-przedsiebiorcow-w-2026-r-zwykle-preferencyjne-maly-zus-plus-kwoty-i-minimalne-podstawy-wymiaru.html) (pełny ~1 926,76 zł + zdrowotna min. 432,54 zł; preferencyjny ~456 zł)
- [Ryczałt dla usług związanych z oprogramowaniem: 12%](https://www.ifirma.pl/blog/jaki-ryczalt-dla-programisty-85-czy-12-stawka-ryczaltu-dla-informatykow/) (PKWiU ex 62.01.1)
- [Dotacja z PUP na podjęcie działalności — do 57 377,28 zł](https://atlasdotacji.pl/dotacje-z-urzedu-pracy) (6× przeciętnego wynagrodzenia; decyduje lokalny PUP)

**Benchmarki SaaS:**
- [Freemium conversion 2–5% dla SMB B2B](https://www.withdaydream.com/library/insights/freemium-conversion-rate) · [churn B2B SaaS ~4,9%/rok, SMB wyżej](https://www.venasolutions.com/blog/saas-churn-rate)

---

*Raport przygotowany przez Claude jako dokument zarządczy. Kwoty prognozowane (rozdz. 7) są
założeniami modelu, nie obietnicą; kwoty rynkowe i regulacyjne pochodzą ze źródeł z rozdz. 12
wg stanu na 29.08.2026. Następny krok: decyzja właściciela o Fazie 0 (rozdz. 9), wybór 2 branż
fali 1 na wdrożenia referencyjne (rozdz. 5) i ścieżka dotacji PUP (rozdz. 7.4).*
$biznesplan2$,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'omnia-biznesplan-rok-pierwszy';