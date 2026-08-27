/**
 * Kontrakt modułu **Czat**.
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/czat/*` poza `contract`.
 *
 * Konsument zewnętrzny jest dziś jeden: **chrom powłoki** (ikona czatu z licznikiem i podglądem
 * rozmów). Powłoka nie ma prawa zaglądać do wnętrza modułu (C-36), więc bierze stąd dokładnie
 * dwie rzeczy, których używa — i ani jednej więcej. Wystawienie „wszystkiego na wszelki wypadek”
 * zamieniłoby kontrakt w drugi spis eksportów, czyli w granicę, która niczego nie ogranicza.
 *
 * Guardy uczestnictwa zostają po stronie akcji — kontrakt jest granicą **widoczności**, nie
 * warstwą uprawnień. Import przez kontrakt nie omija żadnej kontroli.
 */

export { getLicznikNieprzeczytanych, getRozmowy } from "./actions/rozmowy";

export type { RozmowaDTO } from "./actions/rozmowy";
