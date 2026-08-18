#!/usr/bin/env bash
# 091 (zadanie 41, Faza 8) — PRÓBA ODTWORZENIA CAŁEJ BAZY Z KOPII.
#
# Runbooki PITR (`runbook-deploy-rollback.md`) i przywracania własności (`przywrocenie-wlasnosci.md`)
# istniały już wcześniej. Brakowało jednej rzeczy i to ona była treścią zadania 41: **nikt nigdy nie
# odtworzył całej bazy**. Procedura nieprzećwiczona jest hipotezą — a moment, w którym się ją
# sprawdza, to zawsze najgorszy możliwy moment.
#
# Co ten skrypt naprawdę dowodzi (i czego NIE dowodzi) — patrz
# `docs/devops/proba-odtworzenia-z-kopii.md`. W skrócie: dowodzi, że zrzut logiczny tej bazy da się
# odtworzyć do pustej instancji BEZ utraty wiersza, i mierzy, ile to trwa. Nie dowodzi poprawności
# PITR-u w Neonie, bo tego nie da się przećwiczyć poza Neonem.
#
# Uruchamiaj WYŁĄCZNIE na lokalnym Postgresie (C-13). Skrypt sam odmawia, gdy zobaczy zdalny host.
set -euo pipefail

ZRODLO="${DATABASE_URL:-}"
if [[ -z "$ZRODLO" ]]; then
  echo "✖ Brak DATABASE_URL." >&2
  exit 1
fi
if [[ "$ZRODLO" != *"127.0.0.1"* && "$ZRODLO" != *"localhost"* ]]; then
  # Skrypt tworzy i kasuje bazy. Na produkcji byłoby to nieodwracalne, więc odmowa jest twarda,
  # a nie ostrzeżeniem z pytaniem „czy na pewno" — na to drugie zawsze ktoś odpowie „tak".
  echo "✖ DATABASE_URL nie wskazuje na localhost. Próby odtworzenia NIE wykonuje się na zdalnej bazie (C-13)." >&2
  exit 1
fi

KATALOG="${KATALOG_PROBY:-/tmp/omnia-proba-odtworzenia}"
mkdir -p "$KATALOG"
ZRZUT="$KATALOG/zrzut.dump"
BAZA_ODTWORZONA="omnia_odtworzona"

# Tabele, których liczność porównujemy. Świadomie NIE wszystkie: te niosą dane, których utrata
# byłaby nieodwracalna (treść użytkownika, własność, ślad audytowy), więc różnica choćby o jeden
# wiersz jest tu porażką próby, a nie szumem.
TABELE=(User Workspace WorkspaceMember ResourceGrant TaskProject Task Note ShoppingList Item Recipe Pet HealthEvent WalletEntry AuditLog)

psql_zrodlo() { psql "$ZRODLO" -tAq -c "$1"; }

echo "── 1/5 Liczności PRZED zrzutem"
declare -A PRZED
for t in "${TABELE[@]}"; do
  PRZED[$t]=$(psql_zrodlo "SELECT count(*) FROM \"$t\";" || echo "brak")
  printf '   %-18s %s\n' "$t" "${PRZED[$t]}"
done

echo "── 2/5 Zrzut logiczny (format custom, żeby dał się odtworzyć równolegle)"
START=$(date +%s)
pg_dump -Fc -f "$ZRZUT" "$ZRODLO"
KONIEC_ZRZUTU=$(date +%s)
echo "   $(du -h "$ZRZUT" | cut -f1) w $((KONIEC_ZRZUTU - START)) s"

echo "── 3/5 Świeża, PUSTA baza docelowa"
# Odtworzenie do bazy, w której coś już jest, przechodzi także wtedy, gdy zrzut jest niepełny —
# stare wiersze zostają i próba wygląda na udaną. Dlatego baza musi być pusta.
psql "$ZRODLO" -q -c "DROP DATABASE IF EXISTS \"$BAZA_ODTWORZONA\";" 2>/dev/null \
  || psql "${ZRODLO%/*}/postgres" -q -c "DROP DATABASE IF EXISTS \"$BAZA_ODTWORZONA\";"
psql "${ZRODLO%/*}/postgres" -q -c "CREATE DATABASE \"$BAZA_ODTWORZONA\";"
CEL="${ZRODLO%/*}/$BAZA_ODTWORZONA"

echo "── 4/5 Odtworzenie"
START_ODTW=$(date +%s)
# `pg_restore` DOMYŚLNIE POMIJA BŁĘDY i kończy się kodem 0, wypisując tylko „errors ignored on
# restore". Odkryła to sonda tej próby: zrzut bez danych jednej tabeli odtworzył się „pomyślnie",
# łamiąc cztery klucze obce. Sprawdzenie samych liczności by to złapało, ale ostrzeżenie w środku
# logu jest wcześniejszym i mocniejszym sygnałem — więc czytamy je wprost.
LOG_ODTW="$KATALOG/pg_restore.log"
pg_restore --no-owner --no-privileges -j 4 -d "$CEL" "$ZRZUT" >"$LOG_ODTW" 2>&1 || true
KONIEC_ODTW=$(date +%s)
echo "   odtworzone w $((KONIEC_ODTW - START_ODTW)) s"
if grep -q "errors ignored on restore" "$LOG_ODTW"; then
  echo "   ✖ pg_restore zgłosił błędy (pełny log: $LOG_ODTW):"
  grep -E "^pg_restore: (error|warning)" "$LOG_ODTW" | head -5 | sed "s/^/     /"
  ROZJAZD_ODTW=1
else
  ROZJAZD_ODTW=0
fi

echo "── 5/5 Porównanie liczności"
ROZJAZD=$ROZJAZD_ODTW
for t in "${TABELE[@]}"; do
  PO=$(psql "$CEL" -tAq -c "SELECT count(*) FROM \"$t\";" || echo "brak")
  if [[ "${PRZED[$t]}" != "$PO" ]]; then
    printf '   ✖ %-18s przed=%s po=%s\n' "$t" "${PRZED[$t]}" "$PO"
    ROZJAZD=1
  else
    printf '   ✓ %-18s %s\n' "$t" "$PO"
  fi
done

# Migracje: baza odtworzona musi znać tę samą historię, inaczej pierwsze wdrożenie po odtworzeniu
# spróbuje zastosować migracje, które już są w danych.
M_PRZED=$(psql_zrodlo "SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL;")
M_PO=$(psql "$CEL" -tAq -c "SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL;")
if [[ "$M_PRZED" != "$M_PO" ]]; then
  echo "   ✖ historia migracji: przed=$M_PRZED po=$M_PO"
  ROZJAZD=1
else
  echo "   ✓ historia migracji     $M_PO"
fi

echo
if [[ "$ROZJAZD" -ne 0 ]]; then
  echo "✖ PRÓBA NIEUDANA — odtworzona baza różni się od źródła. Nie kasuję bazy „$BAZA_ODTWORZONA\": jest dowodem."
  exit 1
fi
echo "✓ PRÓBA UDANA. Zrzut: $((KONIEC_ZRZUTU - START)) s, odtworzenie: $((KONIEC_ODTW - START_ODTW)) s."
echo "  Baza „$BAZA_ODTWORZONA\" zostaje do obejrzenia; skasuj ją ręcznie, gdy nie będzie potrzebna."
