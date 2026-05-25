// Definicje parametrów środowiska (terrarium + akwarium), domyślne bezpieczne
// zakresy i klasyfikacja odczytów. Client-safe (bez importów serwerowych).

export type EnvGroup = "terrarium" | "aquarium";

export interface EnvParam {
  key: string;
  label: string;
  unit: string;
  group: EnvGroup;
  decimals: number;
}

export const ENV_PARAMS: EnvParam[] = [
  // Terrarium
  { key: "tempWarmC", label: "Temp. strefa ciepła", unit: "°C", group: "terrarium", decimals: 1 },
  { key: "tempCoolC", label: "Temp. strefa zimna", unit: "°C", group: "terrarium", decimals: 1 },
  { key: "humidityPct", label: "Wilgotność", unit: "%", group: "terrarium", decimals: 0 },
  { key: "uvbIndex", label: "UVB (UVI)", unit: "", group: "terrarium", decimals: 1 },
  // Aquarium
  { key: "waterTempC", label: "Temp. wody", unit: "°C", group: "aquarium", decimals: 1 },
  { key: "ph", label: "pH", unit: "", group: "aquarium", decimals: 1 },
  { key: "ammoniaPpm", label: "Amoniak (NH₃)", unit: "ppm", group: "aquarium", decimals: 2 },
  { key: "nitritePpm", label: "Azotyny (NO₂)", unit: "ppm", group: "aquarium", decimals: 2 },
  { key: "nitratePpm", label: "Azotany (NO₃)", unit: "ppm", group: "aquarium", decimals: 0 },
  { key: "salinityPpt", label: "Zasolenie", unit: "ppt", group: "aquarium", decimals: 1 },
  { key: "gh", label: "Twardość GH", unit: "°dGH", group: "aquarium", decimals: 0 },
  { key: "kh", label: "Twardość KH", unit: "°dKH", group: "aquarium", decimals: 0 },
];

export function paramsForGroup(group: EnvGroup): EnvParam[] {
  return ENV_PARAMS.filter((p) => p.group === group);
}

export function envParam(key: string): EnvParam | undefined {
  return ENV_PARAMS.find((p) => p.key === key);
}

export interface Range {
  min?: number;
  max?: number;
  // wartości <= warnMax są bezpieczne; (warnMax, dangerMax] = ostrzeżenie; > dangerMax = niebezpieczne
  warnMax?: number;
  dangerMax?: number;
}

// Ogólne, rozsądne zakresy bezpieczeństwa (użytkownik może nadpisać per zbiornik).
export const DEFAULT_RANGES: Record<string, Range> = {
  tempWarmC: { min: 28, max: 40 },
  tempCoolC: { min: 20, max: 28 },
  humidityPct: { min: 40, max: 80 },
  uvbIndex: { min: 1, max: 7 },
  waterTempC: { min: 22, max: 28 },
  ph: { min: 6.5, max: 8.0 },
  ammoniaPpm: { warnMax: 0, dangerMax: 0.25 },
  nitritePpm: { warnMax: 0, dangerMax: 0.25 },
  nitratePpm: { warnMax: 40, dangerMax: 80 },
  salinityPpt: { min: 0, max: 35 },
  gh: { min: 4, max: 20 },
  kh: { min: 3, max: 15 },
};

export type EnvStatus = "ok" | "warn" | "danger";

export function rangeFor(key: string, custom?: Record<string, Range> | null): Range | undefined {
  return custom?.[key] ?? DEFAULT_RANGES[key];
}

/**
 * Klasyfikuje wartość parametru względem zakresu bezpieczeństwa.
 * Obsługuje zarówno zakresy min/max (temperatura, pH), jak i progi
 * warnMax/dangerMax (toksyny: amoniak, azotyny — gdzie 0 jest idealne).
 */
export function classifyValue(key: string, value: number | null | undefined, custom?: Record<string, Range> | null): EnvStatus {
  if (value == null) return "ok";
  const r = rangeFor(key, custom);
  if (!r) return "ok";

  if (r.dangerMax != null || r.warnMax != null) {
    if (r.dangerMax != null && value > r.dangerMax) return "danger";
    if (r.warnMax != null && value > r.warnMax) return "warn";
    return "ok";
  }

  if (r.min != null && value < r.min) return value < r.min * 0.85 ? "danger" : "warn";
  if (r.max != null && value > r.max) return value > r.max * 1.15 ? "danger" : "warn";
  return "ok";
}

export function rangeLabel(key: string, custom?: Record<string, Range> | null): string {
  const r = rangeFor(key, custom);
  if (!r) return "";
  if (r.dangerMax != null) return `cel: ≤ ${r.warnMax ?? 0}`;
  if (r.min != null && r.max != null) return `cel: ${r.min}–${r.max}`;
  if (r.max != null) return `cel: ≤ ${r.max}`;
  if (r.min != null) return `cel: ≥ ${r.min}`;
  return "";
}

export const ENCLOSURE_TYPES: Array<{ value: string; label: string; emoji: string; group: EnvGroup }> = [
  { value: "TERRARIUM", label: "Terrarium", emoji: "🦎", group: "terrarium" },
  { value: "PALUDARIUM", label: "Paludarium", emoji: "🐸", group: "terrarium" },
  { value: "CAGE", label: "Klatka", emoji: "🐹", group: "terrarium" },
  { value: "AVIARY", label: "Woliera", emoji: "🦜", group: "terrarium" },
  { value: "AQUARIUM", label: "Akwarium", emoji: "🐠", group: "aquarium" },
  { value: "TANK", label: "Zbiornik", emoji: "💧", group: "aquarium" },
  { value: "OTHER", label: "Inne", emoji: "📦", group: "terrarium" },
];

export function enclosureTypeMeta(type: string) {
  return ENCLOSURE_TYPES.find((t) => t.value === type) ?? ENCLOSURE_TYPES[0];
}

/** Domyślny typ zbiornika dla gatunku (do podpowiedzi przy tworzeniu). */
export function enclosureTypeForSpecies(species: string): string {
  if (species === "fish") return "AQUARIUM";
  if (species === "bird") return "AVIARY";
  if (species === "rodent" || species === "rabbit") return "CAGE";
  if (species === "snake" || species === "lizard" || species === "turtle") return "TERRARIUM";
  return "TERRARIUM";
}
