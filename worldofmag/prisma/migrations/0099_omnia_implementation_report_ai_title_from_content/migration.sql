-- Raport implementacyjny: AI tworząc zadanie/notatkę z pojedynczego tekstu
-- traktuje go jako treść, a tytuł generuje na jego podstawie.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-07 (AI: tytuł z treści)',
  'omnia-implementacja-2026-06-07-ai-tytul-z-tresci',
  $omnia_ai_title_from_content$# Omnia — Raport implementacji 2026-06-07

Sesja realizuje jedno zgłoszenie dotyczące asystenta AI: gdy użytkownik tworzy
zadanie lub notatkę i **nie rozdziela wyraźnie tytułu od treści** — podaje tylko
jeden blok tekstu — asystent ma potraktować ten tekst jako **zawartość**
(`description` zadania / `content` notatki), a **tytuł wygenerować** samodzielnie
jako krótką, zwięzłą etykietę na podstawie tej treści (zamiast wrzucać cały tekst
jako tytuł).

---

## Pojedynczy tekst przy tworzeniu zadania/notatki = treść, a tytuł generowany z treści
**Diagnoza:** Przy tworzeniu rekordów przez asystenta to model wypełniający akcje
`create_task` / `create_note` (krok „plan" → `ActionDrawer` → executor) decyduje, co
trafi do `title`, a co do `description`/`content` — executor (`src/app/api/llm/home/
execute/route.ts`) przepuszcza te pola **1:1** bez transformacji. Dla `create_task`
istniała już reguła wiernego przepisania opisu (zgłoszenie z 2026-06-06, migracja
0097), ale nie obejmowała ona przypadku „jeden tekst bez podziału na tytuł i treść",
a dla `create_note` w katalogu akcji nie było **żadnej** wskazówki redakcyjnej —
przez co dłuższy podyktowany tekst potrafił wylądować w całości jako tytuł notatki.

**Rozwiązanie:** Naprawa wyłącznie w prompcie agenta, bez zmian w kodzie wykonawczym
(executor już przepuszcza pola wiernie) — zgodnie z lekcją z poprzedniej sesji, że
mapowanie pól przy tworzeniu rekordów przez AI to kwestia promptu, nie kodu. W
katalogu akcji (`ACTION_CATALOG_BY_MODULE` w `agent/route.ts`) do `create_task` i
`create_note` dodano spójną regułę „TYTUŁ vs TREŚĆ": gdy użytkownik podał tylko
jeden tekst i nie rozdziela tytułu od treści — potraktuj go jako treść
(`description`/`content`) przepisaną wiernie, a `title` wygeneruj jako krótką
etykietę (kilka słów) na jego podstawie; wyjątek pozostawiono dla przypadku, gdy
tekst to wyraźnie sam krótki tytuł (np. „kup mleko") — wtedy idzie do `title`, a
treść jest pominięta. Reguły dla obu akcji są celowo analogiczne, by zachowanie było
spójne między modułami.

**Zmienione pliki:**
- `src/app/api/llm/home/agent/route.ts` — w katalogu akcji modułów `tasks` i `notes` dodano regułę „TYTUŁ vs TREŚĆ" dla `create_task` i `create_note` (pojedynczy tekst → treść; tytuł generowany; wyjątek dla samego krótkiego tytułu).
- `prisma/migrations/0099_omnia_implementation_report_ai_title_from_content/migration.sql` — ten raport.

## Podsumowanie
Jedno zgłoszenie, zamknięte minimalnie i bez zmian w kodzie wykonawczym — całość to
doprecyzowanie promptu agenta, replikowane spójnie dla zadań i notatek. Główny obszar
zmian: katalog akcji asystenta AI (`agent/route.ts`). Weryfikacja: `npm run build`
(prisma generate + next build) przechodzi bez błędów; ostatni, piszący do produkcyjnej
bazy krok build-pipeline (`scripts/migrate.js`) celowo nie był uruchamiany lokalnie.
Raport zapisany przez migrację → trafia do `/reports` na deployu.
$omnia_ai_title_from_content$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
