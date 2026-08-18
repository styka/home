/**
 * 070 (zadanie 21, rozdz. 9.4) — REJESTR RODZAJÓW ZDARZEŃ DOMENOWYCH.
 *
 * Rodzaj jest **tekstem z zawężającym typem TypeScript**, nigdy typem wyliczeniowym bazy (C-12).
 *
 * ŚWIADOME ODSTĘPSTWO OD C-36, nazwane wprost. Reguła mówi, że platforma nie zna żadnego modułu —
 * a tu w platformie leży lista nazw zaczynających się od nazw modułów. Uzasadnienie: to jest
 * **słownik nazw**, nie wiedza o module. Platforma niczego z niego nie importuje, nie wywołuje
 * i nie zależy od żadnego modułu w czasie działania.
 *
 * Alternatywa — rodzaj deklarowany w `module.ts` i składany w korzeniu kompozycji — zamieniłaby
 * unię TypeScript na typ liczony w czasie działania, czyli **oddałaby jedyną kontrolę, która
 * pilnuje tego rejestru za darmo**: literówka w nazwie rodzaju przestałaby być błędem kompilacji.
 *
 * Do rewizji przy zadaniu 25, gdy moduły zaczną się na zdarzenia zapisywać — wtedy deklaracja
 * subskrypcji i tak musi trafić do `module.ts` i warto będzie rozstrzygnąć to razem.
 */

/**
 * Rodzaje zdarzeń, które ktoś **realnie wyemituje**. Lista rośnie razem z producentami, nie „na
 * zapas": rodzaj bez producenta to nazwa dla czegoś, co się nie dzieje.
 */
export type DomainEventType =
  /** Zakupy zakończone — kanoniczny przykład z rozdz. 9.4.2. Przyszły odbiorca: księgowanie w Portfelu. */
  | "shopping.list.completed"
  /** Zmiana stanu pozycji magazynowej. Przyszły odbiorca: uzupełnianie zapasów do Zakupów (rozdz. 9.1). */
  | "magazynowanie.stan.zmieniony"
  /** Spis spiżarni domknięty — jedno zdarzenie na spis, nie na pozycję. */
  | "kuchnia.spizarnia.spisana"
  /**
   * 090 (zadanie 14): nadanie i odebranie dostępu do zasobu.
   *
   * Te dwa typy są jednocześnie **brakującym producentem** dla cache'u rozstrzygnięć dostępu
   * (rozdz. 11.5). W 085 świadomie nie założyliśmy tego cache'u, bo bez nich nie miałby czym się
   * unieważniać, a cache dostępu bez natychmiastowego unieważnienia to dziura z rozdz. 11.1.3.
   * `sharing` nie jest modułem w `src/modules/` — udostępnianie jest zdolnością platformy
   * (rozdz. 8.1), i pole `module` mówi tu właśnie to.
   */
  | "sharing.grant.granted"
  | "sharing.grant.revoked";

/** Moduł źródłowy — pozwala filtrować strumień bez parsowania `type`. */
export type DomainEventModule = "shopping" | "magazynowanie" | "kitchen" | "sharing";
