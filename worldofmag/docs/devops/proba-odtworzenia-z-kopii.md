# Próba odtworzenia bazy z kopii

> 091 (zadanie 41, Faza 8; rozdz. 12.5). Uzupełnia `runbook-deploy-rollback.md` (PITR w Neonie)
> i `przywrocenie-wlasnosci.md` (074 — przywracanie własności po `DROP COLUMN`).

## Czego brakowało

Runbooki opisujące odtwarzanie istniały od dawna. Brakowało jednej rzeczy i to ona była treścią
zadania 41: **nikt nigdy nie odtworzył całej bazy**. Procedura nieprzećwiczona jest hipotezą,
a moment, w którym się ją weryfikuje, to zawsze najgorszy możliwy moment.

## Próba przećwiczona

```bash
cd worldofmag
export DATABASE_URL="postgresql://omnia:omnia@127.0.0.1:5432/omnia_dev"
bash scripts/proba-odtworzenia.sh
```

Skrypt: liczy wiersze w 14 tabelach niosących dane nieodwracalne → robi zrzut logiczny
(`pg_dump -Fc`) → tworzy **pustą** bazę → odtwarza (`pg_restore -j 4`) → porównuje liczności
**i historię migracji** → podaje czasy.

Trzy decyzje w skrypcie, każda z powodem:

- **Baza docelowa musi być pusta.** Odtworzenie do bazy, w której coś już jest, przechodzi także
  wtedy, gdy zrzut jest niepełny — stare wiersze zostają i próba wygląda na udaną.
- **Historia migracji jest porównywana osobno.** Baza odtworzona bez `_prisma_migrations` wygląda
  poprawnie, dopóki pierwsze wdrożenie po odtworzeniu nie spróbuje zastosować migracji, których
  skutki już są w danych.
- **Odmowa przy zdalnym `DATABASE_URL` jest twarda**, nie pytaniem „czy na pewno" — skrypt tworzy
  i kasuje bazy, a na pytanie zawsze ktoś odpowie „tak" (C-13).

Przy nieudanej próbie skrypt **nie kasuje** bazy odtworzonej: jest dowodem do obejrzenia.

## Co ta próba dowodzi, a czego nie

| Dowodzi | Nie dowodzi |
|---|---|
| Zrzut logiczny tej bazy odtwarza się **bez utraty wiersza** | Poprawności PITR-u w Neonie — tego nie da się przećwiczyć poza Neonem |
| Schemat i historia migracji przechodzą w całości | Czasu odtworzenia produkcyjnego wolumenu (lokalnie danych jest mniej) |
| Znamy **czasy** zrzutu i odtworzenia, więc RTO nie jest zgadywane | Że kopia w ogóle istnieje — to jest ustawienie Neona, nie kodu |

**Wniosek, który warto zapisać wprost:** próba lokalna sprawdza *nasz* format danych i *naszą*
procedurę. Kopia zapasowa produkcji jest usługą Neona i jej istnienie trzeba sprawdzić w panelu
Neona (retencja PITR na planie, z którego korzystamy), a nie w tym repozytorium.

## Odtworzenie produkcji — kolejność kroków

1. **Nie kasuj niczego.** Neon PITR tworzy nową gałąź z punktu w czasie; oryginał zostaje.
2. Utwórz gałąź PITR na moment **sprzed** awarii (panel Neona → Branches → Restore).
3. Podłącz do niej **osobną** usługę Rendera (`OMNIA_ROLE=web`, ten sam obraz) i sprawdź dane
   oczami, zanim cokolwiek przełączysz.
4. Sprawdź `/api/health` (200 + `role`) i `/admin/health`: liczba migracji, pula połączeń,
   diagnostyka zapytań.
5. Dopiero potem przełącz `DATABASE_URL` usługi produkcyjnej na nową gałąź.
6. **Po przełączeniu** uruchom próbę odtworzenia lokalnie na zrzucie z nowej gałęzi — żeby wiedzieć,
   że stan po awarii nadal da się odtworzyć.

## Kiedy powtarzać

- po każdej migracji zmieniającej **kształt własności** (jak 0243/0244),
- po zmianie planu Neona (retencja PITR jest cechą planu),
- raz na kwartał, nawet gdy nic się nie zmieniło — procedura psuje się od nieużywania.
