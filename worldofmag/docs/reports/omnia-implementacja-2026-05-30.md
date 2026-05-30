# Omnia — Raport implementacji 2026-05-30

Sesja dotyczyła jednego, ale rozległego zgłoszenia: przekształcenia „magicznej ikony"
z prostego, jednorazowego interpretera poleceń w pełnoprawnego asystenta AI pracującego
na danych użytkownika tymi samymi regułami dostępu co interfejs aplikacji.

---

## Magiczna ikona powinna działać bardziej magicznie

**Diagnoza:**
Dotychczasowa „magiczna ikona" (`AICommandSheet`) działała jako jednostrzałowy interpreter:
tekst → `/api/llm/home/interpret` (stały prompt, zamknięta lista akcji) → `ActionDrawer` →
`/api/llm/home/execute`. Wynikały z tego twarde ograniczenia:

- **Nie umiała odpowiadać na pytania** („które zadanie jest teraz najważniejsze?", „pokaż
  zadania o remoncie") — potrafiła wyłącznie generować mutacje, nigdy odczytać i podsumować danych.
- **Wąski zakres zapisu** — tylko kilka typów akcji; brak tworzenia list/projektów, zmiany
  nazw, archiwizacji, usuwania, edycji zadań/notatek.
- **Brak akcji zbiorczych** — każda akcja celowała w pojedynczy rekord przez `findFirst(searchQuery)`
  (pierwszy pasujący po nazwie), więc „oznacz wszystkie zadania o remoncie" było niewykonalne.
- **Brak sesji doprecyzowującej** i **brak widocznego logu rozumowania**.

Wymaganie: ikona ma działać jak realny asystent — pobierać dane, odpowiadać, dekomponować
polecenia zbiorcze, pytać gdy coś niejasne, korzystać z kontekstu lokalizacji, a akcje wykonywać
dopiero po zatwierdzeniu przez użytkownika, kończąc podsumowaniem.

**Rozwiązanie:**
Zamiast rozbudowywać jednostrzałowy prompt, wprowadzono **agentową pętlę po stronie serwera**.
Kluczowe decyzje projektowe i ich uzasadnienie:

- **Pętla zamiast jednego strzału** — agent może najpierw POBRAĆ dane narzędziami odczytu,
  a dopiero potem zdecydować: odpowiedzieć tekstem, dopytać, czy zaproponować plan akcji.
  To jedyny sposób, by ta sama ikona obsłużyła zarówno pytania, jak i polecenia, i by
  „zadania o remoncie" mogły zostać wybrane przez LLM na podstawie realnych tytułów/treści.
- **Model `llama-3.3-70b-versatile`** (zamiast słabego `8b-instant`) — agentowe rozumowanie
  JSON i filtrowanie semantyczne („co dotyczy remontu") wymaga mocniejszego modelu; to
  pojedynczy czynnik najmocniej decydujący o jakości dekompozycji.
- **Celowanie po `id`, nie po nazwie** — narzędzia odczytu zwracają `id` każdego rekordu,
  więc akcję zbiorczą realizujemy jako wiele pojedynczych akcji, każda z własnym `taskId`/
  `itemId`/`noteId`/`listId`. Nie dodano serwisu „bulk" — symulujemy go pętlą, zgodnie z prośbą.
- **Zapis przez te same Server Actions co UI** — dla ścieżki id wykonanie idzie przez
  `updateTask`/`deleteItem`/`updateNote` itd., które same asertują dostęp. Dzięki temu
  payload edytowalny w `ActionDrawer` (klient) nie może podstawić cudzych id: bezpieczeństwo
  żyje w warstwie zapisu, nie w transkrypcie/promptcie. Fallback po `searchQuery` szuka
  wyłącznie w zakresie własności użytkownika.
- **Bezstanowa sesja doprecyzowująca** — przy kroku `clarify` pętla zwraca transkrypt do
  klienta; po dosłaniu odpowiedzi wznawia. Brak persystencji logu (decyzja właściciela:
  log inline, bez bazy) — pełny log rozumowania jest rozwijalny w panelu, uproszczony
  (myśli agenta) widoczny od razu.
- **Świadomość kontekstu** — `routeHint`, `activeListId`, `currentProjectId` (nazwa projektu
  rozwiązywana serwerowo) trafiają do promptu, więc „dodaj chleb" na widoku listy trafia do tej listy.
- **Akcje destrukcyjne** (`delete_*`, `archive_list`) w `ActionDrawer` mają czerwony znacznik
  i są **domyślnie odznaczone** — świadomy opt-in przed wykonaniem. Identyfikatory rekordów
  są pokazywane jako pola tylko do odczytu (edycja surowego id jest niebezpieczna).

Protokół agenta (jeden obiekt JSON na turę): `step` ∈ `query | clarify | answer | plan`,
zawsze z polem `thought` (do logu). Pętla ograniczona do 5 iteracji, `max_tokens` 1500,
`temperature` 0.1, `response_format: json_object`, z jednokrotnym ponowieniem przy błędzie
parsowania i walidacją nazw narzędzi/modułów z allow-listy.

**Zmienione pliki:**
- `src/app/api/llm/home/agent/route.ts` (nowy) — agentowa pętla, protokół JSON, prompt
  systemowy, wywołania Groq (70B), walidacja i normalizacja akcji, bezstanowe wznawianie po `clarify`.
- `src/lib/ai/agentTools.ts` (nowy) — katalog narzędzi odczytu (`READ_TOOLS_PROMPT`) i dyspozytor
  `runReadTool` (`list_projects/tasks/shopping_lists/items/notes/pets`) z filtrami dostępu i zwięzłymi kształtami.
- `src/app/api/llm/home/execute/route.ts` — rozszerzony katalog akcji (zadania/zakupy/notatki),
  wykonanie przez Server Actions z `src/actions/*`, helpery `resolve*` (id-first z re-weryfikacją
  własności, fallback po `searchQuery` w zakresie użytkownika); sekcja `pets` bez zmian.
- `src/components/home/AICommandSheet.tsx` — maszyna stanów (`idle/running/clarify/answer/plan/results`),
  uproszczony log na żywo + rozwijalny pełny log, sesja doprecyzowująca (opcje lub tekst),
  odpowiedź renderowana w Markdown, podsumowanie wykonania.
- `src/components/home/ActionDrawer.tsx` — obsługa modułu `pets`, identyfikatory jako read-only chip,
  akcje destrukcyjne z czerwonym badge i domyślnie odznaczone.
- `doświadczenia.md` — lekcja o re-weryfikacji własności dla akcji celowanych po id.

---

## Podsumowanie

Zrealizowano **1 zgłoszenie** o dużym zakresie, dotykające warstwy AI/agentowej aplikacji.
Główne obszary zmian: nowa pętla agentowa i narzędzia odczytu (`src/app/api/llm/home/agent`,
`src/lib/ai/agentTools.ts`), przebudowa egzekutora akcji na bazie istniejących Server Actions
z naciskiem na bezpieczeństwo celowania po id, oraz przeprojektowanie UI „magicznej ikony"
(odpowiedzi tekstowe, sesja doprecyzowująca, log rozumowania, akcje destrukcyjne off-by-default).

Uwagi:
- Zgodnie z decyzją właściciela log rozumowania jest **inline, bez zapisu do bazy** — w odróżnieniu
  od pierwotnej prośby o „log pod linkiem". Można to później rozszerzyć o trwały model `AssistantRun`
  i stronę `/assistant/[id]`, jeśli zajdzie potrzeba udostępniania logów.
- Jakość dekompozycji poleceń zbiorczych zależy od modelu — ustawiono `llama-3.3-70b-versatile`.
  Wymaga to skonfigurowanego `groq_api_key` w Panelu Admina (tak jak dotychczasowy interpreter).
- Build (`prisma generate && next build`) przechodzi; nie wprowadzono zmian schematu bazy
  (brak migracji).
