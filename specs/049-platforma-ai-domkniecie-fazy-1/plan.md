# Plan techniczny: Platforma AI i domknięcie Fazy 1

- **Spec:** ./spec.md (049-platforma-ai-domkniecie-fazy-1)
- **Status:** draft
- **Data:** 2026-08-11

> **Zasada planu:** to jest **JAK**. Wzorcem jest fala 3 (048): pole deklaracji ładowane leniwie
> (`sideNav`), przenosiny oddzielone od zmian zachowania, komplet bramek po każdym kroku.

## 1. Podejście

Kolejność jest **wymuszona kierunkiem zależności**, nie wygodą. Nie da się przenieść `lib/ai` do
platformy, dopóki 18 jej plików importuje moduły — więc **najpierw kod modułowy wraca do modułów**
(egzekutory, read-toole, handlery zadań), a dopiero **potem** to, co zostanie, jedzie do platformy
jako czysta przenosina. Odwrotna kolejność wymagałaby przeniesienia kodu łamiącego C-36 do katalogu,
którego cała reguła zabrania — i trzeba by go potem przenosić drugi raz.

Wzorzec pola deklaracji jest gotowy z 048: **funkcja zwracająca `import()`**, rozwiązywana leniwie.
Tu jest to warunek poprawności jeszcze ostrzejszy niż przy `sideNav`: `MODULES` importuje
`ModuleSidebar`, który jest komponentem **klienckim**, a egzekutory i handlery to kod serwerowy
(Server Actions, Prisma). Statyczne pole `ai: { actions, readTools }` — dosłownie jak w rozdz. 9.3 —
wciągnęłoby serwer do bundla klienta. **Odstępujemy od literalnego kształtu z dokumentu na rzecz
leniwego loadera**, i to jest świadoma decyzja tego planu.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Zero nowych modeli, kolumn i migracji — przebieg jest wyłącznie
strukturalny. Potwierdzi to `npm run check:schema-drift` (od recenzji 048 używa osobnej bazy cienia,
więc nie kasuje bazy roboczej) oraz `npm run check:migrations` (numer nie rośnie; ostatni to 0225).

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych Server Actions i bez zmian w istniejących co do treści.** Egzekutory i read-toole
**nie są** Server Actions — to zwykłe moduły serwerowe wołające akcje modułów. Przenosiny nie
dotykają `revalidatePath` ani guardów: każdy guard jedzie razem ze swoją akcją, w tym samym pliku
(C-21). Jedyna zmiana w treści plików to **ścieżki importu**.

Miejsce sprawdzania uprawnień się nie zmienia: choke point walidacji w
`src/app/api/llm/home/execute/route.ts` (`hasContract` + `validateActionParams`) zostaje **tam gdzie
jest** — to trasa, czyli warstwa kompozycji, której wolno znać moduły.

## 4. RBAC / rejestr modułu (C-22)

Bez nowych slugów i bez zmian w bazie. Rejestr zyskuje trzy pola w `ModuleDeclaration`
(`src/platform/registry.ts`), wszystkie **opcjonalne i leniwe**:

```ts
/** Wkład modułu do asystenta — ładowany leniwie (kod serwerowy). */
ai?: () => Promise<{
  actions?: AiActionContribution;     // katalog akcji (tekst promptu) + egzekutor
  readTools?: AiReadToolContribution; // definicje + implementacje narzędzi odczytu
}>;

/** Wkład modułu do wspólnego kalendarza. */
calendar?: () => Promise<{ default: CalendarContributor }>;

/** Wkład modułu do migawki pulpitu. */
dashboard?: () => Promise<{ default: DashboardContributor }>;

/** Zadania w tle należące do modułu: typ → handler. */
jobs?: () => Promise<{ default: Record<string, JobHandler> }>;
```

Typy `AiActionContribution`, `CalendarContributor`, `DashboardContributor`, `JobHandler` żyją
w platformie i **nie znają żadnego modułu** — biorą `userId`/zakres parametrem (C-36, AC-3).

## 5. UI (C-30, C-31, C-32)

**Zero zmian w UI.** Żadnego nowego widoku, komponentu ani tekstu. Pulpit, kalendarz i asystent mają
wyglądać i odpowiadać identycznie — to jest AC-8 i AC-9, najostrzejszy warunek przebiegu.
Jedyne dotknięte pliki UI to te, w których zmienia się ścieżka importu.

## 6. AI / integracje (C-23, C-40)

- **Zero nowych `AIAction`, zero nowych read-tooli.** Zmienia się wyłącznie **skąd** katalog jest
  składany.
- `platform/ai/catalog.ts` — czysta funkcja `buildAiCatalog(modules)`, biorąca moduły
  **parametrem** (wzorzec `filterAccessibleFavorites(…, isPathLocked)`; AC-3). Platforma dostarcza
  funkcję, korzeń kompozycji ją woła.
- Korzeń kompozycji dla AI: `src/lib/ai/catalog.ts` (obok `src/lib/modules.tsx`) — składa katalog
  z `MODULES` i wystawia go trasie agenta oraz trasie egzekucji.
- Routing modeli (`resolver.ts`) i szyfrowanie kluczy zostają **bez zmian co do treści** (C-40, C-41)
  — jadą do platformy jako czysta przenosina.

## 7. Fazy — każda kończy się na czystej linii

Przebieg jest duży, więc dzieli się na sześć faz. **Każda z nich to poprawny stan końcowy** — jeśli
kontrola nad przebiegiem będzie zagrożona, zatrzymujemy się na granicy fazy z jawnym raportem
(spec §5, „Świadome ograniczenie przebiegu"), a nie w środku.

### Faza A — `platform/llm` (czysta przenosina)

`src/lib/llm/` → `src/platform/llm/`. **Zero importów modułów** (sprawdzone), więc to najprostszy
możliwy krok i jednocześnie dowód, że wzorzec przenosin działa na tej warstwie.
9 plików, 64 miejsca importujące. `src/lib/llm-client.ts` (typowany klient tras `/api/llm/*`) **nie
jest** częścią tej warstwy — to konsument po stronie klienta, zostaje w `src/lib`.

### Faza B — egzekutory i read-toole wracają do modułów (zadanie 8)

To jest rdzeń przebiegu. Dla każdego z 17 modułów mających egzekutor:

- `src/lib/ai/executors/<x>Executor.ts` → `src/modules/<x>/ai/executor.ts`;
- blok tekstu z `ACTION_CATALOG_BY_MODULE[<x>]` → `src/modules/<x>/ai/catalog.ts`;
- read-toole tego modułu wyjęte z `agentTools.ts` → `src/modules/<x>/ai/readTools.ts`;
- `src/modules/<x>/ai/index.ts` zbiera je i jest celem leniwego `ai:` w `module.ts`.

`executors/shared.ts` jest **wspólny dla wszystkich egzekutorów** i importuje kontrakt Zakupów
(`createList`). Zgodnie z regułą „przynależność ustala lista konsumentów" nie należy do żadnego
modułu — zostaje w warstwie kompozycji jako `src/lib/ai/executorShared.ts`. Jego zależność od Zakupów
zostaje **wstrzyknięta**, żeby plik nie musiał znać modułu.

`agentTools.ts` (1199 linii) rozpada się na: część platformową (pętla narzędzi, protokół, formatowanie
wyników) → `platform/ai/tools.ts`, i 20 wkładów modułowych → `modules/<x>/ai/readTools.ts`.

**Rejestr egzekutorów** w `src/app/api/llm/home/execute/route.ts` przestaje być łańcuchem
18 `if (module === …)` i staje się odpytaniem katalogu złożonego z deklaracji. Ta zmiana jedzie
**osobnym commitem** po przeniesieniu wszystkich egzekutorów — bo to zmiana zachowania, a nie
przenosiny (AC-13).

### Faza C — `platform/ai` (czysta przenosina)

Po fazie B w `src/lib/ai` nie ma już nic, co importuje moduł. Zostaje ~23 pliki zdolności
platformowych: `agentProtocol`, `agentContext`, `agentPartialRun`, `contentMemory`, `cache`,
`rateLimit`, `usage`, `costVisibility`, `sectionMode(+Resolver)`, `followups`, `humanize`,
`refResolve`, `fastPath`, `conversationLimits`, `aiCallLog`, `aiAction`, `actionContract`,
`coverage`, `assistantStarters`, `assistantBus`, `feedbackBus`. Wszystkie → `src/platform/ai/`.

Trzy pliki **nie jadą do platformy**:
- `agentPrompt.ts` — po fazie B jego katalog akcji pochodzi z modułów; zostaje część szkieletowa
  (nagłówki, protokół, `buildSystemPromptParts`) → platforma, a składanie katalogu → korzeń kompozycji;
- `petActions.ts` — mimo lokalizacji to kod modułu Zwierzęta (lista konsumentów, nie nazwa katalogu);
- trzy manifesty JSON (`action-coverage`, `cost-badge-coverage`, `content-memory-coverage`) — to dane
  bramek, nie kod platformy; zostają przy skryptach kontrolnych.

### Faza D — `platform/jobs` + handlery do modułów

Handlery zadań **nie importują dziś kontraktów modułów** (sprawdzone — sięgają wprost do Prismy), więc
formalnie mogłyby wjechać do platformy. Nie wjadą: `kitchen.*`, `magazyn.*`, `pets.insights`,
`news.refresh`, `stores.generate` to zadania **konkretnych modułów** i o przynależności decyduje lista
konsumentów, nie brak importu (C-36). Idą do `src/modules/<x>/jobs/`, a `JOB_HANDLERS` i wynikająca
z niego allowlista `ENQUEUABLE_TYPES` są **składane z deklaracji**.

Wyjątek: `user.facts` i `imageInput` — pierwszy jest przekrojowy (wnioskuje wiedzę o użytkowniku
z działań we wszystkich modułach), drugi to wspólny helper wejścia obrazowego. Zostają w platformie
z zapisanym powodem.

Rdzeń (`queue`, `worker`, `client`, `types`) → `src/platform/jobs/`.

### Faza E — wkład do pulpitu i kalendarza (reszta zadania 7)

- **Pulpit:** `src/app/page.tsx` importuje dziś **osiem** kontraktów modułów, żeby złożyć migawkę.
  Każdy z tych modułów dostaje `dashboard:` w deklaracji zwracające swój wkład; trasa woła je przez
  katalog. Kształt danych migawki **nie zmienia się** — `HomePage` dostaje dokładnie to samo.
- **Kalendarz:** `collectCalendarEvents` (227 linii, 9 zapytań Prismy do tabel sześciu modułów) rozpada
  się na wkłady modułowe. Moduł Kalendarz przestaje sięgać do cudzych tabel; składa wyniki
  z deklaracji. **Wynik agregatu musi być identyczny** — porównywany przed/po (AC-9).

### Faza F — bramki, dokumentacja, domknięcie

- **Cztery bramki są zaszyte na ścieżki** i wywrócą się na tych przenosinach — to trzeci taki przypadek
  w przebudowie, więc naprawiamy je, nie obchodzimy (AC-11):
  `check-action-coverage.js` czyta `src/lib/ai/agentPrompt.ts` i `src/lib/ai/executors/*` (oba znikają);
  `check-ai-coverage.js` skanuje korzenie akcji; `check-cost-badge.js` i `check-content-memory.js`
  trzymają ścieżki w manifestach JSON.
- **`check-action-coverage` zmienia to, czego pilnuje** (rozdz. 9.6): dziś „czy ręczna lista jest
  kompletna", po zmianie „czy **każdy moduł zadeklarował** swoje akcje i czy każda ma egzekutor oraz
  kontrakt". To gwarancja mocniejsza — moduł bez deklaracji nie istnieje dla aplikacji.
- **`check-module-registry` zyskuje szósty test** (AC-14): moduł nie może być opisany poza własnym
  katalogiem i deklaracją. Konkretnie — żaden egzekutor, read-tool ani handler zadania nie może
  mieszkać pod ścieżką platformową, jeśli należy do modułu z rejestru. Sprawdzone **testem
  negatywnym**, jak piąty test w 048.
- Aktualizacja `CLAUDE.md`, `constitution.md` (C-36 o nowe pola deklaracji), rozdz. 15 dziennika
  i `doświadczenia.md`.

## 8. Pliki do utworzenia / zmiany

| Plik / katalog | Akcja | Po co |
|---|---|---|
| `src/lib/llm/**` → `src/platform/llm/**` | przenosiny | Faza A — warstwa bez wiedzy o modułach |
| `src/lib/ai/executors/<x>Executor.ts` → `src/modules/<x>/ai/executor.ts` | przenosiny ×17 | Faza B |
| `src/modules/<x>/ai/{catalog,readTools,index}.ts` | nowe ×17–20 | wkład modułu do asystenta |
| `src/lib/ai/agentTools.ts` | rozbicie | część platformowa + 20 wkładów modułowych |
| `src/lib/ai/agentPrompt.ts` | rozbicie | szkielet → platforma, katalog → moduły |
| `src/lib/ai/executors/shared.ts` → `src/lib/ai/executorShared.ts` | przenosiny + wstrzyknięcie | wspólny dla egzekutorów, nie należy do modułu |
| `src/platform/ai/catalog.ts` | nowy | `buildAiCatalog(modules)` — czysta, moduły parametrem |
| `src/lib/ai/catalog.ts` | nowy | korzeń kompozycji: `buildAiCatalog(MODULES)` |
| `src/lib/ai/**` (reszta) → `src/platform/ai/**` | przenosiny | Faza C |
| `src/app/api/llm/home/execute/route.ts` | edycja | rejestr egzekutorów z katalogu zamiast 18 `if` |
| `src/app/api/llm/home/agent/route.ts` | edycja | read-toole i prompt z katalogu |
| `src/lib/jobs/handlers/<x>.ts` → `src/modules/<x>/jobs/<x>.ts` | przenosiny ×12 | Faza D |
| `src/lib/jobs/{queue,worker,client,types}.ts` → `src/platform/jobs/` | przenosiny | Faza D |
| `src/lib/jobs/handlers.ts` → `src/lib/jobs/registry.ts` | przepisanie | allowlista z deklaracji |
| `src/app/page.tsx` | edycja | migawka pulpitu z katalogu zamiast 8 importów kontraktów |
| `src/modules/<x>/dashboard.ts` | nowe ×8 | wkład do migawki |
| `src/modules/calendar/lib/collect.ts` | przepisanie | składanie wkładów zamiast 9 zapytań |
| `src/modules/<x>/calendar.ts` | nowe ×6 | wkład do agendy |
| `src/platform/registry.ts` | edycja | pola `ai`, `calendar`, `dashboard`, `jobs` |
| `scripts/check-{action-coverage,ai-coverage,cost-badge,content-memory}.js` | edycja | korzenie skanowania po przenosinach |
| `scripts/check-module-registry.js` | edycja | szósty test (AC-14) |
| `src/lib/ai/{action,cost-badge,content-memory}-coverage.json` | edycja | ścieżki w manifestach |
| `CLAUDE.md`, `.claude/spec-pipeline/constitution.md`, `content/architektura/15-dziennik.md`, `doświadczenia.md` | edycja | Faza F |

## 9. Bramki i weryfikacja (C-50)

**Rytuał po każdym kroku** (jak w 048, rozszerzony o dwie bramki, które ten przebieg dotyka
najmocniej):

```
tsc --noEmit  ·  check:actions (160)  ·  check:ai-coverage (551)  ·  check:cost-badge (35)
check:content-memory (35)  ·  next lint --dir src  ·  check:module-registry  ·  check:boundaries
```

Na koniec każdej fazy: `npm run test:unit` + `npm run build` przeciw **lokalnemu** Postgresowi
(C-13). **Nigdy `next build` równolegle z klikaczami** — walczą o `.next` (lekcja z 047).

Mapowanie AC → weryfikacja:

| AC | Jak sprawdzimy |
|---|---|
| AC-1 | inwentarz `src/lib/{ai,llm,jobs}` przed/po: co zostało i z jakim powodem |
| AC-2 | `grep -rn "@/modules/" src/platform/` → **zero** trafień (dziś 18 plików) |
| AC-3 | przegląd sygnatur w `platform/ai/catalog.ts` i `platform/jobs/*` — parametr **wymagany**, brak wartości domyślnej |
| AC-4 | `src/app/page.tsx` bez importów kontraktów modułów; migawka porównana przed/po |
| AC-5 | `collectCalendarEvents` bez zapytań do tabel cudzych modułów; wynik agregatu porównany przed/po |
| AC-6 | katalog asystenta liczony z `MODULES`; liczba akcji i read-tooli **mierzona przed i po** |
| AC-7 | `JOB_HANDLERS` składane z deklaracji; `ENQUEUABLE_TYPES` = ten sam zbiór co dziś |
| AC-8 | przejście po akcjach asystenta w `/admin/ai-coverage` + porównanie katalogu przed/po |
| AC-9 | pulpit i kalendarz otwarte w klikaczu; migawka i agenda porównane przed/po |
| AC-10 | cztery liczniki bramek: 160 / 551 / 35 / 35 — **żaden nie spada** |
| AC-11 | każda naprawiona bramka odpalona przed i po przenosinach |
| AC-12 | `modules-happy-path.spec.ts` 21/21; pełny zestaw — liczba czerwonych nie rośnie (dziś 14) |
| AC-13 | `git log` fali: commity przenoszące oddzielone od zmieniających zachowanie |
| AC-14 | szósty test `check:module-registry` + **test negatywny** (podłożony plik → czerwono) |
| AC-15 | wpis 049 w rozdz. 15 ze stanem Fazy 1 i pierwszym krokiem Fazy 2 |

## 10. Ryzyka techniczne i plan wycofania

| Ryzyko | Ograniczenie |
|---|---|
| **Katalog asystenta po cichu gubi akcję** — najgroźniejsze, bo objawiłoby się dopiero w rozmowie | liczba akcji i read-tooli mierzona **przed i po**; `check:actions` porównuje katalog z egzekutorami; `/admin/ai-coverage` jako przegląd ręczny |
| **`module.ts` wciąga kod serwerowy do bundla klienta** (`MODULES` importuje `ModuleSidebar`) | wszystkie cztery nowe pola są **leniwe** — funkcja zwracająca `import()`, jak `sideNav` w 048; wykryje `next build` (błąd „Module not found: Can't resolve 'fs'” lub podobny) |
| **Cztery bramki zaszyte na ścieżki wywrócą się** | zakładamy to z góry (AC-11); naprawa bramki jest częścią kroku, nie jego przeszkodą |
| **Kolizje „plik X.ts + katalog X/"** przy przenosinach | sprawdzenie **przed** każdą przenosiną (lekcja z 048, cztery przypadki w jednej fali) |
| **Agregat kalendarza zwróci inny wynik** | porównanie przed/po; rozbicie na wkłady bez zmiany zapytań — te same `where`, ten sam `select` |
| **Przebieg za duży na jedną sesję** | sześć faz, każda to poprawny stan końcowy; zatrzymanie na granicy fazy z jawnym raportem jest **wynikiem**, nie porażką |

**Rollback:** wyłącznie kod — brak migracji, więc cofnięcie to `git revert` commitu albo fazy.
Baza nietknięta, żaden stan użytkownika nie zależy od tej zmiany.

## 11. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — nie dotyczą: zero zmian schematu; potwierdzą `check:schema-drift`
      i `check:migrations`. Build wyłącznie przeciw lokalnemu Postgresowi (C-13).
- [x] **C-20..C-25** — bez nowych Server Actions; guardy i `revalidatePath` jadą razem z akcjami,
      treść nietknięta. `AIAction` bez zmian, egzekutor każdej zachowany (C-23).
- [x] **C-30..C-32** — zero zmian w UI; żadnego nowego tekstu ani koloru.
- [x] **C-36** — reguła wiodąca; AC-2 to jej bezpośredni pomiar.
- [x] **C-40, C-41** — routing modeli zostaje DB-driven, klucze nadal szyfrowane i maskowane.
- [x] **C-53** — odstępstwo od literalnego kształtu z rozdz. 9.3 (leniwe loadery zamiast pól
      statycznych) jest **wymuszone** granicą serwer/klient, a nie preferencją. Nowe są tylko cztery
      pola deklaracji, każde z konsumentem dowożonym w tym samym kroku (C-35).
- [x] **C-54** — spec poprawiony **przed** planem: „kafelek pulpitu" z rozdz. 9.3 nie istnieje
      w Omnii; realnym sprzężeniem jest osiem importów kontraktów w trasie pulpitu.
