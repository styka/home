/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `KONTAKTY (module "contacts") — osobisty CRM:
- create_contact { name, phone?, email?, company?, tags?, notes? } — nowy kontakt.
- update_contact { name?, phone?, email?, company?, tags?, notes?, contactId? } (searchQuery = imię/nazwa) — edycja kontaktu.
- delete_contact { contactId? } (searchQuery = imię/nazwa) — DESTRUKCYJNE.`;
