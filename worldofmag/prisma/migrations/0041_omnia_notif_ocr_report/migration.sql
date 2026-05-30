-- Raport implementacji 2026-05-30 (niezawodne powiadomienia, dwuetapowy OCR przepisu)
-- → /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-30',
  'omnia-implementacja-2026-05-30',
  $omnia_2026_05_30$# Omnia — Raport implementacji 2026-05-30

Sesja realizująca 2 zgłoszenia (powtórki po wcześniejszych próbach): niezawodność powiadomień
o zadaniach oraz naprawa OCR przepisu ze zdjęcia.

---

## Powiadomienia zadań — działały gorzej (komputer) i wcale (iPhone)
**Diagnoza:** Po poprzednim przejściu na `registration.showNotification` ujawniły się dwa realne
błędy mechanizmu (który jest w całości po stronie klienta, w `TasksPage.tsx`):
1. **Brak timera** — `checkDueNotifications` odpalało się wyłącznie przy montażu komponentu i przy
   zmianie propu `tasks`. Przypomnienie „10 minut przed terminem" pojawiało się więc tylko
   przypadkiem (gdy coś akurat przeładowało listę), a nie o czasie.
2. **Zawieszanie na Service Workerze** — `navigator.serviceWorker.ready` to obietnica, która NIGDY
   nie jest odrzucana. Gdy SW nie był aktywny/zdrowy, `await` wisiał w nieskończoność i nie było
   żadnego fallbacku — to najpewniejsza przyczyna „popsucia na komputerze".
**Rozwiązanie:** Dodano `setInterval` co 30 s (czytający najświeższe zadania przez `tasksRef`, żeby
timer nie patrzył na zadania z pierwszego renderu) — termin jest łapany niezależnie od zmian danych.
Wyświetlanie powiadomienia ściga `serviceWorker.ready` z timeoutem 1,5 s (`Promise.race`); jeśli SW
nie odpowie, spadamy na konstruktor `new Notification()` (desktop). Dzięki temu Service Worker jest
preferowany (wymagany na iOS), ale nigdy nie blokuje powiadomień, gdy jest niedostępny.
**Ograniczenie (świadome):** To są powiadomienia LOKALNE — pokażą się tylko gdy aplikacja/PWA żyje
(pierwszy plan lub świeżo w tle). Na iPhone, gdy aplikacja jest ZAMKNIĘTA, JS nie działa, więc
przypomnienie się nie odpali. Dostarczanie w tle na iOS wymaga **Web Push** (patrz „Następny krok").
**Zmienione pliki:**
- `src/components/tasks/TasksPage.tsx` — `tasksRef` + interwał 30 s; `showTaskNotification` z
  `Promise.race`/timeout i fallbackiem na `new Notification()`.

## „Przepisy ze zdjęcia" — OCR zwracał 503, potem 422
**Diagnoza:** Pierwotny 503 wynikał z wycofanego modelu wizyjnego (naprawione wcześniej — scout).
Nowy objaw to 422 „not-a-recipe" nawet dla czytelnych kartek. Przyczyną NIE był model:
`meta-llama/llama-4-scout-17b-16e-instruct` to właściwy, aktualny model wizyjny Groq (Maverick jest
wycofywany na rzecz tekstowego `gpt-oss-120b`). Problemem było zmuszanie modelu wizyjnego, by w
JEDNYM wywołaniu jednocześnie odczytał zdjęcie i zwrócił sztywny JSON przepisu — model często się
„poddawał" i odsyłał `{"error":"not-a-recipe"}` → 422.
**Rozwiązanie:** Rozdzielono OCR na dwa kroki, bo „czytanie obrazu" i „układanie w JSON" to dwa różne
zadania — łączenie ich w jednym strzale jest kruche (zwłaszcza dla pisma odręcznego):
1. model wizyjny (scout) robi **wierną transkrypcję** całego tekstu ze zdjęcia,
2. model tekstowy (`llama-3.3-70b-versatile`, `response_format: json_object`) układa transkrypcję w
   ustrukturyzowany przepis.
Błąd 422 zwracamy już tylko gdy naprawdę nie udało się odczytać tekstu (z czytelną podpowiedzią o
lepszym zdjęciu). Dodano wspólny helper `groqChat()` i `stripJsonFence()` w `groqVision.ts` (mniej
powtórzeń, spójna obsługa błędów Groq z prawdziwym komunikatem). Trasa per-zdjęcie `ocr-text` także
dostała tryb `json_object` dla pewniejszego parsowania.
**Zmienione pliki:**
- `src/lib/groqVision.ts` — `GROQ_TEXT_MODEL`, helper `groqChat()`, `stripJsonFence()`.
- `src/app/api/llm/kitchen/ocr-image/route.ts` — pipeline dwuetapowy (transkrypcja → strukturyzacja).
- `src/app/api/llm/kitchen/ocr-text/route.ts` — helper `groqChat()` + tryb JSON.

## Następny krok — Web Push (powiadomienia w tle na iPhone)
Uzgodniony plan: lokalna naprawa teraz, Web Push jako kolejny etap. Do wdrożenia background-push
trzeba: kluczy VAPID (env), tabeli subskrypcji push w DB + endpointu zapisu subskrypcji, obsługi
zdarzenia `push` w `sw.js`, biblioteki `web-push` po stronie serwera oraz zewnętrznego wyzwalacza
CRON (np. zaplanowany GitHub Actions co ~5 min uderzający w endpoint), ponieważ Render free usypia
po 15 min i nie ma własnego pewnego schedulera.

## Podsumowanie
Dwa zgłoszenia, oba to powtórki po wcześniejszych próbach. Główne obszary: moduł Zadania
(niezawodność powiadomień klienta) oraz integracja LLM dla kuchni (pipeline OCR). Wspólny wniosek:
w obu wypadkach poprzednie podejście opierało się na zbyt optymistycznym założeniu wobec platformy
zewnętrznej — `serviceWorker.ready` „zawsze się rozwiąże" oraz model wizyjny „odczyta i ustrukturyzuje
w jednym kroku". Rozwiązanie w obu przypadkach to dodanie bezpiecznego fallbacku / rozdzielenie
odpowiedzialności. Build (`next build`) przechodzi. Lekcje dopisane do `doświadczenia.md`.
$omnia_2026_05_30$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
