import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/server-utils";
import { computeNextDue, parseRecurringRule } from "@/lib/recurrence";
import { createTask, updateTask, deleteTask } from "@/actions/tasks";
import { createTaskProject, updateTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import { addItem, updateItem, updateItemStatus, deleteItem, clearDoneItems, markAllInCart } from "@/actions/items";
import { createList, renameList, archiveList, deleteList } from "@/actions/lists";
import { createNote, updateNote, deleteNote, toggleNotePin } from "@/actions/notes";
import { toggleHabitDay } from "@/actions/habits";
import { addEntry, getWalletElements } from "@/actions/portfel";
import { setMealPlanEntry } from "@/actions/mealPlans";
import { addFuelLog, addServiceRecord, createVehicle, updateVehicle, deleteVehicle } from "@/actions/flota";
import { addStorageItem, adjustStorageQuantity, updateStorageItem, deleteStorageItem, transferStock } from "@/actions/storage";
import { createHabit, updateHabit, setHabitArchived, deleteHabit } from "@/actions/habits";
import { createElement, updateElement, setBalance, archiveElement, deleteElement } from "@/actions/portfel";
import { createHealthEvent, updateHealthEvent, setHealthStatus, deleteHealthEvent } from "@/actions/health";
import { createDeck, updateDeck, deleteDeck, addWord, updateWord, deleteWord } from "@/actions/languageDecks";
import { addPantryItem, updatePantryItem, consumePantryItem, deletePantryItem } from "@/actions/pantry";
import { createRecipe, deleteRecipe } from "@/actions/recipes";
import { markMealCooked, deleteMealPlanEntry } from "@/actions/mealPlans";
import { createTopic, updateTopic, deleteTopic, refreshTopic } from "@/actions/news";
import { addLocationByName, deleteLocation, setDefaultLocation, addPresetWatcher, deleteWatcher } from "@/actions/weather";
import { updatePet, setPetStatus, deletePet } from "@/actions/pets";
import { createUserReport } from "@/actions/reports";
import type { AIAction } from "@/app/api/llm/home/interpret/route";
import type { RecurringRule, TaskStatus, TaskPriority, ItemStatus, HealthKind, HealthStatus, PetStatus } from "@/types";
import { isoDate } from "@/lib/habitStats";

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

const SPECIES_MAP: Record<string, string> = {
  pies: "dog", piesek: "dog", kot: "cat", kotek: "cat", wąż: "snake", waz: "snake",
  jaszczurka: "lizard", gekon: "lizard", żółw: "turtle", zolw: "turtle", ryba: "fish",
  rybka: "fish", ptak: "bird", papuga: "bird", chomik: "rodent", szczur: "rodent",
  mysz: "rodent", świnka: "rodent", swinka: "rodent", królik: "rabbit", krolik: "rabbit",
};

async function findPetByName(userId: string, name: string) {
  const teamIds = await getUserTeamIds(userId);
  return prisma.pet.findFirst({
    where: {
      OR: [
        { ownerId: userId },
        teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" },
        { shares: { some: { userId } } },
        teamIds.length > 0 ? { shares: { some: { teamId: { in: teamIds } } } } : { id: "" },
      ],
      name: { contains: name, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function executePetAction(action: AIAction, userId: string): Promise<string> {
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
        breed: (params.breed as string) ?? null,
        sex: (params.sex as string) ?? null,
        ownerId: userId,
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
        ownerId: userId,
      },
    });
    const assignTo = (params.assignTo as string | undefined)?.trim();
    if (assignTo) {
      const target = await findPetByName(userId, assignTo);
      if (target) await prisma.pet.update({ where: { id: target.id }, data: { enclosureId: enc.id } });
    }
    return `Utworzono zbiornik "${enc.name}"`;
  }

  // Pozostałe akcje wymagają wskazania zwierzęcia po imieniu
  const pet = await findPetByName(userId, searchQuery ?? "");
  const needsPet = ["log_weight", "schedule_treatment", "schedule_care_task", "log_feeding", "record_vet_visit", "log_health_note", "log_environment", "record_sale", "add_breeding_pair", "update_pet", "set_pet_status", "delete_pet"];
  if (needsPet.includes(type) && !pet) {
    throw new Error(`Nie znaleziono zwierzęcia: "${searchQuery}"`);
  }

  if (type === "update_pet" && pet) {
    await updatePet(pet.id, { name: (params.name as string) ?? undefined, breed: (params.breed as string) ?? undefined });
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
        ownerId: userId,
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
        ownerId: userId,
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
      where: {
        OR: [
          { ownerId: userId },
          teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" },
          { shares: { some: { userId } } },
        ],
      },
      select: { id: true },
    })).map((p) => p.id);
    const t = await prisma.petTreatment.findFirst({
      where: { petId: { in: petIds }, name: { contains: searchQuery ?? "", mode: "insensitive" }, active: true },
    });
    if (!t) throw new Error(`Nie znaleziono zaplanowanego zabiegu: "${searchQuery}"`);
    const rule = parseRecurringRule(t.recurring);
    const base = t.nextDueAt ?? new Date();
    let nextDueAt: Date | null = rule ? computeNextDue(base, rule) : null;
    if (nextDueAt && rule?.endDate && nextDueAt > new Date(rule.endDate)) nextDueAt = null;
    await prisma.petCareLog.create({ data: { petId: t.petId, treatmentId: t.id, category: t.kind } });
    await prisma.petTreatment.update({ where: { id: t.id }, data: { lastDoneAt: new Date(), nextDueAt } });
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

export interface ActionResult {
  id: string;
  success: boolean;
  description: string;
  error?: string;
  // Opcjonalny cel przekierowania po utworzeniu rekordu (params.openAfter).
  navigateTo?: string;
  navigateLabel?: string;
}

// Wynik pojedynczej akcji: komunikat + opcjonalna propozycja przejścia do utworzonego widoku.
interface ExecOutcome {
  message: string;
  navigateTo?: string;
  navigateLabel?: string;
}

// ── Helpery rozwiązywania rekordów (id-first, z fallbackiem po searchQuery) ──────────────
// WAŻNE (bezpieczeństwo): payload `execute` jest edytowalny po stronie klienta, więc nigdy
// nie ufamy id z klienta. Dla ścieżki id zwracamy je i pozwalamy Server Action zweryfikować
// własność (assert*Access). Dla fallbacku po nazwie szukamy WYŁĄCZNIE w zakresie użytkownika.

async function accessibleListIds(userId: string): Promise<string[]> {
  const teamIds = await getUserTeamIds(userId);
  const lists = await prisma.shoppingList.findMany({
    where: { OR: teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }] },
    select: { id: true },
  });
  return lists.map((l) => l.id);
}

async function resolveOrCreateList(
  userId: string,
  opts: { listId?: string; listName?: string; activeListId?: string }
): Promise<{ id: string; name: string }> {
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];

  let list =
    (opts.listId && (await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id: opts.listId } }))) || null;
  if (!list && opts.listName) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, name: { contains: opts.listName, mode: "insensitive" } } });
  }
  if (!list && opts.activeListId) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id: opts.activeListId } });
  }
  if (!list) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr }, orderBy: { createdAt: "asc" } });
  }
  if (!list) {
    const created = await createList("Zakupy");
    return { id: created.id, name: created.name };
  }
  return { id: list.id, name: list.name };
}

async function resolveListId(
  userId: string,
  params: Record<string, unknown>,
  searchQuery?: string,
  activeListId?: string
): Promise<string> {
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
  const id = asStr(params.listId);
  if (id) {
    const l = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id } });
    if (l) return l.id;
  }
  if (searchQuery) {
    const l = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, name: { contains: searchQuery, mode: "insensitive" } } });
    if (l) return l.id;
  }
  if (activeListId) {
    const l = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id: activeListId } });
    if (l) return l.id;
  }
  throw new Error(`Nie znaleziono listy: "${searchQuery ?? asStr(params.listId) ?? ""}"`);
}

async function resolveItemId(userId: string, params: Record<string, unknown>, searchQuery?: string): Promise<string> {
  const id = asStr(params.itemId);
  if (id) return id; // updateItem*/deleteItem same w sobie asertują dostęp
  const listIds = await accessibleListIds(userId);
  const item = await prisma.item.findFirst({
    where: { listId: { in: listIds }, name: { contains: searchQuery ?? "", mode: "insensitive" } },
  });
  if (!item) throw new Error(`Nie znaleziono produktu: "${searchQuery}"`);
  return item.id;
}

async function resolveTaskId(
  userId: string,
  params: Record<string, unknown>,
  searchQuery?: string,
  opts?: { notDone?: boolean }
): Promise<string> {
  const id = asStr(params.taskId);
  if (id) return id; // updateTask/deleteTask asertują dostęp
  const task = await prisma.task.findFirst({
    where: {
      OR: [
        { createdById: userId },
        { assigneeId: userId },
        { project: { ownerId: userId } },
        { project: { members: { some: { userId } } } },
      ],
      title: { contains: searchQuery ?? "", mode: "insensitive" },
      ...(opts?.notDone ? { status: { notIn: ["DONE", "CANCELLED"] } } : {}),
    },
  });
  if (!task) throw new Error(`Nie znaleziono zadania: "${searchQuery}"`);
  return task.id;
}

async function resolveProjectIdForCreate(
  userId: string,
  projectName?: string,
  currentProjectId?: string
): Promise<string | null> {
  if (projectName) {
    const p = await prisma.taskProject.findFirst({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }], name: { contains: projectName, mode: "insensitive" } },
    });
    if (p) return p.id;
  }
  if (currentProjectId) {
    const p = await prisma.taskProject.findFirst({
      where: { id: currentProjectId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
    if (p) return p.id;
  }
  const inbox = await prisma.taskProject.findFirst({ where: { ownerId: userId, isInbox: true } });
  return inbox?.id ?? null;
}

async function resolveNoteId(userId: string, params: Record<string, unknown>, searchQuery?: string): Promise<string> {
  const id = asStr(params.noteId);
  if (id) return id;
  const teamIds = await getUserTeamIds(userId);
  const note = await prisma.note.findFirst({
    where: {
      OR: teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }],
      AND: {
        OR: [
          { title: { contains: searchQuery ?? "", mode: "insensitive" } },
          { content: { contains: searchQuery ?? "", mode: "insensitive" } },
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!note) throw new Error(`Nie znaleziono notatki: "${searchQuery}"`);
  return note.id;
}

async function resolveHealthEventId(userId: string, params: Record<string, unknown>, searchQuery?: string): Promise<string> {
  const id = asStr(params.eventId);
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
  if (id) {
    const ev = await prisma.healthEvent.findFirst({ where: { OR: ownerOr, id } });
    if (ev) return ev.id;
  }
  const ev = await prisma.healthEvent.findFirst({
    where: { OR: ownerOr, title: { contains: searchQuery ?? "", mode: "insensitive" } },
    orderBy: { scheduledAt: "desc" },
  });
  if (!ev) throw new Error(`Nie znaleziono wpisu zdrowia: "${searchQuery}"`);
  return ev.id;
}

async function resolveDeckId(userId: string, params: Record<string, unknown>, deckName?: string): Promise<string> {
  const id = asStr(params.deckId);
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
  if (id) {
    const d = await prisma.languageDeck.findFirst({ where: { OR: ownerOr, id } });
    if (d) return d.id;
  }
  const name = deckName ?? asStr(params.deckName);
  if (name) {
    const d = await prisma.languageDeck.findFirst({ where: { OR: ownerOr, name: { contains: name, mode: "insensitive" } } });
    if (d) return d.id;
  }
  const first = await prisma.languageDeck.findFirst({ where: { OR: ownerOr }, orderBy: { updatedAt: "desc" } });
  if (!first) throw new Error("Brak talii fiszek — utwórz najpierw talię");
  return first.id;
}

async function ownerOrArr(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];
}

// Generyczny resolver „id z paramu LUB pierwszy pasujący po nazwie w zakresie użytkownika".
// `finder` dostaje warunek `where` i zwraca rekord {id} albo null. Bezpieczeństwo: zawsze
// zawężamy do własności użytkownika/zespołu, więc id z klienta nie pozwoli sięgnąć cudzych danych.
async function resolveByName(
  finder: (where: Record<string, unknown>) => Promise<{ id: string } | null>,
  ownerOr: Record<string, unknown>[],
  idVal: string | undefined,
  nameField: string,
  query: string | undefined,
  label: string
): Promise<string> {
  if (idVal) {
    const byId = await finder({ OR: ownerOr, id: idVal });
    if (byId) return byId.id;
  }
  if (query) {
    const byName = await finder({ OR: ownerOr, [nameField]: { contains: query, mode: "insensitive" } });
    if (byName) return byName.id;
  }
  throw new Error(`Nie znaleziono: ${label} „${query ?? idVal ?? ""}"`);
}

async function executeAction(
  action: AIAction,
  userId: string,
  activeListId?: string,
  currentProjectId?: string
): Promise<string | ExecOutcome> {
  const { module, type, params, searchQuery } = action;

  if (module === "shopping") {
    if (type === "add_item") {
      const rawText = (params.rawText as string) ?? "";
      const list = await resolveOrCreateList(userId, {
        listId: asStr(params.listId),
        listName: asStr(params.listName),
        activeListId,
      });
      const item = await addItem(list.id, rawText.trim() || "Produkt");
      const msg = `Dodano "${item.name}" do listy "${list.name}"`;
      if (params.openAfter === true) {
        return { message: msg, navigateTo: `/shopping/${list.id}`, navigateLabel: `Otwórz „${list.name}”` };
      }
      return msg;
    }

    if (type === "update_item_status") {
      const status = (asStr(params.status) ?? "DONE") as ItemStatus;
      const id = await resolveItemId(userId, params, searchQuery);
      const item = await updateItemStatus(id, status);
      return `Zaktualizowano status "${item.name}" → ${status}`;
    }

    if (type === "update_item") {
      const id = await resolveItemId(userId, params, searchQuery);
      const patch: Parameters<typeof updateItem>[1] = {};
      if (params.name !== undefined) patch.name = String(params.name);
      if (params.quantity !== undefined) {
        const q = asStr(params.quantity) ?? (params.quantity as number | null | undefined);
        patch.quantity = q == null || q === "" ? null : Number(q);
      }
      if (params.unit !== undefined) patch.unit = asStr(params.unit) ?? null;
      const item = await updateItem(id, patch);
      return `Zaktualizowano "${item.name}"`;
    }

    if (type === "delete_item") {
      const id = await resolveItemId(userId, params, searchQuery);
      const existing = await prisma.item.findUnique({ where: { id }, select: { name: true } });
      await deleteItem(id);
      return `Usunięto "${existing?.name ?? "produkt"}" z listy zakupów`;
    }

    if (type === "create_list") {
      const name = asStr(params.name) ?? "Nowa lista";
      const list = await createList(name);
      const msg = `Utworzono listę "${list.name}"`;
      if (params.openAfter === true) {
        return { message: msg, navigateTo: `/shopping/${list.id}`, navigateLabel: `Otwórz „${list.name}”` };
      }
      return msg;
    }

    if (type === "rename_list") {
      const id = await resolveListId(userId, params, searchQuery, activeListId);
      const name = asStr(params.name) ?? "Lista";
      const list = await renameList(id, name);
      return `Zmieniono nazwę listy na "${list.name}"`;
    }

    if (type === "archive_list") {
      const id = await resolveListId(userId, params, searchQuery, activeListId);
      await archiveList(id);
      return `Zarchiwizowano listę`;
    }
  }

  if (module === "tasks") {
    if (type === "create_task") {
      const title = asStr(params.title) ?? "Nowe zadanie";
      const priority = (asStr(params.priority) ?? "NONE") as TaskPriority;
      const dueDate = params.dueDate ? new Date(params.dueDate as string) : null;
      const projectId = await resolveProjectIdForCreate(userId, asStr(params.projectName), currentProjectId);
      const task = await createTask({
        title,
        priority,
        dueDate,
        description: asStr(params.description) ?? null,
        projectId,
      });
      const msg = `Utworzono zadanie "${task.title}"`;
      if (params.openAfter === true) {
        const view = task.projectId ?? "all";
        return { message: msg, navigateTo: `/tasks/${view}?task=${task.id}`, navigateLabel: `Otwórz „${task.title}”` };
      }
      return msg;
    }

    if (type === "update_task") {
      const id = await resolveTaskId(userId, params, searchQuery);
      const patch: Parameters<typeof updateTask>[1] = {};
      if (params.title !== undefined) patch.title = String(params.title);
      if (params.description !== undefined) patch.description = asStr(params.description) ?? null;
      if (params.priority !== undefined) patch.priority = String(params.priority) as TaskPriority;
      if (params.status !== undefined) patch.status = String(params.status) as TaskStatus;
      if (params.dueDate !== undefined) patch.dueDate = params.dueDate ? new Date(String(params.dueDate)) : null;
      const task = await updateTask(id, patch);
      return `Zaktualizowano zadanie "${task.title}"`;
    }

    if (type === "update_task_status") {
      const id = await resolveTaskId(userId, params, searchQuery);
      const status = (asStr(params.status) ?? "DONE") as TaskStatus;
      const task = await updateTask(id, { status });
      return `Zmieniono status "${task.title}" → ${status}`;
    }

    if (type === "shift_task_due_date") {
      const id = await resolveTaskId(userId, params, searchQuery, { notDone: true });
      const days = Number(params.days ?? 0);
      const existing = await prisma.task.findUnique({ where: { id }, select: { dueDate: true } });
      const newDate = addDays(existing?.dueDate ?? new Date(), days);
      const task = await updateTask(id, { dueDate: newDate });
      return `Przesunięto termin "${task.title}" o ${days > 0 ? "+" : ""}${days} dni`;
    }

    if (type === "delete_task") {
      const id = await resolveTaskId(userId, params, searchQuery);
      const existing = await prisma.task.findUnique({ where: { id }, select: { title: true } });
      await deleteTask(id);
      return `Usunięto zadanie "${existing?.title ?? ""}"`;
    }

    if (type === "create_project") {
      const name = asStr(params.name) ?? "Nowy projekt";
      const project = await createTaskProject(name, { emoji: asStr(params.emoji) });
      const msg = `Utworzono projekt "${project.name}"`;
      if (params.openAfter === true) {
        return { message: msg, navigateTo: `/tasks/${project.id}`, navigateLabel: `Otwórz „${project.name}”` };
      }
      return msg;
    }
  }

  if (module === "notes") {
    if (type === "create_note") {
      const note = await createNote({ title: asStr(params.title) ?? "Nowa notatka", content: asStr(params.content) ?? "" });
      const msg = `Utworzono notatkę "${note.title}"`;
      if (params.openAfter === true) {
        return { message: msg, navigateTo: `/notes?focus=${note.id}`, navigateLabel: `Otwórz „${note.title}”` };
      }
      return msg;
    }

    if (type === "append_to_note") {
      const id = await resolveNoteId(userId, params, searchQuery);
      const existing = await prisma.note.findUnique({ where: { id }, select: { content: true } });
      const addition = asStr(params.content) ?? "";
      const newContent = existing?.content ? `${existing.content}\n\n${addition}` : addition;
      const note = await updateNote(id, { content: newContent });
      return `Dopisano do notatki "${note.title}"`;
    }

    if (type === "update_note") {
      const id = await resolveNoteId(userId, params, searchQuery);
      const patch: Parameters<typeof updateNote>[1] = {};
      if (params.title !== undefined) patch.title = String(params.title);
      if (params.content !== undefined) patch.content = String(params.content);
      const note = await updateNote(id, patch);
      return `Zaktualizowano notatkę "${note.title}"`;
    }

    if (type === "delete_note") {
      const id = await resolveNoteId(userId, params, searchQuery);
      const existing = await prisma.note.findUnique({ where: { id }, select: { title: true } });
      await deleteNote(id);
      return `Usunięto notatkę "${existing?.title ?? ""}"`;
    }
  }

  if (module === "pets") {
    return executePetAction(action, userId);
  }

  // ── Nawyki ────────────────────────────────────────────────────────────────
  if (module === "habits") {
    if (type === "toggle_habit") {
      const q = (searchQuery ?? asStr(params.habitName) ?? "").toLowerCase();
      if (!q) throw new Error("Podaj nazwę nawyku");
      const teamIds = await getUserTeamIds(userId);
      const habit = await prisma.habit.findFirst({
        where: {
          archived: false,
          OR: [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }],
          name: { contains: q, mode: "insensitive" },
        },
      });
      if (!habit) throw new Error(`Nie znaleziono nawyku pasującego do „${q}"`);
      const result = await toggleHabitDay(habit.id, isoDate(new Date()));
      return result.done ? `Odhaczono nawyk „${habit.name}"` : `Cofnięto odhaczenie nawyku „${habit.name}"`;
    }
  }

  // ── Portfel ───────────────────────────────────────────────────────────────
  if (module === "portfel") {
    if (type === "add_expense" || type === "add_income") {
      const amount = Number(params.amount);
      if (!amount || isNaN(amount) || amount <= 0) throw new Error("Podaj kwotę większą od zera");
      const kind: "expense" | "income" = type === "add_expense" ? "expense" : "income";
      const elementName = asStr(params.elementName);
      const elements = await getWalletElements();
      let element = elements[0];
      if (elementName) {
        const found = elements.find((e) => e.name.toLowerCase().includes(elementName.toLowerCase()));
        if (found) element = found;
      }
      if (!element) throw new Error("Brak elementów portfela — utwórz konto w /portfel");
      await addEntry(element.id, {
        kind,
        amount,
        category: asStr(params.category) ?? null,
        note: asStr(params.note) ?? null,
      });
      const prefix = kind === "expense" ? "Wydatek" : "Przychód";
      return `${prefix} ${amount} zł${params.category ? ` (${params.category})` : ""} dodany do „${element.name}"`;
    }
  }

  // ── Kuchnia ───────────────────────────────────────────────────────────────
  if (module === "kitchen") {
    if (type === "plan_meal") {
      const customTitle = asStr(params.customTitle);
      if (!customTitle) throw new Error("Podaj nazwę posiłku");
      const dateStr = asStr(params.date);
      const date = dateStr ? new Date(dateStr) : new Date();
      const slot = (asStr(params.slot) as "breakfast" | "lunch" | "dinner" | "snack") ?? "dinner";
      const entry = await setMealPlanEntry({ date, slot, customTitle });
      const dateLabel = isoDate(date);
      return `Zaplanowano „${customTitle}" na ${dateLabel} (${slot})`;
    }
  }

  // ── Flota ─────────────────────────────────────────────────────────────────
  if (module === "flota") {
    if (type === "add_fuel_log") {
      const liters = Number(params.liters);
      if (!liters || isNaN(liters) || liters <= 0) throw new Error("Podaj liczbę litrów większą od zera");
      const teamIds = await getUserTeamIds(userId);
      const vehicleName = asStr(params.vehicleName);
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }],
          ...(vehicleName ? { name: { contains: vehicleName, mode: "insensitive" } } : {}),
        },
        orderBy: { updatedAt: "desc" },
      });
      if (!vehicle) throw new Error("Nie znaleziono pojazdu w Flocie");
      const odometer = Number(params.odometer) || vehicle.odometer || 0;
      const totalCost = params.totalCost != null ? Number(params.totalCost) : null;
      await addFuelLog(vehicle.id, { liters, totalCost, odometer, note: asStr(params.note) });
      return `Dodano tankowanie ${liters} L${totalCost ? ` (${totalCost} zł)` : ""} — ${vehicle.name}`;
    }
  }

  // ── Magazynowanie ───────────────────────────────────────────────────────────
  if (module === "magazynowanie") {
    if (type === "add_storage_item") {
      const name = asStr(params.name);
      if (!name) throw new Error("Podaj nazwę pozycji");
      await addStorageItem({
        name,
        quantity: params.quantity != null ? Number(params.quantity) : null,
        unit: asStr(params.unit) ?? null,
        warehouse: asStr(params.warehouse) ?? null,
        location: asStr(params.location) ?? null,
        category: asStr(params.category) ?? null,
      });
      return `Dodano do magazynu: ${name}`;
    }

    if (type === "adjust_storage") {
      const delta = Number(params.delta);
      if (!delta || isNaN(delta)) throw new Error("Podaj zmianę ilości (np. -3)");
      const query = action.searchQuery?.trim();
      if (!query) throw new Error("Wskaż pozycję magazynową");
      const teamIds = await getUserTeamIds(userId);
      const item = await prisma.storageItem.findFirst({
        where: {
          OR: [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }],
          name: { contains: query, mode: "insensitive" },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (!item) throw new Error(`Nie znaleziono pozycji „${query}" w magazynie`);
      const updated = await adjustStorageQuantity(item.id, delta, delta > 0 ? "przyjęcie" : "wydanie", "AI");
      return `${delta > 0 ? "Przyjęto" : "Wydano"} ${Math.abs(delta)} — ${item.name} (stan: ${updated.quantity ?? 0})`;
    }
  }

  // ── Nawyki (tworzenie) ──────────────────────────────────────────────────────
  if (module === "habits" && type === "create_habit") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę nawyku");
    const habit = await createHabit({
      name,
      description: asStr(params.description) ?? null,
      icon: asStr(params.icon),
    });
    return `Utworzono nawyk „${habit.name}"`;
  }

  // ── Kuchnia (spiżarnia) ──────────────────────────────────────────────────────
  if (module === "kitchen" && type === "add_pantry_item") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę produktu");
    const item = await addPantryItem({
      name,
      quantity: params.quantity != null ? Number(params.quantity) : null,
      unit: asStr(params.unit) ?? null,
      expiresAt: params.expiresAt ? new Date(String(params.expiresAt)) : null,
    });
    return `Dodano do spiżarni: ${item.name}`;
  }

  // ── Portfel (nowy element) ───────────────────────────────────────────────────
  if (module === "portfel" && type === "create_wallet_element") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę elementu portfela");
    const el = await createElement({
      name,
      kind: asStr(params.kind),
      initialBalance: params.initialBalance != null ? Number(params.initialBalance) : 0,
    });
    return `Utworzono element portfela „${el.name}"`;
  }

  // ── Flota (serwis) ───────────────────────────────────────────────────────────
  if (module === "flota" && type === "add_service_record") {
    const teamIds = await getUserTeamIds(userId);
    const vehicleName = asStr(params.vehicleName);
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }],
        ...(vehicleName ? { name: { contains: vehicleName, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!vehicle) throw new Error("Nie znaleziono pojazdu w Flocie");
    await addServiceRecord(vehicle.id, {
      type: asStr(params.serviceType) ?? "other",
      cost: params.cost != null ? Number(params.cost) : null,
      odometer: params.odometer != null ? Number(params.odometer) : null,
      note: asStr(params.note) ?? null,
    });
    return `Dodano wpis serwisowy — ${vehicle.name}`;
  }

  // ── Zdrowie ──────────────────────────────────────────────────────────────────
  if (module === "health") {
    if (type === "create_health_event") {
      const title = asStr(params.title);
      if (!title) throw new Error("Podaj tytuł wizyty/badania");
      const kind = (asStr(params.kind) === "TEST" ? "TEST" : "VISIT") as HealthKind;
      const scheduledAt = params.scheduledAt ? new Date(String(params.scheduledAt)) : new Date();
      const ev = await createHealthEvent({
        kind,
        title,
        scheduledAt,
        doctorName: asStr(params.doctorName) ?? null,
        specialty: asStr(params.specialty) ?? null,
        facility: asStr(params.facility) ?? null,
        notes: asStr(params.notes) ?? null,
      });
      const msg = `Dodano ${kind === "TEST" ? "badanie" : "wizytę"}: „${ev.title}"`;
      if (params.openAfter === true) return { message: msg, navigateTo: `/health`, navigateLabel: "Otwórz Zdrowie" };
      return msg;
    }
    if (type === "update_health_event") {
      const id = await resolveHealthEventId(userId, params, searchQuery);
      const patch: Parameters<typeof updateHealthEvent>[1] = {};
      if (params.title !== undefined) patch.title = String(params.title);
      if (params.scheduledAt !== undefined) patch.scheduledAt = new Date(String(params.scheduledAt));
      if (params.notes !== undefined) patch.notes = asStr(params.notes) ?? null;
      if (params.status !== undefined) patch.status = String(params.status) as HealthStatus;
      await updateHealthEvent(id, patch);
      return `Zaktualizowano wpis zdrowia`;
    }
    if (type === "set_health_status") {
      const id = await resolveHealthEventId(userId, params, searchQuery);
      const status = (asStr(params.status) ?? "DONE") as HealthStatus;
      await setHealthStatus(id, status);
      return `Zmieniono status wpisu zdrowia → ${status}`;
    }
    if (type === "delete_health_event") {
      const id = await resolveHealthEventId(userId, params, searchQuery);
      await deleteHealthEvent(id);
      return `Usunięto wpis zdrowia`;
    }
  }

  // ── Języki (fiszki) ──────────────────────────────────────────────────────────
  if (module === "languages") {
    if (type === "create_deck") {
      const name = asStr(params.name);
      if (!name) throw new Error("Podaj nazwę talii");
      const deck = await createDeck({
        name,
        nativeLang: asStr(params.nativeLang) ?? "polski",
        targetLang: asStr(params.targetLang) ?? "angielski",
      });
      return `Utworzono talię „${deck.name}"`;
    }
    if (type === "add_word") {
      const term = asStr(params.term);
      const translation = asStr(params.translation);
      if (!term || !translation) throw new Error("Podaj słówko i tłumaczenie");
      const deckId = await resolveDeckId(userId, params, asStr(params.deckName));
      const card = await addWord(deckId, { term, translation, example: asStr(params.example) ?? null });
      return `Dodano fiszkę „${card.term}" → „${card.translation}"`;
    }
    if (type === "delete_word") {
      const id = asStr(params.wordId);
      if (!id) throw new Error("Wskaż fiszkę do usunięcia");
      await deleteWord(id);
      return `Usunięto fiszkę`;
    }
  }

  // ── Wiadomości (tematy) ──────────────────────────────────────────────────────
  if (module === "news") {
    if (type === "create_news_topic") {
      const title = asStr(params.title);
      if (!title) throw new Error("Podaj tytuł tematu");
      const topic = await createTopic({ title, semanticFilter: asStr(params.semanticFilter) ?? title });
      const msg = `Utworzono temat wiadomości „${title}"`;
      if (params.openAfter === true) return { message: msg, navigateTo: `/wiadomosci`, navigateLabel: "Otwórz Wiadomości" };
      return msg;
    }
    if (type === "delete_news_topic") {
      const id = asStr(params.topicId);
      let topicId = id;
      if (!topicId && searchQuery) {
        const t = await prisma.newsTopic.findFirst({
          where: { ownerId: userId, title: { contains: searchQuery, mode: "insensitive" } },
        });
        topicId = t?.id;
      }
      if (!topicId) throw new Error(`Nie znaleziono tematu: "${searchQuery}"`);
      await deleteTopic(topicId);
      return `Usunięto temat wiadomości`;
    }
  }

  // ── Pogoda (lokalizacje) ──────────────────────────────────────────────────────
  if (module === "weather") {
    if (type === "add_weather_location") {
      const name = asStr(params.name);
      if (!name) throw new Error("Podaj nazwę miejscowości");
      const loc = await addLocationByName(name);
      const msg = `Dodano lokalizację pogodową „${loc.label ?? name}"`;
      if (params.openAfter === true) return { message: msg, navigateTo: `/pogoda`, navigateLabel: "Otwórz Pogodę" };
      return msg;
    }
    if (type === "delete_weather_location") {
      const id = asStr(params.locationId);
      let locId = id;
      if (!locId && searchQuery) {
        const l = await prisma.weatherLocation.findFirst({
          where: { ownerId: userId, label: { contains: searchQuery, mode: "insensitive" } },
        });
        locId = l?.id;
      }
      if (!locId) throw new Error(`Nie znaleziono lokalizacji: "${searchQuery}"`);
      await deleteLocation(locId);
      return `Usunięto lokalizację pogodową`;
    }
  }

  // ── Raporty (zapis wyniku / sesji) ────────────────────────────────────────────
  if (module === "reports" && type === "save_report") {
    const title = asStr(params.title) ?? "Raport z asystenta";
    const content = asStr(params.content) ?? String(params.content ?? "");
    if (!content.trim()) throw new Error("Pusta treść raportu");
    const report = await createUserReport({ title, content });
    return { message: `Zapisano raport „${title}"`, navigateTo: `/reports/${report.slug}`, navigateLabel: "Otwórz raport" };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DODATKOWE AKCJE CRUD (domknięcie pokrycia zapisu do ~100% encji użytkownika).
  // Każda mapuje na istniejący Server Action; id rozwiązywane id-first + po nazwie
  // w zakresie własności użytkownika/zespołu.
  // ════════════════════════════════════════════════════════════════════════════
  const teamOr = await ownerOrArr(userId);

  // ── Zakupy (rozszerzenie) ─────────────────────────────────────────────────────
  if (module === "shopping") {
    if (type === "delete_list") {
      const id = await resolveListId(userId, params, searchQuery, activeListId);
      await deleteList(id);
      return `Usunięto listę zakupów`;
    }
    if (type === "clear_done_items") {
      const id = await resolveListId(userId, params, searchQuery, activeListId);
      await clearDoneItems(id);
      return `Wyczyszczono kupione pozycje z listy`;
    }
    if (type === "mark_all_in_cart") {
      const id = await resolveListId(userId, params, searchQuery, activeListId);
      await markAllInCart(id);
      return `Oznaczono wszystkie pozycje jako w koszyku`;
    }
  }

  // ── Zadania (projekty) ────────────────────────────────────────────────────────
  if (module === "tasks") {
    const resolveProject = async () => {
      const projOr = [{ ownerId: userId }, { members: { some: { userId } } }];
      const id = asStr(params.projectId);
      if (id) { const p = await prisma.taskProject.findFirst({ where: { OR: projOr, id } }); if (p) return p.id; }
      const q = searchQuery ?? asStr(params.name) ?? "";
      const p = await prisma.taskProject.findFirst({ where: { OR: projOr, name: { contains: q, mode: "insensitive" } } });
      if (!p) throw new Error(`Nie znaleziono projektu: "${q}"`);
      return p.id;
    };
    if (type === "update_project") {
      const id = await resolveProject();
      await updateTaskProject(id, { name: asStr(params.name), emoji: asStr(params.emoji), description: asStr(params.description) });
      return `Zaktualizowano projekt`;
    }
    if (type === "delete_project") {
      const id = await resolveProject();
      await deleteTaskProject(id);
      return `Usunięto projekt`;
    }
  }

  // ── Notatki (przypięcie) ──────────────────────────────────────────────────────
  if (module === "notes" && type === "toggle_pin") {
    const id = await resolveNoteId(userId, params, searchQuery);
    const note = await toggleNotePin(id);
    return note.pinned ? `Przypięto notatkę „${note.title}"` : `Odpięto notatkę „${note.title}"`;
  }

  // ── Nawyki (edycja/archiwum/usuwanie) ─────────────────────────────────────────
  if (module === "habits") {
    const resolveHabit = () => resolveByName((w) => prisma.habit.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.habitId), "name", searchQuery ?? asStr(params.name), "nawyk");
    if (type === "update_habit") {
      const id = await resolveHabit();
      await updateHabit(id, { name: asStr(params.name), description: asStr(params.description), icon: asStr(params.icon) });
      return `Zaktualizowano nawyk`;
    }
    if (type === "archive_habit") {
      const id = await resolveHabit();
      await setHabitArchived(id, params.archived !== false);
      return params.archived === false ? `Przywrócono nawyk` : `Zarchiwizowano nawyk`;
    }
    if (type === "delete_habit") {
      const id = await resolveHabit();
      await deleteHabit(id);
      return `Usunięto nawyk`;
    }
  }

  // ── Portfel (edycja/saldo/archiwum/usuwanie) ─────────────────────────────────
  if (module === "portfel") {
    const resolveEl = () => resolveByName((w) => prisma.walletElement.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.elementId), "name", searchQuery ?? asStr(params.elementName), "element portfela");
    if (type === "update_wallet_element") {
      const id = await resolveEl();
      await updateElement(id, { name: asStr(params.name), note: asStr(params.note) ?? null });
      return `Zaktualizowano element portfela`;
    }
    if (type === "set_wallet_balance") {
      const id = await resolveEl();
      const targetBalance = Number(params.amount ?? params.targetBalance);
      if (isNaN(targetBalance)) throw new Error("Podaj docelowe saldo");
      await setBalance(id, { targetBalance, note: asStr(params.note) ?? null });
      return `Ustawiono saldo na ${targetBalance}`;
    }
    if (type === "archive_wallet_element") {
      const id = await resolveEl();
      await archiveElement(id, params.archived !== false);
      return params.archived === false ? `Przywrócono element portfela` : `Zarchiwizowano element portfela`;
    }
    if (type === "delete_wallet_element") {
      const id = await resolveEl();
      await deleteElement(id);
      return `Usunięto element portfela`;
    }
  }

  // ── Kuchnia (przepisy/jadłospis/spiżarnia) ───────────────────────────────────
  if (module === "kitchen") {
    if (type === "create_recipe") {
      const title = asStr(params.title);
      if (!title) throw new Error("Podaj tytuł przepisu");
      const recipe = await createRecipe({
        title,
        description: asStr(params.description) ?? null,
        servings: params.servings != null ? Number(params.servings) : undefined,
        introMarkdown: asStr(params.body) ?? null,
      });
      const msg = `Utworzono przepis „${recipe.title}"`;
      if (params.openAfter === true) return { message: msg, navigateTo: `/kitchen/recipes/${recipe.id}`, navigateLabel: `Otwórz „${recipe.title}"` };
      return msg;
    }
    if (type === "delete_recipe") {
      const id = await resolveByName((w) => prisma.recipe.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.recipeId), "title", searchQuery, "przepis");
      await deleteRecipe(id);
      return `Usunięto przepis`;
    }
    if (type === "mark_meal_cooked") {
      const id = await resolveByName((w) => prisma.mealPlanEntry.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.entryId), "customTitle", searchQuery, "posiłek");
      await markMealCooked(id);
      return `Oznaczono posiłek jako ugotowany`;
    }
    if (type === "delete_meal_plan") {
      const id = await resolveByName((w) => prisma.mealPlanEntry.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.entryId), "customTitle", searchQuery, "posiłek");
      await deleteMealPlanEntry(id);
      return `Usunięto pozycję jadłospisu`;
    }
    const resolvePantry = () => resolveByName((w) => prisma.pantryItem.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.pantryItemId), "name", searchQuery ?? asStr(params.name), "pozycja spiżarni");
    if (type === "update_pantry_item") {
      const id = await resolvePantry();
      await updatePantryItem(id, { quantity: params.quantity != null ? Number(params.quantity) : undefined, unit: asStr(params.unit), expiresAt: params.expiresAt ? new Date(String(params.expiresAt)) : undefined });
      return `Zaktualizowano pozycję spiżarni`;
    }
    if (type === "consume_pantry") {
      const id = await resolvePantry();
      const qty = Number(params.quantity ?? 1);
      await consumePantryItem(id, qty);
      return `Zużyto ${qty} ze spiżarni`;
    }
    if (type === "delete_pantry_item") {
      const id = await resolvePantry();
      await deletePantryItem(id);
      return `Usunięto pozycję spiżarni`;
    }
  }

  // ── Flota (pojazdy) ───────────────────────────────────────────────────────────
  if (module === "flota") {
    if (type === "create_vehicle") {
      const name = asStr(params.name);
      if (!name) throw new Error("Podaj nazwę pojazdu");
      const v = await createVehicle({ name, make: asStr(params.make) ?? null, model: asStr(params.model) ?? null, plate: asStr(params.plate) ?? null, year: params.year != null ? Number(params.year) : null });
      const msg = `Dodano pojazd „${v.name}"`;
      if (params.openAfter === true) return { message: msg, navigateTo: `/flota/${v.id}`, navigateLabel: `Otwórz „${v.name}"` };
      return msg;
    }
    const resolveVeh = () => resolveByName((w) => prisma.vehicle.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.vehicleId), "name", searchQuery ?? asStr(params.vehicleName), "pojazd");
    if (type === "update_vehicle") {
      const id = await resolveVeh();
      await updateVehicle(id, { name: asStr(params.name), plate: asStr(params.plate) ?? null, odometer: params.odometer != null ? Number(params.odometer) : undefined });
      return `Zaktualizowano pojazd`;
    }
    if (type === "delete_vehicle") {
      const id = await resolveVeh();
      await deleteVehicle(id);
      return `Usunięto pojazd`;
    }
  }

  // ── Języki (edycja talii/fiszek) ──────────────────────────────────────────────
  if (module === "languages") {
    if (type === "update_deck") {
      const id = await resolveDeckId(userId, params, asStr(params.deckName) ?? searchQuery);
      await updateDeck(id, { name: asStr(params.name), nativeLang: asStr(params.nativeLang), targetLang: asStr(params.targetLang) });
      return `Zaktualizowano talię`;
    }
    if (type === "delete_deck") {
      const id = await resolveDeckId(userId, params, asStr(params.deckName) ?? searchQuery);
      await deleteDeck(id);
      return `Usunięto talię`;
    }
    if (type === "update_word") {
      let id = asStr(params.wordId);
      if (!id) {
        const q = searchQuery ?? asStr(params.term) ?? "";
        const card = await prisma.vocabulary.findFirst({ where: { term: { contains: q, mode: "insensitive" }, deck: { OR: teamOr } }, select: { id: true } });
        if (!card) throw new Error(`Nie znaleziono fiszki: "${q}"`);
        id = card.id;
      }
      await updateWord(id, { term: asStr(params.term), translation: asStr(params.translation), example: asStr(params.example) });
      return `Zaktualizowano fiszkę`;
    }
  }

  // ── Wiadomości (edycja/odświeżanie tematu) ────────────────────────────────────
  if (module === "news") {
    const resolveTopic = async () => {
      const id = asStr(params.topicId);
      if (id) { const t = await prisma.newsTopic.findFirst({ where: { ownerId: userId, id } }); if (t) return t.id; }
      const t = await prisma.newsTopic.findFirst({ where: { ownerId: userId, title: { contains: searchQuery ?? asStr(params.title) ?? "", mode: "insensitive" } } });
      if (!t) throw new Error(`Nie znaleziono tematu: "${searchQuery}"`);
      return t.id;
    };
    if (type === "update_news_topic") {
      const id = await resolveTopic();
      await updateTopic(id, { title: asStr(params.title), semanticFilter: asStr(params.semanticFilter) });
      return `Zaktualizowano temat wiadomości`;
    }
    if (type === "refresh_news_topic") {
      const id = await resolveTopic();
      const r = await refreshTopic(id);
      return `Odświeżono temat — nowych pozycji: ${r.added}`;
    }
  }

  // ── Pogoda (domyślna lokalizacja / obserwatorzy) ─────────────────────────────
  if (module === "weather") {
    if (type === "set_default_weather_location") {
      const id = asStr(params.locationId) ?? (await prisma.weatherLocation.findFirst({ where: { ownerId: userId, label: { contains: searchQuery ?? "", mode: "insensitive" } } }))?.id;
      if (!id) throw new Error(`Nie znaleziono lokalizacji: "${searchQuery}"`);
      await setDefaultLocation(id);
      return `Ustawiono domyślną lokalizację pogodową`;
    }
    if (type === "add_weather_watcher") {
      const preset = asStr(params.presetKey);
      if (!preset) throw new Error("Podaj preset obserwatora");
      await addPresetWatcher(preset);
      return `Dodano obserwatora pogody`;
    }
    if (type === "delete_weather_watcher") {
      const id = asStr(params.watcherId) ?? (await prisma.weatherWatcher.findFirst({ where: { ownerId: userId, title: { contains: searchQuery ?? "", mode: "insensitive" } } }))?.id;
      if (!id) throw new Error(`Nie znaleziono obserwatora: "${searchQuery}"`);
      await deleteWatcher(id);
      return `Usunięto obserwatora pogody`;
    }
  }

  // ── Magazyn (edycja/usuwanie/przesunięcie) ───────────────────────────────────
  if (module === "magazynowanie") {
    const resolveStorage = () => resolveByName((w) => prisma.storageItem.findFirst({ where: w, select: { id: true } }), teamOr, asStr(params.itemId), "name", searchQuery ?? asStr(params.name), "pozycja magazynu");
    if (type === "update_storage_item") {
      const id = await resolveStorage();
      await updateStorageItem(id, { name: asStr(params.name), unit: asStr(params.unit), warehouse: asStr(params.warehouse), location: asStr(params.location) });
      return `Zaktualizowano pozycję magazynu`;
    }
    if (type === "delete_storage_item") {
      const id = await resolveStorage();
      await deleteStorageItem(id);
      return `Usunięto pozycję magazynu`;
    }
    if (type === "transfer_storage") {
      const id = await resolveStorage();
      await transferStock(id, asStr(params.toWarehouse) ?? null, asStr(params.toLocation) ?? null, Number(params.quantity ?? 0));
      return `Przeniesiono pozycję magazynu`;
    }
  }

  throw new Error(`Nieznany typ akcji: ${module}/${type}`);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { actions?: AIAction[]; activeListId?: string; currentProjectId?: string };
  const { actions = [], activeListId, currentProjectId } = body;

  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      const out = await executeAction(action, session.user.id, activeListId, currentProjectId);
      const outcome: ExecOutcome = typeof out === "string" ? { message: out } : out;
      results.push({
        id: action.id,
        success: true,
        description: outcome.message,
        navigateTo: outcome.navigateTo,
        navigateLabel: outcome.navigateLabel,
      });
      // Audit log (znacznik pochodzenia AI)
      await prisma.userActivity.create({
        data: {
          userId: session.user.id,
          module: "llm",
          action: `${action.module}/${action.type}`,
          metadata: JSON.parse(JSON.stringify({ params: action.params, searchQuery: action.searchQuery, result: outcome.message })),
        },
      }).catch(() => {});
    } catch (e) {
      results.push({
        id: action.id,
        success: false,
        description: action.description,
        error: e instanceof Error ? e.message : "Nieznany błąd",
      });
    }
  }

  return NextResponse.json({ results });
}
