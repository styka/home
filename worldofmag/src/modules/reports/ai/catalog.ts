/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `RAPORTY (module "reports"):
- save_report { title, content } — zapisuje raport (markdown) do działu Raporty użytkownika. Używaj, gdy użytkownik prosi „zapisz to jako raport". Dla pełnego raportu z sesji preferuj jednak krok "report" (niżej), który pozwala użytkownikowi obejrzeć szkic przed zapisem.`;
