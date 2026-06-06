// Wspólna logika skórek (motywów): lista sterowalnych zmiennych CSS, walidacja
// (bezpieczne aplikowanie inline na <html>), domyślne wartości i zestaw kontrolek
// dla edytora. Skórka = częściowa mapa { "--zmienna": "wartość" } — pominięte
// zmienne dziedziczą domyślne (ciemne) wartości z globals.css.

export type SkinTokens = Record<string, string>;

export type SkinControlKind = "color" | "radius" | "density" | "scheme";

export interface SkinControl {
  key: string;
  label: string;
  hint?: string;
  kind: SkinControlKind;
}

/** Domyślne (ciemne) wartości — odzwierciedlają :root w globals.css. Używane jako
 *  baza w edytorze i do złożenia pełnej palety w podglądzie. */
export const DEFAULT_DARK_TOKENS: SkinTokens = {
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
  "--radius": "6px",
  "--radius-lg": "10px",
  "--font-size-base": "14px",
};

/** Kurowane kontrolki — domyślnie widoczne w edytorze (proste, mało parametrów). */
export const CURATED_CONTROLS: SkinControl[] = [
  { key: "--color-scheme", label: "Schemat", kind: "scheme", hint: "Wpływa na natywne kontrolki (kalendarz, pola)" },
  { key: "--bg-base", label: "Tło", kind: "color" },
  { key: "--bg-surface", label: "Powierzchnia", kind: "color", hint: "Karty, panele" },
  { key: "--text-primary", label: "Tekst główny", kind: "color" },
  { key: "--text-secondary", label: "Tekst drugorzędny", kind: "color" },
  { key: "--border", label: "Obramowanie", kind: "color" },
  { key: "--accent-blue", label: "Akcent główny", kind: "color", hint: "Przyciski, linki, aktywne elementy" },
  { key: "--accent-green", label: "Akcent — sukces", kind: "color" },
  { key: "--accent-red", label: "Akcent — uwaga", kind: "color" },
  { key: "--on-accent", label: "Tekst na akcencie", kind: "color", hint: "Kolor tekstu na kolorowych przyciskach" },
  { key: "--radius", label: "Zaokrąglenie", kind: "radius" },
  { key: "--font-size-base", label: "Gęstość", kind: "density" },
];

/** Pozostałe zmienne — w sekcji „Zaawansowane". */
export const ADVANCED_CONTROLS: SkinControl[] = [
  { key: "--bg-elevated", label: "Powierzchnia wyniesiona", kind: "color" },
  { key: "--bg-hover", label: "Tło hover", kind: "color" },
  { key: "--border-focus", label: "Obramowanie aktywne", kind: "color" },
  { key: "--text-muted", label: "Tekst wyciszony", kind: "color" },
  { key: "--accent-blue-dim", label: "Akcent główny (ciemny)", kind: "color" },
  { key: "--accent-green-dim", label: "Akcent sukces (ciemny)", kind: "color" },
  { key: "--accent-red-dim", label: "Akcent uwaga (ciemny)", kind: "color" },
  { key: "--accent-amber", label: "Akcent — ostrzeżenie", kind: "color" },
  { key: "--accent-amber-dim", label: "Akcent ostrzeżenie (ciemny)", kind: "color" },
  { key: "--accent-purple", label: "Akcent — fiolet", kind: "color" },
  { key: "--accent-orange", label: "Akcent — pomarańcz", kind: "color" },
  { key: "--accent-orange-dim", label: "Akcent pomarańcz (ciemny)", kind: "color" },
  { key: "--radius-lg", label: "Zaokrąglenie (duże)", kind: "radius" },
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

const COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/;
const SIZE_RE = /^(?:0|\d{1,3}(?:\.\d+)?px)$/;

/** Sanityzacja pojedynczej wartości tokenu wg jego rodzaju. Zwraca bezpieczną
 *  wartość lub null (odrzucenie). Chroni przed wstrzyknięciem do inline style. */
export function sanitizeTokenValue(key: string, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > 64) return null;
  // Twarda blokada znaków pozwalających wyjść z deklaracji / wstrzyknąć CSS.
  if (/[;{}<>()"']/.test(v) && !/^(?:rgb|rgba|hsl|hsla)\(/.test(v)) return null;
  const control = ALL_CONTROLS.find((c) => c.key === key);
  if (!control) return null;
  if (key === "--color-scheme" || control.kind === "scheme") {
    return v === "light" || v === "dark" ? v : null;
  }
  if (control.kind === "radius" || control.kind === "density") {
    return SIZE_RE.test(v) ? v : null;
  }
  // kolory
  return COLOR_RE.test(v) ? v : null;
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

/** Mapa tokenów → obiekt stylu Reacta (klucze CSS custom properties). */
export function tokensToStyle(tokens: SkinTokens): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens)) {
    style[k] = v;
  }
  return style as React.CSSProperties;
}

export const SYSTEM_DARK_SKIN_ID = "skin-system-dark";
