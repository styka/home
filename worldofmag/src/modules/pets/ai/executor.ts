// Z-010: handler akcji asystenta dla modułu Pety (wyodrębniony z execute/route.ts).
// Powierzchnia `type === "..."` jest skanowana przez scripts/check-action-coverage.js
// (które od Z-010 czyta też src/lib/ai/executors/*.ts) — nie zmieniaj nazw akcji bez
// aktualizacji katalogu w agent/route.ts + petActions.ts.
import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds, ownedOrAsync } from "@/platform/auth/serverUtils";
import { updatePet, setPetStatus, deletePet } from "../contract";
import { completeTreatment } from "../contract";
import { updateEnclosure, deleteEnclosure, assignPetToEnclosure } from "../contract";
import { asStr } from "@/lib/ai/executorShared";
import { ISO_DATE_RE } from "@/platform/ai/actionContract";
import type { AIAction } from "@/platform/ai/aiAction";
import type { RecurringRule, PetStatus } from "@/types";
import { wlasnoscOsobistaDoZapisu } from "@/platform/workspaces/zapis";
import { SUFIT_LISTY } from "@/platform/pagination";

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

const SPECIES_MAP: Record<string, string> = {
  pies: "dog", piesek: "dog", kot: "cat", kotek: "cat", wąż: "snake", waz: "snake",
  jaszczurka: "lizard", gekon: "lizard", żółw: "turtle", zolw: "turtle", ryba: "fish",
  rybka: "fish", ptak: "bird", papuga: "bird", chomik: "rodent", szczur: "rodent",
  mysz: "rodent", świnka: "rodent", swinka: "rodent", królik: "rabbit", krolik: "rabbit",
};

/**
 * 112: data z parametru akcji → `Date` albo `undefined`.
 *
 * Model bywa niedokładny („ok. 2021", pusty string, tekst zamiast ISO). Niepoprawna wartość musi
 * ZNIKNĄĆ, a nie trafić do bazy — pole pominięte jest zawsze lepsze niż pole nieprawdziwe.
 *
 * Samo `new Date()` NIE wystarczy i to jest istota tej funkcji: `new Date("ok. 2021")` zwraca
 * **1 stycznia 2021**, więc data wyraźnie oznaczona przez użytkownika jako szacunkowa zamieniłaby
 * się w konkretny dzień, którego nikt nie podał — i wyglądałaby na fakt. Dlatego wymagamy formatu
 * ISO tym samym wyrażeniem, którym waliduje kontrakt akcji (jedna definicja „co jest datą").
 */
function dataZParametru(v: unknown): Date | undefined {
  const s = asStr(v);
  if (!s || !ISO_DATE_RE.test(s)) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * 112: pola PROFILU zwierzęcia wspólne dla `add_pet` i `update_pet`.
 *
 * Wydzielone, bo oba wejścia muszą opisywać ten sam profil — gdyby każde budowało swój zestaw, przy
 * pierwszej zmianie jedno z nich zostałoby w tyle i objawiłoby się to cichym gubieniem danych.
 * Zwraca wyłącznie pola FAKTYCZNIE podane, żeby `update_pet` nie kasował istniejących wartości
 * przez `undefined`.
 */
export function poleProfilu(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const teksty = ["breed", "sex", "acquiredFrom", "microchipId", "identifier", "color", "notes"] as const;
  for (const k of teksty) {
    const v = asStr(params[k]);
    if (v) out[k] = v;
  }
  const birthDate = dataZParametru(params.birthDate);
  if (birthDate) out.birthDate = birthDate;
  const acquiredAt = dataZParametru(params.acquiredAt);
  if (acquiredAt) out.acquiredAt = acquiredAt;
  if (typeof params.birthApprox === "boolean") out.birthApprox = params.birthApprox;
  return out;
}

async function findPetByName(userId: string, name: string) {
  const teamIds = await getUserTeamIds(userId);
  return prisma.pet.findFirst({
    where: {
      OR: [
        ...(await ownedOrAsync(userId)),
        { shares: { some: { userId } } },
        teamIds.length > 0 ? { shares: { some: { teamId: { in: teamIds } } } } : { id: "" },
      ],
      name: { contains: name, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function executePetAction(action: AIAction, userId: string): Promise<string> {
  const { type, params, searchQuery } = action;

  if (type === "add_pet") {
    const name = ((params.name as string) ?? "").trim();
    if (!name) throw new Error("Brak imienia zwierzęcia");
    const rawSpecies = (params.species as string | undefined)?.toLowerCase().trim();
    const species = rawSpecies ? (SPECIES_MAP[rawSpecies] ?? rawSpecies) : "other";
    const pet = await prisma.pet.create({
      data: {
        name,
        species,
        // 112: pełny profil od razu. Do 112 akcja zapisywała wyłącznie imię, gatunek, rasę i płeć,
        // więc prośba „ustaw wszystko, co można ustawić" nie miała jak zostać spełniona — mimo że
        // model danych ma te pola od dawna. Wąskim gardłem był KONTRAKT AKCJI, nie baza.
        ...poleProfilu(params),
        ...(await wlasnoscOsobistaDoZapisu(userId)),
      },
    });
    return `Dodano zwierzę "${pet.name}"`;
  }

  if (type === "add_enclosure") {
    const name = ((params.name as string) ?? "").trim();
    if (!name) throw new Error("Brak nazwy zbiornika");
    const enc = await prisma.petEnclosure.create({
      data: {
        name,
        type: (params.type as string) ?? "TERRARIUM",
        volumeL: (params.volumeL as number) ?? null,
        ...(await wlasnoscOsobistaDoZapisu(userId)),
      },
    });
    const assignTo = (params.assignTo as string | undefined)?.trim();
    if (assignTo) {
      const target = await findPetByName(userId, assignTo);
      if (target) await prisma.pet.update({ where: { id: target.id }, data: { enclosureId: enc.id } });
    }
    return `Utworzono zbiornik "${enc.name}"`;
  }

  // Zbiorniki/terraria — rezolucja po nazwie w zakresie użytkownika/zespołu.
  if (type === "update_enclosure" || type === "delete_enclosure" || type === "assign_pet_to_enclosure") {
    const teamIds = await getUserTeamIds(userId);
    const ownerOr = (await ownedOrAsync(userId));
    const encQuery = asStr(params.enclosureName) ?? (type === "assign_pet_to_enclosure" ? undefined : searchQuery);
    if (type === "assign_pet_to_enclosure") {
      const target = await findPetByName(userId, searchQuery ?? asStr(params.petName) ?? "");
      if (!target) throw new Error(`Nie znaleziono zwierzęcia: "${searchQuery ?? ""}"`);
      const enc = encQuery
        ? await prisma.petEnclosure.findFirst({ where: { OR: ownerOr, name: { contains: encQuery, mode: "insensitive" } }, select: { id: true, name: true } })
        : null;
      await assignPetToEnclosure(target.id, enc?.id ?? null);
      return enc ? `Przypisano ${target.name} do zbiornika „${enc.name}"` : `Odpięto ${target.name} od zbiornika`;
    }
    const enc = await prisma.petEnclosure.findFirst({ where: { OR: ownerOr, name: { contains: encQuery ?? "", mode: "insensitive" } }, select: { id: true, name: true } });
    if (!enc) throw new Error(`Nie znaleziono zbiornika: "${encQuery ?? ""}"`);
    if (type === "delete_enclosure") { await deleteEnclosure(enc.id); return `Usunięto zbiornik „${enc.name}"`; }
    await updateEnclosure(enc.id, {
      name: asStr(params.newName),
      type: asStr(params.type),
      location: asStr(params.location) ?? null,
      notes: asStr(params.notes) ?? null,
    });
    return `Zaktualizowano zbiornik „${enc.name}"`;
  }

  // Pozostałe akcje wymagają wskazania zwierzęcia po imieniu
  const pet = await findPetByName(userId, searchQuery ?? "");
  const needsPet = ["log_weight", "schedule_treatment", "schedule_care_task", "log_feeding", "record_vet_visit", "log_health_note", "log_environment", "record_sale", "add_breeding_pair", "update_pet", "set_pet_status", "delete_pet"];
  if (needsPet.includes(type) && !pet) {
    throw new Error(`Nie znaleziono zwierzęcia: "${searchQuery}"`);
  }

  if (type === "update_pet" && pet) {
    // 112: te same pola profilu co `add_pet` — jeden kształt profilu dla obu wejść (patrz
    // `poleProfilu`). Podajemy WYŁĄCZNIE pola faktycznie przekazane, żeby uzupełnienie jednego
    // szczegółu nie wyczyściło pozostałych.
    await updatePet(pet.id, {
      ...(asStr(params.name) ? { name: asStr(params.name) as string } : {}),
      ...poleProfilu(params),
    });
    return `Zaktualizowano zwierzę ${pet.name}`;
  }
  if (type === "set_pet_status" && pet) {
    await setPetStatus(pet.id, ((params.status as string) ?? "ACTIVE") as PetStatus);
    return `Zmieniono status zwierzęcia ${pet.name}`;
  }
  if (type === "delete_pet" && pet) {
    await deletePet(pet.id);
    return `Usunięto zwierzę ${pet.name}`;
  }

  if (type === "record_sale" && pet) {
    await prisma.petSale.create({
      data: {
        petId: pet.id,
        buyerName: (params.buyerName as string) ?? null,
        buyerContact: (params.buyerContact as string) ?? null,
        price: (params.price as number) ?? null,
        ...(await wlasnoscOsobistaDoZapisu(userId)),
      },
    });
    await prisma.pet.update({ where: { id: pet.id }, data: { status: "SOLD" } });
    return `Zapisano sprzedaż ${pet.name}`;
  }

  if (type === "add_breeding_pair" && pet) {
    const partnerName = (params.partner as string | undefined)?.trim();
    const partner = partnerName ? await findPetByName(userId, partnerName) : null;
    const maleId = pet.sex === "male" ? pet.id : partner?.sex === "male" ? partner.id : pet.id;
    const femaleId = pet.sex === "female" ? pet.id : partner?.sex === "female" ? partner.id : partner?.id ?? null;
    const pair = await prisma.petBreedingPair.create({
      data: {
        name: ((params.name as string) ?? `Para ${pet.name}`).trim(),
        species: pet.species,
        maleId,
        femaleId,
        ...(await wlasnoscOsobistaDoZapisu(userId)),
      },
    });
    return `Utworzono parę hodowlaną "${pair.name}"`;
  }

  if (type === "log_environment" && pet) {
    if (!pet.enclosureId) throw new Error(`${pet.name} nie ma przypisanego zbiornika`);
    const numKeys = ["tempWarmC", "tempCoolC", "humidityPct", "uvbIndex", "waterTempC", "ph", "ammoniaPpm", "nitritePpm", "nitratePpm", "salinityPpt", "gh", "kh"] as const;
    const data: Record<string, number> = {};
    for (const k of numKeys) {
      const v = params[k];
      if (typeof v === "number") data[k] = v;
    }
    if (Object.keys(data).length === 0) throw new Error("Brak parametrów do zapisania");
    await prisma.petEnvironmentReading.create({ data: { enclosureId: pet.enclosureId, ...data } });
    return `Zapisano parametry środowiska dla ${pet.name}`;
  }

  if (type === "log_weight" && pet) {
    const weightKg = params.weightKg as number | undefined;
    const weightGrams = (params.weightGrams as number | undefined) ?? (weightKg != null ? Math.round(weightKg * 1000) : null);
    await prisma.petMeasurement.create({
      data: { petId: pet.id, weightGrams: weightGrams ?? null, lengthCm: (params.lengthCm as number) ?? null },
    });
    const shown = weightGrams != null ? `${(weightGrams / 1000).toFixed(2)} kg` : "pomiar";
    return `Zapisano wagę ${pet.name}: ${shown}`;
  }

  if (type === "schedule_treatment" && pet) {
    const name = ((params.name as string) ?? "Lek").trim();
    const everyDays = params.everyDays as number | undefined;
    const recurring: RecurringRule | null = everyDays ? { type: "DAILY", interval: everyDays } : null;
    const dueDate = params.dueDate ? new Date(params.dueDate as string) : null;
    const nextDueAt = dueDate ?? (everyDays ? addDays(new Date(), everyDays) : null);
    await prisma.petTreatment.create({
      data: {
        petId: pet.id,
        kind: (params.kind as string) ?? "MEDICATION",
        name,
        dosage: (params.dosage as string) ?? null,
        recurring: recurring ? JSON.stringify(recurring) : null,
        nextDueAt,
      },
    });
    return `Zaplanowano "${name}" dla ${pet.name}`;
  }

  if (type === "log_treatment_done") {
    const teamIds = await getUserTeamIds(userId);
    const petIds = (await prisma.pet.findMany({
      take: SUFIT_LISTY,
      where: {
        OR: [
          ...(await ownedOrAsync(userId)),
          { shares: { some: { userId } } },
        ],
      },
      select: { id: true },
    })).map((p) => p.id);
    const t = await prisma.petTreatment.findFirst({
      where: { petId: { in: petIds }, name: { contains: searchQuery ?? "", mode: "insensitive" }, active: true },
    });
    if (!t) throw new Error(`Nie znaleziono zaplanowanego zabiegu: "${searchQuery}"`);
    // Wołaj logikę domenową — jedyne miejsce liczenia następnego terminu i tworzenia wpisu w
    // dzienniku pielęgnacji. Dzięki temu odhaczenie przez asystenta AI daje identyczny wynik jak
    // odhaczenie w UI (koniec z równoległą implementacją cykliczności w executorze).
    await completeTreatment(t.id);
    return `Odhaczono "${t.name}"`;
  }

  if (type === "schedule_care_task" && pet) {
    const title = ((params.title as string) ?? "Rutyna").trim();
    const everyDays = params.everyDays as number | undefined;
    const recurring: RecurringRule | null = everyDays ? { type: "DAILY", interval: everyDays } : null;
    const dueDate = params.dueDate ? new Date(params.dueDate as string) : null;
    const nextDueAt = dueDate ?? (everyDays ? addDays(new Date(), everyDays) : null);
    await prisma.petCareTask.create({
      data: {
        petId: pet.id,
        category: (params.category as string) ?? "CUSTOM",
        title,
        recurring: recurring ? JSON.stringify(recurring) : null,
        nextDueAt,
      },
    });
    return `Zaplanowano rutynę "${title}" dla ${pet.name}`;
  }

  if (type === "log_feeding" && pet) {
    const payload = {
      foodType: (params.foodType as string) ?? null,
      amount: (params.amount as string) ?? null,
      preyType: (params.preyType as string) ?? null,
      outcome: (params.outcome as string) ?? "FED",
    };
    await prisma.petCareLog.create({
      data: { petId: pet.id, category: "FEEDING", payload: JSON.stringify(payload) },
    });
    return `Zapisano karmienie ${pet.name}`;
  }

  if (type === "record_vet_visit" && pet) {
    const date = params.date ? new Date(params.date as string) : new Date();
    await prisma.petVetVisit.create({
      data: {
        petId: pet.id, date,
        reason: (params.reason as string) ?? null,
        vetName: (params.vetName as string) ?? null,
        cost: (params.cost as number) ?? null,
      },
    });
    return `Zapisano wizytę weterynaryjną dla ${pet.name}`;
  }

  if (type === "log_health_note" && pet) {
    const title = ((params.title as string) ?? "Wpis zdrowotny").trim();
    await prisma.petHealthRecord.create({
      data: {
        petId: pet.id,
        type: (params.type as string) ?? "NOTE",
        title,
        description: (params.description as string) ?? null,
      },
    });
    return `Dodano wpis zdrowia dla ${pet.name}: "${title}"`;
  }

  throw new Error(`Nieznany typ akcji zwierząt: ${type}`);
}
