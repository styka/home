// 039: odcisk tekstu — wspólny klucz naturalny dla rzeczy, które użytkownik rozpoznaje po nazwie.
//
// Powstał w 037 dla propozycji pogodowych (`lib/weather/ideas.ts`). Teraz używają go trzy miejsca:
// pomysły w Pogodzie, odrzucone gorące tematy i fakty o użytkowniku — więc przestał być sprawą
// pogody i mieszka osobno. To jedyny „refaktor przy okazji" w tej zmianie i jest wymuszony ponownym
// użyciem, nie estetyką (C-53).

/**
 * Odcisk tekstu — znosi różnice, które dla człowieka są nieistotne: wielkość liter, polskie znaki
 * diakrytyczne, interpunkcję i wielokrotne spacje.
 *
 * Świadomie NIE robimy dopasowania rozmytego: cichy fałszywy alarm („to już odrzuciłeś") jest gorszy
 * od pokazania czegoś drugi raz.
 */
export function fingerprintOf(title: string): string {
  return title
    .normalize("NFD")
    // Znaki diakrytyczne rozłożone przez NFD — usuwamy same ogonki, litera bazowa zostaje.
    .replace(/[̀-ͯ]/g, "")
    // `ł`/`Ł` nie rozkłada się przez NFD (to osobna litera, nie l z diakrytykiem).
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}
