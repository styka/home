-- 116 — RAPORT: BRAKUJĄCE MODUŁY OMNII („ERP ŻYCIA PRYWATNEGO").
--
-- Właściciel poprosił o głęboką analizę, jakich modułów jeszcze brakuje, by Omnia w pełni
-- zarządzała życiem użytkownika — z researchem internetowym (statystyki, głosy o potrzebach
-- automatyzacji, hobby Polaków ze skalą), personami i sytuacjami życiowymi oraz katalogiem
-- ~60 hobby z przemyśleniem zawartości modułu dla każdego. Raport kończy się listą
-- kandydatur K-MOD-01…11 i zleceń R-01…12 do decyzji właściciela.
--
-- Migracja NIE zmienia kształtu bazy: jeden `INSERT` z `ON CONFLICT DO NOTHING` (C-14).
-- Treść nie zawiera żadnego sekretu ani adresu bazy (C-41).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "storage", "authorId", "teamId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Brakujące moduły Omnia 116 — analiza „ERP życia prywatnego"',
  'omnia-brakujace-moduly-116',
  $moduly116$
# Brakujące moduły Omnia — głęboka analiza 116 („ERP życia prywatnego")

- **ID przebiegu:** 116-brakujace-moduly · **Data:** 2026-08-30 · **Autor:** Claude Code
- **Zlecenie właściciela:** przeanalizować, jakich modułów jeszcze brakuje, by Omnia w pełni
  zarządzała życiem użytkownika — z researchem internetowym (statystyki, głosy o tym, czego
  ludziom brakuje do zautomatyzowania części życia, pracy i hobby), z uwzględnieniem tego,
  że ludzie są różni, żyją różnie i bywają w różnych sytuacjach (dobrych i złych), oraz
  z możliwie pełną listą hobby uprawianych przez Polaków i przemyśleniem, co mogłoby być
  w module do każdego z nich.
- **Status:** dokument analityczno-decyzyjny. Niczego nie wdraża; kończy się listą kandydatur
  (`K-MOD-NN`) do decyzji właściciela — wzorem listy zleceń z analizy integracji 115.

---

## 1. Metoda i rama analizy

### 1.1 Skąd wzięły się kandydatury

Cztery niezależne źródła, skrzyżowane ze sobą:

1. **Mapa domen życia.** Rozpisaliśmy życie człowieka na ~18 domen (finanse, zdrowie, dom,
   rodzina, jedzenie, mobilność, praca, rozwój, rozrywka, relacje, sprawy urzędowe, kryzysy…)
   i nałożyliśmy na nią 25 istniejących modułów. Białe plamy z tej mapy to §4.
2. **Research internetowy.** Badania o „life admin" (ile czasu pochłania administracja życia),
   głosy użytkowników aplikacji typu „second brain" / „life OS" (czego szukają i czego im
   brakuje), badania o tym, co ludzie chcą delegować AI, oraz statystyki czasu wolnego
   i hobby Polaków (CBOS, GUS, Biblioteka Narodowa, związki hobbystyczne). To §3.
3. **Persony i sytuacje życiowe.** Ośmiu różnych użytkowników (od studenta po opiekuna
   seniora) i osiem sytuacji przełomowych (przeprowadzka, dziecko, żałoba, długi…), każda
   sprawdzona pytaniem „co Omnia ma dziś, a czego nie ma". To §5.
4. **Katalog hobby Polaków.** ~60 hobby w dziesięciu grupach, każde z przemyśleniem, co
   mogłoby być w jego module i czym jest pokryte dziś. To §6.

### 1.2 Kryteria oceny kandydata na moduł

Nie każda potrzeba zasługuje na moduł. Kandydatura jest mocna, gdy:

- **Potrzeba jest CYKLICZNA, nie jednorazowa.** Omnia żyje z cykli (harmonogramy, terminy,
  nawyki, agendy) — jednorazowy problem lepiej obsłuży szablon procesu niż moduł.
- **Domena niesie TWARDE dane lub reguły** (terminy ustawowe, rejestry, dawkowanie, wymiary
  ochronne ryb) — wtedy moduł daje coś, czego notatka nie da. To ta sama racja, dla której
  Rośliny 113 dostały ewidencję zabiegów zgodną z prawem od 2026 r.
- **Integruje się z istniejącymi hubami** (kalendarz, pulpit, Portfel, kosz, udostępnianie,
  asystent). Lekcja 115: jeden wkład do huba daje integrację z każdym czytelnikiem huba naraz,
  więc nowy moduł w Omnii jest tańszy niż samodzielna aplikacja o tym samym zakresie.
- **Nie buduje drugiego magazynu ani drugiej księgowości** (zasada z Roślin 113): jeśli
  potrzebę da się zaspokoić kontraktem do Magazynowania/Portfela/Zadań, to tak właśnie
  należy ją zaspokoić.
- **Wyspecjalizowana aplikacja nie jest nie do pobicia.** Nie konkurujemy z Duolingo w nauce
  hiszpańskiego ani ze Stravą w GPS — konkurujemy tym, że dane z modułu ŻYJĄ w reszcie
  systemu (wydatek hobby w Portfelu, termin w kalendarzu, sprzęt w Warsztatach).

### 1.3 Trzy mechanizmy zamiast sześćdziesięciu modułów

Najważniejszy wniosek architektoniczny całej analizy, wyprzedzając §6: **katalog hobby
Polaków ma ~60 pozycji i NIE znaczy to, że brakuje ~60 modułów.** Potrzeby hobbystów
rozkładają się na trzy mechanizmy:

1. **Istniejące moduły już niosą znaczną część hobby** — Kuchnia to gotowanie i pieczenie,
   Rośliny to ogród i działka, Warsztaty to majsterkowanie i całe rękodzieło, Zwierzęta to
   hodowla od chomika po terrarystykę, Języki to nauka, Wiadomości/YouTube to świadoma
   konsumpcja treści. Częsta „luka" okazuje się brakiem jednej zakładki, nie modułu.
2. **Jeden generyczny moduł „Pasje"** (kandydatura K-MOD-08) pokrywa wspólny szkielet
   większości pozostałych: dziennik sesji/wypraw, cele i postępy, sprzęt (kontraktem do
   Warsztatów), wydatki (kontraktem do Portfela), biblioteka wiedzy, terminy do kalendarza,
   systemowy katalog dyscyplin (wzorzec dwóch tabel z Wiadomości 082 / Roślin 113).
3. **Moduł dedykowany dopiero wtedy, gdy domena ma twarde reguły lub rejestry** — wędkarstwo
   (wymiary i okresy ochronne, rejestr połowu), pszczelarstwo (weterynaryjny numer pasieki,
   przeglądy uli), krótkofalarstwo (log łączności w ustalonym formacie), nurkowanie (logbook
   i uprawnienia). Wzorzec „jedna encja, dwie skale" (Dom/Pro) z Magazynowania stosuje się
   i tu: ta sama pasieka od dwóch uli po gospodarstwo pasieczne.

### 1.4 Czym ten dokument NIE jest

Nie jest specyfikacją żadnego modułu (to praca dla `/specify` po decyzji właściciela) ani
zobowiązaniem do terminów. Liczby z §3 pochodzą z badań o różnej metodologii — traktujemy
je jako rząd wielkości, nie jako precyzyjny pomiar.
---

## 2. Stan zastany — mapa pokrycia domen życia

### 2.1 Co Omnia już ma (25 modułów)

| Domena życia | Moduł(y) Omnii | Pokrycie |
|---|---|---|
| Finanse osobiste | Portfel (budżety, cele, raporty, waluty, auto-księgowanie) | **Mocne** |
| Jedzenie | Kuchnia (przepisy, plan posiłków, spiżarnia, wartości odżywcze) + Zakupy | **Mocne** |
| Zakupy i zaopatrzenie | Zakupy (listy, mapy sklepów, słowniki) + Magazynowanie (min-stany) | **Mocne** |
| Zadania i projekty | Zadania (statusy, grupy, kanban, timeline, cykliczność) | **Mocne** |
| Wiedza osobista | Notatki (wikilinki, wersje, załączniki, pełnotekstowe szukanie) | **Mocne** |
| Zdrowie | Zdrowie (wizyty, badania z trendami, leki i pielęgnacja) | **Mocne, z lukami** (§4.5) |
| Nawyki | Nawyki (heatmapa, serie, cele tygodniowe) | **Mocne** |
| Zwierzęta | Zwierzęta (opieka, hodowla, genetyka, weterynaria) | **Mocne** |
| Rośliny i ogród | Rośliny 113 (od parapetu po hektar, ewidencja zabiegów) | **Mocne** |
| Pojazdy | Flota (paliwo, serwis, dokumenty) + Truck (trasy ciężarowe) | **Mocne** |
| Informacje ze świata | Wiadomości (pula artykułów, tematy, timeline, czytanie) + Pogoda | **Mocne** |
| Konsumpcja wideo | YouTube (streszczenia, fiszki z filmów) | **Dobre** |
| Nauka języków | Języki (SRS, TTS, pisanie, serie) | **Mocne w swojej niszy** |
| Rzeczy i przedmioty | Magazynowanie (Dom/Pro: gdzie co jest, gwarancje, QR, partie) | **Mocne** |
| Warsztat i sprzęt | Warsztaty (Dom/Pro: rejestr sprzętu, przeglądy, projekty) | **Mocne** |
| Usługi zewnętrzne | Usługi (marketplace: zlecenia, wyceny, terminy, płatności) | **Dobre** |
| Relacje | Kontakty (CRM, tagi, urodziny) + Czat | **Podstawowe** (§4.9) |
| Czas i terminy | Kalendarz (agenda z 10+ modułów) + powiadomienia | **Mocne jako hub** |
| Współdzielenie | Workspace'y, zespoły, udostępnianie, kosz | **Mocne (platforma)** |
| Meta | Raporty, QA, admin, asystent AI czytający/piszący wszystko | **Mocne** |

### 2.2 Białe plamy z mapy domen

Domeny życia, w których Omnia nie ma dziś ŻADNEGO gospodarza:

| Domena | Co się w niej dzieje | Dzisiejsza proteza w Omnii |
|---|---|---|
| **Dokumenty i terminy urzędowe** | dowód, paszport, polisy, umowy, PIT, terminy ważności | załączniki porozrzucane po modułach (Flota, Zdrowie, Magazynowanie) |
| **Dom jako nieruchomość** | przeglądy kominiarskie/gazowe, liczniki, remonty, kredyt, media | brak; Warsztaty trzymają narzędzia, nie dom |
| **Umowy cykliczne i subskrypcje** | abonamenty, terminy wypowiedzeń, podwyżki cen | wpisy ręczne w Portfelu, bez terminów wypowiedzeń |
| **Podróże** | planowanie, rezerwacje, pakowanie, budżet wyjazdu, dokumenty | notatka + zadania, wszystko ręcznie |
| **Sport i trening własny** | treningi, plany, pomiary ciała, starty | Nawyki liczą „czy", nie „co i ile"; Zdrowie nie ma pomiarów ciała |
| **Media i kultura** | książki, filmy, seriale, gry, podcasty: kolejka, oceny, cytaty | notatki; Wiadomości/YouTube obsługują inny rodzaj konsumpcji |
| **Rodzina jako system** | dzieci (szkoła, zajęcia, kieszonkowe), opieka nad seniorem | kalendarz + zadania, bez gospodarza |
| **Cele długoterminowe** | cele roczne, przegląd tygodniowy, kierunek życia | Nawyki i Zadania działają na dole, nikt nie spina góry |
| **Dziennik i samopoczucie** | nastrój, sen, wdzięczność, refleksja | Notatki bez struktury i bez trendów |
| **Procesy życiowe** | przeprowadzka, ślub, dziecko, spadek, emigracja | brak; człowiek w kryzysie dostaje pustą listę zadań |
| **Hobby bez gospodarza** | wędkarstwo, kolekcje, fotografia, muzykowanie… | §6 — częściowo Warsztaty/Notatki |

Te białe plamy — po skonfrontowaniu z danymi §3 — stają się kandydaturami §4.
---

## 3. Co mówią dane — research (2026-08-30)

Zebrane z badań publicznych i branżowych; przy każdej liczbie źródło i rok. Liczby z ankiet
komercyjnych (OnePoll itp.) traktować jako sygnał skali, nie pomiar naukowy.

### 3.1 „Life admin" — administracja życia to realny, zmierzony ciężar

- Dorosły spędza **ok. 8 h 48 min tygodniowo** na administracji życia prywatnego, plus
  **3 h 5 min tygodniowo samego MYŚLENIA o zaległościach**; średnio **204 zadania
  administracyjne miesięcznie**; 36% czuje się przytłoczonych, 49% „nie nadąża"
  (Brightpearl/OnePoll, UK, 2 000 dorosłych). Nowsze badanie akademickie mierzy
  **~7,2 h miesięcznie** samej „administrative household labor" (MDPI Social Sciences 2024) —
  rozbieżność metodologiczna, ale rząd wielkości ten sam: to godziny co tydzień.
- **Mental load**: kobiety wykonują 65–75% nieodpłatnej pracy domowej, a samo
  planowanie/pamiętanie/pilnowanie potrafi przekraczać 90% po jednej stronie związku
  (opracowania psychologiczne 2023–2025). W planowaniu posiłków 82% rodzin ma jednego
  „default dining manager", a rodzice spędzają ~37 min DZIENNIE na wymyślaniu obiadu
  i listy zakupów (OnePoll 2025–2026) — dokładnie to, co Kuchnia+Zakupy już zdejmują.
- **Dokumenty**: tylko **7% dorosłych** ma wszystkie ważne dokumenty w jednym miejscu,
  a **1/3 przegapiła kiedyś termin** odnowienia/wygaśnięcia (ankieta UK za SafeKeep 2025);
  **>75% właścicieli domów** nie ma inwentarza majątku do celów ubezpieczeniowych
  (NAIC 2024). To wprost uzasadnia K-MOD-01 (i potwierdza wartość Magazynowania).
- **Admin zdrowotny**: 73% dorosłych wykonuje zadania administracyjne wokół zdrowia,
  a **24,4% opóźniło lub porzuciło leczenie z ich powodu**; najbardziej obciążone są osoby
  z niepełnosprawnościami i kobiety (Kyle & Frakt, Health Services Research 2021). Pacjent
  z cukrzycą t. 2 przy pełnym stosowaniu zaleceń potrzebuje **>2 h dziennie** (Tran i in. 2015).
- **Polska**: twardych badań „ile Polacy tracą na life admin" brak; pośrednio — 26% wskazuje
  biurokrację jako główny problem urzędów (CBOS 2017/2022).

### 3.2 Głosy użytkowników „life OS" — czego chcą i dlaczego porzucają

- Szablony „Notion Life OS / second brain" pokrywają: zadania, cele, nawyki, finanse
  (z subskrypcjami), posiłki, fitness, sen, nastrój, dziennik, podróże, obowiązki domowe,
  kontakty, bibliotekę (przegląd 24 najpopularniejszych szablonów, Gridfiti 2025) —
  **niemal 1:1 lista modułów Omnii plus dokładnie luki z §2.2** (sen/nastrój, podróże,
  biblioteka, cele, subskrypcje).
- **Dlaczego ludzie PORZUCAJĄ takie systemy** (analizy 2024–2026): „maintenance tax"
  (utrzymanie systemu kosztuje więcej, niż daje), pseudo-produktywność (dopieszczanie
  dashboardu zamiast życia), stroma krzywa wejścia, i to, że system robi z człowieka
  „bazodanowca własnego życia". W personal CRM-ach zabójcą kategorii jest **ręczne
  wprowadzanie danych** — recenzje Moniki wprost: „wymóg ręcznego wpisywania złamie
  użytkownika".
- **App fatigue jest zmierzone**: 64% ludzi ma 10–50 aplikacji, ale 46% używa dziennie
  tylko 5–10; 45% instaluje appkę wyłącznie z konieczności (Clutch 2024–2026). Każda nisza
  życia ma osobny, rosnący rynek appek — i nikt nie łączy danych między nimi. **To jest
  dokładnie luka, w którą celuje Omnia.**

**Wniosek projektowy nr 1 (obowiązuje każdą kandydaturę z §4):** nowy moduł ma prawo
istnieć tylko wtedy, gdy dane powstają w nim jako **produkt uboczny działania** (skan,
zdjęcie, akcja w innym module, wpis AI z jednego zdania) — nigdy jako obowiązek
formularzowy. Moduł, którego trzeba „doglądać", zostanie porzucony w dwa tygodnie —
to nie opinia, to najczęstszy wzorzec w zebranych głosach.

### 3.3 Sygnał popytu per kategoria (rynki appek niszowych)

| Kategoria | Sygnał | Źródło (rok) |
|---|---|---|
| Budżet domowy | rynek ~32 mld USD, CAGR ~18–21% | Research Nester 2025 |
| Subskrypcje | zapomniane subskrypcje ≈ 204 USD/os./rok; 42% zapomniało o jakiejś; PL: 62% ma subskrypcję, 38% płaciło za nieużywaną | CNET 2025; C+R 2024; Santander/ING 2023-24 |
| Nawyki | rynek 1,9–13 mld USD (rozbieżne raporty) | Straits 2025 |
| Medytacja/sen | 2,25 + 3,06 mld USD; Calm >150 mln pobrań | Straits 2025 |
| Książki | Goodreads >150 mln; StoryGraph 5 mln (2026) | Reedsy 2026 |
| Garderoba | Whering ~10 mln użytk. | The Modems 2025 |
| Wędkarstwo | Fishbrain 15–20 mln wędkarzy | Wikipedia 2024 |
| Rośliny | PictureThis: dziesiątki mln pobrań | App Store 2025 |
| Remont/dom | Houzz 65 mln użytk. | Wikipedia 2022 |
| Ślub | rynek ~0,9 mld USD, CAGR 15,5% | MRW 2025 |
| Ciąża/dziecko | 217 mln → 875 mln USD (2022→2030) | Grand View 2023 |
| Opieka nad seniorem | 2,9–5,2 mld USD, CAGR 15–16,5% | MRFR 2025 |
| Auto | 91,8% kierowców odkłada serwis; koszt zaniedbań +1200 USD/rok | AutoInc/AAA 2023 |
| Nauka języków | Duolingo 135 mln MAU | Statista 2025 |

### 3.4 Co ludzie chcą delegować AI (2024–2026)

- 61% Amerykanów używa AI, ~1 na 5 codziennie; **rodzice są power userami** (Menlo Ventures 2025).
- Najchętniej delegowane: **listy zadań i kalendarz (64%)**, umawianie/maile (52%),
  **umawianie wizyt (60% komfortu)** — ale tylko 19% ufa AI w transakcjach bankowych
  (Zendesk 2025–2026). Wzorzec zaufania: **AI proponuje i przygotowuje, człowiek
  zatwierdza** — czyli dokładnie model `ActionDrawer`/auto-approve, który Omnia już ma.
- Użycie AI do finansów osobistych skoczyło z 10% do 55% r/r (MX 2026).
- **Telefonofobia jako motor delegacji**: 61–81% millenialsów unika telefonowania,
  a 29% przez to opóźniło lub przegapiło ważną wizytę (BankMyCell 2024–2026) —
  „AI umów mnie do lekarza/kominiarza" ma zmierzony popyt (haczyk pod Usługi).
- Kulturowy kierunek: „I want AI to do my laundry and dishes, not my art and writing"
  (viral 2024) — ludzie chcą delegować OBOWIĄZKI, nie ekspresję. Moduły hobby mają
  wspierać pasję (logistyka, pamięć, terminy), nigdy jej nie wyręczać.

### 3.5 Czas wolny i hobby Polaków — liczby

- **87% pracujących Polaków deklaruje hobby** (Pracuj.pl). Ranking: czytanie 41%,
  podróże 33%, sport 31%, gotowanie 23%, działka 18%, gry komputerowe 15%,
  majsterkowanie 14%, kibicowanie 14%, muzyka 13%, moda 8%, wędkarstwo 7%,
  kolekcjonerstwo 5%.
- CBOS (2026): czas wolny to śr. 2–3 h dziennie; najczęstsze zajęcia: czytanie 27%,
  TV 18%, sport 18%, spacery 16%, ogród/działka 13%, internet 10%.
- **Czytelnictwo**: 41% Polaków 15+ czyta ≥1 książkę rocznie (BN 2024 i 2025).
- **Sport**: 43,7% uczestniczy w sporcie/rekreacji; **rower nr 1 nieprzerwanie od 2008 r.**,
  pływanie nr 2; śr. wydatki gospodarstwa na sport 1873 zł/rok (GUS X 2024–IX 2025).
  Fitness: ~2500 klubów, ~1,5 mln ćwiczących, >2,3 mln kart MultiSport (2024).
  Biegi masowe: sam Maraton Warszawski z imprezami — ~68 tys. startów (2024).
- **Skala zorganizowanych hobby** (członkostwa, 2024): działkowcy PZD — **900 156 działek**
  w 4 575 ROD; wędkarze PZW — **~544 tys.**; myśliwi PZŁ — **~131–133 tys.**;
  pszczelarze — **~99 tys.** (2,42 mln rodzin pszczelich); chóry i orkiestry PZChiO —
  8,3 tys.; kynologia ZKwP — ~40 tys. (dane starsze). Grzybobranie: **>70% Polaków zbiera
  grzyby, >20% regularnie** (SW Research 2024) — ~100 tys. ton rocznie.
- **Cyfrowe**: gaming — **15,9 mln graczy = 50% populacji 6–75 lat** (Ipsos GameTrack 2025),
  rynek ~4,3–5 mld zł; YouTube — **29 mln użytkowników w PL** (DataReportal 2025);
  podcasty — ~12 mln słuchaczy, 8,8 mln co tydzień (2025); planszówki — rynek ~550 mln zł,
  ~5 mln pudełek rocznie (2025).
- **Turystyka**: 52,9 mln podróży krajowych, wydatki 108,2 mld zł (GUS 2024).
- **Zwierzęta**: pies w 49% gospodarstw (8,1 mln psów), kot w 41% (7,2 mln) — 2. miejsce
  w UE (FEDIAF 2024).
- **Luki w danych** (uczciwie): brak aktualnych liczb członków PZHGP (gołębie), PZF
  (filatelistyka), PZK (krótkofalarstwo), PZSzach, PZŻ; brak badań ilościowych dla
  rękodzieła, modelarstwa, numizmatyki, akwarystyki, motoryzacji klasycznej — skalę tych
  hobby sygnalizujemy jakościowo.

### 3.6 Sytuacje życiowe — popyt skokowy

- **Przeprowadzka**: 45–64% uznaje ją za najbardziej stresujące wydarzenie życia
  (OnePoll 2020).
- **Żałoba („sadmin")**: rodzina wykonuje **>30 zadań administracyjnych**, >25% kontaktuje
  się z **7+ instytucjami**; 80% mówi, że te obowiązki pogorszyły ich zdolność do pracy
  (UK Death Admin Report 2024–2025).
- **Opieka nad bliskim**: 1 na 4 dorosłych Amerykanów opiekuje się kimś, średnio
  **27 h/tydzień** (AARP/NAC 2025).
- **Emigracja**: 77% rozważających wyjazd chce usługi prowadzącej za rękę przez formalności
  (Harris Poll 2025).
- **Rozwód**: 54% rozwiedzionych ma po nim istotnie więcej obowiązków
  finansowo-administracyjnych (Allianz 2025–2026).

**Wniosek projektowy nr 2:** największa niedoobsłużona przestrzeń to nie kolejne hobby,
lecz **sytuacje przełomowe** — tam ciężar administracyjny jest skokowy, gotowych narzędzi
nie ma, a człowiek ma najmniej sił. Stąd wysoka pozycja K-MOD-11 (Procesy życiowe).
---

## 4. Kandydatury na moduły — analiza szczegółowa

Każda kandydatura: co robi, jakie ma MVP, z czym się integruje, na jakim wzorcu z repo
stoi i skąd wiemy, że jest popyt. Kolejność wewnątrz warstw — od najmocniejszych.

### Warstwa I — fundament „ERP życia" (bez tego framing nie jest prawdziwy)

#### K-MOD-01 · Dokumenty i terminy (archiwum domowe)

**Największa pojedyncza luka w Omnii.** ERP firmy zaczyna się od dokumentów; ERP życia też.
Każdy dorosły człowiek utrzymuje kilkadziesiąt–kilkaset dokumentów o twardych terminach:
dowód, paszport, polisy (OC, mieszkanie, życie), umowy (praca, najem, media, telekom),
gwarancje, akty, dyplomy, recepty, PIT-y.

- **Co robi:** repozytorium dokumentów (skan/zdjęcie → OCR → metadane: rodzaj, strony umowy,
  daty OD–DO, termin wypowiedzenia, kwota) + **rejestr terminów życiowych** (ważność
  dokumentu, termin wypowiedzenia, termin płatności) zasilający kalendarz i powiadomienia
  z wyprzedzeniem zależnym od rodzaju (paszport: 6 mies.; polisa: 1 mies.).
- **MVP:** model `Dokument` (rodzaj String+unia, daty, kwota, plik w Google Drive per-user —
  ta integracja JUŻ istnieje), OCR przez istniejący `vision` (wzorzec: dokumenty PZ/WZ
  w Magazynowaniu już to robią), wkład do kalendarza, przypomnienia.
- **Integracje:** Google Drive (jest), kalendarz (jest), Portfel (kwota polisy → budżet),
  Flota/Zdrowie/Magazynowanie mogą wystawiać swoje załączniki temu modułowi kontraktem —
  jedna wyszukiwarka „gdzie jest ta umowa?" zamiast czterech.
- **Wzorzec:** OCR dokumentów z Magazynowania Pro; katalog RODZAJÓW dokumentów jako słownik
  systemowy (admin dodaje „paszport" z regułą wyprzedzenia raz, dla wszystkich).
- **Popyt:** badania o „life admin" (§3.1) pokazują, że papierologia i pilnowanie terminów
  to najczęściej wymieniana uciążliwość administracji życia; wyszukiwania typu „document
  expiry reminder app" mają stały popyt bez dominującego gracza (§3.2).

#### K-MOD-02 · Dom i nieruchomość

Dom to największy „obiekt serwisowany" w życiu użytkownika — a Omnia serwisuje dziś auto
(Flota), sprzęt (Warsztaty), zwierzęta i rośliny, tylko nie dom.

- **Co robi:** karta nieruchomości (własność/najem, powierzchnia, instalacje), **przeglądy
  obowiązkowe** (kominiarski — co rok, gazowy — co rok, elektryczny — co 5 lat, budowlany —
  co 5 lat: twarde terminy z Prawa budowlanego, czyli dokładnie ten rodzaj reguł, który
  uzasadnia moduł), odczyty liczników (prąd/gaz/woda + wykres zużycia i kosztów), remonty
  i naprawy (projekt → wykonawca → koszt), wyposażenie kontraktem do Magazynowania,
  kredyt/czynsz jako pozycje cykliczne do Portfela.
- **MVP:** `Nieruchomosc` + `PrzegladDomu` (harmonogram cykliczny — `lib/recurrence.ts` już
  jest) + `OdczytLicznika`; wkład do kalendarza; „Zaksięguj" do Portfela (wzorzec 115).
- **Integracje:** Usługi (znajdź kominiarza z marketplace'u!), Warsztaty (naprawa własna vs
  zlecona), Magazynowanie (wyposażenie), Portfel, kalendarz, Kontakty (zarządca, sąsiedzi).
- **Wzorzec:** Flota — to jest „Flota dla domu": pojazd→nieruchomość, tankowanie→licznik,
  serwis→przegląd. Dom/Pro naturalne (jedno mieszkanie vs wynajmujący z 5 lokalami).
- **Popyt:** aplikacje „home maintenance" to rosnąca kategoria (§3.3); w Polsce dodatkowy
  haczyk: obowiązkowe przeglądy, o których większość właścicieli pamięta dopiero przy
  szkodzie ubezpieczeniowej.

#### K-MOD-03 · Subskrypcje i umowy cykliczne

Może być modułem albo rozszerzeniem Portfela — **decyzja właściciela**. Analiza wskazuje
rozszerzenie Portfela + rodzaj dokumentu w K-MOD-01 (unikamy trzeciego miejsca z kwotami).

- **Co robi:** rejestr zobowiązań cyklicznych (streaming, telefon, internet, siłownia,
  ubezpieczenia, domeny, chmury) z kwotą, cyklem, datą odnowienia i **terminem wypowiedzenia**;
  suma miesięczna „ile kosztuje moje życie w abonamentach"; przypomnienie PRZED odnowieniem
  (moment decyzji), nie po obciążeniu.
- **Popyt:** to jedna z najczęściej instalowanych kategorii appek finansowych (§3.3) —
  użytkownicy masowo odkrywają subskrypcje, o których zapomnieli; polski wątek: podwyżki
  cen operatorów wymagające reakcji w terminie.

#### K-MOD-04 · Podróże

- **Co robi:** wyjazd jako obiekt (cel, daty, uczestnicy z Kontaktów), plan dnia po dniu,
  rezerwacje (bilety/noclegi jako dokumenty z terminami — kontrakt do K-MOD-01), **listy
  pakowania z szablonów** (morze/góry/miasto/dziecko/pies — generowane z AI wg pogody
  w celu podróży: Pogoda już ma kontrakt prognozy!), budżet wyjazdu → Portfel (waluty JUŻ
  są), dziennik podróży (zdjęcia, miejsca) → wspomnienia.
- **Integracje:** Pogoda (prognoza w miejscu docelowym), Portfel (budżet + waluty), Zakupy
  (dokupić przed wyjazdem), Zwierzęta (kto zajmie się kotem — zadanie dla opiekuna),
  Kalendarz, Kontakty, Truck/Flota (trasa, koszt paliwa — wzorzec 115 już policzył koszt
  trasy z pojazdu).
- **Wzorzec:** szablony list = wzorzec katalogu systemowego; dziennik = wzorzec dziennika
  Roślin. **Popyt:** planowanie podróży to top-3 kategoria „chcę, żeby AI to za mnie
  ogarnęło" w badaniach konsumenckich (§3.4), a turystyka krajowa Polaków jest masowa (§3.5).

#### K-MOD-05 · Trening i ciało

- **Co robi:** dziennik treningów (siłownia: ćwiczenie/serie/ciężar z progresją; bieganie/
  rower: dystans/czas/tętno — wpis ręczny lub import GPX), plany treningowe (katalog
  systemowy planów + własne), **pomiary ciała** (waga, obwody, tkanka — trend jak badania
  w Zdrowiu), starty/zawody jako terminy, integracja z Nawykami („trening 3×/tydz." —
  nawyk odhacza się sam, gdy dziennik ma wpis).
- **Integracje:** Zdrowie (pomiary i kontuzje w jednej historii — lekarz pyta „od kiedy
  boli"), Nawyki, Kalendarz, Kuchnia (zapotrzebowanie kaloryczne ↔ wartości odżywcze
  przepisów JUŻ policzone — domknięcie pętli „trenuję→jem"), Portfel (karnet).
- **Wzorzec:** pomiary = `PetMeasurement`/`PlantMeasurement` (kind+unit+source — `source`
  to gotowy szew pod import z zegarka, dokładnie jak szew sensorów w Roślinach).
- **Popyt:** fitness to największa kategoria appek zdrowotnych (§3.3); w PL regularnie
  ćwiczy znaczący odsetek dorosłych (§3.5), a „heavy userzy" prowadzą dzienniki w Excelu —
  czyli czekają na strukturę.

### Warstwa II — pełnia życia (duży zasięg, mniejsza pilność)

#### K-MOD-06 · Biblioteka (książki, filmy, seriale, gry, podcasty)

- **Co robi:** jedna półka mediów: kolejka „chcę", stan „w trakcie" (strona/odcinek/godzina
  gry), „skończone" z oceną i notatką, cytaty/highlighty → Notatki, statystyki roczne
  („24 książki w 2026"), **katalog systemowy tytułów** przez otwarte API (Open Library —
  bez kosztów licencji), rekomendacje AI na bazie półki i `UserFact`.
- **Integracje:** Notatki (cytaty, recenzje), Wiadomości (news o premierze → kolejka),
  YouTube (obejrzany film o książce → kolejka), Zadania („oddać książkę do biblioteki"),
  Portfel (wydatki na kulturę), Kalendarz (premiery).
- **Wzorzec:** dwie tabele katalog+kopia (Wiadomości 082); SRS-owate powtórki cytatów to
  gotowy silnik z Języków. **Popyt:** Goodreads/StoryGraph/Letterboxd to miliony
  użytkowników bez jednej appki łączącej media (§3.2); czytelnictwo w PL mierzy corocznie
  Biblioteka Narodowa (§3.5).

#### K-MOD-07 · Rodzina (dzieci i bliscy zależni)

- **Co robi:** profil dziecka (rozwój: wzrost/waga na siatkach centylowych — pomiary jak
  wszędzie; szczepienia wg kalendarza obowiązkowego — TWARDE reguły; szkoła: plan lekcji,
  wywiadówki, wyprawka; zajęcia dodatkowe z logistyką „kto odwozi"; kieszonkowe → nauka
  finansów z Portfelem-junior), profil seniora (leki — silnik JUŻ jest w Zdrowiu, wizyty,
  sprawy urzędowe, dyżury opiekunów w rodzinie).
- **Integracje:** Zdrowie (członek rodziny jako pacjent), Kalendarz (logistyka rodzinna to
  główny use-case współdzielonego kalendarza), Zadania (dyżury), Kuchnia (preferencje
  dzieci), workspace zespołu = gospodarstwo domowe (platforma współdzielenia JUŻ to umie).
- **Uwaga architektoniczna:** to bardziej „warstwa person w istniejących modułach" niż
  silos — profil członka rodziny powinien być encją PLATFORMY (jak workspace), do której
  Zdrowie/Kalendarz/Portfel doczepiają swoje dane. Inaczej powstanie drugie Zdrowie.
- **Popyt:** opiekunowie („sandwich generation") to jedna z najbardziej niedoobsłużonych
  grup w badaniach life-admin (§3.1); logistyka rodzinna jest top-tematem głosów o „family
  organizer" (§3.2).

#### K-MOD-08 · Pasje (generyczny moduł hobby)

Silnik dla ~40 hobby z §6, które nie dostaną własnego modułu.

- **Co robi:** dyscyplina (z katalogu systemowego: ~60 wpisów z §6, z polami specyficznymi
  jako JSON-schema per dyscyplina), **dziennik sesji/wypraw** (data, miejsce, czas, wynik,
  zdjęcia, warunki — z automatycznym stemplem pogody z Pogody!), cele i kamienie milowe,
  sprzęt kontraktem do Warsztatów, wydatki kontraktem do Portfela, biblioteka wiedzy
  (linki/notatki), terminy (zloty, zawody, sezony) do kalendarza, statystyki roczne.
- **Wzorzec:** to jest uogólnienie tego, co Rośliny zrobiły dla ogrodnictwa: dziennik +
  harmonogram + ewidencja + katalog. JSON-owe pola per dyscyplina = wzorzec `Skin.tokens`
  (JSON bez zmiany schematu).
- **Popyt:** §6 w całości; sygnał zbiorczy: związki i stowarzyszenia hobbystyczne w PL
  liczą łącznie miliony członków (§3.5).

#### K-MOD-09 · Cele i przeglądy (kompas)

- **Co robi:** cele roczne/kwartalne z dekompozycją na projekty (Zadania) i nawyki (Nawyki),
  **przegląd tygodniowy** jako prowadzony rytuał (AI zbiera tydzień ze WSZYSTKICH modułów:
  zrobione zadania, serie nawyków, wydatki vs budżet, treningi — i zadaje pytania
  refleksyjne), postęp celów na pulpicie.
- **Uwaga:** mały model danych, wielka wartość z integracji — to moduł-czytelnik hubów.
  Asystent AI już czyta wszystkie moduły, więc MVP jest blisko.
- **Popyt:** „weekly review" to rdzeń GTD i najczęściej porzucany rytuał — użytkownicy
  wprost proszą o narzędzie, które samo przyniesie dane do przeglądu (§3.2).

#### K-MOD-10 · Dziennik i samopoczucie

- **Co robi:** wpis dzienny (nastrój 1–5 + tagi emocji + tekst; szablony: wdzięczność,
  „highlight dnia"), sen (godziny, jakość — ręcznie, szew pod import), energia; **korelacje**
  (nastrój × sen × trening × pogoda — wszystko już jest w systemie!); tryb prywatny
  (wpisy wyłączone z udostępniania i z kontekstu AI, chyba że użytkownik włączy).
- **Integracje:** Zdrowie (nastrój jako parametr dla lekarza), Nawyki (medytacja),
  Pogoda (korelacja z ciśnieniem/światłem), Kalendarz.
- **Popyt:** mood-trackery i dzienniki to stale rosnąca kategoria wellbeing (§3.3);
  głosy „chcę widzieć, OD CZEGO zależy moje samopoczucie" wymagają właśnie danych
  z wielu dziedzin naraz — czyli przewagi Omnii nie do skopiowania przez samodzielną appkę.

#### K-MOD-11 · Procesy życiowe (playbooki)

Odpowiedź na „ludzie bywają w różnych sytuacjach, dobrych i złych" — bez budowania modułu
per kryzys.

- **Co robi:** systemowa biblioteka SZABLONÓW procesów: przeprowadzka, ślub, narodziny
  dziecka, budowa/remont domu, **żałoba i spadek** (akt zgonu, ZUS, banki, notariusz —
  w kolejności i z terminami ustawowymi: 6 mies. na odrzucenie spadku!), rozwód, emigracja
  i powrót, pierwsza praca, przejście na emeryturę, wychodzenie z długów, długa choroba.
  Uruchomienie procesu = wygenerowanie projektu w Zadaniach z terminami względnymi +
  dokumentów-do-zdobycia (K-MOD-01) + kontaktów-do-założenia. Admin utrzymuje szablony
  jak katalog RSS (082).
- **Dlaczego to ważne:** w kryzysie człowiek nie ma siły projektować listy zadań — wartość
  systemu jest największa dokładnie wtedy, gdy użytkownik ma najmniej sił. To też jedyna
  pozycja tej listy, która obsługuje „złe sytuacje" wprost.
- **Popyt:** poradniki „checklist po śmierci bliskiego" / „moving checklist" należą do
  najczęściej wyszukiwanych treści poradnikowych (§3.1); żadna appka nie łączy checklisty
  z dokumentami i terminami — bo nie ma reszty systemu. Omnia ma.

### Warstwa III — rozszerzenia istniejących modułów (nie nowe moduły)

Zapisane tu, żeby lista była pełna — ale to zlecenia do modułów istniejących:

- **R-01 Zdrowie:** pomiary ciała + szczepienia dorosłych (tężec co 10 lat!) + historia
  rodzinna chorób. (Część K-MOD-05/07 może z tego skorzystać.)
- **R-02 Portfel:** subskrypcje (K-MOD-03 jako rozszerzenie), majątek netto (aktywa:
  nieruchomość z K-MOD-02, auto z Floty — wycena), import wyciągów CSV.
- **R-03 Kontakty:** pomysły na prezenty + historia prezentów (przed urodzinami z 114
  system podpowiada, co darować i czego nie powtórzyć); pola „ostatni kontakt / odezwij
  się" (CRM relacji, nie tylko rejestr).
- **R-04 Kuchnia:** dieta/alergie per domownik (czyta K-MOD-07), lista „czego nie jemy".
- **R-05 Języki → Nauka:** uogólnienie SRS na dowolne fiszki (egzaminy, prawo jazdy,
  anatomia) — silnik JUŻ jest, zmiana głównie słownikowa. Alternatywnie osobny moduł
  Edukacja z kursami/certyfikatami (terminy ważności certyfikatów → K-MOD-01).
- **R-06 Magazynowanie:** widok „Kolekcja" (seria/kompletność/wycena rynkowa) dla
  kolekcjonerów — patrz §6 grupa kolekcjonerska; alternatywą jest kolekcja jako typ
  dyscypliny w Pasjach.
- **R-07 Pogoda:** kalendarz ogrodnika/wędkarza (fazy księżyca JUŻ są liczone!) jako
  kontrakt dla Roślin i Pasji.

### Warstwa IV — świadomie NIE (patrz też §7)

Klient e-mail, komunikatory zewnętrzne, agregacja kont bankowych (regulacje PSD2 — wrócić,
gdy będzie licencjonowany partner), telemedycyna, randki, media społecznościowe, streaming
treści, nawigacja na żywo. Wspólny mianownik: albo regulacje, albo konkurencja nie do
pobicia w samym rdzeniu ich wartości, albo sprzeczność z „systemem dla władzy nad własnym
życiem" (uzależniające pętle).
---

## 5. Ludzie są różni — persony i sytuacje życiowe

Test każdej kandydatury: przepuścić przez nią ośmiu RÓŻNYCH ludzi. Ta sekcja pokazuje,
że warstwa I z §4 obsługuje wszystkich, a hobby (§6) różnicują dopiero „dach" systemu.

### 5.1 Persony

| Persona | Co Omnia już jej daje | Czego jej brakuje (→ kandydatura) |
|---|---|---|
| **Studentka, wynajmuje pokój** | zadania, notatki, budżet, języki, przepisy „tanio i szybko" | terminy umowy najmu i kaucja (K-01), sesja/egzaminy jako SRS (R-05), subskrypcje studenckie (K-03), podróże niskobudżetowe (K-04) |
| **Singiel w korpo, 29 l.** | zakupy, kuchnia, nawyki, wiadomości, YouTube, siłownia „że chodzi" (nawyk) | dziennik treningów z progresją (K-05), subskrypcje (K-03), biblioteka gier/seriali (K-06), cele roczne (K-09) |
| **Młodzi rodzice 2+1** | wspólny workspace, kalendarz, zakupy, kuchnia, Portfel | profil dziecka: szczepienia, centyle, żłobek, logistyka „kto odbiera" (K-07); mental load — patrz §5.3 |
| **Rodzina 2+2 z domem i psem** | wszystko wyżej + Zwierzęta, Flota, Magazynowanie, Warsztaty | dom jako obiekt: przeglądy, liczniki, remonty (K-02); dokumenty rodziny (K-01); wakacje (K-04) |
| **Opiekunka seniora („sandwich")** | leki i pielęgnacja (silnik JUŻ jest!), kalendarz, zadania, czat rodzinny | profil podopiecznego + dyżury rodziny (K-07), dokumenty i pełnomocnictwa (K-01), proces „opieka nad rodzicem" (K-11) |
| **Senior 68 l., działka ROD** | Rośliny (działka!), Zdrowie, przepisy, pogoda | duża czcionka to skin (JUŻ jest), procesy: emerytura, testament (K-11), proste wejście głosem (asystent JUŻ dyktuje) |
| **Przedsiębiorca jednoosobowy** | kierunek ERP-pro z biznesplanu: faktury/KSeF (osobny tor) | rozdział prywatne/firmowe per workspace (platforma to umie), subskrypcje narzędzi (K-03), certyfikaty i terminy (K-01) |
| **Osoba przewlekle chora** | wizyty, badania z trendami, leki | najbardziej obciążona administracyjnie grupa wg badań (§3.1): dokumenty medyczne i orzeczenia (K-01), dziennik objawów/samopoczucia (K-10), proces „orzeczenie o niepełnosprawności" (K-11) |

### 5.2 Sytuacje życiowe (dobre i złe) → proces zamiast modułu

Każda z tych sytuacji to skokowy popyt (§3.6) i żadna nie zasługuje na osobny moduł —
wszystkie obsłuży K-MOD-11 + istniejące huby:

- **Dobre:** ślub (checklista 12 mies. + budżet → Portfel + goście → Kontakty + usługodawcy
  → Usługi), narodziny dziecka (wyprawka → Zakupy, becikowe/urlopy → terminy, szczepienia
  → K-07), budowa/remont domu (etapy → Zadania, ekipa → Usługi, materiały → Magazynowanie),
  nowa praca, przeprowadzka do „swojego".
- **Złe:** żałoba i spadek (sekwencja: akt zgonu → ZUS → banki → notariusz; **termin
  ustawowy 6 mies. na odrzucenie spadku** — system MUSI go pilnować, bo człowiek w żałobie
  nie pilnuje niczego; >30 zadań, 7+ instytucji wg §3.6), rozwód (podział dokumentów
  i finansów — Portfel per workspace), utrata pracy (budżet awaryjny, terminy zasiłków),
  choroba (K-01 + K-10), długi (plan spłat → Portfel, metoda kuli śnieżnej).
- **Neutralne-przełomowe:** emigracja/powrót (dokumenty, urzędy dwóch krajów), przejście
  na emeryturę, dziecko wyprowadza się z domu, pierwszy własny pies (onboarding → Zwierzęta).

**Zasada trybu kryzysowego:** proces „żałoba" powinien móc przełączyć systemowi ton —
wyciszyć powiadomienia nieistotne, wstrzymać serie nawyków bez ich zrywania („zamrożenie"
zamiast zera), a asystent ma wiedzieć z kontekstu, że nie proponuje „może zaplanujmy
weekend?". To drobna, ale głęboko ludzka przewaga systemu, który widzi całość.

### 5.3 Mental load i współdzielenie

Badania (§3.1) mówią wprost: ciężar planowania spada w rodzinach na jedną osobę.
Omnia ma już platformę współdzielenia (workspace'y, udostępnianie 090/095, czat) — brakuje
**widoku podziału**: „kto trzyma który obszar" (dyżury, rotacja obowiązków, licznik
„kto ostatnio…"). To nie nowy moduł, lecz zlecenie do platformy współdzielenia + Zadań
(cykliczne zadania z rotacją wykonawcy). Zapisane jako R-08 w §8.

### 5.4 Poglądy, religia, styl życia

Różnice światopoglądowe NIE powinny materializować się jako osobne moduły, tylko jako
treści i wkłady do istniejących hubów: kalendarze religijne (święta, posty) jako wkład do
Kalendarza z katalogu systemowego; dieta (wegańska, koszerna, halal, bezglutenowa) jako
atrybuty w Kuchni (R-04); składki/darowizny jako kategorie Portfela; wolontariat jako
dyscyplina w Pasjach. Wiadomości już dziś pozwalają komponować własny zestaw źródeł —
to jest właściwy model: **system nie ma poglądów, ma słowniki**.
---

## 6. Katalog hobby Polaków — co mogłoby być w module każdego z nich

Legenda rekomendacji: **[jest]** = istniejący moduł pokrywa lub pokryje po drobnym
rozszerzeniu · **[Pasje]** = dyscyplina generycznego modułu Pasje (K-MOD-08) z polami
specyficznymi · **[dedykowany]** = domena ma twarde reguły/rejestry uzasadniające własny
moduł (teraz lub w przyszłości) · **[K-NN/R-NN]** = obsłużone inną kandydaturą.

Liczby przy hobby — z §3.5 (tam źródła). Tam, gdzie liczb brak, skala jest jakościowa.

### 6.1 Przyrodnicze i na powietrzu

- **Ogród / działka ROD** (13–18% deklaracji; 900 tys. działek PZD) — **[jest: Rośliny]**.
  Moduł 113 zbudowano dokładnie pod to (miejsca, płodozmian, ewidencja, zbiory→spiżarnia).
  Luka drobna: infrastruktura działki (altana, oczko, kompostownik — terminy i stan) →
  domknie K-MOD-02 (obiekt) + Warsztaty (sprzęt).
- **Wędkarstwo** (7% deklaracji; ~544 tys. w PZW; Fishbrain 15–20 mln na świecie) —
  **[dedykowany, najmocniejszy kandydat hobbystyczny]**. W module: dziennik połowów
  (gatunek/waga/długość/przynęta/miejsce/pogoda — stempel z Pogody automatycznie),
  **wymiary i okresy ochronne + limity dzienne** (twarde reguły! katalog systemowy per
  wody), rejestr połowu wymagany przez PZW, składki i zezwolenia z terminami (→ K-01),
  mapa łowisk, sprzęt → Warsztaty, fazy księżyca/ciśnienie → kontrakt Pogody (R-07).
- **Grzybobranie** (>70% Polaków!) — **[Pasje]** + atlas: dziennik zbiorów (miejsce —
  prywatność „moich miejscówek" ma tu wagę rytualną!), atlas grzybów jako katalog
  systemowy z rozpoznawaniem przez `vision` (wzorzec: identyfikacja roślin JUŻ działa,
  z `unknown` jako dozwoloną odpowiedzią — przy grzybach to kwestia bezpieczeństwa:
  **system nigdy nie orzeka jadalności, najwyżej „to wymaga eksperta"**), przetwory →
  spiżarnia Kuchni (kontrakt jak zbiory Roślin).
- **Myślistwo** (~131–133 tys. w PZŁ) — **[dedykowany w przyszłości, jeśli będzie popyt]**:
  książka polowań, okresy polowań (twarde reguły), ewidencja trofeów i amunicji,
  terminy badań i pozwoleń (→ K-01). Do czasu decyzji: [Pasje].
- **Pszczelarstwo** (~99 tys. pszczelarzy, 2,42 mln rodzin pszczelich) — **[dedykowany
  w przyszłości]** na wzorcu „jedna encja, dwie skale" (2 ule → gospodarstwo pasieczne):
  przeglądy uli (harmonogram + dziennik jak opieka w Roślinach), rejestr weterynaryjny
  pasieki, leczenie warrozy (terminy!), miodobranie → spiżarnia/sprzedaż → Portfel,
  pożytki ↔ kwitnienie → kontrakt Roślin i Pogody. Do tego czasu: [Pasje] lub
  kreatywnie Zwierzęta (hodowla).
- **Birdwatching** — **[Pasje]**: lista życiowa (life list) z katalogu systemowego gatunków,
  dziennik obserwacji z miejscem i porą, sezony przelotów → kalendarz.
- **Zbieractwo zielarskie** — **[Pasje]** + te same zasady bezpieczeństwa co grzyby;
  przetwory → Kuchnia.
- **Geocaching / questing** — **[Pasje]**: log znalezisk, statystyki, mapy.
- **Astronomia amatorska** — **[Pasje]**: dziennik obserwacji, katalog obiektów (Messier…),
  warunki (zachmurzenie/łuna → kontrakt Pogody; fazy księżyca JUŻ liczone), sprzęt →
  Warsztaty.
- **Survival/bushcraft, caravaning** — **[Pasje]** + listy pakowania z K-MOD-04 (Podróże);
  caravaning dodatkowo: pojazd JUŻ jest we Flocie.

### 6.2 Sportowe i ruchowe

Wspólny silnik dla całej grupy to K-MOD-05 (Trening i ciało); poniżej tylko specyfika.

- **Rower** (sport nr 1 w PL od 2008 r.) — [K-05] + serwis roweru → Warsztaty (przegląd
  jak `nextServiceAt` — JUŻ jest), trasy → dziennik z GPX.
- **Bieganie** (68 tys. startów w samych imprezach FMW 2024) — [K-05]: plany do zawodów,
  rekordy życiowe, starty → kalendarz.
- **Pływanie** (nr 2 w PL) — [K-05]: baseny/długości, technika.
- **Siłownia/fitness** (~1,5 mln ćwiczących; 2,3 mln kart MultiSport) — [K-05] w pełni:
  progresja ciężarów to najbardziej „excelowe" hobby Polaków.
- **Turystyka górska / trekking / nordic walking** (spacery 16% CBOS) — [K-05]+[K-04]:
  dziennik szlaków, książeczka GOT (odznaki — realny, papierowy rytuał!), plany wypraw.
- **Żeglarstwo / kajakarstwo / windsurfing** — **[Pasje]** z powagą dokumentową: patenty
  i uprawnienia z terminami (→ K-01), dziennik rejsów (jak logbook), czarter → K-04,
  wiatr/stan wody → kontrakt Pogody.
- **Wspinaczka** — [Pasje]: przejścia z wyceną trudności, projekty skalne, sprzęt
  z DATĄ WYCOFANIA (liny się starzeją — termin bezpieczeństwa → kalendarz!).
- **Jazda konna** — [Pasje] + koń jako zwierzę → Zwierzęta (JEST, z pełną opieką wet.).
- **Narty/snowboard** — [Pasje]+[K-04]: sezon, skipassy, serwis sprzętu → Warsztaty.
- **Sporty drużynowe amatorsko (piłka, siatkówka, koszykówka)** — [Pasje]: terminarz
  drużyny → kalendarz współdzielony (workspace zespołu — dosłownie), składki → Portfel.
- **Tenis/padel/squash/badminton** — [Pasje]: rezerwacje kortów, partnerzy → Kontakty.
- **Sporty walki / joga / taniec** — [K-05] (zajęcia cykliczne, stopnie/pasy jako kamienie
  milowe) + karnety → K-03.
- **Łyżwy/rolki/deskorolka** — [Pasje].
- **Strzelectwo sportowe** — [Pasje] z powagą dokumentową: pozwolenia i terminy (→ K-01),
  dziennik treningów strzeleckich, ewidencja amunicji.
- **Golf** — [Pasje]: handicap, rundy, pola.
- **Triathlon / biegi przeszkodowe** — [K-05]: trzy dyscypliny w jednym planie.
- **Kibicowanie** (14% deklaracji!) — **[jest, zaskakująco]**: Wiadomości (źródła sportowe
  + tematy monitorowane „mój klub") + Kalendarz (terminarz meczów jako subskrybowany
  kalendarz z katalogu) + YouTube (skróty). Ewentualna zakładka „mój klub" w Pasjach.

### 6.3 Kolekcjonerskie (kolekcjonerstwo ogółem: 5% deklaracji)

Cała grupa stoi na JEDNYM silniku: **widok kolekcjonerski w Magazynowaniu (R-06) albo
typ dyscypliny „kolekcja" w Pasjach** — inwentarz przedmiotów JUŻ istnieje (zdjęcia,
wartość, lokalizacja, QR); kolekcjonerowi brakuje trzech rzeczy: **pojęcia serii
i kompletności** („mam 47/60 monet serii"), **stanu/certyfikacji** (grading) i **wyceny
rynkowej w czasie**. To rozszerzenie, nie drugi magazyn.

- **Numizmatyka / filatelistyka** — katalogi systemowe serii (jak katalog RSS: admin
  utrzymuje, użytkownik kopiuje), braki w serii → lista „szukam" (→ Zakupy jako lista
  specjalna), wycena → Portfel (majątek).
- **Karty kolekcjonerskie (TCG), figurki, LEGO** — jak wyżej + stan opakowania;
  LEGO dodatkowo: inwentarz klocków i instrukcje (katalogi zestawów są publiczne).
- **Modelarstwo** (kolejowe, redukcyjne, RC) — hybryda: kolekcja (Magazynowanie) +
  **projekt budowy** (Warsztaty: projekt z dziennikiem — JEST w Pro!) + RC: rejestr
  lotów drona (przepisy UE! → [dedykowana dyscyplina w Pasjach z polami prawnymi]).
- **Winyle / książkowe białe kruki** — kolekcja + odsłuch/lektura → K-06 (Biblioteka).
- **Militaria / minerały / antyki** — kolekcja + proweniencja (historia pochodzenia
  przedmiotu — pole tekstowe z wagą prawną przy militariach; pozwolenia → K-01).
- **Motoryzacja klasyczna / oldtimery** — **[jest w 80%: Flota]** (pojazd, serwis,
  dokumenty) + brakuje: projekt renowacji → Warsztaty (JEST), status zabytku,
  zloty → kalendarz. Zakładka „kolekcjonerski" we Flocie zamyka temat.

### 6.4 Manualne i rękodzieło (majsterkowanie: 14% deklaracji)

Grupa niemal w całości **[jest: Warsztaty]** — moduł od początku projektowano na „dowolny
typ warsztatu" (stolarstwo, krawiectwo, ceramika, biżuteria…). Czego brakuje WSPÓLNIE:

- **Wzorce/projekty z instrukcją krokową** (wykroje, schematy szydełkowe, plany mebli) —
  dziś projekt ma dziennik, nie ma „przepisu". To jest… struktura Przepisu z Kuchni
  (składniki→materiały, kroki→kroki). Zlecenie R-09: „przepisy warsztatowe".
- **Zapasy materiałów** (włóczka, deski, żywica) → JUŻ jest (min-stany → Zakupy, 115).
- **Galeria ukończonych prac** z wyceną (jeśli sprzedaż → Portfel przychód, JEST z 115).
- Per hobby: **szydełko/druty/haft** (liczniki rzędów! drobiazg, wielka wygoda),
  **szycie** (wykroje i wymiary domowników — wymiary → pomiary z K-05!), **stolarstwo**
  (projekty mebli, cięcie → optymalizacja formatek jako narzędzie AI), **ceramika**
  (dziennik wypałów: temperatura/szkliwo — parametry jak pomiary), **mydła/świece**
  (RECEPTURY z proporcjami = dosłownie przepisy; uwaga na wagę bezpieczeństwa przy ługu),
  **renowacja mebli** (przed/po, techniki), **druk 3D** (biblioteka modeli, parametry
  druku, zużycie filamentu → magazyn), **elektronika/DIY** (projekty + części →
  Magazynowanie z SKU — JEST), **witraż/kaligrafia/introligatorstwo** ([Pasje] lub
  Warsztaty).

### 6.5 Kulinarne (gotowanie: 23% deklaracji)

- **Gotowanie / pieczenie** — **[jest: Kuchnia]** w pełni.
- **Domowe przetwory / fermentacja** (kiszonki, konfitury) — [jest+drobiazg]: przepis JEST,
  spiżarnia JEST; brakuje DOJRZEWANIA jako terminu („otworzyć po 6 tygodniach" → kalendarz)
  i partii (data słoika — Magazynowanie ma partie/FEFO w Pro!). Zlecenie R-10.
- **Piwo/wino/nalewki domowe** — **[Pasje-dyscyplina z głębią]**: receptura (przepis) +
  **dziennik warki** (pomiary: gęstość/temperatura w czasie — silnik pomiarów JEST) +
  etapy z terminami (fermentacja→butelkowanie→leżakowanie → kalendarz) + ewidencja
  (akcyza: limity domowe — twarda reguła prawna).
- **Kawa speciality / herbata** — [Pasje]: dziennik parzeń (parametry, ocena), zapasy
  ziaren → spiżarnia.
- **Grill/BBQ/wędzenie** — [Pasje]: dziennik wędzeń (temperatura/czas/drewno), przepisy
  → Kuchnia.

### 6.6 Kulturalne i umysłowe (czytanie: 41% deklaracji — hobby nr 1 w Polsce)

- **Czytanie książek** — **[K-06 Biblioteka]** — patrz §4. Hobby numer jeden Polaków
  nie ma dziś w Omnii żadnego gospodarza; to najmocniejszy pojedynczy argument za K-06.
- **Filmy/seriale/kino** (TV/serial: 18% CBOS) — [K-06].
- **Podcasty** (8,8 mln słuchających co tydzień) — [K-06] + streszczenia jak YouTube
  (silnik transkrypcja→streszczenie JEST — rozszerzenie YouTube o RSS podcastów to
  mały krok, wielki zasięg).
- **Teatr/opera/koncerty/muzea** — [K-06 jako „wydarzenia kulturalne"]: kolejka „chcę
  zobaczyć", bilety → K-01, terminy → kalendarz, dziennik wrażeń.
- **Pisanie (proza/poezja/blog)** — **[jest: Notatki]** + cele słów dziennie → Nawyki;
  publikacja → poza zakresem (nie budujemy CMS-a).
- **Historia / rekonstrukcje historyczne** — [Pasje]: grupa rekonstrukcyjna (workspace!),
  stroje/ekwipunek → Magazynowanie, zloty → kalendarz.
- **Genealogia** — **[dedykowany w przyszłości / rozszerzenie Kontaktów]**: drzewo
  (relacje między kontaktami — Kontakty mają tagi, nie mają RELACJI; to jest właściwy
  fundament), źródła i akty (→ K-01 dokumenty!), miejsca, GEDCOM import/eksport.
  Wzorzec: genetyka rodowodów JUŻ policzona w Zwierzętach — grafowa struktura przodków
  istnieje w repo.
- **Szachy/brydż/go** — [Pasje]: partie (PGN), ranking, kluby, nauka → SRS (taktyki
  jako fiszki! R-05).
- **Gry planszowe/RPG** (rynek ~550 mln zł) — [Pasje z głębią]: kolekcja gier (→ R-06),
  log rozgrywek (kto wygrał — gracze z Kontaktów), „ogrywalność" (koszt/partia),
  kampanie RPG (notatki sesji → Notatki, terminy sesji → kalendarz współdzielony —
  planowanie terminu to legendarny ból każdej drużyny RPG).
- **Krzyżówki/łamigłówki/puzzle** — [Pasje-lite]: licznik, kolekcja puzzli.
- **Nauka języków** — **[jest: Języki]**. **Nauka czegokolwiek** (egzaminy, prawo jazdy,
  zawodowe certyfikaty) — R-05: uogólnić SRS; certyfikaty z terminami ważności → K-01.

### 6.7 Muzyczne i artystyczne (muzyka: 13% deklaracji)

- **Gra na instrumencie** — **[Pasje z głębią]**: repertuar (utwór: status uczę-się/umiem,
  nuty/akordy jako załączniki), dziennik ćwiczeń (minuty → Nawyki JUŻ zliczą),
  metronom-cele (tempo docelowe jako kamień milowy), instrumenty → Warsztaty (serwis:
  strojenie pianina to `nextServiceAt`!).
- **Śpiew / chór / orkiestra** (8,3 tys. w PZChiO) — [Pasje]: repertuar zespołu
  (workspace!), próby → kalendarz współdzielony, koncerty.
- **Produkcja muzyczna / DJ** — [Pasje]: projekty utworów, sample/biblioteka, sprzęt →
  Warsztaty.
- **Rysunek/malarstwo/grafika** — [Pasje]: galeria prac z datami (postęp!), materiały →
  Magazynowanie, kursy → R-05, zlecenia komercyjne → Usługi (JEST marketplace!).
- **Fotografia** — **[Pasje z głębią]** (w czołówce deklaracji Pracuj.pl): sesje (dziennik
  z miejscem/parametrami), sprzęt z ubezpieczeniem (→ Warsztaty + K-01), złota godzina
  → kontrakt Pogody (wschody/zachody JUŻ liczone!), portfolio → galeria, zlecenia →
  Usługi. NIE budujemy zarządzania plikami RAW (Lightroom wygrał).
- **Film/wideo/YouTube-twórczość** — [Pasje]: pomysły→scenariusz→nagranie→montaż jako
  statusy projektu (Zadania z własnymi statusami JUŻ to umieją), kalendarz publikacji.

### 6.8 Techniczne i cyfrowe (gry: 15% deklaracji, 15,9 mln graczy)

- **Gaming** — **[K-06 Biblioteka]**: backlog (kolejka gier — kupione nieogrywane to
  folklor tej grupy), czas gry, ukończenia/osiągnięcia, subskrypcje gamingowe → K-03.
  E-sport oglądany: terminarze turniejów → kalendarz z katalogu.
- **Programowanie hobbystyczne / homelab** — [Pasje]: projekty → Zadania, domeny
  i certyfikaty z TERMINAMI (→ K-01 — wygasła domena to klasyk), sprzęt → Magazynowanie.
- **Drony** — [Pasje z polami prawnymi]: rejestr lotów (przepisy UE), strefy, uprawnienia
  z terminami (→ K-01), pogoda/wiatr → kontrakt Pogody.
- **Krótkofalarstwo** — **[dedykowany w przyszłości / dyscyplina z głębią]**: log łączności
  (QSO: data/pasmo/raport — ustalony format świata krótkofalarskiego), karty QSL,
  pozwolenie → K-01. Nisza mała, ale o kulturze skrupulatnego logowania — idealny
  użytkownik systemu.
- **Retro-komputery / konsole** — kolekcja (R-06) + projekty napraw (Warsztaty).
- **Elektronika/Arduino/Raspberry** — patrz 6.4.
- **Tworzenie treści (blog/podcast/stream)** — patrz 6.7 film/wideo.

### 6.9 Społeczne i towarzyskie

- **Podróże** (33% deklaracji; 52,9 mln podróży krajowych) — **[K-04]** — patrz §4.
- **Wolontariat / harcerstwo / OSP / koła gospodyń** — [Pasje]: organizacja (workspace
  zespołu — dosłownie ten model), dyżury/zbiórki → kalendarz, składki → Portfel,
  godziny wolontariatu (zaświadczenia!).
- **Escape roomy / laser tag / gokarty** — [Pasje-lite]: log odwiedzin, ranking znajomych.
- **Moda** (8% deklaracji; Whering ~10 mln) — **[Pasje/garderoba-lite]**: szafa jako
  inwentarz (Magazynowanie umie przedmioty!), zestawy, „nie noszę od roku" → oddaj
  (minimalizm), pranie-symbole. Pełny moduł Garderoba dopiero przy realnym popycie.
- **Spotkania rodzinne / gry towarzyskie** — [jest]: kalendarz + Kontakty + planszówki 6.6.
- **Motocykle (klubowo)** — Flota (pojazd JEST) + [Pasje]: zloty, trasy klubowe.

### 6.10 Zwierzęce (pies: 49% gospodarstw, kot: 41%)

- **Pies/kot/gryzonie/ptaki** — **[jest: Zwierzęta]** w pełni (opieka, wet., hodowla).
- **Akwarystyka** — [jest+drobiazg]: zbiornik = `PetEnclosure` z parametrami wody
  (odczyty JUŻ są: `PetEnvironmentReading`); brakuje harmonogramu podmian wody
  (cykliczność JEST w silniku) i dziennika parametrów z wykresem — zlecenie R-11.
- **Terrarystyka** — [jest]: dosłownie projektowane pod to (alarmy warunków w wiwarium).
- **Gołębie pocztowe** (PZHGP) — [jest+Pasje]: hodowla JEST (Zwierzęta), loty/wyniki
  sezonu → dyscyplina Pasji.
- **Wystawy psów / agility** (ZKwP ~40 tys.) — [jest+Pasje]: pies JEST, starty/tytuły
  → dyscyplina.
- **Konie** — patrz 6.2 jazda konna.

### 6.11 Synteza katalogu

Z ~60 hobby: **~20 jest już pokrytych** istniejącymi modułami (często z drobnym
zleceniem R-NN), **~30 obsłuży generyczny moduł Pasje** (K-MOD-08) z katalogiem dyscyplin
i polami JSON per dyscyplina, a **tylko 4–6 zasługuje docelowo na dedykowaną głębię**
(wędkarstwo, pszczelarstwo, myślistwo, krótkofalarstwo, genealogia, piwowarstwo domowe) —
i każde z nich może ŻYĆ w Pasjach, dopóki popyt nie uzasadni więcej. To potwierdza tezę
z §1.3: katalog hobby to argument za JEDNYM dobrym modułem generycznym, nie za
sześćdziesięcioma silosami.
---

## 7. Czego świadomie NIE budować (i dlaczego)

| Pomysł | Dlaczego nie |
|---|---|
| Klient e-mail / komunikator zewnętrzny | konkurencja nie do pobicia w rdzeniu ich wartości; Czat wewnętrzny wystarcza do współpracy w workspace |
| Agregacja kont bankowych | regulacje PSD2/licencje AIS; wrócić wyłącznie z licencjonowanym partnerem — do tego czasu import CSV (R-02) |
| Telemedycyna / diagnozy | odpowiedzialność medyczna; Zdrowie pozostaje REJESTREM, AI opisuje trendy, nigdy nie diagnozuje |
| Media społecznościowe / randki | sprzeczne z DNA systemu (władza nad własnym życiem vs pętle uwagi) |
| Streaming treści (muzyka/film) | licencje; K-06 śledzi CO konsumuję, nie serwuje treści |
| Nawigacja na żywo | Google Maps wygrał; Truck już robi jedyny wyjątek (profil ciężarowy) i słusznie kończy na deep-linku |
| Pełna księgowość firmowa w tym raporcie | to osobny, już zatwierdzony tor (biznesplan ERP: KSeF/faktury) — nie mieszać torów |
| Zarządzanie plikami zdjęć/RAW | Lightroom/Google Photos wygrały; Omnia trzyma metadane sesji, nie pliki |

Wspólna zasada: Omnia wygrywa POŁĄCZENIAMI danych, nie odtwarzaniem cudzych rdzeni.

---

## 8. Ranking końcowy i lista kandydatur (do decyzji właściciela)

Kryteria rankingu: zasięg (jaki % użytkowników dotyka) × cykliczność × siła integracji
z istniejącymi hubami × koszt budowy (na oko, po wzorcach repo) × dowód popytu z §3.

### 8.1 Nowe moduły

| # | Kandydatura | Zasięg | Koszt | Dowód popytu | Priorytet |
|---|---|---|---|---|---|
| K-MOD-01 | **Dokumenty i terminy** | każdy dorosły | średni (OCR/Drive/kalendarz JUŻ są) | 7% ma dokumenty ogarnięte; 1/3 przegapiła termin | **1** |
| K-MOD-02 | **Dom i nieruchomość** | większość gospodarstw | średni (wzorzec Floty) | przeglądy ustawowe; Houzz 65 mln | **2** |
| K-MOD-05 | **Trening i ciało** | 43,7% Polaków aktywnych | średni (silnik pomiarów JEST) | 1,5 mln na siłowniach; rower nr 1 | **3** |
| K-MOD-06 | **Biblioteka (media)** | czytanie = hobby nr 1 (41%) | mały-średni | Goodreads 150 mln; gaming 15,9 mln PL | **4** |
| K-MOD-11 | **Procesy życiowe** | każdy, skokowo | mały (szablony → Zadania) | żałoba: 30+ zadań, 7+ instytucji | **5** |
| K-MOD-04 | **Podróże** | 33% deklaracji | średni | 52,9 mln podróży krajowych | **6** |
| K-MOD-08 | **Pasje (generyczny)** | 87% ma hobby; ~30 dyscyplin z §6 | średni-duży (katalog+JSON pola) | §3.5 w całości | **7** |
| K-MOD-09 | **Cele i przeglądy** | ambitna mniejszość, duża lojalność | mały (czytelnik hubów) | rdzeń GTD; głosy §3.2 | **8** |
| K-MOD-10 | **Dziennik i samopoczucie** | szeroki | mały | mood-trackery §3.3 | **9** |
| K-MOD-07 | **Rodzina** | rodziny z dziećmi/seniorami | duży (encja platformowa!) | opiekunowie: 27 h/tydz. | **10** (duży, projektować starannie) |
| K-MOD-03 | **Subskrypcje** | 62% Polaków | mały | 204 USD/rok strat | jako R-02 w Portfelu |

Kolejność sugerowana, nie wiążąca. Uzasadnienie czołówki: K-01 i K-02 czynią framing
„ERP życia" prawdziwym (dokumenty + największy obiekt majątku); K-05 i K-06 pokrywają
dwa najmasowniejsze braki (sport 43,7%, czytanie 41%); K-11 jest tani, a obsługuje
sytuacje, w których system znaczy najwięcej.

### 8.2 Rozszerzenia istniejących modułów (tańsze niż moduły, część przed nimi)

| # | Zlecenie | Moduł |
|---|---|---|
| R-01 | pomiary ciała + szczepienia dorosłych + historia rodzinna | Zdrowie |
| R-02 | subskrypcje i umowy cykliczne + majątek netto + import CSV | Portfel |
| R-03 | prezenty (pomysły/historia) + „odezwij się" | Kontakty |
| R-04 | diety/alergie per domownik | Kuchnia |
| R-05 | uogólnienie SRS na dowolne fiszki | Języki→Nauka |
| R-06 | widok kolekcjonerski (serie, kompletność, wycena) | Magazynowanie |
| R-07 | kalendarz przyrodniczy (księżyc/ciśnienie/wschody) jako kontrakt | Pogoda |
| R-08 | podział obowiązków domowych (rotacja, dyżury, „kto ostatnio") | Zadania+platforma |
| R-09 | „przepisy warsztatowe" (wykroje/plany/schematy krokowe) | Warsztaty |
| R-10 | dojrzewanie przetworów (terminy otwarcia, partie słoików) | Kuchnia |
| R-11 | akwarystyka: harmonogram podmian + wykres parametrów wody | Zwierzęta |
| R-12 | podcasty RSS w silniku streszczeń | YouTube→Media |

### 8.3 Zasady wiążące dla każdej przyszłej realizacji (z §3, nie do pominięcia)

1. **Zero obowiązkowych formularzy** — dane jako produkt uboczny (skan, zdjęcie, jedno
   zdanie do asystenta, akcja w innym module). To pierwsza przyczyna porzuceń u konkurencji.
2. **System znosi zaniedbanie bez kary** — tydzień nieużywania modułu nie może witać
   użytkownika ścianą zaległości i czerwieni („maintenance tax").
3. **AI proponuje, człowiek zatwierdza** — model zaufania potwierdzony badaniami;
   `ActionDrawer` + auto-approve dla niedestrukcyjnych to już właściwy kształt.
4. **Każdy nowy moduł wchodzi przez huby** (kalendarz, pulpit, Portfel, kosz,
   udostępnianie, asystent, powiadomienia) — inaczej jest silosem, czyli kolejną
   appką-wyspą, od których użytkownicy właśnie uciekają.
5. **Twarde terminy prawne są świętością systemu** (spadek: 6 mies.; przeglądy domu;
   ważność dokumentów) — pilnowane z wyprzedzeniem zależnym od rodzaju, z wyjaśnieniem
   „dlaczego teraz" (wzorzec `reason` z harmonogramu Roślin).

---

## 9. Źródła

Research 2026-08-30 (dwa przebiegi wyszukiwania; kluczowe pozycje):

- CBOS 2026 „Czas wolny Polaków"; Pracuj.pl „Hobby w czasie wolnym i w pracy";
  Biblioteka Narodowa „Stan czytelnictwa w Polsce 2024/2025"; GUS „Uczestnictwo
  w sporcie i rekreacji ruchowej 2024/2025"; GUS „Turystyka w 2024 r."
- PZD — komunikat o stanie posiadania 31.12.2024; PZW — dane członkowskie 2024;
  Demagog/GUS — liczba myśliwych 2024; Instytut Ogrodnictwa — „Stan pszczelarstwa
  w Polsce 2024"; PZChiO; ZKwP.
- Ipsos GameTrack 2025 (Video Games Poland); DataReportal „Digital 2025 Poland"
  (YouTube); raport „Słuchacz podcastów w Polsce 2025"; rynek planszówek 2025;
  fit.pl / Benefit Systems 2024 (fitness); FEDIAF 2024 (zwierzęta); Fundacja Maraton
  Warszawski 2024; SW Research/CBOS (grzybobranie).
- Brightpearl/OnePoll (life admin); MDPI Social Sciences 2024 (administrative household
  labor); E. Emens „Life Admin" (2019); Kyle & Frakt, Health Services Research 2021
  (admin zdrowotny); Tran i in. 2015 (burden of treatment); NAIC 2024 (inwentarz domowy);
  SafeKeep 2025 (dokumenty); UK Death Admin Research Report 2024–25; AARP/NAC 2025
  (opiekunowie); Harris Poll 2025 (emigracja); Allianz 2025–26 (rozwód); OnePoll 2020
  (przeprowadzka).
- C+R Research 2024 / CNET 2025 / Self 2026 (subskrypcje, USA); Santander Consumer
  Bank 2024 / ING BSK 2023 (subskrypcje, PL).
- Menlo Ventures „State of Consumer AI 2025"; Zendesk 2025–26; MX Research 2026;
  BankMyCell 2024–26 (telefonofobia); Clutch 2024–26 (app fatigue); Gridfiti 2025
  (szablony Life OS); analizy porzucania systemów Notion 2024–26; wątki HN o personal
  CRM i organizacji życia (2013–2023).
- Rynki appek: Research Nester, Straits Research, Grand View Research, MRFR,
  Market Reports World (2023–2025); Wikipedia/materiały firm: Goodreads, StoryGraph,
  Whering, Fishbrain, Houzz, PictureThis, Duolingo.

Liczby o różnej metodologii — traktować jako rząd wielkości. Braki danych wskazane
w §3.5 wprost; żadna liczba w tym raporcie nie została wymyślona.
$moduly116$,
  'system',
  'db',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
