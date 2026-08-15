# Weryfikacja: 069 — warstwa `domain/`

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-15
- **Przebieg:** druga runda, po nawrocie do `/implement` (T-21…T-24)

> **Pierwsza runda dała DO POPRAWY** — nie z powodu bramek (wszystkie były zielone) ani kodu reguł,
> tylko dlatego, że **trzy testy przechodziły przy zepsutej regule**. Ta sekcja opisuje stan po
> naprawie; historia nawrotu jest zachowana niżej, bo to najważniejsze ustalenie całego przebiegu.

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:actions` | ✅ 160 akcji z egzekutorem i kontraktem |
| `check:ai-coverage` / `check:access` | ✅ 553 akcji z zakresem i guardem |
| `check:cost-badge` | ✅ 35 plików |
| `check:content-memory` | ✅ 35 plików |
| `check:migrations` | ✅ (zero nowych migracji) |
| `check:ui-contract` | ✅ 22/22 modułów |
| `check:schema-drift` | ✅ brak rozjazdu — **dowód, że baza nietknięta** |
| `check:boundaries` | ✅ 4 przypadki |
| `check:module-registry` | ✅ 21 modułów |
| `check:workspace-mirror` / `-fill` | ✅ 3 pliki / 45 tabel |
| `check:ownership-scope` · `check:grant-mirror` · `check:versioning` · `check:ai-access` | ✅ |
| `check:pagination` | ✅ 263 — zapadka z 068 trzyma |
| **`check:domain` (nowa)** | ✅ 16 plików reguł z testami · 21/21 modułów · zapadka 34 |
| `tsc --noEmit -p tsconfig.test.json` | ✅ czysto |
| `next lint --dir src` | ✅ **0 błędów** (ostrzeżenia `exhaustive-deps` — zastane) |
| `next build` | ✅ **Compiled successfully**, exit 0 |
| `npm run test:unit` | ✅ **879/879** (przed przebiegiem 749 → **+130**) |

Wszystko przeciw **lokalnemu** Postgresowi (C-13); `migrate.js` nie uruchamiany.

## 2. Kryteria akceptacji

### AC-1 — klasyfikacja wszystkich 55 pomocników ✅
Tabela `plan.md` §3.1: **21 reguł** + **34 adaptery** = 55. Weryfikacja niezależna: licznik po
wyprowadzeniu pokazał **dokładnie 34**. Nic nie zginęło ani nie policzyło się podwójnie.

Zapisane **ograniczenie pomiaru** (spec AC-1, uzupełnienie): liczba 55 obejmuje wyłącznie
pomocników **nazwanych**. Reguły pisane bez nazwy w ciele akcji są tak samo niesprawdzalne, a licznik
ich nie widzi — tak znalazła się analityka Magazynowania (ręcznie, nie pomiarem).

### AC-2 — reguła importowalna + test z przypadkiem brzegowym ✅ *(było ⚠️)*
16 plików reguł, każdy z testem; łącznie **130 testów**.

Dowodem nie jest liczba testów, tylko **sprawdzenie mutacyjne**: zepsuj regułę, zobacz, czy test
zauważy. **24 mutacje, 24 złapane, 0 niezłapanych:**

| Obszar | Mutacje | Wynik |
|--------|---------|-------|
| ABC — próg A (80→90, `<=`→`<`) | 2 | ✅ ✅ |
| ABC — próg B (95→99, `<=`→`<`) | 2 | ✅ ✅ |
| Martwy zapas — zerowy stan wchodzi | 1 | ✅ |
| Termin opieki — brzeg `>` → `>=` | 1 | ✅ |
| Nawyki — cel bez sufitu 7 | 1 | ✅ |
| Leki — godziny bez wiodącego zera | 1 | ✅ |
| Kuchnia — klucz dnia południe → północ | 1 | ✅ |
| Kuchnia — slug bez przycięcia do 80 | 1 | ✅ |
| Trasy TIR — `NaN` → górna granica; pusta trasa → 0 | 2 | ✅ ✅ |
| Pogoda — pora bez zachowania zapasowego | 1 | ✅ |
| Pogoda — odcisk: `tMin`, `tMax`, temp. godzinowa, opady dobowe, opady godzinowe | 5 | ✅ ×5 |
| Portfel — dług bez odwrócenia znaku; koniec okresu = początek; waluta bez wielkich liter | 3 | ✅ ✅ ✅ |
| QA — slug gubi podkreślenie | 1 | ✅ |
| Platforma — ikona w jednostkach UTF-16; tytuł: limit słów | 2 | ✅ ✅ |

### AC-3 — testy bez bazy ✅
Powtórzone po naprawkach: `pg_ctlcluster 16 main stop` → `pg_isready` = **no response** →
**130 testów, 130 pass, 1,77 s**. Zgodne z rozdz. 10.1 („w milisekundach").

### AC-4 — czystość warstwy ✅
9 zakazanych wzorców. Sonda (powtórzona w tej rundzie): import `@/platform/db` → **exit 1**.
Wcześniej też `"use server"` → exit 1.

### AC-5 — plik reguł bez testu wywala build ✅
Sonda powtórzona: `qa/domain/tmp.ts` bez testu → **exit 1**.

### AC-6 — manifest 21/21 ✅
domena 9 · reguły w `lib/` 7 · bez reguł 5. Sonda powtórzona (usunięty `notes`) → **exit 1**.
Wcześniej też: wpis dla nieistniejącego modułu → błąd; decyzja niezgodna ze stanem dysku → błąd.

### AC-6b — zapadka ✅
Próg 34. Sonda powtórzona (dodany pomocnik) → **exit 1**. Wcześniej też sonda w dół (próg 40) → błąd.

### AC-7 — każdy niezmiennik na czerwono osobno ✅
Cztery kontrole, **siedem wariantów sond** w pierwszej rundzie, **cztery powtórzone** w drugiej —
za każdym razem niezerowy kod wyjścia i właściwy komunikat. Repo czyste po sondach
(`git status --short` pusty).

### AC-8 — zmiany kształtu wymuszone testowalnością ✅
Dwie reguły z parametrem czasu (`monthRange`, `resolveWhen`), obie z wartością domyślną
`new Date()`, więc wywołanie w akcji jest **znakowo identyczne**; obie mają test wywołania bez
parametru. Trzecia zmiana, nieprzewidziana w planie: `roundedBrief` stracił **nieużywany** pierwszy
parametr. `plan.md` §3.2 sprostowany w trakcie: `nextDueFrom` **nie** czyta zegara (parsuje
`endDate`), więc zmian jest dwie, nie trzy.

### AC-9 — liczniki nie spadają ✅
`160 / 553 / 35 / 35` bez ruchu · zapadka paginacji 263 bez ruchu · testy **749 → 879** · build zielony.

### AC-10 — zero zmian widocznych dla użytkownika ✅
`git diff --stat origin/master...HEAD` dla `src/app/**`, `src/components/**`, `modules/*/ui/**`,
`prisma/**` → **pusto**. Mocniejszy dowód niż diff: ciała **9 z 11** wyprowadzonych reguł są
znakowo identyczne z oryginałami (po usunięciu komentarzy i białych znaków); dwie różnice to
`slugify` (nawiasy wokół `||`, semantyka bez zmian) i `resolveWhen` (parametr z AC-8).

## 3. Zgodność z konstytucją

- **C-01** ✅ · **C-03** ✅ artefakty w `specs/069-warstwa-domain/`.
- **C-10..C-14** ✅ zero migracji i zmian schematu; `check:schema-drift` zielony.
- **C-20** ✅ liczba `revalidatePath` **identyczna** przed i po we wszystkich 15 dotkniętych plikach akcji.
- **C-21** ✅ liczba guardów **identyczna** przed i po we wszystkich 15 plikach. Żadna decyzja
  o dostępie nie opuściła akcji — wszystkie pomocniki dostępowe są asynchroniczne i dotykają bazy.
- **C-22..C-25** ✅ nietknięte.
- **C-30..C-32** ✅ brak UI; komunikaty bramki po polsku.
- **C-36** ✅ `domain/` to wnętrze modułu (import względny, poza kontraktem); dwa pliki przekrojowe
  w `platform/` bez importu `@/modules/*`. **Wyłapane i naprawione w trakcie:** pierwsza wersja testu
  QA importowała `slugify` z Kuchni ścieżką względną — przemknęłaby obok reguły lintu, która pilnuje
  aliasów. Zastąpione porównaniem wartości po obu stronach.
- **C-50** ✅ · **C-51** ✅ **cztery** lekcje w `doświadczenia.md` · **C-53** ✅ trzy rzeczy świadomie
  niezrobione, każda z powodem w manifeście.
- **C-54** ✅ cztery sprostowania artefaktów w trakcie: `nextDueFrom` nie czyta zegara (plan),
  reguły `lib/` już przetestowane (spec §1), reguły bez nazwy poza pomiarem (spec AC-1 + plan),
  zadania T-21…T-24 dopisane po nawrocie.

## 4. Regresje

- **Baza:** zero migracji, `check:schema-drift` zielony.
- **Sąsiednie moduły:** 879/879, w tym testy integracyjne (izolacja najemcy, tabele prawdy,
  odwołanie dostępu, lustra przestrzeni i nadań).
- **Wspólne pliki:** `src/lib/recurrence.ts` nietknięty; Zadania bez zmian.
- **`roundedBrief`:** utrata nieużywanego parametru dotyczy jednego wywołania (`weather.ts:500`).
  Pamięć treści AI (038) liczy odcisk z tych samych wartości — potwierdzone testem stabilności.
- **Nieużywana zmienna `teamIds`** w `portfel/actions/portfel.ts:18` — **zastana**, obecna
  w `origin/master`, nietknięta (C-53). Odnotowana dla recenzji.

## 5. Werdykt końcowy

**GOTOWE.**

Wszystkie 11 kryteriów akceptacji spełnione, wszystkie 18 bramek zielone, build exit 0,
879/879 testów, zero zmian widocznych dla użytkownika.

### Co ta weryfikacja realnie wniosła

Pierwsza runda zakończyła się **DO POPRAWY** przy wszystkich bramkach na zielono. Gdyby
weryfikacja poprzestała na „bramki przechodzą, testy są, AC odhaczone", przebieg dowiózłby
**cztery testy, które przechodzą przy zepsutej regule** — w tym oba progi klasyfikacji ABC, czyli
dokładnie te liczby, dla których tę regułę warto było wyodrębniać.

We wszystkich czterech przypadkach winna była **fikstura, nie asercja**: wartości leżały obok
brzegu, a nie na nim (udziały 80/95/100 dokładnie w progach; `endDate` o 23:59 przy terminie
o 10:00; temperatury całkowite tam, gdzie sprawdzano zaokrąglanie). Test nazywał brzeg w tytule
i go nie dotykał.

Wniosek zapisany w `doświadczenia.md`: **„test brzegowy" to nie ten, który ma w nazwie brzeg, tylko
ten, którego fikstura leży na brzegu** — a jedyny tani sposób, żeby to stwierdzić, to zepsuć regułę
i zobaczyć czerwień.
