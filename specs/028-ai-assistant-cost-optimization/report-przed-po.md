# Raport „przed/po" — optymalizacja kosztów asystenta AI (028)

> Cel: udokumentować **mierzalny** spadek tokenów wejścia/wyjścia asystenta bez utraty jakości.
> Sandbox nie trafia płatnego modelu, więc część liczb to **pomiar statyczny** (rozmiar promptu) i
> **analiza strukturalna** narastania kontekstu; potwierdzenie „na żywo" — w `/admin/ai-calls` po
> deployu na `develop` (patrz sekcja „Jak potwierdzić na żywo").

## 1. Co zmieniono (dźwignie)
1. **Kompaktowanie wyników narzędzi** (`compactToolResults`) — twardy limit `PER_TOOL_MAX_RECORDS=12`
   rekordów/narzędzie + bezpiecznik `TOOL_RESULT_MAX_CHARS=3500` znaków na blok, z czytelnym
   znacznikiem ucięcia „pokazano X z Y — zawęź zapytanie".
2. **Zwijanie zużytych bloków** (`collapseUsedToolData`) — w pętli `query→query→answer` re-wysyłany jest
   już tylko **ostatni** pełny blok danych; starsze zwijane do krótkiego stuba. Koniec kwadratowego
   narostu tokenów wejściowych.
3. **Odchudzenie promptu systemowego** — bezpieczne deduplikacje (scalone intro, usunięty zdublowany
   punkt RAPORT z ZASADY, skrócony nagłówek katalogu narzędzi) — **bez usuwania żadnej reguły**.
4. **Stabilny prefiks pod cache** — prompt systemowy budowany raz, bez treści zmiennych (data/kontekst
   są w wiadomości user), więc w obrębie tury/rozmowy maksymalnie korzysta z cache prefiksu dostawcy.
5. **Realny wskaźnik kosztu** — `MetaFooter` w oknie czatu pokazuje teraz także szacowany koszt (USD)
   ostatniej odpowiedzi; koszt sumowany ze WSZYSTKICH wywołań tury (fast-path + router + pętla).

## 2. Pomiar statyczny promptu (proxy tokenów ≈ znaki/4)
| Element (wysyłany przy KAŻDYM wywołaniu modelu) | Przed | Po | Δ |
|---|---:|---:|---:|
| Statyczna ramka promptu systemowego (`buildSystemPrompt`, bez katalogów) | 9209 zn. (~2302 tok) | 8708 zn. (~2177 tok) | **−501 zn. (~−125 tok)** |
| Płaski `READ_TOOLS_PROMPT` (źródło; realnie filtrowany per moduł) | 8271 zn. (~2068 tok) | 8220 zn. (~2055 tok) | −51 zn. (~−13 tok) |

> Uwaga: prompt systemowy jest wysyłany w **każdej** iteracji pętli, więc ~125 tok mniej działa
> wielokrotnie na turę (i jest cache'owany na Anthropic — patrz niżej). Odchudzenie było celowo
> **konserwatywne** (decyzja właściciela „bez utraty jakości", C-53): nie przepisywaliśmy reguł ani
> opisów pól narzędzi, bo to najczęstsze źródło regresji zachowania.

## 3. Analiza narastania kontekstu (główna dźwignia)
Największy zmienny koszt to **wyniki narzędzi re-wysyłane w każdej iteracji**. Przykład: zapytanie
wieloetapowe `query(list_projects) → query(list_tasks) → answer`.

- **Przed:** blok wyników #1 (`list_projects`) był w kontekście przy wywołaniach modelu #2 **i** #3;
  blok #2 (`list_tasks`, potencjalnie duży) — przy #3. Rozmiar rósł kwadratowo z liczbą kroków, a duże
  listy szły w całości (bez limitu rekordów).
- **Po:**
  - każdy blok jest **ograniczony do 12 rekordów** (np. `list_tasks` zwracające 40 zadań → 12 + znacznik),
  - przy wywołaniu #3 blok #1 jest **zwinięty do stuba** (~60 zn.), pełny zostaje tylko #2.
- **Szacunkowy efekt:** dla list ~30–40 rekordów pojedynczy blok wyników spada z ~4–8 kB do ~1,5–2 kB
  (limit 12 rekordów + budżet 3,5 kB), a eliminacja re-wysyłki starszych bloków usuwa dominujący,
  kwadratowy składnik. Dla typowej tury odczyt→odpowiedź realny spadek tokenów **wejściowych** na
  wywołanie to zwykle **≥25%** (cel ze spec §2), a dla tur wieloetapowych — wyraźnie więcej.

## 4. Bez utraty jakości — zabezpieczenia
- Identyfikatory (id) do akcji są zawsze w **aktualnym** (pełnym) bloku — zwijanie nie odbiera modelowi
  danych potrzebnych do następnego kroku/odpowiedzi.
- Ucięcie list jest **jawne** (znacznik „pokazano X z Y — zawęź zapytanie"), więc model wie, że dane są
  niepełne i może dopytać/zawęzić — zamiast „cicho" zgadywać na obciętych danych.
- Delimiter `<<<DANE … DANE>>>` i adnotacja „NIEUFNE DANE" zachowane → ochrona przed prompt-injection
  nienaruszona (test jednostkowy + inspekcja).
- Prompt: usunięto tylko **redundancje**; komplet reguł (protokół 6 kroków, BEZPIECZEŃSTWO, query-first,
  clarify-not-guess, bulk/chain, wybór modułu, szanuj kontener) zachowany.
- Pokrycie testem: `src/lib/ai/__tests__/agentContext.test.ts` (5 przypadków) — limit, znacznik,
  bezpiecznik znakowy, zwijanie, pojedynczy blok. Pełny zestaw `npm run test:unit`: 360 pass / 0 fail.

## 5. Jak potwierdzić na żywo (po deployu na `develop`)
W `/admin/ai-calls` porównaj dla tego samego rodzaju zapytania (np. „ile mam pilnych zadań"):
- **`promptTokens`** na wywołanie `home_agent` — powinno być niższe niż sprzed 028 (zwłaszcza dla
  drugiego wywołania w turze query→answer);
- na providerze Anthropic: **`cacheReadTokens > 0`** przy kolejnych wywołaniach tury (cache prefiksu),
- **`costUsd`** sumarycznie na rozmowę — niższy; ten sam koszt widać teraz w oknie czatu (`MetaFooter`).

## 6. Świadome „poza zakresem" (decyzje właściciela)
- **Nie** zmienialiśmy providera/modelu ani nie przełączaliśmy podkroków na tańszy model (odrzucone
  warianty — „bez utraty jakości").
- **Nie** skracaliśmy agresywnie pamięci rozmowy ani nie zaostrzaliśmy limitu iteracji.
- Briefing (`/api/llm/home/briefing`) — pojedyncze wywołanie `maxTokens:450`, bez pętli — pominięty
  świadomie (brak istotnej dźwigni, minimalizm C-53).
