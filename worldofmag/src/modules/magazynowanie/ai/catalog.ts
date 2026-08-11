/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `MAGAZYN (module "magazynowanie"):
- add_storage_item { name, quantity?, unit?, warehouse?, location?, category? } — nowa pozycja magazynu (warehouse = magazyn nadrzędny, location = dokładne miejsce).
- adjust_storage { delta:number } (searchQuery = nazwa pozycji) — przyjęcie (+) lub wydanie (−) ze stanu.
- update_storage_item { name?, unit?, warehouse?, location? } (searchQuery = nazwa)
- delete_storage_item {} (searchQuery = nazwa) — DESTRUKCYJNE
- transfer_storage { toWarehouse?, toLocation?, quantity } (searchQuery = nazwa)
- add_batch { quantity:number, lotNo?, serialNo?, expiresAt?(ISO), note? } (searchQuery = nazwa pozycji) — dodaje partię/lot (FEFO).
- add_low_stock_to_shopping { listName? } — dorzuca pozycje poniżej stanu minimalnego do listy zakupów.
- add_supplier { name, contact?, email?, phone?, notes? } — nowy dostawca.
- update_supplier { newName?, contact?, email?, phone?, notes?, supplierId? } (searchQuery = nazwa dostawcy)
- delete_supplier { supplierId? } (searchQuery = nazwa) — DESTRUKCYJNE`;
