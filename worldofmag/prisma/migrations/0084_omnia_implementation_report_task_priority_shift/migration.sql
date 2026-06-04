-- Raport implementacji: względny bump priorytetu zadań w asystencie AT — 2026-06-04.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- Slug z sufiksem, bo slug bazowy „omnia-implementacja-2026-06-04" koliduje z innymi raportami z tego dnia.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-04 (priorytety zadań: względny bump)',
  'omnia-implementacja-2026-06-04-priorytety-zadan-wzgledny-bump',
  $omnia_impl$# Omnia — Raport implementacji 2026-06-04

## Magiczna ikona: względna zmiana priorytetu zadań („podnieś o 1")

**Diagnoza:** Po magicznej ikonie (asystencie AI) oczekiwano, że polecenie typu
„zwiększ o jeden priorytet dla zadań: odkurzanie, mycie podłóg, ścieranie kurzy"
podniesie priorytet **każdego** zadania o jeden szczebel **względem jego własnego,
obecnego priorytetu** — nawet jeśli te zadania startują z różnych poziomów. Tymczasem
jedyną dostępną akcją zmiany priorytetu był `update_task`, który ustawia **bezwzględną**
wartość. Agent (LLM) musiałby najpierw odczytać priorytet każdego zadania, dodać 1 i
wstawić wynik — w praktyce gubił różnice startowe i ustawiał wszystkim wspólny poziom.
Priorytet to skala porządkowa `NONE < LOW < MEDIUM < HIGH < URGENT`, więc „o 1" znaczy
„o jeden szczebel w górę tej drabiny".

**Rozwiązanie:** Zamiast liczyć deltę po stronie modelu, dodano dedykowaną akcję
**`shift_task_priority { steps, taskId? }`** — bliźniaczą do istniejącej
`shift_task_due_date` (która tak samo przesuwa termin o N dni względem obecnego).
Logikę policzono po stronie **executora**: czyta on aktualny priorytet zadania i
przesuwa go o `steps` szczebli po drabinie, z **klampem** do zakresu (bump powyżej
URGENT / poniżej NONE jest no-opem zamiast błędu, a komunikat to sygnalizuje). Dzięki
temu LLM nie musi znać ani zgadywać wartości wyjściowych — proponuje po prostu osobny
`shift_task_priority` na każde wskazane zadanie, a każde z nich rośnie/maleje względem
siebie. Akcja jest niedestrukcyjna (domyślnie zaznaczona w `ActionDrawer`) i ma pełne
cofnięcie (przywraca dokładny priorytet sprzed zmiany przez `update_task`, bo klamp mógł
„zjeść" część przesunięcia). Opis akcji dopisano do katalogu w prompcie agenta z jawną
wskazówką, by używać jej (per zadanie) zamiast wspólnego `update_task`, gdy ktoś prosi
o „podnieś/zmniejsz priorytet o N".

**Zmienione pliki:**
- `src/app/api/llm/home/execute/route.ts` — helper `shiftPriority` + `PRIORITY_LADDER`; nowy handler `type === "shift_task_priority"` (odczyt obecnego priorytetu, klampowane przesunięcie, undo, komunikat „X → Y" / „bez zmian").
- `src/app/api/llm/home/agent/route.ts` — wpis `shift_task_priority` w katalogu akcji modułu „tasks" z instrukcją preferowania go nad `update_task` przy względnych zmianach.
- `doświadczenia.md` — lekcja: operacje „o N względem obecnego" liczyć po stronie executora; nie używać backticków w stringach katalogu akcji (cały katalog to template literal).

## Podsumowanie

Jedno zadanie z obszaru asystenta AI (magicznej ikony), moduł Zadania. Sednem zmiany
jest przeniesienie arytmetyki „względnej" zmiany priorytetu z modelu językowego do
executora — przez nową akcję `shift_task_priority`, wzorowaną na `shift_task_due_date`.
Eliminuje to klasę błędów, w której LLM spłaszczał różne priorytety startowe do jednej
wartości. Brak zmian w schemacie bazy; guard spójności akcji (`check-action-coverage.js`)
i `next build` przechodzą. Po drodze wyłapano i odnotowano pułapkę z backtickiem w
template-literalowym katalogu akcji, która wywalała build dopiero na etapie SWC.
$omnia_impl$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
