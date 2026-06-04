-- Raport implementacyjny: trwałe, nazwane widoki wielu projektów (TaskView) + pasek zakresu.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-04 (zapisane widoki wielu projektów)',
  'omnia-implementacja-2026-06-04-zapisane-widoki-projektow',
  $omnia_task_views$# Omnia — Raport implementacji 2026-06-04

Rozwinięcie widoku wielu projektów na podstawie uwag użytkownika: wersja „na sesję"
(parametr `?projects=` z URL) okazała się myląca (nie było widać, z których projektów
pochodzą zadania) i nietrwała. Druga iteracja wprowadza **zapisane, nazwane widoki wielu
projektów** (per-user, wiele sztuk) oraz samoopisowy interfejs.

---

## Trwałe widoki wielu projektów + czytelny UX
**Diagnoza:** Po wybraniu widoku wielu projektów użytkownik widział listę zadań, ale nie
wiedział, z jakich projektów pochodzą (nagłówek pokazywał tylko licznik; przy ustawieniu
grupowania „po priorytetach" znikały też nagłówki grup per-projekt). Dodatkowo wybór żył
tylko w adresie URL — nie dało się zdefiniować i zapisać kilku własnych, nazwanych
zestawów projektów do wielokrotnego użytku.

**Rozwiązanie:** Wprowadziłem trwały model `TaskView` (własność użytkownika; lista
projektów jako JSON `string[]` — ten sam wzorzec co `statusConfig` czy `UserMenuPref`,
bez tabeli łączącej, zgodnie z konwencją „SQLite = String/JSON"). Powstał komplet Server
Actions (`taskViews.ts`): lista z policzonymi aktywnymi zadaniami (jeden `groupBy` zamiast
N zapytań), tworzenie, edycja i usuwanie — wszystkie filtrują projekty do tych, do których
użytkownik wciąż ma dostęp (skasowane/odebrane znikają cicho).

W panelu bocznym Zadań pojawiła się sekcja **„Widoki"** z listą zapisanych widoków
(emoji + nazwa + licznik), akcjami edycji/usunięcia na hover oraz **inline edytorem**
(emoji, nazwa z auto-podpowiedzią z nazw projektów, lista projektów z checkboxami).
Świadomie zrezygnowałem z dotychczasowego trybu „zaznacz i pokaż" na rzecz jednego,
trwałego przepływu „utwórz widok", żeby nie mnożyć ścieżek i nie przytłaczać.

Kluczowy fix czytelności: pod nagłówkiem widoku renderuje się **pasek zakresu** —
zawsze widoczne chipy projektów (klik prowadzi do pojedynczego projektu), niezależnie od
trybu grupowania. Dzięki temu „z czego jest ta lista" jest oczywiste bez polegania na
nagłówkach grup. Trasa `/tasks/multi` obsługuje teraz `?view=<id>` (zapisany widok) obok
zachowanego dla zgodności `?projects=` (doraźnie). „Ołówek" w pasku zakresu otwiera edycję
widoku (przez `?edit=1`, konsumowane raz, by nie odpalało się po zapisie).

**Zmienione pliki:**
- `prisma/schema.prisma` + `prisma/migrations/0087_task_views/` — nowy model `TaskView` (per-user, `projectIds` JSON) + relacja na `User`.
- `src/actions/taskViews.ts` — nowy: CRUD widoków + liczenie aktywnych zadań (jeden `groupBy`), filtrowanie do dostępnych projektów.
- `src/types/index.ts` — typ `TaskView`.
- `src/app/tasks/[projectId]/page.tsx` — `/tasks/multi` rozwiązuje `?view=` (zapisany) lub `?projects=` (doraźny), buduje `scopeProjects` i przekazuje `multiViewId`.
- `src/components/tasks/TasksPage.tsx` — pasek zakresu (chipy projektów + ołówek do edycji) dla widoku `multi`.
- `src/components/tasks/TasksSideNav.tsx` — sekcja „Widoki" z listą, inline edytorem (emoji/nazwa/checkboxy) i obsługą `?edit=1`; usunięty doraźny tryb zaznaczania.
- `CLAUDE.md` — schemat (`TaskView`), lista Server Actions (`taskViews`), opis trasy `/tasks`.

## Podsumowanie
Druga iteracja jednego zgłoszenia (widok wielu projektów), tym razem ze zmianą schematu
(nowy model `TaskView` + migracja 0087). Główne obszary: model + akcje + nawigacja boczna
Zadań + pasek zakresu na stronie listy. Decyzje projektowe nastawione na trwałość
(nazwane, wielokrotne widoki per-user) i czytelność (zawsze widoczny zakres projektów),
przy minimalnej liczbie ścieżek w UI. Weryfikacja: `node scripts/check-action-coverage.js`
(czysto) oraz `next build` — kompilacja i type-check bez błędów. Raport zapisany przez
migrację → trafia do `/reports` na deployu.
$omnia_task_views$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
