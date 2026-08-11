/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `PORTFEL (module "portfel"):
- add_expense { amount:number, category?, note?, elementName? } — wydatek (kwota w PLN). elementName = fragment nazwy konta/elementu portfela.
- add_income { amount:number, category?, note?, elementName? } — przychód (kwota w PLN).
- create_wallet_element { name, kind?, initialBalance? } — tworzy konto/element portfela.
- update_wallet_element { name?, note?, elementName? }
- set_wallet_balance { amount, elementName? }
- archive_wallet_element { archived } (elementName?)
- delete_wallet_element {} (elementName? / searchQuery = nazwa) — DESTRUKCYJNE
- create_budget { category, limitAmount:number, note? } — budżet miesięczny dla kategorii (limit w PLN).
- update_budget { category?, limitAmount?, note?, budgetId? } (searchQuery = kategoria budżetu)
- delete_budget { budgetId? } (searchQuery = kategoria) — DESTRUKCYJNE
- create_goal { name, targetAmount:number, currentAmount?, deadline?(ISO), note? } — cel oszczędnościowy.
- update_goal { name?, targetAmount?, deadline?, note?, goalId? } (searchQuery = nazwa celu)
- delete_goal { goalId? } (searchQuery = nazwa) — DESTRUKCYJNE
- contribute_goal { amount:number, goalName? } (searchQuery = nazwa celu) — dopłata do celu (ujemna = wypłata).`;
