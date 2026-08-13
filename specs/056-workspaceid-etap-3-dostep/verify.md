# Weryfikacja: rozstrzyganie dostępu czyta przestrzeń — etap 3A

Spec: `spec.md` · Plan: `plan.md` · Zadania: `tasks.md` · Data: 2026-08-12

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:migrations` | ✅ bez nowej migracji; numeracja bez kolizji |
| `check:actions` | ✅ **160** |
| `check:ai-coverage` | ✅ **551** |
| `check:cost-badge` | ✅ **35** |
| `check:content-memory` | ✅ **35** |
| `check:ui-contract` | ✅ 21/21 |
| `check:schema-drift` | ✅ zielony |
| `check:boundaries` | ✅ |
| `check:module-registry` | ✅ dziewięć kontroli |
| `check:workspace-mirror` | ✅ |
| `check:workspace-fill` | ✅ 45/45 tabel |
| `check:test-types` | ✅ |
| `tsc --noEmit` | ✅ przed buildem |
| `test:unit` | ✅ **690/690** (było 689 — nowa kolumna i wiersz tabeli prawdy) |
| `next lint --dir src` | ✅ |
| `npm run build` | ✅ **exit 0** (lokalny Postgres, C-13) |

Liczniki **160 / 551 / 35 / 35** bez spadku.

## 2. Kryteria akceptacji

**AC-1 — przestrzeń osobista, bez dodatkowego zapytania.** ✅
Wiersz „właściciel projektu" w tabeli prawdy bez ruchu na wszystkich dotychczasowych kolumnach
własnego projektu. `queryCount.integration.test.ts` → „właściciel rozstrzyga się BEZ pytania
o nadania" nadal zielony, bez korekty oczekiwań.

**AC-2 — zespół tylko przy zadeklarowanym `teamOwnership`.** ✅
Zadania deklarują `teamOwnership`, więc członek przestrzeni zespołu dostaje `editor`,
właściciel/admin `manager`. Gałąź kończy się `return null`, gdy deklaracji nie ma —
sama obecność przestrzeni nie przyznaje nic. `guest` jawnie **nic**.

**AC-3 — 25 komórek, jedna zmieniona i nazwana z góry.** ✅ **z zastrzeżeniem, które jest treścią
tego przebiegu:**

`diff` punktu odniesienia (`specs/052…/baseline-dostep.json`) pokazuje **dokładnie jedną** zmienioną
wartość:

```
<     "projekt zespolowy: odczyt/edycja": "odmowa",      ← wiersz „wlasciciel projektu"
>     "projekt zespolowy: odczyt/edycja": "dozwolone",
```

To jest **właściciel zespołu bez wiersza `TeamMember`** — przypadek opisany w specu §5 **przed**
przełączeniem. Pozostałe **24 komórki bez ruchu**. Reszta diffa to wyłącznie dopisana kolumna
i wiersz z AC-4.

> **Pierwszy przebieg tabeli był zielony i bezwartościowy.** Fixture tworzy użytkowników wprost
> przez Prismę, z pominięciem logowania — nie mieli więc przestrzeni, wyzwalacz nie miał czego
> wpisać, a rozstrzyganie schodziło **gałęzią awaryjną** na `ownerId`. Test dowodził, że stara
> reguła jest zgodna sama ze sobą. Po założeniu przestrzeni w fixture wyszła prawdziwa różnica.
> Gdyby nie to sprawdzenie, przebieg zostałby zamknięty z „zerem zmian" — czyli fałszem.

**AC-4 — zasób bez przestrzeni.** ✅
Nowa kolumna „projekt bez przestrzeni (sierota)": **właściciel → dozwolone**, wszyscy pozostali →
odmowa, w tym obcy i członkowie zespołu. Nowy wiersz „wlasciciel bez przestrzeni" potwierdza to
z drugiej strony: taki użytkownik ma dostęp **wyłącznie** do swojego osieroconego zasobu.
Rozstrzyganie nie rzuca.

**AC-5 — liczba zapytań nie rośnie.** ✅
`queryCount.integration.test.ts` (trzy przypadki) zielony **bez zmiany oczekiwań**. Kontekst nadal
robi trzy zapytania równolegle — nowe dane weszły jako pola i złączenie w istniejącym
`workspaceMember.findMany`.

**AC-6 — bramki, build, zero zmian dla użytkownika.** ✅
Tabela wyżej. `git diff` wobec produkcji: **0 plików** w `src/app/` i `src/components/`. Zmiany
w `src/`: trzy pliki platformy, jeden `select` w module Zadań, jeden test.

**AC-7 — dziennik.** ✅ Wpis „056 — Rozstrzyganie dostępu czyta przestrzeń, etap 3A" z tabelą
zakresu 3B i etapu 4.

## 3. Zgodność z konstytucją

**C-17 ✅** — tabela prawdy policzona i porównana **przed** uznaniem zmiany za gotową; jedyne
poszerzenie dostępu **nazwane w specu z góry**, nie odkryte po fakcie. **C-21 ✅** własność.
**C-36 ✅** platforma nadal nie importuje modułu; katalog parametrem wymaganym. **C-54 ✅** — spec
poprawiony po odkryciu z planowania (`Task` nigdy nie dostanie kolumny), `tasks.md` poprawione po
odkryciu z implementacji (zmiana wyszła jako zmieniona komórka, nie nowy wiersz). **C-50, C-51,
C-53 ✅**.

## 4. Regresje

- **Moduł Zadań** — guardy i read-toole chodzą przez `requireAccess`, więc objęte tą samą tabelą
  prawdy; `test:unit` obejmuje też `assistantBypass` i `tenantIsolation`, oba zielone.
- **Pozostałe 18 modułów** — nietknięte: mają własne guardy i nie mają deklaracji zasobów.
- **Zadania (`tasks.task`)** — świadomie bez `workspaceId`; ścieżka „zadanie w projekcie"
  i „zadanie bez projektu" bez ruchu w tabeli.

## 5. Werdykt

**GOTOWE.** Siedem z siedmiu kryteriów, komplet bramek, build exit 0.

Najważniejszy wynik nie jest liczbowy: **dowód omal nie okazał się pusty**. Zielona tabela prawdy
przy pierwszym przebiegu oznaczała, że nowa ścieżka w ogóle się nie wykonała — i rozpoznanie tego
było w tym przebiegu trudniejsze niż sama zmiana kodu.
