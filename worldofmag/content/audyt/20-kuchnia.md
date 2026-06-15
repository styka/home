# Rozdział 20 — Kuchnia (Kitchen)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/recipes.ts` (709 linii), `cookbooks.ts`, `mealPlans.ts`, `pantry.ts`; modele
  `Recipe`, `RecipeIngredient/Step/Image/Tag/Rating`, `Cookbook`, `MealPlanEntry`, `PantryItem`,
  `ItemRecipeOrigin`.
- **AI-ciężki:** import z URL/OCR/AI (`src/lib/kitchen/recipeImportDraft.ts` + `RecipeImportReview`),
  generowanie przepisu i **planu tygodnia**, kategoryzacja, sugestie ze spiżarni.
- **Spięcia:** skalowanie przepisu → lista zakupów; wartości odżywcze per przepis (`kcal/protein/…`).

## Mocne strony

- **Import z wielu źródeł z rewizją przed zapisem** (`RecipeImportReview`) — wzorcowe podejście do AI
  (człowiek zatwierdza).
- **Plan tygodnia + spiżarnia + zakupy** — realny, spójny przepływ „od pomysłu do koszyka”.
- Wartości odżywcze — krok ku branży (gastronomia/dietetyka).

## Głos Zespołu A — Strażnicy

**dr Natalia (AI/ML):** „To **najdroższy tokenowo moduł**: OCR przepisów, plan tygodnia, generowanie.
Bez kolejki (Z-074) i cache (Z-132) plan tygodnia blokuje żądanie i kosztuje. To pierwszy kandydat do
limitów per plan (darmowy: X generacji/mies.).”

**Ewa (QA):** „Import z URL/OCR ma mnóstwo przypadków brzegowych (dziwne formaty stron, jednostki
imperialne). Rewizja ratuje, ale potrzebne testy parsera składników.”

## Głos Zespołu B — Pionierzy

**Tadeusz (użytkownik, 60, gastronomia):** „Dla mnie to **zalążek branży gastro** (Rozdz. 43): dodajcie
**food cost** (koszt porcji z cen składników — mamy ceny w Zakupach!), kalkulację menu i **alergeny**.
To bym kupił.”

**Hubert (AI/ML):** „»Co ugotować z tego, co mam« (sugestie ze spiżarni) + »plan pod cel kaloryczny« —
AI tu naprawdę błyszczy i napędza retencję.”

## Punkty sporne

- **Generowanie AI: ile za darmo.** **Konsensus:** podstawy (ręczne przepisy, plan) darmowe; **ciężkie
  generowanie/OCR limitowane** budżetem AI (Z-130) — naturalna oś premium.

## Głos użytkowników

**Agnieszka (38):** „Plan posiłków + automatyczna lista zakupów to oszczędność czasu.”
**Tadeusz (60):** „Food cost i alergeny — i mam narzędzie do lokalu.”

## Konsensus i zalecenia

- **Z-250** *(P1 · S)* — **Ciężkie operacje AI (OCR, plan tygodnia) do kolejki** (Z-074) + limit per plan (Z-130).
- **Z-251** *(P1 · S)* — **Testy parsera składników/importu** (jednostki, formaty) — import to pole błędów.
- **Z-252** *(P1 · M)* — **Food cost** (koszt porcji z cen składników) — zalążek branży gastro (Z-493).
- **Z-253** *(P2 · M)* — **Alergeny + kalkulacja menu** — krok ku gastronomii B2B.
- **Z-254** *(P2 · S)* — **„Ugotuj z tego, co mam”** (sugestie ze spiżarni) jako wyróżnik retencyjny.

## Dobre vs złe praktyki

**Dobre:** rewizja AI przed zapisem, spójny przepływ plan→spiżarnia→zakupy, wartości odżywcze.
**Złe / do poprawy:** ciężkie AI synchronicznie/bez limitów (koszt); brak testów importu; food cost
„o krok” a niewykorzystany.
