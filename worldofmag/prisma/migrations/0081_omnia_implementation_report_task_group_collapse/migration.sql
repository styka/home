-- Raport implementacji: zwijane grupy na listach zadań (domyślnie rozwinięte) — 2026-06-04.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- Slug z sufiksem, bo slug bazowy „omnia-implementacja-2026-06-04" może kolidować z innymi raportami z tego dnia.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-04 (zadania: zwijane grupy)',
  'omnia-implementacja-2026-06-04-zadania-zwijane-grupy',
  $omnia_impl$# Omnia — Raport implementacji 2026-06-04

## Zwijane grupy na listach zadań (dziś / nadchodzące / wszystkie / priorytety)

**Diagnoza:** Na liście zadań tylko jedna sekcja — „Zrobione / Anulowane"
(`CompletedSection`) — była zwijana (domyślnie zwinięta, nagłówek-przycisk z obracaną
strzałką). Wszystkie pozostałe grupy renderowane przez `TaskList` miały „głuche"
nagłówki: dni w widoku „Nadchodzące", projekty w „Wszystkie", priorytety w „Dziś"
i widoku projektu, a także sekcja „Bez terminu". Wymaganie właściciela: **każda grupa
na listach zadań ma być zwijana** tak jak „Zrobione / Anulowane", ale — w przeciwieństwie
do tamtej — **domyślnie rozwinięta**.

**Rozwiązanie:** Zamiast dublować logikę zwijania w wielu miejscach `TaskList`, wydzielono
jeden wspólny komponent prezentacyjny `TaskGroup`, który przejął wygląd i zachowanie
nagłówka z `CompletedSection` (sticky nagłówek-przycisk, `ChevronRight` obracany o 90°,
licznik w nawiasie, `aria-expanded`). Komponent przyjmuje dwa parametry sterujące:
`defaultOpen` (domyślnie `true` — zwykłe grupy są rozwinięte) oraz `muted` (wycisza kolor
nagłówka do `--text-muted` tam, gdzie oryginał tego używał — priorytety, „Bez terminu",
„Zrobione"). Dzięki temu różnica między grupami zwykłymi a „Zrobione / Anulowane" sprowadza
się wyłącznie do przekazania `defaultOpen={false}`. `CompletedSection` zostało przepięte
na `TaskGroup`, a wszystkie trzy ścieżki grupowania w `TaskList` (dni, projekty, priorytety)
oraz sekcja „Bez terminu" zamieniono z `div`-nagłówków na `TaskGroup`. Stan zwinięcia jest
lokalny per-grupa (`useState`), zgodnie z istniejącym wzorcem `CompletedSection`. Kolory,
odstępy i sticky-nagłówki zachowano 1:1, więc wygląd nie zmienia się poza dodaną strzałką.

**Zmienione pliki:**
- `src/components/tasks/TaskGroup.tsx` — nowy wspólny komponent zwijanej grupy (`defaultOpen`, `muted`, licznik, strzałka, a11y).
- `src/components/tasks/CompletedSection.tsx` — przepięte na `TaskGroup` z `defaultOpen={false}` (zachowuje domyślne zwinięcie).
- `src/components/tasks/TaskList.tsx` — nagłówki grup dni/projektów/priorytetów oraz „Bez terminu" zamienione na `TaskGroup` (domyślnie rozwinięte); dodany import.

## Podsumowanie

Jedno zadanie z obszaru UX modułu Zadania. Główna zmiana to wydzielenie wspólnego
komponentu `TaskGroup` i ujednolicenie na nim wszystkich grup na listach zadań — teraz
każda grupa jest zwijana (domyślnie rozwinięta), a „Zrobione / Anulowane" pozostaje
domyślnie zwinięte. Brak zmian w schemacie bazy i logice danych; refaktor czysto
prezentacyjny, `npm run build` (prisma generate + next build) przechodzi bez błędów.
$omnia_impl$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
