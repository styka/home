// Wspólna logika skórek (motywów): lista sterowalnych zmiennych CSS, walidacja
// (bezpieczne aplikowanie inline na <html>), domyślne wartości i zestaw kontrolek
// dla edytora. Skórka = częściowa mapa { "--zmienna": "wartość" } — pominięte
// zmienne dziedziczą domyślne (ciemne) wartości z globals.css.
//
// 045: skórka przestaje być mapą kolorów. Doszły rodziny tokenów opisujące
// typografię, gęstość, obramowania, cienie, tło, ruch i chrom powłoki — bez nich
// nie da się wyrazić motywu o wyrazistym charakterze, a o to prosił właściciel.
// Schemat bazy się NIE zmienił: `Skin.tokens` to JSON, więc rozszerzenie whitelisty
// wystarcza.

export type SkinTokens = Record<string, string>;

/** Rodzaj tokenu — decyduje o kontrolce w edytorze ORAZ o regule sanityzacji.
 *  `String` + unia TS zamiast enuma (C-12). */
export type SkinControlKind =
  | "color"
  | "radius"
  | "density"
  | "scheme"
  | "length"
  | "number"
  | "font"
  | "weight"
  | "tracking"
  | "shadow"
  | "background"
  | "duration"
  | "easing"
  | "keyword";

export interface SkinControl {
  key: string;
  label: string;
  hint?: string;
  kind: SkinControlKind;
  /** Wymagane dla `kind: "keyword"` i `kind: "font"` — zamknięta lista dopuszczalnych wartości. */
  options?: { value: string; label: string }[];
  /** Grupa w edytorze (045) — pozwala pokazać rodziny tokenów jako sekcje. */
  group?: SkinGroup;
}

/** Sekcje edytora skórki. */
export type SkinGroup =
  | "kolory"
  | "typografia"
  | "gestosc"
  | "zaokraglenia"
  | "obramowania"
  | "cienie"
  | "tlo"
  | "ruch"
  | "chrom";

export const SKIN_GROUP_LABELS: Record<SkinGroup, string> = {
  kolory: "Kolory",
  typografia: "Typografia",
  gestosc: "Gęstość i odstępy",
  zaokraglenia: "Zaokrąglenia",
  obramowania: "Obramowania",
  cienie: "Cienie i poświaty",
  tlo: "Tło",
  ruch: "Ruch",
  chrom: "Chrom powłoki",
};

// ─── Czcionki ────────────────────────────────────────────────────────────────
//
// `--font-family-*` NIE jest dowolnym tekstem, tylko słowem kluczowym z zamkniętej
// listy. Dwa powody: (1) dowolny `font-family` to najtrudniejszy do sanityzacji
// token — cudzysłowy i przecinki są w nim legalne, więc każda reguła jest albo
// dziurawa, albo bezużyteczna; (2) wszystkie stosy są systemowe, więc skórka nie
// powoduje żadnego żądania do sieci (brak spowolnienia i brak śledzenia).

export const FONT_STACKS: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", Consolas, Monaco, monospace',
  serif: 'Georgia, "Times New Roman", "Noto Serif", serif',
  condensed: '"Avenir Next Condensed", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif',
  rounded: '"SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif',
};

const FONT_OPTIONS = [
  { value: "system", label: "Systemowa" },
  { value: "mono", label: "Maszynowa" },
  { value: "serif", label: "Szeryfowa" },
  { value: "condensed", label: "Zwężona" },
  { value: "rounded", label: "Zaokrąglona" },
];

/** Słowo kluczowe czcionki → konkretny stos. Nieznane słowo → stos systemowy. */
export function fontStack(keyword: string): string {
  return FONT_STACKS[keyword] ?? FONT_STACKS.system;
}

/** Domyślne (ciemne) wartości — odzwierciedlają :root w globals.css. Używane jako
 *  baza w edytorze i do złożenia pełnej palety w podglądzie. */
export const DEFAULT_DARK_TOKENS: SkinTokens = {
  // kolory
  "--color-scheme": "dark",
  "--bg-base": "#0d0d0d",
  "--bg-surface": "#141414",
  "--bg-elevated": "#1c1c1c",
  "--bg-hover": "#242424",
  "--border": "#2a2a2a",
  "--border-focus": "#444444",
  "--text-primary": "#e8e8e8",
  "--text-secondary": "#888888",
  "--text-muted": "#808080",
  "--on-accent": "#ffffff",
  "--accent-blue": "#3b82f6",
  "--accent-blue-dim": "#1d4ed8",
  "--accent-green": "#22c55e",
  "--accent-green-dim": "#15803d",
  "--accent-red": "#ef4444",
  "--accent-red-dim": "#b91c1c",
  "--accent-amber": "#f59e0b",
  "--accent-amber-dim": "#b45309",
  "--accent-purple": "#a855f7",
  "--accent-orange": "#ff8a3d",
  "--accent-orange-dim": "#c2410c",
  // typografia
  "--font-family-base": "system",
  "--font-family-mono": "mono",
  "--font-family-display": "system",
  "--font-size-base": "14px",
  "--font-weight-heading": "700",
  "--letter-spacing-base": "0em",
  "--letter-spacing-heading": "0em",
  "--text-transform-heading": "none",
  "--line-height-base": "1.5",
  // gęstość i odstępy
  "--space-unit": "4px",
  "--control-height": "32px",
  "--view-padding": "16px",
  // zaokrąglenia
  "--radius": "6px",
  "--radius-lg": "10px",
  "--radius-pill": "999px",
  "--radius-control": "6px",
  // obramowania
  "--border-width": "1px",
  "--border-style": "solid",
  "--focus-ring-width": "2px",
  // cienie
  "--shadow-surface": "none",
  "--shadow-elevated": "0 4px 16px rgba(0,0,0,0.4)",
  "--shadow-glow": "none",
  // tło
  "--bg-image-base": "none",
  "--bg-image-surface": "none",
  // ruch
  "--motion-duration": "100ms",
  "--motion-duration-slow": "220ms",
  "--motion-easing": "ease",
  // chrom powłoki
  "--sidebar-width": "220px",
  "--chrome-bg": "#141414",
  "--chrome-border": "#2a2a2a",
  "--chrome-frame": "none",
};

/** Kurowane kontrolki — domyślnie widoczne w edytorze (proste, mało parametrów). */
export const CURATED_CONTROLS: SkinControl[] = [
  { key: "--color-scheme", label: "Schemat", kind: "scheme", group: "kolory", hint: "Wpływa na natywne kontrolki (kalendarz, pola)" },
  { key: "--bg-base", label: "Tło", kind: "color", group: "kolory" },
  { key: "--bg-surface", label: "Powierzchnia", kind: "color", group: "kolory", hint: "Karty, panele" },
  { key: "--text-primary", label: "Tekst główny", kind: "color", group: "kolory" },
  { key: "--text-secondary", label: "Tekst drugorzędny", kind: "color", group: "kolory" },
  { key: "--border", label: "Obramowanie", kind: "color", group: "kolory" },
  { key: "--accent-blue", label: "Akcent główny", kind: "color", group: "kolory", hint: "Przyciski, linki, aktywne elementy" },
  { key: "--accent-green", label: "Akcent — sukces", kind: "color", group: "kolory" },
  { key: "--accent-red", label: "Akcent — uwaga", kind: "color", group: "kolory" },
  { key: "--on-accent", label: "Tekst na akcencie", kind: "color", group: "kolory", hint: "Kolor tekstu na kolorowych przyciskach" },
  { key: "--font-family-base", label: "Czcionka", kind: "font", group: "typografia", options: FONT_OPTIONS },
  { key: "--font-family-display", label: "Czcionka nagłówków", kind: "font", group: "typografia", options: FONT_OPTIONS },
  { key: "--font-size-base", label: "Gęstość", kind: "density", group: "typografia" },
  { key: "--radius", label: "Zaokrąglenie", kind: "radius", group: "zaokraglenia" },
];

/** Pozostałe zmienne — w sekcji „Zaawansowane". */
export const ADVANCED_CONTROLS: SkinControl[] = [
  // kolory
  { key: "--bg-elevated", label: "Powierzchnia wyniesiona", kind: "color", group: "kolory" },
  { key: "--bg-hover", label: "Tło hover", kind: "color", group: "kolory" },
  { key: "--border-focus", label: "Obramowanie aktywne", kind: "color", group: "kolory" },
  { key: "--text-muted", label: "Tekst wyciszony", kind: "color", group: "kolory" },
  { key: "--accent-blue-dim", label: "Akcent główny (ciemny)", kind: "color", group: "kolory" },
  { key: "--accent-green-dim", label: "Akcent sukces (ciemny)", kind: "color", group: "kolory" },
  { key: "--accent-red-dim", label: "Akcent uwaga (ciemny)", kind: "color", group: "kolory" },
  { key: "--accent-amber", label: "Akcent — ostrzeżenie", kind: "color", group: "kolory" },
  { key: "--accent-amber-dim", label: "Akcent ostrzeżenie (ciemny)", kind: "color", group: "kolory" },
  { key: "--accent-purple", label: "Akcent — fiolet", kind: "color", group: "kolory" },
  { key: "--accent-orange", label: "Akcent — pomarańcz", kind: "color", group: "kolory" },
  { key: "--accent-orange-dim", label: "Akcent pomarańcz (ciemny)", kind: "color", group: "kolory" },
  // typografia
  { key: "--font-family-mono", label: "Czcionka maszynowa", kind: "font", group: "typografia", options: FONT_OPTIONS },
  { key: "--font-weight-heading", label: "Grubość nagłówków", kind: "weight", group: "typografia" },
  { key: "--letter-spacing-base", label: "Rozstrzelenie tekstu", kind: "tracking", group: "typografia" },
  { key: "--letter-spacing-heading", label: "Rozstrzelenie nagłówków", kind: "tracking", group: "typografia" },
  {
    key: "--text-transform-heading",
    label: "Nagłówki wersalikami",
    kind: "keyword",
    group: "typografia",
    options: [
      { value: "none", label: "Normalnie" },
      { value: "uppercase", label: "WERSALIKI" },
    ],
  },
  { key: "--line-height-base", label: "Interlinia", kind: "number", group: "typografia" },
  // gęstość
  { key: "--space-unit", label: "Jednostka odstępu", kind: "length", group: "gestosc" },
  { key: "--control-height", label: "Wysokość kontrolek", kind: "length", group: "gestosc", hint: "Cel dotyku — nie schodź poniżej 32px" },
  { key: "--view-padding", label: "Margines widoku", kind: "length", group: "gestosc" },
  // zaokrąglenia
  { key: "--radius-lg", label: "Zaokrąglenie (duże)", kind: "radius", group: "zaokraglenia" },
  { key: "--radius-pill", label: "Zaokrąglenie pigułkowe", kind: "radius", group: "zaokraglenia" },
  { key: "--radius-control", label: "Zaokrąglenie kontrolek", kind: "radius", group: "zaokraglenia" },
  // obramowania
  { key: "--border-width", label: "Grubość obramowania", kind: "length", group: "obramowania" },
  {
    key: "--border-style",
    label: "Styl obramowania",
    kind: "keyword",
    group: "obramowania",
    options: [
      { value: "solid", label: "Ciągłe" },
      { value: "dashed", label: "Kreskowane" },
      { value: "dotted", label: "Kropkowane" },
      { value: "none", label: "Brak" },
    ],
  },
  { key: "--focus-ring-width", label: "Grubość obwódki fokusu", kind: "length", group: "obramowania" },
  // cienie
  { key: "--shadow-surface", label: "Cień powierzchni", kind: "shadow", group: "cienie" },
  { key: "--shadow-elevated", label: "Cień wyniesiony", kind: "shadow", group: "cienie" },
  { key: "--shadow-glow", label: "Poświata akcentu", kind: "shadow", group: "cienie" },
  // tło
  { key: "--bg-image-base", label: "Tło aplikacji", kind: "background", group: "tlo", hint: "Gradient CSS — bez plików graficznych" },
  { key: "--bg-image-surface", label: "Tło powierzchni", kind: "background", group: "tlo" },
  // ruch
  { key: "--motion-duration", label: "Czas przejścia", kind: "duration", group: "ruch" },
  { key: "--motion-duration-slow", label: "Czas przejścia (wolne)", kind: "duration", group: "ruch" },
  { key: "--motion-easing", label: "Krzywa ruchu", kind: "easing", group: "ruch" },
  // chrom powłoki
  { key: "--sidebar-width", label: "Szerokość nawigacji", kind: "length", group: "chrom" },
  { key: "--chrome-bg", label: "Tło powłoki", kind: "color", group: "chrom", hint: "Nawigacja, paski" },
  { key: "--chrome-border", label: "Obramowanie powłoki", kind: "color", group: "chrom" },
  {
    key: "--chrome-frame",
    label: "Ramki narożne",
    kind: "keyword",
    group: "chrom",
    options: [
      { value: "none", label: "Brak" },
      { value: "corners", label: "Narożniki" },
    ],
  },
];

export const ALL_CONTROLS: SkinControl[] = [...CURATED_CONTROLS, ...ADVANCED_CONTROLS];

/** Whitelista kluczy, które wolno nadpisać przez skórkę. */
export const ALLOWED_TOKEN_KEYS = new Set(ALL_CONTROLS.map((c) => c.key));

/** Opcje gęstości (rozmiar bazowy tekstu). */
export const DENSITY_OPTIONS: { value: string; label: string }[] = [
  { value: "13px", label: "Kompaktowa" },
  { value: "14px", label: "Standardowa" },
  { value: "15px", label: "Luźna" },
];

// ─── Sanityzacja ─────────────────────────────────────────────────────────────
//
// Wartości tokenów trafiają do atrybutu `style` na <html>, więc są to DANE
// WSTRZYKIWANE DO CSS. Skórkę można zaimportować z pliku (045), czyli źródło bywa
// obce. Reguła: najpierw globalna lista znaków/sekwencji zabronionych ZAWSZE,
// potem wąska reguła zależna od rodzaju tokenu.
//
// Świadomie NIE luzujemy globalnej blokady po to, żeby przepuścić gradienty —
// zamiast tego każdy rodzaj, który potrzebuje nawiasów, ma własną whitelistę
// dozwolonych funkcji.

/** Sekwencje, które nie mają prawa pojawić się w ŻADNEJ wartości tokenu. */
const FORBIDDEN = [";", "{", "}", "<", ">", '"', "'", "\\", "/*", "*/", "url(", "image(", "expression", "@", "javascript:", "//"];

const COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/;
// Zaokrąglenia i gęstość ZOSTAJĄ wąskie: tylko `px` i najwyżej trzy cyfry. Promień w `em`
// skaluje się z tekstem (pułapka), a `1000px` to nie zaokrąglenie, tylko awaria układu.
const SIZE_RE = /^(?:0|\d{1,3}(?:\.\d+)?px)$/;
// Odstępy i wymiary mogą być względne — `--view-padding: 1.5rem` jest sensowne.
const LENGTH_RE = /^(?:0|\d{1,4}(?:\.\d+)?(?:px|rem|em))$/;
const TRACKING_RE = /^-?(?:0|\d{1,2}(?:\.\d+)?)(?:em|px)$/;
const NUMBER_RE = /^\d{1,2}(?:\.\d+)?$/;
const WEIGHT_RE = /^(?:100|200|300|400|500|600|700|800|900)$/;
const DURATION_RE = /^\d{1,4}(?:\.\d+)?m?s$/;
const CUBIC_RE = /^cubic-bezier\(\s*-?\d?\.?\d+\s*,\s*-?\d?\.?\d+\s*,\s*-?\d?\.?\d+\s*,\s*-?\d?\.?\d+\s*\)$/;
const EASING_KEYWORDS = new Set(["linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end"]);

/** Funkcje dozwolone w tle. `none` obsługiwane osobno. */
const BACKGROUND_FNS = ["linear-gradient(", "radial-gradient(", "repeating-linear-gradient(", "repeating-radial-gradient(", "conic-gradient("];
/** Funkcje dozwolone w cieniu. */
const SHADOW_FNS = ["rgba(", "rgb(", "hsl(", "hsla(", "color-mix("];

/** Znaki dopuszczalne w wartościach złożonych (gradient/cień) — po sprawdzeniu funkcji. */
const COMPOSITE_CHARS_RE = /^[0-9a-zA-Z#%.,()\s/_-]+$/;

/** Limit długości wartości, zależny od rodzaju. Gradient bywa długi z natury. */
function maxLengthFor(kind: SkinControlKind): number {
  if (kind === "background") return 240;
  if (kind === "shadow") return 160;
  return 64;
}

/** Czy wartość złożona używa wyłącznie dozwolonych funkcji?
 *  Każde wystąpienie `(` musi być poprzedzone nazwą z whitelisty. */
function usesOnlyAllowedFns(value: string, allowed: string[]): boolean {
  let idx = value.indexOf("(");
  while (idx !== -1) {
    const head = value.slice(0, idx + 1);
    if (!allowed.some((fn) => head.endsWith(fn))) return false;
    idx = value.indexOf("(", idx + 1);
  }
  return true;
}

/** Sanityzacja pojedynczej wartości tokenu wg jego rodzaju. Zwraca bezpieczną
 *  wartość lub null (odrzucenie). Chroni przed wstrzyknięciem do inline style. */
export function sanitizeTokenValue(key: string, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;

  const control = ALL_CONTROLS.find((c) => c.key === key);
  if (!control) return null;

  if (v.length > maxLengthFor(control.kind)) return null;

  // Globalna blokada — obowiązuje KAŻDY rodzaj, także złożone.
  const lower = v.toLowerCase();
  if (FORBIDDEN.some((bad) => lower.includes(bad))) return null;

  switch (control.kind) {
    case "scheme":
      return v === "light" || v === "dark" ? v : null;

    case "keyword":
    case "font":
      return control.options?.some((o) => o.value === v) ? v : null;

    case "radius":
    case "density":
      return SIZE_RE.test(v) ? v : null;

    case "length":
      return LENGTH_RE.test(v) ? v : null;

    case "tracking":
      return TRACKING_RE.test(v) ? v : null;

    case "number":
      return NUMBER_RE.test(v) ? v : null;

    case "weight":
      return WEIGHT_RE.test(v) ? v : null;

    case "duration":
      return DURATION_RE.test(v) ? v : null;

    case "easing":
      if (EASING_KEYWORDS.has(v)) return v;
      return CUBIC_RE.test(v) ? v : null;

    case "background":
      if (v === "none") return v;
      if (!COMPOSITE_CHARS_RE.test(v)) return null;
      return usesOnlyAllowedFns(v, BACKGROUND_FNS) ? v : null;

    case "shadow":
      if (v === "none") return v;
      if (!COMPOSITE_CHARS_RE.test(v)) return null;
      return usesOnlyAllowedFns(v, SHADOW_FNS) ? v : null;

    case "color":
      return COLOR_RE.test(v) ? v : null;
  }
}

/** Waliduje surową mapę tokenów (np. z DB lub formularza) → bezpieczna mapa. */
export function validateTokens(raw: unknown): SkinTokens {
  const out: SkinTokens = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_TOKEN_KEYS.has(k)) continue;
    const safe = sanitizeTokenValue(k, val);
    if (safe !== null) out[k] = safe;
  }
  return out;
}

/** Parsuje JSON tokenów z DB do bezpiecznej mapy. */
export function parseTokens(json: string | null | undefined): SkinTokens {
  if (!json) return {};
  try {
    return validateTokens(JSON.parse(json));
  } catch {
    return {};
  }
}

/** Pełna paleta = domyślne ciemne wartości nadpisane tokenami skórki. */
export function resolveTokens(tokens: SkinTokens): SkinTokens {
  return { ...DEFAULT_DARK_TOKENS, ...tokens };
}

/** Rodzaj tokenu po kluczu — potrzebny przy tłumaczeniu wartości na CSS. */
function kindOf(key: string): SkinControlKind | null {
  return ALL_CONTROLS.find((c) => c.key === key)?.kind ?? null;
}

/** Mapa tokenów → obiekt stylu Reacta (klucze CSS custom properties).
 *
 *  Tokeny czcionek są przechowywane jako SŁOWO KLUCZOWE (`serif`), a do CSS musi
 *  trafić pełny stos — tłumaczenie zachodzi tutaj, w jednym miejscu, żeby żaden
 *  konsument nie musiał o nim pamiętać. */
export function tokensToStyle(tokens: SkinTokens): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens)) {
    style[k] = kindOf(k) === "font" ? fontStack(v) : v;
  }
  return style as React.CSSProperties;
}

export const SYSTEM_DARK_SKIN_ID = "skin-system-dark";
