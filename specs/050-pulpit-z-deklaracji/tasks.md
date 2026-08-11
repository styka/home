# Zadania: Migawka pulpitu z deklaracji

- **Plan:** ./plan.md (050-pulpit-z-deklaracji)
- **Status:** todo
- **Data:** 2026-08-11

> **Zasada nadrzędna tego przebiegu:** **najpierw dowód, potem przenosiny.** Faza A jest warunkiem
> wstępnym fazy C — bez zrzutu „przed" nie ruszamy struktury. To nie jest ostrożność, tylko powód,
> dla którego 049 tego zadania nie zrobiło.
>
> **Rytuał po każdym zadaniu:** `tsc --noEmit` · `check:actions` (**160**) · `check:ai-coverage`
> (**551**) · `check:cost-badge` (**35**) · `check:content-memory` (**35**) · `next lint --dir src` ·
> `check:module-registry` · `check:boundaries` · commit.
>
> **NIGDY `next build` ani `next dev` równolegle z klikaczami.** W 049 popełniłem ten błąd trzy razy
> i za każdym razem dostałem fałszywą diagnozę. Przed uruchomieniem czegokolwiek dotykającego
> `.next`: `ps aux | grep playwright`.
>
> **Zrzut z samymi zerami to brak dowodu, nie sukces** — pusty wynik zgadza się z pustym nawet wtedy,
> gdy przebudowa zgubi połowę wkładów (lekcja z 049).

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

---

## Faza A — DOWÓD (warunek wstępny całej reszty)

- [ ] **T-1** — **Rozszerzyć fixture o dane dla wszystkich jedenastu wkładów.**
      `scripts/fixture-calendar-surface.ts` sadzi dziś dane dla siedmiu źródeł agendy. Pulpit czyta
      inne rzeczy: pozycje listy zakupów, przypięte notatki, spiżarnię z krótkim terminem, saldo
      portfela, talie z powtórkami, braki magazynowe, raport.
      **Gotowe, gdy:** każdy z jedenastu wkładów ma w bazie dane dające **niezerowy** wynik.
      **(AC-2)**
- [ ] **T-2** — **Wyodrębnić obliczenia trasy do funkcji — CZYSTA PRZENOSINA.**
      `src/app/page.tsx` → funkcja biorąca `userId`, `permissions`, `isAdmin` **parametrem** (żadnej
      sesji w środku, jak `collectCalendarEvents`). Ta sama treść, ta sama kolejność, te same
      `try/catch` i wartości domyślne. Trasa woła ją i przekazuje wynik do `HomePage`.
      **Gotowe, gdy:** `git diff` pokazuje przenosiny, nie przepisanie; UI bez zmian. **(AC-1)**
- [ ] **T-3** — **Zrzucić punkt odniesienia.** `scripts/snapshot-ai-surface.ts` dostaje sekcję
      `pulpit` — wynik funkcji z T-2 dla użytkownika z fixture'a **oraz** dla użytkownika bez
      uprawnień (drugi zrzut to materiał do AC-5).
      **Gotowe, gdy:** `specs/050…/baseline-pulpit.json` istnieje, a wartości są **niezerowe**.
      Zrzut z samymi zerami = wróć do T-1. **(AC-2, AC-5)**

## Faza B — Kształt

- [ ] **T-4** — **Typ wkładu w platformie + pole w deklaracji serwerowej.**
      `src/platform/dashboard.ts` (`DashboardContext`, `DashboardContributor`) + pole `dashboard`
      w `ModuleServerContributions`. **Nie w `module.ts`** — lekcja z 049.
      **Gotowe, gdy:** typy istnieją, `tsc` czysty, żaden moduł jeszcze ich nie używa. **(AC-7)**
- [ ] **T-5** — **`DashboardSnapshot` + `EMPTY_SNAPSHOT` w kontrakcie Strony głównej.**
      Dokładnie te pola `HomePageProps`, które wnoszą moduły; wartości domyślne = dzisiejsze
      inicjalizatory z trasy.
      **Gotowe, gdy:** funkcja z T-2 zwraca `DashboardSnapshot` i `tsc` to potwierdza. **(AC-3)**

## Faza C — Rozbicie na wkłady (dopiero po dowodzie)

> Kolejność od najprostszego wkładu do najbardziej złożonego. Po **każdej** grupie porównanie zrzutu
> z punktem odniesienia — nie na końcu.

- [ ] **T-6** — **Wkłady jednopolowe:** Zakupy (`pendingItems`), Notatki (`pinnedNotes`),
      Portfel (`wallet`), Raporty (`recentReports`).
      Raporty **dochodzą jako nowy wkład** — trasa liczyła je wprost z Prismy, z pominięciem
      kontraktu modułu.
      **Gotowe, gdy:** cztery pola pochodzą z deklaracji, zrzut **identyczny**. **(AC-3, AC-6)**
- [ ] **T-7** — **Wkłady dwupolowe:** Kuchnia, Zwierzęta, Magazynowanie, Nauka języków.
      **(AC-3, AC-6)**
- [ ] **T-8** — **Wkłady najbardziej złożone:** Zadania (trzy pola, trzy zapytania równolegle),
      Flota (pętla po pojazdach z horyzontem 30 dni), Zdrowie.
      **Gotowe, gdy:** wszystkie jedenaście wkładów w deklaracjach, zrzut **identyczny**.
      **(AC-3, AC-6)**
- [ ] **T-9** — **Korzeń kompozycji + bramkowanie uprawnieniem z rejestru.**
      `src/lib/dashboardSnapshot.ts`: iteracja po `MODULE_SERVER`, uprawnienie z `MODULES`, wołanie
      równoległe, scalanie na `EMPTY_SNAPSHOT`, jeden `try/catch` zamiast ośmiu.
      **Gotowe, gdy:** zrzut dla użytkownika z fixture'a **identyczny**, a dla użytkownika bez
      uprawnień równy `EMPTY_SNAPSHOT`. **(AC-3, AC-5, AC-6)**
- [ ] **T-10** — **ZMIANA ZACHOWANIA (osobny commit): trasa pulpitu składa z katalogu.**
      `src/app/page.tsx` chudnie do ~70 linii; zostają dane przekrojowe (aktywność, zaproszenia,
      statystyki admina, preferencje, ulubione) z zapisanym powodem.
      **Gotowe, gdy:** `grep "@/modules/" src/app/page.tsx` zwraca **tylko** `HomePage`. **(AC-4)**

## Faza D — Domknięcie Fazy 1

- [ ] **T-11** — **Siódmy test `check:module-registry`:** trasa pulpitu nie może importować kontraktu
      modułu. Sprawdzone **testem negatywnym**.
      **Gotowe, gdy:** podłożony import → bramka czerwona; po usunięciu → zielona. **(AC-9)**
- [ ] **T-12** — **Pomiar grafu kompilacji** (`next dev`, z ciasteczkiem sesji — `middleware`
      przecina niezalogowane przed kompilacją strony).
      **Gotowe, gdy:** `/auth/signin` ≤ 1771 i `/` ≤ 1889 modułów. **(AC-7)**
- [ ] **T-13** — **Bramki końcowe:** komplet + `test:unit` + `next build` przeciw lokalnemu
      Postgresowi (C-13).
      **Gotowe, gdy:** wszystko zielone, cztery liczniki bez spadku. **(AC-8)**
- [ ] **T-14** — **Dokumentacja domknięcia Fazy 1:** `CLAUDE.md`, `constitution.md` (C-36 o polu
      `dashboard`), rozdz. 15 dziennika — **Faza 1 domknięta w całości**, odpowiedź na pytanie
      kontrolne **bez przypisu**, pierwszy krok Fazy 2 (zadanie 9: `Workspace`, `ResourceGrant`).
      Wpis do `doświadczenia.md`, jeśli po drodze wyjdzie coś nieoczywistego (C-51). **(AC-10)**

---

## Mapowanie kryteriów akceptacji

| AC | Zadania |
|---|---|
| AC-1 — obliczenia dają się zawołać jako funkcja | T-2 |
| AC-2 — punkt odniesienia zapisany PRZED zmianą | T-1, T-3 |
| AC-3 — wkład z deklaracji | T-5, T-6, T-7, T-8, T-9 |
| AC-4 — trasa bez importów modułów | T-10 |
| AC-5 — brak uprawnienia = wkład niewołany | T-3, T-9 |
| AC-6 — migawka identyczna | T-6, T-7, T-8, T-9 |
| AC-7 — graf kompilacji nie rośnie | T-4, T-12 |
| AC-8 — bramki i build | T-13 |
| AC-9 — bramka wykrywa trasę „po staremu" | T-11 |
| AC-10 — dziennik | T-14 |

## Ścieżka krytyczna

```
T-1 → T-2 → T-3  ← DOWÓD, bez niego dalej nie wolno
        ↓
T-4 → T-5 → T-6 → T-7 → T-8 → T-9 → T-10
        ↓
T-11 → T-12 → T-13 → T-14
```

**Co blokuje co:**
- **T-3 blokuje całą fazę C.** To jedyna twarda zależność i sedno przebiegu: bez zrzutu „przed"
  porównanie po zmianie nie ma z czym się zestawić, a `tsc` nie jest dowodem braku regresji dla
  jedenastu bloków obliczeń.
- **T-1 blokuje T-3** — zrzut z zerami niczego nie dowodzi.
- **T-10 to jedyna zmiana zachowania** i nie może dzielić commitu z przenosinami.
- **T-12 po T-10** — graf mierzymy na stanie docelowym.

**Zadania równoległe:** brak sensownych `[P]` — kolejne grupy wkładów dotykają tej samej funkcji
z T-2 i tego samego korzenia kompozycji.

## Notatki / blokady

- **Poza zakresem tego przebiegu** (spec §5): cała Faza 2, `requireAccess` dla read-tooli asystenta
  (wymaga zadania 10), zastany dług klikaczy — właściciel zdecydował 2026-08-11, że rozpiszemy je
  osobno i ten przebieg nie inwestuje w nie czasu.
