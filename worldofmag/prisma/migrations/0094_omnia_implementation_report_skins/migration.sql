-- Raport implementacyjny: system skórek (motywów) aplikacji.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-06',
  'omnia-implementacja-2026-06-06',
  $omnia_skins$# Omnia — Raport implementacji 2026-06-06

Sesja realizuje jedno zgłoszenie: **stworzyć w ustawieniach funkcjonalność zmiany
skórki (motywu) aplikacji** — z 5 skórkami systemowymi zarządzanymi przez admina,
możliwością tworzenia, zapisywania, współdzielenia i reużywania własnych skórek,
sterowaniem nie tylko kolorami, ale i wybranymi stylami, oraz ujednoliceniem stylów
tak, by skórki dało się łatwo aplikować i tworzyć. Nacisk na prostotę i UX.

---

## Stworzyć w ustawieniach funkcjonalność zmiany skórki aplikacji

**Diagnoza:** Aplikacja miała **jeden, zahardkodowany ciemny motyw**. Wszystkie tokeny
designu żyły jako zmienne CSS w `:root` (`globals.css`), `<html className="dark">` był
na sztywno, brak jakiejkolwiek infrastruktury przełączania motywów. Dodatkowo część
komponentów (~30–40%) hardkodowała kolory — przede wszystkim `color: "#fff"` na
przyciskach akcentowych — przez co skórka (zwłaszcza jasna) nie miała czym sterować i
wyglądałaby źle. Wymagania: 5 skórek systemowych (Ciemny domyślny, Jasny, Casual,
Błękit „chłopięcy", Róż „dziewczęcy"), skórki użytkownika z zapisem/współdzieleniem/
reużyciem, panel admina do skórek systemowych, sterowanie też nie-kolorami, prosty UX.

**Rozwiązanie:** Skórkę zamodelowano jako **częściową mapę `zmienna CSS → wartość`**
(JSON w `Skin.tokens`). Klucz decyzji to **sposób aplikowania bez migotania (FOUC)**:
tokeny renderowane są **inline na elemencie `<html>`** w serwerowym `layout.tsx`.
Ponieważ `<html>` jest elementem `:root`, inline-style nadpisuje reguły `:root` z
`globals.css` z najwyższym priorytetem i trafia do pierwszego HTML-a — zero migotania,
bez osobnych plików CSS per-motyw ani przeładowań. Zmienne pominięte w skórce
**dziedziczą domyślne (ciemne) wartości**, więc skórka „Ciemny" to po prostu `{}`, a
nowe skórki niosą tylko realne nadpisania — to czyni tworzenie i edycję skórek
trywialnymi.

Zakres sterowania rozszerzono **poza kolory**: dodano tokeny `--radius`/`--radius-lg`
(zaokrąglenie), `--font-size-base` (gęstość — bazowy rozmiar tekstu), `--color-scheme`
(jasny/ciemny dla natywnych kontrolek; do `<html>` dokładany jest też atrybut
`data-skin-scheme`, którym zawężono jasną ikonę natywnego date-pickera, niewidoczną na
jasnym tle) oraz `--on-accent` (kolor tekstu na akcentach — token zastępujący masowo
hardkodowane `#fff`). Dla **UX** edytor ma **prosty, kurowany zestaw ~10 kontrolek**
(tło, powierzchnia, teksty, akcenty, tekst-na-akcencie, zaokrąglenie, gęstość, schemat)
z **podglądem na żywo** oraz składaną sekcję **„Zaawansowane"** z pełną listą zmiennych.

Model uprawnień odwzorowano na istniejące wzorce: skórki **systemowe** (zarządzane przez
admina), **użytkownika** i **zespołu** (`ownerId`/`ownerTeamId`), z flagą `isPublic` do
**współdzielenia i reużycia** przez wszystkich. Użytkownik wybiera skórkę w Ustawieniach,
może każdą **zduplikować → edytować → zapisać** jako własną, a admin zarządza skórkami
systemowymi w `/admin/skins`. **Bezpieczeństwo:** ponieważ wartości lądują w inline-style,
każda przechodzi przez `sanitizeTokenValue` — whitelistę dozwolonych kluczy + regex
(hex/`rgb()`/`px`/`light|dark`) i twardą blokadę znaków `;{}<>` — co zamyka wektor
CSS-injection. Ujednolicenie: zamieniono `color: "#fff"` → `var(--on-accent)` w 67
komponentach (był to zawsze tekst na tłach akcentowych), pozostawiając kolory **danych**
(palety kategorii, kolory wykresów) nietknięte jako treść, nie chrom motywu.

**Zmienione/nowe pliki:**
- `prisma/schema.prisma` — nowe modele `Skin` (system/user/team, `tokens` JSON,
  `colorScheme`, `isPublic`, `sortOrder`) i `UserSkinPref` (wybór per-user) + relacje
  w `User`/`Team`.
- `prisma/migrations/0093_skins/migration.sql` — tabele + idempotentny seed 5 skórek
  systemowych (dollar-quoted JSON, `ON CONFLICT DO NOTHING`).
- `src/lib/skins.ts` — typy, lista sterowalnych zmiennych, kontrolki kurowane +
  zaawansowane, domyślne wartości, walidacja `sanitizeTokenValue`/`validateTokens`,
  helpery `resolveTokens`/`tokensToStyle`.
- `src/app/globals.css` — nowe tokeny (`--on-accent`, `--color-scheme`, `--radius`,
  `--radius-lg`, `--font-size-base`), `color-scheme`/`font-size` sterowane tokenami,
  ikona date-pickera zawężona do `html[data-skin-scheme="dark"]`.
- `src/app/layout.tsx` — `readActiveSkin` → inline `style` z tokenami + `data-skin-scheme`
  na `<html>` (aplikowanie bez FOUC).
- `src/actions/skins.ts` — server actions: `readActiveSkin`, `listAvailableSkins`,
  `setActiveSkin`, `createSkin`/`updateSkin`/`deleteSkin`/`duplicateSkin` (guardy admin/
  własność, `revalidatePath`).
- `src/components/skins/SkinPreview.tsx`, `SkinEditor.tsx` — podgląd i wspólny edytor
  (prosty + zaawansowany, live preview), używane przez usera i admina.
- `src/components/settings/SkinPicker.tsx` + `src/app/settings/page.tsx` — sekcja
  „Wygląd — skórka" w Ustawieniach (wybór/duplikacja/edycja/usuwanie, współdzielenie).
- `src/components/admin/SystemSkinManager.tsx` + `src/app/admin/skins/page.tsx` +
  link w `src/app/admin/page.tsx` — zarządzanie skórkami systemowymi.
- Sweep `color: "#fff"` → `var(--on-accent)` w 67 komponentach modułów.

---

## Podsumowanie

Zrealizowano **1 zgłoszenie** — pełny system skórek (motywów) aplikacji. Główne obszary
zmian: **warstwa stylów** (tokenizacja `globals.css`, ujednolicenie `#fff` →
`--on-accent`), **dane** (modele `Skin`/`UserSkinPref` + migracja z seedem 5 skórek
systemowych), **logika** (`src/lib/skins.ts` z walidacją odporną na CSS-injection,
server actions), **aplikowanie bez FOUC** (inline-style na `<html>` w `layout.tsx`) oraz
**UX** (picker w Ustawieniach, wspólny edytor z prostym i zaawansowanym trybem + podgląd
na żywo, panel admina). Kluczowe decyzje: skórka jako częściowa mapa zmiennych z
dziedziczeniem domyślnych (łatwe tworzenie/edycja), inline-style na `:root` (natychmiast,
bez migotania), twarda walidacja wartości (bezpieczeństwo). `npm run build` przechodzi;
zmiany scalono do `develop` (auto-deploy środowiska testowego).

**Uwaga utrzymaniowa:** od teraz na kolorowych (akcentowych) tłach używaj
`var(--on-accent)` zamiast `#fff`, aby jasne skórki pozostały spójne.
$omnia_skins$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
