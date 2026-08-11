/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `FLOTA (module "flota"):
- add_fuel_log { liters:number, totalCost?, odometer?, vehicleName?, note? } — zapis tankowania. vehicleName = fragment nazwy/modelu pojazdu.
- add_service_record { vehicleName?, serviceType?, cost?, odometer?, note? } — wpis serwisowy pojazdu.
- create_vehicle { name, make?, model?, plate?, year? }
- update_vehicle { name?, plate?, odometer? } (searchQuery = nazwa)
- delete_vehicle {} (searchQuery = nazwa) — DESTRUKCYJNE`;
