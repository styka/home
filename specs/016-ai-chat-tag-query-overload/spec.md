# Spec: Zapytania odczytowe w asystencie AI nie giną na limicie modelu (przeciążenie)

- **ID:** 016-ai-chat-tag-query-overload
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-21
- **Moduł(y):** Home (asystent AI) + wspólna warstwa LLM

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

> **Kontekst wobec 010 (C-54).** Spec `010-ai-chat-rate-limit` założył, że limit szybkości dostawcy jest
> **przejściowy** i wystarczy ponawianie z backoffem + usunięcie pętli (filtr po tagu w odczycie zadań).
> Oba te elementy **wdrożono** — a mimo to zgłoszenie z 2026-07-21 pokazuje, że dla polecenia „pokaż
> zadania otagowane »raj«" asystent **nadal** kończy komunikatem o przeciążeniu, choć zadania z tym tagiem
> **istnieją**. Ten spec koryguje wcześniejsze założenie: dla tej klasy poleceń limit **nie jest chwilowy**,
> lecz **strukturalny** — jedno polecenie odpalające normalny przebieg (kilka wywołań modelu w tej samej
> minucie) samo w sobie przekracza minutowy budżet tokenów dostawcy, więc ponowienie w kilka sekund nie ma
> szans go „przeczekać". 010 pozostaje w mocy (ludzki komunikat + retry dla PRAWDZIWIE chwilowych limitów);
> ten spec dokłada usunięcie **przyczyny** przekroczenia budżetu.

## 1. Problem / potrzeba
Użytkownik prosi asystenta o rzecz banalną — „pokaż mi wszystkie zadania otagowane »Raj«" — a zamiast listy
dostaje komunikat „Asystent jest teraz przeciążony (chwilowy limit zapytań do modelu). Spróbuj ponownie za
chwilę." Powtórzenie nie pomaga: to samo polecenie odbija się o limit **za każdym razem**, mimo że dane są w
bazie (istnieją zadania z tym tagiem), a wcześniejsze poprawki (ponawianie, filtr po tagu) zostały wdrożone.
Z perspektywy właściciela to wygląda jak trwała awaria asystenta, a nie chwilowe przeciążenie — proste
pytanie o własne dane po prostu **nie da się zadać**.

## 2. Cel i miary sukcesu
- Cel: **zwykłe zapytanie odczytowe** do asystenta (np. „pokaż zadania otagowane X", „ile mam pilnych
  zadań", „pokaż moje notatki") **kończy się poprawną odpowiedzią z danymi**, a nie komunikatem o
  przeciążeniu — w typowym stanie konta i przy typowej konfiguracji modelu.
- Sukces mierzymy:
  - polecenie „pokaż zadania otagowane »raj«" (gdy takie zadania istnieją) zwraca **listę tych zadań**, a
    nie komunikat o przeciążeniu — **powtarzalnie**, nie „raz na jakiś czas";
  - proste polecenie odczytowe **nie generuje** takiego zapotrzebowania na tokeny w jednej minucie, które
    samo z siebie przekracza minutowy limit dostawcy (tzn. przyczyna, nie tylko objaw, zostaje usunięta);
  - gdy limit **naprawdę** jest chwilowy (np. równoległe operacje), zachowanie z 010 zostaje: cichy retry,
    a w ostateczności jeden zrozumiały komunikat po polsku — **nigdy** surowy tekst dostawcy.

## 3. Historyjki użytkownika
- Jako użytkownik pytający asystenta o swoje zadania po tagu chcę **dostać listę tych zadań**, a nie
  komunikat, że model jest przeciążony — bo to proste pytanie o moje własne dane.
- Jako użytkownik zadający dowolne krótkie pytanie odczytowe chcę, żeby asystent **odpowiadał**, a nie
  odbijał się o limit przy każdej próbie.
- Jako właściciel systemu chcę przestać zgłaszać ten sam „bug" — proste odczyty mają działać niezależnie od
  minutowego limitu tokenów dostawcy, a nie zależeć od tego, czy akurat „się zmieszczą".

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.
- [ ] **AC-1** — Given na koncie istnieją zadania otagowane „raj", when użytkownik wyśle asystentowi
  „pokaż mi wszystkie zadania otagowane »Raj«", then asystent zwraca **odpowiedź z listą tych zadań**
  (po nazwach), a **nie** komunikat o przeciążeniu — i wynik jest **powtarzalny** przy kolejnych próbach
  tego samego polecenia.
- [ ] **AC-2** — Given typowa konfiguracja modelu i pusty (świeży) wątek rozmowy, when użytkownik zadaje
  proste polecenie odczytowe (np. „pokaż zadania otagowane X", „ile mam pilnych zadań", „pokaż moje
  notatki"), then **łączne** zapotrzebowanie na tokeny wywołane tym jednym poleceniem **mieści się** w
  minutowym budżecie dostawcy — obsłużenie polecenia nie wymaga „przeczekiwania" limitu.
- [ ] **AC-3** — Given asystent odpowiada na proste zapytanie odczytowe, when zbiera dane i formułuje
  odpowiedź, then robi to **bez zbędnego zwielokrotniania ciężkich wywołań modelu** w tej samej minucie
  (przyczyna przekroczenia budżetu z 010 zostaje usunięta, nie obejściem, lecz redukcją zapotrzebowania).
- [ ] **AC-4** — Given limit dostawcy jest **rzeczywiście** chwilowy (okno zwalnia się w kilka sekund),
  when polecenie na niego trafi, then zachowanie z 010 zostaje w mocy: **cichy retry** i poprawna
  odpowiedź; a gdy mimo prób się nie uda — **jeden** zrozumiały komunikat po polsku (nigdy surowy tekst
  dostawcy typu „Rate limit reached for model …").
- [ ] **AC-5** — Given asystent nie mógł odpowiedzieć na proste zapytanie odczytowe (jakikolwiek powód),
  when kończy turę, then **nie zapętla się** i nie odpala serii ciężkich wywołań modelu „na próżno" —
  kończy w skończonej, małej liczbie kroków.
- [ ] **AC-6** — Given pozostałe polecenia asystenta (dodawanie/edycja/usuwanie danych, raporty, rozmowa,
  akcje między modułami), when użytkownik ich używa, then działają **jak dotąd** — zmiana nie psuje
  istniejących ścieżek ani jakości odpowiedzi (brak regresji).

## 5. Zakres
**W zakresie:**
- Usunięcie **strukturalnej** przyczyny przekraczania minutowego budżetu tokenów dostawcy dla **zapytań
  odczytowych** asystenta (redukcja łącznego zapotrzebowania jednego polecenia na tokeny w oknie minuty).
- Zapewnienie, że reprezentatywne polecenie „pokaż zadania otagowane X" (i pokrewne proste odczyty) kończą
  się poprawną, powtarzalną odpowiedzią z danymi.
- Utrzymanie w mocy odporności z 010 (retry dla prawdziwie chwilowych limitów + ludzki komunikat awaryjny)
  oraz braku zapętlenia.

**Poza zakresem (świadomie):**
- Zmiana dostawcy LLM ani modeli per typ operacji (to konfiguracja w `/admin/llm`, nie kod tej zmiany).
- Podnoszenie limitu konta u dostawcy / kwestie płatnego planu.
- Zmiana zachowania asystenta dla poleceń **zmieniających dane** i raportów poza tym, co konieczne, by nie
  spowodować regresji.
- Przeprojektowanie UX czatu (bąbelki, historia, Retry) — pozostaje bez zmian.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — asystent na `/` (`module.home`); brak nowego slugu (C-22 nie dotyczy).
- **Własność danych:** bez zmian — odczyty respektują istniejący model dostępu (`ownerId`/`ownerTeamId`,
  C-21); nie tworzymy nowych danych.
- **Asystent AI:** rdzeń zmiany dotyczy pętli agenta / warstwy LLM (C-23, C-40) — bez **nowej** `AIAction`;
  chodzi o to, JAK asystent obsługuje odczyty pod kątem budżetu tokenów, nie o nową akcję.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-40** (routing modeli DB-driven) — nie hardkodujemy providera/modelu; rozwiązanie ma działać w ramach
  istniejącego routingu per typ operacji.
- **C-41** (klucze/treści dostawcy) — komunikaty dla użytkownika po polsku, nigdy surowy tekst dostawcy.
- **C-53** (minimalizm) — najmniejsza możliwa zmiana usuwająca przyczynę; bez nowych zależności i „przy
  okazji" refaktorów; zgodność ze stylem otoczenia.
- **C-32** (teksty po polsku) — wszelkie komunikaty użytkownika po polsku.
- **C-54** (spójność artefaktów) — ten spec świadomie koryguje założenie z 010 (limit „chwilowy" →
  częściowo **strukturalny**); 010 pozostaje ważny dla prawdziwie chwilowych limitów.
- **C-50/C-51/C-52** — „gotowe" = `npm run build` zielony; wpis do `doświadczenia.md`; merge do `develop`
  i automatyczna promocja na `master` na końcu pipeline'u.

## 8. Otwarte pytania / decyzje właściciela
- Brak pytań do właściciela — oczekiwany efekt jest jednoznaczny („proste zapytanie odczytowe zwraca dane,
  a nie komunikat o przeciążeniu"), a wybór mechanizmu naprawy to decyzja techniczna (`/plan`, C-53).
- **Założenia przyjęte domyślnie:** (a) naprawiamy **przyczynę** (redukcja zapotrzebowania na tokeny), a nie
  tylko łagodzimy objaw; (b) nie zmieniamy konfiguracji dostawcy/modelu; (c) odporność 010 (retry + ludzki
  komunikat) zostaje jako druga linia obrony dla naprawdę chwilowych limitów.

## 9. Ryzyka
- **Redukcja kontekstu promptu może pogorszyć trafność odpowiedzi** → ograniczamy to, co wysyłamy, tylko
  tam, gdzie nie jest potrzebne do danej klasy poleceń; AC-6 pilnuje braku regresji na pozostałych
  ścieżkach.
- **„Naprawa objawu zamiast przyczyny"** (samo podkręcenie retry) → AC-2/AC-3 wprost wymagają, by pojedyncze
  proste polecenie mieściło się w minutowym budżecie, więc test wychwyci obejście.
- **Trudność weryfikacji limitu dostawcy lokalnie** → kryteria formułujemy obserwowalnie (zapytanie zwraca
  dane / liczba i wielkość wywołań w minucie), by dały się sprawdzić bez realnego trafienia w 429.
