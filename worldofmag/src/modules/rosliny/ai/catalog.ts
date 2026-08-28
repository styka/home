/**
 * 113: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 *
 * **Żadna z tych akcji nie jest destrukcyjna i to jest decyzja.** Usuwanie rośliny czy przestrzeni
 * świadomie nie wchodzi do katalogu asystenta: nie ma go w kryteriach akceptacji, a dopisanie go
 * wymagałoby rozszerzenia `DESTRUCTIVE_ACTION_TYPES` bez potrzeby (C-53). Zmiana stanu na „padła"
 * jest natomiast zwykłym zapisem — to odnotowanie faktu, nie kasowanie danych.
 */
export const actionCatalog = `ROŚLINY (module "rosliny"):
- create_plant_space { nazwa, tryb? } — zakłada przestrzeń roślinną; „tryb" to jedno z: home (mieszkanie), garden (ogród), production (produkcja/kwiaciarnia), field (pole)
- create_plant { nazwa, przestrzen?, miejsce?, gatunek?, ilosc?, jednostka? } (searchQuery = nazwa przestrzeni) — dodaje roślinę; „jednostka" to szt, m2 albo ha
- log_plant_care { rodzaj?, notatka? } (searchQuery = nazwa rośliny) — odnotowuje wykonany zabieg (WATERING, FERTILIZING, PRUNING, REPOTTING, HARVEST, CUSTOM)
- add_plant_measurement { rodzaj, wartosc, jednostka? } (searchQuery = nazwa rośliny) — zapisuje pomiar (HEIGHT_CM, LEAF_COUNT, TRUNK_CM, SOIL_MOISTURE, TEMP_C, PH, LIGHT, OTHER)`;
