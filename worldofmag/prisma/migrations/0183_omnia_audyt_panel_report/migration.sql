-- Raport implementacyjny: nowa funkcja w Panelu Admina „Analiza / Audyt stanu projektu + wskazania”.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).
-- Slug świadomie odróżniony od zajętych „omnia-implementacja-2026-06-14*”, bo ON CONFLICT (slug)
-- DO NOTHING pominąłby wstawienie przy kolizji.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-14: Panel Audytu/Analizy',
  'omnia-implementacja-2026-06-14-panel-audytu',
  $omnia_audyt_panel$# Omnia — Raport implementacji 2026-06-14: Panel Audytu/Analizy

Sesja realizuje jedno zgłoszenie: nową funkcję w Panelu Admina **„Analiza / Audyt stanu projektu na
dzień <data> + wskazania”** — obszerną, wersjonowaną w repo „książkę” audytową, dostępną wyłącznie dla
administratora, będącą wynikiem symulowanej debaty dwóch zespołów developerskich.

---

## Stworzenie funkcji „Analiza / Audyt stanu projektu + wskazania”
**Diagnoza:** Potrzebny był trwały, głęboki audyt całego projektu (funkcjonalny, techniczny,
bezpieczeństwo, skala, UX, AI, biznes/monetyzacja, marketing) z ponumerowanymi zaleceniami i planami
wdrożenia dla Claude Code — utrzymywany **jako pliki w repozytorium** (wersjonowane w git, nie w
bazie), renderowany w panelu admina, z dostępem tylko dla admina.

**Rozwiązanie:** Źródłem treści są pliki Markdown w `worldofmag/content/audyt/*.md` opisane manifestem
`manifest.json`. Skrypt `scripts/copy-audyt.js` (wzorowany na `copy-docs.js`) „piecze” je przy buildzie
do modułu `src/generated/audyt-book.ts`; status rozdziału jest wyliczany z obecności pliku (done /
planned). Trasa serwerowa `/admin/audyt` (bramka `module.admin` → redirect) renderuje aktywny rozdział
przez istniejący, bezpieczny `markdownToHtml()` i przekazuje go do dedykowanego czytnika
`AudytBookReader` (boczny spis treści grupowany po częściach, numeracja, pasek postępu, nawigacja
poprzedni/następny przez `?r=slug`, przełącznik trybu czytania ciemny/jasny/sepia zapamiętywany w
`localStorage`). Kafelek wejścia dodano w `/admin`. `copy-audyt.js` wpięto w `npm run build`.

**Decyzje:** Format Markdown przez istniejący renderer (bezpieczna sanityzacja, brak surowego HTML) —
zgodnie z wyborem właściciela; renderer już wspiera `#`–`######` i listy zagnieżdżone, więc nie był
modyfikowany. „Pieczenie” przy buildzie zachowano dla parytetu z `/admin/docs` (zero zależności od
runtime-fs na produkcji). Struktura (manifest) obejmuje **wszystkie** zaplanowane rozdziały od razu, by
żaden nie został zapomniany; pisanie postępuje plik po pliku, a pasek postępu pokazuje stan — co
umożliwia bezpieczną kontynuację w kolejnych sesjach.

**Zakres treści w tej sesji:** napisano w całości część fundamentową i przekrojową oraz biznesową,
syntezę i Dodatek (lista zaleceń + prompt dla Claude Code): rozdziały 00–15, 42–47, 59 (oraz 14).
Łącznie **125 ponumerowanych zaleceń `Z-NNN`** (16× P0, 70× P1, 39× P2) z priorytetami i nakładem.
Rozdziały modułowe (16–41) oraz szczegółowe plany wdrożeniowe (Dodatek A.2–A.12) mają ustaloną
strukturę w manifeście i są uzupełniane przyrostowo (status „w przygotowaniu” w czytniku).

**Zmienione/utworzone pliki:**
- `content/audyt/manifest.json` — struktura (spis treści) całej książki.
- `content/audyt/*.md` — rozdziały audytu (treść Markdown).
- `scripts/copy-audyt.js` — „pieczenie” manifestu + rozdziałów do modułu TS.
- `src/generated/audyt-book.ts` — wygenerowany moduł (commitowany, jak `admin-docs.ts`).
- `src/app/admin/audyt/page.tsx` — strona serwerowa z bramką admina + render aktywnego rozdziału.
- `src/components/admin/AudytBookReader.tsx` — czytnik (spis treści, nawigacja, postęp, tryb czytania).
- `src/app/admin/page.tsx` — kafelek wejścia do nowej funkcji.
- `package.json` — wpięcie `copy-audyt.js` w build.
- `prisma/migrations/0183_omnia_audyt_panel_report/migration.sql` — ten raport.
- `CLAUDE.md`, `doświadczenia.md` — dokumentacja trasy i lekcja.

## Podsumowanie
Dostarczono działającą, admin-only funkcję czytnika „książki” audytowej oraz obszerną treść audytu
(stan projektu, debaty dwóch zespołów, 125 zaleceń, model biznesowy i ilościowy, wstęp do marketingu,
prompt dla kolejnej sesji). Główny obszar zmian: panel admina + nowa warstwa treści wersjonowanej w
repo. Weryfikacja: `npx next build` przechodzi; krok `migrate.js` świadomie pominięto lokalnie (pisze
do produkcyjnej bazy). Raport zapisany migracją → pojawia się w `/reports` po deployu na środowisko
testowe (`develop`). Treść audytu jest rozwijana przyrostowo (rozdziały modułowe i plany wdrożeniowe) —
mechanizm manifestu i paska postępu zapewnia, że nic nie ginie między sesjami.
$omnia_audyt_panel$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
