# Plan techniczny: Asystent — dopracowanie UX na telefonie i komputerze + audyt zużycia tokenów

- **Spec:** ./spec.md (035-asystent-ux-mobile-i-audyt-tokenow)
- **Status:** draft
- **Data:** 2026-07-28

> **Zasada planu:** to jest **JAK**. Wzorce: `AICommandSheet.tsx` (istniejąca sekcja historii —
> wzorzec dla wszystkich sekcji nagłówka), `AiCostBadge.tsx` (034), seed raportów migracją SQL
> (`0204_omnia_implementacja_2026_07_14_report`).

## 1. Podejście

Siedem zgłoszeń dzieli się na trzy grupy, robione w tej kolejności:
**(A) architektura okna asystenta** (Z5 + Z1d + Z1b) — dziś sekcje nagłówka renderują się jako
`flex-shrink-0` *nad* wątkiem, więc nie mają własnego przewijania i są ucinane; ujednolicamy je z
historią (sekcja **zastępuje** obszar wątku i przewija się), co jednym ruchem załatwia „nie da się
przewinąć" i „ma zasłaniać czat". **(B) dotyk i warstwy** (Z3, Z4, Z2) — wycofanie
`keepKeyboardOpen`, usunięcie skaczącego `paddingBottom` i uodpornienie panelu kosztu.
**(C) audyt tokenów** (Z7) — wyodrębnienie promptów do modułu bibliotecznego (zmiana **czysto
przenosząca**, bez wpływu na zachowanie), skrypt liczący i raport seedowany migracją.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Jedyna zmiana w bazie to **wiersz w istniejącej tabeli `Report`**
(raport systemowy, `authorId = NULL`) dodany migracją.

- **Migracja (C-10, C-11, C-14):**
  - Numer z `npm run next:migration`: **0213**
  - Katalog: `prisma/migrations/0213_raport_audyt_tokenow/migration.sql`
  - Wzorzec 1:1 z `0204_…_report`: `INSERT INTO "Report" (…) VALUES (gen_random_uuid()::text, …,
    $report_md$…$report_md$, 'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("slug") DO UPDATE SET …` — idempotentnie, slug globalnie unikalny:
    `asystent-audyt-zuzycia-tokenow-2026-07-28`.
  - **Uwaga na dollar-quoting:** treść raportu zawiera pełne prompty, w których występują `$` i
    bloki markdown — używamy tagu `$report_md$`, a skrypt generujący sprawdza, czy tag nie występuje
    w treści (inaczej migracja rozjedzie się składniowo).

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych i bez zmienionych Server Actions.** Feature dotyka wyłącznie prezentacji oraz jednego
seeda. Istniejące `assistantPrefs.updateUserLlmPref` / `resetUserLlmPrefs` (034) zostają bez zmian —
zmienia się tylko to, **skąd** i **jak** są wołane z UI.

Jedyna zmiana kontraktu danych: `getAssistantLevelConfig()` (034) dziś zwraca `key: null` dla „jak u
administratora". UI przestaje wystawiać tę opcję i **wstępnie wypełnia** pole wartością
`defaultKey` (AC-4); zapis pierwszej zmiany utrwala tę wartość jawnie. Akcja serwerowa nie wymaga
zmian — `null` pozostaje dopuszczalną wartością w bazie (starsze wiersze), po prostu nie da się jej
już wybrać z listy.

## 4. RBAC / rejestr modułu (C-22)

Bez nowego sluga i bez zmian w `modules.tsx`/`ModuleSidebar`. Raport z audytu jest systemowy
(`authorId = NULL`), więc widać go w `/reports` na dotychczasowych zasadach.

## 5. UI (C-30, C-31, C-32)

### 5.1 Sekcje nagłówka jako pełnoekranowe widoki (Z5, Z1d) — `AICommandSheet.tsx`

Dziś: `{showReport && (<div className="px-5 py-3 flex-shrink-0" …>)}` i analogicznie `showPrefs` —
oba **nad** wątkiem, bez `overflow-y`. Historia natomiast renderuje się w miejscu wątku
(`{showHistory ? (<div className="flex-1 overflow-y-auto" …>) : (…wątek…)}`).

Zmiana: jeden wspólny obszar treści wybierany po `headerPanel` (stan z 034):

```
headerPanel === "none"    → wątek + kompozytor (jak dziś)
headerPanel === "history" → lista rozmów            (bez zmian)
headerPanel === "prefs"   → ustawienia asystenta    (NOWE: w miejscu wątku)
headerPanel === "report"  → zgłoszenie problemu     (NOWE: w miejscu wątku)
headerPanel === "level"   → konfiguracja własnego poziomu (NOWE)
```

Każdy panel dostaje `className="flex-1 overflow-y-auto"` — czyli przewijanie „za darmo", tak jak
historia (AC-3, AC-13, AC-14). Kompozytor renderujemy **tylko** przy `headerPanel === "none"`
(dziś jest ukrywany dla historii warunkiem `!showHistory` — uogólniamy do `headerPanel === "none"`),
więc panel ma pełną wysokość okna. Stan wątku żyje w `turns` i nie jest odmontowywany logicznie —
powrót pokazuje rozmowę bez zmian (AC-15).

### 5.2 Konfiguracja własnego poziomu (Z1) — `AssistantLevelSettings.tsx`

- **Usuwamy** suwak „szybko ↔ dokładnie" wraz z `setEffortForAll`/`EFFORT_INDEX` i logiką
  `sharedEffort` (AC-1).
- **Usuwamy** rozwijane „Ustawienia zaawansowane" — komponent renderuje listę rodzajów działań
  wprost (jest teraz osobnym widokiem, nie sekcją w sekcji).
- Pole modelu: znika `<option value="">Jak u administratora</option>`; wartość początkowa to
  `op.key ?? op.defaultKey` (AC-4). Gdy `defaultKey` jest `null` (admin nic nie przypisał), pokazujemy
  jednorazowy komunikat wyjaśniający zamiast pustego wyboru.
- Nagłówek panelu: tytuł + „Przywróć ustawienia administratora" (istniejące `resetUserLlmPrefs`).
- Mobile (C-31, AC-5): siatka `grid-cols-1 md:grid-cols-3`, kontrolki `width: 100%`, `minWidth: 0`,
  cele dotyku `py-3`. Panel ma `padding-bottom: max(1rem, env(safe-area-inset-bottom))`.

**Wejście do panelu (decyzja właściciela):** w menu wyboru poziomu (kompozytor) pozycja „Własny"
dostaje **ikonę wyrównaną do prawej** (`SlidersHorizontal`, `aria-label="Ustawienia własnego poziomu"`).
Klik w ikonę: `stopPropagation` → ustawia poziom na `custom` **i** otwiera `headerPanel === "level"`;
klik w resztę wiersza działa jak dziś (sam wybór poziomu). Usuwamy z 034 automatyczne otwieranie
ustawień przy wyborze `custom` — teraz służy do tego ikona (AC-2).

### 5.3 Panel kosztu (Z2) — `AiCostBadge.tsx`

Dziś: `position: absolute` z `right: 0` albo `left: 0` (prop `align`) i `maxWidth: min(360px, calc(100vw - 32px))`.
Dwa realne błędy: (1) `maxWidth` liczy się od szerokości **okna**, a nie od pozycji przycisku, więc
przy krótkiej odpowiedzi (kwota blisko lewej krawędzi) panel kotwiczony prawą krawędzią wychodzi
**poza lewą** stronę; (2) `overflowX: auto` jest na kontenerze, ale wiersze mają `whiteSpace: nowrap`
i `justifyContent: space-between`, więc rozpychają go zamiast przewijać.

Rozwiązanie (bez nowych zależności, C-53):
- pozycjonowanie liczone **po otwarciu** z `getBoundingClientRect()` przycisku i szerokości okna:
  wybieramy stronę z większym zapasem i clampujemy przesunięcie tak, by panel mieścił się z marginesem
  `PANEL_MARGIN = 8px` po obu stronach (AC-6, AC-8);
- przeliczenie na `resize` i `orientationchange` (panel otwarty przy obrocie telefonu nie może wyjechać);
- wewnątrz: `overflow-x: auto` na **liście wywołań**, a wiersze w `min-width: max-content` — dzięki
  temu przewija się zawartość panelu, a nie strona (AC-7);
- `max-width: min(360px, calc(100vw - 16px))` jako twardy sufit.

### 5.4 Klawiatura i kursor (Z3, Z4)

- **Z3:** usuwamy `keepKeyboardOpen` (`onPointerDown` + `preventDefault`) ze wszystkich przycisków
  kompozytora. Przycisk wysyłania zachowuje jawny `blur()` (jak dziś). Efekt: dotknięcie czegokolwiek
  poza polem zabiera fokus → iOS chowa klawiaturę (AC-9). Ryzyko „trzeba kliknąć dwa razy" (powód, dla
  którego to kiedyś wprowadzono) adresujemy `onPointerDown`-em wykonującym akcję tam, gdzie chodzi o
  otwarcie menu/panelu — **bez** `preventDefault`, więc fokus i tak wychodzi z pola.
- Skoro pole traci fokus, **usuwamy** obejście z 034: `caretColor: showLevelMenu ? "transparent" : …`
  wraca do stałego `var(--accent-blue)` (AC-10).
- **Z4 — przyczyna:** stopka kompozytora ma
  `paddingBottom: composerFocused ? undefined : "max(0.75rem, env(safe-area-inset-bottom))"`.
  Fokus zmienia wysokość elementu **w tej samej klatce**, w której iOS animuje klawiaturę i wylicza
  pozycję karetki — stąd kursor „nad polem" albo „bardzo nisko", korygowany dopiero przy pierwszym
  wpisanym znaku (który wymusza ponowne wyliczenie). Naprawa zgodna z sugestią właściciela: **stały**
  `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))`, bez zależności od fokusu; stan
  `composerFocused` usuwamy (AC-11, AC-12).

### 5.5 Skrót powrotu (Z6)

- Do paska dochodzi przycisk „×" (`aria-label="Ukryj skrót do poprzedniej rozmowy"`) ustawiający
  `lastConversationDismissed` — pasek znika (AC-16).
- Wysłanie pierwszej wiadomości i tak czyści warunek (`turns.length === 0`), więc auto-znikanie
  działa już dziś; dopisujemy jawne wyzerowanie `lastConversationId` po wysłaniu, żeby skrót nie wrócił
  po skasowaniu wątku (AC-17).
- Odrzucenie żyje w stanie komponentu (do końca sesji), rozmowa zostaje w historii — bez zmian w bazie.

## 6. Audyt tokenów (Z7) — analiza, skrypt i raport

### 6.1 Wyodrębnienie promptów (zmiana czysto przenosząca)

AC-19/AC-20 wymagają **pełnej treści** promptów i rozliczenia tokenów. Dziś prompty są prywatnymi
stałymi w `src/app/api/llm/home/agent/route.ts` (plik trasy nie może eksportować nic poza handlerami),
więc nie da się ich zmierzyć inaczej niż przepisując ręcznie — co czyniłoby raport niesprawdzalnym.

Dlatego: **przenosimy** `ACTION_CATALOG_HEADER/FOOTER`, `ACTION_CATALOG_BY_MODULE`,
`buildActionCatalog`, `NAVIGATION_CATALOG`, `buildSystemPrompt` oraz treść promptu routera do nowego
`src/lib/ai/agentPrompt.ts`. Trasa importuje je i **nic więcej się nie zmienia** — to przenosiny
1:1, bez zmiany treści promptu, więc AC-22 (zachowanie i koszty bez zmian) zostaje spełnione.
`src/lib/ai/fastPath.ts` dostaje `export` na swoim `SYSTEM_PROMPT`.

**Konsekwencja dla bramki:** `scripts/check-action-coverage.js` czyta katalog z pliku trasy
(`indexOf("const ACTION_CATALOG")` … `indexOf("const NAVIGATION_CATALOG")`). Skrypt musi zacząć czytać
`src/lib/ai/agentPrompt.ts`. Bez tego bramka przestanie widzieć akcje i **wywali build** — co jest
zresztą dobrym testem, że przenosiny są kompletne.

### 6.2 Skrypt liczący (jednorazowy, usuwany po użyciu)

`src/audyt-tokenow.ts` (uruchamiany `npx tsx`, kasowany po wygenerowaniu — C-01: nic tymczasowego nie
zostaje w repo):
1. odtwarza **wszystkie trzy** prompty dla polecenia „hej": prompt klasyfikatora (`fastPath`),
   prompt routera (`routeModules`) i prompt agenta (`buildSystemPrompt` dla modułów wybranych w tym
   przebiegu) plus wiadomość użytkownika składaną w `POST`;
2. liczy tokeny istniejącym `estimateTokens` (`lib/llm/tpmLimiter.ts`, ~4 znaki/token) i zestawia je z
   **rzeczywistymi** liczbami z logu `AiCall` ze zgłoszenia — różnica szacunku i pomiaru jest w raporcie
   wprost opisana;
3. rozlicza 5284 tokeny zapisu do pamięci podręcznej wobec rozmiaru promptu agenta;
4. generuje gotowy markdown raportu (analiza + załączniki z pełnymi tekstami) i sprawdza brak kolizji z
   tagiem dollar-quotingu;
5. treść trafia do pliku migracji.

### 6.3 Zawartość raportu

Sekcje: (1) streszczenie dla właściciela z tabelą „skąd 7734 tokeny", (2) przebieg krok po kroku dla
„hej" z trzema wywołaniami, (3) **dlaczego tyle** — z rozbiciem na: prompt klasyfikatora ~1,1 tys.
tokenów wysyłany zawsze; prompt routera; prompt agenta ~5,3 tys. tokenów (katalog akcji wybranych
modułów + protokół + zasady) wysyłany także wtedy, gdy polecenie to zwykłe powitanie; (4) **pamięć
podręczna** — dziś prefiks systemowy zmienia się między wywołaniami (`buildSystemPrompt(selectedModules)`),
więc jest **zapisywany** (1,25× ceny wejścia) i praktycznie nigdy **odczytywany** (w logach `5284/0`);
(5) propozycje optymalizacji, każda z zyskiem/ryzykiem/zakresem; (6) załączniki A/B/C z pełnymi
promptami i odpowiedziami. **Żadna propozycja nie jest wdrażana w tym przebiegu** (AC-22).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/components/home/AICommandSheet.tsx` | edycja | sekcje w miejscu wątku + przewijanie, usunięcie `keepKeyboardOpen` i `composerFocused`, stały padding, ikona przy „Własny", „×" na skrócie powrotu |
| `src/components/home/AssistantLevelSettings.tsx` | edycja | usunięcie suwaka i „zaawansowanych", brak opcji „jak u administratora", układ mobilny |
| `src/components/ui/AiCostBadge.tsx` | edycja | pozycjonowanie liczone z pomiaru + przewijanie poziome wewnątrz |
| `src/lib/ai/agentPrompt.ts` | **nowy** | przeniesione katalogi i budowanie promptu (bez zmiany treści) |
| `src/app/api/llm/home/agent/route.ts` | edycja | import promptów z nowego modułu |
| `src/lib/ai/fastPath.ts` | edycja | `export` promptu klasyfikatora (na potrzeby audytu) |
| `scripts/check-action-coverage.js` | edycja | czyta katalog z `agentPrompt.ts` |
| `prisma/migrations/0213_raport_audyt_tokenow/migration.sql` | **nowy** | seed raportu (idempotentny) |
| `doświadczenia.md` | edycja | lekcje: karetka na iOS a skaczący padding; cache promptu bez trafień |
| `CLAUDE.md` | edycja | odnotowanie `agentPrompt.ts` w opisie asystenta |

## 8. Bramki i weryfikacja (C-50)

- Lokalny Postgres + `npx prisma migrate deploy` (C-13 — nigdy prod DB); sprawdzenie, że raport
  wylądował i że powtórne uruchomienie migracji nie tworzy duplikatu.
- `npm run check:migrations`, `npm run check:actions` (**krytyczne** — potwierdza kompletność przenosin
  promptu), `npm run check:ai-coverage`, `next lint`, `next build`.
- Mapowanie AC: AC-1…AC-5 → inspekcja komponentu + brak opcji „jak u administratora" w kodzie;
  AC-6…AC-8 → analiza logiki pozycjonowania i wartości granicznych (320 px, przycisk przy lewej
  krawędzi); AC-9…AC-12 → potwierdzenie, że w drzewie nie ma już `keepKeyboardOpen` ani warunkowego
  paddingu; AC-13…AC-15 → struktura renderu (panel w miejscu wątku, `overflow-y-auto`);
  AC-16/AC-17 → stan odrzucenia i warunek widoczności; AC-18…AC-21 → migracja zaaplikowana lokalnie +
  odczyt raportu z bazy + zgodność sum tokenów; AC-22 → `git diff` po stronie promptów musi być
  **czystym przeniesieniem** (porównanie treści przed/po).

## 9. Ryzyka techniczne i plan wycofania

- **Przenosiny promptu zmieniłyby treść** → AC-22 poleci. Mitygacja: przenosimy metodą wytnij-wklej,
  a w weryfikacji porównujemy wygenerowany prompt sprzed i po zmianie (skrypt audytowy liczy oba).
- **Bramka `check:actions` po przenosinach** — jeśli skrypt nie zostanie zaktualizowany, build padnie.
  To zamierzone zabezpieczenie, nie ryzyko; aktualizacja jest częścią zadania.
- **Usunięcie `keepKeyboardOpen`** może przywrócić „pierwsze dotknięcie tylko chowa klawiaturę".
  Mitygacja: akcje otwierające menu/panel na `onPointerDown` (bez `preventDefault`), jawnie ujęte w AC-9.
- **Pozycjonowanie panelu kosztu z pomiaru** — przy zamkniętym panelu nie ma czego mierzyć; liczymy
  przy otwarciu i na `resize`. Fallback: dotychczasowe kotwiczenie do prawej krawędzi.
- **Bardzo długi raport w migracji** — ryzyko kolizji z tagiem dollar-quotingu. Mitygacja: skrypt
  sprawdza, czy `$report_md$` nie występuje w treści, zanim zapisze plik.
- Rollback: zmiany UI cofalne commitem; migracja dodaje wyłącznie wiersz `Report` — jej wycofanie to
  `DELETE FROM "Report" WHERE slug = …`, bez wpływu na inne dane.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — jedna idempotentna migracja z seedem raportu; bez zmian schematu; weryfikacja na
      lokalnym Postgresie.
- [x] **C-20..C-25** — brak nowych mutacji; istniejące akcje bez zmian; brak nowych `AIAction`.
- [x] **C-30..C-32** — wyłącznie zmienne CSS, mobile-first (przewijanie, `env(safe-area-inset-bottom)`,
      cele dotyku), teksty po polsku.
- [x] **C-40** — dobór modelu nadal po stronie konfiguracji; audyt niczego nie przestawia.
- [x] **C-53** — przenosiny zamiast przepisywania, zero nowych zależności; pozycjonowanie panelu na
      gołym API przeglądarki.
- [x] **C-54** — decyzja o wyodrębnieniu `agentPrompt.ts` (nieprzewidziana w specu, wymuszona przez
      AC-19/AC-20) odnotowana tutaj jako świadome, behawioralnie neutralne odstępstwo od minimalizmu.
