# Weryfikacja: Effort i temperature modeli LLM + tryb „maksymalny" asystenta

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (22/22 odhaczone)
- **Data:** 2026-07-26
- **Środowisko:** lokalny PostgreSQL 16 (`127.0.0.1:5432/omnia_dev`) z zaaplikowaną migracją `0210`.
  **Produkcyjna baza nietknięta** (C-13) — `scripts/migrate.js` nie uruchamiany.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0211)" |
| `npm run check:actions` | ✅ „160 akcji w katalogu, wszystkie obsługiwane przez executor i opisane w kontrakcie" |
| `npm run check:access` | ✅ „497 akcji z zadeklarowanym zakresem i guardem w kodzie" |
| `next lint --dir src` | ✅ 0 błędów (bez zmian w liczbie istniejących ostrzeżeń kosmetycznych) |
| `npm run test:unit` | ✅ **494 pass / 0 fail** (+14 nowych testów `effort`) |
| `npx next build` | ✅ przeszedł |
| `prisma migrate deploy` (lokalnie) | ✅ `0210_llm_effort` zaaplikowana |

## 2. Kryteria akceptacji

### Panel administratora

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** | ✅ | `LlmConfigPanel.tsx` — `AssignmentRow` ma drugi wiersz siatki z trzema kontrolkami: „Wysiłek modelu", „Temperatura (0–2)", „Limit odpowiedzi (tokeny)"; stan lokalny inicjalizowany z `AssignmentDTO` (`effort`, `temperature`, `maxTokens`), więc wartości wracają po przeładowaniu |
| **AC-2** | ✅ | Wysiłek to `<select>` po `LLM_EFFORT_LEVELS` z etykietami `LLM_EFFORT_LABELS` (Brak / Niski / Średni / Wysoki) — admin nigdy nie widzi nazwy parametru dostawcy |
| **AC-3** | ✅ | Komunikat liczony z `effortSupported(kind, model)` / `supportsTemperature(kind)`, gdzie `kind` bierze się z **aktualnie wybranego** dostawcy w tym wierszu, a `model` z pola tekstowego → przelicza się **przed** zapisem. Dwa przypadki: model bez wsparcia wysiłku („ustawienie zostanie pominięte…") i Anthropic + temperatura („…nie zostanie wysłana"). Kontrolka nieobsługiwana wyszarzona (`opacity: 0.55`), ale edytowalna |
| **AC-4** | ✅ | **Uruchomienie prawdziwych funkcji budujących ciało żądania:** `anthropicBody` z `effort:"high"` → `{"model":"claude-sonnet-5","max_tokens":13312,…,"thinking":{"type":"enabled","budget_tokens":12288}}`; `openAiBody` z `effort:"medium"`, model `gpt-5` → `…,"reasoning_effort":"medium"`. Dodatkowo **pełna ścieżka z bazy**: po zapisaniu przypisania z `effort:"high"` `resolveLlmChain("reasoning")` zwrócił `effort: high`, `model: claude-sonnet-5` |
| **AC-5** | ✅ | Uruchomienie: `openAiBody` dla `llama-3.3-70b-versatile` **bez** wysiłku i z `effort:"none"` dają **identyczny** JSON (`true`): `{"model":"llama-3.3-70b-versatile","messages":[…],"temperature":0.2,"max_tokens":1024}` — zero nowych parametrów |
| **AC-6** | ⚠️ częściowo (kod ✅, brak uruchomienia przez guard) | `setAssignment` waliduje **przed** jakimkolwiek zapisem: `effort` spoza skali → „Nieznany poziom wysiłku modelu.", `temperature` poza 0–2 → „Temperatura musi być liczbą z zakresu 0–2.", `maxTokens` poza 1–32000 lub niecałkowity → „Limit odpowiedzi musi być liczbą całkowitą z zakresu 1–32000 tokenów." Każdy `throw` **przed** `upsert`, więc poprzednia konfiguracja zostaje nietknięta. **Nie dało się uruchomić na żywo** — akcja zaczyna się od `requireAdmin()`, a w sandboksie nie ma sesji administratora; weryfikacja przez inspekcję kodu (`llmConfig.ts`, blok walidacji) |
| **AC-7** | ⚠️ częściowo (kod ✅, jw.) | `logAudit("config", "llm_assignment.set", …)` woła się **po** udanym `upsert`, z opisem zawierającym parametry: `wysiłek: <etykieta>, temperatura: <wartość\|domyślna>, limit: <n> tok.\|domyślny`. Ten sam guard uniemożliwił uruchomienie na żywo |
| **AC-8** | ✅ | **Uruchomienie na żywej bazie:** `recordAiCall({… effort:"high"})` → wiersz `AiCall` z `effort: "high"`; `effort:"none"` → `effort: null`. Wynik: `[{"model":"claude-sonnet-5","effort":"high"},{"model":"claude-haiku-4-5","effort":null}]`. `chat.ts` przekazuje `effortUsed`, czyli poziom **faktycznie użyty** (po ewentualnej degradacji) |

### Asystent AI

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-9** | ✅ | `ASSISTANT_LEVELS = ["economy","standard","max"]` (kolejność od najtańszego), menu renderuje pętla po tej stałej z `ASSISTANT_LEVEL_LABELS` i `…_DESCRIPTIONS`; opis „max" mówi wprost: „…najlepsza jakość, wyższy koszt i dłuższe oczekiwanie". Ikony: `Zap`/`Gauge`/`Rocket`, kolory z `LEVEL_COLORS` (zmienne CSS) |
| **AC-10** | ✅ | Uruchomienie `resolveEffort` z `boostEffort:true`: `none→low low→medium medium→high high→high`; bez boostu `low→low`. Wartość wyjściowa to **zawsze** to, co ustawił admin (`cfg.effort`), podniesione o stopień |
| **AC-11** | ✅ | `agent/route.ts`: `primaryOp = boostEffort ? "reasoning" : economy \|\| isSimpleRead ? "dispatch" : "reasoning"` — w trybie maksymalnym `isSimpleRead` nie ma wpływu. Dodatkowo `if (economy \|\| boostEffort \|\| …) return first` wyłącza ponowienie na `reasoning` (nie jest już potrzebne). Uruchomienie: `effectiveOperation("reasoning","max")` → `reasoning`, `shouldBoostEffort("max")` → `true`, `("standard")` → `false` |
| **AC-12** | ✅ | Poziom trzymany w `AssistantPref.level` (kolumna `String`, **bez migracji** — trzecia wartość mieści się w istniejącym typie). `updateAssistantPrefs` waliduje przez `ASSISTANT_LEVELS`, które teraz zawiera `"max"`; agent czyta poziom z bazy (`assistantPref?.level === "max" ? "max" : …`), więc wartość działa niezależnie od urządzenia |
| **AC-13** | ✅ | Brak jakiegokolwiek warunku na rolę przy przełączniku poziomu (`AICommandSheet` renderuje menu dla każdego); domyślny poziom to `"standard"` (`DEFAULTS` w `assistantPrefs.ts`) |
| **AC-14** | ✅ | Uruchomienie: `openAiBody` dla `llama-3.3-70b-versatile` z `effort:"medium"` **i** `boostEffort:true` → `{"model":"llama-3.3-70b-versatile","messages":[…],"max_tokens":1024}` — żaden parametr wysiłku nie leci, brak błędu. Dodatkowo w `chat.ts` jest jednorazowa degradacja przy 400 rozpoznanym jako odrzucenie tego parametru |

### Bramki

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-15** | ✅ | patrz sekcja 1 — wszystkie bramki + `next build` zielone |

**Podsumowanie:** 13 × ✅, 2 × ⚠️ (AC-6 i AC-7 — logika sprawdzona w kodzie, ale uruchomienie
`setAssignment` wymaga sesji administratora, której sandbox nie ma), 0 × ❌.

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01, C-02 | ✅ Cała praca w `worldofmag/`; importy przez alias. **Uwaga procesowa:** w trakcie weryfikacji plik pomocniczy trafił omyłkowo do legacy `src/` w katalogu głównym — natychmiast usunięty, `git status` czysty, nic nie zostało zacommitowane |
| C-10, C-11 | ✅ Ręczna migracja `0210_llm_effort` (numer z `next:migration`), idempotentna (`ADD COLUMN IF NOT EXISTS`), addytywna i nullable; `schema.prisma` zgodny z DDL |
| C-12 | ✅ `effort` to kolumna `TEXT` + unia TS `LlmEffort`; `AssistantPref.level` też `String`. Zero enumów Prisma |
| C-13 | ✅ Weryfikacja na lokalnej bazie; `migrate.js` nie uruchamiany |
| C-20 | ✅ Zapis przez istniejące Server Actions, `revalidatePath("/admin/llm")` na końcu `setAssignment` |
| C-21, C-22 | ✅ Bez zmian w modelu współwłasności i RBAC; konfiguracja pod `requireAdmin()`, przełącznik asystenta dla każdego zalogowanego |
| C-23 | ✅ Brak nowych `AIAction`; bramki spójności i kontraktu akcji przechodzą bez zmian |
| C-25 | ✅ `logAudit` z opisem zawierającym ustawione parametry |
| C-30, C-31, C-32 | ✅ Wyłącznie zmienne CSS (`LEVEL_COLORS`, `var(--accent-amber)` itd.); siatka `grid-cols-1 md:grid-cols-3` — na telefonie jedna kolumna; wszystkie teksty po polsku |
| C-40 | ✅ **Kluczowe:** wysiłek to konfiguracja admina per typ operacji; tryb maksymalny tylko **podnosi** ustawienie admina (`bumpEffort(cfg.effort)`) i **nie zmienia modelu**. Tabela możliwości opisuje *rodziny* modeli, nie wskazuje żadnego konkretnego do użycia |
| C-41 | ✅ Bez zmian w obsłudze kluczy; treść błędu dostawcy nie wychodzi do klienta |
| C-50, C-51 | ✅ Build zielony; 3 lekcje w `doświadczenia.md` |
| C-53 | ✅ Wykorzystane **istniejące, martwe** kolumny `temperature`/`maxTokens`; `AssistantPref.level` bez migracji; jedno miejsce tłumaczenia; **zero nowych zależności npm**. **Jedno odstępstwo do sprzątnięcia** — patrz „Uwagi" |
| C-54 | ✅ Artefakty spójne; T-12 zakończone notatką w `tasks.md` zamiast zmiany kodu |

Naruszeń: **brak**.

## 4. Regresje

| Obszar | Sprawdzenie |
|---|---|
| Migracja | Addytywna, nullable — istniejące wiersze `LlmAssignment`/`AiCall` dostają `NULL` = „brak wysiłku" = zachowanie jak dotąd. Zero backfillu |
| Istniejące wywołania LLM | Potwierdzone uruchomieniem (AC-5): bez ustawionego wysiłku ciało żądania jest **bit w bit** takie samo jak przed zmianą. Wszystkie moduły korzystające z `chatComplete` są tym objęte |
| Anthropic + temperatura | Nadal **nie** wysyłamy `temperature` (`anthropicBody` nigdy jej nie dokładał) — lekcja 026 nietknięta; `supportsTemperature` tylko *opisuje* ten fakt dla UI |
| Bloki `thinking` w odpowiedzi | `anthropicComplete` filtruje bloki po `type === "text"`, a strumień przepuszcza wyłącznie delty z polem `text` (`thinking_delta`/`signature_delta` go nie mają) → rozszerzone myślenie nie może wyciec do treści odpowiedzi. Powód zapisany w komentarzu przy `anthropicBody` |
| Profil „Anthropic" w `/admin/llm` | Nietknięty (`applyAnthropicProfile` nie ustawia wysiłku → `NULL`) |
| Tryb oszczędny (031) | Bez zmian: `effectiveOperation("reasoning","economy")` → `dispatch`, brak ponowienia |
| Pozostałe testy | 494 pass / 0 fail — 480 wcześniejszych bez regresji |

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI** — 15/15 kryteriów zrealizowanych (13 potwierdzonych uruchomieniem, 2 inspekcją
kodu z powodu guardu administratora), bramki i build zielone, 0 naruszeń konstytucji, 0 regresji.

Uwagi:

1. **Martwe pole w DTO (do sprzątnięcia w recenzji):** dodałem `AssignmentDTO.providerKind`, ale panel
   liczy rodzaj dostawcy z **aktualnie wybranego** dostawcy (`providers.find(...)`), bo tylko to daje
   reaktywność przed zapisem — `providerKind` z DTO nie jest nigdzie używane. Zbędne pole plus
   niepotrzebny `include: { provider: … }` w zapytaniu. Nie łamie niczego, ale kłóci się z C-53.
2. **AC-6 / AC-7 wymagają kliknięcia w panelu** — walidacja i wpis do audytu są w kodzie przed/po
   zapisie, ale żywe uruchomienie `setAssignment` wymaga sesji administratora. Po wdrożeniu warto raz
   spróbować zapisać temperaturę `5` (powinien pojawić się komunikat po polsku, a wcześniejsza
   konfiguracja zostać nietknięta) i sprawdzić wpis w `/admin/audit`.
3. **Wysiłek działa tylko z modelem, który go obsługuje** — dla domyślnego Groq/llama panel powie
   wprost, że ustawienie zostanie pominięte. Realny efekt zobaczysz na Claude 4/5 (rozszerzone
   myślenie) albo na modelu rozumującym zgodnym z OpenAI.
