-- 0223: raport administracyjny — architektura docelowa Omnii przy 100 tys.+ użytkowników.
-- Bez DDL. Idempotentny seed raportu (C-14): slug globalnie unikalny, ON CONFLICT DO UPDATE,
-- żeby ponowne wdrożenie odświeżało treść zamiast ją duplikować.
INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — architektura docelowa dla 100 tys.+ użytkowników (2026-08-03)',
  'omnia-architektura-docelowa-100k-2026-08-03',
  $raport_arch_docelowa$# Omnia — architektura docelowa dla 100 tys.+ użytkowników

> **Dla kogo ten dokument.** Pierwszy odbiorca to **właściciel** (decyzja: iść czy nie iść).
> Drugi to **Claude Code**, który tę przebudowę wykona — dlatego od rozdziału 7 dokument jest pisany
> jak instrukcja robocza: konkretne pliki, konkretna kolejność, konkretne kryteria wyjścia.
>
> **Czym ten dokument NIE jest.** Nie jest kontynuacją raportu „architektura zdarzeniowa, cofanie
> zmian i podgląd na żywo" (2026-08-03). Tamten odpowiadał na pytanie postawione przy **jednym
> aktywnym użytkowniku** i przy tym założeniu jego wnioski były poprawne. Informacja o docelowych
> **100 tys. użytkowników, a docelowo milionach**, unieważnia część z nich — i dokument mówi wprost,
> **które i dlaczego**.

---

## 1. Streszczenie wykonawcze

**Werdykt: nie przepisujemy aplikacji. Przebudowujemy jej granice.**

1. **Event sourcing i CRDT nadal odpadają** — ale z innego powodu niż w poprzednim raporcie.
   Wtedy powód brzmiał „masz jednego użytkownika". Teraz brzmi: **dane Omnii są prywatne per
   użytkownik**. 100 tys. użytkowników to nie jeden wielki zbiór danych, tylko **100 tys. małych,
   niezależnych zbiorów**. To najłatwiejszy kształt do skalowania, jaki istnieje. Współbieżna edycja
   tej samej encji przez wiele osób praktycznie nie występuje — nawet przy milionach kont.
2. **Mikroserwisy odpadają** — i to jest najważniejsza rzecz, której nie należy zrobić. Rozbicie 21
   modułów na 21 usług zamieni tanie wywołanie funkcji w sieciowe RPC, a **integracja
   międzymodułowa jest głównym produktem Omnii**, nie dodatkiem. Zabiłoby to dokładnie tę cechę,
   dla której aplikacja istnieje.
3. **Rekomendacja: modularny monolit z twardymi granicami** (rozdział 6). Jedno wdrożenie, jedna
   baza, ale moduły przestają się nawzajem importować bezpośrednio — dostają **kontrakty**.
4. **Prawdziwy problem nie leży w ruchu, tylko w kodzie.** Aplikacja ma **147 modeli, 545 akcji
   serwerowych, 21 modułów** i rośnie. Koszt dodania modułu nr 22 rośnie liniowo z liczbą już
   istniejących, bo każdy może sięgnąć do każdego. To jest ta „sprawność utrzymania i rozwoju",
   o którą pyta właściciel — i to jest właściwy cel przebudowy.
5. **Ruch też ma jeden realny zabójca** i jest nim rzecz banalna: `DataFreshness` odpytuje serwer
   **co 45 sekund z każdej otwartej karty**. Przy 100 tys. kont i 5 % jednoczesności to ~110
   pełnych przeładowań komponentów serwerowych na sekundę, każde z kilkunastoma zapytaniami do bazy.
   **To wywróci Neona zanim wywróci go cokolwiek innego** (rozdział 5.1).
6. **Stan kodu jest lepszy, niż zakłada typowa diagnoza „prototyp przed skalą".** Kolejka zadań ma
   `SELECT … FOR UPDATE SKIP LOCKED` (bezpieczna przy wielu instancjach), jest 90 plików testów
   wraz z testem izolacji najemców, rate-limiting AI działa, indeksy po `ownerId` są w **45 z 46**
   modeli. To nie jest sprzątanie po bałaganie — to **dokładanie warstwy, której świadomie jeszcze
   nie było** (w repo istnieje nawet nazwana rezerwa „Faza 4 / SC2–SC7", nigdy nierozpoczęta).
7. **Moment jest dobrze wybrany.** Zamrożenie developmentu na kilka dni realnie obniża koszt tej
   zmiany, bo większość prac to przenoszenie plików i zmiana importów — czyli dokładnie to, co
   generuje konflikty scaleń.
8. **Skala nie jest jednym progiem, tylko trzema** (rozdział 4). Inne rzeczy psują się przy 15
   testerach, inne przy 100 tys., a jeszcze inne przy milionach. Plan jest tak ułożony, żeby
   **nie budować dziś tego, co potrzebne dopiero przy milionie**.
9. **Umiędzynarodowienie to osobna, kosztowna oś** i jedyna, która wymaga ruszenia **każdego pliku
   z tekstem**. Dlatego wchodzi do planu **teraz** — po 100 tys. użytkowników byłoby to
   nierealne (rozdział 10).
10. **Propozycja nazwy: `Omnia 2.0 „Fundament"`.** Uzasadnienie w rozdziale 13.

---

## 2. Stan faktyczny — czym Omnia jest dzisiaj

Liczby policzone z kodu, nie z pamięci:

| Wymiar | Wartość | Skąd |
|--------|---------|------|
| Modele Prisma | **147** | `prisma/schema.prisma` |
| Migracje | **222** | `prisma/migrations/` |
| Akcje serwerowe (mutacje + odczyty) | **545** | bramka `check:ai-coverage` |
| Akcje wystawione asystentowi AI | **160** | bramka `check:actions` |
| Moduły w rejestrze | **21** | `src/lib/modules.tsx` |
| Pliki testów jednostkowych/integracyjnych | **90** | `find src -name "*.test.ts"` |
| Modele z `ownerId` | 46, z czego **45 z indeksem** | analiza `schema.prisma` |
| Pliki wołające model LLM | **34** | bramka `check:cost-badge` |

### Co jest zrobione dobrze i czego NIE wolno zepsuć przy przebudowie

To nie jest kurtuazja — to lista rzeczy, które przy nieostrożnym refaktorze łatwo utracić:

- **Kolejka zadań jest wielo-instancyjna.** `src/lib/jobs/queue.ts` używa
  `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` z widocznością i ponowieniami. Kilka
  instancji Rendera **nie** wykona tego samego zadania dwa razy. To zdejmuje największą typową
  przeszkodę przed skalowaniem poziomym.
- **Bramki jakości wymuszają kompletność, a nie tylko poprawność.** `check:ai-coverage` wymaga, żeby
  **każda** akcja miała zadeklarowany zakres dostępu **i realny guard w kodzie**;
  `check:action-coverage` — żeby każda akcja AI miała egzekutor i kontrakt; `check:cost-badge` —
  żeby każde wywołanie modelu przekazywało zużycie; `check:content-memory` — żeby każda generacja
  była świadomie sklasyfikowana. **To jest rzadkie i bardzo cenne.** Nowa architektura ma ten wzorzec
  rozszerzyć, nie porzucić.
- **Model współwłasności jest jednolity** (`ownerId` / `ownerTeamId` + `getUserTeamIds`), ma test
  izolacji (`src/__tests__/isolation.test.ts`) i jest indeksowany.
- **Rate-limiting AI istnieje** (`src/lib/ai/rateLimit.ts`, 20/min, 250/h, max 2 równoległe) —
  z komentarzem uczciwie mówiącym, że jest in-memory i przy wielu instancjach wymaga Redisa.
- **Routing modeli LLM jest sterowany bazą** (`/admin/llm`), z rozliczaniem kosztów i pamięcią treści.
- **Odświeżanie po stronie klienta już działa** (`DataFreshness`) — problemem nie jest jego brak,
  tylko jego koszt przy skali.

### Gdzie realnie boli — sprzężenie modułów

Moduły wołają się bezpośrednio: `src/actions/*` importuje z innych `src/actions/*` (m.in. 17 importów
`activity`, 6 `lists`, 3 `pets`, po 2 `tasks`/`taskProjects`/`products`). Kalendarz agreguje **sześć**
modułów, asystent AI sięga do **wszystkich**. To działa, ale znaczy, że:

- zmiana kształtu danych w jednym module może wywrócić trzy inne bez ostrzeżenia,
- nie da się modułu wyłączyć, wymienić ani przetestować w izolacji,
- **koszt dodania modułu rośnie z liczbą modułów już istniejących.**

To jest właściwa diagnoza. Nie „aplikacja nie udźwignie ruchu", tylko **„aplikacja coraz drożej
przyjmuje kolejne moduły"** — a przecież „wszystko, czego użytkownik potrzebuje w życiu" znaczy,
że modułów będzie przybywać bez końca.

---

## 3. Co zmienia informacja o 100 tys. użytkowników — i co NIE zmienia

### 3.1. Rozróżnienie, na którym stoi cała reszta dokumentu

Są dwa różne problemy, które łatwo pomylić:

| | **Współbieżność na tej samej encji** | **Skala wielu najemców** |
|---|---|---|
| Pytanie | „Dwie osoby edytują ten sam rekord w tej samej sekundzie" | „Sto tysięcy osób edytuje każde swój rekord" |
| Przykład | Google Docs, Figma, wspólny arkusz | Gmail, Todoist, Strava |
| Rozwiązanie | CRDT / OT / event sourcing | Indeksy, cache per użytkownik, kolejki, limity |
| Koszt | miesiące, przepisanie warstwy danych | tygodnie, warstwa operacyjna |
| **Omnia** | **praktycznie nie występuje** | **to jest ten przypadek** |

**Omnia jest aplikacją drugiego typu i pozostanie nią przy milionie użytkowników.** Listy zakupowe,
notatki, zwierzęta, zdrowie, portfel — to dane prywatne. Współdzielenie istnieje (zespoły,
`ownerTeamId`, `TaskShare`, `PetShare`), ale realny konflikt „dwie osoby, ten sam rekord, ta sama
sekunda" pozostaje rzadkim wyjątkiem, a nie regułą. **Skala go nie tworzy** — tworzy go tylko wspólny
dokument, którego Omnia nie ma.

**Wniosek: 100 tys. użytkowników NIE jest argumentem za event sourcingiem.** Kto twierdzi inaczej,
myli liczbę użytkowników z liczbą edytorów jednego obiektu.

### 3.2. Co jednak realnie się zmienia

| Obszar | Przy 2 użytkownikach | Przy 100 tys. | Ocena |
|--------|----------------------|---------------|-------|
| Odpytywanie co 45 s | 2 zapytania/45 s | **~110 przeładowań RSC/s** przy 5 % jednoczesności | 🔴 blokujące |
| Rate-limit AI in-memory | wystarcza (1 instancja) | nie działa przy N instancjach — limit ×N | 🔴 blokujące |
| Koszt LLM | grosze | **tysiące USD/mies.** bez twardych budżetów | 🔴 blokujące |
| Pula połączeń do Neona | nieistotna | wyczerpanie połączeń przy skalowaniu poziomym | 🔴 blokujące |
| Obserwowalność | „działa/nie działa" | bez metryk nie wiadomo, **co** się psuje | 🟠 poważne |
| Retencja danych (`Job`, `AuditLog`, `UserActivity`, `AiMessage`) | nieistotna | liniowy wzrost bazy i kosztu | 🟠 poważne |
| Sprzężenie modułów | irytujące | **hamuje rozwój produktu** | 🟠 poważne |
| Brak i18n | nieistotny | blokuje rynki zagraniczne | 🟠 poważne |
| Współbieżna edycja | nie występuje | **nadal nie występuje** | ⚪ bez zmian |
| Event sourcing | niepotrzebny | **nadal niepotrzebny** | ⚪ bez zmian |

### 3.3. Sprostowanie do poprzedniego raportu

Poprzedni raport (`omnia-architektura-zdarzeniowa-cofanie-live-2026-08-03`) kończył się zdaniem, że
najdroższy wariant „rozwiązuje problem, którego ta aplikacja nie ma", i uzasadniał to m.in. tym, że
Omnia jest systemem **w praktyce jednoosobowym**.

**Ta przesłanka była błędna** — a raczej: opisywała stan dzisiejszy, nie docelowy. **Wniosek jednak
się nie zmienia**, bo opiera się także na drugiej, mocniejszej przesłance: charakterze danych
(prywatne per użytkownik), a ten nie zależy od liczby kont. Zmienia się natomiast **hierarchia
pozostałych zaleceń**: to, co tamten raport odkładał („wariant b — skrócenie interwału tylko tam,
gdzie boli"), przy 100 tys. użytkowników staje się **odwrotnością** tego, co trzeba zrobić —
odpytywanie trzeba nie skracać, tylko **wyeliminować** (rozdział 5.1).

---

## 4. Trzy progi skali — czego NIE budować za wcześnie

Najdroższy błąd to zbudowanie dziś infrastruktury na milion użytkowników, gdy na produkcji jest 15
testerów. Plan rozdziela prace na progi:

### Próg A — „demo i testerzy" (3–15 osób, **najbliższe tygodnie**)
Wąskim gardłem nie jest wydajność, tylko **wiarygodność**: nie może się nic wywalać na oczach osób
oceniających produkt. Potrzebne: obserwowalność, sensowne błędy, brak martwych ekranów, i18n
zaczęte (bo później drożeje), granice modułów (bo to teraz jest tanie).

### Próg B — „otwarcie" (do ~100 tys. kont)
Wąskim gardłem jest **koszt jednostkowy i liczba zapytań**. Potrzebne: koniec odpytywania,
współdzielony rate-limit i budżety AI, pula połączeń, cache, retencja danych, skalowanie poziome.

### Próg C — „rynki zagraniczne" (miliony)
Wąskim gardłem jest **geografia i izolacja**. Potrzebne: repliki odczytu / regiony, sharding po
`ownerId` (łatwy, bo dane są prywatne), CDN, kolejka poza bazą. **Nic z progu C nie wchodzi do tej
przebudowy** — ma być tylko *możliwe* bez kolejnego przepisywania, i rozdział 6 pilnuje właśnie tego.

---

## 5. Diagnoza szczegółowa — co się złamie i dlaczego

Uszeregowane wg iloczynu „prawdopodobieństwo × szkoda". Każdy punkt ma **dowód w kodzie** i
**scenariusz awarii**.

### 5.1. 🔴 P0 — Odpytywanie co 45 sekund zabije bazę przed czymkolwiek innym

**Dowód:** `src/components/shell/DataFreshness.tsx` — `setInterval(…, 45_000)` wywołujący
`router.refresh()` przy każdej widocznej karcie, plus odświeżenie na `visibilitychange`, `focus`
i `pageshow`. Komponent jest montowany raz w `AppShell`, czyli **na każdej stronie aplikacji**.

**Scenariusz awarii.** 100 tys. kont, ostrożne 5 % jednoczesności = 5 000 otwartych kart.
5 000 / 45 s ≈ **111 pełnych przeładowań drzewa komponentów serwerowych na sekundę**. Strona główna
wykonuje kilkanaście zapytań (zadania, posiłki, zwierzęta, flota, portfel, języki, zdrowie,
magazyn…). To rząd **1 500–2 000 zapytań na sekundę wygenerowanych przez samo bezczynne siedzenie
w aplikacji**. Neon się przewróci, a rachunek przyjdzie za ruch, którego nikt nie zamówił.

**Dlaczego to jest podstępne:** przy 15 testerach to ~0,3 przeładowania/s. **Nic nie zapowiada
awarii aż do momentu, w którym jest za późno.**

**Kierunek naprawy:** odpytywanie zastąpić **unieważnianiem sterowanym zdarzeniem** — serwer mówi
„zmieniło się", zamiast klient pytać „czy coś się zmieniło". Szczegóły w rozdziale 7, Faza 3.

### 5.2. 🔴 P0 — Rate-limit i strażnik współbieżności są per proces

**Dowód:** `src/lib/ai/rateLimit.ts` — `Map` w pamięci procesu; komentarz w pliku uczciwie mówi
„na free-tier Render = jedna instancja, więc wystarcza; przy skali docelowo Redis/DB — patrz SC2".

**Scenariusz awarii.** Skalujemy do 4 instancji → limit 20/min staje się faktycznie 80/min na
użytkownika, a „max 2 równoległe" — ośmioma. Jeden zapętlony klient albo jeden złośliwy użytkownik
generuje ośmiokrotność zakładanego kosztu LLM. **Limit, który nie trzyma przy skalowaniu, jest gorszy
niż brak limitu — daje fałszywe poczucie kontroli.**

### 5.3. 🔴 P0 — Brak twardych budżetów kosztu AI

**Dowód:** rozliczanie kosztów istnieje (`estimateCost`, `LlmModelPrice`, `AiCall`), ale służy
**pokazywaniu** kosztu, nie **zatrzymywaniu** wydatku. Nie ma limitu miesięcznego per użytkownik ani
globalnego wyłącznika awaryjnego.

**Scenariusz awarii.** 10 % ze 100 tys. użytkowników używa asystenta dwa razy dziennie = 20 tys.
wywołań/dobę. Nawet przy 0,005 USD za wywołanie to **~3 000 USD miesięcznie** — przy aplikacji, która
jeszcze nic nie zarabia. Wystarczy jeden użytkownik odkrywający, że „zrób raport" da się wołać
w pętli, i pozycja rośnie skokowo. **Potrzebne: budżet per użytkownik, budżet globalny, wyłącznik.**

### 5.4. 🔴 P0 — Pula połączeń do bazy przy skalowaniu poziomym

**Dowód:** `.env.example` ma `pgbouncer=true`, ale **nie ma `connection_limit`**, a schemat nie
konfiguruje puli. Prisma domyślnie otwiera pulę **na instancję**.

**Scenariusz awarii.** 4 instancje × domyślna pula (u Prismy `num_cpus × 2 + 1`) i już przy
skromnym sprzęcie zbliżamy się do limitów Neona. Objaw jest mylący: aplikacja „losowo" zwraca błędy
połączenia pod obciążeniem, choć baza ma wolne zasoby.

### 5.5. 🟠 P1 — Brak obserwowalności

**Dowód:** jest `reportServerError`, jest `/admin/health` (liczony na żywo), ale **nie ma metryk,
tracingu ani logów strukturalnych**. Nie da się odpowiedzieć na pytanie „która akcja zwolniła
w zeszłym tygodniu".

**Scenariusz awarii.** Demo, ktoś mówi „u mnie się długo ładuje". Bez metryk jedyną odpowiedzią jest
„u mnie działa". Przy 100 tys. użytkowników to nie jest niedogodność — to **niemożność prowadzenia
produktu**.

### 5.6. 🟠 P1 — Sprzężenie modułów hamuje rozwój

**Dowód:** rozdział 2. Bezpośrednie importy `actions → actions`, kalendarz agregujący sześć modułów,
asystent sięgający do wszystkich, 545 akcji w jednej przestrzeni.

**Scenariusz awarii** — i to jest ten, który już się dzieje, tylko powoli: dodanie modułu nr 22
wymaga dotknięcia rejestru modułów, uprawnień, nawigacji, kalendarza, asystenta (katalog akcji,
kontrakt, egzekutor, read-tool, manifest pokrycia), pulpitu i wyszukiwarki. **Osiem miejsc, z których
żadne nie jest wymuszone typami** — pilnują tego bramki skryptowe, ale dopiero po fakcie.

### 5.7. 🟠 P1 — Retencja danych

**Dowód:** `cleanupOldJobs` kasuje zadania po 24 h — to jedyna systemowa retencja. `AuditLog`,
`UserActivity`, `AiMessage`, `AiConversation`, `NewsArticle`, `ItemHistory` rosną bez ograniczeń.

**Scenariusz awarii.** 100 tys. użytkowników × kilkadziesiąt wpisów aktywności dziennie = dziesiątki
milionów wierszy rocznie w tabeli, której nikt nigdy nie czyta poza „ostatnie 10".

### 5.8. 🟠 P1 — Brak wielojęzyczności

**Dowód:** teksty są zaszyte w komponentach (konwencja C-32 „teksty po polsku"). Zero bibliotek i18n.

**Scenariusz awarii.** To nie jest awaria — to **ściana**. Przy 100 tys. polskich użytkowników
wyciągnięcie tekstów z ~200 komponentów to praca na tygodnie, wykonywana na żywym organizmie.
Dziś to praca mechaniczna przy zamrożonym repozytorium.

### 5.9. 🟡 P2 — Brak paginacji w widokach listowych

Większość list pobiera **wszystko** i filtruje na kliencie. Przy użytkowniku z 5 000 zadań albo
20 000 pozycji magazynowych strona stanie się nieużywalna — niezależnie od liczby użytkowników.

---

## 6. Architektura docelowa i odrzucone warianty

### 6.1. Rekomendacja: **modularny monolit z twardymi granicami**

Jedno wdrożenie, jedna baza, jeden proces budowania — **ale moduły przestają być zwykłymi katalogami
i stają się jednostkami z kontraktem**.

```
src/
├─ modules/
│  ├─ tasks/
│  │  ├─ contract.ts      ← JEDYNE, co widzą inne moduły (typy + funkcje)
│  │  ├─ actions/         ← Server Actions (prywatne dla modułu)
│  │  ├─ domain/          ← logika bez Prismy i bez Reacta (testowalna)
│  │  ├─ ui/              ← komponenty
│  │  └─ module.ts        ← rejestracja: trasy, uprawnienia, zdarzenia, akcje AI, kafelek pulpitu
│  ├─ shopping/ …
│  └─ (21 modułów)
├─ platform/              ← rzeczy wspólne: auth, RBAC, kolejka, LLM, cache, i18n, obserwowalność
└─ app/                   ← trasy Next.js, cienkie: tylko sklejanie
```

**Trzy reguły, które to spinają:**

1. **Moduł importuje z innego modułu wyłącznie przez `contract.ts`.** Wymuszone lintem, nie dobrą
   wolą. To jedyna reguła, która realnie zatrzymuje erozję granic.
2. **Moduł nie woła innego modułu, żeby coś w nim zmienić — publikuje zdarzenie.** „Zakupy
   zakończone" nie wywołuje Portfela; Portfel **nasłuchuje**. Dzięki temu dodanie modułu, który też
   chce reagować na zakupy, nie wymaga dotykania Zakupów.
3. **Moduł rejestruje się sam** (`module.ts`), zamiast być dopisywanym do ośmiu list. Rejestr modułów,
   uprawnienia, nawigacja, kafelek pulpitu, akcje AI i wpisy kalendarza mają wynikać z **jednej**
   deklaracji.

**Dlaczego to jest właściwa odpowiedź na „wszystkie moduły integrują się ze wszystkimi":** integracja
zostaje, ale przestaje być siecią `N×N` bezpośrednich zależności, a staje się gwiazdą — każdy moduł
zna tylko **platformę** i **kontrakty**, których używa. Przy 21 modułach różnica jest odczuwalna;
przy 40 to różnica między „da się" a „nie da się".

### 6.2. Wariant odrzucony: mikroserwisy

**Odrzucony stanowczo.** Powody:
- Integracja międzymodułowa jest **produktem**, nie efektem ubocznym. Kalendarz agregujący sześć
  modułów i asystent czytający wszystkie stałyby się rozproszonymi zapytaniami po sieci — wolnymi,
  zawodnymi i trudnymi do utrzymania spójności.
- Dane są w **jednej bazie z kluczami obcymi**. Rozbicie oznacza albo współdzieloną bazę (czyli
  mikroserwisy tylko z nazwy), albo rozproszone transakcje.
- Zespół to **jedna osoba plus Claude Code**. Mikroserwisy to koszt organizacyjny płacony przez
  zespoły, których problemem jest komunikacja między ludźmi. Tego problemu tu nie ma.

### 6.3. Wariant odrzucony: event sourcing jako model danych

**Odrzucony.** Rozdział 3.1 wyjaśnia dlaczego. Dodatkowo: 147 modeli i 222 migracje to zbyt duża
istniejąca inwestycja, żeby ją unieważnić bez zysku, który dałoby się nazwać.

**Ale jeden element z tego świata bierzemy** — **outbox** (rozdział 7, Faza 3). To nie jest event
sourcing: stan nadal żyje w tabelach, a zdarzenia służą wyłącznie do **powiadamiania** (unieważnienie
cache, reakcje innych modułów). Różnica jest zasadnicza: przy event sourcingu zdarzenia **są** prawdą;
u nas są **komunikatem o zmianie prawdy**.

### 6.4. Wariant odrzucony: CRDT / edycja współbieżna

**Odrzucony.** Nie ma dokumentu, który dwie osoby edytują naraz. Gdyby taki moduł kiedyś powstał
(np. wspólne notatki na żywo), CRDT wchodzi **wyłącznie w tym module** — i architektura z 6.1 na to
pozwala bez ruszania reszty. To jest test poprawności tej architektury i on go przechodzi.

### 6.5. Wariant odrzucony: przepisanie na inny framework

Next.js App Router z Server Actions jest dla tego kształtu aplikacji **trafnym wyborem**. Migracja na
cokolwiek innego to koszt miesięcy za zerową wartość dla użytkownika.

### 6.6. Wariant częściowo przyjęty: rozdzielenie warstw uruchomieniowych

Nie mikroserwisy, ale **rozdzielenie procesów wg charakteru pracy**:
- **web** — obsługa żądań (skalowana poziomo, bezstanowa),
- **worker** — zadania w tle (kolejka już to udźwignie dzięki `SKIP LOCKED`),
- **cron** — zadania okresowe.

To wchodzi w Fazie 5 i jest tanie, bo kolejka jest już na to gotowa.

---

## 7. Plan przebudowy — instrukcja dla Claude Code

> Od tego miejsca dokument jest pisany **do Claude Code**. Każda faza ma: **cel**, **dlaczego**,
> **co zrobić**, **kryteria wyjścia**, **ryzyko**. Fazy 0–4 to okno zamrożenia. Fazy 5–7 można robić
> normalnym trybem pracy.
>
> **Zasady obowiązujące przez całą przebudowę:**
> - Każda faza to osobny przebieg spec-driven pipeline'u (`/specify …`). **Nie rób dwóch faz naraz.**
> - Konstytucja `.claude/spec-pipeline/constitution.md` obowiązuje bez wyjątków.
> - **Żadna faza nie może zmieniać zachowania widocznego dla użytkownika**, chyba że jest to wprost
>   jej celem. Refaktor i zmiana funkcji nigdy w jednym commicie.
> - Po każdej fazie: `npm run build` zielony + pełny zestaw klikaczy + wpis do `doświadczenia.md`.

### Faza 0 — Siatka bezpieczeństwa (**zrób to pierwsze, bez wyjątku**)

**Cel:** móc wykryć, że refaktor coś zepsuł.

**Dlaczego:** przenosimy setki plików. Bez siatki bezpieczeństwa dowiemy się o regresji od testerów,
a nie od bramki.

**Co zrobić:**
1. **Test charakteryzujący dla każdego modułu** — jeden klikacz „ścieżka szczęśliwa" na moduł
   (wejdź, dodaj, edytuj, usuń, sprawdź). Dziś klikacze pokrywają część modułów; uzupełnij do 21.
2. **Test kontraktowy izolacji najemcy dla wszystkich 545 akcji.** Istniejący
   `src/__tests__/isolation.test.ts` rozszerz do **generowanego** testu: dla każdej akcji
   z manifestu `action-coverage.json` sprawdź, że wywołana jako użytkownik B nie widzi danych
   użytkownika A. **To jest najważniejszy test w całym systemie** — przy 100 tys. kont wyciek
   między najemcami jest awarią kończącą produkt.
3. **Migawka schematu bazy** jako test: `prisma migrate diff` w CI musi być pusty względem
   `schema.prisma` (dziś rozjazd wykryłby dopiero deploy).

**Kryteria wyjścia:** 21/21 modułów ma klikacz ścieżki szczęśliwej; test izolacji generowany
z manifestu i zielony; rozjazd schematu wykrywany automatycznie.

**Ryzyko:** niskie. To wyłącznie dokładanie testów.

### Faza 1 — Granice modułów (największa, czysto mechaniczna)

**Cel:** struktura z rozdziału 6.1.

**Dlaczego:** to jest właściwy powód tej przebudowy — koszt dodania kolejnego modułu.

**Co zrobić:**
1. Utwórz `src/platform/` i przenieś tam: `auth`, `permissions`, `prisma`, `jobs`, `llm`, `crypto`,
   `trash`, `audit`, `notifications`, `cache`, `viewState`, `shortcuts`, `favorites`.
2. Dla **każdego** z 21 modułów utwórz `src/modules/<nazwa>/` i przenieś `actions/`, `components/`,
   `lib/`. **Trasy w `src/app/` zostają** — mają się stać cienkie (tylko sesja, pobranie danych,
   render komponentu modułu).
3. Dla każdego modułu napisz `contract.ts` — **wyłącznie to, czego potrzebują inne moduły**. Zacznij
   od odwrócenia istniejących importów: co dziś importuje kalendarz z zadań, to jest kontrakt zadań.
4. Dodaj regułę ESLint `no-restricted-imports`: import z `@/modules/X/**` jest dozwolony **tylko**
   dla `@/modules/X/**` i dla `@/modules/X/contract`. **Bez tej reguły cała faza jest bezwartościowa**
   — granice bez egzekwowania erodują w tygodnie.
5. `module.ts` per moduł: trasy, slug uprawnienia, ikona, kolor, kafelek pulpitu, wpisy kalendarza,
   akcje AI. Rejestr modułów, `permissions.ts`, `ModuleSidebar` i katalog akcji AI mają **czytać
   z tych deklaracji**, a nie mieć własne listy.

**Kryteria wyjścia:** `npm run build` zielony; lint blokuje import przez granicę; dodanie modułu
wymaga **jednego** nowego katalogu i **zera** zmian w plikach innych modułów; wszystkie klikacze
zielone; **zero zmian zachowania**.

**Ryzyko:** średnie — ogromny diff, ale mechaniczny. Rób **modułami, po jednym commicie na moduł**,
nie jednym wielkim ruchem. Kolejność od najmniej sprzężonych (Truck, QA, Kontakty) do najbardziej
(Zadania, Zakupy, Kalendarz, asystent AI).

### Faza 2 — Warstwa domenowa i paginacja

**Cel:** logika testowalna bez bazy; listy, które nie pobierają wszystkiego.

**Co zrobić:**
1. W każdym module wydziel `domain/` — czyste funkcje bez Prismy i Reacta (reguły rekurencji,
   statusy, wyliczenia). Akcje stają się cienkie: autoryzacja → pobranie → wywołanie domeny → zapis
   → `revalidate`.
2. **Paginacja kursorowa** w każdym widoku listowym (`cursor` + `take`), z „doładuj" zamiast
   pobierania wszystkiego. Zacznij od Zadań, Zakupów, Magazynowania, Notatek — tam limit uderzy
   najwcześniej.

**Kryteria wyjścia:** żadne zapytanie listowe nie pobiera bez limitu; testy domenowe nie dotykają
bazy i chodzą w sekundy.

### Faza 3 — Koniec odpytywania: unieważnianie sterowane zdarzeniem

**Cel:** usunąć zagrożenie z 5.1 i przy okazji dać **prawdziwe** odświeżanie na żywo.

**Dlaczego w tej kolejności:** dopiero po Fazie 1 istnieje miejsce, w którym zdarzenie ma sens —
kontrakt modułu.

**Co zrobić:**
1. **Outbox.** Nowa tabela `DomainEvent` (`id`, `ownerId`, `module`, `type`, `payload` JSON,
   `createdAt`, `deliveredAt`). Mutacje zapisują zdarzenie **w tej samej transakcji** co zmianę
   danych — inaczej zdarzenie i stan się rozjadą.
2. **Publikacja.** Worker (już istnieje) czyta outbox i rozgłasza. **Nie** dokładaj Kafki ani
   RabbitMQ — przy tej skali `LISTEN/NOTIFY` Postgresa albo Redis Pub/Sub wystarczy i jest o rząd
   wielkości tańsze w utrzymaniu.
3. **Dostarczenie do przeglądarki.** Jedna trasa SSE (`/api/events`) **per użytkownik**, wysyłająca
   wyłącznie „moduł X się zmienił". Klient robi `router.refresh()` **tylko wtedy**.
   Wzorzec jest w repo sprawdzony — agent AI już nadaje SSE.
4. **Usuń `setInterval` z `DataFreshness`.** Zostaw odświeżenie na `visibilitychange`/`focus`
   (tanie, bo tylko przy powrocie) jako zabezpieczenie na wypadek zerwanego strumienia.
5. **Degradacja:** brak SSE (stary klient, proxy, środowisko testowe usypiające po 15 min) → wróć do
   odpytywania, ale **z interwałem 5 minut, nie 45 sekund**.

**Kryteria wyjścia:** przy bezczynnej karcie **zero** zapytań w tle; zmiana na jednym urządzeniu
widoczna na drugim w < 2 s; wyłączenie SSE nie psuje aplikacji.

**Ryzyko:** średnie. Trwałe połączenia + środowisko testowe usypiające po 15 min = **będzie
wyglądało na zepsute na `develop`, a działać na produkcji**. Zaplanuj to i opisz w dokumentacji,
inaczej stracisz dzień na diagnozowanie „awarii", której nie ma.

### Faza 4 — Skala i koszt

**Co zrobić:**
1. **Współdzielony rate-limit** — przenieś `src/lib/ai/rateLimit.ts` na Redis (albo tabelę
   z atomowym `INSERT … ON CONFLICT DO UPDATE`, jeśli nie chcemy dokładać Redisa).
   **Zostaw ten sam interfejs** — zmienia się implementacja, nie miejsca wywołań.
2. **Budżety AI:** miesięczny limit kosztu per użytkownik + globalny wyłącznik w `Config`
   + widoczne w `/admin/llm`. Przekroczenie = uprzejmy komunikat, nie błąd 500.
3. **Pula połączeń:** `connection_limit` w `DATABASE_URL`, pgbouncer w trybie transakcyjnym,
   audyt zapytań N+1 w widokach agregujących (Kalendarz, pulpit, `ModuleSnapshotGrid`).
4. **Cache per użytkownik** dla agregatów (pulpit, kalendarz) z unieważnianiem przez zdarzenia
   z Fazy 3 — dopiero teraz to jest możliwe i bezpieczne.
5. **Retencja:** zadanie okresowe czyszczące `UserActivity`, `AuditLog` (zostaw dłużej — to ślad
   audytowy), `AiMessage`, `NewsArticle`, `ItemHistory`. Retencja konfigurowalna w `/admin/config`.

**Kryteria wyjścia:** limit trzyma przy N instancjach (test integracyjny z dwoma procesami); istnieje
budżet, którego nie da się przekroczyć; pulpit nie robi więcej niż kilku zapytań.

### Faza 5 — Obserwowalność i rozdzielenie procesów

1. **Logi strukturalne** (JSON: `userId`, `module`, `action`, `durationMs`, `outcome`) — bez PII
   w treści.
2. **Metryki:** czas akcji (percentyl 95), błędy per moduł, głębokość kolejki, koszt AI per doba,
   liczba aktywnych strumieni SSE. Wystaw na `/admin/health`, który dziś liczy tylko stan bieżący.
3. **Rozdziel procesy** web / worker / cron (rozdział 6.6).

### Faza 6 — Wielojęzyczność

1. `next-intl` (App Router, wsparcie dla komponentów serwerowych).
2. **Wyciągnij teksty mechanicznie**, moduł po module, do `messages/pl.json`. Polski zostaje
   językiem źródłowym.
3. **Zaktualizuj konstytucję: C-32 przestaje znaczyć „teksty po polsku w kodzie", a zaczyna znaczyć
   „teksty przez `t()`, polski jako źródło".** Bez tej zmiany kolejne sesje będą przywracać stary
   wzorzec, bo tak każe im konstytucja.
4. Waluta, daty, liczby, strefy czasowe przez `Intl`. Uwaga: `userTime.ts` już czyta strefę
   z ciasteczka — to zostaje i jest dobre.
5. **Nie tłumacz jeszcze na inne języki.** Cel fazy to *możliwość*, nie zawartość.

### Faza 7 — Gotowość produkcyjna

1. **Kopie zapasowe i próba odtworzenia** — nie „Neon ma PITR", tylko **przeprowadzona** próba
   odtworzenia opisana w `docs/devops/`.
2. **Eksport i usunięcie danych użytkownika** (RODO — przy 100 tys. kont w UE to obowiązek prawny,
   nie funkcja).
3. **Strony błędów i stany puste** w każdym module — testerzy zobaczą je wcześniej niż cokolwiek
   innego.
4. **Budżet wydajnościowy** w CI: rozmiar paczki JS, czas pierwszego renderu.

---

## 8. Model integracji międzymodułowej — sedno produktu

To najważniejszy rozdział techniczny, bo dotyczy tego, co czyni Omnię Omnią: **każdy moduł umie
współpracować z każdym**.

### 8.1. Trzy rodzaje integracji i trzy różne mechanizmy

Dziś wszystkie trzy są realizowane tak samo — bezpośrednim wywołaniem. To błąd, bo mają różne
wymagania:

| Rodzaj | Przykład w Omnii | Mechanizm docelowy | Dlaczego ten |
|--------|------------------|--------------------|--------------|
| **Odczyt** — „pokaż mi dane innego modułu" | Kalendarz agreguje 6 modułów; asystent czyta wszystkie | **Kontrakt** (`contract.ts`) — synchroniczne wywołanie funkcji | Musi być spójny w tej chwili; brak danych = pusty widok, nie awaria |
| **Reakcja** — „gdy tam się coś stanie, zrób coś tutaj" | Zakończenie zakupów → wpis w Portfelu; niski stan magazynu → pozycja w Zakupach | **Zdarzenie** (outbox) | Nadawca nie może znać odbiorców — inaczej każdy nowy odbiorca wymaga zmiany nadawcy |
| **Zdolność** — „potrafię coś, z czego korzystają inni" | Kosz, powiadomienia, załączniki, AI, kalendarz | **Usługa platformy** | Jedna implementacja, wiele modułów; to nie jest integracja modułów, tylko wspólna infrastruktura |

### 8.2. Kontrakt modułu — kształt

```ts
// src/modules/tasks/contract.ts — JEDYNE, co widzą inne moduły
export interface TaskSummary { id: string; title: string; dueAt: Date | null; done: boolean; }

/** Zadania z terminem w zakresie — używa Kalendarz. */
export function tasksInRange(ownerId: string, from: Date, to: Date): Promise<TaskSummary[]>;

/** Utworzenie zadania z innego modułu (np. z pomysłu Pogody). */
export function createTaskFromModule(input: { ownerId: string; title: string; source: ModuleRef }): Promise<string>;

/** Zdarzenia, które ten moduł publikuje — kontrakt dla nasłuchujących. */
export type TaskEvent =
  | { type: "task.completed"; taskId: string; ownerId: string }
  | { type: "task.overdue"; taskId: string; ownerId: string };
```

**Reguła:** kontrakt zwraca **własne, wąskie typy**, nigdy modeli Prismy. Wypuszczenie modelu Prismy
przez kontrakt sprawia, że zmiana kolumny w jednym module psuje trzy inne — czyli dokładnie to,
przed czym granica ma chronić.

### 8.3. Rejestracja modułu — jedna deklaracja zamiast ośmiu list

```ts
// src/modules/tasks/module.ts
export default defineModule({
  id: "tasks",
  label: "Zadania",                  // klucz i18n po Fazie 6
  permission: "module.tasks",
  routes: ["/tasks"],
  icon: CheckSquare,
  dashboard: () => import("./ui/DashboardCard"),
  calendar: (ownerId, range) => tasksInRange(ownerId, range.from, range.to),
  ai: { actions: taskAiActions, readTools: taskReadTools },
  subscribes: { "shopping.completed": onShoppingCompleted },
});
```

**Efekt do zmierzenia:** dodanie modułu nr 22 = **jeden katalog + jedna deklaracja**. Dziś to osiem
miejsc. To jest liczba, którą warto pokazać jako wynik przebudowy.

### 8.4. Uwaga o asystencie AI

Asystent jest **najsilniej sprzężonym elementem systemu** — zna wszystkie akcje, wszystkie odczyty
i wszystkie moduły. Po Fazie 1 jego katalog musi być **składany z deklaracji modułów**, a nie
utrzymywany ręcznie. Bramki (`check:actions`, `check:ai-coverage`) zostają — ale zamiast pilnować
ręcznej listy, będą pilnować, że każdy moduł zadeklarował swoje akcje. **Migruj asystenta jako
ostatni**, gdy wszystkie moduły mają już `module.ts`.

---

## 9. Spójność backend → frontend → UI/UX

Przebudowa ma być **pionowa**, nie tylko serwerowa.

### 9.1. Warstwy i ich odpowiedzialności

| Warstwa | Odpowiada za | Czego NIE robi |
|---------|--------------|----------------|
| `domain/` | reguły biznesowe | nie zna Prismy, Reacta, sesji |
| `actions/` | autoryzacja, transakcja, zdarzenia, `revalidate` | nie zawiera reguł biznesowych |
| `app/` (trasy) | sesja, pobranie danych, render | nie zawiera logiki |
| `ui/` | prezentacja i interakcja | nie woła bazy |
| `platform/` | wspólne zdolności | nie zna modułów |

### 9.2. Spójność UI — czego brakuje dziś

Aplikacja ma dobry motyw (zmienne CSS, skórki) i jednolitą powłokę, ale **nie ma systemu
komponentów**. Ten sam wzorzec (nagłówek strony, stan pusty, potwierdzenie, formularz) jest pisany
od nowa w każdym module — stąd rozjazdy w rodzaju „układ dziwnie wygląda" czy „gwiazdki nie widać".

**Do zrobienia w Fazie 1 lub 2:**
1. **Ukończyć `src/platform/ui/`** jako jedyne źródło prymitywów: `PageHeader`, `EmptyState`,
   `ConfirmDialog`, `DataList`, `Toolbar`, `Field`. Część już jest w `components/ui/home` —
   dokończyć i wymusić użycie.
2. **Kontrakt widoku modułu:** każdy moduł ma nagłówek, pasek widoku (filtry + gwiazdka ulubionych
   + skróty) i treść. Dzięki temu spec 043 nie musiałby wybierać między „gwiazdka w pasku bocznym"
   a „przebudowa 20 nagłówków" — pasek widoku istniałby jako wspólny element. **To jest konkretny,
   udokumentowany dług, który ta przebudowa spłaca.**
3. **Stany brzegowe obowiązkowe:** ładowanie, pusto, błąd, brak uprawnień — jako część kontraktu
   widoku, nie dobra wola autora.

### 9.3. Spójność UX

- **Jeden wzorzec nawigacji po widoku** (filtry w adresie — wprowadzone w 043, teraz uczynić
  obowiązkowym dla nowych modułów przez `defineModule`).
- **Jeden wzorzec skrótów** (rejestr z 043 — rozszerzyć o skróty deklarowane przez moduł).
- **Jeden wzorzec akcji zbiorczych i potwierdzeń** — dziś każdy moduł robi je po swojemu.

---

## 10. Umiędzynarodowienie — dlaczego teraz albo nigdy

Wyciągnięcie tekstów z ~200 komponentów jest **liniowe względem rozmiaru kodu** i **niezależne od
liczby użytkowników**. Każdy tydzień zwłoki to więcej tekstów do wyciągnięcia. Przy zamrożonym
repozytorium to praca mechaniczna, którą Claude Code wykona modułami. Przy aktywnym rozwoju to
nieustanne konflikty i teksty wracające do kodu.

**Zakres w tej przebudowie:** wyłącznie **infrastruktura + polski**. Żadnych tłumaczeń.
**Sygnał kontrolny:** jeśli po Fazie 6 dodanie języka to praca tłumacza, a nie programisty — cel
osiągnięty.

---

## 11. Bezpieczeństwo i prywatność przy 100 tys. kont

1. **Izolacja najemcy to funkcja krytyczna, nie „dobra praktyka".** Test generowany z manifestu
   (Faza 0, punkt 2) jest najważniejszym testem w systemie.
2. **RODO** — eksport i usunięcie danych na żądanie (Faza 7). Przy koncie w UE to obowiązek prawny.
3. **Klucze API** są szyfrowane i maskowane — zostaje bez zmian.
4. **Ograniczanie nadużyć** — dziś limitowane jest AI; przy otwartej rejestracji limitu wymagają też
   rejestracja, zaproszenia i wysyłka.
5. **Audyt** obejmuje RBAC i konfigurację. Przy 100 tys. kont warto objąć nim też operacje
   administratora na danych użytkownika.

---

## 12. Koszty — rząd wielkości

| Pozycja | Dziś | Po przebudowie przy 100 tys. | Uwaga |
|---------|------|------------------------------|-------|
| Hosting | 1 instancja płatna | 2–4 instancje web + 1 worker | Rozdzielenie procesów |
| Baza | Neon | Neon z pulą + replika odczytu | Sharding dopiero przy Progu C |
| Redis | brak | mały | Limity + pub/sub; opcjonalny, da się bazą |
| LLM | grosze | **największa pozycja** | Bez budżetów: nieprzewidywalna |
| Obserwowalność | brak | mała | Bez niej diagnozowanie jest zgadywaniem |

**Najważniejsza obserwacja kosztowa:** po przebudowie największym kosztem operacyjnym **nie będzie
hosting, tylko LLM**. Dlatego budżety AI (Faza 4) mają priorytet równy technicznym zagrożeniom P0.

---

## 13. Nazwa wersji

**Propozycja: `Omnia 2.0 „Fundament"`.**

Uzasadnienie: dla użytkownika ta wersja **nie dodaje ani jednej funkcji** — i to jest jej uczciwy
opis. Zmienia to, na czym wszystkie przyszłe funkcje staną. Nazwa „Fundament" mówi wprost, czym była
ta praca, i będzie zrozumiała za rok, przy czytaniu historii wersji.

Warianty: `2.0 „Granice"` (celniejsze technicznie, mniej czytelne), `2.0 „Skala"` (mylące — sugeruje,
że chodzi o ruch, a chodzi o strukturę).

---

## 14. Czego NIE robić — lista rzeczy odradzanych wprost

1. **Nie rozbijaj na mikroserwisy.** Rozdział 6.2.
2. **Nie wprowadzaj event sourcingu jako modelu danych.** Rozdział 6.3. Outbox ≠ event sourcing.
3. **Nie dokładaj Kafki/RabbitMQ.** Postgres `LISTEN/NOTIFY` albo Redis wystarczy o rząd wielkości.
4. **Nie skracaj interwału odpytywania.** Zmiana 45 s → 10 s to czterokrotny wzrost obciążenia i
   zero postępu. Odpytywanie ma **zniknąć**, nie przyspieszyć.
5. **Nie rób Fazy 1 jednym commitem.** Moduł po module, każdy osobno, każdy z zielonymi klikaczami.
6. **Nie łącz refaktoru ze zmianą funkcji.** Jeśli podczas przenoszenia zobaczysz błąd — napraw
   go **osobnym** commitem, przed albo po, nigdy w tym samym.
7. **Nie usuwaj bramek jakości**, nawet gdy zaczną przeszkadzać w refaktorze. Zamiast tego dostosuj
   je do nowej struktury — one są powodem, dla którego ta przebudowa jest w ogóle wykonalna.
8. **Nie buduj rzeczy z Progu C** (sharding, regiony, repliki). Architektura ma je *umożliwiać*,
   nie *zawierać*.

---

## 15. Kolejność prac — checklista dla Claude Code

Każdy punkt to osobny przebieg pipeline'u. Uruchamiaj `/specify` z treścią punktu.

| # | Faza | Zadanie | Blokuje |
|---|------|---------|---------|
| 1 | 0 | Klikacz ścieżki szczęśliwej dla 21/21 modułów | wszystko |
| 2 | 0 | Generowany test izolacji najemcy z manifestu akcji | wszystko |
| 3 | 0 | Bramka rozjazdu `schema.prisma` ↔ migracje | — |
| 4 | 1 | `src/platform/` — przeniesienie wspólnych zdolności | 5 |
| 5 | 1 | `src/modules/<x>/` — moduł po module, od najmniej sprzężonych | 6 |
| 6 | 1 | `contract.ts` + reguła ESLint zakazująca importów przez granicę | 7 |
| 7 | 1 | `defineModule` + wyprowadzenie rejestru, uprawnień, nawigacji, pulpitu, kalendarza | 8 |
| 8 | 1 | Migracja asystenta AI na katalog składany z deklaracji modułów | 9 |
| 9 | 2 | `domain/` + testy domenowe bez bazy | — |
| 10 | 2 | Paginacja kursorowa we wszystkich widokach listowych | — |
| 11 | 3 | Tabela `DomainEvent` + zapis w transakcji z mutacją | 12 |
| 12 | 3 | Publikacja zdarzeń przez worker (`LISTEN/NOTIFY`) | 13 |
| 13 | 3 | SSE `/api/events` + usunięcie `setInterval` z `DataFreshness` | — |
| 14 | 4 | Współdzielony rate-limit (Redis/DB) | — |
| 15 | 4 | Budżety kosztu AI per użytkownik + globalny wyłącznik | — |
| 16 | 4 | Pula połączeń + audyt N+1 w widokach agregujących | — |
| 17 | 4 | Cache agregatów unieważniany zdarzeniami | po 13 |
| 18 | 4 | Retencja `UserActivity`/`AiMessage`/`NewsArticle`/`ItemHistory` | — |
| 19 | 5 | Logi strukturalne + metryki na `/admin/health` | — |
| 20 | 5 | Rozdzielenie procesów web / worker / cron | — |
| 21 | 6 | `next-intl` + wyciągnięcie tekstów modułami + zmiana C-32 | — |
| 22 | 7 | Eksport i usunięcie danych użytkownika (RODO) | — |
| 23 | 7 | Próba odtworzenia z kopii zapasowej, opisana w runbooku | — |
| 24 | 7 | Budżet wydajnościowy w CI | — |

**Punkty 1–3 są bezwarunkowo pierwsze.** Refaktor bez siatki bezpieczeństwa to nie refaktor, tylko
przepisywanie z nadzieją.

---

## 16. Odpowiedź w jednym akapicie

Nie przepisujemy Omnii na nową architekturę, bo obecna nie jest zła — jest **niedokończona
w warstwie, której świadomie jeszcze nie budowano**. Event sourcing i CRDT odpadają nie dlatego, że
użytkowników jest mało (będzie ich dużo), tylko dlatego, że **dane Omnii są prywatne per
użytkownik**, więc sto tysięcy kont to sto tysięcy niezależnych małych zbiorów, a nie jeden wielki
problem współbieżności. Mikroserwisy odpadają, bo zabiłyby integrację międzymodułową, która **jest
produktem**. Robimy **modularny monolit z twardymi granicami**: moduły przestają się nawzajem
importować i dostają kontrakty, zdarzenia i jedną deklarację rejestrującą — dzięki czemu dodanie
modułu nr 22 kosztuje tyle, co dodanie modułu nr 2. Równolegle domykamy cztery zagrożenia, które
przy stu tysiącach kont są blokujące, a przy dwóch niewidoczne: odpytywanie co 45 sekund z każdej
karty, rate-limit trzymany w pamięci pojedynczego procesu, brak twardego budżetu na model językowy
i brak konfiguracji puli połączeń. Wielojęzyczność wchodzi teraz, bo jej koszt rośnie z każdym
tygodniem i nie da się jej odrobić przy żywym ruchu. Całość dzieli się na osiem faz, z których
pierwsza to wyłącznie testy — bo refaktor bez siatki bezpieczeństwa nie jest refaktorem.
$raport_arch_docelowa$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "content"=EXCLUDED."content","title"=EXCLUDED."title","updatedAt"=CURRENT_TIMESTAMP;
