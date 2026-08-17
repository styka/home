-- Raport dla administratora: przegląd kodu przebudowy architektury + plan domknięcia.
--
-- Seedowany idempotentnie (ON CONFLICT DO NOTHING po unikalnym `slug`) zgodnie z konwencją
-- raportów z CLAUDE.md. Treść to markdown renderowany przez `markdownToHtml` w /reports.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "storage", "authorId", "teamId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Przebudowa architektury — przeglad kodu i plan domkniecia',
  'przebudowa-architektura-przeglad-domkniecie',
  $raport$# Przebudowa architektury — przegląd kodu i plan domknięcia

> **Po co ten raport.** Przebudowa Omnii do architektury docelowej jest w połowie: 22 z 46 zadań
> checklisty domknięte, 9 w toku, 15 nietkniętych. Ten dokument nie powtarza dziennika przebudowy
> (rozdz. 15) — jest **przeglądem kodu, który w tej przebudowie powstał**, i listą rzeczy do
> poprawienia albo dokończenia. Ustalenia posortowano od najgroźniejszego; każde ma scenariusz
> skutku, bo bez niego „warto by poprawić" jest nieodróżnialne od czepiania się.

---

## 1. Ustalenia — od najgroźniejszego

### U-1 · Kontekst dostępu jest cache'owany na żądanie, a od 076 ma się co unieważniać ⛔

**Gdzie:** `src/platform/sharing/cache.ts` · `src/platform/workspaces/zapis.ts`

Cache kontekstu dostępu (052) uzasadniono zdaniem, które stoi w komentarzu do dziś: *„skoro cache
żyje z żądaniem, **nie ma czego unieważniać** — problem nie powstaje, zamiast być rozwiązywany"*.
To była prawda, dopóki nic w trakcie żądania nie zmieniało członkostwa ani przestrzeni.

Od 076 zmienia: `przestrzenOsobista()` **tworzy** brakującą przestrzeń osobistą wraz z wierszem
`WorkspaceMember`. Kontekst policzony wcześniej w tym samym żądaniu ma nadal `personalWorkspaceId:
null` i pusty zbiór ról.

**Scenariusz awarii:** użytkownik bez przestrzeni (konto tuż po utworzeniu albo rozjazd lustra)
wykonuje akcję, która zapisuje rekord i zaraz potem sprawdza do niego dostęp — typowy „utwórz
i pokaż". Zapis się uda (przestrzeń powstanie), ale sprawdzenie dostępu policzy się ze starego
kontekstu, w którym ta przestrzeń nie istnieje → **użytkownik dostaje odmowę do zasobu, który sam
przed chwilą utworzył**. Ratuje przed tym dopiero siatka „właściciel = manager" przywrócona w 075 —
czyli awaria jest dziś zamaskowana przez inną poprawkę, a nie naprawiona.

**Propozycja:** dodać do cache'u jawne `uniewaznijKontekst(userId)` i wołać je w `przestrzenOsobista`
po utworzeniu przestrzeni. Zaktualizować komentarz uzasadniający cache — w obecnym brzmieniu jest
nieprawdziwy i to on najbardziej myli, bo zniechęca do szukania problemu.

---

### U-2 · Producent zdarzeń może po cichu nie wyemitować zdarzenia ⛔

**Gdzie:** `src/modules/shopping/actions/lists.ts` (`completeShopping`) ·
`src/modules/magazynowanie/actions/storage.ts`

Oba miejsca mają kształt:

```ts
const przestrzen = await workspaceIdDlaZdarzenia(list.workspaceId, user.id);
await prisma.$transaction(async (tx) => {
  await tx.shoppingList.update({ ... });
  if (przestrzen) { await emitDomainEvent(tx, { ... }); }   // <- ciche pominięcie
});
```

Gdy `przestrzen` jest `null`, mutacja przechodzi, a **zdarzenie nie powstaje** — więc nie powstaje
też żadna reakcja międzymodułowa. Nikt się o tym nie dowie: nie ma wyjątku, nie ma logu, a operacja
z punktu widzenia użytkownika się udała.

W Zakupach dokłada się do tego druga niespójność: `zlecono` liczone jest **niezależnie** od tego, czy
zdarzenie poszło. Akcja zwraca `zlecono: true`, asystent mówi „zlecono zaksięgowanie wydatku X zł",
a subskrybent Portfela nigdy nie dostanie zdarzenia. **Użytkownik dostaje potwierdzenie czynności,
która się nie wydarzy.**

**Stan faktyczny:** po migracji 0235 `ShoppingList.workspaceId` i `StorageItem.workspaceId` są
`NOT NULL`, więc ta gałąź jest dziś nieosiągalna. To jednak znaczy tylko tyle, że **kod nie wyraża
niezmiennika, na którym stoi** — a następna tabela z nullowalną przestrzenią (lista wyjątków ma ich
pięć) wejdzie w tę ścieżkę bez ostrzeżenia.

**Propozycja:** zamienić `if (przestrzen)` na twarde `if (!przestrzen) throw new Error(...)` z nazwą
zasobu w komunikacie, a `zlecono` wyprowadzać z faktu emisji, nie z samej intencji. Rozważyć bramkę:
każdy producent musi emitować bezwarunkowo albo mieć wpis w manifeście z powodem.

---

### U-3 · Zakres własności całej aplikacji nadal stoi na kolumnie, którą usuwamy ⚠️

**Gdzie:** `src/platform/auth/serverUtils.ts` (`ownedOrAsync`)

Po 075 funkcja zwraca dwie gałęzie: zakres po przestrzeniach oraz `{ ownerId: userId }`. Ta druga
została świadomie jako gwarancja „właściciel nigdy nie traci swojego rekordu" — ale to znaczy, że
**jedno z najczęściej wołanych miejsc w aplikacji przestanie działać w chwili `DROP COLUMN`**.

**Scenariusz awarii:** usunięcie kolumn bez równoczesnej zmiany tej funkcji wywraca **każde**
zapytanie listowe w aplikacji (`Argument ownerId is missing`), a nie tylko moduł, w którym ktoś
zapomniał poprawki. Nie jest to zagrożenie ukryte — jest natychmiastowe i głośne — ale przesądza
o **kolejności**: `ownedOrAsync` musi być poprawione w tym samym commicie, co migracja usuwająca
kolumny, nigdy wcześniej i nigdy później.

**Propozycja:** wpisać to wprost jako pierwszy krok planu z sekcji 3 i dopisać do bramki
`check-ownership-scope` kontrolę, że po usunięciu kolumn żadna gałąź nie odwołuje się do `ownerId`.

---

### U-4 · `przestrzenZespolu` zwraca przestrzeń dowolnego zespołu i nie pyta o uprawnienia ⚠️

**Gdzie:** `src/platform/workspaces/zapis.ts`

Funkcja świadomie nie sprawdza dostępu — decyzja opisana w jej komentarzu i sama w sobie słuszna
(dwa miejsca rozstrzygające o tym samym są gorsze niż jedno). Problem jest w **ergonomii**: to
publiczna funkcja platformy, która dla dowolnego `teamId` zwraca identyfikator przestrzeni gotowy do
zapisu, a nazwa niczego nie ostrzega.

**Scenariusz awarii:** nowy moduł woła `przestrzenDoZapisu(user.id, params.teamId)` z identyfikatorem
zespołu przyjętym **z formularza**, bez wcześniejszego guardu. Zapis trafia do cudzego zespołu; typ
się zgadza, bramki milczą, a rekord jest widoczny dla obcych ludzi.

**Propozycja:** wymusić kontekst w sygnaturze — np. `przestrzenZespolu(teamId, { sprawdzone: true })`
albo przyjmowanie `AccessContext` i asercja członkostwa wewnątrz. Minimum: nazwa mówiąca o braku
kontroli (`przestrzenZespoluBezKontroli`) i test kontraktowy, że żaden moduł nie woła jej
z niezweryfikowanym wejściem.

---

### U-5 · Kopia własności nie ma bramki świeżości przed `DROP COLUMN` ⚠️

**Gdzie:** `prisma/migrations/0233_kopia_wlasnosci_przed_etapem4` · `docs/devops/przywrocenie-wlasnosci.md`

Kopia jest migawką ze stanu migracji 0233. Runbook o tym mówi, ale **nic tego nie egzekwuje**.
Między 0233 a właściwym usunięciem kolumn minęły już cztery migracje i co najmniej jedna zmieniła
dane (0235 skasowała bezpańską listę), a na produkcji dojdzie ruch użytkowników.

**Scenariusz awarii:** `DROP COLUMN` wykonuje się tydzień po 0233. Rekordy utworzone w tym tygodniu
nie mają wpisu w kopii. Odtworzenie „udaje się" — bez nich, po cichu, bo procedura porównuje tylko
to, co w kopii jest.

**Propozycja:** pierwszym krokiem migracji usuwającej kolumny ma być **odświeżenie kopii** (`TRUNCATE`
+ ponowne wypełnienie z 0233) i kontrola liczności per tabela, przerywająca migrację przy rozjeździe.
To kilkanaście linii, a zamienia „pamiętaj, żeby" w gwarancję.

---

### U-6 · Szyna czasu rzeczywistego działa w jednym procesie i nikt tego nie mierzy ⚠️

**Gdzie:** `src/platform/events/bus.ts` · `src/app/api/events/route.ts` · `src/components/shell/DataFreshness.tsx`

Rozgłaszanie sygnałów żyje w pamięci jednego procesu. Jest to udokumentowane, świadome i poprawne
przy jednej instancji, a odpytywanie awaryjne co 5 minut zostało **na stałe** właśnie jako pokrycie
tego przypadku. Brakuje jednak dwóch rzeczy: (a) jakiegokolwiek **licznika** otwartych strumieni,
więc nikt nie zauważy wyczerpania połączeń, (b) sygnału w `/admin/health`, że kanał w ogóle żyje.

**Scenariusz awarii:** produkcja dostaje drugą instancję. Połowa użytkowników przestaje dostawać
sygnały; aplikacja działa, tylko „wolniej się odświeża". Objaw jest niediagnozowalny z zewnątrz
i najpewniej zostanie zgłoszony jako „czasem nie widzę zmian kolegi".

**Propozycja:** wystawić `ileSluchaczy()` na `/admin/health` razem z informacją o liczbie instancji;
w dokumentacji operacyjnej zapisać wprost, że **skalowanie poziome wymaga wcześniejszego przejścia na
`LISTEN/NOTIFY`** (rozdz. 9.4.3), a nie jest zmianą samego dockera.

---

### U-7 · `Job` ma trzy równoległe sposoby na to samo ℹ️

**Gdzie:** `prisma/schema.prisma` (`Job`) · `src/lib/db/workspace-nullable.json`

`Job` ma `ownerId`, `workspaceId` (nullowalne, z wyzwalaczem) i jest na liście wyjątków. Po decyzji
z 076 zachowuje `ownerId` na stałe — więc `workspaceId` jest tam trzecim, praktycznie nieużywanym
nośnikiem tej samej informacji. Nie szkodzi, ale każdy kolejny czytelnik będzie musiał rozstrzygnąć,
którego użyć.

**Propozycja:** rozstrzygnąć świadomie — albo usunąć `workspaceId` z `Job` (i wyzwalacz), albo
udokumentować, do czego służy (np. przyszłe budżety AI per przestrzeń — zadanie 27).

---

### U-8 · Dokumentacja goni kod ℹ️

- Tracker (rozdz. 15) trzymał zadania **39 i 40 jako niezrobione**, mimo że `actions/privacy.ts`
  (`exportMyData`, `deleteMyAccount`) i `lib/privacy/purge.ts` istnieją i mają testy. Poprawione
  w tym samym przebiegu — ale to pokazuje, że tabela statusów bywa aktualizowana wybiórczo.
- `CLAUDE.md` nie wymienia `actions/privacy.ts` na liście Server Actions.
- Zadania 44 i 45 (aktualizacja `CLAUDE.md`, konstytucji, `/admin/architecture`) stoją na 🟡 od
  wielu przebiegów.

---

## 2. Co w tej przebudowie zrobiono dobrze

Nie po to, żeby się chwalić — po to, żeby następna sesja tego nie „poprawiła".

- **Bramki zamiast dobrych chęci.** Każda reguła architektury ma skrypt, który ją egzekwuje, a kilka
  bramek **sprawdza samą siebie sondami** (`check-boundaries`, `check-workspace-nullable`). Powód
  jest praktyczny: `next lint` potrafi wyjść z kodem 0 przy niepoprawnej konfiguracji, więc bramka
  bez sondy może cicho nie działać.
- **Manifest wymuszający decyzję, nie zgadywanie.** Wzorzec z `action-coverage.json` powtórzony
  siedem razy. Bramka nie umie ocenić, czy tabela trzyma rekordy systemowe — więc żąda, żeby ktoś to
  napisał i uzasadnił.
- **Zapadki (liczniki, które mogą maleć, ale nie rosnąć)** przy paginacji i wyjątkach nullowalności.
  Padają **także przy spadku**, żeby odzyskany zapas nie został cichym kredytem.
- **Testy mutacyjne jako warunek zamknięcia.** Wielokrotnie w tej przebudowie zielony test okazywał
  się dowodem, że kod się **nie uruchomił**. Każda istotna asercja została zepsuta celowo, żeby
  sprawdzić, czy czerwienieje.
- **Procedura odtworzenia przećwiczona, nie opisana.** Realny `DROP COLUMN` w transakcji zakończonej
  `ROLLBACK`, plus przebieg z pominiętym krokiem odtworzenia — bez tego drugiego „0 rozbieżności"
  niczego by nie dowodziło.

---

## 3. Co zostało do domknięcia refaktoryzacji

### 3.1. Zadanie 11, etap 4 część 2 — usunięcie kolumn własnościowych

Największy pojedynczy kawałek. Zmierzone: **121 plików, 256 miejsc zapisu, 173 filtry**.

Kolejność, która nie wywróci aplikacji po drodze:

1. **U-1** (unieważnianie kontekstu) — najpierw, bo dotyka wszystkiego niżej.
2. Konwersja **zapisów**: `data: { ownerId: user.id }` → `data: { workspaceId: await przestrzenDoZapisu(...) }`.
   Mechaniczne dzięki `platform/workspaces/zapis.ts`, ale **weryfikowalne tylko testem** — pomyłka nie
   daje czerwonego builda, tylko rekord w cudzej przestrzeni. Moduł po module, commit po module.
3. Konwersja **filtrów** na zakres po przestrzeniach.
4. **`lib/privacy/purge.ts` osobno i ostrożnie** — czyszczenie RODO jest kluczowane po `ownerId`.
   Wymaga testu „przed i po" na porównywalnym zbiorze, nie samego `tsc`.
5. **U-3** (`ownedOrAsync`) **w tym samym commicie** co migracja.
6. Odświeżenie kopii własności (**U-5**) i dopiero potem `DROP COLUMN` na **40 tabelach**.

Pięć tabel (`ItemHistory`, `NoteGroup`, `Skin`, `Tag`, `Job`) zachowuje `ownerId` — ich wiersze mogą
nie mieć właściciela, a `workspaceId` nie wyraża wtedy ani własności, ani unikalności
(`UNIQUE(ownerId, name)` przeniesione na nullowalną kolumnę przestałoby chronić rekordy systemowe,
bo w PostgreSQL `NULL` nie równa się `NULL`).

### 3.2. Zadania w toku

| # | Zadanie | Czego brakuje |
|---|---|---|
| 12 | `TaskShare`/`PetShare` → `ResourceGrant` | przełączenie odczytów czeka na **produkcyjny pomiar** rozjazdu tabela↔nadanie |
| 14 | `ShareDialog`, „Udostępnione mi" | UI współdzielenia — model danych gotowy |
| 15 | Kolumna `version` | pilotaż zrobiony, brak rozszerzenia na pozostałe moduły |
| 20 | Paginacja kursorowa | zapadka trzyma 263 zapytania bez `take`; potrzebne systematyczne schodzenie w dół |
| 25 | Subskrypcje międzymodułowe | kierunek Magazyn→Zakupy. **Wymaga decyzji właściciela**: dziś użytkownik klika „dodaj braki do listy"; przepięcie na zdarzenie zamieniłoby to w automat dopisujący pozycje. To zmiana produktowa, nie refaktor |

### 3.3. Fazy nietknięte — 13 zadań

**Faza 5 (skala i koszt):** współdzielony rate-limit, budżety AI, pula połączeń i audyt N+1, cache
agregatów, retencja danych.
**Faza 6 (obserwowalność):** logi strukturalne, metryki na `/admin/health`, rozdzielenie
`web`/`worker`/`cron`.
**Faza 7 (wielojęzyczność):** `next-intl`, wyciągnięcie tekstów, zmiana `C-32`, formatowanie `Intl`,
język przestrzeni w promptach AI.

Żadna z nich nie jest zablokowana — można je zacząć niezależnie od zadania 11.

### 3.4. Domknięcie (faza 9)

Zadania 44–46: aktualizacja `CLAUDE.md` i konstytucji, `/admin/architecture`, wpis w historii wersji.
Warto zrobić **na końcu**, ale nie zapomnieć — dziś stoją na 🟡 od wielu przebiegów.

---

## 4. Ryzyko operacyjne spoza kodu

Środowisko sesji **sześciokrotnie cofnęło drzewo robocze** do starszego commita, raz razem z bazą
danych. Nic nie przepadło wyłącznie dlatego, że każde ukończone zadanie było natychmiast wypychane
na zdalne repozytorium. Regułę „push po każdym zadaniu, nie na koniec sesji" należy traktować jako
wymóg środowiska, a nie preferencję. Objaw rozpoznawczy: zmiany znikają **hurtem**, baza cofa się do
starszej migracji, Postgres nie odpowiada. Pierwszą komendą diagnostyczną jest `git log --oneline -1`,
a nie debugowanie narzędzia, które „nagle kłamie".
$raport$,
  'architektura',
  'db',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
