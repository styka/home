# Plan techniczny: Zdarzenia domenowe — zapis nierozłączny z mutacją

- **Spec:** ./spec.md (070-zdarzenia-domenowe)
- **Status:** draft
- **Data:** 2026-08-15

## 1. Podejście

Nowa zdolność platformy `src/platform/events/`. Wzorcem jest **`platform/concurrency/version.ts`
z 062**: mała zdolność z jedną funkcją, która **wymusza poprawne użycie kształtem API** (tam:
`updateMany` zamiast `update`, żeby odróżnić konflikt od braku rekordu). Tu ten sam chwyt: emisja
**przyjmuje klienta transakcyjnego**. Wzorcem bramki jest `check:domain` z 069 — manifest z jawnym
rozstrzygnięciem plus test negatywny na każdy niezmiennik.

## 2. Model danych (Prisma)

```prisma
model DomainEvent {
  id          String    @id @default(cuid())
  workspaceId String
  module      String
  type        String                  // String + unia TS (C-12) — NIGDY enum Prisma
  payload     Json
  actorId     String?
  createdAt   DateTime  @default(now())
  deliveredAt DateTime?

  @@index([deliveredAt, createdAt])
  @@index([workspaceId, createdAt])
}
```

Trzy decyzje warte nazwania:

- **Brak kluczy obcych** na `workspaceId` i `actorId` — celowo, jak w `AuditLog`. Dziennik jest
  **zapisem historycznym**: skasowanie przestrzeni albo konta nie może kaskadowo usunąć śladu, że
  coś się wydarzyło. Cena: sprzątanie musi być jawne (zadanie 30).
- **`[deliveredAt, createdAt]`** — worker z zadania 22 pyta „daj najstarsze niedostarczone".
- **`id` jako klucz idempotencji (AC-10)** — powstaje przy **zapisie**, nie przy publikacji, więc
  jest **stabilny między ponowieniami**. Dzięki temu zadanie 22 nie będzie wymagało zmiany modelu.

**Migracja (C-10, C-11):** numer z `npm run next:migration` — **zmierzony: `0232`** (ostatnia
istniejąca to `0231_wersjonowanie_pilot`). Katalog `prisma/migrations/0232_domain_event/`,
ręczny `CREATE TABLE` + dwa `CREATE INDEX`. Po dodaniu `check:migrations` i `check:schema-drift`.

## 3. Zdolność platformy

### 3.1. `types.ts` — rejestr rodzajów (C-12, C-36)

Unia `DomainEventType` z trzema rodzajami. Rejestr mieszka **w platformie** i to jest **świadome
odstępstwo od C-36**: to **słownik nazw**, nie wiedza o module — platforma niczego z niego nie
importuje ani nie wywołuje. Alternatywa (rodzaj deklarowany w `module.ts`) zamieniłaby unię TS na
typ liczony w czasie działania, czyli **oddałaby jedyną kontrolę, która pilnuje rejestru za darmo**:
literówka przestałaby być błędem kompilacji. Do rewizji przy zadaniu 25.

### 3.2. `emit.ts` — emisja niemożliwa poza transakcją (AC-3)

```ts
export type TransactionClient = Prisma.TransactionClient & { $transaction?: never };

export async function emitDomainEvent(tx: TransactionClient, event: DomainEventInput): Promise<void>;
```

**`$transaction?: never` nie jest ozdobą, tylko całą siłą tego typu.** Sam
`Prisma.TransactionClient` to `PrismaClient` **pomniejszony** o kilka metod, a w typowaniu
strukturalnym obiekt z **nadmiarem** pól jest przypisywalny — więc `emitDomainEvent(prisma, …)`
przeszłoby przez kompilator. Dopisanie `$transaction?: never` odwraca to: pełny klient **ma** tę
metodę (funkcja nie jest przypisywalna do `never`), więc odpada; prawdziwy `tx` jej **nie ma**, więc
pasuje dalej. **Do sprawdzenia sondą w obie strony** — nie zakładać.

Bramka zostaje jako druga linia: typ da się obejść rzutowaniem albo zapisem wprost do tabeli,
a bramka pilnuje też tego, czego typ nie widzi — że wywołanie leży w **tej samej** transakcji.

`emitDomainEvent` **nie łapie błędów**: gdyby zapis padł, transakcja ma się wycofać razem z mutacją.
Cichy `catch` zamieniłby mechanizm w atrapę.

### 3.3. Zasób bez przestrzeni (AC-7)

**Decyzja: brak przestrzeni = POMINIĘCIE zdarzenia, nigdy błąd mutacji.** Zdarzenie jest dodatkiem
do operacji, nie jej warunkiem; wywrócenie zakupów dlatego, że nie dało się zapisać zdarzenia,
którego nikt nie czyta, byłoby regresją w zamian za nic. Konto bez przestrzeni jest **realne** —
ta sytuacja wywróciła tabelę prawdy w 056. Rozstrzygnięcie w **jednym** miejscu
(`workspaceIdDlaZdarzenia`), żeby dało się zmienić jedną zmianą (wzorzec z 057). Do rewizji przy 22.

## 4. Producenci — pomiar przed decyzją (AC-5)

**Zmierzone:** 23 wywołania `$transaction`, w **dwóch niekompatybilnych formach**:

| Forma | Ile | Czy da się emitować |
|-------|-----|---------------------|
| interaktywna `$transaction(async (tx) => …)` | **10** | ✅ ma `tx` |
| tablicowa `$transaction([...])` | **9** | ❌ **nie ma `tx`** |

Emisja z formy tablicowej wymagałaby przepisania działającej ścieżki zapisu — przy `addEntry`
w Portfelu to kod liczący saldo. Nieproporcjonalne ryzyko w przebiegu, który ma być niewidoczny.

**Trzej producenci, trzy moduły, każdy z nazwanym przyszłym odbiorcą:**

| Zdarzenie | Miejsce | Dlaczego |
|-----------|---------|----------|
| `shopping.list.completed` | `shopping/actions/lists.ts` `completeShopping` | **Kanoniczny przykład** z rozdz. 9.4.2 i 10.2. Odbiorca: księgowanie w Portfelu, dziś synchroniczne |
| `magazynowanie.stan.zmieniony` | `magazynowanie/actions/storage.ts` `adjustStorageQuantity` | Transakcja **już istnieje**. Odbiorca: uzupełnianie zapasów do Zakupów (rozdz. 9.1 wymienia wprost) |
| `kuchnia.spizarnia.spisana` | `kitchen/actions/pantry.ts` `bulkSetPantryQuantities` | Transakcja istnieje; **ładunek zbiorczy** — jedno zdarzenie na spis, nie N |

**`completeShopping` wymaga opakowania w transakcję**, której nie ma. Opakowujemy **wyłącznie**
aktualizację listy razem z emisją; `bookAutoExpense` zostaje **poza** — wciągnięcie go zmieniłoby
zachowanie przy awarii księgowania (dziś zakupy zostają zakończone), a to zmiana widoczna, której
spec zabrania i którą i tak usunie zadanie 25.

## 5. Bramka `scripts/check-events.js` — pięć kontroli

1. **Emisja tylko z transakcji** — wywołanie wewnątrz `$transaction(async (tx) => …)`, pierwszy
   argument **ten sam** `tx` (liczenie zagnieżdżenia klamr, jak `check-pagination.js`).
2. **Zapis tylko przez emisję** — `domainEvent.create` poza `emit.ts` = błąd.
3. **Rejestr kompletny** — rodzaj czytany **z wnętrza wywołania emisji**, nie z całego pliku
   (skan całego pliku łapałby `type: "shopping.list"` z `requireModuleAccess`, czyli identyfikator
   **zasobu** — bramka za szeroka daje fałszywy alarm równie skutecznie, jak za wąska daje ciszę).
4. **Manifest w obie strony** — producent bez wpisu i wpis bez producenta.
5. **Ładunek zgodny z deklaracją** — producent z `ladunek: "zbiorczy"` nie może emitować **z pętli**.

Test negatywny **osobno dla każdej** (AC-8), wzorcem `check-boundaries.js`.

## 6. Testy (AC-1, AC-2, AC-7, AC-9)

`src/platform/events/__tests__/emit.integration.test.ts`, DB-gated jak istniejące `*.integration`:
**wycofanie** (brak stanu **i** brak zdarzenia — najważniejszy), **powodzenie** (komplet pól +
`deliveredAt = null`), **brak przestrzeni** (mutacja przechodzi, nic nie rzuca), **ładunek zbiorczy**.

**Znana granica testu, do nazwania w kodzie:** testy nie wołają prawdziwych akcji, bo te wymagają
sesji, a repo nie ma wzorca jej podstawiania (C-53). Własności „jedno zdarzenie na spis" pilnuje
więc **kontrola 5 bramki**, która patrzy na prawdziwy kod producenta.

**Weryfikacja mutacyjna (AC-9)** jako warunek zamknięcia: emisja globalnym klientem, gubiony
`actorId`, brak przestrzeni udający przestrzeń, zignorowana przestrzeń, **emisja przeniesiona do
pętli**. Każda musi zaczerwienić test albo bramkę.

## 7. Pliki

| Plik | Akcja |
|------|-------|
| `prisma/schema.prisma` + `prisma/migrations/0232_domain_event/migration.sql` | model + migracja |
| `src/platform/events/{types,emit}.ts` | mechanizm |
| `src/platform/events/__tests__/emit.integration.test.ts` | testy |
| `src/modules/{shopping/actions/lists,magazynowanie/actions/storage,kitchen/actions/pantry}.ts` | producenci |
| `src/lib/events-coverage.json` · `scripts/check-events.js` · `package.json` | manifest + bramka |
| `content/architektura/15-dziennik.md` · `doświadczenia.md` | domknięcie |

**Zero zmian w `src/app/**`, `src/components/**`, `modules/*/ui/**`.**

## 8. Bramki i weryfikacja (C-50)

Lokalny Postgres (C-13). Mapowanie AC: AC-1/2/7 → testy · AC-3 → sonda `tsc` **w obie strony** ·
AC-4/6 → kontrole 2–3 + sondy · AC-5 → manifest + kontrola 4 · AC-8 → pięć sond · AC-9 → przebieg
mutacyjny · AC-10 → rozumowanie w §2 · AC-11 → liczniki + `git diff --stat`.

## 9. Ryzyka i wycofanie

- **Typ może nie wystarczyć** → sprawdzić sondą, nie zakładać; jeśli przepuszcza, wzmocnić
  (`$transaction?: never`), a nie obniżać kryterium.
- **Transakcja wokół `completeShopping`** zmienia charakterystykę zapisu → zakres ograniczony do
  dwóch operacji.
- **Ciche pominięcie przy braku przestrzeni** stanie się groźne przy 22 → jedno miejsce + obserwacja.
- **Rollback:** migracja **dodaje** tabelę; rollback samego kodu zostawia pustą tabelę bez wpływu.

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 · [x] C-20/C-21 (guardy zostają w akcjach; wszystkie pomocniki dostępowe są
  asynchroniczne i dotykają bazy, więc nie kwalifikują się do emisji) · [x] C-22..C-25 (nietknięte)
- [x] C-30..C-32 (bez UI; komunikaty PL) · [x] C-35 (trzej producenci) · [x] C-36 (odstępstwo
  nazwane w §3.1) · [x] C-50 · [x] C-51 · [x] C-53 (bez kolejki komunikatów, 9 transakcji
  tablicowych świadomie nietkniętych)
