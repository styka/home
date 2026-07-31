// 038: faza księżyca liczona rachunkiem astronomicznym z daty — bez dokładania zewnętrznej usługi
// (Open-Meteo jej nie zwraca, a osobne API dla jednej liczby byłoby nieproporcjonalne — C-53).
//
// Metoda: liczba dni od znanego nowiu podzielona przez długość miesiąca synodycznego. To
// przybliżenie „średniego" księżyca — myli się o kilkanaście godzin względem efemeryd, co przy
// ośmiu nazwanych fazach jest nieistotne (jedna faza trwa ~3,7 doby), a pozwala uniknąć zależności.

/** Znany nów: 2000-01-06 18:14 UTC — punkt odniesienia rachunku. */
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

/** Długość miesiąca synodycznego w dobach (od nowiu do nowiu). */
const SYNODIC_MONTH_DAYS = 29.530588853;

const MS_PER_DAY = 86_400_000;

export type MoonPhaseName =
  | "Nów"
  | "Przybywający sierp"
  | "Pierwsza kwadra"
  | "Przybywający garb"
  | "Pełnia"
  | "Ubywający garb"
  | "Ostatnia kwadra"
  | "Ubywający sierp";

export interface MoonPhase {
  /** Pozycja w cyklu: 0 = nów, 0,5 = pełnia, dąży do 1 = ponownie nów. */
  fraction: number;
  name: MoonPhaseName;
  emoji: string;
}

/**
 * Osiem faz. Granice rozłożone symetrycznie wokół punktów charakterystycznych (nów, kwadry, pełnia),
 * więc „Pełnia" obejmuje 1/8 cyklu wokół dokładnej pełni, a nie tylko jej moment.
 */
const PHASES: { name: MoonPhaseName; emoji: string }[] = [
  { name: "Nów", emoji: "🌑" },
  { name: "Przybywający sierp", emoji: "🌒" },
  { name: "Pierwsza kwadra", emoji: "🌓" },
  { name: "Przybywający garb", emoji: "🌔" },
  { name: "Pełnia", emoji: "🌕" },
  { name: "Ubywający garb", emoji: "🌖" },
  { name: "Ostatnia kwadra", emoji: "🌗" },
  { name: "Ubywający sierp", emoji: "🌘" },
];

/** Faza księżyca dla podanej chwili (domyślnie teraz). */
export function moonPhase(at: Date = new Date()): MoonPhase {
  const days = (at.getTime() - KNOWN_NEW_MOON_MS) / MS_PER_DAY;
  // `%` w JavaScripcie zachowuje znak dzielnej, więc dla dat sprzed roku 2000 wynik byłby ujemny.
  const fraction = (((days % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS) % 1 + 1) % 1;
  // Przesunięcie o pół przedziału: dzięki temu wartości tuż przed i tuż po nowiu trafiają w „Nów",
  // a nie po dwóch stronach granicy.
  const index = Math.floor(fraction * 8 + 0.5) % 8;
  return { fraction, ...PHASES[index] };
}
