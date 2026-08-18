-- 092 (zadanie 15, ciąg dalszy) — KOLUMNA `version` NA KOLEJNYCH MODELACH.
--
-- 062 zrobiło mechanizm (`updateWithVersion`) i pilota na dwóch modelach (`Task`, `Note`). Zadanie
-- mówi „rozszerzanie na kolejne modele — sukcesywnie"; to jest ten ciąg dalszy.
--
-- **Kryterium wyboru: czy DWIE OSOBY mogą to edytować naraz.** Nie „czy model jest ważny" —
-- kolumna `version` chroni przed cichym nadpisaniem cudzej zmiany, więc ma sens tam, gdzie cudza
-- zmiana jest w ogóle możliwa: zasób w przestrzeni zespołowej albo udostępniony nadaniem, z formularzem
-- edycji, w którym zmienia się kilka pól naraz.
--
-- Pięć modeli spełniających to kryterium:
--   * `Recipe`         — najdłuższy formularz w aplikacji; utrata cudzej wersji boli tu najbardziej
--   * `TaskProject`    — nazwa, kolor, konfiguracja statusów; projekt jest głównym zasobem udostępnianym
--   * `ShoppingList`   — nazwa, sklep, flaga automatu; lista domowa to klasyczny zasób współdzielony
--   * `Contact`        — kartoteka, edytowana z dwóch urządzeń tej samej osoby (to też konflikt)
--   * `StorageItem`    — stan, minimum, lokalizacja; w trybie Pro dotyka jej kilka osób
--
-- Czego świadomie NIE obejmujemy: rekordów pojedynczego zdarzenia (`FuelLog`, `WalletEntry`,
-- `HabitEntry`, `MedicationLog`). Tam nikt się nie ściga — wpis powstaje raz i zwykle nie jest
-- edytowany, a kolumna bez konsumenta to koszt bez korzyści.
--
-- **`Pet` wypadł po sprawdzeniu miejsc zapisu — i to jest ta sama reguła, nie wyjątek od niej.**
-- Profil zwierzęcia jest dzielony (`PetShare`), więc na pierwszy rzut oka pasuje. Ale osiem z dziesięciu
-- zapisów do `Pet` w kodzie to zmiany JEDNEGO pola stanu: przypisanie do terrarium, `status = SOLD`,
-- genetyka, rodzice. Kontrola wersji na takich zapisach nie chroni przed niczym (nikt się o nie nie
-- ściga), a wymusiłaby osiem wpisów w manifeście wyjątków — czyli koszt bez korzyści, przed którym
-- ostrzega akapit wyżej. Kryterium brzmi „formularz, w którym zmienia się kilka pól naraz", a nie
-- „zasób, który da się udostępnić".
--
-- `DEFAULT 0` na istniejących wierszach: pierwszy zapis podnosi je do 1. Kontrola wersji działa od
-- chwili, w której klient zacznie przesyłać `expectedVersion` — do tego czasu zapis jest
-- bezwarunkowy, ale JUŻ przechodzi przez jedno miejsce (`updateWithVersion`), więc włączenie kontroli
-- nie wymaga ruszania akcji.

ALTER TABLE "Recipe"       ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TaskProject"  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ShoppingList" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact"      ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StorageItem"  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
