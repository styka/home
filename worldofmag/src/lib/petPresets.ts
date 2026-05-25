// Pakiety widoczności funkcji modułu Zwierzęta.
// PROFILE jest zawsze widoczny i nie jest przełączalny.
// Sekcje faz 2/3 (HUSBANDRY, AQUARIUM, BREEDING, GENETICS) można już włączyć
// presetem — do czasu implementacji pokazują placeholder „wkrótce".

export const PET_FEATURE_KEYS = [
  "MEASUREMENTS",
  "HEALTH",
  "TREATMENTS",
  "VET",
  "FEEDING",
  "ROUTINES",
  "FINANCE",
  "DOCUMENTS",
  "HUSBANDRY",
  "AQUARIUM",
  "BREEDING",
  "GENETICS",
] as const;

export type PetFeatureKey = (typeof PET_FEATURE_KEYS)[number];

export type PetFeatureFlags = Record<PetFeatureKey, boolean>;

export const PET_FEATURE_LABELS: Record<PetFeatureKey, string> = {
  MEASUREMENTS: "Pomiary i waga",
  HEALTH: "Dziennik zdrowia",
  TREATMENTS: "Leki i szczepienia",
  VET: "Wizyty weterynaryjne",
  FEEDING: "Karmienie",
  ROUTINES: "Rutyny opieki",
  FINANCE: "Finanse",
  DOCUMENTS: "Dokumenty i zdjęcia",
  HUSBANDRY: "Terrarium / środowisko",
  AQUARIUM: "Akwarium / parametry wody",
  BREEDING: "Hodowla i rodowód",
  GENETICS: "Genetyka / morphy",
};

// Funkcje wprowadzane w późniejszych fazach — UI pokazuje „wkrótce".
export const PET_FEATURE_PHASE: Partial<Record<PetFeatureKey, 2 | 3>> = {
  HUSBANDRY: 2,
  AQUARIUM: 2,
  BREEDING: 3,
  GENETICS: 3,
};

export interface PetPreset {
  key: string;
  label: string;
  description: string;
  emoji: string;
  features: PetFeatureKey[];
}

export const PET_PRESETS: PetPreset[] = [
  {
    key: "companion",
    label: "Pupil domowy",
    description: "Pies, kot lub inny towarzysz. Zdrowie, karmienie, rutyny, finanse.",
    emoji: "🐶",
    features: ["MEASUREMENTS", "HEALTH", "TREATMENTS", "VET", "FEEDING", "ROUTINES", "FINANCE", "DOCUMENTS"],
  },
  {
    key: "reptile_keeper",
    label: "Gad — hodowca-amator",
    description: "Wąż / jaszczurka. Karmienie ofiarą, terrarium, zdrowie i pomiary.",
    emoji: "🦎",
    features: ["MEASUREMENTS", "HEALTH", "TREATMENTS", "VET", "FEEDING", "ROUTINES", "HUSBANDRY", "FINANCE", "DOCUMENTS"],
  },
  {
    key: "reptile_breeder",
    label: "Gad — hodowca",
    description: "Pełna hodowla: terrarium, pary, klutche, genetyka i rodowód.",
    emoji: "🐍",
    features: ["MEASUREMENTS", "HEALTH", "TREATMENTS", "VET", "FEEDING", "ROUTINES", "HUSBANDRY", "BREEDING", "GENETICS", "FINANCE", "DOCUMENTS"],
  },
  {
    key: "aquarium",
    label: "Akwarium",
    description: "Ryby i bezkręgowce. Parametry wody, karmienie i finanse.",
    emoji: "🐠",
    features: ["AQUARIUM", "FEEDING", "HEALTH", "FINANCE", "DOCUMENTS"],
  },
  {
    key: "bird",
    label: "Ptak",
    description: "Ptaki ozdobne. Zdrowie, karmienie, rutyny i pomiary.",
    emoji: "🦜",
    features: ["MEASUREMENTS", "HEALTH", "TREATMENTS", "VET", "FEEDING", "ROUTINES", "FINANCE", "DOCUMENTS"],
  },
  {
    key: "small_mammal",
    label: "Mały ssak",
    description: "Gryzonie, króliki. Zdrowie, karmienie, rutyny, finanse.",
    emoji: "🐹",
    features: ["MEASUREMENTS", "HEALTH", "TREATMENTS", "VET", "FEEDING", "ROUTINES", "FINANCE", "DOCUMENTS"],
  },
  {
    key: "custom",
    label: "Własny",
    description: "Sam decydujesz, które sekcje są widoczne.",
    emoji: "⚙️",
    features: ["MEASUREMENTS", "HEALTH", "TREATMENTS", "VET", "FEEDING", "ROUTINES", "FINANCE", "DOCUMENTS"],
  },
];

export const DEFAULT_PRESET_KEY = "companion";

/** Sugerowany preset na podstawie wybranego gatunku. */
export function suggestedPresetForSpecies(species: string): string {
  switch (species) {
    case "snake":
    case "lizard":
    case "turtle":
      return "reptile_keeper";
    case "fish":
      return "aquarium";
    case "bird":
      return "bird";
    case "rodent":
    case "rabbit":
      return "small_mammal";
    case "dog":
    case "cat":
    default:
      return "companion";
  }
}

function allFalseFlags(): PetFeatureFlags {
  return PET_FEATURE_KEYS.reduce((acc, k) => {
    acc[k] = false;
    return acc;
  }, {} as PetFeatureFlags);
}

export function flagsForPreset(presetKey: string): PetFeatureFlags {
  const preset = PET_PRESETS.find((p) => p.key === presetKey) ?? PET_PRESETS[0];
  const flags = allFalseFlags();
  for (const f of preset.features) flags[f] = true;
  return flags;
}

/**
 * Zwraca efektywne flagi widoczności dla zwierzęcia: nadpisania z featureFlags
 * (JSON) scalone nad domyślnymi flagami presetu. PROFILE jest zawsze dostępny
 * (nie ma flagi). Nieznane klucze są ignorowane.
 */
export function resolveFeatures(pet: { presetKey: string; featureFlags: string | null }): PetFeatureFlags {
  const base = flagsForPreset(pet.presetKey);
  if (!pet.featureFlags) return base;
  try {
    const overrides = JSON.parse(pet.featureFlags) as Partial<Record<string, boolean>>;
    for (const key of PET_FEATURE_KEYS) {
      if (typeof overrides[key] === "boolean") base[key] = overrides[key] as boolean;
    }
  } catch {
    // niepoprawny JSON — użyj samego presetu
  }
  return base;
}

export function isFeatureEnabled(
  pet: { presetKey: string; featureFlags: string | null },
  feature: PetFeatureKey,
): boolean {
  return resolveFeatures(pet)[feature];
}
