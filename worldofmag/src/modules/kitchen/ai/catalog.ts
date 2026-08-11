/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `KUCHNIA (module "kitchen"):
- plan_meal { customTitle, date?(ISO; pomiń jeśli „dziś"), slot?:"breakfast"|"lunch"|"dinner"|"snack" } — planuje posiłek w jadłospisie.
- add_pantry_item { name, quantity?, unit?, expiresAt?(ISO) } — dodaje produkt do spiżarni.
- create_recipe { title, description?, servings?, body? }
- update_recipe { newTitle?, description?, servings?, recipeId? } (searchQuery = tytuł)
- archive_recipe {} (searchQuery = tytuł)
- duplicate_recipe {} (searchQuery = tytuł) — tworzy kopię przepisu.
- mark_recipe_cooked { servings? } (searchQuery = tytuł) — oznacza jako ugotowany (zużywa spiżarnię).
- shop_for_recipe { listName?, servings?, skipPantry? } (searchQuery = tytuł) — dodaje składniki przepisu do listy zakupów.
- add_ingredient { name, quantity?, unit?, note?, isOptional? } (searchQuery = tytuł przepisu) — dopisuje składnik.
- add_step { text, durationMin? } (searchQuery = tytuł przepisu) — dopisuje krok.
- delete_recipe {} (searchQuery = tytuł) — DESTRUKCYJNE
- mark_meal_cooked {} (searchQuery = tytuł posiłku)
- delete_meal_plan {} (searchQuery = tytuł posiłku)
- update_pantry_item { quantity?, unit?, expiresAt? } (searchQuery = nazwa)
- consume_pantry { quantity } (searchQuery = nazwa)
- delete_pantry_item {} (searchQuery = nazwa) — DESTRUKCYJNE
- generate_shopping_from_plan { days?, listName?, skipPantry? } — zbiera składniki z zaplanowanych posiłków (domyślnie 7 dni) do listy zakupów (domyślnie pomija to, co masz w spiżarni).
- set_pantry_quantity { quantity:number } (searchQuery = nazwa) — ustawia dokładną ilość w spiżarni.
- move_item_to_pantry {} (searchQuery = nazwa produktu z listy zakupów) — przenosi kupiony produkt do spiżarni.
- auto_replenish_pantry { listName? } — dorzuca do listy zakupów produkty spiżarni poniżej progu.
- mark_meal_skipped {} (searchQuery = tytuł posiłku) — oznacza posiłek jako pominięty.
- update_meal_plan_entry { customTitle?, slot? } (searchQuery = tytuł posiłku) — zmienia nazwę/porę posiłku.
- move_meal_plan_entry { date?(ISO), slot? } (searchQuery = tytuł posiłku) — przenosi posiłek na inny dzień/porę.
- create_cookbook { name, description?, emoji? } — nowa książka kucharska.
- update_cookbook { name?, description?, emoji?, cookbookId? } (searchQuery = nazwa)
- delete_cookbook { cookbookId? } (searchQuery = nazwa) — DESTRUKCYJNE`;
