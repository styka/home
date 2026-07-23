# Spec: Niezawodność i UX czatu asystenta AI

- **ID:** 025-assistant-chat-reliability-ux
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-23
- **Moduł(y):** Home (asystent AI / Sparkles) — czat `AICommandSheet`, agent `/api/llm/home/agent`, read-toole `lib/ai/agentTools.ts`, routing/limity LLM (`lib/llm/*`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. (Ścieżki wyżej służą tylko nazwaniu granic feature'a — decyzje implementacyjne idą do `plan.md`.)

## 1. Problem / potrzeba
Administrator zgłosił cztery błędy w czacie asystenta AI, które sprowadzają się do trzech
niezależnych usterek psujących podstawowe użycie ("zdecyduj, które 3 zadania z projektu LZ — zaległe
i dzisiejsze — są najważniejsze"):
1. **Limity modelu.** Zapytania agenta bywają zbyt duże i wpadają w limity dostawcy modelu (błędy
   "Request too large" — za duży request na mały model — oraz "Rate limit reached" — wyczerpany limit
   minutowy/dzienny). Efekt dla użytkownika: „Asystent jest teraz przeciążony", zapytanie przepada.
2. **Krok doprecyzowujący (clarify) bez przycisku na mobile.** Gdy asystent zadaje pytanie
   pomocnicze w swoim dymku, odpowiedź da się wysłać tylko skrótem klawiszowym (Enter) — na telefonie
   brak widocznego przycisku „wyślij", więc rozmowy nie da się kontynuować.
3. **Asystent nie znajduje projektu po nazwie.** Użytkownik pyta o zadania „z projektu LZ", a asystent
   przekazuje nazwę „LZ" tam, gdzie oczekiwany jest techniczny identyfikator projektu — w efekcie
   dostaje pustą listę i twierdzi, że „nie ma zadań", mimo że zadania w tym projekcie są.

## 2. Cel i miary sukcesu
- **Cel:** typowe polecenie w stylu „wybierz 3 najważniejsze zadania z projektu LZ (zaległe i
  dzisiejsze)" działa od początku do końca — asystent trafia w projekt po nazwie, mieści się w
  limitach modelu (albo degraduje się łagodnie z zachowaniem tury), a ewentualne pytanie
  doprecyzowujące da się zatwierdzić także na telefonie.
- **Sukces mierzymy:**
  - Zapytanie o zadania z projektu podanego **nazwą** zwraca zadania z tego projektu (nie pustą listę),
    gdy taki projekt istnieje i jest dostępny dla użytkownika.
  - Na widoku mobilnym użytkownik potrafi odpowiedzieć na pytanie clarify **jednym dotknięciem
    widocznego przycisku**, bez klawiatury sprzętowej.
  - Gdy dostawca modelu odrzuci zapytanie z powodu limitu/rozmiaru, użytkownik dostaje **zrozumiały
    komunikat**, a jego wpisane polecenie **nie znika** (można ponowić) — zamiast surowego błędu.

## 3. Historyjki użytkownika
- Jako użytkownik chcę pytać asystenta o zadania „z projektu LZ" (nazwą, tak jak go nazywam), żeby nie
  musieć znać technicznego identyfikatora ani ręcznie go podawać.
- Jako użytkownik na telefonie chcę móc odpowiedzieć na pytanie doprecyzowujące asystenta dotknięciem
  przycisku, żeby kontynuować rozmowę bez klawiatury sprzętowej.
- Jako użytkownik chcę, żeby przy chwilowym przeciążeniu modelu asystent powiedział mi jasno, co się
  stało, i zachował moje polecenie, żebym mógł spróbować ponownie bez przepisywania go od nowa.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given istnieje dostępny dla użytkownika projekt zadań o nazwie „LZ" z co najmniej
  jednym niezakończonym zadaniem, when użytkownik prosi asystenta o zadania „z projektu LZ" (podając
  nazwę, nie identyfikator), then asystent zwraca zadania z tego projektu (a nie pustą listę ani
  odpowiedzi „nie ma zadań").
- [ ] **AC-2** — Given użytkownik podał nazwę projektu, która **nie** odpowiada jednoznacznie żadnemu
  dostępnemu projektowi (brak dopasowania lub wiele dopasowań), when asystent to wykryje, then zamiast
  cicho zwrócić pustą listę zadaje pytanie doprecyzowujące albo jasno informuje, że takiego projektu
  nie znalazł. (Kompatybilność: podanie prawdziwego identyfikatora projektu nadal działa jak dotąd.)
- [ ] **AC-3** — Given asystent wyświetlił w dymku pytanie doprecyzowujące (clarify), when użytkownik
  jest na widoku mobilnym, then w dymku widoczny jest klikalny przycisk wysłania odpowiedzi, którym
  można zatwierdzić wpisaną odpowiedź bez użycia skrótu klawiszowego. Dotychczasowe zatwierdzanie
  klawiaturą (Enter) i wybór gotowej opcji (chip) działają nadal.
- [ ] **AC-4** — Given dostawca modelu odrzuca zapytanie agenta z powodu przekroczenia limitu
  (rate limit) lub zbyt dużego rozmiaru, when zdarzy się to w trakcie rozmowy, then użytkownik widzi
  zrozumiały komunikat po polsku, a jego ostatnie wpisane polecenie pozostaje dostępne do ponowienia
  (nie znika z pola/rozmowy).
- [ ] **AC-5** — Given zapytanie agenta jest na tyle duże, że nie zmieści się w limicie najmniejszego
  modelu, when agent dobiera model/fallback, then nie kieruje takiego zapytania do modelu, którego
  limit z góry wyklucza jego obsłużenie (tj. fallback uwzględnia rozmiar zapytania, a nie tylko
  kolejność modeli).
- [ ] **AC-6** — Given typowa rozmowa z asystentem o zadaniach, when agent buduje zapytanie do modelu,
  then rozmiar zapytania jest zauważalnie mniejszy niż przed zmianą (mniej „ważące" narzędzia/kontekst/
  historia), tak by typowe polecenie o zadania mieściło się w limitach bez błędu — przy zachowaniu
  poprawności odpowiedzi z AC-1.

## 5. Zakres
**W zakresie:**
- Rozwiązywanie projektu zadań po **nazwie** w odczytach asystenta (dopasowanie nazwy → identyfikator),
  z zachowaniem kompatybilności z podaniem prawdziwego identyfikatora oraz sensownym zachowaniem przy
  braku/niejednoznaczności dopasowania (AC-1, AC-2).
- Widoczny, klikalny sposób odpowiedzi na krok clarify w dymku asystenta, działający na mobile, obok
  istniejącego skrótu klawiszowego i chipów opcji (AC-3).
- Zmniejszenie rozmiaru zapytania agenta oraz łagodna obsługa limitów/rozmiaru: mądrzejszy dobór
  modelu/fallbacku uwzględniający rozmiar zapytania, oraz czytelny komunikat + zachowanie tury przy
  odrzuceniu przez dostawcę (AC-4, AC-5, AC-6).

**Poza zakresem (świadomie):**
- Zmiana dostawcy modeli, planu taryfowego czy podniesienie limitów po stronie konta dostawcy (to
  decyzja infrastrukturalno-kosztowa, nie kod).
- Trwałe kolejkowanie/odraczanie zapytań odrzuconych z powodu wyczerpanego limitu **dziennego**
  (poza czytelnym komunikatem i możliwością ręcznego ponowienia).
- Rozszerzanie dopasowania po nazwie na inne słowniki/moduły niż projekty zadań (można rozważyć
  osobno, jeśli pojawią się analogiczne zgłoszenia).
- Przeprojektowanie całego czatu / historii rozmów — dotykamy tylko trzech konkretnych usterek.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — działamy w istniejącym `module.home`; dopasowanie projektu po
  nazwie respektuje dotychczasowy zakres dostępu użytkownika do projektów (współwłasność, C-21).
- **Własność danych:** brak nowych danych/modeli. Rozwiązywanie nazwy projektu ograniczone do
  projektów dostępnych dla danego użytkownika (`ownerId`/`ownerTeamId`).
- **Asystent AI:** nie wymaga nowej `AIAction`; zmiany dotyczą read-tooli/kontekstu agenta i warstwy
  routingu modeli (C-23, C-40). Manifest pokrycia AI może nie wymagać zmian (brak nowej akcji
  mutującej), ale bramka `check:actions` musi przejść.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-01/C-02** — praca wyłącznie w `worldofmag/`, importy przez alias `@/*`.
- **C-20** — ewentualne mutacje przez Server Actions z `revalidatePath()` (feature jest głównie
  odczytowy/UX, ale zasada obowiązuje, jeśli coś dotkniemy).
- **C-21** — dopasowanie projektu po nazwie liczone w granicach dostępu użytkownika.
- **C-23** — każda `AIAction` ma egzekutor; bramka `check:actions` w buildzie musi przejść.
- **C-30/C-31/C-32** — przycisk clarify zgodny z ciemnym motywem (zmienne CSS, `--on-accent`),
  mobile-first (widoczny cel dotyku, min. `py-3`), teksty po polsku.
- **C-40** — routing modeli pozostaje DB-driven (`/admin/llm`); nie hardcodujemy providera/modelu —
  zmiana fallbacku/limitów działa w ramach tej warstwy.
- **C-50/C-51/C-52/C-53** — „gotowe" = zielony `build`; wpis do `doświadczenia.md`; auto-merge do
  `develop` i promocja do `master`; minimalizm (naprawiamy trzy usterki, bez „przy okazji" refaktorów).

## 8. Otwarte pytania / decyzje właściciela
Pomysł jest jednoznaczny (naprawa trzech konkretnych, dobrze określonych usterek z oczekiwanym
zachowaniem), więc — zgodnie z C-55 — nie przerywano właścicielowi. Przyjęte założenia domyślne:
- **Dopasowanie projektu po nazwie:** bez rozróżniania wielkości liter; najpierw dokładne dopasowanie
  nazwy, potem jednoznaczne częściowe; przy wielu dopasowaniach — clarify/informacja zamiast zgadywania.
  Prawdziwy identyfikator nadal ma pierwszeństwo i działa jak dotąd.
- **Obsługa limitu dziennego (wyczerpany na cały dzień):** czytelny komunikat + zachowanie polecenia do
  ręcznego ponowienia; **bez** automatycznego kolejkowania/odraczania.
- **Redukcja rozmiaru zapytania:** priorytet dla nienaruszania poprawności odpowiedzi (AC-1) — tniemy
  „taniej ważące" elementy (nadmiarowy kontekst/historia/opisy narzędzi), a nie zdolność agenta do
  znalezienia danych.

## 9. Ryzyka
- **Zbyt agresywne cięcie kontekstu** mogłoby pogorszyć jakość odpowiedzi → wiążemy z AC-1/AC-6:
  poprawność odczytu zadań musi zostać zachowana; cięcie dotyczy elementów zbędnych, nie danych.
- **Nazwa projektu niejednoznaczna** (kilka projektów o podobnej nazwie) → AC-2: pytanie
  doprecyzowujące/informacja zamiast cichej pustej odpowiedzi.
- **Regresja UX dymka clarify** (chipy/klawiatura) → AC-3 wymaga, by dotychczasowe ścieżki działały nadal.
- **To już trzecie podejście do limitów** (specs 010/016/017) → ryzyko, że sam kod nie usunie w pełni
  ograniczeń darmowego planu dostawcy; dlatego celem jest łagodna degradacja + mniejsze zapytanie, a nie
  obietnica „zero błędów limitu".
