-- 0204: Raport implementacji z sesji spec-driven pipeline (2026-07-14).
-- Raport systemowy (authorId NULL → widoczny dla wszystkich w /reports). Idempotentnie
-- (ON CONFLICT DO UPDATE) — re-seed odświeża treść. Slug globalnie unikalny.

INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-07-14',
  'omnia-implementacja-2026-07-14',
  $report_md$# Omnia — Raport implementacji 2026-07-14

> Sesja: uruchomienie **spec-driven AI pipeline** dla Claude Code jako fundamentu, na którym będą
> powstawać kolejne modyfikacje aplikacji. Zakres: komendy + agenty w `.claude/`, konstytucja reguł,
> szablony artefaktów, oraz przewodnik w panelu admina (`/admin/spec-pipeline`).

## Specification driven AI pipeline

**Diagnoza:** Potrzebny był powtarzalny, profesjonalny proces wprowadzania zmian w Omnii przy pomocy
Claude Code — zamiast pisać kod „od ręki", chcemy: najpierw ustalić *co i po co*, potem *jak*, rozbić
na kroki, dopiero implementować, a na końcu **zweryfikować i zrecenzować**. Wymagane elementy:
komendy `/specify`, `/plan`, `/tasks`, implementacja, `/verify`, `/review`; odpowiednie agenty;
przewodnik w panelu admina wyjaśniający na czym to polega i jak z tego korzystać. Całość dopasowana do
konwencji tego repo, bo to na niej mają bazować przyszłe zmiany.

**Rozwiązanie:** Zbudowałem kompletny **Spec-Driven Development (SDD) pipeline** osadzony w regułach
Omnii — nie generyczny szablon, tylko wariant znający migracje, RBAC, model współwłasności,
asystenta AI i motyw CSS tej aplikacji.

- **Sześć komend** (`.claude/commands/*.md`) jako etapy pipeline'u. Każda komenda: czyta `CLAUDE.md` +
  konstytucję, produkuje jeden artefakt Markdown i wskazuje następny krok. Rozdzielenie *co* (`spec`)
  od *jak* (`plan`) jest wymuszone treścią promptów — dzięki temu decyzje techniczne nie „wyciekają"
  do specyfikacji, a plan powstaje pod istniejący kod (nakaz czytania sąsiedniego modułu przed
  projektowaniem).
- **Konstytucja `C-NN`** (`.claude/spec-pipeline/constitution.md`) — ~30 twardych reguł wyciągniętych
  z `CLAUDE.md` (ręczne migracje bez enumów, `revalidatePath`, `ownerId`/`ownerTeamId`, egzekutor dla
  każdej `AIAction`, motyw wyłącznie przez zmienne CSS, wariant mobilny, nigdy build/migrate przeciw
  prod DB, merge do `develop`). To pojedyncze źródło prawdy, do którego odwołują się wszystkie etapy —
  złamanie reguły jest błędem blokującym, nie kwestią gustu. Wybór formy „konstytucji" zamiast
  powielania reguł w każdej komendzie = DRY i łatwa aktualizacja przy zmianie konwencji.
- **Trzy agenty** (`.claude/agents/*.md`): `omnia-planner` (architekt — projektuje plan w konwencjach),
  `omnia-implementer` (wykonawca — pisze kod w stylu sąsiedniego modułu), `omnia-reviewer`
  (recenzent read-only — poluje na realne błędy i naruszenia konwencji). Opisy są tak napisane, by
  agenty były wywoływalne zarówno wprost, jak i automatycznie przy złożonych, wielomodułowych zmianach.
- **Szablony artefaktów** (`spec/plan/tasks`) + katalog `specs/<NNN-slug>/` jako trwałe repozytorium
  decyzji („dlaczego dana zmiana wygląda jak wygląda").
- **Przewodnik w panelu admina** (`/admin/spec-pipeline`): dedykowana, ostylowana strona (pasek 6
  etapów + pełny przewodnik i konstytucja w zakładkach). Zamiast duplikować treść w Reakcie, przewodnik
  jest **jednym źródłem** — plik `.claude/spec-pipeline/README.md` jest pieczony do
  `src/generated/spec-pipeline.ts` skryptem `copy-spec-pipeline.js` (wzorzec `copy-docs`/`copy-audyt`,
  wpięty w `build`), a strona reużywa istniejącego `AdminDocsViewer`. Dzięki temu deployowany serwer
  standalone nie musi czytać plików repo w runtime, a przewodnik zawsze odzwierciedla najnowszą treść.

**Zmienione pliki:**
- `.claude/commands/{specify,plan,tasks,implement,verify,review}.md` — 6 komend pipeline'u.
- `.claude/agents/{omnia-planner,omnia-implementer,omnia-reviewer}.md` — 3 wyspecjalizowane agenty.
- `.claude/spec-pipeline/constitution.md` — twarde reguły `C-NN` (bramki jakości).
- `.claude/spec-pipeline/README.md` — przewodnik (źródło dla panelu admina).
- `.claude/spec-pipeline/templates/{spec,plan,tasks}-template.md` — szablony artefaktów.
- `specs/README.md` — opis katalogu artefaktów.
- `worldofmag/scripts/copy-spec-pipeline.js` — generator pieczący przewodnik + konstytucję do TS.
- `worldofmag/src/generated/spec-pipeline.ts` — wygenerowany moduł (commitowany dla `dev`).
- `worldofmag/src/app/admin/spec-pipeline/page.tsx` — strona przewodnika (admin-only, `force-dynamic`).
- `worldofmag/src/app/admin/page.tsx` — link do przewodnika w sekcji „Narzędzia".
- `worldofmag/package.json` — `copy-spec-pipeline.js` wpięty w skrypt `build`.
- `CLAUDE.md` — wpis trasy `/admin/spec-pipeline` + opis pipeline'u.
- `doświadczenia.md` — lekcja (kolizje nazw komend + pieczenie plików repo do panelu admina).
- `worldofmag/prisma/migrations/0204_omnia_implementacja_2026_07_14_report/` — ten raport.

## Podsumowanie

Sesja objęła **jedno zadanie** — zbudowanie spec-driven AI pipeline'u dla Omnii — potraktowane jako
fundament pod przyszłe zmiany, więc z naciskiem na jakość i dopasowanie do repo. Główne obszary:
(1) **narzędzia deweloperskie Claude Code** w `.claude/` (6 komend, 3 agenty, konstytucja, szablony),
(2) **panel admina** — nowa, ostylowana strona przewodnika reużywająca istniejącej infrastruktury
renderowania Markdown, (3) **dokumentacja** (`CLAUDE.md`, `doświadczenia.md`) i **build** (nowy
generator wpięty w pipeline builda).

Weryfikacja: `npx tsc --noEmit` — czysto; `next lint --dir src` — bez nowych ostrzeżeń; `check:migrations`
i `check:actions` — OK; pełny `next build` (przeciw **lokalnemu** Postgresowi, zgodnie z regułą „nigdy
prod DB") — zielony, trasa `/admin/spec-pipeline` skompilowana i zarejestrowana. Zmiana nie rusza
schematu bazy poza tym raportem; nie dodaje zależności. Następne modyfikacje aplikacji mogą już iść
ścieżką `/specify → /plan → /tasks → /implement → /verify → /review`.
$report_md$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "title"=EXCLUDED."title","content"=EXCLUDED."content","category"=EXCLUDED."category","updatedAt"=CURRENT_TIMESTAMP;
