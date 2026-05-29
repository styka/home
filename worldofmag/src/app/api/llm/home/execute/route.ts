import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { categorize } from "@/lib/categorize";
import { parseQuantity } from "@/lib/parseQuantity";
import { getUserTeamIds } from "@/lib/server-utils";
import { computeNextDue, parseRecurringRule } from "@/lib/recurrence";
import type { AIAction } from "@/app/api/llm/home/interpret/route";
import type { RecurringRule } from "@/types";

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
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
}

async function executeAction(action: AIAction, userId: string, activeListId?: string, currentProjectId?: string): Promise<string> {
  const { module, type, params, searchQuery } = action;

  if (module === "shopping") {
    if (type === "add_item") {
      const rawText = (params.rawText as string) ?? "";
      const listName = params.listName as string | undefined;

      let list = await prisma.shoppingList.findFirst({
        where: listName
          ? { ownerId: userId, name: { contains: listName, mode: "insensitive" } }
          : activeListId
            ? { id: activeListId, ownerId: userId }
            : { ownerId: userId },
        orderBy: listName || activeListId ? undefined : { createdAt: "asc" },
      });

      if (!list) {
        list = await prisma.shoppingList.create({
          data: { name: "Zakupy", ownerId: userId },
        });
      }

      const { name, quantity, unit } = parseQuantity(rawText.trim() || "Produkt");
      const category = categorize(name);
      const item = await prisma.item.create({
        data: { listId: list.id, name, quantity, unit, category },
      });
      return `Dodano "${item.name}" do listy "${list.name}"`;
    }

    if (type === "update_item_status") {
      const status = (params.status as string) ?? "DONE";
      const lists = await prisma.shoppingList.findMany({ where: { ownerId: userId }, select: { id: true } });
      const listIds = lists.map((l) => l.id);
      const item = await prisma.item.findFirst({
        where: {
          listId: { in: listIds },
          name: { contains: searchQuery ?? "", mode: "insensitive" },
        },
      });
      if (!item) throw new Error(`Nie znaleziono produktu: "${searchQuery}"`);
      await prisma.item.update({ where: { id: item.id }, data: { status } });
      return `Zaktualizowano status "${item.name}" → ${status}`;
    }

    if (type === "delete_item") {
      const lists = await prisma.shoppingList.findMany({ where: { ownerId: userId }, select: { id: true } });
      const listIds = lists.map((l) => l.id);
      const item = await prisma.item.findFirst({
        where: {
          listId: { in: listIds },
          name: { contains: searchQuery ?? "", mode: "insensitive" },
        },
      });
      if (!item) throw new Error(`Nie znaleziono produktu: "${searchQuery}"`);
      await prisma.item.delete({ where: { id: item.id } });
      return `Usunięto "${item.name}" z listy zakupów`;
    }
  }

  if (module === "tasks") {
    if (type === "create_task") {
      const title = (params.title as string) ?? "Nowe zadanie";
      const priority = (params.priority as string) ?? "NONE";
      const dueDate = params.dueDate ? new Date(params.dueDate as string) : null;
      const projectName = params.projectName as string | undefined;

      let projectId: string | null = null;
      if (projectName) {
        const project = await prisma.taskProject.findFirst({
          where: {
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            name: { contains: projectName, mode: "insensitive" },
          },
        });
        if (project) projectId = project.id;
      }

      // Brak wskazanego projektu → użyj projektu otwartego na widoku (jeśli użytkownik
      // ma do niego dostęp). Dopiero gdy i tego nie ma — fallback do skrzynki.
      if (!projectId && currentProjectId) {
        const current = await prisma.taskProject.findFirst({
          where: {
            id: currentProjectId,
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          },
          select: { id: true },
        });
        if (current) projectId = current.id;
      }

      if (!projectId) {
        const inbox = await prisma.taskProject.findFirst({
          where: { ownerId: userId, isInbox: true },
        });
        if (inbox) projectId = inbox.id;
      }

      const maxOrder = await prisma.task.aggregate({
        where: { projectId },
        _max: { order: true },
      });

      const task = await prisma.task.create({
        data: {
          title: title.trim(),
          priority,
          dueDate,
          description: (params.description as string) ?? null,
          projectId,
          createdById: userId,
          order: (maxOrder._max.order ?? 0) + 1,
        },
      });
      return `Utworzono zadanie "${task.title}"`;
    }

    if (type === "shift_task_due_date") {
      const days = (params.days as number) ?? 0;
      const task = await prisma.task.findFirst({
        where: {
          OR: [{ createdById: userId }, { assigneeId: userId }],
          title: { contains: searchQuery ?? "", mode: "insensitive" },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      });
      if (!task) throw new Error(`Nie znaleziono zadania: "${searchQuery}"`);
      const baseDate = task.dueDate ?? new Date();
      const newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() + days);
      await prisma.task.update({ where: { id: task.id }, data: { dueDate: newDate } });
      return `Przesunięto termin "${task.title}" o ${days > 0 ? "+" : ""}${days} dni`;
    }

    if (type === "update_task_status") {
      const status = (params.status as string) ?? "DONE";
      const task = await prisma.task.findFirst({
        where: {
          OR: [{ createdById: userId }, { assigneeId: userId }],
          title: { contains: searchQuery ?? "", mode: "insensitive" },
        },
      });
      if (!task) throw new Error(`Nie znaleziono zadania: "${searchQuery}"`);
      const completedAt = status === "DONE" ? new Date() : null;
      await prisma.task.update({
        where: { id: task.id },
        data: { status, completedAt },
      });
      return `Zmieniono status "${task.title}" → ${status}`;
    }
  }

  if (module === "notes") {
    if (type === "create_note") {
      const title = (params.title as string) ?? "Nowa notatka";
      const content = (params.content as string) ?? "";
      const note = await prisma.note.create({
        data: { title: title.trim(), content, ownerId: userId },
      });
      return `Utworzono notatkę "${note.title}"`;
    }

    if (type === "append_to_note") {
      const content = (params.content as string) ?? "";
      const teamIds = await getUserTeamIds(userId);
      const note = await prisma.note.findFirst({
        where: {
          OR: [
            { ownerId: userId },
            teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" },
          ],
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
      const newContent = note.content ? `${note.content}\n\n${content}` : content;
      await prisma.note.update({ where: { id: note.id }, data: { content: newContent } });
      return `Dopisano do notatki "${note.title}"`;
    }
  }

  if (module === "pets") {
    return executePetAction(action, userId);
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
      const message = await executeAction(action, session.user.id, activeListId, currentProjectId);
      results.push({ id: action.id, success: true, description: message });
      // Audit log
      await prisma.userActivity.create({
        data: {
          userId: session.user.id,
          module: "llm",
          action: `${action.module}/${action.type}`,
          metadata: JSON.parse(JSON.stringify({ params: action.params, searchQuery: action.searchQuery, result: message })),
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
