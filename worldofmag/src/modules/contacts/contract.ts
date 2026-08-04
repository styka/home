/**
 * Kontrakt modułu **Kontakty** (osobisty CRM).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/contacts/*` poza `contract`.
 *
 * Konsument zewnętrzny jest dziś dokładnie jeden: egzekutor akcji asystenta
 * (`lib/ai/executors/contactsExecutor.ts`). Kontrakt wystawia więc **cztery operacje, których
 * on realnie używa** — i ani jednej więcej. „Wystawmy wszystko na wszelki wypadek" zamienia
 * kontrakt w drugi spis eksportów modułu, czyli w granicę, która niczego nie ogranicza.
 *
 * Guardy dostępu i własność (`ownerId`/`ownerTeamId`) zostają po stronie akcji — kontrakt jest
 * granicą **widoczności**, nie warstwą uprawnień. Import przez kontrakt nie omija żadnej kontroli.
 */

export {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from "./actions/contacts";

export type { ContactDTO } from "./actions/contacts";
