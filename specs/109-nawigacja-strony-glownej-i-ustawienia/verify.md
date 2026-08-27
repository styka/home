# Weryfikacja: Nawigacja Strony głównej i podział widoku Ustawień

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-27
- **Środowisko:** lokalny Postgres 16 w sandboxie (`omnia/omnia_dev` dla builda, `e2e/worldofmag_e2e`
  dla klikacza). **Nigdy** prod `DATABASE_URL` (C-13) — `scripts/migrate.js` świadomie pominięty.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` | ✅ (w pełnym buildzie) — feature **nie dodaje migracji**, więc bramka nie ma nowego materiału |
| `check:actions` | ✅ — zero nowych `AIAction` |
| `check:ai-coverage`, `check:cost-badge`, `check:content-memory` | ✅ — brak nowych akcji i wywołań LLM |
| `check:ui-contract` | ✅ `25/25 modułów na ModuleView; 28 plików z zadeklarowanymi kolorami` — wpis `settings` przeszedł z `exempt` na `done` |
| `check:i18n` | ✅ `zero tekstów zaszytych w komponentach (13 w plikach ze świadomym wyjątkiem)` |
| `check:route-gating`, `check:boundaries`, `check:module-registry` | ✅ |
| `check:owner-columns`, `check:pagination`, `check:logs`, `check:client-safe`, `check:e2e-waits` | ✅ |
| `next lint --dir src` | ✅ (tylko istniejące ostrzeżenia `exhaustive-deps`, żadne w nowych plikach) |
| `next build` | ✅ — trasy `/settings` (3,95 kB) i `/settings/[sekcja]` (15,4 kB) zbudowane |
| `check:perf` | ✅ `najcięższa trasa 1174 kB (/shopping/[listId]/page), suma 69372 kB — w pasmie ±5%` — próg **nie wymagał zmiany** |
| `npm run test:unit` | ✅ **1283 pass / 0 fail**, w tym 7 nowych |
| Klikacz (109 + 8 sąsiednich specek) | ✅ **14/14 testów 109**, `rama-i-chrom` zielony; 5 awarii poza zakresem — patrz §4 |

Pełny łańcuch buildu zakończył się `EXIT=0`.

## 2. Kryteria akceptacji

### Panel boczny

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** wiersz „Strona główna" nad modułami i nad rzędem ikon | ✅ | e2e `[109-AC1]`: `{"maTekst":true,"yDom":52,"yGwiazdka":88,"yModul":141}` — 52 < 88 < 141. Kod: `ModuleSidebar.tsx` renderuje `NavItem` z `modulStronyGlownej()` **przed** blokiem `.omnia-chrom-konta` |
| **AC-2** dokładnie jedno wejście na `/` | ✅ | e2e `[109-AC2]`: `{"liczba":1,"teksty":["Strona główna"],"nazwaJestOdnosnikiem":false}`. Nazwa aplikacji jest `<div>`, ikona domu usunięta z rzędu ikon |
| **AC-3** stan aktywny czytelny dla czytnika | ✅ | e2e `[109-AC3]`: `{"current":"page","tekst":"Strona główna"}`. `NavItem` ustawia `aria-current` dla **wszystkich** pozycji menu |
| **AC-4** jedno kliknięcie z modułu | ✅ | e2e: klik z `/tasks` → `pathname === "/"` |
| **AC-5** telefon bez zmian, jedno wejście | ⚠️ **częściowo** | Udowodnione: wiersz z panelu **nie przecieka** na telefon (`[109-AC5]`: 0 widocznych `a[href="/"]` przy 390 px) oraz `resolveMenu` nietknięte, więc `home` dalej nie jest pozycją menu ani paska. **Nieudowodnione:** „jest dokładnie jedno" — kotwica paska kciuka to `<button>` z `aria-label` („Przejdź na stronę główną", `PasekKciuka.tsx:82-93`), a test liczył wyłącznie odnośniki, więc naliczył 0. Test nie odróżnia „kotwica jest" od „kotwicy nie ma" → **brak weryfikacji, nie brak funkcji** |
| **AC-6** brak uprawnienia → pozycja zablokowana | ✅ | `isPathLocked([], "/")` → `true`; `isPathLocked(["module.home"], "/")` → `false` (uruchomione). `NavItem` w wariancie `locked` renderuje `div` z kłódką, nie `a` |

### Ustawienia

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-7** spis bez przewijania / lista obok treści | ✅ | e2e `[109-AC7 spis]`: `{"pozycji":10,"przewijaSie":false}`; `[109-AC7 sekcja]`: `{"listaWidoczna":true,"pozycji":10}` |
| **AC-8** telefon: spis → sekcja z powrotem | ✅ | e2e `[109-AC8]`: lista boczna na telefonie `false` na spisie i w sekcji; okruszek `main a[href="/settings"]` widoczny |
| **AC-9** własny adres każdej sekcji | ✅ | e2e pętla po 10 adresach: każdy `pathname === "/settings/<id>"`, bez przekierowania |
| **AC-10** wszystkie 13 sekcji przeniesione | ✅ | Sprawdzone symbol po symbolu — 13 dawnych bloków → 10 sekcji, patrz tabela §3 |
| **AC-11** stare odnośniki działają | ✅ | e2e: `/settings/nawigacja#ulubione` → `#ulubione` widoczne. `grep -rn "/settings#" src` → pusto. Sześć przeniesionych odnośników w §3 |
| **AC-12** sekcja pobiera tylko swoje dane | ✅ | `grep` po akcjach: `getRecentActivity` → wyłącznie `Aktywnosc.tsx`, `listAvailableSkins` → `Wyglad.tsx`, `getDriveStatus` → `Polaczenia.tsx`, `getMyAiUsage` → `Asystent.tsx`, `getWorkspaceLocaleSettings` → `Jezyk.tsx`, `getFavoriteViews` → `Nawigacja.tsx`. Dawna strona awaitowała wszystkie dziesięć |
| **AC-13** wyszukiwarka prowadzi do sekcji | ✅ | e2e `[109-AC13]`: „skorka" → `["/settings/wyglad"]` (1 z 10), klik → `/settings/wyglad` |
| **AC-14** brak trafień → stan pusty | ✅ | e2e `[109-AC14]`: treść zawiera „Nic nie pasuje…", długość 132 znaki (nie pusta przestrzeń) |
| **AC-15** szukanie bez diakrytyków | ✅ | e2e `[109-AC15]`: „jezyk"→`/settings/jezyk`, „prywatnosc"→`/settings/prywatnosc`, „polaczenia"→`/settings/polaczenia`. Plus test jednostkowy `bezOgonkow`/`pasujeDoFrazy` (w tym `ł`, na które NFD nie działa) |
| **AC-16** standardowa rama widoku | ✅ | e2e `[109-AC16]`: `{"h1":1,"okruszek":true}`; `check:ui-contract` z wpisem `done` |
| **AC-17** kolory ze zmiennych motywu | ✅ | `grep` po hexach w `SpisUstawien`, `RamaSekcji`, `sekcje/*`, `app/settings/page.tsx`, `app/settings/[sekcja]/page.tsx` → **zero trafień**. (Trzy hexy zostają w nietkniętym `app/settings/team/[teamId]/page.tsx` — dług sprzed 109, poza zakresem) |
| **AC-18** obszar gestów na telefonie | ✅ | e2e `[109-AC18]`: `{"dolTresci":800,"wysokoscOkna":800}` — treść mieści się w oknie; `RamaSekcji` dokłada `calc(16px + env(safe-area-inset-bottom))` |
| **AC-19** teksty przez słownik | ✅ | `check:i18n` zielony; test jednostkowy sprawdza obecność wszystkich 30 kluczy sekcji (3 × 10) — **potwierdzony próbą mutacyjną**: po usunięciu jednego klucza test czerwienieje z nazwą brakującego klucza |

## 3. Dowody uzupełniające

**13 dawnych bloków → 10 sekcji** (sprawdzone obecnością symbolu, nie z pamięci):

| Dawny blok | Symbol | Sekcja |
|---|---|---|
| Profil + Wyloguj | `signOut` | `Konto.tsx` |
| Teamy | `getMyTeams` | `Zespoly.tsx` |
| Menu | `MenuPrefsEditor` | `Nawigacja.tsx` |
| Nawigacja (ulubione) | `FavoriteViewsEditor` | `Nawigacja.tsx` |
| Dysk Google | `DriveSettings` | `Polaczenia.tsx` |
| Kalendarz — subskrypcja | `IcalFeedCard` | `Polaczenia.tsx` |
| Wygląd / skórka | `SkinPicker` | `Wyglad.tsx` |
| Język i strefa | `WorkspaceLocaleSection` | `Jezyk.tsx` |
| Twój plan | `AiUsageMeters` | `Asystent.tsx` |
| Wiedza o Tobie | `UserFactsSection` | `Asystent.tsx` |
| Pomoc i przewodniki | `otworzPrzewodniki` | `Pomoc.tsx` |
| Prywatność i dane | `PrivacySettings` | `Prywatnosc.tsx` |
| Aktywność | `ActivityFeed` | `Aktywnosc.tsx` |

**Sześć przeniesionych odnośników:** powrót z OAuth Dysku i dwa odnośniki „podłącz Dysk" →
`/settings/polaczenia`; dokumenty prawne → `/settings/prywatnosc`; `hrefUstawien` paska kciuka
i „zarządzaj ulubionymi" → `/settings/nawigacja`. Każdy cel zawiera rzecz, którą opisuje (tabela wyżej).

## 4. Regresje

**Bieg odniesienia na kodzie SPRZED zmiany** (commit `4d38e76`, te same specki, ten sam sandbox) —
bo bez niego nie da się odróżnić własnej regresji od cudzego czerwonego testu:

| Test | Przed 109 | Po 109 | Ocena |
|---|---|---|---|
| `chrom-konta [085-AC1]` | ✘ | ✘ | **wcześniejszy** — ten sam wzorzec `/Powiadomienia/i`, który 107 unieważniło |
| `chrom-konta [085-AC4]` | ✘ | ✘ | **wcześniejszy** |
| `shortcuts [sc-AC9]` | ✘ | ✘ | **wcześniejszy** |
| `view-state [vs-AC4]` | ✘ | ✘ | **wcześniejszy** |
| `favorites` — jeden test na bieg | ✘ (`fav-AC1..3`) | ✘ (`fav-AC4`) | **wcześniejszy, wędrujący** — trzy biegi, trzy różne testy, jeden z nich na niezmienionym kodzie. Sam plik opisuje przyczynę: specki dzielą jedno konto administratora i biegną równolegle |
| `przewodniki [AC-4]` | ✓ | ✓ (po poprawce) | **regresja 109, naprawiona** — odnośnik do przewodników przeniósł się do `/settings/pomoc` |
| `favorites [fav-AC9]`, `[fav-AC1..3]` | — | ✓ (po poprawce) | **regresja 109, naprawiona** — `clearFavorites` szło pod `/settings` i po podziale znajdowało zero wpisów: nie wywalało się, tylko **cicho** zostawiało cudzy stan sąsiadowi |
| `rama-i-chrom [087-AC19]` | ✘ (od 107) | ✓ | **naprawione przy okazji** — wzorzec dzwonka poprawiony na `/skrzynk\|powiadomie/i` |

Liczba czerwonych testów po zmianie **nie wzrosła** (5 przed → 5 po), a jeden wcześniejszy czerwony
został naprawiony.

**Regresje sprawdzone poza klikaczem:**
- **Migracje/schemat:** brak zmian, `check:schema-drift` zielony.
- **RBAC:** `legacyPermissionForPath` dopasowuje po prefiksie, więc każdy nowy adres sekcji dziedziczy
  `module.settings` — zapisane jako test jednostkowy (10 sekcji + `/settings/team/new`).
- **`/settings/team/*`:** segment statyczny ma pierwszeństwo przed `[sekcja]` — e2e potwierdza, że
  `/settings/team/new` działa; `teams.spec.ts` zielony.
- **`revalidatePath`:** nie dotyczy — zero nowych mutacji.

## 5. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01 (praca w `worldofmag/`) | ✅ |
| C-10..C-14 (migracje) | ✅ nie dotyczy — brak zmian schematu, świadomie zapisane w planie |
| C-20..C-25 | ✅ zero nowych akcji i mutacji; RBAC bez poszerzenia; kosz i audyt nie dotyczą |
| C-30 (motyw) | ✅ zero hexów w nowym kodzie |
| C-31 (mobile/keyboard-first) | ✅ lista boczna `hidden md:flex`, nigdy dwa panele, cele dotyku 44 px, `env(safe-area-inset-bottom)` |
| C-32 (teksty) | ✅ `check:i18n` + test kluczy dynamicznych |
| C-33 (kontrakt widoku) | ✅ rama **nie została poszerzona**; użyto istniejących `layout="fill"`, `breadcrumb`, `width`, `state` |
| C-34 (potwierdzenia) | ✅ nie dotyczy — brak nowych potwierdzeń |
| C-35 (komponent z konsumentem) | ✅ `Podsekcja` (3 konsumentów), `PustaSekcja` (2), `SpisUstawien` (2 warianty) — żaden nie leży bez użycia |
| C-36 (granice) | ✅ zero nowych równoległych list; Strona główna czytana z deklaracji modułu |
| C-51 (lekcje) | ✅ cztery wpisy w `doświadczenia.md` |
| C-53 (minimalizm) | ✅ jedna trasa parametryczna zamiast dziesięciu; zero nowych zależności; treść sekcji przeniesiona 1:1 |
| C-54 (spójność artefaktów) | ✅ AC-7 uściślone w `spec.md` na etapie planu, ze śladem zmiany |

**Naruszeń nie stwierdzono.**

## 6. Werdykt końcowy

**DO POPRAWY** — jeden brak, i jest to brak **weryfikacji**, nie funkcji.

- **AC-5 nie jest udowodnione w części „nadal jest dokładnie jedno".** Test liczy `a[href="/"]`, a
  kotwica paska kciuka jest `<button>` z `aria-label` — więc naliczył 0 i przeszedłby także wtedy,
  gdyby kotwica **zniknęła**. Test, który nie odróżnia stanu poprawnego od zepsutego, nie jest testem
  (ta sama lekcja co w 086). Funkcjonalnie jest dobrze: `resolveMenu` i `pozycjePaska` nietknięte,
  a `PasekKciuka.tsx:82-93` renderuje kotwicę — ale to jest odczyt kodu, nie pomiar.

Brak nie wynika z błędnego speca ani planu, więc `spec.md`/`plan.md` **nie wymagają korekty** (C-54) —
poprawka dotyczy wyłącznie testu.

**Zadanie do wykonania:** `T-31` (dopisane do `tasks.md`).
