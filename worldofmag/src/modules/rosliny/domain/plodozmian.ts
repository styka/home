/**
 * 113 — OSTRZEŻENIE PŁODOZMIANOWE.
 *
 * **Dlaczego ta reguła w ogóle da się napisać.** Płodozmian wygląda na funkcję „dla rolnika",
 * ale wymaga dokładnie dwóch rzeczy: **historii miejsca** (co tu rosło w poprzednich sezonach)
 * i **rodziny botanicznej** gatunku. Jeśli oba pola istnieją, reguła kosztuje kilkadziesiąt linii;
 * jeśli brakuje któregokolwiek — jest niewykonalna w ogóle. To był argument z `badania.md`
 * (poziom 5) za tym, żeby oba pola powstały od razu, a nie „kiedyś przy warstwie polowej".
 *
 * **Reguła OSTRZEGA, nigdy nie blokuje** (AC-26). Ogrodnik ma prawo posadzić pomidory trzeci rok
 * w tym samym miejscu — czasem nie ma gdzie indziej. Zadaniem modułu jest powiedzieć, czym to
 * grozi, a nie decydować za użytkownika.
 *
 * Bez bazy i bez sesji: historia wchodzi parametrem, więc test nie potrzebuje ani jednego wiersza.
 */

/** Jeden wpis z historii miejsca: co tam rosło i w którym sezonie. */
export interface WpisHistorii {
  /** Rok sezonu. */
  rok: number;
  /** Rodzina botaniczna gatunku. `null`, gdy nieznana — taki wpis jest pomijany. */
  rodzina: string | null;
  /** Nazwa rośliny — wyłącznie do treści komunikatu. */
  nazwa?: string;
}

export interface OstrzezeniePlodozmianu {
  /** Poziom: `info` = warto wiedzieć, `warn` = realne ryzyko. */
  poziom: "info" | "warn";
  /** Treść po polsku, gotowa do pokazania. */
  tresc: string;
  /** Ile sezonów z rzędu (licząc planowany) ta rodzina zajmuje miejsce. */
  powtorzenia: number;
}

/**
 * Rodziny, dla których nawrót jest szczególnie kosztowny, wraz z powodem.
 *
 * Lista jest krótka i celowo taka zostaje: to nie jest baza fitopatologiczna, tylko cztery
 * przypadki, w których użytkownik realnie traci plon. Rozbudowywanie jej „na zapas" dałoby
 * słownik, którego nikt nie utrzymuje (C-53).
 */
const RYZYKO_RODZINY: Record<string, string> = {
  Solanaceae: "psiankowate kumulują w glebie zarazę ziemniaka i wertycyliozę",
  Brassicaceae: "kapustowate przenoszą kiłę kapusty, która zostaje w glebie na lata",
  Apiaceae: "selerowate sprzyjają połyśnicy marchwiance i chorobom korzeni",
  Amaryllidaceae: "czosnkowate kumulują niszczyka zjadliwego i białą zgniliznę",
};

/**
 * Rodziny, które glebę POPRAWIAJĄ — motylkowe wiążą azot.
 * Warto o tym powiedzieć, bo to jedyna sytuacja, w której historia miejsca jest dobrą wiadomością.
 */
const RODZINY_WZBOGACAJACE = new Set(["Fabaceae"]);

/** Od ilu sezonów z rzędu (licząc planowany) mówimy o realnym ryzyku, a nie o ciekawostce. */
export const PROG_OSTRZEZENIA = 3;

/**
 * Czy zasadzenie rośliny z tej rodziny w tym miejscu wymaga ostrzeżenia.
 *
 * @param rodzinaPlanowana rodzina botaniczna rośliny, którą użytkownik chce posadzić
 * @param historia       wpisy z historii TEGO miejsca (dowolna kolejność)
 * @param rokPlanowany   sezon, na który planujemy
 * @returns `null`, gdy nie ma o czym mówić
 */
export function ostrzezeniePlodozmianu(
  rodzinaPlanowana: string | null | undefined,
  historia: WpisHistorii[],
  rokPlanowany: number,
): OstrzezeniePlodozmianu | null {
  // Bez rodziny reguła milczy. To jest świadome: wpis bez rodziny (własny gatunek użytkownika,
  // roślina spoza katalogu) nie ma prawa wywołać ani ostrzeżenia, ani fałszywego spokoju.
  if (!rodzinaPlanowana) return null;

  // Ile sezonów WSTECZ, bez przerwy, ta sama rodzina zajmowała miejsce. Przerwa kończy liczenie —
  // rok pauzy jest dokładnie tym, czemu płodozmian służy.
  let powtorzenia = 1; // planowany sezon liczy się jako pierwszy
  const wgRoku = new Map<number, WpisHistorii[]>();
  for (const w of historia) {
    if (!wgRoku.has(w.rok)) wgRoku.set(w.rok, []);
    wgRoku.get(w.rok)!.push(w);
  }

  for (let rok = rokPlanowany - 1; ; rok--) {
    const wpisy = wgRoku.get(rok);
    if (!wpisy || wpisy.length === 0) break;
    if (!wpisy.some((w) => w.rodzina === rodzinaPlanowana)) break;
    powtorzenia++;
    // Zabezpieczenie przed zapętleniem na danych z odległej przeszłości.
    if (powtorzenia > 50) break;
  }

  if (RODZINY_WZBOGACAJACE.has(rodzinaPlanowana) && powtorzenia === 1) {
    return null; // motylkowe po czymkolwiek innym to dobra wiadomość, nie ostrzeżenie
  }

  if (powtorzenia < 2) return null;

  const powod = RYZYKO_RODZINY[rodzinaPlanowana];
  const poziom: "info" | "warn" = powtorzenia >= PROG_OSTRZEZENIA || powod ? "warn" : "info";

  const wstep =
    powtorzenia === 2
      ? "To drugi sezon z rzędu w tym miejscu"
      : `To ${powtorzenia}. sezon z rzędu w tym miejscu`;

  const tresc = powod
    ? `${wstep} dla tej samej rodziny roślin — ${powod}. Rozważ przerwę albo inne miejsce.`
    : `${wstep} dla tej samej rodziny roślin. Zalecana przerwa co najmniej jednego sezonu.`;

  return { poziom, tresc, powtorzenia };
}

/**
 * Co poprzednio rosło w miejscu — do pokazania przy planowaniu.
 * Zwraca wpisy posortowane od najnowszego sezonu; historia bez rodziny też się liczy,
 * bo użytkownik chce ją zobaczyć nawet wtedy, gdy reguła jej nie użyje.
 */
export function historiaMiejsca(historia: WpisHistorii[], ileSezonow = 5): WpisHistorii[] {
  return [...historia].sort((a, b) => b.rok - a.rok).slice(0, ileSezonow);
}
