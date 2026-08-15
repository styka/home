# Weryfikacja: 069 — warstwa `domain/`

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-15

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:actions` | ✅ 160 akcji, wszystkie z egzekutorem i kontraktem |
| `check:ai-coverage` / `check:access` | ✅ 553 akcji z zakresem i guardem |
| `check:cost-badge` | ✅ 35 plików |
| `check:content-memory` | ✅ 35 plików |
| `check:migrations` | ✅ (brak nowych migracji — przebieg nie rusza schematu) |
| `check:ui-contract` | ✅ 22/22 modułów |
| `check:schema-drift` | ✅ brak rozjazdu — **dowód, że baza nietknięta** |
| `check:boundaries` | ✅ 4 przypadki |
| `check:module-registry` | ✅ 21 modułów |
| `check:workspace-mirror` / `-fill` | ✅ 3 pliki / 45 tabel |
| `check:ownership-scope` | ✅ |
| `check:grant-mirror` | ✅ |
| `check:versioning` | ✅ |
| `check:ai-access` | ✅ 16 modułów |
| `check:pagination` | ✅ 263 — zapadka z 068 trzyma |
| **`check:domain` (nowa)** | ✅ 16 plików reguł z testami · 21/21 modułów · zapadka 34 |
| `tsc --noEmit -p tsconfig.test.json` | ✅ czysto |
| `next lint --dir src` | ✅ **0 błędów** (ostrzeżenia `exhaustive-deps` — zastane, poza zakresem) |
| `next build` | ✅ **exit 0** |
| `npm run test:unit` | ✅ **873/873** (było 749 → **+124**) |

Wszystko przeciw **lokalnemu** Postgresowi (C-13). `migrate.js` nie uruchamiany.

## 2. Kryteria akceptacji

### AC-1 — klasyfikacja wszystkich 55 pomocników ✅
Tabela w `plan.md` §3.1: **21 reguł** (z powodem każda) + **34 adaptery** (zgrupowane w cztery
kategorie z uzasadnieniem). Weryfikacja liczbowa niezależna od klasyfikacji: po wyprowadzeniu
licznik pokazał **dokładnie 34**, czyli 55 − 21. Suma się zgadza, nic nie zginęło ani nie policzyło
się podwójnie.

### AC-2 — reguła importowalna + test z przypadkiem brzegowym ⚠️ CZĘŚCIOWO
16 plików reguł, **każdy** ma test (4–16 przypadków, razem 124). Ale weryfikacja **testem
mutacyjnym** — zepsucie reguły i sprawdzenie, czy test to zauważy — wykazała **trzy miejsca, gdzie
test przechodzi mimo zepsutej reguły**:

| Mutacja | Wynik | Znaczenie |
|---------|-------|-----------|
| ABC: próg klasy A `80` → `90` | ❌ **niezłapana** | fikstura (800/150/50) daje udziały 80/95/100, więc przy progu 90 klasyfikacja wychodzi identyczna. Próg **nie jest przypięty** |
| ABC: próg klasy B `95` → `99` | ❌ **niezłapana** | jw. |
| Opieka: brzeg `next > endDate` → `>=` | ❌ **niezłapana** | test „termin dokładnie w dacie końca" używa `endDate` o 23:59, a termin wypada o 10:00 — więc nie trafia w brzeg, który miał sprawdzać |

Pozostałe osiem mutacji **złapanych poprawnie**: martwy zapas z zerowym stanem, cel tygodniowy bez
sufitu 7, godziny bez wiodącego zera, klucz dnia (południe → północ), `NaN` → górna granica, pusta
trasa → 0, pora bez godzin bez zachowania zapasowego, koniec okresu = początek, ikona liczona
w jednostkach UTF-16.

To jest dokładnie ryzyko nazwane w `spec.md` §9 („test, który niczego nie dowodzi") i wychodzi
tylko przy sprawdzeniu, czy test **umie** zaświecić na czerwono.

### AC-3 — testy bez bazy ✅
Postgres **zatrzymany** (`pg_ctlcluster 16 main stop`, `pg_isready` → *no response*), uruchomione
124 testy warstwy reguł: **124 pass / 0 fail, 1,9 s**. Zgodne z rozdz. 10.1 („w milisekundach").

### AC-4 — czystość warstwy egzekwowana ✅
Kontrola 1 bramki, 9 zakazanych wzorców. Sonda: import `@/platform/db` do reguły → **exit 1**
z komunikatem wskazującym plik i powód. Druga sonda: `"use server"` w regule → **exit 1**.

### AC-5 — plik reguł bez testu wywala build ✅
Sonda: `qa/domain/bezTestu.ts` bez testu → **exit 1** ze wskazaniem oczekiwanej ścieżki testu.

### AC-6 — manifest 21/21 ✅
`src/lib/domain-coverage.json`: domena 9 · reguły w `lib/` 7 · bez reguł 5 = **21**. Trzy sondy:
moduł usunięty z manifestu → błąd; wpis dla nieistniejącego modułu → błąd; decyzja niezgodna ze
stanem na dysku (`habits` jako „bez-regul" mimo katalogu `domain/`) → błąd.

### AC-6b — zapadka ✅
Kontrola 4, próg **34**. Sonda w górę: dodany pomocnik w pliku akcji → **exit 1** („35, próg to 34").
Sonda w dół: próg podniesiony do 40 → **exit 1** z żądaniem obniżenia do 34. Obie strony działają.

### AC-7 — każdy niezmiennik zobaczony na czerwono osobno ✅
**Siedem sond**, siedem właściwych komunikatów, repo czyste po każdej. Wyszczególnione w AC-4/5/6/6b.

### AC-8 — zmiany kształtu wymuszone testowalnością ✅
Dwie reguły (nie trzy — `plan.md` §3.2 sprostowany w trakcie, bo `nextDueFrom` parsuje `endDate`,
a nie czyta zegara): `monthRange(offset, teraz = new Date())` i
`resolveWhen(f, opts, teraz = new Date())`. Wartość domyślna sprawia, że **wywołanie w akcji jest
znakowo identyczne** — potwierdzone diffem plików akcji. Obie mają test wywołania bez parametru.
Trzecia zmiana kształtu, nieprzewidziana w planie: `roundedBrief` **stracił nieużywany pierwszy
parametr** (`Forecast`) — ciało korzystało wyłącznie z wybranej pory.

### AC-9 — liczniki nie spadają ✅
`160 / 553 / 35 / 35` bez ruchu; zapadka paginacji 263 bez ruchu; testy **749 → 873**; build zielony.

### AC-10 — zero zmian widocznych dla użytkownika ✅
`git diff --stat origin/master...HEAD` dla `src/app/**`, `src/components/**`, `modules/*/ui/**`
i `prisma/**` → **pusto**. Dodatkowy dowód, mocniejszy niż diff: ciała 9 z 11 wyprowadzonych reguł
są **znakowo identyczne** z oryginałami (po usunięciu komentarzy i białych znaków); dwie różnice to
`slugify` (tylko nawiasy wokół `||`, semantyka bez zmian) i `resolveWhen` (parametr z AC-8).

## 3. Zgodność z konstytucją

- **C-01** ✅ wyłącznie `worldofmag/` (+ artefakty w `specs/`, zgodnie z C-03).
- **C-10..C-14** ✅ bez zmian w schemacie i bez migracji; `check:schema-drift` zielony.
- **C-20** ✅ liczba `revalidatePath` w każdym z 15 dotkniętych plików akcji **identyczna** przed i po.
- **C-21** ✅ liczba guardów (`requireAuth` / `assert*Access` / `requireAccess`) **identyczna** przed
  i po we wszystkich 15 plikach. Żadna decyzja o dostępie nie opuściła akcji — wszystkie pomocniki
  dostępowe są asynchroniczne i dotykają bazy, więc nie kwalifikowały się do warstwy.
- **C-22..C-25** ✅ nietknięte.
- **C-30..C-32** ✅ brak UI; komunikaty bramki po polsku.
- **C-36** ✅ `domain/` to wnętrze modułu, importowane ścieżką względną, poza kontraktem. Dwa pliki
  przekrojowe w `platform/` — `grep "@/modules/"` na nich zwraca zero. **Wyłapane i naprawione
  w trakcie:** pierwsza wersja testu QA importowała `slugify` z Kuchni ścieżką względną, co przemknęłoby
  obok reguły lintu (pilnuje aliasów `@/modules/*`). Zastąpione porównaniem wartości po obu stronach.
- **C-50** ✅ nowa bramka w `build`; wszystkie istniejące zielone.
- **C-51** ✅ trzy lekcje w `doświadczenia.md`.
- **C-53** ✅ trzy rzeczy świadomie niezrobione, każda z powodem w manifeście: brak przenoszenia 33
  plików z `lib/`, brak ujednolicenia dwóch slugów, brak naprawy `startOfToday`.
- **C-54** ✅ trzy sprostowania artefaktów w trakcie: `nextDueFrom` nie czyta zegara (plan §3.2),
  reguły `lib/` już przetestowane (spec §1), reguły pisane bez nazwy poza pomiarem (spec AC-1 + plan).

## 4. Regresje

- **Baza:** brak migracji, `check:schema-drift` zielony.
- **Sąsiednie moduły:** `test:unit` 873/873, w tym testy integracyjne (izolacja najemcy, tabele
  prawdy, odwołanie dostępu, lustra przestrzeni i nadań) — wszystkie zielone.
- **Wspólne pliki:** `src/lib/recurrence.ts` nietknięty (wołany przez Zadania i Zwierzęta) — Zwierzęta
  importują go teraz przez własną regułę, Zadania bez zmian.
- **`roundedBrief`:** utrata nieużywanego parametru dotyczy **jednego** wywołania (`weather.ts:500`),
  sprawdzone `grep`-em. Pamięć treści AI (038) liczy odcisk z tych samych wartości co przed zmianą —
  potwierdzone testem stabilności odcisku.
- **Nieużywana zmienna `teamIds` w `portfel/actions/portfel.ts:18`** — **zastana**, nie wprowadzona
  przez ten przebieg (jest w `origin/master`). Odnotowana, nietknięta (C-53).

## 5. Werdykt końcowy

**DO POPRAWY** — jedno kryterium (**AC-2**) spełnione częściowo.

Wszystkie bramki są zielone, wszystkie pozostałe AC spełnione, a przebieg jest bezpieczny
(zero zmian dla użytkownika, guardy i `revalidatePath` nietknięte). Braki dotyczą **jakości trzech
testów**, nie kodu reguł — ale są to dokładnie te progi, dla których reguły warto było wyprowadzać,
więc test, który ich nie pilnuje, nie realizuje celu przebiegu.

### Braki do naprawienia
1. **Test ABC nie przypina progu 80** (`magazynowanie/domain/__tests__/analityka.test.ts`) — fikstura
   daje udziały 80/95/100, więc przesunięcie progu na 90 niczego nie zmienia. Potrzebna pozycja
   o udziale narastającym **między 80 a 90**.
2. **Test ABC nie przypina progu 95** — jw., potrzebny udział między 95 a 99.
3. **Test brzegu `endDate`** (`pets/domain/__tests__/terminOpieki.test.ts`) — „termin dokładnie
   w dacie końca" nie trafia w brzeg (`endDate` o 23:59 vs termin o 10:00). Potrzebny `endDate`
   **równy co do milisekundy** wyliczonemu terminowi, żeby rozróżnić `>` od `>=`.

Dodatkowo (wynikające z tych braków, ta sama zmiana): **dopisać do `tasks.md` zadanie testu
mutacyjnego jako stałego elementu weryfikacji reguł**, bo to on je wykrył.
