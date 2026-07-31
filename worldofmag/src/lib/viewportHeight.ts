/**
 * 036: reguła wyboru wysokości powłoki aplikacji przy wysuniętej klawiaturze ekranowej.
 *
 * Wydzielona z hooka (`useAppHeightVar`) jako czysta funkcja, bo to ONA jest sednem naprawy
 * drgającego nagłówka asystenta i chcemy ją mieć pod testem, bez DOM-u.
 *
 * Skąd się wzięła: przewijanie dokumentu przy klawiaturze — a więc i przesunięcie widocznego obszaru,
 * które okno `position: fixed` musi gonić — to dokładnie różnica `wysokość powłoki − widoczna
 * wysokość`. Dwa niezależne pomiary na urządzeniu trafiają w tę regułę co do piksela:
 *
 * | powłoka        | wysokość | widać | różnica | zmierzone `scrollY` |
 * |----------------|----------|-------|---------|---------------------|
 * | `h-screen`     | 812      | 477   | 335     | **335**             |
 * | `h-full` (ICB) | 768      | 477   | 291     | **291**             |
 */

/**
 * Wysokość, jaką ma przyjąć powłoka: widoczny obszar, ale NIGDY mniej niż okno.
 *
 * `Math.max` jest zabezpieczeniem, nie kosmetyką — powłoka niższa od okna zostawia u dołu ekranu
 * pasek tła (dokładnie ten, który zepsuł podejście z `h-full`, gdzie 100% bloku bazowego było o 44 px
 * niższe niż okno). Przy `interactive-widget=resizes-content` klawiatura kurczy oba pomiary naraz
 * (zmierzone: 812 → 477), więc `max` nie przeszkadza jej oddać miejsca; gdyby jakaś przeglądarka
 * kurczyła wyłącznie widoczny obszar, `max` sprowadza nas do dzisiejszego zachowania, a nie gorszego.
 */
export function pickAppHeight(visualViewportHeight: number | null, innerHeight: number): number {
  if (visualViewportHeight === null || !Number.isFinite(visualViewportHeight)) return innerHeight;
  return Math.max(visualViewportHeight, innerHeight);
}
