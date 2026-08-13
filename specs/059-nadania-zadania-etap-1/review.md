# Recenzja: udostępnienia Zadań jako nadania — zadanie 12, etap 1

Zakres: `git diff` względem produkcji (`a5d8fde2`): migracja 0229, `grantMirror.ts`, bramka
i manifest, trzy ścieżki zapisu, `purge.ts`, odwzorowanie ról, test, dziennik.

## Ustalenia

### 1. `purge.ts` zostawiłby nadania usuniętego konta
*`src/lib/privacy/purge.ts:83`* · **security** · **naprawione**

`ResourceGrant` **nie ma klucza obcego do `User`** — i to jest celowe: nadanie ma przeżyć usunięcie
konta, które je **wystawiło**. Ale ta sama decyzja znaczy, że nadanie dla **obdarowanego** nie znika
kaskadą, gdy to jego konto jest usuwane.

*Scenariusz:* konto zostaje usunięte, `taskShare` znika kaskadą i hurtem, nadanie zostaje. Ktoś
zakłada konto na ten sam adres, dostaje **nowy** identyfikator — więc nie odziedziczy dostępu.
Gorzej: nadanie osierocone zostaje w bazie i w etapie 2, gdy odczyty się przełączą, zacznie
odpowiadać „tak" na pytanie o dostęp podmiotu, którego już nie ma. Cichy dostęp w tabeli, na którą
nikt nie patrzy.

*Poprawka:* `tx.resourceGrant.deleteMany({ subjectType: "user", subjectId: userId })` w tej samej
transakcji. Świadomie **nie** przez `grantMirror`: usuwanie konta jest atomowe, a helper sięga po
`prisma` obok transakcji — wpis w manifeście mówi to wprost.

### 2. Lustro, które tylko dokłada, nie odbiera uprawnień
*`src/platform/sharing/grantMirror.ts:57`* · **correctness** · **zaprojektowane od razu**

Najprostszy zapis to `create … skipDuplicates`. Działałby przy nadawaniu i **milczał przy
degradacji**: zmiana `ADMIN → MEMBER` zostawiłaby nadanie `manager`. Stąd `upsert`
z `update: { role }` i osobna asercja „degradacja OBNIŻA rolę" — bo to jest ten przypadek, którego
się nie testuje, dopóki się o nim nie pomyśli.

### 3. Przestrzeń nadania — decyzja, której nie było w dokumencie
*`grantMirror.ts:23`, migracja 0229* · **correctness (decyzja)** · **odnotowane**

Rozdz. 8.10 podaje odwzorowanie ról, ale nie mówi, **czyja przestrzeń** trafia do
`ResourceGrant.workspaceId`. Wybrana: **przestrzeń zasobu**, nie obdarowanego — bo nadanie opisuje
zasób, a indeks `@@index([workspaceId])` służy pytaniu „co jest udostępnione w tej przestrzeni".
`Task` przestrzeni nie ma, więc bierze ją z projektu, a zadanie luzem — z przestrzeni osobistej
twórcy. Ta sama reguła w migracji i w kodzie.

### 4. Udostępnienie zespołowi celuje w przestrzeń, nie w ludzi
*`grantMirror.ts:138`* · **correctness (decyzja)** · **odnotowane**

Alternatywą było rozpisanie nadania na każdego członka zespołu. Odrzucone: nadania rozjechałyby się
przy **zmianie składu**, a lustro musiałoby nasłuchiwać na `TeamMember`. `subjectType: "workspace"`
czyta się z `ctx.workspaceIds`, więc skład obsługuje się sam — dokładnie tak, jak dziś działa
`TaskShare.teamId`.

## Rzeczy sprawdzone, w których nie ma ustalenia

- **Idempotencja migracji** — `ON CONFLICT` po kluczu naturalnym nadania; powtórzenie nie zmieniło
  liczby wierszy.
- **Zasób bez przestrzeni** — nadanie nie powstaje, a zapis użytkownika **nie pada**. Osobna
  asercja; kompletność lustra jest tu mniej ważna niż to, żeby udostępnianie działało.
- **C-17** — odczyty nietknięte, tabela prawdy z 052/056 bez ruchu. Zmiana reguły przyjdzie
  w etapie 2 i **tam** będzie wymagała porównania komórka po komórce.
- **C-16** — wzorzec lustra powtórzony świadomie, z tym samym rodzajem bramki co przestrzenie.

## Werdykt

**APPROVE Z UWAGAMI.** Uwaga jedna i przekazywana dalej: **kompletność backfillu na prawdziwych
danych nie jest zmierzona** (lokalna baza nie ma członkostw ani udostępnień). Etap 2 musi zacząć od
policzenia rozjazdu tabela ↔ nadanie na produkcji — i to jest jego warunek wejścia, tak samo jak
liczba sierot jest warunkiem wejścia etapu 4 zadania 11.
