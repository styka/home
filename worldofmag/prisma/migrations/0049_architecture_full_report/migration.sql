-- Pełna architektura aplikacji Omnia (stan 2026-05-31) — dokument referencyjny dla admina.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- authorId = NULL → raport systemowy, widoczny dla wszystkich uprawnionych użytkowników.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Pełna architektura aplikacji (stan 2026-05-31)',
  'architektura-omnia-pelna-2026-05-31',
  $ARCH_DOC_2026$# Omnia — Pełna architektura aplikacji (stan 2026-05-31)

**O dokumencie.** Referencja opisująca **cały** stan aplikacji zgodnie z kodem: każdy dział, jego funkcjonalności i pod-funkcjonalności, ustawienia, panel admina, „magiczną ikonę" (asystent AI) oraz warstwy przekrojowe. Przy każdym dziale jest podrozdział **„UX i co poprawić"** z rozważaniami: co jest słabe, co dodać, jakie pod-funkcjonalności rozważyć. Na końcu — osobny rozdział o wizji produktu, skalowaniu do miliona użytkowników, konkurencji i nowych działach (w tym branżowych).

---

## 0. Czym jest Omnia (charakterystyka produktu)

**Omnia** (wewnętrzna nazwa; publicznie „WorldOfMag") to **modularny, osobisty system operacyjny życia i pracy** — jedna aplikacja, w której power-user zarządza wszystkim: zakupami, zadaniami, notatkami, kuchnią, zwierzętami, zdrowiem, nawykami, pojazdami, finansami i nauką języków. Zamiast dziesięciu osobnych appek — jeden spójny, ciemny, klawiaturowy interfejs spięty wspólnym modelem danych i asystentem AI.

**Dla kogo:** w pierwszej kolejności jeden zaawansowany użytkownik (developer power-user), z architekturą gotową na zespoły (współwłasność danych) i — docelowo — na masową skalę.

**Filozofia UX (z `CLAUDE.md`):** keyboard-first (skróty w stylu vim: `j/k`, `x`, `e`, `d`), ciemny motyw, minimalizm (estetyka Linear/GitHub/VS Code), zero zbędnych kliknięć i animacji.

**Stack:** Next.js 14 (App Router) · TypeScript 5 (strict) · React 18 + Tailwind + zmienne CSS · NextAuth v5 + Google OAuth · Prisma 5 · SQLite (dev) / PostgreSQL Neon (prod) · hosting Render (Frankfurt).

**Trzy filary architektury danych, które powtarzają się w każdym module:**

- **Model własności trójpoziomowy** — każdy zasób jest *prywatny* (`ownerId`), *zespołowy* (`ownerTeamId`) albo *systemowy* (`userId=null, teamId=null`). Wzorzec dostępu: `getUserTeamIds()` + `where: { OR: [{ ownerId }, { ownerTeamId: { in: teamIds } }] }`.
- **RBAC** — użytkownik ma role (`UserRole`), role mają uprawnienia (`RolePermission` → `Permission.slug`, np. `module.shopping`). Bramkowanie tras i nawigacji przez `src/lib/permissions.ts`.
- **Server Actions + `revalidatePath`** — wszystkie mutacje to akcje serwerowe kończące się rewalidacją; brak ręcznego zarządzania cache w innych miejscach.

**Mapa działów (stan faktyczny w kodzie):** Home (dashboard AI) · Zakupy · Zadania · Notatki · Kuchnia · Zwierzęta · Zdrowie · Nawyki · Flota · Portfel · Języki · QA · Truck · Raporty · Ustawienia · Panel Admina. Działy *Kalendarz* i *Praca* istnieją w nawigacji jako zablokowane („wkrótce").

**Ważna uwaga o dokumentacji:** `CLAUDE.md` jest mocno nieaktualny — opisuje tylko Zakupy/Zadania/Notatki/Kalendarz/Home. Realnie aplikacja ma kilkanaście modułów opisanych poniżej. To pierwsza rozbieżność do naprawienia (patrz rozdział końcowy).

---

## 1. Home — dashboard i „magiczna ikona" (asystent AI)

Strona główna (`/`, `src/components/home/HomePage.tsx`) to centrum dowodzenia agregujące wszystkie moduły. Historycznie gated za rolą `BETA_TESTER`; dziś pełni rolę pulpitu startowego.

### 1.1 Widżety dashboardu

- **Powitanie** — „Dzień dobry, [Imię]!" + plakietka *Beta* (gdy `BETA_TESTER` i nie-admin).
- **Podtytuł dynamiczny** — zmienia się zależnie od zaległych zadań, oczekujących zakupów, planu posiłków, alertów pojazdów.
- **Baner zaproszeń** — liczba oczekujących zaproszeń do zespołów (`InvitationsBanner`).
- **Ostatnio używane** (`RecentlyUsed`) — szybki powrót do ostatnich modułów, sterowany `UserActivity`.
- **Siatka „migawek" modułów** (`ModuleSnapshotGrid`) — kafelki ze statystykami dla wszystkich dostępnych modułów.
- **Dziś i wkrótce** (`TodaySnapshot`) — zadania, posiłki, opieka nad zwierzętami, alerty pojazdów, talie języków, wizyty zdrowotne.
- **Szybkie akcje** (`QuickActions`) — przyciski: dodaj zakupy, nowe zadanie, nowa notatka, opieka, kuchnia, flota, portfel itd.
- **Sugestie AI** (`AISuggestions`) — karuzela kart priorytetyzowanych: zaległe zadania → przeglądy pojazdów → opieka nad zwierzętami → wizyty → kończąca się żywność → zakupy → notatki.
- **Widżet admina** (`AdminDashboardWidget`) — liczniki użytkowników/zespołów/raportów (tylko admin).
- **Stopka** — linki do wszystkich modułów + raportów, ustawień, pomocy, QA (z kłódkami dla niedostępnych).

### 1.2 „Magiczna ikona" — asystent AI (Sparkles FAB)

Pływający przycisk z ikoną `Sparkles` (`AICommandSheet.tsx`), prawy-dolny róg, globalny na każdej stronie (część `AppShell`). Po kliknięciu otwiera arkusz asystenta (bottom-sheet na mobile, modal na desktopie).

**Dwa tryby działania AI:**

- **Tryb prosty (interpret → execute)** — `AICommandSection` + `ActionDrawer`. Endpointy `/api/llm/home/interpret` i `/api/llm/home/execute`. Użytkownik pisze polecenie naturalnym językiem, model zwraca listę akcji (`AIAction[]`), które user przegląda i zatwierdza w szufladzie akcji przed wykonaniem.
- **Tryb agentowy (clarify/answer/navigate/plan)** — `/api/llm/home/agent`. Sześć faz: `idle → running → clarify | answer | navigate | plan → results`. Agent potrafi dopytać (clarify), odpowiedzieć tekstem (answer), zaproponować przejście do widoku (navigate) albo zwrócić plan akcji (plan). `ReasoningLog` pokazuje (opcjonalnie) pełny tok rozumowania.

**Akcje rozpoznawane przez asystenta (z `interpret/route.ts`):**

| Moduł | Akcja | Parametry |
|---|---|---|
| Zakupy | `add_item` | `rawText` (ilość+nazwa), opcjonalnie `listName` |
| Zakupy | `update_item_status` | `status`, `searchQuery` |
| Zakupy | `delete_item` | `searchQuery` |
| Zadania | `create_task` | `title`, `priority`, opcjonalnie `dueDate`, `projectName` |
| Zadania | `shift_task_due_date` | `days`, `searchQuery` |
| Zadania | `update_task_status` | `status`, `searchQuery` |
| Notatki | `create_note` | `title`, opcjonalnie `content` |
| Notatki | `append_to_note` | `content`, `searchQuery` |
| Zwierzęta | `log_weight` | `weightKg`, `petName`, opcjonalnie `date` |
| Zwierzęta | `log_treatment` | `treatmentName`, `petName`, `nextDue` |
| Zwierzęta | `schedule_care` | `title`, `bucket`, `dueAt` |

**Bezpieczeństwo akcji:** akcje destrukcyjne (`delete_item`, `delete_task`, `delete_note`, `archive_list`) są **opt-in** — domyślnie odznaczone w `ActionDrawer`, z czerwoną plakietką „USUWA". Reszta parametrów jest edytowalna (pola `*Id` tylko do odczytu).

**Sprytna interpretacja PL:** prompt rozumie kolokwializmy („przesuń o 2 tyg" → 14 dni, nazwy leków, „do listy Apteka" → `listName: "Apteka"`) i respektuje priorytet kontekstu (pierwszy element `context[]` to moduł główny, reszta to fallback).

### 1.3 UX i co poprawić (Home / AI)

- **Personalizacja dashboardu** — układ widżetów jest stały. Rozważyć: przeciąganie/ukrywanie kafelków, zapamiętany układ per użytkownik, tryb „skupienie" (tylko dziś).
- **Stany puste i onboarding** — nowy użytkownik widzi pustą siatkę. Brakuje przewodnika „pierwsze kroki" i przykładowych danych.
- **Transparentność AI** — `ReasoningLog` jest dobry, ale brakuje: historii poleceń, możliwości cofnięcia wykonanej akcji (undo), licznika kosztu/limitu tokenów, oraz informacji *który model* odpowiedział.
- **Niezawodność AI** — przy braku klucza/limitach Groq UX powinien degradować się łagodnie (komunikat zamiast błędu). Rozważyć rate-limiting po stronie użytkownika i kolejkowanie.
- **Akcje destrukcyjne** — opt-in to dobra decyzja; warto dodać potwierdzenie i „kosz" (soft-delete z możliwością przywrócenia) zamiast twardego usuwania.
- **Rozszerzenie zakresu akcji** — asystent zna tylko zakupy/zadania/notatki/zwierzęta. Brakuje akcji dla Kuchni (zaplanuj posiłek), Portfela (dodaj wydatek), Nawyków (odhacz), Floty (zatankowałem). To naturalny, wysokowartościowy kierunek.
- **Wejście głosowe** — przy keyboard-first i mobile warto rozważyć dyktowanie poleceń do asystenta.

---

## 2. Zakupy (Shopping)

Najbardziej dojrzały moduł. Trasy: `/shopping`, `/shopping/[listId]`, `/shopping/products`, `/shopping/categories`, `/shopping/units`, `/shopping/stores`, `/shopping/stores/[storeId]`, `/shopping/stores/guide`, `/shopping/icons`, `/shopping/icons/categories`.

### 2.1 Listy i pozycje

- **Listy** — `getListSummaries` (z licznikami), `createList(name, ownerTeamId?)`, `renameList`, `deleteList`, `archiveList`/`unarchiveList`, `getListWithItems`. Własność user **lub** zespół.
- **Pozycje** — `addItem(listId, rawText)` (parsing NL), `addItemStructured`, `updateItem` (nazwa/ilość/jednostka/notatka/priorytet), `updateItemStatus`, `deleteItem`.
- **Operacje masowe** — `clearDoneItems` (usuń wszystkie DONE), `markAllInCart` (NEEDED → IN_CART).
- **Statusy** — `NEEDED → IN_CART → DONE`, plus `MISSING` (ręcznie). `Item.status` jest `String` (nie enum Prisma) — wymóg SQLite; poprawność pilnuje unia TS `ItemStatus`.

### 2.2 Inteligentne wprowadzanie

- **Parsing ilości** (`parseQuantity.ts`) — „2 butelki mleka" → `{qty:2, unit:"butelki", name:"mleka"}`; „mleko 500ml" → `{qty:500, unit:"ml"}`; „mleko x2" → `{qty:2}`.
- **Autokategoryzacja** (`categorize.ts`) — ~500 reguł słownikowych PL+EN do ~13 kategorii (Warzywa i owoce, Nabiał, Mięso i ryby, Piekarnia, Napoje, Mrożone, Chemia i higiena, …). Fallback gdy brak LLM; LLM normalizuje przez `/api/llm/normalize`.
- **Autouzupełnianie** — `getProductSuggestions(prefix)` z katalogu (system + user + zespół) oraz `getSuggestionsForPrefix` z `ItemHistory`.

### 2.3 Słowniki (kategorie, jednostki, produkty, ikony)

- **Kategorie** — `getCategories` (3 poziomy: system/user/team z licznikami), `createCategory`, `updateCategory`, `deleteCategory`.
- **Ikony kategorii** (`CategoryIconVariant`) — własne SVG per kategoria, przełączalne per user/zespół: `getActiveCategoryIconMap`, `setCategoryIcon`, `orphanCategoryIcons`.
- **Jednostki** — `getUnits` (system + custom), `createUnit`, `updateUnit`, `deleteUnit`.
- **Produkty** — katalog z `upsertUserProduct` (auto-tworzenie/inkrementacja przy dodaniu pozycji), widoczność 3-poziomowa.

### 2.4 Mapy sklepów i trasowanie

- **Graf sklepu** — `Store` → `StoreNode[]` (pozycje, typy: CATEGORY/START/STOP) + `StoreEdge[]` (ważone połączenia).
- **CRUD węzłów/krawędzi** — `upsertStoreNode`, `deleteStoreNode`, `upsertStoreEdge`, `deleteStoreEdge`; edytor na canvasie.
- **Trasowanie** — `storeRoute.ts` → `computeOptimalCategoryOrder()` (najbliższy sąsiad, TSP-like) wyznacza optymalną kolejność alejek; tryb sortowania „store" w liście.

### 2.5 UI i skróty

- Komponenty: `QuickAddBar`, `ItemRow`, `FilterTabs` (ALL/NEEDED/IN_CART/DONE/MISSING z licznikami), `SortControl` (kategoria/produkt/sklep), `SearchBar`, `CategoryGroup`, `StatusBadge`.
- **Command palette** (cmdk, `CommandPalette.tsx`) — grupy „Zakupy" (dodaj, oznacz wszystko, wyczyść done, katalog, nowa lista) i „Przejdź do listy".
- **Skróty:** `a/n` dodaj · `j/k` nawigacja · `Space/x` cykl statusu · `e` edycja · `d/Delete` usuń · `/` lub `f` szukaj · `1–5` filtry · `Ctrl+K` paleta · `Esc` zamknij. Tryb sortowania zapamiętany w `localStorage`.

### 2.6 UX i co poprawić (Zakupy)

- **Brak drag-and-drop** ręcznego porządkowania pozycji (jest w roadmapie `CLAUDE.md`) — częsta potrzeba.
- **„Zakończ zakupy"** — brak akcji domknięcia/archiwizacji listy z podsumowaniem (jest w roadmapie).
- **`prompt()` przy tworzeniu listy** — do zamiany na porządny modal (roadmapa).
- **Współdzielenie w czasie rzeczywistym** — przy zakupach we dwoje brakuje synchronizacji live (kto co już wrzucił do koszyka). Rozważyć kanał realtime/optymistyczne odświeżanie.
- **Mapy sklepów** — potężna funkcja, ale wysoki próg wejścia (ręczne budowanie grafu). Rozważyć: szablony popularnych sieci, generator AT (`/api/llm/stores/generate` już istnieje — wyeksponować w UI), import z poprzednich zakupów.
- **Historia cen / budżet** — pozycje nie mają ceny. Integracja z Portfelem (koszt zakupów) to oczywista synergia.

---

## 3. Zadania (Tasks)

Trasy: `/tasks`, `/tasks/[projectId]`, `/tasks/tags`.

### 3.1 Zadania

- CRUD: `createTask({title, projectId?, priority?, dueDate?, startDate?, estimatedMins?, description?, recurring?, assigneeId?, tagIds?})`, `updateTask`, `completeTask`, `deleteTask`, `reorderTasks`.
- Pobieranie: `getTasks(projectId)`, `getAllUserTasks()` (sort po dueDate/priorytecie), `getTask(id)` (z relacjami).
- **Statusy:** `TODO | IN_PROGRESS | DONE | CANCELLED | DEFERRED`. **Priorytety:** `NONE | LOW | MEDIUM | HIGH | URGENT`.
- **Daty i szacunki:** dueDate, startDate, estimatedMins.
- **Powtarzalność** — `RecurringRule` (JSON) + `computeNextDue()` w `lib/recurrence.ts`.

### 3.2 Pod-funkcjonalności

- **Podzadania** — `createSubtask(parentTaskId, …)`, `getSubtasks` (drzewo przez `parentTaskId`).
- **Komentarze** — `addTaskComment`, `updateTaskComment`, `deleteTaskComment` (`TaskComment`).
- **Współdzielenie** — `shareTask(taskId, userId|teamId, role)` z rolami `VIEWER`/`EDITOR`; `removeTaskShare`, `getTaskSharing`.
- **Tagi** — globalne `TaskTagDef`: `createTaskTag`, `updateTaskTag`, `deleteTaskTag`; `setTaskTags(taskId, tagIds)`.

### 3.3 Projekty

- `getTaskProjects`, `createTaskProject(name, {color?, emoji?, description?})`, `updateTaskProject`, `deleteTaskProject`.
- **Skrzynka domyślna** — `getOrCreateInbox()` tworzy „Skrzynkę" (📥).
- **Członkowie projektu** — `addProjectMember`, `removeProjectMember`, `getProjectMembers` (role MEMBER/ADMIN/OWNER).

### 3.4 UI

`TasksPage`, `TaskRow` (badge statusu/priorytetu, data, avatar), `TaskDetail` (edycja + komentarze + sharing), `TaskFilters` (status/priorytet/assignee/tag/data), `QuickAddTask`, `AITaskInput` (parsing LLM), `RecurringBadge`, `CompletedSection`. Tryby widoku: today/upcoming/overdue/all/project.

### 3.5 UX i co poprawić (Zadania)

- **Brak prawdziwego widoku kalendarza/timeline** — zadania mają daty, ale brakuje wizualizacji (połączyć z przyszłym modułem Kalendarz).
- **Brak tablicy Kanban** — przy statusach TODO/IN_PROGRESS/DONE Kanban byłby naturalny dla wzrokowców.
- **Powiadomienia o terminach** — istnieje helper `notifications.ts`, ale warto: push/e-mail przy zbliżającym się dueDate, eskalacja zaległych.
- **Zależności między zadaniami** (blocked-by) — brak; przydatne przy projektach.
- **Wejście naturalnojęzykowe** — `AITaskInput` istnieje; rozważyć ujednolicenie z asystentem z Home (jeden silnik parsowania).
- **Skróty klawiszowe** — moduł dzieli hooki z Zakupami, ale UX nawigacji po zadaniach (j/k, zmiana statusu) wymaga audytu spójności.

---

## 4. Notatki (Notes)

Trasy: `/notes`, `/notes/all`, `/notes/groups`, `/notes/tags`.

### 4.1 Funkcjonalności

- CRUD: `createNote({title, content?, isMarkdown?, groupId?, tagIds?, ownerTeamId?})`, `updateNote`, `deleteNote`, `toggleNotePin`.
- **Filtry** w `getNotes`: `groupId` (w tym „NO_GROUP"), `tagIds[]`, `search` (tytuł+treść), `pinned`, `ownerTeamId`.
- **Markdown** — flaga `isMarkdown` przełącza render (`src/lib/markdown.ts`).
- **Grupy** — `getNoteGroups`, `createNoteGroup({name, description?, color?})`, `updateNoteGroup`, `deleteNoteGroup` (notatki odpinane).
- **Tagi (globalne)** — `getTags`, `createTag`, `updateTag`, `deleteTag`; `setNoteTags`, `addTagToNote`, `removeTagFromNote`.
- **AI** (`llm.notes`): `suggestTags`, `suggestTitle`, `rewrite(tryb)`, `qa(pytanie, notatki)`.

### 4.2 UI

`NotesPage`, `NoteRow` (podgląd markdown, tagi, grupa, pin), `NoteGroupSection`, `QuickNoteBar` (z przełącznikiem markdown), `GroupsManager`, `TagsManager`, `TagChip`, `TagSuggestions`. Przypięte na górze, full-text search.

### 4.3 UX i co poprawić (Notatki)

- **Edytor** — brak edytora WYSIWYG/live-preview obok pola markdown; przy dłuższych notatkach to ograniczenie.
- **Linkowanie notatek** (`[[wikilinks]]`) i wyszukiwanie pełnotekstowe ważone — krok w stronę „drugiego mózgu" (Obsidian/Notion).
- **Załączniki** — brak obrazów/plików w notatkach.
- **Wersjonowanie/historia** — brak; przydatne przy wspólnej edycji zespołowej.
- **AI Q&A** istnieje (`notes.qa`) — wyeksponować jako „zapytaj swoje notatki" w UI.

---

## 5. Kuchnia (Kitchen)

Bogaty moduł. Trasy: `/kitchen`, `/kitchen/recipes(/new|/[id]|/[id]/edit|/[id]/cook)`, `/kitchen/cookbooks(/[id])`, `/kitchen/plan`, `/kitchen/pantry(/stocktake)`.

### 5.1 Przepisy

- CRUD przepisu (`recipes.ts`) z metadanymi: servings, prep/cook minutes, difficulty (easy/medium/hard), cuisine, mealType (breakfast/lunch/dinner/snack/dessert), cover image, sourceUrl/sourceType, isPublic, archive, slug (auto-unikalny).
- **Składniki** — `createRecipeIngredient` (productId?, name, qty, unit, groupName, order, note, isOptional), update/delete; grupowanie składników.
- **Kroki** — `createRecipeStep` (order, text, imageUrl?, durationMin?, temperature?), update/delete.
- **Obrazy + OCR** — `addRecipeImage` z OCR przez Groq vision (ekstrakcja tekstu przepisu).
- **Oceny i historia** — `rateRecipe(1–5, comment?)`, `markCooked` (cookCount + lastCookedAt).

### 5.2 Importy AI

- **Ze zdjęcia** (`ImportFromImageDialog`) — OCR obrazu → przepis (`/api/llm/kitchen/ocr-image`, `ocr-text`).
- **Z URL** (`ImportFromUrlDialog`) — scrapowanie i parsowanie (`import-url`).
- **Generowanie AI** (`ImportFromAIDialog`) — przepis z opisu (`generate-recipe`).
- **Parsowanie składników** (`parse-ingredients`), **kategoryzacja** (`categorize`), **propozycje ze spiżarni** (`suggest-from-pantry`), **plan tygodnia** (`plan-week`).

### 5.3 Plan posiłków

- `getMealPlan(zakres)`, `getTodaysMeals`, `setMealPlanEntry({date, slot, recipeId?|customTitle?, servings?, notes?})`, update/delete, `markMealCooked`, `markMealSkipped`, `bulkSetMealPlan`, `moveMealPlanEntry`.
- **Integracja z Zakupami** — `previewShoppingListFromPlan` i `generateShoppingListFromPlan(zakres, listId?)` → automatyczne dorzucenie składników do listy zakupów. To jedna z najlepszych synergii w aplikacji.

### 5.4 Spiżarnia i książki

- **Spiżarnia** — `getPantryItems`, `createPantryItem` (productId?, name, qty, unit, location, expiresAt, openedAt, minQuantity, autoShop), update/delete, `adjustPantryQuantities` (stocktake), `expireItems`. Flaga `autoShop` → auto-dodawanie do zakupów poniżej `minQuantity`.
- **Książki kucharskie** — `getCookbooks`, `createCookbook({name, emoji?, color?, ownerTeamId?})`, update/delete; przypisywanie przepisów.
- **Cook mode** (`CookMode`) — krok po kroku, timery, skalowanie porcji, notatki.

### 5.5 UX i co poprawić (Kuchnia)

- **Skalowanie porcji** w cook mode jest, ale warto je propagować do listy zakupów z planu.
- **Wartości odżywcze / kalorie** — brak; przy konkurencji (Paprika, Mealime) to ważna funkcja.
- **Wyszukiwanie „co ugotować z tego, co mam"** — `suggest-from-pantry` istnieje; wyeksponować jako główny przepływ.
- **Powiadomienia o przeterminowaniu** spiżarni — `expireItems` jest, ale brakuje proaktywnych alertów/sugestii „zużyj zanim się zepsuje".
- **OCR/Import** — jakość zależna od modelu vision; potrzebny krok ręcznej korekty po imporcie (review przed zapisem).

---

## 6. Zwierzęta (Pets)

Najbardziej rozbudowany merytorycznie moduł (3 fazy: opieka, terraria, hodowla). Trasy: `/pets`, `/pets/[petId]`, `/pets/calendar`.

### 6.1 Profil i konfiguracja

- CRUD: `createPet(...)` z polami name, species, breed, sex, birthDate/birthApprox, acquiredAt/From, microchipId, identifier, color, photoUrl, presetKey, featureFlags, enclosureId, sireId/damId, genetics, ownerTeamId.
- **Presety gatunkowe** (`petPresets.ts`) — companion/reptile/aquatic… włączają zestawy funkcji.
- **Feature flags per zwierzę** — `updatePetFeatures` (np. MEASUREMENTS, WEIGHT) — moduł dopasowuje się do gatunku.
- **Status** — `setPetStatus`: ACTIVE/DECEASED/REHOMED/SOLD/ARCHIVED.
- **Współdzielenie** — `sharePetByEmail`, `sharePetWithTeam`, `removePetShare` (VIEWER/EDITOR).

### 6.2 Opieka i zdrowie (`petCare.ts`)

- **Pomiary** — `addMeasurement` (weightGrams, lengthCm, bodyScore 1–9 BCS, note); wykresy trendu.
- **Rekordy zdrowia** — CONDITION/ALLERGY/SYMPTOM/INJURY/NOTE/MILESTONE.
- **Wizyty wet.** — `addVetVisit` (vet, clinic, reason, diagnosis, cost, nextVisitAt, attachment) + przypomnienie.
- **Leczenia** — MEDICATION/VACCINE/DEWORMER/PARASITE/SUPPLEMENT z dawką, drogą, recurring, nextDueAt; `logTreatment` rejestruje podanie.
- **Zadania opieki** — FEEDING/CLEANING/GROOMING/WALK/WATER_CHANGE/UVB_REPLACEMENT/WEIGHING/CUSTOM, recurring + `logCareTask`.
- **Dziennik opieki** — `getCareLog`, `addCareLog` (spina leczenia i zadania).
- **AI** — `llm.pets.insights(pets, agenda, suggestions)`.

### 6.3 Terraria/akwaria (`petHusbandry.ts`)

- **Enclosures** — TERRARIUM/AQUARIUM/PALUDARIUM/CAGE/AVIARY/TANK/OTHER z wymiarami, objętością, sprzętem, zakresami docelowymi.
- **Odczyty środowiska** — `addEnvironmentReading` (tempWarm/Cool, humidity, uvbIndex, waterTemp, ph, amonia/azotyny/azotany, salinity, gh, kh) — pełen monitoring parametrów.

### 6.4 Hodowla i genetyka (`petBreeding.ts`)

- **Pary hodowlane** — PLANNED/PAIRED/COOLING/PRODUCTIVE/RETIRED.
- **Lęgi/clutche** — `createClutch`, `hatchClutch`, `failClutch` (eggCount, fertile, incubation temp/humidity, expectedHatch).
- **Genetyka** — pole `genetics` (JSON: gene/mode/zygosity), `updatePetGenetics` — morfy/dziedziczenie.
- **Rodowód** — relacje sire/dam, zapytania o potomstwo.
- **Sprzedaż** — `recordSale` (buyer, price, currency, soldAt).

### 6.5 UX i co poprawić (Zwierzęta)

- **Złożoność vs prostota** — moduł obsługuje zarówno kota domowego, jak i profesjonalnego hodowcę gadów. Feature flags pomagają, ale UX musi mocno chować funkcje pro przed zwykłym użytkownikiem (progressive disclosure).
- **Alerty parametrów** — odczyty środowiska mają zakresy docelowe; brakuje aktywnych alarmów „temperatura poza zakresem".
- **Wykresy i raporty** — pomiary/odczyty aż proszą się o solidne wizualizacje i eksport (np. dla weterynarza/kupującego).
- **Kalendarz opieki** — istnieje `/pets/calendar`; spiąć z globalnym Kalendarzem i powiadomieniami.
- To naturalna baza pod **dział branżowy „Hodowca/Breeder"** (patrz rozdział końcowy).

---

## 7. Zdrowie (Health)

Trasa: `/health` (`health.ts`).

- **Zdarzenia** — `createHealthEvent({kind: VISIT|TEST, title, doctorName?, specialty?, facility?, location?, scheduledAt, status?, notes?, result?, referral?, reminderAt?, ownerTeamId?})`, update, `setHealthStatus` (PLANNED/DONE/CANCELLED), delete.
- Dwa tryby: wizyty lekarskie + badania laboratoryjne; śledzenie wyników, skierowań, przypomnień.

**UX i co poprawić:** brak repozytorium wyników (załączniki PDF/zdjęcia), brak trendów badań (np. morfologia w czasie), brak modułu leków/suplementów dla człowieka (analogicznie do Pets → mocna synergia kodu). Przypomnienia powinny być proaktywne (push).

---

## 8. Nawyki (Habits)

Trasa: `/habits` (`habits.ts`). Najnowszy moduł (migracja 0047).

- CRUD: `createHabit({name, description?, icon?, color?, daysOfWeek?, reminderTime?, ownerTeamId?})`, update, `setHabitArchived`, delete, `reorderHabits`.
- **Odhaczanie** — `toggleHabitDay(id, date?)`; `HabitEntry` z `@@unique([habitId, date])`, data jako „YYYY-MM-DD" bez TZ (stabilne dla streaków/heatmapy).
- **Statystyki** (`habitStats.ts`) — bieżący/najdłuższy streak, postęp tygodnia; heatmapa w stylu GitHub.
- Przypomnienia korzystają ze wspólnego `notifications.ts` (jak zadania).

**UX i co poprawić:** brak widoku miesięcznego/rocznego heatmapy poza tygodniem; brak „celów" (np. 3×/tydzień zamiast konkretnych dni); brak synergii z Zadaniami (nawyk → zadanie) i z asystentem AI (akcja „odhacz nawyk"). Warto dodać statystyki motywacyjne (best streak, % ukończenia).

---

## 9. Flota (pojazdy)

Trasa: `/flota` (`flota.ts`).

- **Pojazdy** — `createVehicle({name, make?, model?, year?, plate?, vin?, fuelType, odometer?, inspectionDue?, insuranceDue?})` (fuelType: petrol/diesel/lpg/electric/hybrid), update/delete.
- **Tankowania** — `addFuelLog({date, odometer, liters, totalCost?, full?, note?})`; flaga `full` do liczenia spalania (l/100km).
- **Serwis** — `addServiceRecord({date, odometer?, type, cost?, note?})` (oil/tires/repair/inspection/insurance/other).
- Alerty przeglądu/ubezpieczenia, wykres spalania, historia serwisowa.

**UX i co poprawić:** brak kosztu posiadania (TCO) i integracji z Portfelem; brak przypomnień push o przeglądzie/OC; brak załączników (faktury, dowód rejestracyjny). Naturalny wariant **B2B „Flota firmowa"** (patrz rozdział końcowy).

---

## 10. Portfel (finanse)

Trasa: `/portfel` (`portfel.ts`).

- **Elementy majątku** — `createElement({name, kind, currency?, balance?, archived?, note?})` (kind: cash/account/savings/investment/property/receivable/debt), update/delete/archive; `getWalletOverview` (suma wg waluty, podział wg kategorii).
- **Wpisy (księga)** — `addEntry({date, balanceAfter, delta, kind?, category?, note?})` (income/expense/adjustment), `setBalance`; wpisy niemutowalne (time-series).
- Wielowalutowość, wykresy salda w czasie, kategorie transakcji.

**UX i co poprawić:** brak budżetów i celów oszczędnościowych; brak importu z banku (CSV/API); brak raportów miesięcznych „gdzie poszły pieniądze"; brak integracji z Zakupami/Flotą/Kuchnią (auto-wydatki). Wielowalutowość wymaga kursów (przeliczenie sumarycznego majątku).

---

## 11. Języki (Languages)

Trasa: `/languages` (`languageDecks.ts`).

- **Talie** — `createDeck({name, nativeLang, targetLang, sourceText?, ownerTeamId?})`, update/delete.
- **Fiszki + SRS (SuperMemo-2, `srs.ts`)** — `addWord`, `bulkAddWords`, `getDueCards`, `submitReview(grade 0–5)`. Pola SRS: easeFactor, intervalDays, repetitions, lapses, dueAt, lastReviewedAt.
- **AI** — `llm.languages.extract(sourceText, targetLang)` (wyciąganie słówek z tekstu).

**UX i co poprawić:** brak audio/wymowy (TTS), brak typów ćwiczeń (wpisywanie, wybór, słuchanie), brak gamifikacji (jak Duolingo: serie, XP), brak statystyk nauki. SRS to mocny fundament — warto dodać przypomnienia o powtórkach.

---

## 12. QA (jakość/testy)

Trasa: `/qa` (`qa.ts`). Hierarchia **Epic → User Story → Test Scenario**.

- `getEpics(module?)` dla modułów: shopping/tasks/notes/kitchen/home/admin/settings/auth/teams/reports/qa.
- `getStoriesForEpic`, `createUserStory`; `getScenarios`, `createScenario({title, type: positive|negative|edge, priority: P0|P1|P2, content (markdown)})`, update/delete.
- Powiązane z testami E2E (Playwright) i przewodnikiem `/admin/e2e`.

**UX i co poprawić:** to narzędzie wewnętrzne — warto powiązać scenariusze wprost z testami w `/e2e` (status: pokryty/niepokryty) i raportować pokrycie. Dla produktu masowego QA powinno być oddzielone od UI użytkownika końcowego (przenieść w całości pod admina).

---

## 13. Truck (routing ciężarówek)

Trasa: `/truck` (`lib/ors.ts`). Routing pojazdów ciężkich przez OpenRouteService — profil pojazdu (masa, wymiary, nacisk osi), parametry ograniczeń tras.

**Stan:** klient ORS istnieje, UI trasowania wygląda na wstępne/szkielet. **Co poprawić:** dokończyć UI (mapa, wprowadzanie profilu, wynik trasy), spiąć z Flotą (profil pojazdu = pojazd z floty). Kandydat na wariant **B2B logistyka**.

---

## 14. Raporty (Reports)

Trasy: `/reports`, `/reports/[slug]`, `/admin/reports(/new|/[slug]|/[slug]/edit)`.

- Model `Report`: id (cuid), title, slug (unique), content (markdown, bez limitu), category (default „general"), authorId?, teamId?, timestamps.
- Akcje (`actions/reports.ts`): `getReportsMeta` (admin), `getUserReportsMeta` (user: własne + systemowe + zespołowe), `getReport`/`getUserReport`, `createReport`, `updateReport`, `deleteReport`.
- **Render** — własny parser `src/lib/markdown.ts` (nagłówki #/##/###, tabele, bloki kodu, listy punktowane `-`/`*` i numerowane `1.`, cytaty `>`, bold/italic/code/link, hr). Surowy HTML jest escapowany (bezpieczeństwo). **Brak** list zagnieżdżonych i nagłówków `####`+.
- **Ten dokument** został dodany jako raport systemowy przez migrację `0049_architecture_full_report`.

**UX i co poprawić:** edytor markdown bez podglądu na żywo; brak wyszukiwania/filtra po treści raportów; brak eksportu do PDF; renderer nie wspiera list zagnieżdżonych ani nagłówków `####`+.

---

## 15. Ustawienia (Settings) i Zespoły

Trasy: `/settings`, `/settings/team/new`, `/settings/team/[teamId]`.

### 15.1 Profil

Edycja imienia/avatara/e-maila; podgląd ról (USER/ADMIN/BETA_TESTER).

### 15.2 Zespoły (`teams.ts`)

- `getMyTeams`, `createTeam`, `updateTeam` (ADMIN+), `deleteTeam` (OWNER, bez zasobów), hierarchia `parentTeamId` (sub-teamy).
- **Członkowie** — `getTeamMembers`, `changeMemberRole` (OWNER), `removeMember`, `leaveTeam`, `transferTeamOwnership`. Role w zespole: OWNER/ADMIN/MEMBER.

### 15.3 Zaproszenia (`invitations.ts`)

`inviteUser(teamId, email)`, `getPendingInvitations`, `acceptInvitation`, `rejectInvitation`, `getPendingInvitationsCount` (baner na Home).

### 15.4 Model współdzielenia (przekrojowy)

- **Własność zespołowa** — encja z `ownerTeamId` widoczna dla wszystkich członków.
- **Współdzielenie per-encja** — `TaskShare`, `PetShare` z rolami VIEWER/EDITOR.
- **Członkostwo projektu** — `TaskProjectMember` dla dostępu per-projekt.

**UX i co poprawić:** ustawienia są skąpe — brak preferencji (motyw choć jest dark-only, język, format daty, strefa czasowa, domyślne widoki). Brak ekranu „bezpieczeństwo/sesje" i eksportu danych (RODO). Onboarding zespołu mógłby być prowadzony.

---

## 16. Panel Admina

Bramka: `hasPermission(session, PERMISSIONS.ADMIN)` (`module.admin`).

### 16.1 `/admin` — konsola

- **Build info** — branch, commit SHA/message/date, build date (z `NEXT_PUBLIC_BUILD_*`).
- **Omnia — integracja Claude Code** — `OmniaClipboardButton` kopiuje prompt + JSON otwartych zadań Omnia do schowka dla agenta Claude Code.
- **Aktywna sesja** — e-mail, role, user ID.
- Linki do narzędzi (poniżej).

### 16.2 `/admin/access` — RBAC (`PermissionManager`)

- **Uprawnienia** — lista ze slugami, tworzenie/usuwanie.
- **Role ↔ uprawnienia** — przełączniki per rola.
- **Użytkownicy** — przypisywanie/odbieranie ról (badge ADMIN/USER/BETA_TESTER).
- **Ochrona przed self-lockout** — `countAdminAccessHolders()` blokuje każdą zmianę, która zostawiłaby 0 adminów (symulacja before/after).

### 16.3 `/admin/config` — konfiguracja klucz-wartość

Model `Config {key unique, value, updatedAt}`. Przykład: `groq_api_key` (pole maskowane). `getConfigValue`/`setConfigValue`.

### 16.4 `/admin/llm` — zarządzanie modelami (`LlmConfigPanel`)

- **Providerzy** — groq/anthropic/openai (id, name, apiKey, type).
- **Przypisania** — model per typ operacji: `reasoning` (agent), `dispatch` (interpretacja poleceń), `thinking` (analiza), `images` (vision/OCR), `generation` (przepisy/sugestie). Resolver: `lib/llm/resolver.ts`, `operationTypes.ts`.

### 16.5 Pozostałe narzędzia

- **`/admin/categories`** — kategorie systemowe (nazwa, opis, kolor, ikona Lucide).
- **`/admin/reports`** — CRUD raportów markdown.
- **`/admin/playground`** — interaktywny sandbox komponentów UI (SmartTextarea, QuickAdd, pickery statusów/ikon, dropdowny).
- **`/admin/e2e`** — przewodnik uruchamiania testów Playwright (`test:e2e:local|ui|ci|report`); E2E login provider **tylko offline** (nigdy na produkcji, `E2E_TEST_MODE=1`).
- **`/admin/architecture`** — wizualno-tekstowy przegląd struktury (trasy, schema, topologia) — obecnie minimalny (kandydat do rozbudowy; ten raport może go zasilić).

### 16.6 UX i co poprawić (Admin)

- **Brak audytu/logów** zmian RBAC i konfiguracji — przy zespołach krytyczne.
- **Klucze API w `Config` jako plaintext** — rozważyć szyfrowanie at-rest / sekrety środowiskowe + maskowanie wszędzie.
- **Brak panelu „zdrowia systemu"** — kolejki LLM, błędy, koszty, status migracji, status Neon/Render.
- **`/admin/architecture` jest szkieletem** — zsynchronizować z realnym stanem (auto-generacja z tras/schemy).

---

## 17. Warstwy przekrojowe

### 17.1 Auth i RBAC

NextAuth v5 + Google OAuth (jedyna metoda logowania), adapter Prisma. Sesja: `user.id`, `user.roles`, `user.permissions`. `middleware.ts` chroni trasy (redirect na `/auth/signin`). `permissions.ts`: `hasPermission`, `permissionForPath`, `isPathLocked`. Role specjalne: ADMIN (pełny), BETA_TESTER. Uprawnienia `module.*` (per dział) + pod-uprawnienia (np. `kitchen.recipe.create`, `kitchen.ai`).

### 17.2 Powłoka i nawigacja

- **`AppShell`** — mobilny top bar (z badge zaproszeń) + overlay menu, desktopowy `ModuleSidebar`, `main`, mobilny bottom tab bar (Dom/Zakupy/Zadania/Notatki), globalny `AICommandSheet` (FAB).
- **`ModuleSidebar`** — pozycje z ikoną/kolorem akcentu i pod-nawigacją (Shopping/Tasks/Pets/Kitchen/Languages/Flota/Portfel/QA). Kłódka + opacity 0.35 dla zablokowanych (`isPathLocked`). Admin widoczny warunkowo. Kalendarz i Praca = „wkrótce" (disabled).
- **Mobile:** obie szyny `hidden md:flex`; nawigacja przez top bar + bottom tab + hamburger overlay.

### 17.3 Activity tracking

`trackActivity(module, action, metadata)` → `UserActivity` (fire-and-forget, nie rzuca błędów). Moduły: shopping/tasks/notes/kitchen/pets/flota/portfel (i kolejne). Zasila „Ostatnio używane" i kontekst sugestii AI.

### 17.4 Integracja LLM

`src/lib/llm-client.ts` — typowany klient owijający `/api/llm/*` (notes/tasks/shopping/stores/home/kitchen/languages/pets). Fallback rule-based: `categorize.ts`. Konfiguracja providerów/modeli w `/admin/llm`. Prompty traktują nazwy kategorii jako słowa polskie.

### 17.5 Dane, build i deploy

- **Model danych** — user/team/system; indeksy po `(userId, createdAt)`, `(ownerId, ownerTeamId)`, `(nextDueAt)`, `(date)`. `Item.status` jako String (SQLite bez enumów).
- **Build** — `prisma generate && next build && node scripts/migrate.js` (`migrate.js`: `prisma migrate deploy` z retry na cold-start Neon + seed uprawnień/LLM/QA).
- **Git workflow** — `feature(claude/*) → develop (test, auto-deploy) → master (prod)`. Merge do `develop` automatyczny po przejściu builda; promocja na `master` tylko na wyraźną prośbę.
- **Render free tier** — cold start ~10–15 s po 15 min bezczynności.

---

## 18. Wizja, skala i nowe kierunki

Ten rozdział jest celowo strategiczny — rozważania na przyszłość, nie opis stanu.

### 18.1 Pozycjonowanie — po co jest Omnia i czym wygrywa

Omnia to **„jeden dom dla całego życia"**: zamiast Todoist + Paprika + Mint + dziennika zdrowia + appki dla zwierząt + Anki — jedna aplikacja ze **wspólnym modelem danych i jednym asystentem AI**. Główna przewaga nie leży w żadnym pojedynczym module (giganci są w nich lepsi), lecz w **integracji między modułami**: plan posiłków generuje listę zakupów, zakupy wpadają do budżetu w Portfelu, przegląd auta staje się zadaniem, a asystent AI działa ponad wszystkim. To jest realny, obronny wyróżnik.

### 18.2 Spójność i profesjonalizm (przed skalą)

Aby wyglądać profesjonalnie i konkurować z gigantami, przed masowym wejściem trzeba **ujednolicić**:

- **Design system** — zamiast inline-style (widoczne w komponentach Home) wydzielić tokeny i komponenty bazowe (Button, Card, Sheet, EmptyState). Jeden język wizualny w każdym module.
- **Wzorce interakcji** — spójne listy, akcje, filtry, skróty klawiszowe i zachowania mobilne we wszystkich modułach (dziś dojrzałość modułów jest nierówna).
- **Stany puste, ładowania i błędów** — wszędzie, z onboardingiem i przykładowymi danymi.
- **i18n (PL/EN)** — interfejs jest mocno polski; dla miliona użytkowników konieczna lokalizacja i format dat/walut/stref.
- **Dostępność (a11y)** — kontrast, focus, ARIA, nawigacja klawiaturą (jest fundament keyboard-first — rozszerzyć).
- **Tryby motywu** — dziś dark-only; rozważyć light/system.
- **Aktualizacja `CLAUDE.md` i `/admin/architecture`** — dokumentacja musi nadążać za kodem (dziś nie nadąża).

### 18.3 Skalowanie do ~1 000 000 użytkowników

Architektura aplikacyjna (Next.js + Prisma + Postgres) jest sensowna, ale operacyjnie wymaga zmian:

- **Hosting/DB** — Render free tier i pojedynczy Neon nie udźwigną skali: płatny hosting, autoskalowanie, read-repliki, connection pooling (PgBouncer), regiony.
- **AI to największy koszt i ryzyko** — wprowadzić: limity per użytkownik, kolejki/asynchroniczność dla ciężkich operacji (OCR, plan tygodnia), cache odpowiedzi, monitoring kosztów i fallbacki modeli. Dziś brak rate-limitingu i kolejek.
- **Wydajność** — Server Actions skalują się, ale potrzeba cache (np. dla list/dashboardu), paginacji (niektóre listy ładują całość) i wirtualizacji.
- **Observability** — logi, metryki, tracing, alerty, śledzenie błędów (Sentry). Panel „zdrowia systemu" w adminie.
- **Bezpieczeństwo i prawo** — RODO: eksport i usunięcie danych, polityka prywatności, szyfrowanie kluczy API, audyt RBAC, kopie zapasowe i plan DR.
- **Jakość** — rozszerzyć E2E i dodać testy jednostkowe krytycznej logiki (SRS, recurrence, stats, routing) — moduł QA już daje strukturę.
- **Monetyzacja** — billing/subskrypcje (free vs pro), bo koszty AI rosną liniowo z użyciem.

### 18.4 Konkurencja z gigantami (per moduł)

| Moduł | Konkurenci | Przewaga Omnia |
|---|---|---|
| Zadania | Todoist, TickTick | Integracja z resztą życia + AI |
| Notatki | Notion, Obsidian | Spójność z zadaniami/kuchnią |
| Zakupy | Bring!, AnyList | Mapy sklepów + auto z planu posiłków |
| Kuchnia | Paprika, Mealime | Spiżarnia → zakupy → budżet |
| Finanse | Mint, YNAB | Wydatki z realnych zakupów/floty |
| Języki | Anki, Duolingo | SRS w jednym ekosystemie |
| Zwierzęta | 11pets | Hodowla/genetyka/terraria (nisza pro) |

Strategia: nie wygrywać „głębią" pojedynczego modułu, lecz **kontekstem i spójnością całości** + AI jako spoiwem.

### 18.5 Nowe działy do rozważenia

- **Kalendarz** (jest „wkrótce") — warstwa spinająca daty ze wszystkich modułów (zadania, posiłki, opieka, zdrowie, przeglądy, powtórki języków). Najwyższy priorytet — domyka ekosystem.
- **Praca/Work** (jest „wkrótce") — projekty zawodowe, czas pracy, dokumenty.
- **Powiadomienia** — push (PWA już zarejestrowane) + e-mail; centralny silnik na bazie `notifications.ts`.
- **Dokumenty/pliki** — załączniki (umowy, gwarancje, wyniki badań, faktury) spięte z encjami.
- **Budżet i cele** — rozszerzenie Portfela o budżetowanie, cele, prognozy.
- **Podróże** — plany, rezerwacje, listy pakowania (synergia z zadaniami/zakupami).
- **Dom** — subskrypcje, gwarancje, urządzenia, liczniki mediów, IoT.
- **Dziennik/nastrój i Fitness** — wpisy, mood tracking, treningi (synergia ze Zdrowiem i Nawykami).
- **Kontakty / osobisty CRM** — urodziny, przypomnienia o kontakcie, notatki o ludziach.
- **API publiczne / integracje** — Google Calendar, bank (open banking), import/eksport, webhooks.

### 18.6 Działy dedykowane branżom (warianty „pro")

Wiele modułów ma już fundament pod wersje branżowe — to droga do B2B i wyższego ARPU:

- **Hodowca / Breeder** — rozwinięcie Pets (genetyka, rodowody, lęgi, sprzedaż, certyfikaty, koszty hodowli). Najbliżej gotowości.
- **Gastronomia** — rozwinięcie Kuchni (kalkulacja kosztów potraw, food cost, menu, zamówienia, alergeny).
- **Warsztat / Flota B2B** — rozwinięcie Floty + Truck (wiele pojazdów, kierowcy, koszty, trasowanie, przeglądy regulacyjne).
- **Mali usługodawcy** — Zadania + Kontakty + Portfel jako lekki CRM + faktury + kalendarz wizyt.
- **Rolnictwo/ogród** — pola/grządki, cykle siewu (recurrence), pomiary, pogoda, plony (re-użycie wzorców z Pets/Health).

Podejście: budować je jako **konfigurowalne nakładki na istniejące moduły** (feature flags jak w Pets), a nie osobne aplikacje — to utrzymuje spójność i tempo.

---

## 19. Podsumowanie

Omnia jest już dziś zaskakująco szeroka (kilkanaście realnych modułów) i ma trzy mocne, powtarzalne fundamenty: **model własności user/zespół/system**, **RBAC** i **Server Actions + rewalidacja**, a nad wszystkim **asystenta AI**. Największe ryzyka to **nierówna dojrzałość modułów i UX**, **nieaktualna dokumentacja**, oraz **gotowość operacyjna na skalę** (hosting, koszty/limity AI, observability, RODO, i18n). Najwyższy zwrot dadzą: ujednolicenie design systemu, dokończenie Kalendarza jako warstwy spinającej, rozszerzenie akcji asystenta AI na wszystkie moduły oraz przygotowanie infrastruktury i monetyzacji pod wzrost.
$ARCH_DOC_2026$,
  'architecture',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
