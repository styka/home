/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `POGODA (module "weather"):
- add_weather_location { name } — dodaje lokalizację pogodową po nazwie miejscowości.
- delete_weather_location { locationId? } (searchQuery = nazwa) — DESTRUKCYJNE
- set_default_weather_location { locationId? } (searchQuery = nazwa)
- add_weather_watcher { presetKey }
- add_custom_watcher { title, query, horizon?("today"|"tomorrow"|"weekend"|"week") } — własny obserwator pogody.
- update_watcher { newTitle?, query?, horizon?, enabled?, watcherId? } (searchQuery = tytuł obserwatora)
- delete_weather_watcher { watcherId? } — DESTRUKCYJNE`;
