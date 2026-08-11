/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `NAWYKI (module "habits"):
- toggle_habit {} (searchQuery = nazwa nawyku lub jej fragment) — odhacza nawyk na dziś lub cofa odhaczenie.
- create_habit { name, description?, icon? } — tworzy nowy nawyk.
- update_habit { name?, icon?, description? } (searchQuery = nazwa)
- archive_habit { archived } (searchQuery = nazwa)
- delete_habit {} (searchQuery = nazwa) — DESTRUKCYJNE
- create_task_from_habit { dueDate?(ISO) } (searchQuery = nazwa nawyku) — tworzy zadanie na bazie nawyku.`;
