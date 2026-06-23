import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/server-utils";
import { createTask, updateTask, deleteTask } from "@/actions/tasks";
import { createTaskProject, updateTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import { toggleHabitDay } from "@/actions/habits";
import { addEntry, getWalletElements } from "@/actions/portfel";
import { setMealPlanEntry } from "@/actions/mealPlans";
import { addFuelLog, addServiceRecord, createVehicle, updateVehicle, deleteVehicle } from "@/actions/flota";
import { addStorageItem, adjustStorageQuantity, updateStorageItem, deleteStorageItem, transferStock } from "@/actions/storage";
import { createHabit, updateHabit, setHabitArchived, deleteHabit } from "@/actions/habits";
import { createElement, updateElement, setBalance, archiveElement, deleteElement } from "@/actions/portfel";
import { addPantryItem, updatePantryItem, consumePantryItem, deletePantryItem } from "@/actions/pantry";
import { createRecipe, deleteRecipe } from "@/actions/recipes";
import { markMealCooked, deleteMealPlanEntry } from "@/actions/mealPlans";
import { executePetAction } from "@/lib/ai/executors/petExecutor";
import { executeHealthAction } from "@/lib/ai/executors/healthExecutor";
import { executeLanguageAction } from "@/lib/ai/executors/languageExecutor";
import { executeNewsAction } from "@/lib/ai/executors/newsExecutor";
import { executeWeatherAction } from "@/lib/ai/executors/weatherExecutor";
import { executeWarsztatAction } from "@/lib/ai/executors/warsztatExecutor";
import { executeReportAction } from "@/lib/ai/executors/reportExecutor";
import { executeNotesAction } from "@/lib/ai/executors/notesExecutor";
import { executeShoppingAction } from "@/lib/ai/executors/shoppingExecutor";
import type { AIAction } from "@/lib/ai/aiAction";
import type { TaskStatus, TaskPriority } from "@/types";
import { isoDate } from "@/lib/habitStats";
import {
  addDays, shiftPriority, asStr, undoAction,
  resolveTaskId, resolveProjectIdForCreate, ownerOrArr, resolveByName,
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
    return executeShoppingAction(action, userId, activeListId);
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
    return executeNotesAction(action, userId);
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
    return executeWarsztatAction(action, userId);
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
    return executeHealthAction(action, userId);
  }

  // ── Języki (fiszki) ──────────────────────────────────────────────────────────
  if (module === "languages") {
    return executeLanguageAction(action, userId);
  }

  // ── Wiadomości (tematy / odświeżanie) ─────────────────────────────────────────
  if (module === "news") {
    return executeNewsAction(action, userId);
  }

  // ── Pogoda (lokalizacje / obserwatorzy) ───────────────────────────────────────
  if (module === "weather") {
    return executeWeatherAction(action, userId);
  }

  // ── Raporty (zapis wyniku / sesji) ────────────────────────────────────────────
  if (module === "reports") {
    return executeReportAction(action);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DODATKOWE AKCJE CRUD (domknięcie pokrycia zapisu do ~100% encji użytkownika).
  // Każda mapuje na istniejący Server Action; id rozwiązywane id-first + po nazwie
  // w zakresie własności użytkownika/zespołu.
  // ════════════════════════════════════════════════════════════════════════════
  const teamOr = await ownerOrArr(userId);

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
