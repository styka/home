/**
 * 083 (zadanie 30, Faza 5) — RETENCJA DANYCH: typ polityki.
 *
 * Rozdz. 11.6: „zastępuje brak retencji poza `cleanupOldJobs`" (diagnoza 5.9). Siedem tabel rosło
 * bez ograniczenia — najszybciej `AiCall` i `DomainEvent`, które przybywają przy każdej operacji.
 *
 * **Polityka opisuje SIEBIE, łącznie z zapytaniem kasującym.** Dzięki temu wykonawca w platformie
 * nie musi znać ani jednej tabeli, a moduł deklaruje retencję swoich danych u siebie — ten sam układ,
 * co wkłady do kalendarza (049) i pulpitu (050).
 */
export type PolitykaRetencji = {
  /** Człon klucza w `Config`: `retention_<klucz>_days`. Stabilny — zmiana gubi ustawienie admina. */
  klucz: string;
  /** Co znika. Widoczne w `/admin/config`, więc pisane dla człowieka. */
  etykieta: string;
  domyslneDni: number;
  /**
   * Dolna granica, poniżej której administrator nie zejdzie. Nie jest ozdobą: ślad audytowy ma
   * wymóg pięcioletni, a pole tekstowe bez granicy pozwoliłoby skasować go jedną literówką.
   * `0` = brak dolnej granicy.
   */
  minimumDni: number;
  /** Dlaczego akurat tyle. Trafia do interfejsu administratora jako podpowiedź. */
  uzasadnienie: string;
  /** Kasuje wiersze starsze niż podana chwila. Zwraca ich liczbę. */
  usun: (starszeNiz: Date) => Promise<number>;
};
