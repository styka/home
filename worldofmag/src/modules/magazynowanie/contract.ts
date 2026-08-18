/**
 * Kontrakt modułu **Magazynowanie** (pozycje, ruchy, dostawcy, dokumenty, partie, tryb Dom/Pro).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/magazynowanie/*` poza `contract`.
 *
 * **Ten kontrakt jest testem zasady.** Moduł ma **47 eksportów akcji** — najwięcej w całej aplikacji.
 * Kontrakt wystawia **czternaście**, bo tylu realnie używają konsumenci:
 * - **pulpit** (`app/page.tsx`) → `getLowStock`, `getExpiringStorage`,
 * - **narzędzia odczytu asystenta** → `getSuppliers`, `getLowStock`, `getExpiringStorage`, `getStorageAnalytics`,
 * - **egzekutor akcji asystenta** → pozycje, ruchy, dostawcy, partie, uzupełnianie listy zakupów.
 *
 * Reszta — dokumenty PZ/WZ, zamówienia zakupu, inwentaryzacja, ustawienia trybu, etykiety QR,
 * skanowanie — zostaje **prywatna**. To nie jest niedopatrzenie: 47 pozycji w kontrakcie znaczyłoby
 * dokładnie tyle samo, co brak kontraktu. Rozdz. 9 mówi wprost, że rosnący kontrakt jest **sygnałem**,
 * iż moduł robi za dużo — sygnał ma być widoczny, a nie zagłuszony eksportem całości.
 */

export {
  // odczyt — pulpit i asystent
  getLowStock,
  getExpiringStorage,
  getSuppliers,
  getStorageAnalytics,
  // pozycje magazynowe
  addStorageItem,
  updateStorageItem,
  deleteStorageItem,
  adjustStorageQuantity,
  transferStock,
  // dostawcy
  addSupplier,
  updateSupplier,
  deleteSupplier,
  // partie i uzupełnianie
  addBatch,
  addLowStockToShoppingList,
} from "./actions/storage";

// 080 (zadanie 25): kształt ładunku zdarzenia `magazynowanie.stan.zmieniony`. Konsumentem jest
// subskrybent Zakupów — patrz komentarz przy definicji typu.
export type { StanZmienionyPayload } from "./actions/storage";
