import { ALLOWED_TOKEN_KEYS } from "@/lib/skins";

/**
 * 081 (Z10): WARSTWA MAPOWANIA między odpowiedzią modelu a tokenami skórki.
 *
 * Po co istnieje. Generator skórek czytał tokeny z JEDNEGO miejsca (`parsed.tokens`) i porównywał
 * klucze DOKŁADNIE z katalogiem. Każde odstępstwo modelu od tego jednego kształtu dawało zero
 * tokenów i komunikat „model nie odesłał żadnych tokenów" — nieprawdziwy, bo model odsyłał je
 * regularnie, tylko inaczej opakowane. Zgłoszenie właściciela („AI powinno poradzić sobie
 * z dopasowaniem elementów aplikacji do intencji usera") dotyczy dokładnie tej luki: między
 * modelem a aplikacją nie było niczego, co tłumaczy jedno na drugie.
 *
 * Czego NIE robi: nie rozluźnia walidacji. `validateTokens` zostaje nietknięte i dalej jest
 * bramką bezpieczeństwa (wstrzyknięcie CSS). Ta warstwa tylko DOPROWADZA dane do postaci, na
 * której walidacja może się w ogóle wypowiedzieć — zamiast odrzucać wszystko na kształcie.
 *
 * Cztery rzeczy, które model robi inaczej, a które mają jedno znaczenie:
 *  1. **Inny pojemnik** — `tokens`, `variables`, `cssVariables`, `theme`, albo płasko na wierzchu.
 *  2. **Tablica zamiast mapy** — `[{ "name": "--bg-base", "value": "#0b1020" }, …]`.
 *  3. **Inna konwencja klucza** — `bg-base`, `bgBase`, `--BG-Base` zamiast `--bg-base`.
 *  4. **Liczba zamiast napisu** — `"--font-weight-heading": 700`. W JSON-ie to liczba, w CSS napis;
 *     `sanitizeTokenValue` odrzuca wszystko, co nie jest napisem, więc taki token ginął po cichu.
 */

/** Klucze, pod którymi modele opakowują mapę tokenów. Kolejność nie ma znaczenia — wybieramy najlepszy. */
const POJEMNIKI = ["tokens", "variables", "cssVariables", "css", "cssVars", "theme", "skin", "styles", "values"];

/** Nazwy pola z nazwą tokenu, gdy model odesłał TABLICĘ par zamiast mapy. */
const POLA_NAZWY = ["name", "key", "token", "variable", "property", "var"];
/** Nazwy pola z wartością w tej samej sytuacji. */
const POLA_WARTOSCI = ["value", "val", "wartosc", "wartość"];

export interface WynikMapowania {
  /** Znormalizowana mapa gotowa dla `validateTokens`. */
  tokeny: Record<string, string>;
  /** Skąd je wzięliśmy — do komunikatu diagnostycznego, nie do logiki. */
  zrodlo: string;
  /** Klucze, których nie ma w katalogu — model coś odesłał, ale nie to. */
  nieznane: string[];
}

/**
 * Doprowadza klucz do postaci katalogowej: `bgBase` → `--bg-base`, `BG-Base` → `--bg-base`.
 *
 * Małe litery na końcu, bo katalog jest w całości małymi literami, a model bywa niekonsekwentny
 * w obrębie jednej odpowiedzi (`--bg-base` obok `--Text-Primary`).
 */
export function znormalizujKlucz(surowy: string): string {
  let k = surowy.trim().replace(/^["'`]|["'`]$/g, "").trim();
  if (!k) return "";
  // camelCase → kebab-case. Robimy to PRZED dodaniem prefiksu, żeby `--bgBase` też się poprawiło.
  k = k.replace(/^--/, "");
  k = k.replace(/([a-z0-9])([A-Z])/g, "$1-$2");
  k = k.toLowerCase().replace(/[\s_]+/g, "-");
  return `--${k}`;
}

/**
 * Doprowadza wartość do napisu. JSON ma liczby i wartości logiczne, CSS nie ma — a walidator
 * przyjmuje wyłącznie napisy, więc bez tego `"--font-weight-heading": 700` ginęło bez śladu.
 * Wartości złożone (obiekt, tablica, null) odrzucamy tutaj: nie ma sensownego tłumaczenia.
 */
export function znormalizujWartosc(surowa: unknown): string | null {
  if (typeof surowa === "string") return surowa.trim() || null;
  if (typeof surowa === "number" && Number.isFinite(surowa)) return String(surowa);
  if (typeof surowa === "boolean") return String(surowa);
  return null;
}

/** Zamienia dowolny kandydat (mapa albo tablica par) na płaską mapę surowych par. */
function naPary(kandydat: unknown): Record<string, unknown> | null {
  if (!kandydat || typeof kandydat !== "object") return null;

  if (Array.isArray(kandydat)) {
    const out: Record<string, unknown> = {};
    for (const wpis of kandydat) {
      if (!wpis || typeof wpis !== "object" || Array.isArray(wpis)) continue;
      const rec = wpis as Record<string, unknown>;
      const nazwa = POLA_NAZWY.map((p) => rec[p]).find((v) => typeof v === "string") as string | undefined;
      const wartosc = POLA_WARTOSCI.map((p) => rec[p]).find((v) => v !== undefined);
      if (nazwa && wartosc !== undefined) out[nazwa] = wartosc;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  return kandydat as Record<string, unknown>;
}

/** Normalizuje pary i dzieli je na znane katalogowi i nieznane. */
function przetworz(pary: Record<string, unknown>): { znane: Record<string, string>; nieznane: string[] } {
  const znane: Record<string, string> = {};
  const nieznane: string[] = [];
  for (const [surowyKlucz, surowaWartosc] of Object.entries(pary)) {
    const klucz = znormalizujKlucz(surowyKlucz);
    const wartosc = znormalizujWartosc(surowaWartosc);
    if (!klucz || wartosc === null) continue;
    if (ALLOWED_TOKEN_KEYS.has(klucz)) znane[klucz] = wartosc;
    else nieznane.push(surowyKlucz);
  }
  return { znane, nieznane };
}

/**
 * Znajduje mapę tokenów w odpowiedzi modelu, gdziekolwiek ją umieścił.
 *
 * Wybieramy kandydata, który daje NAJWIĘCEJ rozpoznanych tokenów — a nie pierwszego napotkanego.
 * To istotne: model potrafi odesłać i `tokens`, i płaską kopię na wierzchu, a jedna z nich bywa
 * kadłubkowa. Liczy się ta, z której da się złożyć skórkę.
 */
export function wyodrebnijTokeny(parsed: unknown): WynikMapowania {
  const pusty: WynikMapowania = { tokeny: {}, zrodlo: "brak", nieznane: [] };
  if (!parsed || typeof parsed !== "object") return pusty;

  const korzen = parsed as Record<string, unknown>;
  const kandydaci: Array<{ zrodlo: string; pary: Record<string, unknown> }> = [];

  for (const nazwa of POJEMNIKI) {
    const pary = naPary(korzen[nazwa]);
    if (pary) kandydaci.push({ zrodlo: nazwa, pary });
  }
  // Korzeń na końcu: model, który wypisał tokeny płasko, obok pól `name`/`description`.
  const paryKorzenia = naPary(korzen);
  if (paryKorzenia) kandydaci.push({ zrodlo: "korzeń", pary: paryKorzenia });

  let najlepszy: WynikMapowania = pusty;
  for (const { zrodlo, pary } of kandydaci) {
    const { znane, nieznane } = przetworz(pary);
    const ile = Object.keys(znane).length;
    if (ile > Object.keys(najlepszy.tokeny).length) {
      najlepszy = { tokeny: znane, zrodlo, nieznane };
    }
  }

  // Żaden kandydat nie dał znanego tokenu — do komunikatu diagnostycznego oddajemy to, co model
  // w ogóle przysłał, żeby dało się powiedzieć „przysłał N kluczy, żaden nie pasuje" zamiast
  // „nie przysłał nic".
  if (Object.keys(najlepszy.tokeny).length === 0) {
    const zPojemnika = kandydaci.find((k) => Object.keys(k.pary).length > 0);
    if (zPojemnika) {
      const { nieznane } = przetworz(zPojemnika.pary);
      return { tokeny: {}, zrodlo: zPojemnika.zrodlo, nieznane };
    }
  }
  return najlepszy;
}
