/**
 * Kontrakt modułu **Usługi** (giełda usług: profile wykonawców, ogłoszenia, zlecenia, wyceny,
 * czat, rezerwacje, płatności, spory).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/services/*` poza `contract`.
 *
 * **Moduł nie ma dziś konsumenta poza własnymi trasami i testami.** Kontrakt istnieje jako
 * granica, nie jako spis życzeń — dokładnie tak samo jak przy Trasach TIR w 046. Gdy ktoś realnie
 * będzie potrzebował danych giełdy, dopisze tutaj tę jedną rzecz, zamiast wchodzić do `actions/`.
 *
 * **W drugą stronę Usługi SĄ konsumentem Portfela:** rozliczenie płatności za zlecenie księguje
 * wydatek przez kontrakt Portfela. To jest właśnie ten koszt sprzężenia, który granica ma pokazać —
 * jedna funkcja, widoczna na przeglądzie kodu, zamiast rozsypanego importu w kilkunastu plikach.
 */

/** Status zlecenia — `String` + unia, zero enumów Prisma (C-12). */
export type { RequestStatus, PriceModel, ListingDTO, RequestDTO } from "./lib/services";
