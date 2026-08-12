# Recenzja: `requireAccess` — sprawdzanie dostępu jako zdolność platformy

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-12 · **Diff:** 25 plików, +1543 / −36 (od końca 051)

Recenzja celowała w to, czego `verify.md` sprawdzić nie mógł: czy w kodzie decydującym o dostępie
nie ma miejsca, w którym „brak informacji" zamienia się w „wolno".

---

## Ustalenia

### 1. Projekt zespołowy niedostępny dla nikogo — zastane, ZACHOWANE — do decyzji właściciela

- **Kategoria:** obserwacja (świadomie bez poprawki)

`TaskProject` ma `ownerTeamId`, ale ani `assertProjectAccess`, ani `accessibleProjectIds` jej nie
czytają. Punkt odniesienia to potwierdził: **żaden** z pięciu wariantów użytkownika nie dostaje
dostępu do projektu należącego do zespołu — także właściciel zespołu.

**Skutek dla użytkownika:** projekt zadań utworzony jako zespołowy jest praktycznie martwy —
widoczny co najwyżej na listach, ale każda operacja kończy się odmową.

Ten przebieg **niczego tu nie zmienił i to jest właściwa decyzja**: naprawa uprawnień ukryta
w przebudowie uprawnień jest nie do odróżnienia od błędu, a tabela prawdy przestałaby cokolwiek
dowodzić. Włączenie własności zespołowej to jedna linijka w deklaracji Zadań plus wiersz w macierzy —
ale **z decyzją właściciela**, osobno.

### 2. Domyślne odpowiedzi mechanizmu są zamykające, nie otwierające — obserwacja

Przejrzałem `access.ts` pod kątem miejsc, w których brak danych mógłby dać dostęp:

| Sytuacja | Odpowiedź |
|---|---|
| nieznany typ zasobu | brak roli → odmowa |
| zasób nie istnieje (`resolve` → `null`) | brak roli → odmowa |
| operacja nieopisana w deklaracji | **odmowa** (`if (!wymagana) return false`) |
| nadanie z minionym terminem | pomijane w zapytaniu |
| deklaracja zapętlona | **błąd konfiguracji**, nie cicha odmowa |

Ostatni wiersz jest istotny: cichy `false` przy cyklu wyglądałby jak zwykły brak uprawnień
i szukano by go po stronie danych.

### 3. Dwa `OR` na jednym poziomie `where` — złapane przy pisaniu, warte odnotowania

- **Plik:** `src/platform/sharing/access.ts` (zapytanie o nadania)

Pierwsza wersja miała dwa pola `OR` w jednym obiekcie `where` (zasób z łańcucha + podmiot). Drugie
nadpisałoby pierwsze, a zapytanie **po cichu poszerzyłoby wynik** — czyli przyznało dostęp na
podstawie cudzego nadania. Poprawione na `AND: [{OR: …}, {OR: …}, {OR: …}]`, z komentarzem
wyjaśniającym dlaczego, bo to jest błąd, który wygląda niewinnie i nie wywala się.

### 4. Zadanie w projekcie nie dziedziczy dostępu po twórcy — celowe

Kuszące `ownerId: createdById` dałoby twórcy dostęp **po wypisaniu go z projektu**. Dzisiejszy
`assertTaskAccess` przy `projectId` w ogóle nie patrzy na twórcę, więc byłoby to poszerzenie.
Zapisane w komentarzu przy `resolve`, żeby następna osoba nie „naprawiła" tego jako przeoczenia.

### 5. `extraGrants` zamiast zakłamywania `ownerId` — obserwacja

Osoba przypisana do zadania bez projektu nie mieści się ani we własności, ani w nadaniu. Zamiast
zwracać ją jako `ownerId` (żeby wynik „wyszedł"), deklaracja ma jawne pole. Fakty o zasobie zostają
faktami — pierwszy audyt „kto jest właścicielem" pokaże prawdę.

### Czego NIE zgłaszam

Zero zmian schematu, zero enumów, zero nowych `AIAction`, zero zmian w UI i w sygnaturach akcji.
`revalidatePath` nietknięte. Platforma bez importu modułu; moduł bez importu korzenia kompozycji.
Testy sprzątają po sobie w `finally`.

---

## Bramki po recenzji

| Komenda | Wynik |
|---|---|
| `npm run build` (lokalny Postgres) | ✅ exit 0 |
| `npm run test:unit` | ✅ **680 / 680** |
| `check:actions` 160 · `check:ai-coverage` 551 · `check:cost-badge` 35 · `check:content-memory` 35 | ✅ bez ruchu |
| `check:module-registry` (9 kontroli) · `check:boundaries` · `check:workspace-mirror` | ✅ |
| tabela prawdy 25 komórek | ✅ identyczna |

---

## Werdykt

## **APPROVE Z UWAGAMI**

Zadanie 10 dowiezione: `requireAccess` żyje w platformie, nie zna żadnego modułu, a Zadania są jego
pierwszym konsumentem. Nadania z 051 mają wreszcie czytelnika.

Najcenniejsza w tym przebiegu jest **kolejność**. Tabela prawdy powstała przed mechanizmem, więc
przełączenie guardów było ruchem sprawdzalnym, a nie deklaracją. I ona właśnie pokazała rzecz, której
nikt nie szukał — martwe projekty zespołowe.

**Uwagi, z którymi to wypuszczamy:**
- **projekt zespołowy niedostępny dla nikogo** — zastane, zachowane co do znaku, **czeka na decyzję**;
- **AC-7 częściowo** — memoizacja obejmuje kontekst, nie fakty o zasobie; pełny pomiar przy zadaniu 11;
- **moduł woła platformę z własnym katalogiem** — poprawne, dopóki łańcuch dziedziczenia nie wychodzi
  poza moduł; granica nazwana w kodzie;
- **warianty ciche lustra przestrzeni z 051** zostają do zadania 11 — `requireAccess` czyta nadania,
  ale nie przestrzenie zasobów.

**Następny krok:** zadanie 11 — `workspaceId` na 46 modelach, w czterech etapach.
