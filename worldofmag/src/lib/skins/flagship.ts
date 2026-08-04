// 045 — skórki flagowe Omnii.
//
// Po co dwie, skoro wystarczyłaby jedna? Bo jedna skórka niczego nie dowodzi. „Mostek"
// i „Papier" leżą na przeciwnych biegunach silnika: ciemna vs jasna, bezszeryfowa
// zwężona vs szeryfowa, pigułkowa vs prawie kanciasta, z poświatą vs z miękkim cieniem.
// Jeśli obie wyglądają dobrze, to znaczy, że tokeny opisują MOTYW, a nie jeden motyw.
//
// Zasady, których obie przestrzegają:
//  1. Kontrast AA jest wymogiem, nie aspiracją — sprawdzany testem, nie okiem
//     (`src/lib/__tests__/skinContrast.test.ts`).
//  2. Grafika wyłącznie wektorowa i CSS. Żadnych plików — patrz `ChromeFrame`.
//  3. Żadnych cudzych znaków towarowych w nazwach, opisach ani w kodzie. Inspirujemy się
//     estetyką konsoli statku, nie kopiujemy czyjejś marki.
//  4. Skórka stylizowana NIGDY nie jest domyślna. Domyślną zostaje „Dark".

import type { SkinTokens } from "@/lib/skins";

export interface FlagshipSkin {
  /** Stałe id — migracja seedująca używa go w `ON CONFLICT`. */
  id: string;
  name: string;
  description: string;
  colorScheme: "light" | "dark";
  sortOrder: number;
  tokens: SkinTokens;
}

/**
 * MOSTEK — ciemna konsola sci-fi.
 *
 * Charakter budują trzy rzeczy, z których żadna nie jest kolorem: zwężone wersaliki
 * z rozstrzeleniem w nagłówkach, pigułkowe zaokrąglenia przy prawie kanciastych
 * powierzchniach oraz poświata na akcencie zamiast cienia.
 *
 * Najciekawsza decyzja: `--on-accent` jest CIEMNY (#07090f), nie biały. Na nasyconym
 * bursztynie biały tekst daje ~1.9:1 — nieczytelne. Ciemny na bursztynie daje ~9:1
 * i przy okazji jest tym, co czyni ten styl rozpoznawalnym.
 */
export const MOSTEK: FlagshipSkin = {
  id: "skin-system-mostek",
  name: "Mostek",
  description: "Ciemna konsola sci-fi: zwężone wersaliki, pigułkowe krawędzie, poświata zamiast cienia.",
  colorScheme: "dark",
  sortOrder: 10,
  tokens: {
    "--color-scheme": "dark",

    "--bg-base": "#07090f",
    "--bg-surface": "#0e131d",
    "--bg-elevated": "#161d2b",
    "--bg-hover": "#1f2837",
    "--border": "#2b364b",
    "--border-focus": "#5b6f96",

    "--text-primary": "#e8eef7",
    "--text-secondary": "#a4b3cc",
    "--text-muted": "#8494ae",

    // Ciemny tekst na jasnych akcentach — patrz komentarz wyżej.
    "--on-accent": "#07090f",

    "--accent-blue": "#5fb0ff",
    "--accent-blue-dim": "#2a6fb8",
    "--accent-green": "#4fd18b",
    "--accent-green-dim": "#1f8a56",
    "--accent-red": "#ff7b7b",
    "--accent-red-dim": "#c04141",
    "--accent-amber": "#ffa63d",
    "--accent-amber-dim": "#c07216",
    "--accent-purple": "#c08cf0",
    "--accent-orange": "#ff8f4d",
    "--accent-orange-dim": "#c25c1f",

    "--font-family-base": "system",
    "--font-family-display": "condensed",
    "--font-family-mono": "mono",
    "--font-size-base": "14px",
    "--font-weight-heading": "700",
    "--letter-spacing-base": "0em",
    "--letter-spacing-heading": "0.09em",
    "--text-transform-heading": "uppercase",
    "--line-height-base": "1.5",

    "--space-unit": "4px",
    "--control-height": "34px",
    "--view-padding": "16px",

    // Kanciaste powierzchnie, pigułkowe kontrolki — kontrast kształtu buduje charakter.
    "--radius": "2px",
    "--radius-lg": "4px",
    "--radius-pill": "999px",
    "--radius-control": "999px",

    "--border-width": "1px",
    "--border-style": "solid",
    "--focus-ring-width": "2px",

    "--shadow-surface": "none",
    "--shadow-elevated": "0 8px 28px rgba(0,0,0,0.55)",
    "--shadow-glow": "0 0 14px color-mix(in srgb, #ffa63d 45%, transparent)",

    "--bg-image-base": "radial-gradient(circle at 15% 0%, #121a2b 0%, #07090f 55%)",
    "--bg-image-surface": "linear-gradient(180deg, #111726 0%, #0e131d 100%)",

    "--motion-duration": "120ms",
    "--motion-duration-slow": "260ms",
    "--motion-easing": "cubic-bezier(0.2, 0, 0, 1)",

    "--sidebar-width": "220px",
    "--chrome-bg": "#0b1017",
    "--chrome-border": "#2b364b",
    "--chrome-frame": "corners",
  },
};

/**
 * PAPIER — jasna, typograficzna.
 *
 * Drugi biegun: to skórka, w której charakter niosą krój i światło, a nie kolor.
 * Szeryfowe nagłówki, ciepła biel zamiast czystej (#ffffff na pełnym ekranie męczy),
 * prawie zerowe zaokrąglenia i miękki cień zamiast obramowania.
 *
 * Akcenty są celowo PRZYCIEMNIONE względem domyślnych. Jasny błękit #3b82f6 z białym
 * tekstem daje ~3.1:1 — poniżej progu AA dla zwykłego tekstu. #1a5aa8 daje ~6.4:1.
 */
export const PAPIER: FlagshipSkin = {
  id: "skin-system-papier",
  name: "Papier",
  description: "Jasna i typograficzna: szeryfowe nagłówki, ciepła biel, miękki cień zamiast ramek.",
  colorScheme: "light",
  sortOrder: 11,
  tokens: {
    "--color-scheme": "light",

    "--bg-base": "#faf7f1",
    "--bg-surface": "#fffdf9",
    "--bg-elevated": "#f4efe5",
    "--bg-hover": "#ebe4d6",
    "--border": "#ddd4c3",
    "--border-focus": "#a89778",

    "--text-primary": "#1e1b16",
    "--text-secondary": "#544e45",
    "--text-muted": "#6b6459",

    "--on-accent": "#ffffff",

    "--accent-blue": "#1a5aa8",
    "--accent-blue-dim": "#123f76",
    "--accent-green": "#1d6b3d",
    "--accent-green-dim": "#134a2a",
    "--accent-red": "#a52a2a",
    "--accent-red-dim": "#761d1d",
    "--accent-amber": "#8a5600",
    "--accent-amber-dim": "#5f3b00",
    "--accent-purple": "#653a9c",
    "--accent-orange": "#9a4a12",
    "--accent-orange-dim": "#6d340c",

    "--font-family-base": "system",
    "--font-family-display": "serif",
    "--font-family-mono": "mono",
    "--font-size-base": "15px",
    "--font-weight-heading": "700",
    "--letter-spacing-base": "0em",
    "--letter-spacing-heading": "-0.01em",
    "--text-transform-heading": "none",
    "--line-height-base": "1.6",

    "--space-unit": "4px",
    "--control-height": "36px",
    "--view-padding": "20px",

    "--radius": "3px",
    "--radius-lg": "5px",
    "--radius-pill": "999px",
    "--radius-control": "3px",

    "--border-width": "1px",
    "--border-style": "solid",
    "--focus-ring-width": "2px",

    "--shadow-surface": "0 1px 2px rgba(60,50,35,0.06)",
    "--shadow-elevated": "0 6px 20px rgba(60,50,35,0.13)",
    "--shadow-glow": "none",

    // Ledwie widoczna faktura papieru — dwa nakładające się gradienty zamiast bitmapy.
    "--bg-image-base": "linear-gradient(180deg, #fbf9f4 0%, #f7f3ea 100%)",
    "--bg-image-surface": "none",

    "--motion-duration": "110ms",
    "--motion-duration-slow": "240ms",
    "--motion-easing": "ease-out",

    "--sidebar-width": "220px",
    "--chrome-bg": "#f4efe5",
    "--chrome-border": "#ddd4c3",
    "--chrome-frame": "none",
  },
};

export const FLAGSHIP_SKINS: FlagshipSkin[] = [MOSTEK, PAPIER];
