# Kuchnia — Raport końcowy z sesji przygotowawczej

**Wersja:** 1.0
**Data:** 2026-05-20
**Sesja:** sesja przygotowawcza (Claude Opus 4.7) — branch `claude/recipes-meal-planning-ZxFOF`
**Status:** Brak implementacji — tylko dokumentacja przygotowawcza

---

## 1. Streszczenie zarządcze

Sesja przygotowawcza dla nowego działu **„Kuchnia"** w aplikacji WorldOfMag. Brief od użytkownika dotyczył przepisów + planowania posiłków + integracji z Zakupami. W trakcie sesji zaprojektowałem **jeden parasolowy moduł „Kuchnia"** zawierający 4 podstrony (Przepisy, Plan posiłków, Spiżarnia, Książki kucharskie) z głęboką integracją AI i istniejącego systemu.

W repozytorium dodano **4 dokumenty** (3 specyfikacje + ten raport) zarówno jako pliki markdown w `worldofmag/docs/recipes/` jak i jako rekordy w tabeli `Report` (kategoria `proposal`) widoczne w `/admin/reports`.

**Nie wprowadzono żadnych zmian w kodzie aplikacji.** Następna sesja Claude Code, otrzymując prompt z §6, ma wszystko czego potrzebuje by zaimplementować moduł.

---

## 2. Brief od użytkownika (rekapitulacja)

Użytkownik zlecił:

1. Stworzenie nowego działu „Receptury i Kuchnia" w aplikacji.
2. Funkcjonalności: dodawanie przepisów (składniki + kroki), „zrób zakupy do przepisu", tagi, planowanie posiłków na tydzień, wspólna baza receptur teamu.
3. Rozważenie czy potrzebny jest drugi dział „Żywienie" lub czy połączyć w jeden „Żywność/Kuchnia".
4. Przemyślenie funkcji + AI integracji.
5. UX perfect na mobile i desktop.
6. Trzy dokumenty: architektoniczny, UX, analityczny.
7. Dodanie wszystkich dokumentów jako raporty admin.
8. Raport końcowy z opisem sesji + prompt dla nowej sesji.

Oczekiwany efekt: profesjonalna dokumentacja gotowa do implementacji przez nową sesję Claude Code.

---

## 3. Co zrobiłem

### 3.1 Eksploracja kodu (przed projektowaniem)

Przeczytałem:
- `worldofmag/CLAUDE.md` — pełne instrukcje projektu
- `worldofmag/prisma/schema.prisma` — wszystkie modele DB
- `worldofmag/src/actions/reports.ts` — jak działa system raportów
- `worldofmag/src/actions/items.ts` (fragmenty) — jak działa Shopping
- `worldofmag/src/components/shell/AppShell.tsx` (fragmenty) — gdzie wstawić sidebar entry
- `worldofmag/src/app/admin/reports/page.tsx` — UI raportów
- Modele: `Recipe` (nowy), `Report`, `Item`, `ShoppingList`, `Product`, `Tag`, `Team`, `Note`, `TaskProject`

### 3.2 Decyzje architektoniczne

| Pytanie z briefa | Moja odpowiedź | Uzasadnienie |
|------------------|-----------------|--------------|
| Czy jeden czy dwa moduły? | **Jeden moduł „Kuchnia"** z 4 podstronami | Synergia danych, prostsza nawigacja, AI łączy filary |
| Co w podstronach? | Przepisy + Plan posiłków + Spiżarnia + Książki kucharskie | Pokrywa cały workflow „od pomysłu do gotowania" |
| Czy oddzielny model „Żywienie"? | Nie | Pantry + plan + przepisy realizują żywienie bez osobnego modułu |
| Czy nutrition (kalorie)? | v2.0, nie MVP | Niche, wymaga API zewnętrznych |
| Czy zdjęcia w MVP? | Tylko cover URL z importu URL. Pełen upload → v1.0 (R2). | Redukcja zakresu MVP |
| Czy AI ma być od początku? | MVP bez AI. AI od fazy 4. | Funkcje AI mają wartość tylko gdy jest co przeszukiwać |

### 3.3 Pliki utworzone

| Plik | Lokalizacja | Rola |
|------|-------------|------|
| `recipes-architecture.md` | `worldofmag/docs/recipes/` | Pełna architektura: DB schema (10 nowych modeli), Server Actions API, integracje, AI, RBAC, deployment |
| `recipes-ux.md` | `worldofmag/docs/recipes/` | Specyfikacja UX: 23 sekcje (persona, screeny mobile+desktop, komponenty, klawiatura, animacje, a11y, gesty) |
| `recipes-analysis.md` | `worldofmag/docs/recipes/` | Analiza: hipotezy + KPI, konkurencja, MoSCoW, AI use-cases, ryzyka, roadmapa, wpływ na moduły |
| `recipes-summary.md` | `worldofmag/docs/recipes/` | Ten raport |
| `scripts/seed-recipes-reports.js` | `worldofmag/scripts/` | Skrypt seedujący 4 raporty do tabeli Report |

### 3.4 Raporty w DB

Skrypt `scripts/seed-recipes-reports.js` upsertuje 4 rekordy do tabeli `Report` z:
- `category: "proposal"`
- `slug: kitchen-architecture-2026-05-20` / `kitchen-ux-2026-05-20` / `kitchen-analysis-2026-05-20` / `kitchen-summary-2026-05-20`
- `title`: pełne polskie tytuły
- `content`: zawartość z plików markdown (czytane przy seedowaniu)
- `authorId`: ID użytkownika tyka.szymon@gmail.com (lookup po email)

Sposób uruchomienia (lokalnie lub na Render):

```bash
cd worldofmag
node scripts/seed-recipes-reports.js
```

Skrypt jest idempotentny (upsert po slug) — można uruchamiać wielokrotnie.

---

## 4. Pomysły rozważane podczas projektowania

### 4.1 Pomysły WŁĄCZONE do planu

Wymienione w dokumentach. Najważniejsze:

- **„Cook Mode" fullscreen** z wakelockiem i tap-zones (mobile killer feature)
- **Konsolidacja składników w generowaniu listy** (3 przepisy używające cebulę → 3 szt cebuli)
- **`recipeOrigin` na Item** — pozwala cofnąć dodanie, statystyki gotowania, badge na liście
- **Auto-replenish ze spiżarni** — dolny próg → auto-dodaj do listy
- **Auto-feed do spiżarni po DONE w Shopping** (opt-in)
- **AI parser składników** (paste tekst → strukturalna lista)
- **AI import z URL** (JSON-LD + LLM fallback)
- **AI sugestie ze spiżarni** („Co dziś z tego co mam?")
- **AI plan tygodnia** z constraints
- **Książki kucharskie** jako grupowanie przepisów
- **Tryb StockTake** dla szybkiej inwentaryzacji
- **Wspólny `Tag` z Notes** (no duplikacja)
- **Custom title w MealPlan** („obiad u babci" — bez przepisu)
- **DnD reordering** (`@dnd-kit`)

### 4.2 Pomysły ODRZUCONE (z uzasadnieniem)

Pełna lista w `recipes-analysis.md` §15. Najważniejsze:

| Pomysł | Powód odrzucenia |
|--------|--------------------|
| Scanner kodów kreskowych | Out-of-scope, wymaga natywnego API |
| Publiczna baza społecznościowa | Wymaga moderacji, ToS, ryzyko misuse |
| Integracja z dostawcami (Frisco itp.) | Niezgodne z self-hosted, kruche API |
| Wieloosobowa edycja na żywo | Over-engineered |
| Versioning przepisów (Git-like) | Over-engineered |
| Pomiary kalorii z własnej bazy | Lepiej delegować do AI / API |
| Push notifications o terminie | Wymaga push infra (v2.0) |
| AI generator zdjęć przepisów | Hallucinacje, ryzyko prawne |
| AI sommelier | Funny ale niche |
| Dieta / coaching | Off-topic, ryzyko medyczne |
| Marketplace przepisów | Out-of-scope |
| Skanowanie czeków sklepowych | Niska wartość vs. koszt |

### 4.3 Pomysły otwarte (decyzja na fazę 0 implementacji)

Lista pytań w `recipes-architecture.md` §15:
1. Publiczna baza przepisów (community) — tak/nie?
2. Czy zdjęcia w MVP są niezbędne?
3. Voice mode w Cook Mode — kiedy?
4. Limit rozmiaru `notes` (50 000 znaków)?
5. Repetitive meals w MealPlan (np. owsianka codziennie)?
6. Hosting zdjęć — R2 vs. URL z neta?
7. `customTitle` w MealPlanEntry — zostawić?
8. Integracja z Kalendarzem Google (gdy powstanie moduł Kalendarz)?

---

## 5. Spis treści dokumentów (krótka mapa)

### 5.1 `recipes-architecture.md` (16 sekcji)

1. Streszczenie zarządcze
2. Decyzja: jeden moduł czy dwa? (Opcja A — Kuchnia)
3. Schemat bazy danych (10 nowych modeli Prisma + zmiany w User/Team/Product/Tag/Item)
4. Routing i struktura plików (App Router + komponenty)
5. Integracje z istniejącymi modułami (Shopping, Notes, Tasks, Home, Teams)
6. Integracja AI/LLM (11 use-cases, modele, rate limiting)
7. Permissions / RBAC (13 nowych slugów)
8. Upload plików (Cloudflare R2)
9. Caching i wydajność
10. Testy
11. Migracja danych / BC
12. Wdrożenie etapami (6 faz)
13. Ryzyka i mitygacje
14. Dependencies do dodania
15. Otwarte pytania
16. Załączniki

### 5.2 `recipes-ux.md` (23 sekcje)

1. Persona i konteksty użycia
2. Filozofia projektowa
3. Mapa ekranów
4. Lista przepisów (`/kitchen/recipes`)
5. Widok przepisu
6. Edycja przepisu
7. Cook Mode (fullscreen)
8. Plan posiłków
9. Spiżarnia
10. Książki kucharskie
11. Komponenty dzielone
12. Klawiatura — globalne skróty
13. Stany pośrednie (loading, errors, offline)
14. Dostępność (a11y)
15. Wizualne tokens — extensions
16. Animacje (minimalistyczne)
17. Mobile-specific UX (gesty, klawisze, PWA)
18. Cross-module UX
19. Onboarding
20. Specyfikacja techniczna komponentów
21. Testy UX (manualne checklisty)
22. Najczęstsze błędy UX do uniknięcia
23. Załączniki

### 5.3 `recipes-analysis.md` (17 sekcji)

1. Cel modułu
2. Hipotezy i metryki sukcesu (5 hipotez + 8 KPI)
3. Analiza konkurencji
4. Analiza funkcji (MoSCoW)
5. Integracja z Zakupami (ścieżki danych + edge cases)
6. Analiza AI (7 use-cases szczegółowo + etyka + tracking)
7. Analiza ryzyk (techniczne, produktowe, biznesowe)
8. Roadmapa (6 faz, estimate 8-10 tygodni do v1.0)
9. Wzorce wykorzystywane z istniejącego kodu
10. Wpływ na inne moduły
11. Dane analityczne do gromadzenia
12. Specyfikacja AI promptów (wzorce)
13. Dostępność i lokalizacja
14. Bezpieczeństwo
15. Co odpadło z listy pomysłów
16. Konkluzja i rekomendacja
17. Załączniki

### 5.4 `recipes-summary.md` (ten plik)

Brief + co zrobiłem + pomysły + prompt dla nowej sesji.

---

## 6. PROMPT dla nowej sesji Claude Code (do skopiowania)

Poniżej gotowy prompt do wklejenia w nowej sesji Claude Code. Prompt zakłada że nowa sesja startuje w katalogu repozytorium `styka/home` na branchu `claude/recipes-meal-planning-ZxFOF` (lub po pull/checkout tej gałęzi).

> Jeśli sesja startuje na innym branchu — wymień `git fetch && git checkout claude/recipes-meal-planning-ZxFOF` jako pierwszy krok.

---

### ── KOPIUJ OD TUTAJ ─────────────────────────────────────────────

Wprowadzasz nowy moduł **„Kuchnia"** do aplikacji WorldOfMag (Next.js 14 + Prisma + Postgres + Tailwind, repo `styka/home`).

**Pełna specyfikacja jest już w repo.** Twoim zadaniem jest implementacja zgodnie z planem, NIE wymyślanie od nowa.

## Krok 1 — Wczytaj specyfikacje

Przeczytaj kolejno te pliki — to są twoje ostateczne wytyczne:

1. `worldofmag/CLAUDE.md` — instrukcje projektu (musisz znać konwencje)
2. `worldofmag/docs/recipes/recipes-architecture.md` — DB schema, Server Actions API, integracje, AI, RBAC, deployment, dependencies
3. `worldofmag/docs/recipes/recipes-ux.md` — screen-by-screen UX (mobile + desktop), komponenty, klawiatura, gesty, a11y
4. `worldofmag/docs/recipes/recipes-analysis.md` — MoSCoW, AI use-cases szczegółowo, ryzyka, roadmapa, KPI
5. `worldofmag/docs/recipes/recipes-summary.md` — kontekst sesji przygotowawczej + listę pomysłów odrzuconych (żeby nie wracać)

Te same dokumenty są też w bazie danych jako Report (admin → /admin/reports), kategoria `proposal`, slugi:
- `kitchen-architecture-2026-05-20`
- `kitchen-ux-2026-05-20`
- `kitchen-analysis-2026-05-20`
- `kitchen-summary-2026-05-20`

Jeśli lokalna kopia plików md nie istnieje — pobierz je z `Report.content` przez `prisma studio` lub query.

## Krok 2 — Zatwierdź otwarte pytania (jeśli user dostępny)

W `recipes-architecture.md` §15 są 8 otwartych pytań. Przed startem implementacji **zapytaj usera** o decyzje. Jeśli user każe pominąć ten krok — przyjmij rekomendowane defaulty:

1. Publiczna baza społeczność: **NIE** (poza scope)
2. Zdjęcia w MVP: **NIE** (tylko cover URL z importu URL — pełen upload v1.0)
3. Voice mode: **v2.0** (nie MVP)
4. Limit `notes`: **50 000 znaków**
5. Repetitive meals: **NIE w MVP** (manual copy między dniami wystarczy)
6. Hosting zdjęć: **Cloudflare R2** (kiedy faza 5)
7. `customTitle` w MealPlanEntry: **TAK, zostawić**
8. Integracja Google Calendar: **odłożone do powstania modułu Kalendarz**

## Krok 3 — Zacznij od Fazy 1 (MVP Recipes)

Zgodnie z roadmapą w `recipes-analysis.md` §8 i `recipes-architecture.md` §12. Faza 0 (skeleton) i Faza 1 (MVP Recipes + ShopForRecipe) to **pierwszy przyrost wdrożeniowy**.

### Faza 0 (skeleton):
- [ ] Stwórz Prisma migrację `0017_kitchen_module` zgodnie z §3 architektury (10 nowych modeli + relations na User/Team/Product/Tag/Item).
- [ ] Dodaj nowe permissions slugi do `src/lib/permissions.ts` zgodnie z §7.1 architektury.
- [ ] Dodaj sidebar entry „Kuchnia" w `src/components/shell/AppShell.tsx` (ikona ChefHat, kolor `--accent-orange`, href `/kitchen`).
- [ ] Stwórz routing skeleton w `src/app/kitchen/` (puste page.tsx z „Wkrótce" + redirect z `/kitchen` na `/kitchen/recipes`).
- [ ] Tabbed nav komponent (Przepisy | Plan | Spiżarnia | Książki) w `KitchenLayout.tsx`.
- [ ] Commit + push branch.

### Faza 1 (MVP Recipes):
- [ ] `src/actions/recipes.ts` — pełen API zgodnie z §4.3.1 architektury (CRUD + ingredient/step CRUD + shopForRecipe).
- [ ] `src/actions/cookbooks.ts` — CRUD.
- [ ] Komponenty: RecipeList, RecipeCard, RecipeFilters, RecipeView, RecipeEditor (z IngredientList, StepList), ShopForRecipeDialog, ServingSelector. Szczegóły UX w `recipes-ux.md` §4-6 i §11.
- [ ] Manualne wpisywanie przepisów (bez AI, bez importu URL).
- [ ] Auth check `assertRecipeAccess` w każdej mutacji.
- [ ] Test ścieżki end-to-end: stwórz przepis → otwórz widok → kliknij „Do listy zakupów" → zobacz pozycje na liście.
- [ ] Commit + push.

## Krok 4 — Tworzenie commitów

Małe commity, jeden commit per logiczna jednostka (jedna migracja, jeden komponent, jeden actions file). Wiadomości po polsku (zgodnie ze stylem repo):

```
feat(kitchen): migracja 0017_kitchen_module — schema dla nowego modułu
feat(kitchen): actions/recipes.ts — pełen CRUD przepisów
feat(kitchen): RecipeList + RecipeCard — biblioteka przepisów na mobile/desktop
feat(kitchen): ShopForRecipeDialog — integracja z modułem Zakupy
```

## Krok 5 — Po każdym błędzie dopisz lekcję

CLAUDE.md mówi: każdy bug/błąd/konflikt → wpis w `doświadczenia.md`. Pamiętaj o tej zasadzie zwłaszcza przy:
- migracji Prismy (na Render może być inaczej niż lokalnie)
- integracji z istniejącym Item / categorize / parseQuantity
- konfliktach przy `select` w Prismie (lekcja z 2026-05-20 w `doświadczenia.md`)

## Krok 6 — Zatrzymaj się po Fazie 1

Po skończeniu Fazy 1 **zatrzymaj się i pokaż userowi**. Faza 2-5 to kolejne PR-y, nie próbuj robić wszystkiego naraz. User da feedback i decyzję czy iść dalej z Plan / Pantry / AI.

## Czego NIE robisz

- ❌ Nie modyfikujesz katalogu `_old/`, `src/` (legacy AngularJS), `pom.xml` (legacy Spring Boot)
- ❌ Nie tworzysz testów jeśli nie ma istniejącego setupu (zaproponuj userowi)
- ❌ Nie zmieniasz typu `Item.status` na Prisma enum (CLAUDE.md gotcha #4)
- ❌ Nie sugerujesz Vercel / Fly.io (CLAUDE.md gotcha #1-2)
- ❌ Nie dodajesz funkcji AI w Fazie 1 (są fazą 4 wg roadmapy)
- ❌ Nie tworzysz `prompt()` / `alert()` / `confirm()` (lekcja z 2026-05-20)
- ❌ Nie dodajesz Server Action bez `requireAuth()` (lekcja z 2026-05-20)

## Dependencies do zainstalowania na początku Fazy 0

```bash
cd worldofmag
npm install @dnd-kit/core @dnd-kit/sortable date-fns
```

(Sprawdź czy któreś już są w `package.json`.)

## Branch i flow

Pracujesz na `claude/recipes-meal-planning-ZxFOF`. NIE rób merge'a do `master` — to decyzja usera po review.

---

### ── KOPIUJ DO TUTAJ ─────────────────────────────────────────────

---

## 7. Sanity check przed użyciem promptu

Przed wysłaniem promptu do nowej sesji upewnij się że:

- [ ] Branch `claude/recipes-meal-planning-ZxFOF` jest wypchnięty na origin.
- [ ] Pliki w `worldofmag/docs/recipes/*.md` są w gicie i wypchnięte.
- [ ] Skrypt `worldofmag/scripts/seed-recipes-reports.js` jest wypchnięty.
- [ ] (Opcjonalnie) Skrypt został uruchomiony lokalnie lub na Render, raporty są widoczne w `/admin/reports`.

Komenda do weryfikacji raportów w DB (lokalnie):

```bash
cd worldofmag
npx prisma studio
# → tabela Report → filter slug starts with "kitchen-"
```

---

## 8. Następne kroki dla usera

1. Przejrzyj 3 dokumenty (architektura, UX, analiza).
2. Odpowiedz na otwarte pytania z `recipes-architecture.md` §15 (lub zaakceptuj defaulty).
3. (Opcjonalnie) Uruchom `node scripts/seed-recipes-reports.js` — wstawi raporty do DB. (Można też zostawić tylko jako pliki md.)
4. Otwórz nową sesję Claude Code, wklej prompt z §6.
5. Po Fazie 1 — review, feedback, decyzja czy kontynuować z Fazą 2.

---

## 9. Statystyki sesji

- Czas: ~1h (sesja przygotowawcza, bez implementacji)
- Pliki utworzone: 5 (4 dokumenty md + 1 skrypt JS)
- Linie utworzone: ~2200 linii dokumentacji
- Pliki zmodyfikowane: 0 (zero ingerencji w kod aplikacji)
- Commitów: 1 (planowane)
- Branch: `claude/recipes-meal-planning-ZxFOF`

---

**Koniec raportu końcowego v1.0.**

*Powodzenia w implementacji 👨‍🍳*
