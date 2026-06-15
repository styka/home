# Rozdział 16 — Home / Asystent AI

## Kontekst / stan z kodu

Moduł Home to **pulpit + globalny asystent AI** — wizytówka całego produktu i najsilniejszy
wyróżnik. Składa się z trzech warstw: spersonalizowanego dashboardu, „magicznej ikony” (czat
agentowy) oraz porannego briefingu.

- **Pulpit** — `src/components/home/HomePage.tsx` (495 linii): powitanie zależne od pory dnia,
  podsumowania modułów (`ModuleSnapshotGrid`, `TodaySnapshot`), karta briefingu, sekcje
  przestawialne i ukrywalne. Personalizacja przez `src/actions/dashboardPrefs.ts` (34 linie) —
  kolejność/widoczność sekcji jako JSON string (`order`/`hidden`, `.slice(0, 40)`), model
  `DashboardPref` (`@unique userId`).
- **Asystent (czat)** — `src/components/home/AICommandSheet.tsx` (**1225 linii**): pełnoekranowy
  arkusz, wątek wiadomości user/assistant, historia rozmów, dyktowanie głosem, upload obrazu
  (limit 8 MB po stronie klienta), tryb „zgłoś błąd” (point-at-element). Przegląd akcji w
  `ActionDrawer.tsx` (576 linii) z **destrukcyjnymi opt-in** (odznaczone domyślnie).
- **Agent** — `src/app/api/llm/home/agent/route.ts` (704 linie): pętla JSON-protokołu (max 6
  iteracji, max 4 narzędzia/iterację), dwustopniowy routing modułów (tani regex → LLM dispatch),
  streaming SSE z myślami na żywo, przycinanie historii do 12 wiadomości. Narzędzia odczytu w
  `src/lib/ai/agentTools.ts` (601 linii, 22+ tooli, twardy limit 60 rekordów). Typ akcji w
  `src/lib/ai/aiAction.ts` (30 linii).
- **Egzekutor** — `src/app/api/llm/home/execute/route.ts` (**1467 linii**): jeden łańcuch
  `if (type === …)` mapujący `AIAction[]` na Server Actions, dorabiający akcję `undo`.
- **Briefing** — `src/app/api/llm/home/briefing/route.ts` (98 linii): agreguje kalendarz + zaległe
  zadania, jedno wywołanie LLM, ścieżka „no-op” bez tokenów gdy brak zdarzeń.
- **Pamięć rozmów** — `src/actions/aiConversations.ts` (116 linii), modele `AiConversation`/
  `AiMessage` (per-user, `kind` text/plan/report/navigate/clarify/results, sidecar `data: Json?`).
- **Kontrola obciążenia** — `src/lib/ai/rateLimit.ts` (56 linii): 20/min + 250/h + max 2 współbieżne,
  **w pamięci procesu**.

## Mocne strony

- **Bezpieczeństwo akcji AI klasy produkcyjnej**: przegląd w `ActionDrawer`, destrukcyjne opt-in,
  odwracalność przez kosz (`TrashItem`), `check-action-coverage.js` wymusza egzekutor dla każdej akcji.
- **Transparentność kosztu**: agent sumuje tokeny → `MetaFooter` „model · N tok.”.
- **Routing modeli DB-driven** per typ operacji i **dwustopniowy routing modułów** ograniczający tokeny.
- **Streaming myśli (SSE)** z gracefulnym spadkiem do JSON — bardzo dobry UX odczuwalny natychmiast.
- **Ukrywanie ID za `searchQuery`** w `ActionDrawer` — użytkownik widzi przyjazne nazwy, nie identyfikatory.

## Głos Zespołu A — Strażnicy

**dr Natalia Wiśniewska (AI/ML):** „To dojrzały agent, ale jego dwa największe pliki —
`execute/route.ts` (1467 linii) i `AICommandSheet.tsx` (1225 linii) — to **monolity nie do
przetestowania jednostkowo**. Egzekutor-gigant w stylu `if (type === …)` łatwo gubi przypadki i
uniemożliwia ewaluację akcji. Bez **zestawu ewaluacyjnego** nie udowodnimy, że agent nie skasuje
czegoś wbrew intencji.”

**Anna Dąbrowska (security):** „Preferencje użytkownika i `routeHint` wstrzykiwane są wprost w
prompt (`agent/route.ts` ~649) — to **wektor prompt-injection**. Złośliwa treść w polach lub
preferencjach może próbować nadpisać instrukcje systemowe. Druga sprawa: do zewnętrznego LLM lecą
treści ze **wszystkich modułów**, w tym zdrowia. Potrzebujemy minimalizacji i jasnej informacji,
co i komu wysyłamy (spójne z Z-055, Z-137).”

**Michał Zawadzki (tech lead):** „`acquireSlot()` zwalniany jest w `finally`, ale jeśli wyjątek
poleci przed jego pozyskaniem, slot wisi do timeoutu — user zostaje zablokowany. A wykonanie 5 akcji
**nie jest transakcyjne**: gdy #3 padnie, #1–2 są już zapisane, #4–5 nie ruszą. Brak roll-backu.”

**Ewa Kaczmarek (QA):** „`getAiConversation()` ładuje **wszystkie** wiadomości rozmowy — przy 500+
to OOM. Lista rozmów też bez paginacji. I `data: Json?` w `AiMessage` jest **nieograniczone** —
plan 1000 akcji albo wielki log wpadną do jednego wiersza.”

## Głos Zespołu B — Pionierzy

**dr Hubert Stefański (AI/ML):** „AI to **serce modelu biznesowego** (»tanio dzięki AI«). Tu
inwestujemy odważnie, ale mądrze kosztowo: tańszy model dla `dispatch`, drogi tylko dla `reasoning`,
cache deterministycznych operacji, **budżet tokenów per plan** (darmowy = tańszy model + dzienny
limit). To jednocześnie obniża rachunek i tworzy naturalną oś monetyzacji.”

**Wojtek Krawczyk (PO):** „Briefing, raporty, »zapytaj asystenta« to **paliwo wirusowości**. Im
lepszy i tańszy agent, tym więcej damy za darmo. Personalizacja pulpitu (`DashboardPref`) to dobry
fundament — zróbmy z niej **onboarding**: »ułóż sobie ekran startowy« jako pierwszy wow-moment.”

**Ola Sokołowska (UX):** „Czat ma już Stop/Copy/Regenerate i myśli na żywo — to klasa premium.
Brakuje **trwałego undo** (dziś żyje w stanie Reacta i ginie po odświeżeniu) oraz **statusu zadań
ciężkich** zamiast blokady (OCR potrafi wisieć pół minuty). Damian zrobi lekką tabelę `Job` + worker
— bez Kafki.”

**Damian Wróbel (dev):** „Egzekutor rozbijmy na **rejestr handlerów** (mapa `type → handler`).
To nie refactor dla sztuki — to warunek testów, ewaluacji i dorzucania akcji bez psucia reszty.”

## Punkty sporne

- **Limity in-memory vs trwałe.** Zgoda obu zespołów: przy wielu instancjach licznik w pamięci nie
  działa (każda instancja ma swój), więc per-user limit przestaje istnieć. To ryzyko kosztowe i
  nadużyciowe → trwały licznik (Redis/DB) przed skalą (spójne z **Z-130**).
- **Ile AI za darmo.** Pionierzy: dużo (wzrost). Strażnicy: tyle, ile kontrolujemy kosztowo.
  **Konsensus:** darmowy = tańszy model + dzienny budżet; AI jako dźwignia monetyzacji.
- **Monolity vs tempo.** Strażnicy chcą rozbicia teraz; Pionierzy — gdy zacznie boleć. **Konsensus:**
  rozbić egzekutor (warunek ewaluacji), `AICommandSheet` zostawić, ale wydzielić logikę sieciową.

## Głos użytkowników

**Marek (29):** „Asystent jest super, dopóki działa szybko. Jak czekam na OCR pół minuty bez żadnego
statusu, to się zniechęcam.” → kolejka + status zadania zamiast blokady.

**Helena (68):** „Lubię, że mogę napisać po ludzku »dodaj mleko do listy«. Ale przestraszyłam się,
gdy zaproponował skasowanie. Dobrze, że było odznaczone.” → destrukcyjne opt-in to właściwa decyzja;
warto dodać wyraźniejsze podsumowanie „co się stanie”.

## Konsensus i zalecenia

- **Z-210** *(P0 · M)* — **Zabezpieczenie przed prompt-injection.** Cytować/escapować dane
  użytkownika i `routeHint` w promptach; oddzielić instrukcje systemowe od treści użytkownika
  (spójne z Z-055, Z-137). Wrażliwe (zdrowie) — opcja wyłączenia AI.
- **Z-211** *(P0 · S)* — **Gwarantowane zwolnienie slotu współbieżności.** `try/finally` na
  najwyższym poziomie trasy agenta — eliminacja blokady użytkownika po wyjątku.
- **Z-212** *(P1 · M)* — **Transakcyjne wykonanie planu akcji.** Pre-walidacja wszystkich akcji
  przed startem; albo wszystko, albo nic (lub jasne wskazanie, co wykonano i jak posprzątać).
- **Z-213** *(P1 · M)* — **Rozbicie egzekutora `execute/route.ts` na rejestr handlerów**
  (`type → handler`) — warunek testów i ewaluacji akcji (spójne z Z-010, Z-138).
- **Z-214** *(P1 · M)* — **Zestaw ewaluacyjny agenta w CI** (przypadki: nie kasuj/nie twórz wbrew
  intencji, poprawność akcji, halucynacje) — bezpieczeństwo i jakość przy rozwoju (spójne z Z-136).
- **Z-215** *(P1 · S)* — **Paginacja historii rozmów** (`getAiConversation`, lista rozmów) + limit
  rozmiaru `AiMessage.data` — ochrona pamięci i czasu ładowania.
- **Z-216** *(P1 · S)* — **Trwałe undo planu.** Zapis snapshotu planu w DB przy wejściu do
  `ActionDrawer` — cofnięcie przeżywa odświeżenie strony.
- **Z-217** *(P1 · S)* — **Cache i status zadań ciężkich** (OCR, plan tygodnia) — lekka tabela
  `Job` + worker; status w UI zamiast blokady żądania (spójne z Z-131).
- **Z-218** *(P2 · S)* — **Walidacja kluczy sekcji pulpitu** w `dashboardPrefs.ts` (whitelist
  znanych sekcji) — brak „martwych” pozycji po literówce w JSON.
- **Z-219** *(P2 · S)* — **Wykorzystanie nieużywanego pola `AiConversation.summary`** do streszczania
  starszych tur — wyższa higiena kontekstu i niższy koszt tokenów w długich rozmowach.

## Dobre vs złe praktyki

**Dobre:**
- Przegląd akcji + destrukcyjne opt-in + odwracalność (kosz) — wzorcowe bezpieczeństwo AI.
- Strażnik spójności akcji w buildzie; transparentność kosztu (model + tokeny).
- Streaming myśli SSE z gracefulnym spadkiem; dwustopniowy routing modułów oszczędzający tokeny.

**Złe / do poprawy:**
- Monolity: egzekutor 1467 linii (`if`-łańcuch) i arkusz 1225 linii — utrudniają testy i ewaluację.
- Prompt-injection przez preferencje/`routeHint`; brak minimalizacji danych wrażliwych w promptach.
- Slot współbieżności może wisieć po wyjątku; wykonanie planu nie jest transakcyjne.
- Brak paginacji rozmów i nielimitowane `AiMessage.data`; undo żyje tylko w pamięci klienta.
