// Kalkulator genetyczny morphów/cech (gady i nie tylko). Client-safe.
// Model per gen, niezależne dziedziczenie. Obsługuje dziedziczenie recesywne,
// kodominujące (np. pastel/super pastel) i dominujące.

export type GeneMode = "recessive" | "codominant" | "dominant";
export type Zygosity = "normal" | "het" | "visual" | "super";

export interface PetGene {
  gene: string;
  mode: GeneMode;
  zygosity: Zygosity;
}

export const GENE_MODE_LABELS: Record<GeneMode, string> = {
  recessive: "recesywny",
  codominant: "kodominujący",
  dominant: "dominujący",
};

export const ZYGOSITY_LABELS: Record<Zygosity, string> = {
  normal: "normalny",
  het: "het (nosiciel)",
  visual: "widoczny",
  super: "super (homozygota)",
};

/** Dozwolone zygotyczności dla danego trybu dziedziczenia. */
export function zygositiesForMode(mode: GeneMode): Zygosity[] {
  if (mode === "recessive") return ["normal", "het", "visual"];
  if (mode === "codominant") return ["normal", "het", "super"];
  return ["normal", "het", "super"]; // dominant: het = widoczny, super = homozygota
}

/** Prawdopodobieństwo przekazania zmutowanego allelu przez rodzica. */
function mutantAlleleProb(g: PetGene): number {
  switch (g.zygosity) {
    case "normal": return 0;
    case "het": return 0.5;
    case "super": return 1;
    case "visual": return g.mode === "recessive" ? 1 : 0.5;
    default: return 0;
  }
}

export interface OffspringOutcome {
  label: string;
  pct: number; // 0–100, zaokrąglone
}

export interface GeneResult {
  gene: string;
  mode: GeneMode;
  outcomes: OffspringOutcome[];
}

function round(p: number): number {
  return Math.round(p * 1000) / 10; // jedno miejsce po przecinku
}

function resultForGene(gene: string, mode: GeneMode, pMale: number, pFemale: number): GeneResult {
  const p2 = pMale * pFemale;                              // homozygota mutanta
  const p1 = pMale * (1 - pFemale) + (1 - pMale) * pFemale; // heterozygota
  const p0 = (1 - pMale) * (1 - pFemale);                  // brak mutacji

  let outcomes: OffspringOutcome[];
  if (mode === "recessive") {
    outcomes = [
      { label: `${gene} (widoczny)`, pct: round(p2) },
      { label: `het ${gene}`, pct: round(p1) },
      { label: `nie nosi ${gene}`, pct: round(p0) },
    ];
  } else if (mode === "codominant") {
    outcomes = [
      { label: `super ${gene}`, pct: round(p2) },
      { label: `${gene}`, pct: round(p1) },
      { label: `nie nosi ${gene}`, pct: round(p0) },
    ];
  } else {
    // dominant: 1 lub 2 kopie = widoczny; rozbicie na super dla informacji
    outcomes = [
      { label: `super ${gene}`, pct: round(p2) },
      { label: `${gene}`, pct: round(p1) },
      { label: `nie nosi ${gene}`, pct: round(p0) },
    ];
  }
  return { gene, mode, outcomes: outcomes.filter((o) => o.pct > 0) };
}

/**
 * Liczy prawdopodobieństwa potomstwa dla pary genotypów. Geny dopasowywane po
 * nazwie (case-insensitive); jeśli gen jest tylko u jednego rodzica, drugi
 * traktowany jest jako normalny (brak allelu).
 */
export function calculateOffspring(male: PetGene[], female: PetGene[]): GeneResult[] {
  const byName = new Map<string, { gene: string; mode: GeneMode; male?: PetGene; female?: PetGene }>();

  for (const g of male) {
    const key = g.gene.trim().toLowerCase();
    if (!key) continue;
    byName.set(key, { gene: g.gene.trim(), mode: g.mode, male: g });
  }
  for (const g of female) {
    const key = g.gene.trim().toLowerCase();
    if (!key) continue;
    const ex = byName.get(key);
    if (ex) ex.female = g;
    else byName.set(key, { gene: g.gene.trim(), mode: g.mode, female: g });
  }

  const results: GeneResult[] = [];
  for (const entry of Array.from(byName.values())) {
    const pMale = entry.male ? mutantAlleleProb(entry.male) : 0;
    const pFemale = entry.female ? mutantAlleleProb(entry.female) : 0;
    if (pMale === 0 && pFemale === 0) continue;
    results.push(resultForGene(entry.gene, entry.mode, pMale, pFemale));
  }
  return results;
}

export function parseGenetics(raw: string | null | undefined): PetGene[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as PetGene[];
    return Array.isArray(arr) ? arr.filter((g) => g && typeof g.gene === "string") : [];
  } catch {
    return [];
  }
}

/** Krótki opis genotypu, np. „Albino (widoczny), het Pastel". */
export function describeGenetics(genes: PetGene[]): string {
  if (genes.length === 0) return "brak danych genetycznych";
  return genes
    .map((g) => {
      if (g.zygosity === "het") return `het ${g.gene}`;
      if (g.zygosity === "super") return `super ${g.gene}`;
      if (g.zygosity === "visual") return `${g.gene}`;
      return null;
    })
    .filter(Boolean)
    .join(", ") || "normalny";
}
