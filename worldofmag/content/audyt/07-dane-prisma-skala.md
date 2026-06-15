# Rozdział 7 — Model danych, Prisma, migracje, skalowanie bazy

## Kontekst / stan z kodu

Z `prisma/schema.prisma` i `prisma/migrations/`:

- **~130 modeli**, PostgreSQL (`provider = "postgresql"`, `url=DATABASE_URL`, `directUrl=DIRECT_URL` —
  pod Neon/serverless), ~24 domeny biznesowe.
- **Konwencja „zero enumów Prisma”** — potwierdzona (0 deklaracji `enum`). Statusy to `String` +
  komentarz z unią wartości (np. `Task.status // TODO | IN_PROGRESS | DONE | …`). Typowanie pilnuje
  warstwa TS.
- **Indeksy multi-tenant NIESPÓJNE.** Część modeli ma `@@index([ownerId])`/`@@index([ownerTeamId])`
  (Skin, Pet, Recipe, MealPlanEntry, PantryItem, StorageItem…), ale **kilkanaście kluczowych —
  NIE** (m.in. `ShoppingList`, `TaskProject`, `Store`, `Note` nie mają jawnego indeksu na kolumnach
  własności). To dokładnie te kolumny, po których filtruje **każde** zapytanie listujące.
- **Klucze obce / kasowanie:** 291 relacji, 183 z jawnym `onDelete` (143 `Cascade`, 39 `SetNull`, 1
  `Restrict`); ~108 bez jawnej polityki. Brak systemowej strategii integralności — przewaga
  „permisywnego” `Cascade`/`SetNull`.
- **JSON jako `String`:** ~20+ pól trzyma JSON w kolumnie tekstowej (np. `Skin.tokens`,
  `ProjectGroup.projectIds`, `Task.recurring`, `Pet.genetics`, `PetEnclosure.targetRanges`). **Brak
  typu `Json`/`JSONB`** → nie da się tego filtrować/indeksować po stronie bazy, parsowanie w aplikacji.
- **Migracje:** ~195 katalogów `NNNN_nazwa/migration.sql` (czysty SQL, deploy-only). 12 legacy
  duplikatów numeru „grandfathered” w `check-migrations.js`. `migrate.js` = `migrate deploy` z 5
  retry (zimny start Neona) + seedy (uprawnienia, LLM, QA).
- **Ograniczenia złożone:** trójpoziomowe słowniki przez `@@unique([name, userId, teamId])` (Unit,
  Category) i dedupy (`NewsItem`, `MedicationLog` itd.) — dobrze pomyślane.

## Głos Zespołu A — Strażnicy

**Marek (DBA):** „Największe ryzyko skali jest **tutaj**, nie w UI. Brak `@@index` na `ownerId`/
`ownerTeamId` w `ShoppingList`, `TaskProject`, `Note`, `Store` oznacza **full table scan** przy każdym
listowaniu. Przy 1000 wierszach nikt nie zauważy. Przy 10 mln — baza klęka. To jest **P0 zanim ruszy
marketing**, bo dokłada się liniowo z ruchem.”

**dr inż. Tomasz (architekt):** „JSON-jako-String to wygodny skrót, który zemści się przy raportach i
wyszukiwaniu. `Pet.genetics`, `targetRanges` — tego nie przeszukasz w bazie. Gdy ktoś zechce »pokaż
wszystkie gady z genem X«, robimy to w aplikacji na pełnym zbiorze. Dla pól, po których będziemy
filtrować, trzeba `JSONB` + GIN albo normalizacja.”

**Anna (security):** „`onDelete: SetNull` na własności notatek i przepisów to **cicha utrata
właściciela** — rekord zostaje, ale »osierocony«. Przy usuwaniu konta (RODO!) to się zderzy z wymogiem
twardego kasowania. Potrzebujemy świadomej polityki kasowania per encja, nie domyślności.”

**Piotr (SRE):** „Neon free tier ma limit połączeń. Bez **poolingu** (PgBouncer/Neon pooler) i
`directUrl` używanego tylko do migracji, przy ruchu marketingowym wyczerpiemy pulę połączeń w minuty.”

## Głos Zespołu B — Pionierzy

**Weronika (DBA):** „Zgoda na indeksy — to **tani, jednorazowy** P0, dosłownie kilka linii w schemacie
+ migracja. Zróbmy to hurtowo dla wszystkich kolumn własności naraz. Ale JSON-jako-String bym **nie
demonizowała**: dla 90% pól (preferencje, konfiguracje) to nigdy nie będzie przedmiotem zapytań — i
denormalizacja jest tu zaletą (jeden odczyt, zero JOIN-ów). Migrujmy do JSONB **tylko** pola, po
których realnie chcemy filtrować.”

**Sandra (architekt):** „Konwencja »zero enumów« jest OK — daje elastyczność i zero migracji przy
dodaniu statusu. Nie ruszajmy jej. Ważniejsze: **partycjonowanie i read-repliki to problem 10M+, nie
dziś**. Zaprojektujmy *ścieżkę* (klucze gotowe na sharding per `ownerId`/`ownerTeamId`), ale nie
budujmy tego na zapas dla 50 użytkowników.”

**Hubert (AI/ML):** „Skoro i tak mamy LLM — »pokaż gady z genem X« można zrobić agentem, który czyta i
filtruje. Niekoniecznie wszystko musi być zapytaniem SQL.” → *Strażnicy kontrują:* „Nie dla raportów
masowych — to byłoby drogie tokenowo i wolne. SQL do danych, LLM do języka.”

## Punkty sporne

- **Indeksy własności: P0 teraz.** Tu zespoły są zgodne — to najtańsza, najważniejsza zmiana skali.
  Bezdyskusyjne.
- **JSONB: wszystko vs wybrane pola.** **Kompromis:** migrować do `JSONB`+GIN tylko pola filtrowane
  (kandydaci: `Pet.genetics`, `NewsKnowledge`, tagi); reszta zostaje `String`.
- **Polityka kasowania: jawna wszędzie vs domyślna.** **Kompromis:** zdefiniować `onDelete` jawnie dla
  **wszystkich** relacji własności i powiązań z kontem użytkownika (pod RODO), resztę zostawić.
- **Partycjonowanie/sharding: teraz vs później.** **Konsensus:** tylko *przygotować ścieżkę* (klucze,
  brak założeń uniemożliwiających sharding), wdrożyć przy realnym 10M+.

## Głos użytkowników

**Zofia (16):** „Apka się tnie, jak mam dużo zadań.” → namacalny objaw braku indeksów/paginacji;
użytkownik czuje dług bazy jako „muli”.

## Konsensus i zalecenia

- **Z-030** *(P0 · S)* — **Dodać `@@index([ownerId])` i `@@index([ownerTeamId])` do wszystkich modeli
  multi-tenant, którym brakuje** (m.in. `ShoppingList`, `TaskProject`, `Note`, `Store`). Jedna
  migracja, ogromny zysk przy skali. Najwyższy priorytet sprzed marketingu.
- **Z-031** *(P1 · S)* — **Indeksy złożone pod realne zapytania** (np. `@@index([ownerId, status])`,
  `@@index([ownerId, dueDate])` dla zadań, `@@index([ownerId, createdAt])` dla list) — dopasowane do
  filtrów stron.
- **Z-032** *(P1 · M)* — **Wprowadzić connection pooling** (Neon pooler/PgBouncer); `DATABASE_URL` →
  pooler, `DIRECT_URL` → tylko migracje. Warunek przeżycia skoku ruchu.
- **Z-033** *(P1 · M)* — **Zdefiniować jawną politykę `onDelete` dla relacji własności i powiązań z
  `User`** (pod RODO/twarde kasowanie konta — patrz Rozdz. 8). Wyeliminować ciche `SetNull` tam, gdzie
  to tworzy sieroty.
- **Z-034** *(P2 · M)* — **Migrować do `JSONB` + indeks GIN pola, po których chcemy filtrować**
  (kandydaci: `Pet.genetics`, dane bazy wiedzy). Reszta JSON-jako-String zostaje.
- **Z-035** *(P2 · L)* — **Zaprojektować ścieżkę skalowania bazy do 100M:** read-repliki dla odczytów
  (agregaty, raporty), gotowość kluczy pod sharding per tenant; wdrożenie etapowe przy 10M+.
- **Z-036** *(P1 · S)* — **Dodać `updatedAt`/audyt spójności tam, gdzie brakuje**, i przegląd FK bez
  `onDelete` (108 relacji) pod kątem nieświadomych domyślności.
- **Z-037** *(P2 · S)* — **Skrypt diagnostyczny „wolne zapytania”** (EXPLAIN ANALYZE na typowych
  listach) jako element `/admin/health`, by mierzyć regresy wydajności bazy.

## Dobre vs złe praktyki

**Dobre:**
- Spójny wzorzec własności 3-poziomowej z ograniczeniami `@@unique` dla słowników.
- Migracje jako wersjonowany SQL + strażnik numeracji + retry na zimny start.
- Świadoma, udokumentowana konwencja „zero enumów” (elastyczność, zero migracji statusów).

**Złe / do poprawy:**
- **Niespójne indeksowanie kolumn własności** — realne ryzyko full-scanów przy skali (P0).
- JSON-jako-String także dla pól, które chcielibyśmy filtrować (brak JSONB/GIN).
- Brak jawnej, jednolitej polityki kasowania (ryzyko sierot i kolizji z RODO).
- Brak poolingu połączeń — wąskie gardło przy skoku ruchu.
