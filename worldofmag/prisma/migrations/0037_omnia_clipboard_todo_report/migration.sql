-- Raport: kopiowanie promptu dla Claude Code bierze tylko zadania w statusie TODO.
-- Slug odrębny (poprzednie 2026-05-29[...] zajęte), bo INSERT używa ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-29 (kopiowanie: tylko TODO)',
  'omnia-implementacja-2026-05-29-clipboard-todo',
  $omnia_clipboard_todo$# Omnia — Raport implementacji 2026-05-29 (kopiowanie: tylko TODO)

Sesja realizująca 1 zgłoszenie: zawężenie zakresu danych kopiowanych przyciskiem „Kopiuj prompt
dla Claude Code" w panelu admina. Zmiana wyłącznie po stronie kodu (bez zmian schematu danych).

---

## Kopiowanie promptu dla Claude Code — tylko zadania „do zrobienia"
**Diagnoza:** Server action `getOmniaTasksForClipboard` zbierał wszystkie zadania projektów „Omnia"
poza `DONE` i `CANCELLED` — czyli także `IN_PROGRESS` i `DEFERRED`. Wymaganie: kopiować wyłącznie
zadania w statusie „do zrobienia" (`TODO`), żeby prompt zawierał tylko realnie czekające zgłoszenia,
bez tych już w toku lub odroczonych.
**Rozwiązanie:** Zmieniono warunek z `status: { notIn: ["DONE", "CANCELLED"] }` na `status: "TODO"`.
Filtr po stronie zapytania Prisma (a nie po pobraniu) — mniej danych z bazy i jeden punkt prawdy.
Reszta logiki (dopasowanie projektów po nazwie „omnia", pominięcie podzadań, sortowanie) bez zmian.
**Zmienione pliki:**
- `src/actions/admin-tools.ts` — `where.status` zawężone do `"TODO"`.

## Podsumowanie
Jedno zgłoszenie, zmiana jednoliniowa w warunku zapytania Server Action, bez zmian schematu DB ani UI.
Główny obszar: panel admina / narzędzie kopiowania zadań. Weryfikacja: `tsc --noEmit` oraz `next build`
— kompilacja czysta. Raport zapisany przez migrację (jak pozostałe w projekcie) → trafia do `/reports`
na deployu.
$omnia_clipboard_todo$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
