# Rozdział 12 — AI / LLM: architektura, koszty, prywatność

## Kontekst / stan z kodu

- **Agent Home:** `src/app/api/llm/home/agent/route.ts` (pętla JSON-protokołu po SSE, emituje myśli na
  żywo), `execute/route.ts` (**1467 linii** — egzekutor `AIAction[]`, łańcuch `if (type === …)`),
  `briefing/route.ts`. Narzędzia odczytu/akcji w `src/lib/ai/agentTools.ts`, typ akcji w
  `src/lib/ai/aiAction.ts`.
- **Routing modeli DB-driven:** `src/lib/llm/resolver.ts` + `operationTypes.ts` (`dispatch`,
  `reasoning`, `vision`, `generation`), provider/model per typ operacji z `LlmProvider`/`LlmAssignment`
  (`/admin/llm`). Domyślnie Groq (OpenAI-compatible). Wspólne: `llm/chat.ts` (zwraca model+usage),
  `llm/json.ts`.
- **Kontrola obciążenia:** `src/lib/ai/rateLimit.ts` — limit 20/min + 250/h i strażnik współbieżności
  (max 2), **w pamięci procesu** (in-memory). Trasa agenta zwraca 429 + graceful degradation.
- **Transparentność i odwracalność:** agent sumuje tokeny → `meta` (`MetaFooter` „model · N tok.”);
  akcje przechodzą przez `ActionDrawer` (przegląd przed wykonaniem, destrukcyjne opt-in); usunięcia
  przez AI trafiają do `TrashItem` (odwracalne).
- **Strażnik spójności:** `check-action-coverage.js` wymusza egzekutor dla każdej akcji z katalogu.
- **Ciężkie operacje** (OCR, plan tygodnia) wykonywane **synchronicznie** w żądaniu.

## Głos Zespołu A — Strażnicy

**dr Natalia (AI/ML):** „To bardzo dojrzały agent jak na jednoosobowy projekt — przegląd akcji,
odwracalność, transparentność kosztu, DB-driven routing. Ale **kontrola kosztów jest iluzoryczna przy
skali**: rate-limit i współbieżność są **in-memory**. Przy wielu instancjach (a tego wymaga skala)
każda ma własny licznik — globalny limit przestaje istnieć. To jednocześnie ryzyko **kosztowe** (rachunek
za tokeny) i **nadużyciowe** (jeden user zarzyna budżet).”

**Natalia (c.d.):** „Brakuje **trwałej kolejki** dla ciężkich zadań (OCR, plan tygodnia) — dziś blokują
żądanie. Brakuje **cache odpowiedzi** (te same pytania = te same tokeny płacone wielokrotnie) i
**fallbacku modeli** (gdy Groq pada/limituje, cała funkcja pada).”

**Anna (security):** „Prywatność: wysyłamy treści użytkownika (też wrażliwe — zdrowie!) do zewnętrznego
dostawcy. Trzeba **minimalizacji** i jasnej informacji, co i komu leci (spójne z Z-055).”

**Ewa (QA):** „Halucynacje akcji: agent proponuje `AIAction[]`. Przegląd przed wykonaniem to dobra
siatka, ale potrzebujemy **ewaluacji** — zestawu przypadków testowych, że agent nie tworzy/nie kasuje
rzeczy wbrew intencji.”

## Głos Zespołu B — Pionierzy

**dr Hubert (AI/ML):** „AI to nasz **główny wyróżnik** i serce modelu biznesowego (»tanio dzięki AI«).
Inwestujmy tu odważnie, ale **mądrze kosztowo**: (1) **cache** identycznych/podobnych zapytań, (2)
**tańszy model dla `dispatch`** (klasyfikacja) i drogi tylko dla `reasoning`, (3) **limity per plan**
(darmowy = tańszy model + dzienny budżet tokenów; premium = lepszy model). To jednocześnie obniża koszt
i tworzy naturalną oś monetyzacji.”

**Hubert (c.d.):** „Kolejka? Tak — ale lekka. Nie potrzebujemy Kafki; wystarczy tabela `Job` w
Postgresie + worker. Trwałe, proste, tanie.”

**Wojtek (PO):** „AI może napędzać **wirusowość**: »zapytaj asystenta«, briefingi, raporty. Im lepszy i
tańszy agent, tym więcej możemy dać za darmo — a darmowe napędza wzrost.”

## Punkty sporne

- **Limity in-memory vs trwałe.** Zgoda: przy skali (wiele instancji) trzeba **trwałego** licznika
  (Redis/DB) — inaczej limit nie działa. P1, ale przed skalą.
- **Ile AI za darmo.** Pionierzy: dużo (wzrost). Strażnicy: tyle, ile kontrolujemy kosztowo. **Konsensus:**
  darmowy = tańszy model + dzienny budżet tokenów; AI staje się **dźwignią monetyzacji** (Rozdz. 42, 44).
- **Cache odpowiedzi a świeżość/prywatność.** **Konsensus:** cache deterministycznych, nie-wrażliwych
  operacji (np. kategoryzacja, parsowanie); nie cache’ować treści wrażliwych między userami.

## Głos użytkowników

**Marek (29):** „Asystent jest super, gdy działa szybko. Jak czekam na OCR pół minuty, to się zniechęcam.”
→ kolejka + status zadania zamiast blokady.

**Tadeusz (60):** „Jeśli AI ma robić mi food cost i zamówienia, musi być **niezawodne** — błąd kosztuje
mnie pieniądze.” → fallback modeli i ewaluacja to wymóg dla płatnych funkcji B2B.

## Konsensus i zalecenia

- **Z-130** *(P0 · M)* — **Trwały rate-limit i budżet tokenów per użytkownik/plan** (Redis/DB zamiast
  in-memory). Warunek kontroli kosztów i ochrony przed nadużyciem przy wielu instancjach.
- **Z-131** *(P1 · M)* — **Trwała kolejka zadań ciężkich** (OCR, plan tygodnia, analizy) — tabela `Job`
  + worker; status zadania w UI zamiast blokady żądania.
- **Z-132** *(P1 · M)* — **Cache odpowiedzi LLM** dla operacji deterministycznych/nie-wrażliwych
  (kategoryzacja, parsowanie, powtarzalne pytania) — bezpośrednia oszczędność tokenów.
- **Z-133** *(P1 · S)* — **Fallback modeli/providerów** w `resolver.ts` (gdy podstawowy limituje/pada,
  przełącz na zapas) — niezawodność funkcji AI.
- **Z-134** *(P1 · S)* — **Tańszy model dla `dispatch`/klasyfikacji, drogi tylko dla `reasoning`** —
  optymalizacja kosztu bez utraty jakości tam, gdzie się liczy.
- **Z-135** *(P1 · M)* — **Monitoring kosztów AI** (tokeny/koszt per user/operacja, alert progowy) —
  fundament modelu „darmowe, ale tanie” (spójne z Z-097, Rozdz. 44).
- **Z-136** *(P1 · M)* — **Zestaw ewaluacyjny agenta** (przypadki: nie kasuj/nie twórz wbrew intencji,
  poprawność akcji) uruchamiany w CI — bezpieczeństwo i jakość przy rozwoju.
- **Z-137** *(P1 · S)* — **Minimalizacja danych w promptach** + per-operacja informacja, co trafia do
  dostawcy; opcja wyłączenia AI dla danych wrażliwych (spójne z Z-055).
- **Z-138** *(P2 · M)* — **Rozbić egzekutor `execute/route.ts`** na rejestr handlerów (spójne z Z-010)
  — łatwiejsze testy i ewaluacja akcji.

## Dobre vs złe praktyki

**Dobre:**
- Przegląd akcji przed wykonaniem + destrukcyjne opt-in + odwracalność (kosz) — wzorcowe bezpieczeństwo AI.
- Transparentność kosztu (model + tokeny) i DB-driven routing per typ operacji.
- Strażnik spójności akcji w buildzie; graceful degradation (429).

**Złe / do poprawy:**
- Rate-limit/współbieżność **in-memory** — nie działa przy wielu instancjach (koszt/nadużycie).
- Brak trwałej kolejki (ciężkie operacje blokują żądanie), cache i fallbacku modeli.
- Brak budżetów tokenów per plan i monitoringu kosztów — ryzyko dla modelu „darmowe, ale tanie”.
- Egzekutor-gigant (1467 linii) utrudnia testy/ewaluację.
