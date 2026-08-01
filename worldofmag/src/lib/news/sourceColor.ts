// 040: kolor źródła liczony z jego opisu.
//
// Do 039 kolor brał się z zamkniętego zbioru (left/center/right → trzy stałe kolory). Gdy kategoria
// ustąpiła dowolnemu opisowi, kolor musiał skądś pochodzić — a nie chcieliśmy dokładać drugiego pola
// „wybierz kolor", bo dodawanie źródła zamieniłoby się w dwie decyzje zamiast jednej.
//
// Kolor jest WSPARCIEM, nie nośnikiem informacji: obok zawsze stoi nazwa źródła i jego opis. Dlatego
// kolizja dwóch opisów na ten sam odcień jest akceptowalna i nie wymaga większej palety.

import { fingerprintOf } from "@/lib/textKey";

/**
 * Paleta akcentów motywu — wyłącznie zmienne CSS (C-30).
 *
 * Skórka może nadpisać każdą z nich, więc kolory źródeł idą za motywem zamiast rozjeżdżać się z nim.
 * Świadomie NIE generujemy dowolnego odcienia (np. z HSL): wynik byłby nie do przewidzenia na jasnej
 * skórce i mógłby wypaść nieczytelnie na tle karty.
 */
const PALETTE = [
  "var(--accent-blue)",
  "var(--accent-green)",
  "var(--accent-purple)",
  "var(--accent-amber)",
  "var(--accent-red)",
] as const;

/** Kolor źródła bez opisu — neutralny, a nie losowy z palety. */
const NEUTRAL = "var(--text-muted)";

/**
 * Zwraca kolor dla opisu źródła. Ten sam opis daje **zawsze** ten sam kolor — także po ponownym
 * wejściu na stronę i na innym urządzeniu, bo wynik zależy wyłącznie od tekstu.
 *
 * Normalizacja idzie przez `fingerprintOf` (to samo, czym system rozpoznaje powtórzone tytuły), więc
 * „Pop-Science", „pop science" i „POP SCIENCE" to dla koloru jeden i ten sam opis. Bez tego drobna
 * różnica w zapisie dawałaby dwa różne kolory dla czegoś, co użytkownik uważa za to samo.
 */
export function sourceColor(descriptor: string | null | undefined): string {
  const key = fingerprintOf(descriptor ?? "");
  if (!key) return NEUTRAL;

  // Suma kodów znaków: stabilna między uruchomieniami i niezależna od platformy (w przeciwieństwie
  // do np. kolejności iteracji po zbiorze). Rozkład nie musi być idealny — paleta ma 5 pozycji,
  // a źródeł jest kilka.
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}

/** Czy kolor jest tym neutralnym (brak opisu) — do odróżnienia w UI bez powtarzania stałej. */
export function isNeutralSourceColor(color: string): boolean {
  return color === NEUTRAL;
}
