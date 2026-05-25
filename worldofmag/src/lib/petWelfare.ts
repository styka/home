import type { CareAgendaItem, WelfareSuggestion } from "@/types";
import { paramsForGroup, classifyValue, enclosureTypeMeta, envParam, type Range } from "@/lib/petEnvironment";

const UPCOMING_DAYS = 7;
const MS_DAY = 24 * 60 * 60 * 1000;

interface PetLite {
  id: string;
  name: string;
  species: string;
}

interface DueTreatment {
  id: string;
  petId: string;
  kind: string;
  name: string;
  nextDueAt: Date | null;
}

interface DueCareTask {
  id: string;
  petId: string;
  category: string;
  title: string;
  nextDueAt: Date | null;
}

interface DueVetVisit {
  id: string;
  petId: string;
  nextVisitAt: Date | null;
}

export interface AgendaSource {
  pets: PetLite[];
  treatments: DueTreatment[];
  careTasks: DueCareTask[];
  vetVisits: DueVetVisit[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketFor(dueAt: Date, now: Date): CareAgendaItem["bucket"] | null {
  const today = startOfDay(now);
  const due = startOfDay(dueAt);
  if (due.getTime() < today.getTime()) return "OVERDUE";
  if (due.getTime() === today.getTime()) return "TODAY";
  const diffDays = Math.round((due.getTime() - today.getTime()) / MS_DAY);
  if (diffDays <= UPCOMING_DAYS) return "UPCOMING";
  return null;
}

/**
 * Unifies all scheduled care items (treatments, routines, upcoming vet visits)
 * into a single agenda of overdue / today / upcoming (next 7 days) entries,
 * sorted by due date ascending.
 */
export function buildAgenda(source: AgendaSource, now: Date): CareAgendaItem[] {
  const petById = new Map(source.pets.map((p) => [p.id, p]));
  const items: CareAgendaItem[] = [];

  function push(petId: string, kind: CareAgendaItem["kind"], category: string, title: string, dueAt: Date | null, id: string) {
    if (!dueAt) return;
    const bucket = bucketFor(dueAt, now);
    if (!bucket) return;
    const pet = petById.get(petId);
    if (!pet) return;
    items.push({
      id,
      petId,
      petName: pet.name,
      petSpecies: pet.species,
      kind,
      category,
      title,
      dueAt: dueAt.toISOString(),
      bucket,
    });
  }

  for (const t of source.treatments) push(t.petId, "TREATMENT", t.kind, t.name, t.nextDueAt, `t-${t.id}`);
  for (const c of source.careTasks) push(c.petId, "CARE_TASK", c.category, c.title, c.nextDueAt, `c-${c.id}`);
  for (const v of source.vetVisits) push(v.petId, "VET_VISIT", "VET", "Wizyta u weterynarza", v.nextVisitAt, `v-${v.id}`);

  items.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return items;
}

interface MeasurementLite {
  petId: string;
  date: Date;
  weightGrams: number | null;
}

interface WelfarePetLite {
  id: string;
  name: string;
  species: string;
  presetKey: string;
  featureFlags: string | null;
}

/**
 * Rule-based welfare hints derived from the user's actual data: abnormal weight
 * trends and stale measurements. Deterministic and cheap; the LLM layer adds
 * natural-language advice on top of this in the home dashboard.
 */
export function buildWelfareSuggestions(
  data: { pets: WelfarePetLite[]; measurements: MeasurementLite[] },
  now: Date,
): WelfareSuggestion[] {
  const out: WelfareSuggestion[] = [];
  const byPet = new Map<string, MeasurementLite[]>();
  for (const m of data.measurements) {
    if (!byPet.has(m.petId)) byPet.set(m.petId, []);
    byPet.get(m.petId)!.push(m);
  }

  for (const pet of data.pets) {
    const ms = (byPet.get(pet.id) ?? [])
      .filter((m) => m.weightGrams != null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (ms.length === 0) {
      out.push({
        id: `w-noweight-${pet.id}`,
        petId: pet.id,
        severity: "info",
        title: `${pet.name}: brak pomiarów wagi`,
        detail: "Zważ zwierzę, aby śledzić trend masy ciała.",
      });
      continue;
    }

    const latest = ms[0];
    const daysSince = Math.round((now.getTime() - latest.date.getTime()) / MS_DAY);
    if (daysSince > 30) {
      out.push({
        id: `w-stale-${pet.id}`,
        petId: pet.id,
        severity: "info",
        title: `${pet.name}: ostatnia waga ${daysSince} dni temu`,
        detail: "Rozważ aktualizację pomiaru wagi.",
      });
    }

    if (ms.length >= 2) {
      const prev = ms[1];
      const dropPct = ((prev.weightGrams! - latest.weightGrams!) / prev.weightGrams!) * 100;
      if (dropPct >= 10) {
        out.push({
          id: `w-drop-${pet.id}`,
          petId: pet.id,
          severity: "warning",
          title: `${pet.name}: spadek wagi o ${dropPct.toFixed(0)}%`,
          detail: "Znaczny spadek masy ciała — rozważ konsultację z weterynarzem.",
        });
      }
    }
  }

  return out;
}

interface EnclosureLite {
  id: string;
  name: string;
  type: string;
  equipment: string | null;
  targetRanges: string | null;
  latest: Record<string, number | null> | null;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/**
 * Husbandry (Faza 2) — reguły dobrostanu środowiskowego: parametry poza
 * bezpiecznym zakresem (terrarium/akwarium) oraz przeterminowany sprzęt (UVB).
 */
export function buildEnvironmentSuggestions(enclosures: EnclosureLite[], now: Date): WelfareSuggestion[] {
  const out: WelfareSuggestion[] = [];

  for (const enc of enclosures) {
    const meta = enclosureTypeMeta(enc.type);
    const ranges = safeParse<Record<string, Range>>(enc.targetRanges, {});

    if (enc.latest) {
      for (const p of paramsForGroup(meta.group)) {
        const value = enc.latest[p.key];
        if (value == null) continue;
        const status = classifyValue(p.key, value, ranges);
        if (status === "danger" || status === "warn") {
          const param = envParam(p.key);
          out.push({
            id: `env-${enc.id}-${p.key}`,
            petId: null,
            severity: status === "danger" ? "danger" : "warning",
            title: `${enc.name}: ${param?.label ?? p.key} = ${value}${param?.unit ? " " + param.unit : ""}`,
            detail: status === "danger" ? "Parametr poza bezpiecznym zakresem — zareaguj." : "Parametr blisko granicy — monitoruj.",
          });
        }
      }
    }

    const equipment = safeParse<Array<{ name: string; replaceBy?: string | null }>>(enc.equipment, []);
    for (const eq of equipment) {
      if (eq.replaceBy && new Date(eq.replaceBy).getTime() < now.getTime()) {
        out.push({
          id: `equip-${enc.id}-${eq.name}`,
          petId: null,
          severity: "warning",
          title: `${enc.name}: wymień „${eq.name}"`,
          detail: "Termin wymiany sprzętu minął.",
        });
      }
    }
  }

  return out;
}
