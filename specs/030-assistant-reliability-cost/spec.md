# Spec: Niezawodność i efektywność kosztowa asystenta AI

- **ID:** 030-assistant-reliability-cost
- **Status:** done
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-25
- **Moduł(y):** Home / Asystent AI (agent)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Asystent AI (agent Home) jest zawodny i drogi w codziennym użyciu. Administrator zgłosił w dniach
23–25.07.2026 siedem problemów, które sprowadzają się do czterech bólów:

1. **Twarde błędy formatu** — gdy model zwróci odpowiedź niepasującą do protokołu, cała tura kończy
   się komunikatem „LLM zwrócił nieprawidłowy format” i użytkownik nic nie dostaje (3 zgłoszenia;
   dotyczyło to zarówno prostych odczytów, jak i akcji „dodaj małe poszewki do listy Kocoń -> Katowice”).
2. **Wprowadzanie w błąd co do możliwości aplikacji** — asystent kategorycznie stwierdził, że
   „zadania nie mają cykliczności”, choć aplikacja ma pełną cykliczność zadań; przyczyną jest to, że
   narzędzia odczytowe nie pokazują modelowi wszystkich istotnych pól, a asystent wypowiada
   kategoryczne sądy o funkcjach systemu, których nie może zweryfikować (1 zgłoszenie).
3. **„Nie udało się dokończyć w limicie kroków”** — proste polecenie analityczne pada, bo agent
   w kółko pobiera te same dane (brak pamięci wykonanych wywołań), a obcięte (ucięte w połowie)
   wyniki z bardzo długimi opisami zaśmiecają kontekst i nie są dla modelu jasno oznaczone
   (1 zgłoszenie).
4. **Nadmierne koszty tokenów** — pokazanie 3 zadań kosztowało ~4000 tokenów, utworzenie jednego
   zgłoszenia ~2600; administrator pyta też wprost, czy po poprawkach tańszy model (Haiku)
   podołałby takim zadaniom (2 zgłoszenia).

Wszystkie 7 zgłoszeń mieści się w tym zakresie — żadne nie jest poza nim.

## 2. Cel i miary sukcesu

- **Cel:** rozmowa z asystentem nigdy nie kończy się technicznym błędem formatu, asystent nie
  wypowiada fałszywych kategorycznych sądów o możliwościach aplikacji, proste polecenia mieszczą
  się w limicie kroków, a typowa prosta tura odczytowa jest wyraźnie tańsza niż dziś.
- Sukces mierzymy:
  - scenariusze z 7 zgłoszeń (odtworzone) kończą się poprawną odpowiedzią/propozycją akcji, bez
    komunikatu „LLM zwrócił nieprawidłowy format” i bez „Nie udało się dokończyć w limicie kroków”;
  - na pytanie o cykliczność zadań asystent odpowiada zgodnie z prawdą (widzi pola cykliczności);
  - proste tury odczytowe są obsługiwane tańszym modelem, a diagnostyka AI (istniejący log wywołań)
    pokazuje spadek kosztu tury dla scenariuszy ze zgłoszeń;
  - w obrębie jednej tury agent nie wykonuje dwa razy identycznego wywołania narzędzia.

## 3. Historyjki użytkownika

- Jako użytkownik chcę, żeby asystent zawsze odpowiedział sensowną treścią — nawet gdy model
  „po drodze” zwróci źle sformatowaną odpowiedź — żebym nie tracił rozmowy przez techniczny błąd.
- Jako użytkownik chcę, żeby asystent mówił prawdę o funkcjach aplikacji (np. cykliczności zadań),
  żebym mógł ufać jego odpowiedziom.
- Jako użytkownik chcę, żeby proste polecenia analityczne („pokaż i oceń zadania”) kończyły się
  wynikiem, a nie komunikatem o limicie kroków.
- Jako właściciel chcę, żeby proste tury odczytowe były obsługiwane tańszym modelem z automatycznym
  awaryjnym przejściem na mocniejszy, żeby obniżyć koszty bez utraty jakości.
- Jako administrator chcę dostać odpowiedź, czy dotychczasowe porażki wynikały z naszych ograniczeń
  i czy po poprawkach Haiku podoła takim zadaniom.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given odpowiedź modelu niepasująca do protokołu agenta, when agent ją odbierze,
  then podejmuje próbę naprawy/ponowienia z informacją zwrotną dla modelu, a tura trwa dalej —
  pojedyncza zła odpowiedź nie kończy tury błędem.
- [ ] **AC-2** — Given wyczerpanie prób naprawy formatu, when nadal nie da się sparsować odpowiedzi,
  then użytkownik otrzymuje oczyszczoną treść odpowiedzi modelu jako zwykłą odpowiedź tekstową
  (bez proponowania akcji mutujących w tym trybie) — komunikat „LLM zwrócił nieprawidłowy format”
  nie pojawia się nigdy w UI.
- [ ] **AC-3** — Given zadania z ustawioną cyklicznością, when użytkownik pyta asystenta o ich
  cykliczność, then narzędzia odczytowe zwracają informacje o cykliczności i asystent odpowiada
  zgodnie ze stanem danych.
- [ ] **AC-4** — Given przegląd wszystkich narzędzi odczytowych agenta, when porównamy ich wynik z
  danymi modułów, then istotne pola funkcjonalne (nie tylko cykliczność zadań) są obecne w wyniku
  albo świadomie pominięte z odnotowaniem w artefaktach pipeline'u.
- [ ] **AC-5** — Given pytanie o funkcję aplikacji, której agent nie może zweryfikować narzędziami,
  when asystent formułuje odpowiedź, then nie wypowiada kategorycznego sądu „aplikacja tego nie ma”,
  tylko odpowiedź ostrożną (reguła w instrukcjach agenta).
- [ ] **AC-6** — Given identyczne wywołanie narzędzia (to samo narzędzie i argumenty) w obrębie
  jednej tury, when agent chce je powtórzyć, then wynik pochodzi z pamięci tury (bez ponownego
  wykonania), a agent jest poinformowany, że to powtórka.
- [ ] **AC-7** — Given wynik narzędzia z bardzo długimi polami tekstowymi (np. opisy zadań ze
  zrzutami rozmów), when trafia do kontekstu modelu, then długie pola są przycięte z wyraźnym
  oznaczeniem skrócenia (i informacją, jak sięgnąć po całość), a wynik nie jest ucinany „w połowie”
  bez oznaczenia.
- [ ] **AC-8** — Given scenariusz ze zgłoszenia „pokaż zadania TODO/URGENT z projektu Omnia i oceń
  trudność”, when zostanie odtworzony po zmianach, then agent kończy w limicie kroków z poprawną
  odpowiedzią.
- [ ] **AC-9** — Given prosta tura odczytowa (odczyt/listowanie bez mutacji), when agent ją
  obsługuje, then używany jest tańszy model, a przy jego niepowodzeniu (błąd formatu, brak rezultatu)
  tura jest automatycznie ponawiana modelem mocniejszym — bez widocznej różnicy dla użytkownika poza
  kosztem.
- [ ] **AC-10** — Given scenariusze kosztowe ze zgłoszeń („3 najważniejsze zadania”, zgłoszenie
  błędu z trybu wskazania), when zostaną odtworzone po zmianach, then łączny koszt tokenów tury jest
  wyraźnie niższy niż w zgłoszeniu (mniejsze wyniki narzędzi, krótszy kontekst), co widać w
  istniejącej diagnostyce AI.
- [ ] **AC-11** — Given zakończony pipeline, when powstaje podsumowanie, then zawiera odpowiedź dla
  administratora: czy porażki wynikały z naszych ograniczeń i czy po poprawkach Haiku podoła
  zadaniom tej klasy.

## 5. Zakres

**W zakresie:**
- Tolerancyjne parsowanie + naprawa/ponowienie źle sformatowanych odpowiedzi modelu w pętli agenta,
  z łagodną degradacją do odpowiedzi tekstowej (decyzja właściciela).
- Przegląd wszystkich narzędzi odczytowych agenta pod kątem pomijanych istotnych pól (na czele z
  cyklicznością zadań) + reguła „nie twierdź kategorycznie o braku funkcji” w instrukcjach agenta.
- Pamięć/deduplikacja wywołań narzędzi w obrębie tury; czytelne przycinanie długich pól z
  oznaczeniem skrócenia; poprawa skuteczności w ramach limitu kroków.
- Redukcja kosztów tokenów: odchudzenie wyników narzędzi i kontekstu tam, gdzie to bezpieczne.
- Automatyczny routing prostych tur odczytowych do tańszego modelu z auto-fallbackiem do
  mocniejszego (decyzja właściciela).
- Odpowiedź analityczna dla administratora (ograniczenia → wykonalność dla Haiku).

**Poza zakresem (świadomie):**
- Liczniki/prezentacja kosztów LLM w modułach (osobne zadanie „Liczniki kosztów LLM w module
  Pogoda…” — inny feature).
- Zmiany w innych ścieżkach LLM niż agent Home (briefing, typed client modułów) poza tym, co
  współdzielone z agentem.
- Zmiany UI czatu poza treścią komunikatów awaryjnych.
- Podnoszenie jakości merytorycznej odpowiedzi modelu ponad usunięcie opisanych klas błędów.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — istniejący `module.home`; brak nowych stron/uprawnień.
- **Własność danych:** bez zmian — narzędzia odczytowe agenta już respektują własność
  user/team; żadnych nowych modeli danych.
- **Asystent AI:** rdzeń feature'a; bez nowych `AIAction` (C-23 bez zmian w manifeście, chyba że
  przegląd pól wykaże konieczność korekt istniejących read-tooli — wtedy manifest pokrycia
  aktualizujemy zgodnie z bramką).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.
- **Migracje DB:** nieprzewidywane (brak nowych modeli); jeśli plan wykaże inaczej — ręczne pliki
  migracji zgodnie z C-10/C-11.

## 7. Zgodność z konstytucją

- **C-01/C-02** — praca wyłącznie w `worldofmag/`, importy przez `@/*`.
- **C-23** — pokrycie akcji AI: przegląd read-tooli nie może zepsuć bramki `check:actions`;
  ewentualne zmiany odnotowane w manifeście pokrycia.
- **C-40** — routing modeli pozostaje DB-driven (`/admin/llm`); tańszy model dla prostych tur
  wybieramy przez istniejący mechanizm przydziału per typ operacji, bez hardcodowania modelu.
- **C-41** — bez dotykania kluczy API.
- **C-32** — wszystkie komunikaty użytkownika po polsku.
- **C-50** — definicja „gotowe”: `npm run build` przechodzi (lokalnie do kroku `next build`, C-13).
- **C-51** — wpis do `doświadczenia.md` po naprawie bugów.
- **C-52/C-53/C-54/C-55** — autonomiczny przebieg, minimalizm, spójność artefaktów.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jedynym momencie pytań (25.07.2026):

- [x] **Routing Haiku:** „Tak, z auto-fallbackiem” — proste tury odczytowe idą do tańszego modelu;
  przy błędzie formatu/niepowodzeniu tura ponawiana modelem reasoning.
- [x] **Awaria formatu:** „Pokaż treść jako odpowiedź” — po nieudanej naprawie oczyszczony tekst
  modelu trafia do użytkownika jako zwykła odpowiedź; akcje mutujące nie są wtedy proponowane;
  techniczny błąd formatu znika z UI.

Założenia przyjęte domyślnie (bez pytania, niskie ryzyko):
- Limity przycinania długich pól i liczbę prób naprawy dobiera plan (wartości techniczne).
- Odpowiedź analityczna dla administratora (AC-11) trafia do podsumowania pipeline'u (bez osobnego
  raportu w aplikacji — minimalizm C-53).
- Nie zmieniamy przydziałów modeli w prod DB — feature używa istniejącego mechanizmu `/admin/llm`;
  ewentualna zmiana przydziału to operacja administratora.

## 9. Ryzyka

- **Tańszy model obniży jakość prostych tur** → auto-fallback do modelu reasoning przy
  niepowodzeniu; klasyfikacja „prostej tury” konserwatywna (wątpliwości → mocniejszy model).
- **Degradacja do surowego tekstu pokaże użytkownikowi „brzydką” treść** → treść jest oczyszczana;
  tryb ten dotyczy tylko ostatniej deski ratunku, po próbach naprawy.
- **Przycinanie pól zuboży odpowiedzi analityczne** → skrócenie jest oznaczone i asystent może
  sięgnąć po pełną treść konkretnego rekordu, gdy to potrzebne.
- **Deduplikacja wywołań zamaskuje świeżość danych** → pamięć wywołań żyje tylko w obrębie jednej
  tury (sekundy), więc ryzyko przeterminowania jest pomijalne.
- **Zmiany w promptach/protokole zdestabilizują istniejące scenariusze** → weryfikacja w `/verify`
  obejmuje odtworzenie wszystkich 7 zgłoszeń + istniejące testy agenta.
