-- Raport implementacji: konfigurowalny dolny pasek (mobile) — 2026-06-03.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-03',
  'omnia-implementacja-2026-06-03',
  $omnia_impl$# Omnia — Raport implementacji 2026-06-03

## Dolny pasek z ikonami — niezależna, konfigurowalna kolejność (domyślnie: Strona główna, Zadania, Zakupy)

**Diagnoza:** Dolny pasek nawigacji na telefonie (`md:hidden`, `AppShell`) pokazywał zawsze
pierwsze 4 *włączone* moduły w **tej samej kolejności co menu boczne** (`enabled.slice(0, 4)`).
Wymaganie właściciela: pasek ma mieć **inną kolejność niż menu**, ma być **konfigurowalny
w ustawieniach**, a **domyślnie** zawierać ikony: **Strona główna, Zadania, Zakupy**.

**Rozwiązanie:** Rozdzielono stan dolnego paska od stanu menu bocznego — zamiast wyprowadzać
zawartość paska z kolejności menu, pasek dostał własną preferencję użytkownika
(`MenuPrefs.tabBar`), zapisywaną osobno. Dzięki temu kolejność paska jest w pełni niezależna,
a użytkownik może ją zmieniać bez wpływu na menu boczne. Domyślną zawartość paska ustalono na
`["home", "tasks", "shopping"]` (stała `DEFAULT_TAB_BAR`) — zgodnie z wymaganiem. Brak zapisanej
konfiguracji (np. starsi użytkownicy / pusta lista) jest interpretowany jako wartość domyślna,
a gdy użytkownik nie ma uprawnień do wybranych modułów, `resolveTabBar` bezpiecznie wraca do
pierwszych włączonych pozycji menu, więc pasek nigdy nie jest pusty. Liczbę ikon ograniczono do
`MAX_TAB_BAR = 5` (powyżej pasek robi się ciasny). Konfigurację dodano do istniejącego ekranu
**Ustawienia → Menu** (sekcja „Dolny pasek (telefon)"): zmiana kolejności (góra/dół), usuwanie
ikony oraz dodawanie dostępnych modułów (chipy), z zapisem przez tę samą Server Action co reszta
preferencji menu (`updateMenuPrefs`, z `revalidatePath("/", "layout")`).

**Zmienione pliki:**
- `src/lib/modules.tsx` — typ `MenuPrefs` rozszerzony o `tabBar`; stałe `DEFAULT_TAB_BAR`
  (`home/tasks/shopping`) i `MAX_TAB_BAR`; `defaultMenuPrefs()` zwraca domyślny pasek; nowy
  helper `resolveTabBar(permissions, prefs)` (filtr uprawnień, dedup, limit, fallback).
- `src/actions/menuPrefs.ts` — odczyt (`readMenuPrefs`) i zapis (`updateMenuPrefs`) pola
  `tabBar`: walidacja id, deduplikacja (`Array.from(new Set(...))`), ograniczenie do `MAX_TAB_BAR`.
- `src/components/shell/AppShell.tsx` — dolny pasek renderowany z `resolveTabBar(...)` zamiast
  `enabled.slice(0, 4)`.
- `src/components/settings/MenuPrefsEditor.tsx` — nowa sekcja „Dolny pasek (telefon)": lista
  ikon paska z reorderem i usuwaniem oraz chipy do dodawania dostępnych modułów.
- `prisma/schema.prisma` — `UserMenuPref.tabBar String @default("[]")`.
- `prisma/migrations/0074_menu_tabbar_pref/migration.sql` — kolumna `tabBar` (idempotentnie,
  `ADD COLUMN IF NOT EXISTS`).

## Podsumowanie

Sesja obejmowała **1 zadanie** (UX nawigacji mobilnej). Główny obszar zmian: warstwa preferencji
menu (`modules.tsx` + `menuPrefs.ts`) oraz powłoka aplikacji (`AppShell`) i ekran ustawień.
Kluczowa decyzja projektowa: dolny pasek ma **własny, niezależny stan** zamiast być pochodną
kolejności menu — to spełnia wymaganie „inna kolejność" i „konfigurowalność" minimalnym kosztem,
reużywając istniejący model `UserMenuPref` i Server Action `updateMenuPrefs`. Domyślny zestaw to
Strona główna / Zadania / Zakupy. Zmiana schematu wdrożona migracją `0074` (kolumna `tabBar`),
kompatybilna wstecz (brak wartości = domyślny pasek). `npm run build` (prisma generate + next build)
oraz `tsc --noEmit` przechodzą bez błędów.
$omnia_impl$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
