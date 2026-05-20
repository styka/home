# Kuchnia — Dokument analityczny

**Wersja:** 1.0
**Data:** 2026-05-20
**Status:** Do zatwierdzenia przed implementacją

---

## 1. Cel modułu

Stworzyć **moduł Kuchnia** który jest „killer feature" dla użytkownika rodzinnego: pełen workflow „od pomysłu na obiad do jego ugotowania" w jednym miejscu, z głęboką integracją z istniejącym modułem Zakupów. Główna hipoteza: integracja Przepisy ↔ Spiżarnia ↔ Plan posiłków ↔ Lista zakupów eliminuje 80% manualnej pracy gospodyni/gospodarza domowego.

---

## 2. Hipotezy i metryki sukcesu

### 2.1 Hipotezy

| # | Hipoteza | Sposób weryfikacji |
|---|----------|---------------------|
| H1 | Po włączeniu modułu user będzie używał aplikacji częściej (sesje/tydz) | Porównanie sesji/tydz przed i 30 dni po release |
| H2 | „Zrób zakupy do przepisu" będzie najczęściej używaną funkcją (>50% sesji w Kuchni) | UserActivity tracking |
| H3 | Plan tygodnia AI redukuje czas „decyzji co jeść" o 70% | Self-reported (ankieta), telemetria |
| H4 | Spiżarnia odejmie 30%+ pozycji z list zakupów | Porównanie ile pozycji `shopForRecipe` pomija po włączeniu spiżarni |
| H5 | Import z URL będzie wystarczająco dokładny by zachęcić do dodawania (>80% przepisów się parsuje OK) | A/B test importera, % manualnych poprawek |

### 2.2 KPI

| KPI | Target po 30 dniach | Pomiar |
|-----|---------------------|--------|
| Liczba przepisów w bazie / user | > 10 | `count(Recipe where ownerId=user)` |
| % userów którzy ugotowali przepis | > 50% | `count distinct userId where lastCookedAt IS NOT NULL` |
| % userów z planem tygodnia | > 30% | `count distinct userId in MealPlanEntry > 7d back` |
| Średnia liczba slot'ów wypełnionych w tygodniu | > 10 (z 28) | `avg(count by user, week)` |
| Avg items added per `shopForRecipe` call | 5-10 | `avg(length addedItems)` |
| % importów z URL kończących się sukcesem | > 80% | tracking importów, errors |
| % używania AI sugestii planu | > 20% sesji w `/plan` | tracking eventów |
| Cook Mode usage | > 40% przepisów ugotowanych przez Cook Mode | event `cookmode_completed` |

---

## 3. Analiza konkurencji (skrótowa)

### 3.1 Bezpośrednia konkurencja

| App | Plusy | Minusy | Czego się uczymy |
|-----|-------|--------|--------------------|
| **Paprika 3** | Świetny import z URL, klasa enterprise dla recipes | Brak rodzinnego udostępniania, drogi (płatny), brak AI | Import z URL musi być wzorowy. UX edycji składników bardzo polerowany. |
| **Mealime** | Excellent meal planning + shopping list integration | Tylko aplikacja, brak custom recipes, USA-only diet | Workflow „plan → lista" jest sensem istnienia. Skopiować i podrasować. |
| **Plan to Eat** | Solidny meal planner + shopping | Stary UX, drogi | Konsolidacja składników (sumowanie cebul) jest standardem. |
| **Notion / Obsidian recipes** | Pełna kontrola | Zero automatyzacji, manualne wszystko | Naszą przewagą jest *automatyka*. Nie kopiujemy podejścia „przepis jako dokument". |
| **AnyList** | Świetna lista zakupów + przepisy | Słaba integracja AI | Sharing rodzinny ma sens, idziemy w tym kierunku. |
| **Crouton** | Bardzo ładny natywny iOS | Tylko Apple, brak teams | Mobile UX bar jest wysoki. |

### 3.2 Pośrednia konkurencja

- **Yuka / Kitchen Stories / Tasty** — biblioteki przepisów. NIE konkurujemy — nie chcemy być wydawcą, chcemy być narzędziem dla *własnych* przepisów (+ import).
- **Reddit r/mealprep, FB grupy** — źródło przepisów. Wzmacniamy import z URL jako most.

### 3.3 Nasza przewaga konkurencyjna

1. **Pełna integracja z istniejącym systemem (Zakupy, Notatki, Tasks, Home).** Konkurencja to oddzielne apki.
2. **AI cross-cutting:** sugestie z spiżarni, plan tygodnia, parser składników, import OCR.
3. **Polskie + angielskie out-of-the-box** (większość konkurencji USA-only).
4. **Team sharing rodzinny** z osobnymi spiżarniami / planami / przepisami.
5. **Self-hosted feel** — bez tracking'u reklamowego, własne dane.
6. **Keyboard-first desktop** — żadna konkurencja nie ma tego dla power userów.

---

## 4. Analiza funkcji (priorytety)

### 4.1 Klasyfikacja MoSCoW

#### MUST (MVP — pierwsza wersja produkcyjna)

| Funkcja | Uzasadnienie |
|---------|--------------|
| CRUD przepisów (manual) | Bez tego nic nie zrobimy |
| Składniki z ilościami + jednostkami | Bez tego nie ma listy zakupów |
| Kroki przepisu | Bez tego nie ma „cook mode" |
| Tagi i filtry | Bez tego biblioteka 30+ przepisów jest niefunkcjonalna |
| „Dodaj składniki do listy zakupów" | Killer feature wg user requestu |
| Skala porcji | Trywialne, niezbędne |
| Team sharing | Bez tego nie ma sensu dla rodziny |
| Search po tytule | Podstawa nawigacji |

#### SHOULD (v1.0 — pełna wersja modułu)

| Funkcja | Uzasadnienie |
|---------|--------------|
| Plan posiłków (tydzień) | Drugi filar modułu |
| Generowanie listy z planu | Wzmacnia hipotezę H4 |
| Spiżarnia + integracja `skipPantry` | Trzeci filar |
| Cookbook'i | Organizacja przy 30+ przepisach |
| Import z URL | Niski bar wejścia |
| Cover image | Lista przepisów bez zdjęć jest brzydka |
| AI: parser składników z tekstu | Akcelerator wpisywania |
| AI: auto-kategoryzacja | Spójność danych |
| Cook Mode (fullscreen) | Killer feature mobile |
| Reordering DnD (składniki/kroki/plan) | Standard UX |

#### COULD (v1.1)

| Funkcja | Uzasadnienie |
|---------|--------------|
| AI: import ze zdjęcia (OCR + LLM) | Wow-feature, ale wymaga Vision API |
| AI: generacja przepisu z promptu | Dla power-userów |
| AI: sugestie ze spiżarni | „Co dziś gotuję?" |
| AI: plan tygodnia auto | Dla zaawansowanych |
| Auto-replenish spiżarni | Wygoda, ale wymaga skonfigurowania |
| Komentarze / oceny do przepisu | Wartość rośnie z team-em |
| Auto-fill spiżarni po DONE | Opcjonalne, ale eliminuje manual |
| Widget Home: „Co dziś gotuję" | Spina moduły |
| Voice Cook Mode (komendy) | Wow-feature, niski koszt jeśli już mamy STT |
| Wartości odżywcze (kalorie / makro) | Niche, ale potężne |

#### WON'T (poza scope MVP/v1.0)

- Publiczna baza przepisów (społeczność) — wymaga moderacji, ToS
- Marketplace przepisów (sprzedaż)
- Krawężniki dietetyczne (cukrzyca, alergie z medycznymi alertami)
- Integracja z dostawcami (zamów online)
- Skanowanie kodów kreskowych produktów (off-topic)
- Eksport do druku z layoutem 1:1 jak książka

---

## 5. Głęboka analiza: integracja z modułem Zakupy

### 5.1 Ścieżki danych

```
[Recipe.RecipeIngredient]
   │
   │ shopForRecipe(servings, skipPantry)
   │
   ├──→ Filter pantry?  ─── [PantryItem] ──→ skip if quantity >= needed
   │       │ NO
   │       ▼
   │   Scale by servings/recipe.servings
   │       │
   │       ▼
   ├──→ Map to Product (jeśli productId)
   │       │
   │       ▼
   ├──→ Categorize (jeśli brak productId)  ── lib/categorize.ts
   │       │
   │       ▼
   ├──→ Consolidate duplicates (po nazwie+jednostce)
   │       │
   │       ▼
   ├──→ Create Item[]  ──→ [ShoppingList]
   │       │
   │       ▼
   └──→ Link via ItemRecipeOrigin
```

### 5.2 Edge cases

| Case | Obsługa |
|------|---------|
| Składnik bez jednostki („szczypta soli") | Jednostka null, ilość null. Item powstaje jako „szczypta soli" bez quantity. |
| Składnik z jednostką ale bez ilości („sól do smaku") | Item z `quantity=null`, `unit="do smaku"`. |
| Spiżarnia ma 250g, przepis chce 400g | Item: 150g (różnica). UI w dialogu pokazuje „masz: 250g, dodam: 150g". |
| Spiżarnia ma 500g, przepis chce 400g | Item nie powstaje. UI pokazuje „masz: 500g, pomijam". |
| Składnik opcjonalny | Domyślnie ON w dialogu (user może zsnąć). Po stronie generatora — flaga `skipOptional`. |
| Dwa przepisy używają cebula 2 szt + 1 szt | Konsolidacja: 1 item „cebula 3 szt". `ItemRecipeOrigin` ma wpisy do obu przepisów (relation many-to-one — wymagałoby zmiany, lub one-to-many — fewer constraints). **Rozważ:** w MVP konsolidacja tylko gdy wszystkie składniki mają takie samo productId, inaczej osobne itemy. |
| Składnik z jednostkami niekompatybilnymi (200g i 1 szklanka) | Nie konsolidujemy. Osobne itemy. |
| Przepis ma składnik „brokuł", PantryItem ma „brokuł zielony" | Match po `productId` (jeśli oba pokazują na ten sam Product). Bez productId — brak match (UI pokazuje „nie znaleziono w spiżarni"). User może ręcznie połączyć. |

### 5.3 UX integracji

- **Z poziomu Recipe → Shopping:** dialog `ShopForRecipeDialog` (opisany w doc UX §11.7).
- **Z poziomu MealPlan → Shopping:** dialog `ShoppingFromPlanDialog` (opisany w UX §8.3).
- **Z poziomu Shopping → Recipe:** badge na item „🍽 z Carbonara" + klik = link do przepisu.
- **Z poziomu Shopping → Pantry:** auto-move po DONE (opcjonalne, settings).

### 5.4 Wzajemne wzbogacenia

- **Categorize.ts** już istnieje — Kuchnia z tego korzysta bez duplikacji.
- **Product useCount** naturalnie rośnie gdy używany w przepisach → lepsze sortowanie podpowiedzi w Shopping.
- **Stores (mapy)** — Item z `recipeOrigin` może być sortowany na liście według trasy w sklepie tak samo jak inne (bez zmian).

---

## 6. Głęboka analiza: AI w module

### 6.1 Use cases AI — szczegółowo

#### UC1: Parser składników z tekstu

**Trigger:** User wkleja blok tekstu w edytorze → klika „Parsuj".

**Wejście:** dowolny tekst typu:
```
400g spaghetti
200g boczku
4 jajka (lub same żółtka)
100g parmezanu
szczypta pieprzu
opcjonalnie: pietruszka
```

**Wyjście:** JSON:
```json
[
  {"name": "spaghetti", "quantity": 400, "unit": "g", "isOptional": false},
  {"name": "boczek", "quantity": 200, "unit": "g", "isOptional": false},
  {"name": "jajka", "quantity": 4, "unit": "szt", "note": "lub same żółtka", "isOptional": false},
  {"name": "parmezan", "quantity": 100, "unit": "g", "isOptional": false},
  {"name": "pieprz", "quantity": null, "unit": "szczypta", "isOptional": false},
  {"name": "pietruszka", "quantity": null, "unit": null, "isOptional": true}
]
```

**Model:** Haiku 4.5 (szybki, tani, wystarczająco dokładny).

**Fallback:** Regex parser (istniejący `parseQuantity.ts` rozszerzony do listy linii) — uruchamia się jeśli AI failuje, koszt zerowy.

**Test cases:**
- Poprawne formaty: `400g X`, `4 szt X`, `pół X`, `szczypta X`, `X (opcjonalnie)`, `1/2 X`
- Ciężkie: „2 średnie cebule", „garść X", „do smaku"
- Mieszane języki: pl + en (np. „1 cup mleka")

#### UC2: Import z URL

**Trigger:** User wkleja URL → klika „Importuj".

**Flow:**
1. Server fetchuje HTML.
2. Parsuje `<script type="application/ld+json">` → szuka `@type: Recipe` (Schema.org).
3. Jeśli znalazł → mapuje pole po polu → done.
4. Jeśli nie znalazł → fallback: ekstrakcja głównego tekstu (Readability) → LLM (Sonnet 4.6) z promptem „masz tekst strony, wyciągnij dane przepisu w schemacie X".
5. Zwraca `Recipe` (jeszcze niezapisany) → user widzi podgląd → akceptuje/edytuje → save.

**Edge cases:**
- Paywall (np. NYT Cooking) — fail z komunikatem „Strona wymaga subskrypcji".
- Strona w innym języku — LLM tłumaczy do pl.
- Strona ma 10 przepisów na jednej (np. blog z kompendium) — UI prosi user'a o wybór.

#### UC3: Import ze zdjęcia (OCR + Vision)

**Trigger:** User robi zdjęcie strony książki kucharskiej.

**Flow:**
1. Upload → Sharp resize do 2048px.
2. Wysyłka do Claude Sonnet 4.6 z Vision input + prompt „przeanalizuj zdjęcie, wyciągnij przepis".
3. JSON response → mapping na Recipe.
4. Preview + edit + save.

**Limity:** Jedno zdjęcie = jedna strona książki = jeden przepis. Multi-page → user robi kilka i scalają w jednym (manual UI „dodaj kolejne zdjęcie do tego przepisu").

#### UC4: Generacja przepisu z promptu

**Trigger:** User wpisuje „obiad z kurczaka na 4 osoby, polski, do 30 min".

**Flow:**
1. Server Action `generateRecipeFromPrompt(prompt)` → call Sonnet 4.6.
2. Prompt template forsuje JSON schema Recipe.
3. Response → preview + edit + save.

**Constraints w prompcie:**
- Domyślny system prompt informuje o preferencjach userów (lokalizacja PL, jednostki metryczne).
- Maks 2k token wygenerowane.
- Walidacja: czy zwrócony JSON ma min 3 składniki, min 2 kroki.

#### UC5: Sugestie ze spiżarni

**Trigger:** Klik „Co dziś gotuję?" lub auto-generowany widget na Home.

**Flow:**
1. Server fetchuje top 20 PantryItem (sortowanie: expiringSoon DESC).
2. Server fetchuje user's recipes (max 100).
3. Lokalna heurystyka: dla każdego przepisu policz % składników w spiżarni.
4. Top 5 → wysyła do LLM (Haiku) z promptem „wybierz 3 najlepsze biorąc pod uwagę expire date".
5. Zwraca 3 propozycje z uzasadnieniem (np. „bo zużywa mleko które kończy się jutro").

**Cache:** sugestie cachowane 1h (Redis-like in memory, bo serverless może być flaky).

#### UC6: Plan tygodnia AI

**Trigger:** User klika „✨ AI: zaproponuj plan" w `/plan`.

**Flow:**
1. Wizard preferencji (UX §8.4).
2. Server Action `suggestWeekPlan({weekStart, constraints})`.
3. Wysyłka do Opus 4.7 (drogi, ale jednorazowy) z dużym kontekstem:
   - Lista przepisów usera (tylko meta: title, mealType, cuisine, prepCook, tags).
   - Spiżarnia (top 30 produktów).
   - Constraints.
   - Poprzednie plany (max 2 ostatnie tygodnie — żeby unikać powtórek jeśli wybrano).
4. Response: array 28 slot'ów (7 dni × 4 sloty) z `recipeId` lub null + uzasadnienie.
5. UI: pokazuje propozycję, user akceptuje per slot lub all-in.

**Rate limit:** max 3× dziennie per user (drogi model).

#### UC7: Zamienniki składników

**Trigger:** Brak składnika → klik „🔁 zamiennik" przy składniku.

**Flow:**
1. Server Action `suggestSubstitute(ingredientId)` → call Haiku z kontekstem przepisu.
2. Zwraca 3 zamienniki + tekst „dlaczego".

**Use case:** Alergia, brak w sklepie, brak w spiżarni.

### 6.2 Tracking AI

Wszystkie wywołania AI logowane do `UserActivity`:
```typescript
{
  userId,
  type: "ai_kitchen",
  metadata: {
    feature: "parse_ingredients" | "import_url" | "import_image" | "generate" | "suggest_pantry" | "plan_week" | "substitute",
    model: "haiku-4.5" | "sonnet-4.6" | "opus-4.7",
    inputTokens: number,
    outputTokens: number,
    cost: number,        // szacunkowy w USD
    success: boolean,
    durationMs: number,
  }
}
```

Pozwala na:
- Limity per user.
- Monitoring kosztów (admin dashboard).
- Wyłączenie konkretnej funkcji per user jeśli generuje straty.

### 6.3 Etyka AI

- User zawsze widzi że zawartość jest AI-generowana (badge „✨ AI").
- Możliwość edycji wszystkiego co AI wygenerowało.
- Nigdy nie zapisujemy treści bez akceptacji user'a (preview → save).
- LLM nie ma dostępu do danych innych userów (każde wywołanie wstrzykuje tylko dane bieżącego usera/teamu).

---

## 7. Analiza ryzyk

### 7.1 Techniczne

| Ryzyko | Wpływ | Mitygacja |
|--------|-------|-----------|
| Cold start Render + Vision API timeout | M | Async processing dla import-ze-zdjęcia (job queue, status polling) |
| Cost overrun na LLM | H | Rate limiting, monitoring, alert >$10/mo |
| Migracja schema kruszy istniejące dane | H | Dry-run migracji na kopii prod DB przed wdrożeniem |
| Konflikt z innymi modułami (Tag globalny) | L | Już używamy Tag w Notes — kompatybilne |
| Slow query przy 1000+ przepisach w team | M | Indeksy + paginacja w `getRecipes()` |
| LLM zwraca błędny JSON | M | Zod walidacja + fallback do regex/manual edit |
| Race condition w MealPlan (dwóch userów team edytuje ten sam slot) | M | Last-write-wins + optimistic UI + revalidatePath po każdej zmianie |

### 7.2 Produktowe

| Ryzyko | Wpływ | Mitygacja |
|--------|-------|-----------|
| User dodaje 1 przepis i przestaje | H | Onboarding z 3-4 startowymi przepisami, mocny CTA na import URL |
| Spiżarnia rozjeżdża się z rzeczywistością → user przestaje ufać | H | Tryb StockTake na 1 klik, reminder co tydzień |
| Plan AI generuje nonsensy → user traci zaufanie | H | Constraints walidowane, każda sugestia z uzasadnieniem, łatwy „regeneruj" |
| Cook Mode pożera bateriere (wakelock) | L | Limit wakelock 60 min, user może wyłączyć w settings |
| User nie wie czym Spiżarnia różni się od Listy zakupów | M | Onboarding tooltip, pierwsze entry guided, ikona w sidebarze |

### 7.3 Biznesowe

| Ryzyko | Wpływ | Mitygacja |
|--------|-------|-----------|
| Wzrost kosztów (LLM + hosting + R2) | M | Rate limiting per user, paid tier dla power users |
| Adopcja niższa niż H1-H5 | M | Beta release z grupą BETA_TESTER, feedback loop, pivot |

---

## 8. Roadmapa

### 8.1 Faza 0 — Pre-implementation (1 tydzień)

- Zatwierdzenie 3 dokumentów (architektura, UX, analiza)
- Decyzje otwarte (§15 doc arch.)
- Setup R2 bucket (jeśli chcemy zdjęcia od MVP)
- Mini-mock w Figmie lub kod-skeleton

**Deliverable:** zatwierdzony plan, branch `feat/kitchen-0-skeleton`.

### 8.2 Faza 1 — MVP Recipes (2 tygodnie)

- Migration `0017_kitchen_module`
- `actions/recipes.ts` + `cookbooks.ts`
- `RecipeList`, `RecipeCard`, `RecipeView`, `RecipeEditor`
- `ShopForRecipeDialog` + `shopForRecipe()`
- Permissions setup
- Sidebar entry
- Manual testing

**Deliverable:** użyteczny moduł Recipes (bez plan / pantry / AI). Beta release dla siebie.

### 8.3 Faza 2 — Plan posiłków (1-2 tygodnie)

- `actions/mealPlans.ts`
- `MealPlanWeek` z DnD
- `generateShoppingListFromPlan()`
- Widget Home: „Co dziś gotuję"

**Deliverable:** Plan + lista z planu.

### 8.4 Faza 3 — Spiżarnia (1-2 tygodnie)

- `actions/pantry.ts`
- `PantryList`, `StockTakeMode`
- Integracja `skipPantry` w `shopForRecipe`
- Widget Home: „Termin ważności"

**Deliverable:** pełen trzy-filar (recipes + plan + pantry).

### 8.5 Faza 4 — AI integration (2-3 tygodnie)

- Parser składników (Haiku)
- Import URL (Sonnet)
- Auto-kategoryzacja przepisu
- Sugestie ze spiżarni
- Rate limiting + tracking

**Deliverable:** wszystkie podstawowe funkcje AI.

### 8.6 Faza 5 — Polish + v1.0 (1-2 tygodnie)

- Cook Mode (fullscreen + wakelock + timery)
- Zdjęcia (R2 upload)
- Import OCR (Vision)
- Plan tygodnia AI (Opus)
- Drobne polerki UX (animacje, onboarding)

**Deliverable:** v1.0 — pełny moduł, gotowy do beta-release w społeczności.

### 8.7 Faza 6 — v2.0 (długi termin)

- Voice mode w Cook Mode
- Wartości odżywcze
- Eksport PDF / druk
- Publiczna baza (społeczność) — wymaga moderacji
- Integracje (Google Calendar dla planu, ekspert dla zamówień online)

### 8.8 Sumaryczny estimate

- **MVP (Faza 0-1):** 2-3 tygodnie
- **v1.0 (Faza 0-5):** 8-10 tygodni
- **v2.0:** kolejne 4-6 tygodni

(Przy założeniu jednego developera, part-time.)

---

## 9. Wzorce wykorzystywane z istniejącego kodu

### 9.1 Re-use bez modyfikacji

- `src/lib/categorize.ts` — kategoryzacja składników.
- `src/lib/parseQuantity.ts` — parsing inline w inputach.
- `src/lib/permissions.ts` — RBAC framework.
- `src/lib/server-utils.ts` (`requireAuth`, `getUserTeamIds`) — auth helpers.
- `src/components/ui/*` — Radix wrapper components.
- `src/hooks/useKeyboardShortcuts.ts` — shortcuts engine.
- `Tag` model — współdzielone tagi.

### 9.2 Re-use z drobnymi rozszerzeniami

- `src/lib/llm-client.ts` — dodać nowe funkcje dla kitchen (zachować strukturę).
- `src/actions/items.ts` — dodać `addItemFromRecipe` (alias na `addItemStructured` z `recipeOrigin`).
- `AppShell.tsx` — dodać entry „Kuchnia" w sidebarze + mobile selectorze.
- `CommandPalette.tsx` — dodać sekcję „Kuchnia".

### 9.3 Nowe wzorce do wprowadzenia

- **Bottom sheet** (Radix Dialog z mobile-first position) — nie używamy jeszcze. Skopiować patterny z Vaul lub własna implementacja.
- **Drag-and-drop** (`@dnd-kit`) — nie używamy jeszcze.
- **Wakelock API** — nowe.
- **Voice STT** (v2.0) — nowe.

---

## 10. Wpływ na inne moduły

### 10.1 Shopping

- **Plusy:** więcej wpływów na listy, wzrost użycia.
- **Zmiany:** dodanie pola `recipeOrigin` na `Item` (relation), badge w UI, opcjonalny auto-fill pantry po DONE.
- **Ryzyka:** brak.

### 10.2 Tasks

- Brak zmian w MVP. W v2.0 potencjalna integracja (prep tasks).

### 10.3 Notes

- Współdzielony `Tag` — koegzystencja.
- W przyszłości: konwersja Notatka → Przepis (parser LLM).

### 10.4 Home (AI dashboard)

- Dodatkowe widgety (opisane w §11.4 doc arch.).
- Pozytywny wpływ — Home staje się ciekawsze.

### 10.5 Admin

- Nowe permissions do nadawania.
- Admin może edytować/usuwać dowolny przepis (przyciski w UI gated `RECIPE_EDIT_ANY`).

---

## 11. Dane analityczne do gromadzenia (instrumentacja)

Lista zdarzeń `UserActivity.type`:

```
kitchen_view              | wejście do modułu
recipe_create
recipe_edit
recipe_delete
recipe_view               | otwarcie przepisu
recipe_import_url
recipe_import_image
recipe_generate_ai
recipe_shop_clicked       | klik „dodaj do listy"
recipe_shop_completed     | dialog zamknięty z dodaniem
mealplan_view
mealplan_entry_set
mealplan_generate_shop
mealplan_suggest_ai
pantry_view
pantry_item_add
pantry_stocktake
pantry_autoreplenish_run
cookmode_start
cookmode_completed
cookmode_timer_used
ai_kitchen                | każde wywołanie AI z meta
```

Pozwala na cohort analysis i tracking adoption per feature.

---

## 12. Specyfikacja AI promptów (wzorce)

### 12.1 Wspólny system message

```
Jesteś asystentem kulinarnym w aplikacji WorldOfMag.
Mówisz po polsku, ale rozpoznajesz oba języki (pl, en).
Używasz metrycznego systemu jednostek (g, kg, ml, l, szt).
Zawsze zwracasz JSON wg podanego schematu. Nie dodajesz tekstów wprowadzających ani podsumowań.
Jeśli nie potrafisz wykonać zadania, zwracasz `{"error": "...", "reason": "..."}`.
```

### 12.2 Per use-case prompts są w `src/lib/llm-prompts/kitchen/`:

- `parseIngredients.ts`
- `importFromUrl.ts`
- `importFromImage.ts`
- `generateRecipe.ts`
- `suggestFromPantry.ts`
- `planWeek.ts`
- `substituteIngredient.ts`

Każdy plik exportuje:
```typescript
export const systemMessage: string;
export const userTemplate: (input: T) => string;
export const outputSchema: ZodSchema;
```

---

## 13. Dostępność i lokalizacja

### 13.1 Lokalizacja (i18n)

- MVP: tylko polski (zgodnie z całą aplikacją).
- v2.0: rozważyć angielski (jeśli adoption rośnie).
- AI prompts respektują locale usera.

### 13.2 A11y

- WCAG 2.1 AA target.
- Wszystkie wymagania w doc UX §14.

---

## 14. Bezpieczeństwo

### 14.1 Walidacja inputu

- Wszystkie Server Actions z Zod validation.
- Markdown w `notes`, `steps.text` sanitized przy renderze (DOMPurify lub remark).
- Upload zdjęć: walidacja MIME + magic bytes + max size 5MB.

### 14.2 Authorization

- Każda mutacja: `requireAuth()` + `assertXAccess()`.
- Public recipes: read-only dla nie-ownerów.

### 14.3 Rate limiting

- AI: limity per user (§6.2 doc arch.).
- Uploads: max 100 zdjęć / user / dzień.
- Mutacje: brak globalnego limitu (auth wystarczy).

### 14.4 LLM safety

- Prompt injection: input usera w `<user_input>` tag, system message instruuje by ignorować instrukcje z `user_input`.
- Output walidacja Zod, błąd → fallback bez crash'a.

---

## 15. Co odpadło z listy pomysłów (i dlaczego)

Podczas projektowania rozważałem wiele pomysłów. Większość odpadła. Lista z uzasadnieniem (żeby nie wracać do nich bez powodu):

| Pomysł | Dlaczego odpadł |
|--------|------------------|
| Scanner kodów kreskowych do pantry | Out-of-scope, wymaga natywnego API, niska wartość |
| Powiadomienia push przy zbliżającym się terminie | Wymaga push notification infra (Web Push), v2.0 |
| Społeczność i sharing publiczny | Wymaga moderacji, ToS, ryzyko misuse |
| Integracja z dostawcami (Frisco, Carrefour) | Niezgodne z modelem self-hosted, kruche API |
| AI auto-gotujący (np. „idziemy" w czasie rzeczywistym) | Gimmick, low value vs. effort |
| Wersjonowanie przepisów (Git-like) | Over-engineered |
| Wieloosobowa edycja na żywo (collab cursor) | Over-engineered, mała wartość |
| Pomiary składników (kalorie per gram własną bazą) | Lepiej delegować do AI / API zewn. |
| Lista listków zakupów per sklep z różnymi cenami | Wymaga DB cen, niestabilne, niska wartość |
| AI sommelier (winowe pary do przepisu) | Funny ale niche |
| Dieta / coaching | Off-topic, ryzyko medyczne |
| Recipe meal kit (subskrypcja składników) | Wymaga supply chain, off-topic |
| Dark patterns („recipe of the day" reklama) | Konflikt z filozofią produktu |
| Reklamy / sponsored recipes | Nie monetyzujemy, self-hosted |
| Generator zdjęć przepisów AI | Hallucinacje, prawne ryzyko, niska wartość |

---

## 16. Konkluzja i rekomendacja

Moduł Kuchnia ma silne uzasadnienie biznesowe i UX-owe. Architektonicznie pasuje do istniejącego stylu, nie wymaga przepisywania czegokolwiek, daje natychmiastową wartość przez integrację z Shopping.

**Rekomendacja: zatwierdzić plan i rozpocząć od Fazy 1 (MVP Recipes + ShopForRecipe).** Plan i Spiżarnia w kolejnych iteracjach po feedback z używania MVP.

Główne ryzyka są kontrolowane:
- Koszty AI → rate limiting + monitoring.
- Adopcja → onboarding + seed przepisy.
- Spiżarnia drift → StockTake mode.

---

## 17. Załączniki

- `recipes-architecture.md` — pełna architektura (DB, actions, integracje)
- `recipes-ux.md` — pełna specyfikacja UX
- `recipes-summary.md` — wstęp dla nowej sesji Claude Code

---

**Koniec dokumentu analitycznego v1.0.**
