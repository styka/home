# Recenzja: domknięcie zadania 13

## Ustalenia

### 1. Nowe pojęcie w platformie dla jednego modułu — uzasadnione, ale warte nazwania
*`src/platform/sharing/types.ts` (`publicRole`)* · **architektura** · **przyjęte świadomie**

Dokładanie pojęcia do platformy dla **jednego** konsumenta zwykle jest błędem. Tu jest odwrotnie
i warto powiedzieć dlaczego: bez `publicRole` Kuchnia musiałaby **zostać przy własnym guardzie**,
czyli zadanie 13 nie dałoby się zamknąć, a w aplikacji zostałby jeden moduł rozstrzygający dostęp
po swojemu — dokładnie ten stan, który cała Faza 2 likwiduje.

Pole zaprojektowane tak, żeby nie było „polem Kuchni": niesie **rolę**, nie flagę `isPublic`.
Platforma nie wie, skąd moduł ją bierze, i nie ma wiedzieć.

### 2. Klasyfikacja jako bramka, nie notatka
*`src/lib/sharing-classification.json` + `check-module-registry.js`* · **process**

Sama lista w dokumencie zdezaktualizowałaby się przy pierwszym nowym module. Sprawdzana w **obie
strony** (brak wpisu, wpis bez pliku, plik bez wpisu) i z wymaganym powodem — nowy moduł nie
przejdzie builda, dopóki ktoś nie zdecyduje, czy potrzebuje deklaracji.

To jest różnica między „zadanie 13 zrobione w 4 z 19" a „zadanie 13 **zamknięte**".

### 3. Trzecia powtórka tej samej zmienionej komórki
**correctness (znane)** · **odnotowane**

Właściciel zespołu bez `TeamMember` — 056, 060, teraz 064. Przy trzecim wystąpieniu przestaje to
być odkryciem: to konsekwencja tego, że `getUserTeamIds` (członkostwa) i lustro przestrzeni
(z właścicielem) są **dwiema definicjami przynależności do zespołu**. Etap 4 zadania 11 usuwa
źródło; do tego czasu każda kolejna migracja modułu trafi w to samo i powinna to po prostu
nazywać, zamiast badać od nowa.

## Rzeczy sprawdzone

- **Guardy zachowują komunikaty** — łącznie z rozróżnieniem „nie istnieje"/„brak dostępu";
  kosztem jednego `findUnique` po kluczu głównym, tak samo jak w 060.
- **Kuchnia: dwa typy zasobów w jednym pliku** — przepis i książka; `sharing.ts` modułu może
  deklarować wiele typów, tak jak Zadania deklarują projekt i zadanie.
- **`publicRole` nie podnosi roli właściciela** — `najwyzsza(...)` bierze maksimum, więc otwarty
  zasób nie odbiera nikomu wyższych praw.
- **C-35** — brak piętnastu pustych deklaracji jest **zgodnością z regułą**, nie zaniechaniem.

## Werdykt

**APPROVE.** Zadanie 13 zamknięte z zapisanym powodem dla każdego z 21 modułów.
