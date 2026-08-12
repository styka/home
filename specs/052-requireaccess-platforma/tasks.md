# Zadania: `requireAccess` — sprawdzanie dostępu jako zdolność platformy

- **Plan:** ./plan.md (052-requireaccess-platforma)
- **Status:** todo
- **Data:** 2026-08-12

> **Zasada nadrzędna tego przebiegu:** **to jest kod decydujący o dostępie do danych.** Błąd nie
> objawia się wolniejszą stroną, tylko cudzymi danymi albo zablokowaną pracą. Dlatego **tabela
> prawdy jest WARUNKIEM przełączenia, a nie podsumowaniem na końcu** — dokładnie tak, jak zrzut
> migawki w 050.
>
> **Nie poszerzamy dostępu przy okazji (AC-5).** Jeśli nowy mechanizm dałby komuś więcej niż
> dzisiejszy guard, zachowujemy dzisiejsze zachowanie i zgłaszamy rozbieżność jako ustalenie.
> Naprawa uprawnień ukryta w przebudowie uprawnień jest nie do zweryfikowania.
>
> **PUSH PO KAŻDYM ZADANIU.** Kontener zwinął już ten branch dwa razy; przetrwało wyłącznie to,
> co było wypchnięte.
>
> **Rytuał po każdym zadaniu:** `tsc --noEmit` · `check:actions` (**160**) · `check:ai-coverage`
> (**551**) · `check:cost-badge` (**35**) · `check:content-memory` (**35**) · `next lint --dir src` ·
> commit · **push**. Cztery liczniki **nie mają prawa się ruszyć** — zmienia się droga odczytu,
> nie katalog.
>
> **NIGDY `next build` ani `next dev` równolegle z klikaczami** (`ps aux | grep playwright`).
> **NIGDY builda przeciw produkcyjnej bazie (C-13).**

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

---

## Faza A — Punkt odniesienia (warunek wstępny całej reszty)

- [x] **T-1** — **Tabela prawdy DZISIEJSZEGO zachowania.**
      Test integracyjny budujący macierz **(relacja użytkownika do zasobu) × (operacja)** i zapisujący
      decyzje `assertProjectAccess` / `assertTaskAccess` do `specs/052…/baseline-dostep.json`.
      Relacje (min. 7): właściciel projektu · członek `MEMBER` · członek `ADMIN` · obcy ·
      **projekt zespołowy, użytkownik w zespole, bez członkostwa** (to jest wiersz z AC-5) ·
      zadanie w projekcie (twórca / obcy) · **zadanie bez projektu** (twórca / przypisany / obcy).
      Operacje: odczyt projektu, odczyt zadania, edycja zadania, tworzenie zadania, zmiana nazwy
      projektu, usunięcie projektu.
      **Gotowe, gdy:** plik istnieje, a **żadna** komórka nie jest „nie wiadomo" — każda to
      jednoznaczne `dozwolone`/`odmowa`. **(AC-4, AC-5)**

## Faza B — Zdolność platformy (jeszcze bez konsumenta)

- [x] **T-2** `[P]` — **`src/platform/sharing/types.ts`.**
      `ResourceRef`, `ResourceFacts` (z `parent`), `ResourceDeclaration` (`label`, `operations`,
      `children`, `resolve`, `extraGrants`), `ResourceCatalog`. Role bierzemy z istniejącego
      słownika w `platform/workspaces/types.ts` — **nie dublujemy**.
      **Gotowe, gdy:** `tsc` czysty, nic tego jeszcze nie używa. **(AC-2)**
- [x] **T-3** — **`src/platform/sharing/access.ts` — `canAccess` / `requireAccess`.**
      Cztery kroki z planu §3.1 w kolejności od najtańszego; katalog **parametrem WYMAGANYM** (bez
      wartości domyślnej — C-36); łańcuch przodków zbierany **przed** zapytaniem o nadania, żeby
      nadania czytać jednym zapytaniem; twardy limit głębokości łańcucha (ochrona przed zapętloną
      deklaracją) z własnym komunikatem błędu konfiguracji.
      **Gotowe, gdy:** `grep "@/modules/" src/platform/sharing/` → **pusto**; testy jednostkowe
      rozstrzygania ról przechodzą. **(AC-1, AC-3, AC-8)**
- [x] **T-4** — **`src/platform/sharing/cache.ts` — memoizacja per żądanie.**
      `React.cache` na dwóch odczytach: fakty o zasobie i nadania dla łańcucha.
      **Gotowe, gdy:** poza kontekstem żądania degraduje się do zwykłego wywołania **bez błędu**
      (pokryte testem — inaczej cache byłby „sprawdzony" tylko tam, gdzie i tak działa). **(AC-7)**

## Faza C — Pierwszy konsument

- [x] **T-5** — **`src/modules/tasks/sharing.ts` — deklaracja Zadań.**
      Dwa typy zasobów, mapowanie operacji na cztery role wg tabeli z planu §3.3, `children`,
      `resolve` z `parent` dla zadania w projekcie, `extraGrants` dla zadania bez projektu
      (twórca i przypisany → `editor`).
      **Własność zespołowa NIE jest mapowana** — świadomie, z powodem w komentarzu (AC-5).
      **Gotowe, gdy:** `tsc` czysty; moduł nie definiuje ani jednej własnej roli. **(AC-2, AC-5)**
- [x] **T-6** — **Korzeń kompozycji: `src/lib/sharingResources.ts` + `src/lib/sharing.ts`.**
      Leniwe wkłady modułów we własnym korzeniu (nie w `module.server.ts` — lekcja z 050) oraz
      wersja aplikacyjna dostarczająca katalog i kontekst (`teamIds`, `workspaceIds`).
      **Gotowe, gdy:** `tsc` czysty; korzeń ma dokładnie jeden wpis (Zadania). **(AC-1)**
- [x] **T-7** — **PORÓWNANIE Z PUNKTEM ODNIESIENIA — warunek przejścia dalej.**
      Ten sam test co T-1, ale liczący decyzje **nowym** mechanizmem, zestawiony z zapisanym plikiem
      **komórka po komórce**.
      **Gotowe, gdy:** macierz **identyczna**. Każda różnica jest zatrzymaniem: albo błąd
      w deklaracji, albo świadoma zmiana z zapisanym powodem — **nigdy „tak jest lepiej"**.
      **(AC-4, AC-5)**

## Faza D — Przełączenie (zmiany zachowania, osobne commity)

> Każde z tych zadań idzie **osobnym commitem**, żeby dało się wycofać samo przełączenie bez
> usuwania mechanizmu.

- [ ] **T-8** — **`assertProjectAccess` i `assertTaskAccess` wołają `requireAccess`.**
      **Sygnatury i komunikaty odmowy bez zmian** — dwadzieścia wywołań zostaje nietkniętych,
      a użytkownik widzi to samo. Z `assertTaskAccess` znika ręczne dziedziczenie.
      **Gotowe, gdy:** test z T-7 nadal zielony, `test:unit` zielony, komunikaty porównane co do
      treści. **(AC-3, AC-4, AC-10)**
- [ ] **T-9** — **Asystent: `get_task` przez `requireAccess`; zakres list z tej samej deklaracji.**
      `accessibleProjectIds` przenosi się z `lib/ai/readToolShared.ts` do modułu, żeby lista
      i sprawdzenie nie mogły się rozjechać.
      **Gotowe, gdy:** **test obejścia** (użytkownik B pyta o zadanie użytkownika A po identyfikatorze
      **i po tytule**) **widziany na czerwono** przed naprawą, potem zielony. **(AC-9)**
- [ ] **T-10** — **Pomiar liczby zapytań.**
      Licznik na `prisma.$on("query")`: właściciel (nowy ≤ stary), powtórne sprawdzenie w jednym
      żądaniu (**0**), łańcuch zadanie→projekt (**1** zapytanie o nadania).
      **Gotowe, gdy:** trzy liczby zmierzone i zapisane, żadna nie gorsza od założeń.
      **(AC-6, AC-7, AC-8)**

## Faza E — Domknięcie

- [ ] **T-11** — **Dziewiąta kontrola `check:module-registry`:** moduł z `sharing.ts` musi być wpięty
      w `src/lib/sharingResources.ts` i odwrotnie — **w obie strony**, jak przy wkładzie pulpitu.
      **Gotowe, gdy:** oba testy negatywne wykonane (plik bez wpięcia → czerwone; wpięcie bez pliku
      → czerwone), stan czysty → zielone.
- [ ] **T-12** — **Bramki końcowe:** komplet + `test:unit` + `next build` przeciw **lokalnemu**
      Postgresowi (C-13).
      **Gotowe, gdy:** wszystko zielone, cztery liczniki bez ruchu, a `git diff --stat` **nie
      pokazuje ani jednego pliku** w `src/app/` i `src/components/` — maszynowy dowód na AC-10.
      **(AC-10, AC-11)**
- [ ] **T-13** — **Dokumentacja:** `CLAUDE.md` (nowa zdolność platformy + bramka),
      `constitution.md` (reguła: dostęp do zasobu rozstrzyga platforma, moduł deklaruje operacje),
      rozdz. 15 dziennika — zadanie 10 zrobione, **co dokładnie zamienia zadanie 11** (jeden krok
      w `ResourceFacts`), oraz lista tego, co świadomie zostało (unieważnianie zdarzeniem, osiemnaście
      modułów, migracja nadań). Wpis do `doświadczenia.md` (C-51). **(AC-12)**

---

## Mapowanie kryteriów akceptacji

| AC | Zadania |
|---|---|
| AC-1 — platforma bez importu modułu, katalog parametrem wymaganym | T-3, T-6 |
| AC-2 — moduł deklaruje operacje, nie własne role | T-2, T-5 |
| AC-3 — dziedziczenie rodzic→dziecko | T-3, T-8 |
| AC-4 — tabela prawdy identyczna | T-1, T-7, T-8 |
| AC-5 — brak poszerzenia dostępu | T-1, T-5, T-7 |
| AC-6 — liczba zapytań dla właściciela nie rośnie | T-10 |
| AC-7 — powtórne sprawdzenie kosztuje zero | T-4, T-10 |
| AC-8 — nadania jednym zapytaniem | T-3, T-10 |
| AC-9 — brak obejścia przez asystenta | T-9 |
| AC-10 — zero zmian widocznych | T-8, T-12 |
| AC-11 — bramki i build | T-12 |
| AC-12 — dziennik | T-13 |

## Ścieżka krytyczna

```
T-1                          ← PUNKT ODNIESIENIA, bez niego nie wolno przełączać
  ↓
T-2 → T-3 → T-4              ← zdolność platformy
  ↓
T-5 → T-6 → T-7              ← pierwszy konsument + PORÓWNANIE
  ↓
T-8 → T-9 → T-10             ← przełączenie, osobne commity
  ↓
T-11 → T-12 → T-13
```

**Co blokuje co:**
- **T-1 blokuje T-7, a T-7 blokuje całą fazę D.** To jedyna twarda zależność i sedno przebiegu:
  bez zapisanych decyzji „przed" porównanie nie ma z czym się zestawić, a `tsc` nie jest dowodem
  poprawności kontroli dostępu.
- **T-5 przed T-6** — korzeń kompozycji nie ma czego zbierać, dopóki nie ma wkładu.
- **T-7 przed T-8** — najpierw dowód równoważności, potem podmiana guardu.
- **T-11 po T-6** — bramka pilnuje wpięcia, które musi już istnieć.
- **T-2 jest jedynym `[P]`** — typy nie zależą od niczego poza istniejącym słownikiem ról.

## Notatki / blokady

- **Poza zakresem** (spec §5): `workspaceId` na 46 modelach (zadanie 11), migracja
  `TaskProjectMember`/`TaskShare`/`PetShare` na nadania (zadanie 12), deklaracje dla pozostałych
  osiemnastu modułów, unieważnianie cache zdarzeniem (Faza 4), UI udostępniania.
- **Szew pod zadanie 11:** `ResourceFacts` ma dziś `ownerId`/`ownerTeamId`; zadanie 11 dokłada
  `workspaceId` i zmienia **krok 1–2** rozstrzygania. Ma to być zamiana jednego kroku, nie
  przepisanie — T-13 zapisuje to w dzienniku wprost.
