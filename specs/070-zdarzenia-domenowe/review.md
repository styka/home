# Recenzja: 070 — zdarzenia domenowe

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-15
- **Diff:** 17 plików, +1198 / −12 względem `origin/master`

## Zakres recenzji

Diff jest mały i skupiony: nowa tabela, dwa pliki mechanizmu, trzej producenci po kilkanaście
linii każdy, bramka, manifest, testy. Recenzja celowała w trzy pytania:

1. Czy zdarzenie na pewno **nie może** powstać niespójnie ze stanem?
2. Czy zdarzenie trafia **tam, gdzie trzeba** — bo tego nie widać, dopóki nie ma czytelnika?
3. Czy przy okazji nie zmieniło się zachowanie dla użytkownika?

## Ustalenia

### 1. `platform/events/emit.ts` — przestrzeń zdarzenia brana od AUTORA, nie od ZASOBU · correctness · **NAPRAWIONE W RECENZJI**

Pierwsza wersja `workspaceIdDlaZdarzenia(userId)` zwracała **przestrzeń osobistą klikającego**.

**Scenariusz awarii:** zespół prowadzi wspólną listę zakupów (`ShoppingList.workspaceId` =
przestrzeń zespołu). Marek kończy zakupy → zdarzenie `shopping.list.completed` zapisuje się
z `workspaceId` = **prywatna przestrzeń Marka**. Strumień zdarzeń jest strumieniem przestrzeni
(rozdz. 11.1), więc w zadaniu 23 **pozostali członkowie zespołu nigdy tego zdarzenia nie zobaczą**,
a subskrybent z zadania 25 zaksięgowałby wydatek w niewłaściwym kontekście. Nic by o tym nie
powiedziało — to jest błąd tej samej klasy, co ten, przed którym broni cały przebieg: **niewidoczny**.

Nie wyszło ani w bramce, ani w testach, bo jedno i drugie sprawdzało mechanizm, nie **źródło**
przestrzeni. Wyszło dopiero przy czytaniu diffa i pytaniu „skąd właściwie bierze się ta wartość".

**Poprawka:** wszystkie trzy zasoby mają własną kolumnę `workspaceId` (od migracji 0227), więc
sygnatura bierze ją wprost:

```ts
workspaceIdDlaZdarzenia(zasobWorkspaceId: string | null | undefined, userId: string)
```

Przestrzeń **zasobu** wygrywa; przestrzeń osobista autora zostaje wyłącznie jako zachowanie awaryjne
dla sieroty po backfillu. Producenci pobierają `workspaceId` razem z danymi, których i tak już
szukają (`list` w Zakupach, `existing` w Magazynowaniu, `item` w Kuchni) — bez dodatkowego zapytania.

**Dopisany test** `PRZESTRZEŃ BIERZE SIĘ Z ZASOBU, NIE Z AUTORA` i **sprawdzony mutacyjnie**:
usunięcie linii `if (zasobWorkspaceId) return zasobWorkspaceId;` czerwieni go (1 fail).

### 2. Fixture testowy omijał prawdziwą ścieżkę zakładania przestrzeni · correctness (test) · **NAPRAWIONE W RECENZJI**

Wyszło **przy okazji** poprawki nr 1: nowy test od razu padł, choć kod był już poprawny.

Fixture tworzył przestrzeń przez `prisma.workspace.create({ personalUserId })`. To za mało — kontekst
dostępu liczy przestrzenie z **członkostwa** (`WorkspaceMember`), więc `personalWorkspaceId`
wychodziło `null`. Skutek: **test `BRAK PRZESTRZENI` przechodził z niewłaściwego powodu** —
sprawdzał „użytkownik bez przestrzeni daje `null`", a dostawałby `null` także dla użytkownika,
który przestrzeń ma.

To jest **dokładnie ten sam błąd, który wywrócił tabelę prawdy w 056** (fixture tworzący rekordy
z pominięciem normalnej drogi ich powstawania), zapisany wtedy w `doświadczenia.md`. Powtórzył się
w innym pliku i innym przebiegu.

**Poprawka:** fixture woła `ensurePersonalWorkspace(userId)` — tę samą funkcję co aplikacja —
z komentarzem wskazującym lekcję z 056.

### 3. `completeShopping` — nowa transakcja wokół istniejącego zapisu · correctness · **CZYSTO**

Jedyny producent, u którego transakcja powstała od zera. Sprawdzone, że obejmuje **wyłącznie**
`shoppingList.update` + emisję, a `bookAutoExpense` został **poza** nią. Gdyby wpadł do środka,
awaria księgowania wycofywałaby archiwizację listy — czyli zmiana zachowania widoczna dla
użytkownika, w przebiegu, który obiecuje jej brak.

### 4. Ładunki zdarzeń nie niosą danych wrażliwych · security · **CZYSTO**

`shopping.list.completed`: id, nazwa listy, suma, liczba pozycji. `magazynowanie.stan.zmieniony`:
id pozycji, delta, stan, powód. `kuchnia.spizarnia.spisana`: liczba pozycji. Zero kluczy, zero
danych osobowych poza `actorId`, który jest istotą modelu (rozdz. 9.4.1).

### 5. Emisja nie łapie błędów · correctness · **CZYSTO I ZAMIERZONE**

`emitDomainEvent` nie ma `try/catch`. Sprawdzone, że to celowe i opisane w kodzie: cichy `catch`
zamieniłby mechanizm w atrapę — zdarzenie by przepadło, a mutacja przeszła, czyli powstałby
dokładnie ten rozjazd, któremu transakcja ma zapobiegać.

### 6. Guardy i `revalidatePath` · C-20/C-21 · **CZYSTO**

We wszystkich trzech producentach guard dostępu stoi **przed** transakcją i nie został ruszony;
`revalidatePath` bez zmian. Emisja nie sprawdza dostępu i nie może — nie ma sesji.

### 7. Odstępstwo od C-36 · convention · **ŚWIADOME, UDOKUMENTOWANE**

Unia `DomainEventType` wymienia nazwy modułów, a leży w platformie. Uzasadnienie w kodzie i w
manifeście: to słownik nazw, nie wiedza o module; przeniesienie go do `module.ts` zamieniłoby unię
TypeScript na typ liczony w czasie działania i **oddało kontrolę kompilatora**. Do rewizji przy
zadaniu 25 — sensownie, bo wtedy deklaracja subskrypcji i tak trafi do `module.ts`.

### 8. Konwencje Omnia · **CZYSTO**

Brak enumów Prisma (`type` to `String` + unia — C-12) · zero UI, więc C-30/C-31 nie dotyczą ·
komunikaty bramki i komentarze po polsku (C-32) · praca w `worldofmag/` (C-01) · zero nowych
zależności (C-53; rozdz. 9.4.3 wprost zabrania Kafki i RabbitMQ).

## Werdykt

**APPROVE Z UWAGAMI.**

Po naprawieniu ustalenia nr 1 mechanizm robi to, co obiecuje: zdarzenie powstaje **atomowo
z mutacją**, trafia do **właściwej przestrzeni**, niesie sprawcę i jest gotowe dla workera z zadania 22.
Bramki: build **exit 0**, `test:unit` **884/884**, `next lint` **0 błędów**, 20 bramek zielonych,
liczniki i zapadki bez ruchu, zero zmian w warstwie widoku.

**Naprawione w recenzji:** przestrzeń zdarzenia brana od zasobu zamiast od autora (+ test
i sprawdzenie mutacyjne) · fixture testowy zakładający przestrzeń prawdziwą ścieżką.

**Uwaga przeniesiona dalej:** ustalenie nr 1 pokazuje, czego ten przebieg **nie** mógł złapać sam.
Bramka pilnowała *gdzie* emisja stoi, testy pilnowały *czy* wiersz powstaje — a nikt nie pilnował,
**czy trafia do właściwego strumienia**, bo strumienia jeszcze nikt nie czyta. Przy zadaniu 22,
gdy czytelnik powstanie, warto dopisać test „zdarzenie zasobu zespołowego widzi drugi członek
zespołu" — dopiero on domknie tę własność od strony zachowania, a nie tylko wartości pola.
