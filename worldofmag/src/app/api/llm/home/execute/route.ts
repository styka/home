import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/server-utils";
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
import { createWorkshop, addWorkshopItem } from "@/actions/warsztat";
import { createHabit, updateHabit, setHabitArchived, deleteHabit } from "@/actions/habits";
import { createElement, updateElement, setBalance, archiveElement, deleteElement } from "@/actions/portfel";
import { createHealthEvent, updateHealthEvent, setHealthStatus, deleteHealthEvent } from "@/actions/health";
import { createMedicationSchedule, deleteMedicationSchedule, logDose, getMedicationDay } from "@/actions/medications";
import { createDeck, updateDeck, deleteDeck, addWord, updateWord, deleteWord } from "@/actions/languageDecks";
import { addPantryItem, updatePantryItem, consumePantryItem, deletePantryItem } from "@/actions/pantry";
import { createRecipe, deleteRecipe } from "@/actions/recipes";
import { markMealCooked, deleteMealPlanEntry } from "@/actions/mealPlans";
import { createTopic, updateTopic, deleteTopic, refreshTopic } from "@/actions/news";
import { addLocationByName, deleteLocation, setDefaultLocation, addPresetWatcher, deleteWatcher } from "@/actions/weather";
import { createUserReport } from "@/actions/reports";
import { executePetAction } from "@/lib/ai/executors/petExecutor";
import type { AIAction } from "@/lib/ai/aiAction";
import type { TaskStatus, TaskPriority, ItemStatus, HealthKind, HealthStatus } from "@/types";
import { isoDate } from "@/lib/habitStats";
import {
  addDays, shiftPriority, asStr, undoAction,
  resolveOrCreateList, resolveListId, resolveItemId, resolveTaskId,
  resolveProjectIdForCreate, resolveNoteId, resolveHealthEventId,
  resolveMedicationId, resolveDeckId, ownerOrArr, resolveByName,
} from "@/lib/ai/executors/shared";
import type { ExecOutcome, ActionResult } from "@/lib/ai/executors/shared";


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
      const undo = undoAction("shopping", "delete_item", { itemId: item.id }, `Usuń "${item.name}" z listy "${list.name}"`);
      if (params.openAfter === true) {
        return { message: msg, undo, navigateTo: `/shopping/${list.id}`, navigateLabel: `Otwórz „${list.name}”` };
      }
      return { message: msg, undo };
    }

    if (type === "update_item_status") {
      const status = (asStr(params.status) ?? "DONE") as ItemStatus;
      const id = await resolveItemId(userId, params, searchQuery);
      const before = await prisma.item.findUnique({ where: { id }, select: { status: true } });
      const item = await updateItemStatus(id, status);
      const undo = before
        ? { ...undoAction("shopping", "update_item_status", { itemId: id, status: before.status }, `Przywróć status "${item.name}" → ${before.status}`), searchQuery: item.name }
        : undefined;
      return { message: `Zaktualizowano status "${item.name}" → ${status}`, undo };
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
      const undo = undoAction("shopping", "delete_list", { listId: list.id }, `Usuń listę "${list.name}"`);
      if (params.openAfter === true) {
        return { message: msg, undo, navigateTo: `/shopping/${list.id}`, navigateLabel: `Otwórz „${list.name}”` };
      }
      return { message: msg, undo };
    }

    if (type === "rename_list") {
      const id = await resolveListId(userId, params, searchQuery, activeListId);
      const name = asStr(params.name) ?? "Lista";
      const before = await prisma.shoppingList.findUnique({ where: { id }, select: { name: true } });
      const list = await renameList(id, name);
      const undo = before
        ? { ...undoAction("shopping", "rename_list", { listId: id, name: before.name }, `Przywróć nazwę listy → "${before.name}"`), searchQuery: name }
        : undefined;
      return { message: `Zmieniono nazwę listy na "${list.name}"`, undo };
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
      const undo = undoAction("tasks", "delete_task", { taskId: task.id }, `Usuń zadanie "${task.title}"`);
      if (params.openAfter === true) {
        const view = task.projectId ?? "all";
        return { message: msg, undo, navigateTo: `/tasks/${view}?task=${task.id}`, navigateLabel: `Otwórz „${task.title}”` };
      }
      return { message: msg, undo };
    }

    if (type === "update_task") {
      const id = await resolveTaskId(userId, params, searchQuery);
      const before = await prisma.task.findUnique({ where: { id }, select: { title: true, description: true, priority: true, status: true, dueDate: true } });
      const patch: Parameters<typeof updateTask>[1] = {};
      const undoParams: Record<string, unknown> = { taskId: id };
      if (params.title !== undefined) { patch.title = String(params.title); undoParams.title = before?.title ?? ""; }
      if (params.description !== undefined) { patch.description = asStr(params.description) ?? null; undoParams.description = before?.description ?? null; }
      if (params.priority !== undefined) { patch.priority = String(params.priority) as TaskPriority; undoParams.priority = before?.priority; }
      if (params.status !== undefined) { patch.status = String(params.status) as TaskStatus; undoParams.status = before?.status; }
      if (params.dueDate !== undefined) { patch.dueDate = params.dueDate ? new Date(String(params.dueDate)) : null; undoParams.dueDate = before?.dueDate?.toISOString() ?? null; }
      const task = await updateTask(id, patch);
      const undo = before
        ? { ...undoAction("tasks", "update_task", undoParams, `Cofnij zmiany w zadaniu "${task.title}"`), searchQuery: task.title }
        : undefined;
      return { message: `Zaktualizowano zadanie "${task.title}"`, undo };
    }

    if (type === "update_task_status") {
      const id = await resolveTaskId(userId, params, searchQuery);
      const status = (asStr(params.status) ?? "DONE") as TaskStatus;
      const before = await prisma.task.findUnique({ where: { id }, select: { status: true } });
      const task = await updateTask(id, { status });
      const undo = before
        ? { ...undoAction("tasks", "update_task_status", { taskId: id, status: before.status }, `Przywróć status "${task.title}" → ${before.status}`), searchQuery: task.title }
        : undefined;
      return { message: `Zmieniono status "${task.title}" → ${status}`, undo };
    }

    if (type === "shift_task_due_date") {
      const id = await resolveTaskId(userId, params, searchQuery, { notDone: true });
      const days = Number(params.days ?? 0);
      const existing = await prisma.task.findUnique({ where: { id }, select: { dueDate: true } });
      const newDate = addDays(existing?.dueDate ?? new Date(), days);
      const task = await updateTask(id, { dueDate: newDate });
      // Cofnięcie = przesunięcie o przeciwną liczbę dni (od nowego terminu wróci na stary).
      const undo = { ...undoAction("tasks", "shift_task_due_date", { taskId: id, days: -days }, `Cofnij przesunięcie terminu "${task.title}"`), searchQuery: task.title };
      return { message: `Przesunięto termin "${task.title}" o ${days > 0 ? "+" : ""}${days} dni`, undo };
    }

    if (type === "shift_task_priority") {
      const id = await resolveTaskId(userId, params, searchQuery);
      const steps = Math.trunc(Number(params.steps ?? 1)) || 0;
      const before = await prisma.task.findUnique({ where: { id }, select: { priority: true } });
      const current = (before?.priority ?? "NONE") as TaskPriority;
      const next = shiftPriority(current, steps);
      const task = await updateTask(id, { priority: next });
      // Cofnięcie ustawia z powrotem dokładną wartość sprzed zmiany (klamp mógł ją „zjeść").
      const undo = before
        ? { ...undoAction("tasks", "update_task", { taskId: id, priority: current }, `Przywróć priorytet "${task.title}" → ${current}`), searchQuery: task.title }
        : undefined;
      const msg = next === current
        ? `Priorytet "${task.title}" bez zmian (${current})`
        : `Zmieniono priorytet "${task.title}": ${current} → ${next}`;
      return { message: msg, undo };
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
      const undo = undoAction("tasks", "delete_project", { projectId: project.id }, `Usuń projekt "${project.name}"`);
      if (params.openAfter === true) {
        return { message: msg, undo, navigateTo: `/tasks/${project.id}`, navigateLabel: `Otwórz „${project.name}”` };
      }
      return { message: msg, undo };
    }
  }

  if (module === "notes") {
    if (type === "create_note") {
      const note = await createNote({ title: asStr(params.title) ?? "Nowa notatka", content: asStr(params.content) ?? "" });
      const msg = `Utworzono notatkę "${note.title}"`;
      const undo = undoAction("notes", "delete_note", { noteId: note.id }, `Usuń notatkę "${note.title}"`);
      if (params.openAfter === true) {
        return { message: msg, undo, navigateTo: `/notes?focus=${note.id}`, navigateLabel: `Otwórz „${note.title}”` };
      }
      return { message: msg, undo };
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
      const before = await prisma.note.findUnique({ where: { id }, select: { title: true, content: true } });
      const patch: Parameters<typeof updateNote>[1] = {};
      const undoParams: Record<string, unknown> = { noteId: id };
      if (params.title !== undefined) { patch.title = String(params.title); undoParams.title = before?.title ?? ""; }
      if (params.content !== undefined) { patch.content = String(params.content); undoParams.content = before?.content ?? ""; }
      const note = await updateNote(id, patch);
      const undo = before
        ? { ...undoAction("notes", "update_note", undoParams, `Cofnij zmiany w notatce "${note.title}"`), searchQuery: note.title }
        : undefined;
      return { message: `Zaktualizowano notatkę "${note.title}"`, undo };
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
      // toggle_habit jest samoodwracalny — ponowne odhaczenie cofa zmianę.
      const undo = undoAction("habits", "toggle_habit", { habitName: habit.name }, `Cofnij zmianę nawyku „${habit.name}"`);
      return { message: result.done ? `Odhaczono nawyk „${habit.name}"` : `Cofnięto odhaczenie nawyku „${habit.name}"`, undo };
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
      // Odwrócenie = przeciwna korekta o tę samą wartość.
      const undo = { ...undoAction("magazynowanie", "adjust_storage", { delta: -delta }, `Cofnij korektę stanu — ${item.name}`), searchQuery: item.name };
      return { message: `${delta > 0 ? "Przyjęto" : "Wydano"} ${Math.abs(delta)} — ${item.name} (stan: ${updated.quantity ?? 0})`, undo };
    }
  }

  // ── Warsztaty ─────────────────────────────────────────────────────────────
  if (module === "warsztaty") {
    if (type === "create_workshop") {
      const name = asStr(params.name);
      if (!name) throw new Error("Podaj nazwę warsztatu");
      const ws = await createWorkshop({
        name,
        type: asStr(params.type) ?? null,
        location: asStr(params.location) ?? null,
      });
      return `Utworzono warsztat „${ws.name}"`;
    }

    if (type === "add_workshop_item") {
      const name = asStr(params.name);
      if (!name) throw new Error("Podaj nazwę pozycji");
      const wsName = asStr(params.workshopName) ?? action.searchQuery?.trim();
      const teamIds = await getUserTeamIds(userId);
      const ownerOr = [{ ownerId: userId }, teamIds.length > 0 ? { ownerTeamId: { in: teamIds } } : { id: "" }];
      const workshop = wsName
        ? await prisma.workshop.findFirst({
            where: { OR: ownerOr, name: { contains: wsName, mode: "insensitive" } },
            orderBy: { updatedAt: "desc" },
          })
        : await prisma.workshop.findFirst({ where: { OR: ownerOr }, orderBy: { updatedAt: "desc" } });
      if (!workshop) throw new Error(wsName ? `Nie znaleziono warsztatu „${wsName}"` : "Brak warsztatu — najpierw utwórz warsztat");
      const item = await addWorkshopItem(workshop.id, {
        name,
        kind: asStr(params.kind) ?? null,
        category: asStr(params.category) ?? null,
        quantity: params.quantity != null ? Number(params.quantity) : null,
        unit: asStr(params.unit) ?? null,
      });
      return `Dodano do warsztatu „${workshop.name}": ${item.name}`;
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
    if (type === "create_medication") {
      const name = asStr(params.name);
      if (!name) throw new Error("Podaj nazwę leku lub czynności");
      const kind = asStr(params.kind) === "CARE" ? "CARE" : "MEDICATION";
      const s = await createMedicationSchedule({
        kind,
        name,
        dosage: asStr(params.dosage) ?? null,
        reason: asStr(params.reason) ?? null,
        instructions: asStr(params.instructions) ?? null,
        freqType: (asStr(params.freqType) as "DAILY" | "WEEKLY" | "HOURLY") ?? "DAILY",
        interval: params.interval != null ? Number(params.interval) : 1,
        daysOfWeek: Array.isArray(params.daysOfWeek) ? (params.daysOfWeek as number[]) : asStr(params.daysOfWeek) ?? null,
        timesOfDay: Array.isArray(params.timesOfDay) ? (params.timesOfDay as string[]) : asStr(params.timesOfDay) ?? null,
        hourlyStart: asStr(params.hourlyStart) ?? null,
        hourlyEnd: asStr(params.hourlyEnd) ?? null,
        startDate: params.startDate ? String(params.startDate) : null,
        endDate: params.endDate ? String(params.endDate) : null,
      });
      return `Dodano harmonogram: „${s.name}"`;
    }
    if (type === "log_dose") {
      const id = await resolveMedicationId(userId, params, searchQuery);
      const date = asStr(params.date) ?? new Date().toISOString().slice(0, 10);
      let slot = asStr(params.slot);
      if (!slot) {
        const day = await getMedicationDay(date);
        const pending = day.slots.find((sl) => sl.scheduleId === id && !sl.done) ?? day.slots.find((sl) => sl.scheduleId === id);
        slot = pending?.slot;
      }
      if (!slot) throw new Error("Brak zaplanowanej dawki tego dnia — podaj godzinę (slot)");
      await logDose(id, date, slot, "TAKEN");
      return `Odhaczono dawkę o ${slot}`;
    }
    if (type === "delete_medication") {
      const id = await resolveMedicationId(userId, params, searchQuery);
      await deleteMedicationSchedule(id);
      return `Usunięto harmonogram`;
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
      const meta = await prisma.shoppingList.findUnique({ where: { id }, select: { name: true, _count: { select: { items: true } } } });
      await deleteList(id);
      const n = meta?._count.items ?? 0;
      // Ostrzeżenie post-hoc: jawnie mówimy, ile pozycji zniknęło wraz z listą.
      return n > 0
        ? `Usunięto listę "${meta?.name ?? ""}" wraz z ${n} ${n === 1 ? "pozycją" : "pozycjami"}`
        : `Usunięto pustą listę "${meta?.name ?? ""}"`;
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
      const meta = await prisma.taskProject.findUnique({ where: { id }, select: { name: true, _count: { select: { tasks: true } } } });
      await deleteTaskProject(id);
      const n = meta?._count.tasks ?? 0;
      return n > 0
        ? `Usunięto projekt "${meta?.name ?? ""}" wraz z ${n} ${n === 1 ? "zadaniem" : "zadaniami"}`
        : `Usunięto pusty projekt "${meta?.name ?? ""}"`;
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
        undo: outcome.undo,
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
