import type {
  PetSpecies, PetStatus, PetSex, PetTreatmentKind, PetCareCategory, PetHealthType,
} from "@/types";

export const SPECIES_OPTIONS: Array<{ value: PetSpecies; label: string; emoji: string }> = [
  { value: "dog", label: "Pies", emoji: "🐶" },
  { value: "cat", label: "Kot", emoji: "🐱" },
  { value: "snake", label: "Wąż", emoji: "🐍" },
  { value: "lizard", label: "Jaszczurka", emoji: "🦎" },
  { value: "turtle", label: "Żółw", emoji: "🐢" },
  { value: "fish", label: "Ryba", emoji: "🐠" },
  { value: "bird", label: "Ptak", emoji: "🦜" },
  { value: "rodent", label: "Gryzoń", emoji: "🐹" },
  { value: "rabbit", label: "Królik", emoji: "🐰" },
  { value: "other", label: "Inne", emoji: "🐾" },
];

export function speciesEmoji(species: string): string {
  return SPECIES_OPTIONS.find((s) => s.value === species)?.emoji ?? "🐾";
}

export function speciesLabel(species: string): string {
  return SPECIES_OPTIONS.find((s) => s.value === species)?.label ?? "Inne";
}

export const STATUS_LABELS: Record<PetStatus, string> = {
  ACTIVE: "Aktywne",
  DECEASED: "Zmarłe",
  REHOMED: "Oddane",
  SOLD: "Sprzedane",
  ARCHIVED: "Zarchiwizowane",
};

export const SEX_LABELS: Record<PetSex, string> = {
  male: "Samiec",
  female: "Samica",
  unknown: "Nieznana",
};

export const TREATMENT_KIND_LABELS: Record<PetTreatmentKind, string> = {
  MEDICATION: "Lek",
  VACCINE: "Szczepienie",
  DEWORMER: "Odrobaczanie",
  PARASITE: "Ochrona p-pasożytnicza",
  SUPPLEMENT: "Suplement",
};

export const CARE_CATEGORY_LABELS: Record<PetCareCategory, string> = {
  FEEDING: "Karmienie",
  CLEANING: "Czyszczenie",
  GROOMING: "Pielęgnacja",
  WALK: "Spacer",
  WATER_CHANGE: "Wymiana wody",
  UVB_REPLACEMENT: "Wymiana UVB",
  WEIGHING: "Ważenie",
  CUSTOM: "Inne",
};

export const HEALTH_TYPE_LABELS: Record<PetHealthType, string> = {
  CONDITION: "Schorzenie",
  ALLERGY: "Alergia",
  SYMPTOM: "Objaw",
  INJURY: "Uraz",
  NOTE: "Notatka",
  MILESTONE: "Kamień milowy",
};

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatWeight(grams: number | null | undefined): string {
  if (grams == null) return "—";
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 2)} kg`;
  return `${grams} g`;
}

export function ageFromBirth(birth: Date | string | null | undefined): string | null {
  if (!birth) return null;
  const b = typeof birth === "string" ? new Date(birth) : birth;
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mies.`;
  if (rem === 0) return `${years} ${years === 1 ? "rok" : years < 5 ? "lata" : "lat"}`;
  return `${years} ${years === 1 ? "rok" : years < 5 ? "lata" : "lat"} ${rem} mies.`;
}
