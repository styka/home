# Weryfikacja: 070 — zdarzenia domenowe

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-15

> **Uwaga o przebiegu:** kontener został w trakcie przywrócony do stanu sprzed 050, przez co całą
> pracę 070 (kod, testy, bramkę i artefakty) trzeba było wykonać po raz drugi. Praca do 069 włącznie
> była bezpieczna na `origin`. Odtworzono wszystko, a przy okazji **wzmocniony typ z AC-3 wszedł od
> razu**, zamiast po nawrocie — więc druga wersja jest ściślejsza od pierwszej.

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:migrations` | ✅ numeracja OK (0232, następny wolny 0233) |
| `check:schema-drift` | ✅ brak rozjazdu — migracja odtwarza `schema.prisma` |
| `check:actions` | ✅ 160 akcji |
| `check:ai-coverage` / `check:access` | ✅ 553 akcji |
| `check:ui-contract` | ✅ 22/22 modułów |
| `check:boundaries` | ✅ 4 przypadki |
| `check:module-registry` | ✅ 21 modułów |
| `check:pagination` | ✅ 263 — zapadka z 068 trzyma |
| `check:domain` | ✅ 16 plików reguł · 21/21 modułów · zapadka 34 |
| **`check:events` (nowa)** | ✅ 3 producentów, każdy z transakcji i z odbiorcą · 3 rodzaje |
| `tsc --noEmit -p tsconfig.test.json` | ✅ czysto |
| `next lint --dir src` | ✅ **0 błędów** |
| `next build` | ✅ **exit 0**, „Compiled successfully" |
| `npm run test:unit` | ✅ **883/883** (przed: 879 → **+4**) |

Wszystko przeciw **lokalnemu** Postgresowi (C-13); `migrate.js` nie uruchamiany.

## 2. Kryteria akceptacji

### AC-1 — wycofanie nie zostawia zdarzenia ✅
Test `WYCOFANIE`: transakcja archiwizuje listę, emituje zdarzenie i **rzuca**. Po niej
`archived === false` **i** `domainEvent.findMany` zwraca **0 wierszy**. Sprawdzane jedno i drugie —
sam brak zdarzenia bez sprawdzenia stanu nie dowodziłby atomowości.

### AC-2 — komplet pól, niedostarczone ✅
Test `POWODZENIE`: `workspaceId`, `module`, `type`, `actorId`, `payload` (porównany `deepEqual`),
`deliveredAt === null`, `id` niepusty.

### AC-3 — zakaz wyrażony typem ✅ *(sprawdzone sondą w OBIE strony)*
`TransactionClient = Prisma.TransactionClient & { $transaction?: never }`.

| Sonda | Oczekiwane | Wynik |
|-------|-----------|-------|
| `emitDomainEvent(prisma, …)` | odrzucone | ✅ `TS2345: Argument of type 'PrismaClient<…>' is not assignable to parameter of type 'TransactionClient'` |
| `emitDomainEvent(tx, …)` wewnątrz `$transaction` | przechodzi | ✅ `tsc` czysto |

**Samo `Prisma.TransactionClient` tego NIE daje** — to `PrismaClient` pomniejszony o kilka metod,
a w typowaniu strukturalnym nadmiar pól nie przeszkadza. Zostało to zweryfikowane, nie założone.

### AC-4 — obejście typu wywala build ✅
Kontrola 2 bramki: `domainEvent.create` poza `emit.ts`. Sonda 3 → błąd ze wskazaniem pliku.

### AC-5 — producenci z pomiaru + manifest ✅
Pomiar: **23 transakcje = 10 interaktywnych + 9 tablicowych** (te drugie nie mają `tx`, więc emisja
z nich jest niemożliwa bez przepisania ścieżki zapisu — świadomie nietknięte, zapisane w manifeście).
Trzej producenci, każdy z `powod` i `przyszly-odbiorca`. Kontrola 4 pilnuje obu stron.

### AC-6 — rodzaj jako unia TS, rejestr pilnowany ✅
`DomainEventType` w `platform/events/types.ts`; `type` w bazie jest `String` (C-12 — zero enumów
Prisma). Sonda 4 (rodzaj spoza rejestru) → błąd.

### AC-7 — zasób bez przestrzeni ✅
`workspaceIdDlaZdarzenia` zwraca `null`; producent pomija emisję. Test `BRAK PRZESTRZENI`:
mutacja **przechodzi**, nic nie rzuca. Rozstrzygnięcie w **jednym** miejscu (wzorzec z 057).

### AC-8 — każdy niezmiennik na czerwono osobno ✅ — **osiem sond**

| # | Sonda | Wynik |
|---|-------|-------|
| 1 | emisja poza transakcją | ✅ wskazuje plik:linię |
| 2 | globalny klient **wewnątrz** transakcji | ✅ „emisja bierze `prisma`, a klient transakcji nazywa się `tx`" |
| 3 | zapis z pominięciem emisji | ✅ |
| 4 | rodzaj spoza rejestru | ✅ |
| 5 | emisja z **pętli** przy `ladunek: "zbiorczy"` | ✅ |
| 6 | producent bez wpisu w manifeście | ✅ |
| 7 | wpis bez producenta | ✅ |
| 8 | brak deklaracji `ladunek` | ✅ |

Repo czyste po sondach (`git status --short` pusty).

### AC-9 — weryfikacja mutacyjna ✅ — **6 mutacji, 6 złapanych**

| Mutacja | Złapana przez |
|---------|---------------|
| emisja pisze globalnym klientem | test (1 fail) |
| gubiony `actorId` | test (1 fail) |
| brak przestrzeni udaje przestrzeń | test (1 fail) |
| przestrzeń zignorowana | test (2 fail) |
| rodzaj nadpisany na stały | test (1 fail) |
| **emisja przeniesiona do pętli** | **bramka** (test tego nie widzi) |

Ostatnia jest najciekawsza i została opisana osobno w §5.

### AC-10 — kształt wystarcza zadaniu 22 ✅
`id` (`cuid()`) powstaje **przy zapisie**, nie przy publikacji, więc jest **stabilny między
ponowieniami** i posłuży subskrybentowi za klucz idempotencji przy gwarancji „co najmniej raz"
(rozdz. 9.4.4). Indeks `[deliveredAt, createdAt]` obsługuje wprost zapytanie workera „daj najstarsze
niedostarczone". Zadanie 22 nie będzie wymagało zmiany modelu.

### AC-11 — liczniki i brak zmian w UI ✅
`160 / 553 / 35 / 35` bez ruchu; zapadki **263** i **34** bez ruchu; testy **879 → 883**; build
zielony. `git diff --stat origin/master...HEAD` dla `src/app/**`, `src/components/**`,
`modules/*/ui/**` → **pusto**. Cały diff: **17 plików, +1198/−12**.

## 3. Zgodność z konstytucją

- **C-01/C-03** ✅ · **C-10/C-11** ✅ ręczna migracja 0232, numer z `next:migration` ·
  **C-12** ✅ `type` jako `String` + unia TS · **C-13** ✅ lokalna baza.
- **C-20** ✅ `revalidatePath` w producentach nietknięte. **C-21** ✅ guardy zostają w akcjach,
  **przed** transakcją; emisja nie sprawdza dostępu i nie może — wszystkie pomocniki dostępowe są
  asynchroniczne i dotykają bazy.
- **C-22..C-25** ✅ nietknięte. **C-30..C-32** ✅ bez UI, komunikaty bramki po polsku.
- **C-35** ✅ mechanizm dowieziony z **trzema** producentami, nie sam.
- **C-36** ⚠️ **świadome odstępstwo**: unia `DomainEventType` mieszka w platformie mimo nazw modułów.
  Uzasadnione w kodzie i w manifeście (słownik nazw, nie wiedza o module; alternatywa oddałaby
  kontrolę kompilatora). Do rewizji przy zadaniu 25.
- **C-50** ✅ · **C-51** ✅ dwie lekcje · **C-53** ✅ bez kolejki komunikatów (rozdz. 9.4.3 wprost),
  9 transakcji tablicowych świadomie nietkniętych.

## 4. Regresje

- **Baza:** migracja tylko **dodaje** tabelę; `check:schema-drift` zielony.
- **Sąsiednie moduły:** 883/883, w tym testy integracyjne (izolacja najemcy, tabele prawdy,
  odwołanie dostępu, lustra przestrzeni i nadań).
- **`completeShopping`:** jedyny producent, u którego powstała nowa transakcja. Zakres ograniczony
  do aktualizacji listy + emisji; `bookAutoExpense` **poza** nią, więc zachowanie przy awarii
  księgowania jest identyczne jak przed zmianą.
- **Wydajność:** każdy z trzech producentów dokłada jeden `INSERT` do istniejącej transakcji.

## 5. Werdykt końcowy

**GOTOWE.**

Wszystkie 11 kryteriów spełnione, 20 bramek zielonych, build exit 0, 883/883 testów, zero zmian
widocznych dla użytkownika.

### Co ta weryfikacja realnie wniosła

**Po pierwsze — AC-3 było niespełnione i sonda to pokazała.** Pierwszy kształt typu przepuszczał
`emitDomainEvent(prisma, …)`, mimo że cały mechanizm miał na tym stać. Gdyby weryfikacja poprzestała
na „typ jest, wygląda słusznie", przebieg dowiózłby zakaz, który nie zabrania. Poprawny ruch nie
polegał na obniżeniu kryterium do tego, co już działało, tylko na wzmocnieniu typu
(`& { $transaction?: never }`) — i to zadziałało w obie strony.

**Po drugie — test mutacyjny obnażył granicę testu, nie błąd kodu.** Przeniesienie emisji do wnętrza
pętli w prawdziwym producencie **nie czerwieni** testu integracyjnego, bo test nie woła prawdziwej
akcji (ta wymaga sesji, a repo nie ma wzorca jej podstawiania). Test sprawdzałby własną kopię pętli.
Rozwiązaniem nie był lepszy test, tylko **przeniesienie pilnowania tej własności do bramki**, która
patrzy na prawdziwy plik producenta — plus **jawne nazwanie granicy** w nagłówku testu i w manifeście.
To jest wzorzec wart zapamiętania: gdy prawdziwej ścieżki nie da się zawołać, uczciwe są dwa ruchy
naraz — nazwać granicę i przenieść dowód tam, gdzie widać prawdziwy kod.
