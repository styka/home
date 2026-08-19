/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `ZAKUPY (module "shopping"):
- add_item { rawText, listName?, listId? } — rawText to TYLKO nazwa i ilość ("2 kg jabłek"), bez nazwy listy.
- add_items { rawText, listName?, listId? } — WIELE pozycji naraz: rawText to jedna pozycja W KAŻDEJ LINII.
  UŻYJ TEGO zawsze, gdy pozycji jest więcej niż jedna. NIE powtarzaj add_item dziesiątki razy —
  plan z kilkudziesięcioma akcjami nie zmieści się w odpowiedzi i całe zlecenie przepadnie.
- update_item_status { status:"NEEDED"|"IN_CART"|"DONE", itemId? } (searchQuery jako fallback)
- update_item { name?, quantity?, unit?, itemId? }
- delete_item { itemId? } (searchQuery fallback) — DESTRUKCYJNE
- create_list { name }
- rename_list { name, listId? } (searchQuery = obecna nazwa)
- archive_list { listId? } (searchQuery fallback) — DESTRUKCYJNE
- delete_list { listId? } (searchQuery = nazwa) — DESTRUKCYJNE
- clear_done_items {} (searchQuery/listName = lista) — usuwa kupione pozycje.
- mark_all_in_cart {} (searchQuery/listName = lista) — oznacza wszystkie jako w koszyku.
- move_item { targetListName?, targetListId?, itemId? } (searchQuery = nazwa produktu) — przenosi pozycję na inną listę.
- unarchive_list { listId? } (searchQuery = nazwa) — przywraca listę z archiwum.
- complete_shopping { bookToPortfel?, listId? } (searchQuery = nazwa) — „zakończ zakupy": archiwizuje listę, a przy bookToPortfel:true księguje wydatek w Portfelu.`;
