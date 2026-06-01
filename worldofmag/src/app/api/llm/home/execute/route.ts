import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/server-utils";
import { computeNextDue, parseRecurringRule } from "@/lib/recurrence";
import { createTask, updateTask, deleteTask } from "@/actions/tasks";
import { createTaskProject } from "@/actions/taskProjects";
import { addItem, updateItem, updateItemStatus, deleteItem } from "@/actions/items";
import { createList, renameList, archiveList } from "@/actions/lists";
import { createNote, updateNote, deleteNote } from "@/actions/notes";
import { toggleHabitDay } from "@/actions/habits";
import { addEntry, getWalletElements } from "@/actions/portfel";
import { setMealPlanEntry } from "@/actions/mealPlans";
import { addFuelLog } from "@/actions/flota";
import type { AIAction } from "@/app/api/llm/home/interpret/route";
import type { RecurringRule, TaskStatus, TaskPriority, ItemStatus } from "@/types";
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
  const needsPet = ["log_weight", "schedule_treatment", "schedule_care_task", "log_feeding", "record_vet_visit", "log_health_note", "log_environment", "record_sale", "add_breeding_pair"];
  if (needsPet.includes(type) && !pet) {
    throw new Error(`Nie znaleziono zwierzęcia: "${searchQuery}"`);
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
