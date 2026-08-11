/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `WARSZTATY (module "warsztaty"):
- create_workshop { name, type?, location? } — nowy warsztat/pracownia (type: "stolarski"|"samochodowy"|"malarski"|"elektroniczny"|"slusarski"|"ceramiczny"|"krawiecki"|"jubilerski"|"ogolny").
- add_workshop_item { name, workshopName?, kind?, quantity?, unit?, category? } — dodaj pozycję wyposażenia do warsztatu (kind: "tool"|"machine"|"consumable"|"safety"|"material"; searchQuery = nazwa warsztatu).
- update_workshop { newName?, type?, location?, workshopId? } (searchQuery = nazwa warsztatu)
- delete_workshop { workshopId? } (searchQuery = nazwa) — DESTRUKCYJNE
- update_workshop_item { newName?, kind?, category?, unit?, itemId? } (searchQuery = nazwa pozycji)
- delete_workshop_item { itemId? } (searchQuery = nazwa pozycji) — DESTRUKCYJNE
- adjust_workshop_item { delta:number, itemId? } (searchQuery = nazwa pozycji) — zmiana ilości (+/−).
- add_workshop_project { name, workshopName?, description?, status? } — projekt w warsztacie (Pro).
- update_workshop_project { newName?, description?, status?, projectId? } (searchQuery = nazwa projektu)
- delete_workshop_project { projectId? } (searchQuery = nazwa) — DESTRUKCYJNE`;
