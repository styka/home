# Zadania: Zdarzenia domenowe — zapis nierozłączny z mutacją

- **Plan:** ./plan.md (070-zdarzenia-domenowe)
- **Status:** done
- **Data:** 2026-08-15

> Kolejność wymuszona zależnościami: **schemat → mechanizm → producenci → bramka → dowody**.
> Bramka nie ma czego liczyć przed producentami; producenci nie mają czego wołać przed mechanizmem.

## Legenda
`[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[P]` równolegle

## Faza 0 — Punkt odniesienia
- [x] **T-1** — Zapisz stan wyjściowy: **879** testów, liczniki 160/553/35/35, zapadki 263 i 34,
  ostatnia migracja `0231`. *Gotowe, gdy:* liczby zanotowane (bez nich AC-11 nie ma z czym porównać).

## Faza 1 — Fundament danych
- [x] **T-2** — Model `DomainEvent` + ręczna migracja `0232_domain_event` (plan §2), **bez kluczy
  obcych**. *Gotowe, gdy:* `check:migrations` i `check:schema-drift` zielone, `migrate deploy` przechodzi.

## Faza 2 — Mechanizm
- [x] **T-3** — `platform/events/types.ts`: unia `DomainEventType` (3 rodzaje) + `DomainEventModule`.
  W komentarzu **nazwane odstępstwo od C-36** i powód.
- [x] **T-4** — `platform/events/emit.ts`: `emitDomainEvent(tx, event)` z typem
  `Prisma.TransactionClient & { $transaction?: never }` + `workspaceIdDlaZdarzenia`. Bez `catch`.

## Faza 3 — Producenci (C-35)
- [x] **T-5** — **Zakupy**: `shopping.list.completed`; opakować w transakcję **tylko** aktualizację
  listy + emisję, `bookAutoExpense` zostaje poza.
- [x] **T-6** `[P]` — **Magazynowanie**: `magazynowanie.stan.zmieniony` (transakcja istnieje).
- [x] **T-7** `[P]` — **Kuchnia**: `kuchnia.spizarnia.spisana` — **jedno** zdarzenie na spis, nie N.

## Faza 4 — Testy
- [x] **T-8** — `emit.integration.test.ts`: **wycofanie** (brak stanu **i** zdarzenia), powodzenie,
  brak przestrzeni, ładunek zbiorczy. **Granica testu nazwana w kodzie** (nie wołają prawdziwych akcji).

## Faza 5 — Bramka i manifest
- [x] **T-9** — `src/lib/events-coverage.json`: producent → `zdarzenie`, `powod`,
  `przyszly-odbiorca`, `ladunek` + obserwacje (9 transakcji tablicowych, brak retencji, ciche
  pominięcie, rejestr w platformie).
- [x] **T-10** — `scripts/check-events.js`: pięć kontroli z planu §5. Rodzaj czytany **z wnętrza
  wywołania**, nie z pliku. Komunikaty PL.
- [x] **T-11** — `package.json`: `check:events` + krok w `build`.

## Faza 6 — Dowody
- [x] **T-12** — **Sondy bramki, każda osobno**: emisja poza transakcją · emisja globalnym klientem
  wewnątrz transakcji · zapis z pominięciem emisji · rodzaj spoza rejestru · producent bez wpisu ·
  wpis bez producenta · brak deklaracji ładunku · emisja z pętli przy `zbiorczy`.
- [x] **T-13** — **AC-3 sprawdzone sondą w obie strony**: `emitDomainEvent(prisma, …)` musi dać
  błąd `tsc`, a prawdziwe `tx` przejść. Wynik zapisać **zgodnie ze stanem faktycznym**.
- [x] **T-14** — **Przebieg mutacyjny**: globalny klient · gubiony `actorId` · brak przestrzeni
  udający przestrzeń · zignorowana przestrzeń · **emisja przeniesiona do pętli**. *Gotowe, gdy:*
  **0 niezłapanych**; niezłapana = poprawiamy test albo bramkę, nie wynik.

## Faza 7 — Domknięcie
- [x] **T-15** — `npm run build` + `test:unit`. Liczniki nie spadły, testów przybyło.
- [x] **T-16** — AC-11: `git diff --stat` bez zmian w `src/app/**`, `src/components/**`, `*/ui/**`.
- [x] **T-17** — Dziennik: wpis 070, status zadania 21, **co zostaje na 22–25**; przebakowanie.
- [x] **T-18** — `doświadczenia.md` (C-51).

## Mapowanie AC

| AC | Zadania |
|----|---------|
| AC-1, AC-2, AC-7 | T-8, T-14 |
| AC-3 | T-4, **T-13** |
| AC-4 | T-10 (k. 2), T-12 |
| AC-5 | plan §4, T-5…T-7, T-9, T-10 (k. 4) |
| AC-6 | T-3, T-10 (k. 3), T-12 |
| AC-8 | T-12 |
| AC-9 | T-14 |
| AC-10 | T-2 + plan §2 |
| AC-11 | T-1, T-15, T-16 |

## Ścieżka krytyczna

`T-1` → `T-2` → `T-3`/`T-4` → **`T-5`…`T-7`** → `T-8` → `T-9` → `T-10` → `T-11` →
`T-12`/`T-13`/`T-14` → `T-15` → `T-16` → `T-17`/`T-18`.

## Notatki
- Poza zakresem: publikacja (22), SSE (23), `DataFreshness` (24), subskrypcje (25), retencja (30),
  etap 4 zadania 11 i etap 2 zadania 12.
- **9 transakcji w formie tablicowej świadomie nietkniętych** — emisja wymagałaby przepisania
  działającej ścieżki zapisu, w tym `addEntry` liczącego saldo.
