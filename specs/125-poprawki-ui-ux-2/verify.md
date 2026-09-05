# Weryfikacja: Druga paczka poprawek UI/UX ze zgłoszeń administratora

- **Spec:** ./spec.md (125-poprawki-ui-ux-2)
- **Data:** 2026-09-05
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`, migracje dogonione do 0291), branch odtworzony
  z `origin/develop` 2742e617

## Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run build` (pełna bateria, lokalny Postgres) | ✅ **exit 0 end-to-end** — wszystkie bramki repo, `next build` 148/148 stron, `check-perf` w paśmie ±5%, `migrate.js` na lokalnej bazie |
| w tym: `check:migrations` / `check:actions` / `check:i18n` / `check:ui-contract` / `next lint` | ✅ (w składzie pełnej baterii; lint: „No ESLint warnings or errors") |
| `tsc --noEmit -p tsconfig.test.json` | ✅ czysto (po `prisma generate` — stary klient nie znał `readLater` z 0290, rozjazd środowiska, nie kodu) |
| `prisma migrate deploy` (lokalnie) | ✅ 0289–0291 zaaplikowane czysto; ta paczka nie dodaje migracji |

## Kryteria akceptacji

- **AC-1 ✅** (ustawienia Roślin w dialogu) — `PrzestrzenPage.tsx`: blok `{ustawienia && …}`
  renderuje `Modal` (wzorzec formularzy „roslina"/„miejsce" ze 118); zawartość przeniesiona 1:1
  (select lokalizacji, komunikat, sekcja usunięcia z `confirmDialog({ destructive: true })`);
  `onClose` czyści też `komunikat` (stary „zapisano" nie wraca przy ponownym otwarciu);
  `usunPrzestrzen()` zamyka dialog przed `router.push("/rosliny")`; slot `settings` otwiera
  zawsze na `true` (dialog zamyka się przez X/Esc/tło — Radix), `active` odzwierciedla stan.
  Wejście zostaje w slocie `settings` ramy (C-33). Esc/pułapka focusu/safe-area — z prymitywu.
- **AC-2 ✅** (pole projektu w dialogu dodawania) — `TasksPage.tsx` przekazuje do
  `ModalDodaniaZadania`: `pokazWyborProjektu` (zawsze), `projekty={allProjects}`,
  `domyslnyProjektId={viewMode === "project" ? projectId : ""}`. **Korekta po recenzji:**
  pierwsza wersja podawała `null`, a inicjalizator `FormularzZadania` przy nullish spada na
  fallback z propa `projectId` — który w widokach wirtualnych niósł `inboxId`, więc select
  preselekcjonował projekt-skrzynkę wbrew regule „bez automatu". Pusty string nie jest nullish,
  więc pole startuje bez wyboru (= Skrzynka, dokładnie jak na stronie modułu z 121); martwy
  `addProjectId` usunięty. Po dodaniu do innego projektu użytkownik zostaje w widoku:
  `onCreated` → `setJustCreated` — fallback panelu szczegółów obsługuje zadanie spoza
  przefiltrowanej listy (mechanizm ze 105). `viewMode` obejmuje zestawy (`"multi"`).
- **AC-3 ✅** (filtr tagów w pasku akcji) — `FiltrTagow.tsx`: przycisk = ikona `Tags` 15 +
  licznik wybranych (badge rounded-full, `--accent-blue`/`--on-accent`), pełna treść
  („Filtr etykiet: 5 z 17" / „…: Wszystkie") w `title` i `aria-label`; rząd chipów usunięty
  (martwy wariant nie został — jedyny render); panel `AnchoredLayer` (szukajka, multi-select,
  „Wszystkie") nietknięty. `TasksPage.tsx`: filtr w scrollowanym `role="toolbar"` zaraz za
  przyciskiem Szukaj, render przy `allTags.length > 0`. `TaskFilters.tsx`: wiersz = same
  zakładki `overflow-x-auto` (nic ich nie wypycha przy dowolnej liczbie wybranych tagów);
  Kanban: `if (!showStatusTabs) return null` — zero pustego wiersza. Semantyka koniunkcji:
  kod filtrowania w `TasksPage` (`selectedTagIds.every(...)`) nietknięty; stan w URL bez zmian.
- **AC-4 ✅** (linki potwierdzenia z podglądem) — `AICommandSheet.tsx`: (1) markdown link trybu
  robaczka → `/tasks/${res.projectId}?task=${res.taskId}`; (2) `reportDone` niesie `taskId`,
  setter uzupełniony; (3) przycisk „Otwórz w zadaniach" → `goTo(…?task=…)`. Warunek `canRead`
  zachowany w obu ścieżkach. Grep kontrolny `` /tasks/${…} `` bez `?task=`: zostały wyłącznie
  celowe linki do LIST/projektów (nawigacja boczna, wybór projektu, revalidate, „Otwórz
  projekt" po utworzeniu projektu) — zero czwartego miejsca z linkiem do zgłoszenia. Ścieżka
  agentowa (egzekutor, 118) nietknięta.
- **AC-5 ✅** (regresje) — pełny build zielony; `tsc` czysty (dowód, że nikt inny nie podawał
  usuniętych propsów `TaskFilters`/`FiltrTagow` — jedyny konsument to `TasksPage`); skróty
  `a`/`n` → `onQuickAdd` → modal (nietknięte); e2e `[100-AC6]`/`[100-AC7/AC9]` w
  `ergonomia-nawigacji.spec.ts` dostosowane do nowego miejsca filtra (title-prefix,
  `closest('[role="toolbar"]')`, nazwa dostępna zamiast tekstu na przycisku); pozostałe specy
  (grep `Filtr etykiet`/`FiltrTagow`) nie celują w stare miejsce.

## Zgodność z konstytucją

- C-01 ✅ tylko `worldofmag/` (+ artefakty `specs/`, lekcja w `doświadczenia.md`).
- C-10..C-14 ✅ bez zmian schematu — jawnie (plan §2).
- C-20/C-21 ✅ zero zmian akcji serwera i guardów.
- C-23 ✅ bez nowych `AIAction`; `check:actions` zielone.
- C-30 ✅ wyłącznie zmienne CSS (`--accent-blue`, `--on-accent`, `--text-muted`).
- C-31 ✅ dialogi = bottom-sheet z safe-area (prymityw); przycisk filtra `flex-shrink-0`
  w przewijanym pasku jak sąsiedzi; skróty klawiszowe bez zmian.
- C-32 ✅ nowe treści składane z istniejących kluczy `t()` (`filtrEtykiet`, `wszystkie`,
  `zIlu`, `ustawienia`); `check:i18n` zielone — zero nowych literałów.
- C-33 ✅ ustawienia wciąż wchodzą przez slot `settings`; filtr w strefie akcji ramy.
- C-34 ✅ usunięcie przestrzeni przez `confirmDialog({ destructive: true })` jak dotąd.
- C-51 ✅ lekcja „jeden link, trzy miejsca generowania" w `doświadczenia.md`.
- C-53 ✅ zero nowych plików/zależności; skasowany martwy wariant chipów zamiast utrzymywania dwóch.

## Regresje

- `TaskFilters`/`FiltrTagow`: jedyny konsument `TasksPage` (grep + tsc); Kanban bez pustego wiersza.
- `ModalDodaniaZadania` na stronie modułu (`TasksHomePage`, 121) — nietknięty, dalej z własnymi
  propsami wyboru projektu.
- `AICommandSheet`: pozostałe użycia `reportDone` tylko w bloku potwierdzenia (grep); typ
  rozszerzony spójnie ze setterem.
- Rośliny: sekcje treści strony (`sekcja`, formularze 118) bez zmian; tylko blok ustawień
  zmienił kontener.

## Werdykt końcowy

**GOTOWE Z UWAGAMI**

Uwagi (nieblokujące):
1. Weryfikacja behawioralna oparta na prześledzeniu kodu + bramkach + dostosowanych e2e; pełny
   przebieg klikaczy (`scripts/e2e-web.sh`) nie był uruchamiany w tej sesji.
2. Zakładki statusów przy bardzo wąskim ekranie nadal przewijają się poziomo (tak jak przed 118)
   — to zamierzone; filtr już w tym nie uczestniczy.
