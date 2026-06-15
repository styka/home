# Dodatek A.7 — Plany wdrożenia: AI / LLM

Plany realizujące zalecenia z Rozdz. 12. Kluczowe dla rentowności (koszt AI to główna zmienna modelu).

---

## Plan Z-130 (P0) — Trwały rate-limit i budżet tokenów per użytkownik/plan

**Cel:** kontrola kosztów i ochrona przed nadużyciem przy wielu instancjach.
**Kroki:**
1. Przenieść licznik z in-memory (`src/lib/ai/rateLimit.ts`) do **trwałego store’u** (Redis/KV lub
   tabela `AiUsage { ownerId, window, count, tokens }`).
2. Limity zależne od planu (darmowy: dzienny budżet tokenów + tańszy model; premium: większy).
3. Trasa agenta sprawdza budżet przed wywołaniem; 429 + czytelny komunikat przy przekroczeniu.
**Pliki:** `src/lib/ai/rateLimit.ts`, model/KV, `/api/llm/home/agent`.
**Kryteria:** limit działa globalnie (niezależnie od instancji); darmowy ma egzekwowany dzienny budżet.
**Zależność:** plan/billing (A.10) dla rozróżnienia poziomów.

---

## Plan Z-131 (P1) — Trwała kolejka zadań ciężkich

Patrz **plan Z-074 (A.4)** — wspólny model `Job` obsługuje OCR, plan tygodnia, analizy oraz eksport RODO.

---

## Plan Z-132 (P1) — Cache odpowiedzi LLM

**Cel:** nie płacić wielokrotnie za te same tokeny.
**Kroki:** dla operacji **deterministycznych/nie-wrażliwych** (kategoryzacja, parsowanie, powtarzalne
pytania) cache po haszu wejścia (KV/tabela) z TTL; **nie** cache’ować treści wrażliwych między userami.
**Kryteria:** powtórne identyczne zapytanie nie woła modelu; brak wycieku między userami.

---

## Plan Z-133 (P1) — Fallback modeli/providerów

**Cel:** niezawodność, gdy podstawowy provider limituje/pada.
**Kroki:** w `src/lib/llm/resolver.ts` dodać listę fallback per typ operacji; przy błędzie/429 przełączyć
na zapas; logować przełączenia.
**Kryteria:** awaria Groqa nie wywala funkcji AI (degradacja na model zapasowy).

---

## Plan Z-134 (P1) — Tańszy model dla `dispatch`

**Cel:** obniżyć koszt klasyfikacji/parsowania bez utraty jakości tam, gdzie się liczy.
**Kroki:** w `/admin/llm` przypisać tańszy model do `dispatch`, droższy tylko do `reasoning`;
zweryfikować jakość na zestawie (plan Z-136).
**Kryteria:** koszt operacji `dispatch` spada; jakość `reasoning` bez regresji.

---

## Plan Z-135 / Z-097 (P1) — Monitoring kosztów AI

**Cel:** widzieć i alarmować koszt.
**Kroki:** zapisywać `usage` (tokeny/koszt) per user/operacja (agent już zwraca `meta`); panel w
`/admin/health` lub osobny; alert progowy.
**Kryteria:** widać koszt per user/operacja; alert przy przekroczeniu progu.

---

## Plan Z-136 (P1) — Zestaw ewaluacyjny agenta

**Cel:** bezpieczeństwo i jakość akcji AI przy rozwoju.
**Kroki:** zbiór przypadków (wejście → oczekiwana/zabroniona akcja: „nie kasuj wbrew intencji”,
poprawność `AIAction`); uruchamiać w CI (plan Z-181 też tu pasuje).
**Kryteria:** regresja jakości/bezpieczeństwa agenta jest łapana w CI.

---

## Pozostałe

- **Z-137 (P1)** — minimalizacja danych w promptach — patrz plan A.3 (Z-055).
- **Z-138 (P2)** — rozbić egzekutor — patrz plan A.2 (Z-010).

**Kolejność:** Z-130 → Z-134 → Z-132 → Z-133 → Z-135 → Z-136 → reszta.
