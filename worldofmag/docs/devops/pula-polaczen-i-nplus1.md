# Pula połączeń i audyt N+1

> 084 (zadanie 28, Faza 5). Uzupełnia `runbook-deploy-rollback.md`.

## Pula połączeń

Aplikacja ustawia `connection_limit` **sama**, jeśli nie ma go w `DATABASE_URL`
(`src/platform/db/pula.ts`). Powód: domyślna wartość Prismy to `liczba_rdzeni × 2 + 1`, więc zmienia
się po każdej zmianie planu hostingu i nikt się o tym nie dowiaduje — aż baza odbije wdrożenie
komunikatem `too many connections`.

| Skąd wartość | Kiedy obowiązuje |
|---|---|
| `connection_limit` w `DATABASE_URL` | zawsze wygrywa — decyzja wpisana wprost nie jest nadpisywana |
| `DATABASE_POOL_LIMIT` (zmienna środowiskowa) | gdy w URL-u nie ma parametru |
| `5` | gdy nie ma ani jednego, ani drugiego |

Bieżący stan widać w **`/admin/health`** („Pula połączeń").

### Ile połączeń zużywa całe wdrożenie

```
instancje web × connection_limit
+ worker (ten sam proces co web — patrz zadanie 33, po nim osobny)
+ 1 na migrację wdrożeniową (`prisma migrate deploy`)
+ narzędzia otwarte ręcznie (Prisma Studio, psql)
```

Neon liczy połączenia po swojej stronie. Przy podnoszeniu liczby instancji **obniż limit na
instancję**, zamiast liczyć, że się zmieści.

### pgbouncer / pooler

Host Neona z członem `-pooler` to pula w trybie transakcyjnym. Prisma wymaga tam
**`pgbouncer=true`** w URL-u, bo tryb transakcyjny nie znosi zapytań przygotowanych.

**Aplikacja tej flagi NIE dopisuje sama.** To zmiana sposobu, w jaki produkcja rozmawia z bazą, na
podstawie fragmentu nazwy hosta — za duża decyzja jak na funkcję pomocniczą, a przy działającej
konfiguracji zepsułaby ją bez pytania. Zamiast tego brak flagi jest **zgłaszany** żółtym
ostrzeżeniem w `/admin/health`. Gdy je zobaczysz: dopisz `?pgbouncer=true` do `DATABASE_URL`
w konfiguracji środowiska (`DIRECT_URL` zostaw bez flagi — migracje idą połączeniem bezpośrednim).

## Audyt N+1

Cztery powierzchnie z rozdz. 11.4 (kalendarz, pulpit, `ModuleSnapshotGrid`, listy nadań) są
**mierzone**, nie przeglądane: `src/platform/db/__tests__/nplusjeden.integration.test.ts` liczy
zapytania i zamraża wynik w `nplusjeden-baseline.json`.

Test raportuje dwie liczby:

- **`zapytan`** — łączna liczba zapytań. Rośnie także wtedy, gdy powierzchnia dostaje nowy,
  uzasadniony wkład modułu, więc sam wzrost nie jest jeszcze błędem.
- **`powtorzenia`** — ile razy wykonano **ten sam** SQL. To jest właściwy sygnał N+1; wartość
  powyżej 1 znaczy, że coś pyta w pętli.

Zapadka pada również przy **spadku** — poprawę trzeba zapisać w progu, inaczej zapas ukryje
następny regres.

### Zakres operacji

Poza żądaniem HTTP `React.cache` nie memoizuje niczego, więc kod składany z wielu wkładów liczył
kontekst dostępu od nowa dla każdego z nich. `wZakresieOperacji` (`platform/sharing/cache.ts`) daje
ten sam zakres co żądanie, tylko wyznaczany jawnie. Owinięte są w niego: **pojedyncze zadanie
w workerze** i pomiar N+1. Kod poza żądaniem i poza tym owinięciem zachowuje się jak dawniej —
bez memoizacji.
