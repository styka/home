# Plan techniczny: Optymalizacja kosztów asystenta AI

- **Spec:** ./spec.md (028-ai-assistant-cost-optimization)
- **Status:** draft
- **Data:** 2026-07-23

> **Zasada planu:** to jest **JAK**, pod istniejący kod asystenta. Zmiany są chirurgiczne (C-53):
> optymalizujemy istniejącą pętlę agenta, prompty i sposób podawania danych; dokładamy koszt do już
> istniejącego wskaźnika zużycia. **Bez zmian schematu, bez nowych `AIAction`, bez nowych read-toolów,
> bez nowych zależności.**

## 1. Podejście
Rdzeń kosztu to `src/app/api/llm/home/agent/route.ts` (`runAgentLoop`) — **surowe wyniki narzędzi są
serializowane `JSON.stringify(results)` i wstrzykiwane jako wiadomość, która zostaje w tablicy
`messages` na wszystkie kolejne iteracje** (re-wysyłane w każdym wywołaniu modelu). Dokładamy trzy
bezpieczne dźwignie: (a) **twardy limit + kompaktowanie wyników narzędzi** wstrzykiwanych do kontekstu i
**zwijanie zużytych bloków** w kolejnych iteracjach; (b) **odchudzenie promptu systemowego** agenta
(usunięcie redundancji, przy zachowaniu protokołu i reguł bezpieczeństwa); (c) **stabilny prefiks pod
cache**. Do tego rozszerzamy istniejący `AgentMeta` + `MetaFooter` o **szacowany koszt** (AC-6),
korzystając z gotowego `estimateCostUsd`/`pricing.ts`. Wzorzec do naśladowania: sam ten route (i
`chat.ts`/`usage.ts`) — trzymamy jego styl (helpery prywatne w pliku, komentarze `//` po polsku, typy
union jako `String`).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Obserwowalność (`AiCall`: `promptTokens/completionTokens/cacheRead/cacheWrite/
totalTokens/costUsd/...`) i budżet (`AiUsage`) już istnieją i wystarczają. **Brak migracji.**

## 3. Warstwa serwera (Server Actions — C-20)
**Nie dotyczy** — feature nie wprowadza nowych mutacji danych ani nie zmienia Server Actions. Cała praca
jest w route'cie API asystenta oraz w helperach `lib/ai` / `lib/llm`. `revalidatePath` nie ma
zastosowania (brak mutacji stanu użytkownika). Guardy/własność (C-21) bez zmian — read-toole już
egzekwują dostęp per użytkownik.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Slug `module.home` istnieje; wskaźnik zużycia widzi właściciel jako użytkownik asystenta;
panel `/admin/ai-calls` pozostaje admin-only. Brak wpięć w `permissions.ts` / `modules.tsx` /
`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
- **Plik:** `src/components/home/AICommandSheet.tsx` — jedyna zmiana UI.
- **`MetaFooter`** (istnieje, ~l. 225) rozszerzamy o **szacowany koszt**: obok `model` i `N tok.`
  dokładamy `~$0.0012` (albo `~0,12 gr` — patrz decyzja niżej), z `title` po polsku. Zachowujemy styl:
  `fontSize:10`, `color: var(--text-muted)` (C-30 — zmienne CSS, nie hex), dyskretnie pod odpowiedzią.
  Responsywność bez zmian (to jeden mały wiersz — nie łamie układu na mobile, C-31).
- **Typ `AgentMeta`** (klient, ~l. 63) i po stronie serwera rozszerzamy o pola kosztu/rozbicia
  tokenów (patrz pkt 6). `hasAnyLog`/eksport logu (~l. 186) dostają koszt w podsumowaniu (spójność).
- **Decyzja (domyślna, C-55 furtka niepotrzebna):** koszt pokazujemy w **USD** z 4 miejscami
  (`~$0.0009`), bo `costUsd` jest w USD i tak liczony w `pricing.ts`/`AiCall`; gdy koszt = 0 (nieznany
  model / fast-path) — pomijamy człon kosztu (jak dziś dla braku tokenów). Teksty PL (C-32).

## 6. AI / integracje (C-23, C-40)
Bez nowych `AIAction` (C-23 spełnione — `check:actions` nie ruszony) i bez zmiany routingu modeli
(C-40 — dalej DB-driven; **nie** hardcode'ujemy providera/modelu). Zmiany w `route.ts` +
`agentTools.ts` + `chat.ts`(minimalnie):

**6a. Kompaktowanie i limit wyników narzędzi (AC-1, AC-2, AC-8) — `route.ts`, krok `query`:**
- Nowy prywatny helper `compactToolResults(results): string` w `route.ts`, który przed wstrzyknięciem:
  - serializuje wynik z **twardym budżetem znaków** na CAŁY blok (stała np. `TOOL_RESULT_MAX_CHARS`,
    np. 3500) oraz **na pojedyncze narzędzie** (np. `PER_TOOL_MAX_CHARS`);
  - gdy wynik narzędzia przekracza limit — obcina listę rekordów (zachowując pierwsze N) i **czytelnie
    dokleja znacznik** `"... [ucięto: pokazano X z Y rekordów — zawęź zapytanie]"`, żeby model wiedział,
    że dane są niepełne (AC-2, nie myli modelu);
  - **zachowuje delimiter `<<<DANE … DANE>>>` i adnotację „NIEUFNE DANE"** (AC-8 — ochrona
    prompt-injection nienaruszona).
- **Zwijanie zużytych bloków (AC-1):** w pętli, **przed** kolejnym wywołaniem modelu, starsze
  wiadomości z wynikami narzędzi (wszystkie poza **ostatnim** blokiem) zastępujemy krótkim stubem
  `"[wyniki narzędzi z wcześniejszego kroku — już wykorzystane]"`. Ostatni blok zostaje pełny (model go
  właśnie potrzebuje do następnego kroku/odpowiedzi). Znakujemy bloki, żeby je rozpoznać (np. prefiks
  stały w treści user-message). To eliminuje kwadratowy narost tokenów przy `query→query→answer`.
  Ryzyko jakości minimalizujemy: identyfikatory (id) potrzebne do akcji **zawsze** są w ostatnim/aktualnym
  bloku, a odpowiedzi analityczne bazują na najświeższych danych.

**6b. Odchudzenie promptu systemowego (AC-3) — `route.ts` `buildSystemPrompt` + `agentTools.ts`
`READ_TOOLS_PROMPT`:**
- Przepisujemy sekcję `ZASADY` i nagłówki protokołu na **zwięźlejsze** sformułowania (usuwamy
  powtórzenia tej samej reguły w kilku miejscach), **bez usuwania żadnej reguły merytorycznej**:
  zostają protokół 6 kroków, reguła BEZPIECZEŃSTWA (prompt-injection), query-first, clarify-not-guess,
  bulk/chain, wybór modułu. Cel: mierzalnie mniejszy prompt przy identycznym zestawie reguł.
- W `READ_TOOLS_PROMPT` skracamy rozwlekłe opisy pojedynczych narzędzi do formy zwartej (sygnatura +
  1 zdanie), zachowując nazwy pól wyników i parametry (model musi wiedzieć, co dostaje).
- **Mierzymy** proxy tokenów (znaki/4) przed/po dla ustalonego zestawu modułów (do raportu).

**6c. Stabilny prefiks pod cache (AC-4) — `route.ts` / `chat.ts`:**
- `buildSystemMessages` (chat.ts) już pakuje cały system jako jeden blok `cache_control: ephemeral`
  (Anthropic). Utrzymujemy **niezmienny preambułę** (protokół + ZASADY) na początku, a zmienne sekcje
  (katalog per-moduł) po niej — kolejność stała, żeby maksymalizować trafienia cache w obrębie rozmowy.
  **Nie** wstawiamy do `system` niczego zmiennego (data/kontekst widoku już są w wiadomości user — OK).
- Prefiks provider-agnostyczny: dla OpenAI-compatible (Groq) cache prefiksu działa automatycznie po
  stronie dostawcy przy stałym prefiksie — nasza stabilizacja pomaga obu. Bez hardcode'u providera.

**6d. Dokładność wskaźnika kosztu (AC-6, AC-7) — `route.ts` `AgentMeta` + `callAgent`:**
- Rozszerzamy `type AgentMeta` o: `promptTokens`, `completionTokens`, `cacheRead`, `cacheWrite`,
  `costUsd` (wszystko akumulowane; `tokens` zostaje dla zgodności).
- W `callAgent` po każdym wywołaniu: sumujemy rozbicie z `result.usage` i **liczymy koszt** przez
  `estimateCostUsd({promptTokens, completionTokens, cacheReadTokens, cacheWriteTokens}, result.model)`
  (import z `@/lib/llm/pricing`), dodając do `meta.costUsd`. (Cena i tak jest liczona w `AiCall`;
  tu tylko sumujemy do zwrotu klientowi.)
- **Uwzględniamy też koszt routera i fast-path**, żeby wskaźnik był realny (AC-6/AC-7): `routeModules`
  i `classifyIntent` dostają opcjonalny parametr `meta`, do którego dokładają swoje `usage` (obie i tak
  wołają `chatComplete`, więc wystarczy zwrócić/przyjąć usage). Fast-path zwraca wtedy `meta` z realnym
  kosztem klasyfikacji zamiast `tokens:0`.
- `meta.costUsd` trafia w `result.body.meta` (SSE `final` i JSON — miejsca już istnieją, ~l. 845/868).

**6e. Briefing (`/api/llm/home/briefing`) — poza krytyczną ścieżką:** pojedyncze wywołanie,
`maxTokens:450`, bez pętli — **zostawiamy bez zmian** (minimalizm C-53; brak istotnej dźwigni). Odnotowane
w spec „Poza zakresem/W zakresie o ile w zasięgu" — świadomie pomijamy.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/app/api/llm/home/agent/route.ts` | edycja | `compactToolResults` + limity (AC-1/AC-2/AC-8); zwijanie zużytych bloków; odchudzony `buildSystemPrompt`; stabilny prefiks; `AgentMeta`+koszt (AC-6); przekazanie `meta` do `routeModules`/`classifyIntent` (AC-7) |
| `src/lib/ai/agentTools.ts` | edycja | zwięźlejszy `READ_TOOLS_PROMPT` (AC-3), bez utraty pól/parametrów |
| `src/app/api/llm/home/fastpath` *(lokalizacja `classifyIntent`)* | edycja | opcjonalny `meta`/zwrot usage dla realnego kosztu fast-path (AC-7) |
| `src/lib/llm/chat.ts` | edycja (min.) | tylko jeśli potrzebne do stabilizacji prefiksu/cache (AC-4); inaczej bez zmian |
| `src/components/home/AICommandSheet.tsx` | edycja | `AgentMeta` (klient) + `MetaFooter` o koszt; koszt w eksporcie logu (AC-6) |
| `src/lib/llm/__tests__/…` | nowy/edycja | test jednostkowy `compactToolResults` (limit/znacznik ucięcia/zachowanie delimitera) |
| `specs/028-.../report-przed-po.md` | nowy | raport „przed/po" — proxy tokenów promptu + instrukcja potwierdzenia w `/admin/ai-calls` |
| `doświadczenia.md` | edycja | wpis po napotkanych pułapkach (C-51) |

> `classifyIntent` — dokładną lokalizację (`src/lib/ai/*` lub route) ustali `/implement` (grep);
> plan zakłada, że to helper wołający `chatComplete` (op `dispatch`).

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie:** to zmiany logiki TS + prompty; weryfikacja do kroku `next build` (lint + typy +
  `check:actions` + `check:migrations`). **Nie** ruszamy prod DB (C-13). Lokalny Postgres wg C-31/CLAUDE.md
  tylko jeśli build tego wymaga; brak migracji ⇒ `check:migrations` przechodzi trywialnie.
- **Test jednostkowy** `compactToolResults`: sprawdza (i) obcięcie do limitu, (ii) obecność znacznika
  „ucięto X z Y", (iii) zachowany delimiter/„NIEUFNE DANE".
- **Mapowanie AC → weryfikacja:**
  - AC-1/AC-2 → test jednostkowy + inspekcja pętli (zwijanie bloków); ręczny scenariusz wieloetapowy.
  - AC-3 → pomiar proxy tokenów `buildSystemPrompt`/`READ_TOOLS_PROMPT` przed/po (skrypt/liczba znaków) —
    w raporcie.
  - AC-4 → inspekcja: brak zmiennych treści w `system`; stały prefiks; (na Anthropic) `cacheRead>0` w
    `AiCall` po deployu (potwierdzenie właściciela).
  - AC-5 → uzgodniony zestaw poleceń: odczyt / dodanie zadania / akcja zbiorcza / rozmowa / raport —
    porównanie odpowiedzi przed/po (równoważność). W sandboxie bez realnego LLM: weryfikacja
    strukturalna (te same ścieżki kodu/te same akcje w kształcie), potwierdzenie live po deployu na
    `develop`.
  - AC-6 → build + inspekcja UI: `MetaFooter` pokazuje koszt; `meta.costUsd` w odpowiedzi.
  - AC-7 → po deployu: `/admin/ai-calls` pokazuje niższe `promptTokens` na wywołanie; opisane w raporcie.
  - AC-8 → test jednostkowy (delimiter/adnotacja) + inspekcja promptu.
  - AC-9 → `npm run build` (do `next build`) zielony.
- **Uwaga o AC „live":** realny pomiar tokenów wymaga trafienia płatnego modelu — w sandboxie
  niedostępny. Dlatego AC-3 mierzymy **statycznie** (rozmiar promptu), a AC-5/AC-7 potwierdzamy
  **strukturalnie teraz + na `develop` po deployu**. To świadome i odnotowane (nie „udawany" pomiar).

## 9. Ryzyka techniczne i plan wycofania
- **Zwijanie bloków gubi dane potrzebne do finalnej odpowiedzi** → mitygacja: zwijamy tylko bloki
  starsze niż ostatni; id do akcji zawsze w aktualnym bloku; test + scenariusz wieloetapowy. Rollback:
  czysto kodowy (rewert route.ts) — brak migracji, brak danych do cofania.
- **Zbyt agresywne skracanie promptu psuje zachowanie** → mitygacja: usuwamy tylko redundancje, nie
  reguły; dyf promptu recenzowany zdanie-po-zdaniu w `/review` pod kątem kompletności reguł.
- **Znacznik ucięcia i tak zwiększa nieznacznie prompt** → akceptowalne; limit i tak tnie netto.
- **Koszt w USD mylący przy nieznanym modelu (=0)** → pomijamy człon kosztu, jak dziś dla braku tokenów.
- **Provider bez cache prefiksu** → stabilizacja prefiksu jest neutralna (nie szkodzi), a pomaga tam,
  gdzie cache jest.
- **Rollback ogólnie:** wszystkie zmiany są kodowe (route/lib/komponent) — rewert commita; brak kroku
  migracyjnego (por. runbook devops: rollback „code, nie migracja").

## 10. Zgodność z konstytucją — checklista
- [x] **C-10..C-14 (migracje)** — bez zmian schematu, brak migracji; `check:migrations` przechodzi.
- [x] **C-20..C-25** — brak nowych mutacji/Server Actions; brak nowych `AIAction` (C-23 OK); RBAC bez
      zmian (C-22); trash/audit nie dotyczy.
- [x] **C-30..C-32 (UX)** — `MetaFooter` na zmiennych CSS, dyskretny, responsywny; teksty PL.
- [x] **C-40/C-41** — routing modeli dalej DB-driven; klucze niezmienione, nic nie logujemy jawnie.
- [x] **C-53 (minimalizm)** — najmniejszy zestaw zmian; zero nowych zależności; brak „przy okazji"
      refaktorów; naśladujemy styl istniejącego route'a.
- [x] **C-50/C-51/C-52/C-55** — „gotowe" = build zielony; wpis do `doświadczenia.md`; auto-merge do
      `develop` + pre-autoryzowana promocja do `master`; brak pytań poza `/specify`.
