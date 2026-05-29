-- Raport implementacji zgłoszeń administratora → /admin/reports oraz /reports.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-29',
  'omnia-implementacja-2026-05-29',
  $omnia_impl_2026_05_29$# Omnia — Raport implementacji 2026-05-29

Sesja realizująca listę zgłoszeń administratora: 6 napraw błędów/UX, 2 nowe duże
moduły (Flota, Portfel), 1 zadanie zweryfikowane jako już wykonane. Zadanie ikony
pominięte na wyraźną prośbę (było już naprawione).

---

## Nie działa dodawanie produktów na listę zakupów (mobile)
**Diagnoza:** Widok listy (`ShoppingPage`) nie renderował żadnego pola dodawania —
jedyną drogą była paleta poleceń `Ctrl+K` (tylko desktop). Komponent `QuickAddBar`
istniał, ale był osierocony, a `[listId]/page.tsx` pobierał `categoryNames` i ich nie
przekazywał. Na telefonie dodawanie było więc niemożliwe.
**Rozwiązanie:** Przywrócono widoczne, responsywne pole dodawania zamiast polegać na
skrócie klawiszowym — podpięto istniejący `QuickAddBar` i przekazano `categoryNames`.
Dzięki temu działa tak samo na desktopie i mobile, bez duplikowania logiki dodawania.
**Zmienione pliki:** `src/components/shopping/ShoppingPage.tsx` (render QuickAddBar + prop),
`src/app/shopping/[listId]/page.tsx` (przekazanie `categoryNames`).

## Znikła „magiczna" ikona na mobile
**Diagnoza:** FAB polecenia AI miał `bottom:24; z-index:30`, a mobilny dolny pasek
nawigacji ma `z-40` i wysokość `56px + safe-area` — przycisk chował się pod paskiem.
**Rozwiązanie:** Pozycjonowanie przeniesione na klasy Tailwind i podniesione ponad pasek
na mobile (`bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 z-40`), bo to
respektuje wysokość paska i obszar bezpieczny iOS bez psucia widoku desktop.
**Zmienione pliki:** `src/components/home/AICommandSheet.tsx`.

## Nie działa markdown w opisach zadań
**Diagnoza:** Opis zadania był zawsze surowym `<textarea>` (placeholder kłamał
„Markdown obsługiwany"), choć w repo istnieje `markdownToHtml`/`MARKDOWN_STYLES`
używane w notatkach i raportach.
**Rozwiązanie:** Zastosowano wzorzec „klik = edycja, blur = render" (jak w notatkach),
by nie wprowadzać osobnego trybu podglądu ani nowej zależności — opis renderuje się jako
HTML, a klik wraca do edycji.
**Zmienione pliki:** `src/components/tasks/TaskDetail.tsx`.

## Poprawić wychodzenie ze szczegółów zadania
**Diagnoza:** Szczegóły (panel/mobilny modal) dało się zamknąć tylko małym „X"; na mobile
brak Esc, a fizyczny „wstecz" opuszczał całą stronę zamiast zamknąć panel.
**Rozwiązanie:** Dodano wyraźny przycisk „← Wróć" na mobile oraz integrację z historią
przeglądarki (`pushState`/`popstate`), bo użytkownicy mobilni odruchowo używają gestu/
przycisku wstecz — teraz zamyka on panel, nie nawigację.
**Zmienione pliki:** `src/components/tasks/TaskDetail.tsx`, `src/components/tasks/TasksPage.tsx`.

## Błąd przy dodawaniu zadania „tylko z kompa" (Digest: 3418248394)
**Diagnoza:** Jedyną ścieżką dodania zadania jest `QuickAddTask`→`createTask`; handler
wołał akcję w `startTransition` bez `try/catch`, więc dowolny wyjątek serwera trafiał do
użytkownika jako surowy „Digest" bez komunikatu i bez śladu do diagnozy. Akcja mogła rzucić
m.in. gdy do `assertProjectAccess` trafił identyfikator widoku wirtualnego.
**Rozwiązanie:** Dwutorowo — utwardzono `createTask` (walidacja tytułu, traktowanie
wirtualnych widoków `today/upcoming/overdue/all` jak braku projektu, bezpieczne parsowanie
dat) oraz owinięto wywołanie w `try/catch` z `useToast`. Powód: nawet po naprawie przyczyny
błąd nigdy nie powinien być „cichym digestem" — ma być czytelnym komunikatem.
**Zmienione pliki:** `src/actions/tasks.ts`, `src/components/tasks/QuickAddTask.tsx`.

## Klikalny tytuł aplikacji → strona główna; nazwa działu → strona domowa działu
**Diagnoza:** Logo „Omnia" w sidebarze i nazwa modułu w mobilnym pasku były zwykłym
tekstem; nagłówki podstron działów nie prowadziły do strony domowej działu.
**Rozwiązanie:** Tytuł marki linkuje do `/`, nazwa aktywnego modułu (mobile) do strony
działu; `PageHeader` dostał opcjonalny `href`, a nagłówki Zadań i Zakupów linkują do
`/tasks` / `/shopping`. Wybrano linki zamiast handlerów `onClick`, by działała nawigacja
klawiaturą i otwieranie w nowej karcie.
**Zmienione pliki:** `src/components/shell/ModuleSidebar.tsx`, `src/components/shell/AppShell.tsx`,
`src/components/ui/home/PageHeader.tsx`, `src/components/tasks/TasksPage.tsx`,
`src/components/shopping/ShoppingPage.tsx`.

## Nowy dział: Flota
**Diagnoza:** Wymagany nowy moduł — od gospodarstwa z kilkoma autami po małą firmę:
serwisy, opony, tankowania/zużycie, terminy.
**Rozwiązanie:** MVP gotowe na rozbudowę: rejestr pojazdów, terminy przeglądu/OC z
pod­świetleniem (czerwony po terminie, bursztyn < 30 dni), log tankowań z wyliczaniem
zużycia metodą „full-to-full" i wykresem, historia serwisów/opon. Własność prywatna lub
zespołowa (jak w innych modułach). Zaawansowana logistyka/wielu kierowców świadomie odłożona.
**Zmienione pliki:** modele `Vehicle`/`FuelLog`/`ServiceRecord` (`prisma/schema.prisma`,
migracja `0033`), `src/actions/flota.ts`, `src/lib/flota.ts`, `src/app/flota/**`,
`src/components/flota/**`, wpięcie w shell/permisje/seed.

## Nowy dział: Portfel
**Diagnoza:** Wymagany moduł finansów: portfel prywatny i partnerski, wiele źródeł
majątku, sumy, przychody/rozchody, historia zmian salda do wykresów i prognoza oszczędzania.
**Rozwiązanie:** Elementy portfela (konto/oszczędności/inwestycja/nieruchomość/należność/
dług) z własnością prywatną i zespołową. Kluczowa decyzja: **każda** zmiana salda zapisuje
wpis `WalletEntry` z saldem wynikowym — to daje wiarygodny szereg czasowy do wykresów
(element i całość) bez rekonstrukcji. Majątek netto liczy długi na minus; prognoza tempa
oszczędzania to regresja liniowa po historii. Dodano lekki, bezzależnościowy `LineChart`
(SVG), reużyty również we Flocie — zamiast ciągnąć bibliotekę wykresów.
**Zmienione pliki:** modele `WalletElement`/`WalletEntry` (`prisma/schema.prisma`, migracja
`0033`), `src/actions/portfel.ts`, `src/lib/portfel.ts`, `src/components/ui/LineChart.tsx`,
`src/app/portfel/**`, `src/components/portfel/**`, wpięcie w shell/permisje/seed.

## Testy e2e (klikacze)
**Diagnoza:** Zadanie zgłoszone jako do zrobienia, lecz strona instrukcji już istnieje.
**Rozwiązanie:** Zweryfikowano obecność `/admin/e2e` (panel admina, sekcja Narzędzia) —
bez zmian w kodzie. Oznaczone jako ukończone we wcześniejszej sesji.
**Zmienione pliki:** brak.

---

## Podsumowanie
Zrealizowano 8 zadań wymagających zmian + 1 zweryfikowane jako gotowe; ikona pominięta na
prośbę. Główne obszary: **Zakupy** (przywrócone dodawanie na mobile), **Zadania** (markdown,
wychodzenie ze szczegółów, twardszy `createTask` + Toast), **powłoka** (klikalne nagłówki,
FAB nad paskiem) oraz **dwa nowe moduły** — Flota i Portfel — z modelami danych, akcjami,
UI w ciemnym motywie, gatingiem (permisje → ADMIN), migracją `0033` i wpięciem w nawigację.
Dodano wspólny `LineChart` (bez zależności). Weryfikacja: `prisma validate`, `prisma
generate`, `tsc --noEmit` oraz `next build` — kompilacja czysta (połączenie z bazą wymagane
tylko dla post-build migracji na środowisku z Postgresem). Moduły to celowe MVP dla rodziny/
jednoosobowej firmy, z architekturą gotową na rozbudowę (wielu kierowców, budżety, transfery).
$omnia_impl_2026_05_29$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
