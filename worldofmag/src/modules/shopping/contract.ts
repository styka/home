/**
 * Kontrakt modułu **Zakupy** (listy, pozycje, sklepy z mapą, słowniki zakupowe, tryb offline).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/shopping/*` poza `contract`.
 *
 * | Konsument | Czego potrzebuje |
 * |---|---|
 * | **Kuchnia** | `assertListAccess`, `getLists` („kup na to zakupy"), `resolveOrCreateList`, `categorize`, `parseQuantity` |
 * | **Magazynowanie** | `assertListAccess`, `getLists`, `resolveOrCreateList`, `categorize` (uzupełnianie zapasów → lista) |
 * | paleta poleceń | `createList`, `clearDoneItems`, `markAllInCart` |
 * | tryb offline (`lib/shopping/offlineMutations`) | operacje na pozycjach + `categorize` |
 * | asystent (`executors/shared`) | `createList` |
 * | panel admina kategorii | `orphanCategoryIcons` |
 * | test izolacji najemcy | `assertListAccess` |
 *
 * **Słowniki zakupowe (kategorie, jednostki, produkty, ikony) należą do TEGO modułu.** Spec
 * zakładał, że są dzielone z Kuchnią; sprawdzenie konsumentów tego nie potwierdziło — poza Zakupami
 * nikt ich nie woła. Jedynym realnie współdzielonym słownikiem są **tagi** i tylko one zostały
 * poza modułami. To ta sama zasada co w 047: *przynależność ustala lista konsumentów, nie nazwa*.
 *
 * **`categorize` w kontrakcie** jest świadome: to reguła „do jakiej kategorii trafia produkt",
 * z której korzystają Kuchnia i Magazynowanie, dokładając pozycje do list zakupowych. Bez niej
 * dublowałyby ~500 słów kluczowych albo trafiały do złych kategorii.
 */

export {
  getLists,
  createList,
  assertListAccess,
} from "./actions/lists";

export {
  clearDoneItems,
  markAllInCart,
  addItemStructured,
  updateItem,
  updateItemStatus,
  deleteItem,
} from "./actions/items";

export { orphanCategoryIcons } from "./actions/categoryIcons";

/** Reguła kategoryzacji produktu — patrz uwaga w nagłówku. */
export { resolveOrCreateList } from "./lib/resolveList";
export { categorize } from "./lib/categorize";
export { parseQuantity } from "./lib/parseQuantity";
