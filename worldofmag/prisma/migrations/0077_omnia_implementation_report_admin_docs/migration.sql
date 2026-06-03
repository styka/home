-- Raport implementacji: podgląd CLAUDE.md / doświadczenia.md w adminie + metryki — 2026-06-03.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-03',
  'omnia-implementacja-2026-06-03-admin-docs',
  $omnia_impl$# Omnia — Raport implementacji 2026-06-03

## Podgląd dokumentacji projektu (CLAUDE.md, doświadczenia.md) w panelu admina + metryki

**Diagnoza:** Admin nie miał w aplikacji dostępu do najnowszej wersji plików
`CLAUDE.md` i `doświadczenia.md` z katalogu głównego repozytorium. Wymaganie: pokazać je
w panelu administratora jako Markdown, **zawsze w najnowszej wersji**, w logicznym miejscu na
takie informacje i **wyłącznie dla admina** — z wyraźnym zastrzeżeniem, że pliki **nie** mają
trafiać jako migracja do Raportów (gdzie szybko by się dezaktualizowały). Dodatkowo: panel
admina miał pokazywać **więcej przydatnych metryk**.

**Rozwiązanie:** Treść obu plików jest „wypiekana" do aplikacji **na etapie builda**, a nie
seedowana jako raport. Skrypt `scripts/copy-docs.js` (uruchamiany jako pierwszy krok
`npm run build`) czyta pliki z katalogu głównego repo i generuje moduł TypeScript
`src/generated/admin-docs.ts` z ich treścią i metadanymi (liczba linii, rozmiar, data
modyfikacji, znacznik czasu synchronizacji). Wybrano zapieczenie do modułu TS zamiast odczytu
z dysku w runtime, bo wdrożony serwer Next.js (standalone) nie ma gwarantowanego dostępu do
plików spoza katalogu aplikacji — moduł trafia do bundla i jest zawsze dostępny. Dzięki temu po
każdym deployu admin widzi aktualną wersję dokumentów, a żaden wpis w bazie nie wymaga ręcznej
aktualizacji. Strona `/admin/docs` jest bramkowana uprawnieniem `module.admin` (jak reszta
admina), więc dostęp ma tylko administrator. Render Markdown reużywa istniejący
`markdownToHtml` + `MARKDOWN_STYLES` (ten sam co Raporty), więc bez nowej zależności i bez
ryzyka XSS (globalne escapowanie `&`/`<`). Plik generowany jest też commitowany, aby
`npm run dev` i `tsc` działały na świeżym klonie bez pełnego builda.

Metryki na stronie `/admin` policzono równolegle (`Promise.all`) bezpośrednio z bazy przez
Prisma `count()` — w dwóch grupach: **system** (użytkownicy, zespoły, raporty, uprawnienia,
aktywność z 7 dni) i **zawartość** (pozycje zakupowe, zadania, notatki, przepisy, zwierzęta,
pozycje magazynu). To tanie zapytania zliczające, bez dociągania rekordów.

**Zmienione pliki:**
- `scripts/copy-docs.js` — nowy skrypt budujący `src/generated/admin-docs.ts` z plików
  `../CLAUDE.md` i `../doświadczenia.md` (fallback gdy brak pliku; metadane: linie/bajty/mtime).
- `package.json` — `build` poprzedzony `node scripts/copy-docs.js` (najpierw świeży snapshot,
  potem `prisma generate && next build && migrate`).
- `src/generated/admin-docs.ts` — wygenerowany moduł z treścią i metadanymi dokumentów
  (`ADMIN_DOCS`, `ADMIN_DOCS_GENERATED_AT`).
- `src/components/admin/AdminDocsViewer.tsx` — klientowy podgląd z zakładkami (przełączanie
  między dokumentami), paskiem metadanych i renderem Markdown.
- `src/app/admin/docs/page.tsx` — nowa strona admina (gated `module.admin`) ładująca dokumenty.
- `src/app/admin/page.tsx` — sekcja **Metryki** (system + zawartość, liczone przez Prisma) oraz
  link „Dokumentacja projektu" w sekcji Narzędzia; helper `MetricCard`.

## Podsumowanie

Sesja obejmowała **1 zgłoszenie** (dwie powiązane potrzeby: podgląd dokumentacji + więcej
metryk dla admina). Główne obszary zmian: **pipeline builda** (nowy krok kopiujący dokumenty),
**panel admina** (nowa strona `/admin/docs` + rozbudowane metryki na `/admin`). Kluczowa decyzja:
dokumenty są **wypiekane przy buildzie** do modułu TS (źródło prawdy = pliki w repo), a nie
trzymane jako rekord w bazie — to spełnia wymóg „zawsze najnowsza wersja" bez ręcznej
synchronizacji i bez zaśmiecania Raportów. Dostęp ograniczony do admina przez istniejący guard
`module.admin`. `npm run build` (copy-docs + prisma generate + next build) oraz `tsc --noEmit`
przechodzą bez błędów.
$omnia_impl$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
