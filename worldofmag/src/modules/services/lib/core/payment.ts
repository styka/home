/**
 * Z-173/Z-360: kwota netto płatności marketplace. Kwoty trzymane są w groszach
 * (Int), a księgowanie do Portfela jest po rabacie (M16). Jedno źródło prawdy dla
 * obliczenia, żeby przychód wykonawcy i wydatek klienta liczyły się identycznie.
 */
export function netAmount(payment: { amount: number; discount: number }): number {
  return (payment.amount - payment.discount) / 100;
}
