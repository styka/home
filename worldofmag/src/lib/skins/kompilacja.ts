// 116 — KOMPILATOR definicji zaawansowanej.
//
// Wejście: ZWALIDOWANA definicja + lista istniejących assetów. Wyjście: to samo, czym
// żyje skórka prosta — mapa zmiennych CSS (inline na <html>) — plus atrybuty `data-*`
// (bramki reguł w globals.css) i lista ostrzeżeń dla użytkownika.
//
// Czysta funkcja bez Prismy i bez sesji: liczy ją zarówno `readActiveSkin` (serwer),
// jak i podgląd w panelu generatora (klient) — dlatego assety przychodzą PARAMETREM.
//
// Trzy reguły bezpieczeństwa:
//  1. `url()` powstaje WYŁĄCZNIE tutaj, z id przefiltrowanego regexem cuid i
//     zweryfikowanego względem listy istniejących assetów — nigdy z tekstu definicji.
//  2. Wartości zmiennych pochodzą z definicji już zwalidowanej (`walidujDefinicje`),
//     a wartości wyliczane (poświaty, dystanse) są budowane z liczb, nie z tekstu.
//  3. Bramka `data-*` pojawia się tylko, gdy skórka faktycznie czegoś w tej rodzinie
//     używa — bez skórki zaawansowanej żadna reguła bramkowana nie działa (AC-1).

import { resolveTokens, type SkinTokens } from "@/lib/skins";
import { contrastRatio, parseHex, AA_TEXT } from "./contrast";
import {
  CELE_ANIMACJI,
  KOMPONENTY,
  MOBILE_TOKENY,
  STANY_GLOBALNE,
  type CelAnimacji,
  type DefinicjaZaawansowana,
  type Intensywnosc,
  type OpisWlasciwosci,
} from "./zaawansowane";

export type AssetDoKompilacji = { id: string; mimeType: string };

export type WynikKompilacji = {
  tokens: SkinTokens;
  /** Atrybuty `data-*` na <html> (bramki reguł + warianty), np. { "data-nav": "sidebar-prawy" }. */
  atrybuty: Record<string, string>;
  ostrzezenia: string[];
};

const INTENSYWNOSC_DOMYSLNA: Intensywnosc = "normal";

/** #rrggbb → "r,g,b" (do rgba budowanego przez kompilator). Nie-hex → null. */
function hexNaRgb(hex: string | undefined): string | null {
  if (!hex) return null;
  const rgb = parseHex(hex);
  return rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : null;
}

function zastosujWlasciwosc(
  opis: OpisWlasciwosci,
  wartosc: string,
  tokens: SkinTokens,
  bramki: Set<string>,
): void {
  if (opis.cel.typ === "token") {
    tokens[opis.cel.klucz] = wartosc;
  } else {
    tokens[opis.cel.klucz] = wartosc;
    bramki.add(opis.cel.brama);
  }
}

export function kompilujDefinicje(
  def: DefinicjaZaawansowana,
  assety: AssetDoKompilacji[],
): WynikKompilacji {
  const tokens: SkinTokens = { ...(def.tokens ?? {}) };
  const atrybuty: Record<string, string> = {};
  const ostrzezenia: string[] = [];
  const bramki = new Set<string>();

  // ── komponenty ────────────────────────────────────────────────────────────────
  for (const [nazwa, styl] of Object.entries(def.components ?? {})) {
    const katalog = KOMPONENTY[nazwa];
    if (!katalog) continue; // walidacja już to odrzuciła — pas bezpieczeństwa
    for (const [prop, wartosc] of Object.entries(styl)) {
      if (prop === "states" || typeof wartosc !== "string") continue;
      const opis = katalog.wlasciwosci[prop];
      if (opis) zastosujWlasciwosc(opis, wartosc, tokens, bramki);
    }
    for (const [stan, cialo] of Object.entries(styl.states ?? {})) {
      const katStanu = katalog.stany?.[stan];
      if (!katStanu) continue;
      for (const [prop, wartosc] of Object.entries(cialo)) {
        const opis = katStanu[prop];
        if (opis) zastosujWlasciwosc(opis, wartosc, tokens, bramki);
      }
    }
  }

  // ── globalne kolory stanów ────────────────────────────────────────────────────
  for (const [stan, cialo] of Object.entries(def.states ?? {})) {
    const katalog = STANY_GLOBALNE[stan];
    if (!katalog) continue;
    for (const [prop, wartosc] of Object.entries(cialo)) {
      const opis = katalog[prop];
      if (opis) zastosujWlasciwosc(opis, wartosc, tokens, bramki);
    }
  }

  // Pełna paleta po nałożeniu tokenów i aliasów — do dopełnień i ostrzeżeń.
  const paleta = resolveTokens(tokens);

  // ── dopełnienie rodziny przycisku ─────────────────────────────────────────────
  //
  // Reguła `html[data-c-btn] button { --accent-blue: var(--c-btn-bg); … }` przepisuje
  // WSZYSTKIE trzy zmienne naraz, więc każda nieustawiona musi dostać wartość równą
  // bazowej — inaczej ustawienie samego `text` zmieniałoby też tło przycisków.
  if (bramki.has("c-btn")) {
    tokens["--c-btn-bg"] ??= paleta["--accent-blue"];
    tokens["--c-btn-text"] ??= paleta["--on-accent"];
    tokens["--c-btn-hover-bg"] ??= tokens["--c-btn-bg"];
  }
  if (bramki.has("c-btn-shadow")) {
    tokens["--c-btn-shadow"] ??= "none";
    tokens["--c-btn-hover-shadow"] ??= tokens["--c-btn-shadow"];
  }
  if (bramki.has("c-modal")) {
    tokens["--c-modal-bg"] ??= paleta["--bg-surface"];
  }

  // ── layout ────────────────────────────────────────────────────────────────────
  if (def.layout?.nav && def.layout.nav !== "sidebar-lewy") {
    atrybuty["data-nav"] = def.layout.nav;
  }

  // ── animacje ──────────────────────────────────────────────────────────────────
  for (const [cel, anim] of Object.entries(def.animations ?? {})) {
    const katalog = CELE_ANIMACJI[cel as CelAnimacji];
    if (!katalog || !anim) continue;
    atrybuty[`data-${katalog.brama}`] = anim.name;
    const intensywnosc = anim.intensity ?? INTENSYWNOSC_DOMYSLNA;
    const stopien = intensywnosc === "subtle" ? 0 : intensywnosc === "normal" ? 1 : 2;

    switch (cel as CelAnimacji) {
      case "contentEntrance": {
        if (anim.duration) tokens["--anim-content-dur"] = anim.duration;
        if (anim.easing) tokens["--anim-content-ease"] = anim.easing;
        tokens["--anim-content-dist"] = ["4px", "8px", "16px"][stopien];
        tokens["--anim-content-scale"] = ["0.995", "0.97", "0.94"][stopien];
        break;
      }
      case "buttonHover": {
        if (anim.duration) tokens["--anim-btnh-dur"] = anim.duration;
        tokens["--anim-btnh-scale"] = ["1.01", "1.02", "1.05"][stopien];
        const rgb =
          hexNaRgb(tokens["--c-btn-bg"]) ?? hexNaRgb(paleta["--accent-blue"]) ?? "59,130,246";
        tokens["--anim-btnh-glow"] = `0 0 ${[8, 14, 22][stopien]}px rgba(${rgb},0.55)`;
        break;
      }
      case "navGlow": {
        if (anim.duration) tokens["--anim-nav-dur"] = anim.duration;
        const rgb = hexNaRgb(paleta["--accent-blue"]) ?? "59,130,246";
        tokens["--anim-nav-glow"] = `0 0 ${[10, 18, 28][stopien]}px rgba(${rgb},0.45)`;
        break;
      }
      case "modalEntrance": {
        if (anim.duration) tokens["--anim-modal-dur"] = anim.duration;
        if (anim.easing) tokens["--anim-modal-ease"] = anim.easing;
        tokens["--anim-modal-dist"] = ["8px", "16px", "28px"][stopien];
        tokens["--anim-modal-scale"] = ["0.98", "0.95", "0.9"][stopien];
        break;
      }
      case "loader": {
        if (anim.duration) tokens["--anim-loader-dur"] = anim.duration;
        break;
      }
    }
  }

  // ── assety ────────────────────────────────────────────────────────────────────
  const znane = new Map(assety.map((a) => [a.id, a] as const));
  for (const ref of def.assets ?? []) {
    if (ref.status === "missing" || !ref.id) {
      ostrzezenia.push(
        `Grafika dla slotu „${ref.slot}" jeszcze nie istnieje` +
          (ref.prompt ? ` (zamówienie: ${ref.prompt})` : "") +
          " — slot pominięty.",
      );
      continue;
    }
    if (!znane.has(ref.id)) {
      ostrzezenia.push(`Grafika dla slotu „${ref.slot}" nie istnieje w magazynie — slot pominięty.`);
      continue;
    }
    // Id przeszło walidację regexem cuid i istnieje w magazynie — dopiero TERAZ wolno
    // zbudować url(). Ścieżka jest stała, id nie zawiera znaków spoza [a-z0-9].
    const url = `url("/api/skins/assets/${ref.id}")`;
    switch (ref.slot) {
      case "app-background":
        tokens["--bg-image-base"] = url;
        atrybuty["data-asset-bg"] = ref.fit ?? "cover";
        break;
      case "surface-texture":
        tokens["--bg-image-surface"] = url;
        break;
      case "nav-background":
        tokens["--c-nav-bg-image"] = url;
        atrybuty["data-asset-nav"] = ref.fit ?? "cover";
        break;
    }
  }

  // ── bramki → atrybuty ─────────────────────────────────────────────────────────
  for (const brama of bramki) atrybuty[`data-${brama}`] = "1";

  // ── responsive: telefon ───────────────────────────────────────────────────────
  //
  // Zmienna ustawiona inline na <html> wygrywa z każdą regułą arkusza, więc tokenu
  // nadpisywanego na telefonie NIE wolno zostawić w mapie pod jego własną nazwą.
  // Przenosimy go do pary --d-…/--m-…, a bramkowane reguły w globals.css składają
  // z nich właściwą wartość po obu stronach progu md.
  const mobile = def.responsive?.mobile?.tokens;
  if (mobile && Object.keys(mobile).length > 0) {
    atrybuty["data-resp-mobile"] = "1";
    const paletaPoAliasach = resolveTokens(tokens);
    for (const klucz of MOBILE_TOKENY) {
      const desktop = tokens[klucz] ?? paletaPoAliasach[klucz];
      const telefon = mobile[klucz] ?? desktop;
      delete tokens[klucz];
      tokens[klucz.replace("--", "--d-")] = desktop;
      tokens[klucz.replace("--", "--m-")] = telefon;
    }
  }

  // ── ostrzeżenia kontrastowe (AC-11) ───────────────────────────────────────────
  const koncowa = resolveTokens(tokens);
  const pary: [string, string, string][] = [
    ["--text-primary", "--bg-base", "tekst główny na tle aplikacji"],
    ["--text-secondary", "--bg-surface", "tekst drugorzędny na powierzchni"],
    ["--on-accent", "--accent-blue", "tekst na przyciskach"],
  ];
  if (tokens["--c-btn-bg"] && parseHex(tokens["--c-btn-bg"])) {
    pary.push(["--c-btn-text", "--c-btn-bg", "tekst na przyciskach skórki"]);
  }
  for (const [fg, bg, opis] of pary) {
    // Ostrzegamy tylko o parach, na które definicja realnie wpłynęła — domyślna
    // paleta aplikacji nie jest winą skórki (np. bazowy --on-accent/--accent-blue
    // ma ~3.7:1 i ostrzeżenie pojawiałoby się przy KAŻDEJ skórce zaawansowanej).
    if (!(fg in tokens) && !(bg in tokens)) continue;
    const a = koncowa[fg];
    const b = koncowa[bg];
    if (!a || !b || !parseHex(a) || !parseHex(b)) continue;
    const ratio = contrastRatio(a, b);
    if (ratio > 0 && ratio < AA_TEXT) {
      ostrzezenia.push(
        `Niski kontrast: ${opis} (${ratio.toFixed(1)}:1, zalecane ≥ ${AA_TEXT}:1) — tekst może być nieczytelny.`,
      );
    }
  }

  return { tokens, atrybuty, ostrzezenia };
}
