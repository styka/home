-- Raport implementacyjny: zmiana statusu/terminu zadania nie zamyka już panelu
-- szczegółów/edycji, gdy zadanie wypada z bieżącego (filtrowanego) widoku.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).
-- Slug świadomie odróżniony od „omnia-implementacja-2026-06-14" (zajęty przez inny
-- raport na develop), bo ON CONFLICT (slug) DO NOTHING pominąłby wstawienie.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-14 (trwałość szczegółów zadania)',
  'omnia-implementacja-2026-06-14-trwalosc-szczegolow-zadania',
  $omnia_task_detail_sticky$# Omnia — Raport implementacji 2026-06-14

Sesja realizuje jedno zgłoszenie UX z modułu Zadania: zmiana statusu lub terminu
zadania, która sprawia, że zadanie znika z aktualnej listy, nie powinna zamykać
otwartego panelu szczegółów/edycji tego zadania. Z listy ma zniknąć — owszem —
ale sekcja edycji ma pozostać otwarta.

---

## Ustawienie statusu lub terminu zadania
**Diagnoza:** W `TasksPage` (`src/components/tasks/TasksPage.tsx`) aktualnie
otwarte zadanie (`openTask`) było wyliczane **wyłącznie** z propu `tasks` — listy
zadań filtrowanej serwerowo dla bieżącego widoku (projekt / „Dziś" / „Nadchodzące"
/ „Zaległe" / „Wszystkie"). Server Action edytujący zadanie kończy się
`revalidatePath()`, więc po zmianie statusu lub terminu lista `tasks` jest
odświeżana. Jeśli zmiana wypycha zadanie z widoku (np. ukończenie zadania w
widoku pokazującym tylko aktywne, albo przesunięcie terminu poza „Dziś"), to
zadania nie ma już w nowej `tasks`, `tasks.find(...)` zwraca `undefined`,
`openTask` staje się `null`, a panel szczegółów — renderowany warunkowo
`{openTask && …}` — **odmontowuje się i zamyka**. Użytkownik tracił kontekst
edycji w trakcie pracy nad zadaniem.

Co istotne: w kodzie istniał już dokładnie ten sam problem rozwiązany punktowo dla
**świeżo utworzonych** zadań (fallback `justCreated`) — nowe zadanie w widokach
wirtualnych trafia do Skrzynki bez terminu i nie wchodzi do przefiltrowanej
`tasks`, więc trzymano jego obiekt osobno, żeby panel się otworzył. To był sygnał,
że problem jest ogólniejszy niż jeden przypadek.

**Rozwiązanie:** Zamiast mnożyć łatki na kolejne przypadki, uogólniono istniejące
obejście do „sticky" referencji otwartego zadania (`openTaskSnapshot`):

- `liveOpenTask` — świeża wersja z listy (z dotychczasowym fallbackiem na
  `justCreated`).
- `openTaskSnapshot` — migawka ostatniej znanej wersji otwartego zadania;
  odświeżana w `useEffect` zawsze, gdy `liveOpenTask` jest dostępne.
- `openTask = liveOpenTask ?? (openTaskSnapshot dla bieżącego openTaskId)` — gdy
  zadanie wypadnie z widoku, panel pokazuje migawkę zamiast się zamykać.

Migawka jest **wiązana z aktualnym `openTaskId`** (`openTaskSnapshot?.id === openTaskId`),
żeby po otwarciu innego zadania nie mignęła poprzednia wersja, i jest **czyszczona
przy zamknięciu** panelu (rozszerzony istniejący efekt sprzątający `justCreated`).
Sam formularz `TaskDetail` trzyma własny stan lokalny pól i mutuje po stałym
`task.id`, więc dalsza edycja działa poprawnie również wtedy, gdy źródłem jest
migawka. Zadanie znika z listy zgodnie z oczekiwaniem (lista nadal renderuje się z
`tasks`) — zmiana dotyczy wyłącznie trwałości panelu szczegółów. Rozwiązanie jest
spójne z nowymi widokami listy (Kanban/Timeline), bo wszystkie wołają ten sam
`setOpenTaskId`.

**Zmienione pliki:**
- `src/components/tasks/TasksPage.tsx` — dodany stan `openTaskSnapshot`; rozdzielenie `openTask` na `liveOpenTask` (z listy) i `openTask` (z fallbackiem na migawkę dla bieżącego id); `useEffect` odświeżający migawkę; czyszczenie migawki przy zamknięciu panelu.
- `prisma/migrations/0181_omnia_raport_trwalosc_szczegolow_zadania/migration.sql` — ten raport.
- `doświadczenia.md` — wpis z lekcją (panel szczegółów nie może czytać otwartego rekordu wprost z listy filtrowanej serwerowo).

## Podsumowanie
Jedno zgłoszenie UX domknięte. Główny obszar zmian: moduł Zadania, warstwa
prezentacji (`TasksPage`). Kluczowa decyzja: zamiast obsługiwać każdy scenariusz
„zadanie wypadło z widoku" osobno, uogólniono istniejący jednorazowy fallback do
trwałej migawki otwartego rekordu — dzięki temu panel szczegółów/edycji jest
odporny na każdą mutację zmieniającą przynależność zadania do widoku (status,
termin, projekt, filtr). Weryfikacja: `next build` przechodzi; krok `migrate.js`
świadomie pominięto lokalnie (pisze do produkcyjnej bazy). Raport zapisany migracją
→ pojawia się w `/reports` po deployu na środowisko testowe (`develop`). Slug
odróżniono od zajętego już `omnia-implementacja-2026-06-14`, by INSERT
(`ON CONFLICT DO NOTHING`) faktycznie się wykonał.
$omnia_task_detail_sticky$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
