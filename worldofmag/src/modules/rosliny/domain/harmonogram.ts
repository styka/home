import type { Naslonecznienie, PoraRoku, WymaganiaWodne } from "../lib/typy";
import { WYMAGANIA_WODNE_DOMYSLNE } from "../lib/typy";

/**
 * 113 — REGUŁA TERMINU ZABIEGU, bez bazy, bez Reacta, bez sesji.
 *
 * **Dlaczego to nie mieszka w pliku akcji.** Plik z `"use server"` nie eksportuje funkcji
 * synchronicznych, więc zawartej w nim reguły nie da się zaimportować do testu — jest
 * niesprawdzalna, choćby była prosta (ta sama lekcja, co w modułach YouTube i Czat).
 *
 * **Co ta reguła rozstrzyga i dlaczego to jest sedno modułu.** Przegląd rynku (`badania.md` §4)
 * pokazał, że aplikacje roślinne wygrywają jedną rzeczą: harmonogram podlewania **nie jest stałą
 * z gatunku**. Liczy się go z gatunku × wielkości i nasłonecznienia miejsca × pory roku × pogody.
 * „Podlewaj co 7 dni" jest w styczniu szkodliwe (zalanie — najczęstsza przyczyna śmierci roślin
 * doniczkowych), a w lipcu spóźnione. Omnia ma tu przewagę strukturalną, bo moduł Pogoda z
 * lokalizacjami i prognozą już istnieje; konkurencja musi tę integrację dowozić.
 *
 * **Funkcja zwraca termin RAZEM z uzasadnieniem** i to nie jest ozdobnik (AC-9). Aplikacja, która
 * każe, jest posłuszna raz; aplikacja, która tłumaczy, uczy — a użytkownik, który rozumie, przestaje
 * pytać asystenta o to samo, co jest realną oszczędnością tokenów, nie tylko lepszym UX.
 *
 * Wszystko wchodzi PARAMETREM: data, prognoza, wymagania gatunku. Dzięki temu test nie potrzebuje
 * ani bazy, ani sieci, ani zegara.
 */

/**
 * Minimalny kształt prognozy, jakiego potrzebuje ta reguła.
 *
 * Świadomie **nie** importujemy `DayPoint` z modułu Pogoda: domena ma zostać czysta, a import przez
 * granicę modułu i tak byłby możliwy wyłącznie przez kontrakt. Wywołujący (akcja) przepisuje
 * prognozę na ten kształt — trzy pola zamiast dziesięciu.
 */
export interface PrognozaDobowa {
  /** YYYY-MM-DD */
  date: string;
  /** Suma opadu w mm. */
  precipSum: number;
  /** Minimalna temperatura dobowa (°C) — do ostrzeżenia o przymrozku. */
  tMin: number;
  /** Maksymalna temperatura dobowa (°C) — do skrócenia odstępu w upale. */
  tMax: number;
}

export interface WejscieTerminu {
  /** Od kiedy liczymy — zwykle moment faktycznego wykonania zabiegu, nie planowany termin. */
  od: Date;
  /** Wymagania wodne gatunku (cztery liczby). Brak = wartości domyślne. */
  wymagania?: WymaganiaWodne | null;
  /** Nasłonecznienie MIEJSCA, w którym stoi roślina. */
  naslonecznienie?: Naslonecznienie | null;
  /** Prognoza na najbliższe dni; pusta lista = liczymy bez korekty pogodowej. */
  prognoza?: PrognozaDobowa[];
  /** Czy przestrzeń jest pod dachem. Deszcz nie podleje rośliny stojącej w mieszkaniu. */
  podDachem?: boolean;
}

export interface WynikTerminu {
  /** Kiedy zabieg wypada. */
  termin: Date;
  /** Jedno zdanie po polsku: dlaczego akurat wtedy (AC-9). */
  uzasadnienie: string;
  /** Ostrzeżenie niezależne od terminu (np. przymrozek). `null`, gdy nie ma o czym mówić. */
  ostrzezenie: string | null;
}

const DZIEN_MS = 24 * 60 * 60 * 1000;

/** Opad, od którego uznajemy, że deszcz zastąpił podlanie. Poniżej — zwilża liście, nie glebę. */
export const PROG_OPADU_MM = 5;

/** Odsunięcie po deszczu w dniach. */
const ODSUNIECIE_PO_DESZCZU = 2;

/** Od tej temperatury maksymalnej skracamy odstęp — parowanie rośnie nieliniowo. */
export const PROG_UPALU_C = 27;

/** Poniżej tej temperatury minimalnej ostrzegamy o przymrozku. */
export const PROG_PRZYMROZKU_C = 2;

/**
 * Pora roku z daty. Liczona, nie przechowywana — przechowywana zdezaktualizowałaby się sama
 * i to w sposób niewidoczny (rekord z zeszłego roku wyglądałby na aktualny).
 */
export function poraRoku(data: Date): PoraRoku {
  const m = data.getMonth(); // 0 = styczeń
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

const NAZWA_PORY: Record<PoraRoku, string> = {
  winter: "zima",
  spring: "wiosna",
  summer: "lato",
  autumn: "jesień",
};

/**
 * Mnożnik odstępu wynikający z nasłonecznienia MIEJSCA.
 *
 * W pełnym słońcu podłoże wysycha szybciej, w cieniu wolniej. To jest cecha miejsca, nie rośliny —
 * ta sama monstera na parapecie południowym i w głębi pokoju potrzebuje innego odstępu, i właśnie
 * dlatego miejsce jest w tym module osobnym bytem.
 */
function mnoznikSwiatla(n: Naslonecznienie | null | undefined): number {
  switch (n) {
    case "full":
      return 0.8;
    case "shade":
      return 1.25;
    case "partial":
    case "unknown":
    default:
      return 1;
  }
}

/**
 * Czy w najbliższych dniach spadnie na tyle deszczu, żeby odsunąć podlewanie.
 * Zwraca sumę opadu w oknie albo `null`, gdy nie ma prognozy albo roślina stoi pod dachem.
 */
function opadWOknie(wejscie: WejscieTerminu, dni: number): number | null {
  if (wejscie.podDachem) return null;
  const prognoza = wejscie.prognoza ?? [];
  if (prognoza.length === 0) return null;
  const okno = prognoza.slice(0, Math.max(1, Math.min(dni, prognoza.length)));
  return okno.reduce((suma, d) => suma + (Number.isFinite(d.precipSum) ? d.precipSum : 0), 0);
}

/** Najbliższy dzień z prognozy, w którym grozi przymrozek. */
function dzienPrzymrozku(wejscie: WejscieTerminu): PrognozaDobowa | null {
  if (wejscie.podDachem) return null;
  return (wejscie.prognoza ?? []).find((d) => d.tMin <= PROG_PRZYMROZKU_C) ?? null;
}

/**
 * Termin następnego podlewania wraz z uzasadnieniem.
 *
 * Kolejność korekt jest istotna i celowa: **najpierw gatunek i pora roku** (to jest podstawa),
 * potem **miejsce**, na końcu **pogoda**. Odwrotna kolejność dałaby ten sam wynik liczbowo, ale
 * uzasadnienie mówiłoby o pogodzie także wtedy, gdy realnie zadecydowała pora roku — a zdanie,
 * które podaje nieprawdziwy powód, jest gorsze niż brak zdania.
 */
export function terminPodlewania(wejscie: WejscieTerminu): WynikTerminu {
  const wymagania = wejscie.wymagania ?? WYMAGANIA_WODNE_DOMYSLNE;
  const pora = poraRoku(wejscie.od);
  const bazowy = Math.max(1, wymagania[pora] ?? WYMAGANIA_WODNE_DOMYSLNE[pora]);

  const powody: string[] = [`${NAZWA_PORY[pora]} — odstęp podstawowy ${bazowy} dni`];

  let dni = bazowy * mnoznikSwiatla(wejscie.naslonecznienie);
  if (wejscie.naslonecznienie === "full") powody.push("stanowisko słoneczne skraca odstęp");
  if (wejscie.naslonecznienie === "shade") powody.push("stanowisko zacienione wydłuża odstęp");

  // Upał liczymy z okna równego dotychczas wyliczonemu odstępowi — pytanie brzmi „czy w czasie,
  // przez który roślina ma wytrzymać, będzie gorąco", a nie „czy jutro jest gorąco".
  const oknoDni = Math.max(1, Math.round(dni));
  const prognoza = wejscie.prognoza ?? [];
  const upalne = prognoza.slice(0, oknoDni).filter((d) => d.tMax >= PROG_UPALU_C).length;
  if (upalne >= 2) {
    dni = dni * 0.75;
    powody.push(`zapowiadany upał (${upalne} dni powyżej ${PROG_UPALU_C}°C)`);
  }

  let termin = new Date(wejscie.od.getTime() + Math.round(dni) * DZIEN_MS);

  const opad = opadWOknie(wejscie, oknoDni);
  if (opad !== null && opad >= PROG_OPADU_MM) {
    termin = new Date(termin.getTime() + ODSUNIECIE_PO_DESZCZU * DZIEN_MS);
    powody.push(`zapowiadany opad ${Math.round(opad)} mm odsuwa termin o ${ODSUNIECIE_PO_DESZCZU} dni`);
  }

  const mroz = dzienPrzymrozku(wejscie);

  return {
    termin,
    uzasadnienie: powody.join("; "),
    ostrzezenie: mroz
      ? `Przymrozek ${mroz.date} (${Math.round(mroz.tMin)}°C) — rozważ okrycie lub wniesienie roślin.`
      : null,
  };
}

/**
 * Termin dla zabiegu powtarzalnego, który NIE jest podlewaniem (nawożenie, przycinanie, oprysk).
 *
 * Tu pogoda nie skraca odstępu — nawożenie co dwa tygodnie ma być co dwa tygodnie. Zostaje jednak
 * ostrzeżenie o przymrozku, bo dotyczy każdego wyjścia do ogrodu, nie tylko podlewania.
 */
export function terminCykliczny(od: Date, coIleDni: number, wejscie?: Pick<WejscieTerminu, "prognoza" | "podDachem">): WynikTerminu {
  const dni = Math.max(1, Math.round(coIleDni));
  const mroz = dzienPrzymrozku({ od, ...wejscie });
  return {
    termin: new Date(od.getTime() + dni * DZIEN_MS),
    uzasadnienie: `powtarzalny zabieg co ${dni} dni, liczony od ostatniego wykonania`,
    ostrzezenie: mroz
      ? `Przymrozek ${mroz.date} (${Math.round(mroz.tMin)}°C) — rozważ okrycie lub wniesienie roślin.`
      : null,
  };
}
