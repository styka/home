-- Raport implementacji zgłoszeń (ikony + powiadomienia) → /admin/reports oraz /reports.
-- Slug odrębny od 0034 (omnia-implementacja-2026-05-29 jest już zajęty przez poprzednią sesję),
-- bo INSERT używa ON CONFLICT (slug) DO NOTHING — ten sam slug zostałby cicho pominięty.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-29 (ikony, powiadomienia)',
  'omnia-implementacja-2026-05-29-ikony-powiadomienia',
  $omnia_icons_notif$# Omnia — Raport implementacji 2026-05-29 (ikony, powiadomienia)

Sesja realizująca 3 zgłoszenia administratora. Jedno (instrukcja E2E w adminie) okazało się
już wykonane — zweryfikowane bez zmian. Dwa wymagały poprawek, obie wyłącznie po stronie kodu
(brak zmian schematu DB).

> Uwaga: wcześniejsza sesja utworzyła już raport o slugu `omnia-implementacja-2026-05-29`
> (migracja `0034`, inny zakres). Ten raport dostał odrębny slug, by go nie nadpisać i nie
> zostać pominiętym przez `ON CONFLICT DO NOTHING`.

---

## Manualnie uruchomić testy e2e (klikacze)
**Diagnoza:** Wymagana łatwa do znalezienia instrukcja uruchamiania testów-klikaczy E2E w panelu admina.
**Rozwiązanie:** Zweryfikowano, że funkcjonalność jest już w pełni wdrożona (commit `afc50f0`) — nie
trzeba było jej tworzyć ponownie. Strona `/admin/e2e` („Testy klikacze E2E — jak uruchomić") zawiera
szybki start, tabelę trybów, sekcję o relacji do produkcji i bezpieczeństwie; jest podlinkowana z sekcji
„Narzędzia" na `/admin`, a cross-referencje są w `e2e/README.md` i `CLAUDE.md`. Odnotowane jako
zweryfikowane, brak dalszych zmian.
**Zmienione pliki:** brak (zadanie było już zrealizowane wcześniej).

## Popraw ikony/logo aplikacji — margines 2px (dev i prod)
**Diagnoza:** Pierścienie logo sięgały niemal krawędzi ikony — brak świadomego marginesu. Wszystkie
ikony (favicon 64, apple-touch 180, PWA 192/512) i logo w DOM renderują się z jednego SVG w siatce
100×100, więc realny zasięg grafiki to `R + sw/2` (połowa grubości pociągnięcia liczy się do marginesu).
**Rozwiązanie:** Wprowadzono stałą `MARGIN = 2` i policzono promień zewnętrzny od krawędzi pociągnięcia:
`R = 50 - MARGIN - MAX_SW/2` (= 45.5). Dzięki temu margines jest jednolity i niezależny od rozmiaru
ikony (decyzja użytkownika: ten sam margines wszędzie). Wewnętrzne pierścienie kurczą się automatycznie
(`r *= K`), więc „dopasowanie okręgów" wynika z jednej zmiany. Kolory, marker DEV i kształt nietknięte.
Podbito `ICON_VERSION` (2→3), by iOS odświeżył cache apple-touch-icon.
**Zmienione pliki:**
- `src/lib/brandLogo.ts` — margines liczony od krawędzi stroke'a (promień zewnętrzny 45.5).
- `src/lib/appName.ts` — `ICON_VERSION` 2→3.

## Podwójne powiadomienie zadania + brak nazwy projektu
**Diagnoza:** Powiadomienie „Zadanie za chwilę: …" przychodziło dwukrotnie i nie wskazywało projektu
(tylko tytuł + „from Omnia"). Źródło dubla: `checkDueNotifications()` wołane z `useEffect([tasks])`
odpalało `new Notification(...)` przy każdej zmianie propu `tasks` (re-render / rewalidacja), bez
deduplikacji. „from Omnia" to nazwa PWA doklejana przez system jako źródło — nieusuwalna z kodu.
**Rozwiązanie:** Dedup przez `useRef<Set<string>>` z kluczem `id:dueDate` (przeżywa re-rendery;
re-notyfikacja tylko po zmianie terminu). Treść powiadomienia uzupełniono o nazwę projektu (z emoji),
więc widać konkretny projekt zamiast samej marki. Typ `Task` i `getTasks` już dostarczały
`project { name, emoji, isInbox }`, więc bez zmian w DB.
**Zmienione pliki:**
- `src/components/tasks/TasksPage.tsx` — dedup notyfikacji + nazwa projektu w treści.

## Podsumowanie
Sesja objęła 3 zgłoszenia. Jedno (instrukcja E2E w adminie) okazało się już zrealizowane — zweryfikowane
bez zmian. Dwa wymagały poprawek, obie wyłącznie po stronie kodu (brak zmian schematu danych): jednolity
margines ikon liczony poprawnie od krawędzi pociągnięcia (z bumpem `ICON_VERSION`) oraz naprawa
powiadomień zadań (deduplikacja podwojonych notyfikacji + wskazanie konkretnego projektu w treści).
Główne obszary: branding/ikony (`brandLogo.ts`, `appName.ts`) i moduł Tasks (`TasksPage.tsx`).
Raport zapisano przez migrację (jak pozostałe raporty w projekcie), więc trafia do `/reports` na deployu.
Lekcje dopisano do `doświadczenia.md`.
$omnia_icons_notif$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
