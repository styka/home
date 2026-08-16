# Weryfikacja: 072 — kanał czasu rzeczywistego (zadania 23 + 24)

- **Data:** 2026-08-15

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:realtime` (nowa) | ✅ trasa za sesją, kanały z sesji, interwał ≥ 300 s, szyna sprząta |
| `check:events` · `check:subscribers` | ✅ |
| `check:pagination` · `check:domain` | ✅ 263 / 34 — bez ruchu |
| `check:ui-contract` · `check:boundaries` · `check:module-registry` | ✅ |
| `next lint --dir src` | ✅ **0 błędów** |
| **`next build`** | ✅ **EXIT=0**; `/api/events` w tabeli tras jako dynamiczna |
| `npm run test:unit` | ✅ **896/896** (przed: 889 → **+7**) |

## 2. Kryteria akceptacji

- **AC-1** ✅ `dispatch.ts` rozgłasza **po** oznaczeniu dostarczenia; test szyny potwierdza dotarcie
  do właściwego kanału.
- **AC-2** ✅ test „sygnał nie trafia do cudzego kanału"; mutacja „rozgłaszaj do wszystkich" czerwieni.
- **AC-3** ✅ trasa zwraca **401** bez sesji; sonda 2 potwierdza, że bramka tego pilnuje.
- **AC-4** ✅ `setInterval` 45 s → `EventSource`; awaryjne 5 min; `visibilitychange`/`focus`/`pageshow`
  bez zmian.
- **AC-5** ✅ brak `EventSource`/błąd → aplikacja działa na odpytywaniu 5 min, bez komunikatu błędu.
- **AC-6** ✅ wznawianie z narastającym odstępem (2 s → 30 s), **zamknięcie po 5 próbach** —
  `EventSource` sam wznawia w kółko, więc trwała awaria musi zostać uciszona.
- **AC-7** ✅ `docs/devops/kanal-czasu-rzeczywistego.md`: usypiające środowisko testowe, szyna
  w jednym procesie, tabela „objaw → przyczyna".
- **AC-8** ✅ **cztery sondy**, każda z właściwym komunikatem.
- **AC-9** ✅ liczniki bez spadku, +7 testów, build zielony.

## 3. Przebieg mutacyjny

4 mutacje na szynie, **4 złapane**: rozgłaszanie do wszystkich kanałów · martwe odsubskrybowanie ·
wielokrotny sygnał do jednej karty · błąd słuchacza przerywający rozgłaszanie.

## 4. Czego weryfikacja nie obejmuje — nazwane wprost

**Trasy SSE nie testujemy integracyjnie.** Wymagałaby sesji i utrzymania strumienia, a repo nie ma
na to wzorca (ta sama granica co w 071). Jej niezmienniki — sesja, kanały z sesji, użycie
`kanalyDla` — pilnuje bramka, i to jest świadomy podział, nie przeoczenie.

## 5. Co poszło nie tak i zostało naprawione

**Build padł, mimo że wszystkie sprawdzenia były zielone.** Iteracja `for…of` po `Set` wymaga
`downlevelIteration`, bo główny `tsconfig.json` nie ustawia `target` — a `tsconfig.test.json` ma
`ES2022` i tego nie łapie. `check:test-types` przechodziło, `next build` nie.

Do tego pomyłka proceduralna: pierwszy build czytałem przez `tail -3`, a Next wypisuje tabelę tras
także po porażce — więc „wyglądał" na udany. **Wynik czytamy z kodu wyjścia.** Obie rzeczy zapisane
w `doświadczenia.md`.

## 6. Werdykt

**GOTOWE.** Zadania 23 i 24 spełnione, build EXIT=0, 896/896, 22 bramki zielone.
