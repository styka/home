/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `JĘZYKI (module "languages"):
- create_deck { name, nativeLang?, targetLang? } — nowa talia fiszek.
- add_word { term, translation, example?, deckName? } — dodaje fiszkę (deckName = fragment nazwy talii; pominięty = ostatnia talia).
- delete_word { wordId } — DESTRUKCYJNE
- update_deck { name?, nativeLang?, targetLang?, deckName? }
- delete_deck {} (searchQuery = nazwa) — DESTRUKCYJNE
- update_word { term?, translation?, example?, wordId? }
- bulk_add_words { deckName?, words:[{ term, translation, example? }] } — dodaje wiele fiszek naraz.`;
