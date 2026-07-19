import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { getCalendarEvents } from "@/actions/calendar";
import { getBudgetsWithSpending, getFinanceGoals } from "@/actions/portfelBudgets";
import { getTrash } from "@/actions/trash";
import { getTaskTags } from "@/actions/taskTags";
import { getTags } from "@/actions/tags";
import { getRecipe } from "@/actions/recipes";
import { getCareAgenda, getCareHistory, getPetWelfare } from "@/actions/petCare";
import { getEnclosures } from "@/actions/petHusbandry";
import { getMaintenanceOverview } from "@/actions/warsztat";
import { getHotTopics, getSources, getTopics, getTopicView } from "@/actions/news";
import { getLocations, getWeather } from "@/actions/weather";
import { getProjectGroups } from "@/actions/projectGroups";
import { getNoteGroups } from "@/actions/noteGroups";
import { getCookbooks } from "@/actions/cookbooks";
import { getWalletOverview } from "@/actions/portfel";
import { getExpiringSoon } from "@/actions/pantry";
import { describeFrequency } from "@/lib/medicationSchedule";
import type { MedicationSchedule } from "@/types";

/**
 * Narzędzia ODCZYTU dla agenta „magicznej ikony". Każde narzędzie używa tych samych
 * filtrów dostępu co Server Actions w `src/actions/*` (własność użytkownika lub zespołu),
 * a zwraca ZWIĘZŁE kształty (id + kluczowe pola), żeby nie rozsadzić kontekstu LLM.
 *
 * Kluczowe: każdy wiersz ma `id` — agent wstawia je do parametrów akcji (taskId/itemId/…)
 * i dzięki temu akcje zbiorcze celują w konkretne rekordy, a nie w pierwszy pasujący po nazwie.
 */

const HARD_MAX = 60;
function clampLimit(n: unknown, def = 40): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : def;
  return Math.max(1, Math.min(HARD_MAX, Math.floor(v)));
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const READ_TOOLS_PROMPT = `Dostępne narzędzia ODCZYTU (step "query"). Wywołaj je, gdy potrzebujesz danych użytkownika, zanim odpowiesz lub zaproponujesz akcje. Każdy wiersz zawiera "id" — użyj go w parametrach akcji (taskId/itemId/noteId/listId/projectId/petId), aby celować w konkretne rekordy (akcje zbiorcze = wiele akcji, każda z własnym id).

- list_projects: args {} → [{ id, name, isInbox, taskCount }]
- list_tasks: args { projectId?, status?, priority?, search?, tag?, dueBefore?, limit? } → [{ id, title, status, priority, dueDate, projectId, projectName, tags }]. Domyślnie pomija zadania DONE/CANCELLED (chyba że podasz status). dueBefore w ISO. tag = nazwa etykiety (bez rozróżniania wielkości liter) — użyj go, gdy użytkownik pyta „zadania otagowane/z tagiem X". "tags" w wyniku to lista nazw etykiet danego zadania.
- list_shopping_lists: args { includeArchived? } → [{ id, name, pendingCount, totalCount, archived }]
- list_items: args { listId?, listName?, status?, search?, limit? } → [{ id, name, status, quantity, unit, listId, listName }]
- list_notes: args { search?, limit? } → [{ id, title, snippet, updatedAt }]. Lista (snippet skrócony). Do PEŁNEJ treści użyj get_note.
- get_note: args { noteId? | search? } → { id, title, content, updatedAt } | null. PEŁNA treść jednej notatki — wywołaj PRZED przepisaniem/edycją treści (update_note/append_to_note), gdy potrzebujesz aktualnego tekstu.
- get_task: args { taskId? | search? } → { id, title, description, status, priority, dueDate, projectName } | null. PEŁNY opis jednego zadania — wywołaj PRZED edycją opisu (update_task), gdy potrzebujesz aktualnej treści.
- list_pets: args { search? } → [{ id, name, species, status }]
- list_storage_items: args { search?, warehouse?, lowStockOnly?, limit? } → [{ id, name, quantity, unit, warehouse, location, minQuantity }]. Pozycje magazynu (dom/firma). lowStockOnly=true zwraca tylko poniżej stanu minimalnego.
- list_habits: args {} → [{ id, name, doneToday }]. Nawyki użytkownika (doneToday = czy odhaczony dziś).
- list_health_events: args { kind?, search?, limit? } → [{ id, kind, title, scheduledAt, status }]. Wizyty/badania (kind: "VISIT"|"TEST").
- list_medications: args { search?, limit? } → [{ id, kind, name, dosage, frequency, active }]. Harmonogramy leków (kind "MEDICATION") i czynności pielęgnacyjnych (kind "CARE") z opisem cykliczności.
- list_wallet: args {} → [{ id, name, kind, balance }]. Elementy portfela (konta/oszczędności/długi) z saldem w PLN.
- list_recipes: args { search?, limit? } → [{ id, title }]. Przepisy kulinarne.
- list_meal_plan: args { days?, limit? } → [{ id, date, slot, title }]. Zaplanowane posiłki (domyślnie najbliższe 7 dni).
- list_pantry: args { search?, limit? } → [{ id, name, quantity, unit, expiresAt }]. Spiżarnia.
- list_vehicles: args { search? } → [{ id, name, plate, odometer, inspectionDue, insuranceDue }]. Pojazdy z flota.
- list_workshops: args { search? } → [{ id, name, type, itemCount }]. Warsztaty/pracownie użytkownika (np. stolarski, samochodowy, malarski) z liczbą pozycji wyposażenia.
- list_decks: args {} → [{ id, name, nativeLang, targetLang }]. Talie fiszek (nauka języków).
- list_news_topics: args {} → [{ id, title }]. Monitorowane tematy wiadomości.
- list_weather_locations: args {} → [{ id, label, isDefault }]. Lokalizacje pogodowe.
- list_contacts: args { search?, limit? } → [{ id, name, phone, email, company, tags }]. Kontakty (osobisty CRM). search filtruje po imieniu/telefonie/mailu/firmie/tagach.
- get_weather: args { locationName? } → { location, current:{ temp, apparent, windKph }, daily:[{ date, tMax, tMin, precipProbMax, windMaxKph, code }] }. Prognoza pogody dla domyślnej (lub wskazanej nazwą) lokalizacji użytkownika. Kod pogody wg WMO. Użyj do pytań „jaka pogoda / czy będzie padać / jak się ubrać".
- list_budgets: args {} → { periodLabel, budgets:[{ id, category, limitAmount, spent, currency }] }. Budżety miesięczne z wydatkowaniem.
- list_goals: args {} → [{ id, name, targetAmount, currentAmount, currency, deadline }]. Cele oszczędnościowe.
- list_task_tags: args {} → [{ id, name }]. Dostępne etykiety zadań (użyj, by podać istniejące tagi lub przed set_task_tags).
- list_note_tags: args {} → [{ id, name }]. Dostępne etykiety notatek.
- get_recipe: args { search? | recipeId? } → { id, title, servings, ingredients:[…], steps:[…] } | null. PEŁNY przepis (składniki + kroki) — do gotowania/analizy jednego przepisu.
- list_care_agenda: args {} → [{ petName, kind, title, dueAt, overdue }]. Zaległe i nadchodzące czynności opieki nad zwierzętami (leczenie, karmienie, zadania pielęgnacyjne, wizyty).
- list_maintenance: args {} → { serviceDue:[…], lowStock:[…] }. Przeglądy narzędzi/maszyn i niski stan materiałów w warsztatach (tryb Pro).
- list_hot_topics: args {} → [{ title, count }]. „Gorące" tematy z monitorowanych wiadomości (świeże, częste).
- list_trash: args {} → { retentionDays, items:[{ id, module, label, deletedAt, daysLeft }] }. Kosz — elementy usunięte (do przywrócenia w /trash).
- list_project_groups: args {} → [{ id, name, projectCount }]. Grupy projektów zadań (foldery/współdzielone widoki).
- list_note_groups: args {} → [{ id, name }]. Grupy (foldery) notatek.
- list_cookbooks: args {} → [{ id, name, recipeCount }]. Książki kucharskie.
- get_wallet_overview: args {} → { totalNet, currency, monthlyRate, projection6m }. Podsumowanie majątku (suma netto, tempo zmian, prognoza 6 mies.).
- list_expiring_pantry: args { days? } → [{ id, name, quantity, unit, expiresAt }]. Produkty w spiżarni z terminem ważności w najbliższych N dniach (domyślnie 7).
- list_enclosures: args {} → [{ id, name, type, location }]. Zbiorniki/terraria/klatki (husbandry).
- get_pet_welfare: args {} → { agenda:[…], suggestions:[…] }. Dobrostan zwierząt: zaległa opieka + sugestie.
- list_care_history: args { petName, limit? } → [{ date, kind, note }]. Historia opieki nad wskazanym zwierzęciem (searchowane po imieniu).
- list_news_sources: args {} → [{ id, name, leaning, enabled }]. Skonfigurowane źródła RSS wiadomości.
- get_news_topic_view: args { topicName } → { items:[…], knowledge:[…] }. Świeże pozycje i baza wiedzy dla wskazanego monitorowanego tematu.
- list_calendar: args { year?, month? } → [{ module, title, date, at, href }]. Zagregowany kalendarz (zadania + posiłki + zdrowie + przeglądy floty) dla danego miesiąca (domyślnie bieżący; month = 1-12).
- web_search: args { query, limit? } → [{ title, url, snippet }]. Wyszukiwarka internetowa — użyj TYLKO gdy potrzebujesz informacji spoza danych użytkownika (ceny, fakty, definicje, świat zewnętrzny). W odpowiedzi cytuj źródła linkami markdown.`;

export const READ_TOOL_NAMES = [
  "list_projects",
  "list_tasks",
  "get_task",
  "list_shopping_lists",
  "list_items",
  "list_notes",
  "get_note",
  "list_pets",
  "list_storage_items",
  "list_habits",
  "list_health_events",
  "list_medications",
  "list_wallet",
  "list_recipes",
  "list_meal_plan",
  "list_pantry",
  "list_vehicles",
  "list_workshops",
  "list_decks",
  "list_news_topics",
  "list_weather_locations",
  "list_contacts",
  "list_calendar",
  "get_weather",
  "list_budgets",
  "list_goals",
  "list_task_tags",
  "list_note_tags",
  "get_recipe",
  "list_care_agenda",
  "list_maintenance",
  "list_hot_topics",
  "list_trash",
  "list_project_groups",
  "list_note_groups",
  "list_cookbooks",
  "get_wallet_overview",
  "list_expiring_pantry",
  "list_enclosures",
  "get_pet_welfare",
  "list_care_history",
  "list_news_sources",
  "get_news_topic_view",
] as const;

async function accessibleProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.taskProject.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

async function accessibleListWhere(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  return {
    OR: [
      { ownerId: userId },
      ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
    ],
  };
}

// Zakres własności (ownerId LUB zespół) dla modułów z modelem user/team.
async function ownerScope(userId: string): Promise<{ OR: Record<string, unknown>[] }> {
  const teamIds = await getUserTeamIds(userId);
  return {
    OR: [
      { ownerId: userId },
      ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
    ],
  };
}

/**
 * Uruchamia jedno narzędzie odczytu w zakresie dostępu użytkownika.
 * Zwraca zwięzłą tablicę obiektów (gotową do serializacji JSON do transkryptu LLM).
 */
export async function runReadTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  switch (name) {
    case "list_projects": {
      const projects = await prisma.taskProject.findMany({
        where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        include: { _count: { select: { tasks: true } } },
        orderBy: [{ isInbox: "desc" }, { createdAt: "asc" }],
        take: HARD_MAX,
      });
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        isInbox: p.isInbox,
        taskCount: p._count.tasks,
      }));
    }

    case "list_tasks": {
      const projectIds = await accessibleProjectIds(userId);
      const status = asStr(args.status);
      const priority = asStr(args.priority);
      const search = asStr(args.search);
      const dueBefore = asStr(args.dueBefore);
      const projectId = asStr(args.projectId);
      const tag = asStr(args.tag);

      const where: Record<string, unknown> = {
        parentTaskId: null,
        OR: [
          { projectId: { in: projectIds } },
          { createdById: userId },
          { assigneeId: userId },
        ],
      };
      if (projectId) where.projectId = projectId;
      if (status) where.status = status;
      else where.status = { notIn: ["DONE", "CANCELLED"] };
      if (priority) where.priority = priority;
      if (search) where.title = { contains: search, mode: "insensitive" };
      // Filtr po tagu (nazwa etykiety, bez rozróżniania wielkości liter) — bez tego
      // agent nie umiał odpowiedzieć na „pokaż zadania otagowane X" i zapętlał się.
      if (tag) where.tags = { some: { tag: { name: { contains: tag, mode: "insensitive" } } } };
      if (dueBefore) {
        const d = new Date(dueBefore);
        if (!isNaN(d.getTime())) where.dueDate = { lte: d };
      }

      const tasks = await prisma.task.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          projectId: true,
          project: { select: { name: true } },
          tags: { select: { tag: { select: { name: true } } } },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { order: "asc" }],
        take: clampLimit(args.limit),
      });
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        projectId: t.projectId,
        projectName: t.project?.name ?? null,
        tags: t.tags.map((tt) => tt.tag.name),
      }));
    }

    case "get_task": {
      const taskId = asStr(args.taskId);
      const search = asStr(args.search);
      const projectIds = await accessibleProjectIds(userId);
      const access = {
        OR: [
          { projectId: { in: projectIds } },
          { createdById: userId },
          { assigneeId: userId },
        ],
      };
      const task = await prisma.task.findFirst({
        where: taskId
          ? { id: taskId, ...access }
          : { ...access, ...(search ? { title: { contains: search, mode: "insensitive" } } : {}) },
        select: {
          id: true, title: true, description: true, status: true,
          priority: true, dueDate: true, project: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (!task) return null;
      return {
        id: task.id,
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString() ?? null,
        projectName: task.project?.name ?? null,
      };
    }

    case "list_shopping_lists": {
      const includeArchived = args.includeArchived === true;
      const lists = await prisma.shoppingList.findMany({
        where: { archived: includeArchived, ...(await accessibleListWhere(userId)) },
        orderBy: includeArchived ? { archivedAt: "desc" } : { createdAt: "asc" },
        take: HARD_MAX,
      });
      return Promise.all(
        lists.map(async (l) => {
          const [pendingCount, totalCount] = await Promise.all([
            prisma.item.count({ where: { listId: l.id, status: "NEEDED" } }),
            prisma.item.count({ where: { listId: l.id } }),
          ]);
          return { id: l.id, name: l.name, pendingCount, totalCount, archived: l.archived };
        })
      );
    }

    case "list_items": {
      const listId = asStr(args.listId);
      const listName = asStr(args.listName);
      const status = asStr(args.status);
      const search = asStr(args.search);

      // Zbiór list dostępnych użytkownikowi (zawęż do wskazanej, jeśli podano)
      const lists = await prisma.shoppingList.findMany({
        where: {
          ...(await accessibleListWhere(userId)),
          ...(listId ? { id: listId } : {}),
          ...(listName ? { name: { contains: listName, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true },
        take: HARD_MAX,
      });
      const listMap = new Map(lists.map((l) => [l.id, l.name]));
      const listIds = lists.map((l) => l.id);
      if (listIds.length === 0) return [];

      const items = await prisma.item.findMany({
        where: {
          listId: { in: listIds },
          ...(status ? { status } : {}),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: clampLimit(args.limit),
      });
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        status: i.status,
        quantity: i.quantity,
        unit: i.unit,
        listId: i.listId,
        listName: listMap.get(i.listId) ?? null,
      }));
    }

    case "list_notes": {
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const where: Record<string, unknown> = {
        OR: [
          { ownerId: userId },
          ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
        ],
      };
      if (search) {
        where.AND = [
          {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { content: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
      }
      const notes = await prisma.note.findMany({
        where,
        select: { id: true, title: true, content: true, updatedAt: true },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: clampLimit(args.limit),
      });
      return notes.map((n) => ({
        id: n.id,
        title: n.title,
        snippet: (n.content ?? "").slice(0, 120),
        updatedAt: n.updatedAt.toISOString(),
      }));
    }

    case "get_note": {
      const noteId = asStr(args.noteId);
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const ownerOr = [
        { ownerId: userId },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ];
      const note = await prisma.note.findFirst({
        where: noteId
          ? { id: noteId, OR: ownerOr }
          : {
              OR: ownerOr,
              ...(search
                ? {
                    AND: [
                      {
                        OR: [
                          { title: { contains: search, mode: "insensitive" } },
                          { content: { contains: search, mode: "insensitive" } },
                        ],
                      },
                    ],
                  }
                : {}),
            },
        select: { id: true, title: true, content: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });
      if (!note) return null;
      return {
        id: note.id,
        title: note.title,
        content: note.content ?? "",
        updatedAt: note.updatedAt.toISOString(),
      };
    }

    case "list_pets": {
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const pets = await prisma.pet.findMany({
        where: {
          OR: [
            { ownerId: userId },
            ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
            { shares: { some: { userId } } },
          ],
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, species: true, status: true },
        orderBy: { createdAt: "desc" },
        take: HARD_MAX,
      });
      return pets.map((p) => ({ id: p.id, name: p.name, species: p.species, status: p.status }));
    }

    case "list_storage_items": {
      const search = asStr(args.search);
      const warehouse = asStr(args.warehouse);
      const lowStockOnly = args.lowStockOnly === true || args.lowStockOnly === "true";
      const teamIds = await getUserTeamIds(userId);
      const items = await prisma.storageItem.findMany({
        where: {
          OR: [
            { ownerId: userId },
            ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
          ],
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          ...(warehouse ? { warehouse: { contains: warehouse, mode: "insensitive" } } : {}),
          ...(lowStockOnly ? { minQuantity: { not: null } } : {}),
        },
        orderBy: [{ warehouse: "asc" }, { name: "asc" }],
        take: clampLimit(args.limit),
      });
      const filtered = lowStockOnly
        ? items.filter((i) => i.minQuantity != null && (i.quantity ?? 0) < i.minQuantity)
        : items;
      return filtered.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        warehouse: i.warehouse,
        location: i.location,
        minQuantity: i.minQuantity,
      }));
    }

    case "list_habits": {
      const habits = await prisma.habit.findMany({
        where: { archived: false, ...(await ownerScope(userId)) },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
        take: HARD_MAX,
      });
      const today = new Date().toISOString().slice(0, 10);
      const ids = habits.map((h) => h.id);
      const doneEntries = ids.length
        ? await prisma.habitEntry.findMany({
            where: { habitId: { in: ids }, date: today },
            select: { habitId: true },
          })
        : [];
      const doneSet = new Set(doneEntries.map((e) => e.habitId));
      return habits.map((h) => ({ id: h.id, name: h.name, doneToday: doneSet.has(h.id) }));
    }

    case "list_health_events": {
      // Z-270: dane zdrowotne dostępne dla AI tylko po opt-in użytkownika.
      const hs = await prisma.healthSettings.findUnique({ where: { userId }, select: { aiOptIn: true } });
      if (!hs?.aiOptIn) {
        return [{ note: "Dostęp AI do danych zdrowotnych jest wyłączony. Włącz go w module Zdrowie → ustawienia, jeśli chcesz, by asystent z nich korzystał." }];
      }
      const kind = asStr(args.kind);
      const search = asStr(args.search);
      const events = await prisma.healthEvent.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(kind ? { kind } : {}),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, kind: true, title: true, scheduledAt: true, status: true },
        orderBy: { scheduledAt: "desc" },
        take: clampLimit(args.limit),
      });
      return events.map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        scheduledAt: e.scheduledAt.toISOString(),
        status: e.status,
      }));
    }

    case "list_medications": {
      // Z-270: leki/pielęgnacja dostępne dla AI tylko po opt-in użytkownika.
      const hsMed = await prisma.healthSettings.findUnique({ where: { userId }, select: { aiOptIn: true } });
      if (!hsMed?.aiOptIn) {
        return [{ note: "Dostęp AI do danych zdrowotnych jest wyłączony. Włącz go w module Zdrowie → ustawienia, jeśli chcesz, by asystent z nich korzystał." }];
      }
      const search = asStr(args.search);
      const schedules = await prisma.medicationSchedule.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        take: clampLimit(args.limit),
      });
      return schedules.map((s) => ({
        id: s.id,
        kind: s.kind,
        name: s.name,
        dosage: s.dosage,
        frequency: describeFrequency(s as unknown as MedicationSchedule),
        active: s.active,
      }));
    }

    case "list_wallet": {
      // Z-055: dane finansowe (salda/długi) trafiają do AI tylko, gdy użytkownik
      // nie wyłączył dostępu (opt-out, domyślnie włączony — brak rekordu = dozwolone).
      const fs = await prisma.financeSettings.findUnique({ where: { userId }, select: { aiAccessEnabled: true } });
      if (fs && fs.aiAccessEnabled === false) {
        return [{ note: "Dostęp AI do danych finansowych jest wyłączony. Włącz go w Portfel → Ustawienia, jeśli chcesz, by asystent z nich korzystał." }];
      }
      const elements = await prisma.walletElement.findMany({
        where: { archived: false, ...(await ownerScope(userId)) },
        select: { id: true, name: true, kind: true, balance: true },
        orderBy: { createdAt: "asc" },
        take: HARD_MAX,
      });
      return elements;
    }

    case "list_recipes": {
      const search = asStr(args.search);
      const recipes = await prisma.recipe.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: clampLimit(args.limit),
      });
      return recipes;
    }

    case "list_meal_plan": {
      const days = typeof args.days === "number" ? Math.max(1, Math.min(30, args.days)) : 7;
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + days);
      const entries = await prisma.mealPlanEntry.findMany({
        where: { ...(await ownerScope(userId)), date: { gte: from, lt: to } },
        select: { id: true, date: true, slot: true, customTitle: true, recipe: { select: { title: true } } },
        orderBy: { date: "asc" },
        take: clampLimit(args.limit),
      });
      return entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        slot: e.slot,
        title: e.customTitle ?? e.recipe?.title ?? "(posiłek)",
      }));
    }

    case "list_pantry": {
      const search = asStr(args.search);
      const items = await prisma.pantryItem.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, quantity: true, unit: true, expiresAt: true },
        orderBy: { name: "asc" },
        take: clampLimit(args.limit),
      });
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        expiresAt: i.expiresAt?.toISOString().slice(0, 10) ?? null,
      }));
    }

    case "list_vehicles": {
      const search = asStr(args.search);
      const vehicles = await prisma.vehicle.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, plate: true, odometer: true, inspectionDue: true, insuranceDue: true },
        orderBy: { updatedAt: "desc" },
        take: HARD_MAX,
      });
      return vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        plate: v.plate,
        odometer: v.odometer,
        inspectionDue: v.inspectionDue?.toISOString().slice(0, 10) ?? null,
        insuranceDue: v.insuranceDue?.toISOString().slice(0, 10) ?? null,
      }));
    }

    case "list_workshops": {
      const search = asStr(args.search);
      const workshops = await prisma.workshop.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        include: { _count: { select: { items: true } } },
        orderBy: { updatedAt: "desc" },
        take: HARD_MAX,
      });
      return workshops.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        itemCount: w._count.items,
      }));
    }

    case "list_decks": {
      const decks = await prisma.languageDeck.findMany({
        where: await ownerScope(userId),
        select: { id: true, name: true, nativeLang: true, targetLang: true },
        orderBy: { updatedAt: "desc" },
        take: HARD_MAX,
      });
      return decks;
    }

    case "list_news_topics": {
      // NewsTopic jest user-only (ownerId wymagany).
      const topics = await prisma.newsTopic.findMany({
        where: { ownerId: userId },
        select: { id: true, title: true },
        orderBy: { sortOrder: "asc" },
        take: HARD_MAX,
      });
      return topics;
    }

    case "list_weather_locations": {
      // WeatherLocation jest user-only (ownerId wymagany).
      const locations = await prisma.weatherLocation.findMany({
        where: { ownerId: userId },
        select: { id: true, label: true, isDefault: true },
        orderBy: { createdAt: "asc" },
        take: HARD_MAX,
      });
      return locations;
    }

    case "list_contacts": {
      const search = asStr(args.search);
      const teamIds = await getUserTeamIds(userId);
      const contacts = await prisma.contact.findMany({
        where: {
          OR: [
            { ownerId: userId },
            ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
          ],
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { phone: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                  { company: { contains: search, mode: "insensitive" as const } },
                  { tags: { contains: search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, phone: true, email: true, company: true, tags: true },
        orderBy: { name: "asc" },
        take: clampLimit(args.limit),
      });
      return contacts.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        company: c.company,
        tags: (() => { try { return c.tags ? JSON.parse(c.tags) : []; } catch { return []; } })(),
      }));
    }

    case "list_calendar": {
      // Reużywa agregatu kalendarza (zadania + posiłki + zdrowie + flota), scoping user/zespół wewnątrz.
      const now = new Date();
      const year = typeof args.year === "number" ? args.year : now.getFullYear();
      const month1 = typeof args.month === "number" ? Math.max(1, Math.min(12, args.month)) : now.getMonth() + 1;
      const events = await getCalendarEvents(year, month1 - 1);
      return events.map((e) => ({ module: e.module, title: e.title, date: e.date, at: e.at, href: e.href }));
    }

    case "get_weather": {
      const locations = await getLocations();
      if (locations.length === 0) return { note: "Brak zapisanych lokalizacji pogodowych — dodaj miejscowość w /pogoda." };
      const wanted = asStr(args.locationName);
      const loc = (wanted && locations.find((l) => l.label.toLowerCase().includes(wanted.toLowerCase())))
        || locations.find((l) => l.isDefault)
        || locations[0];
      const f = await getWeather(loc.lat, loc.lon);
      return {
        location: loc.label,
        current: f.current ? { temp: f.current.temp, apparent: f.current.apparent, windKph: f.current.windKph, code: f.current.code } : null,
        daily: f.daily.slice(0, 5).map((d) => ({
          date: d.date, tMax: d.tMax, tMin: d.tMin, precipProbMax: d.precipProbMax, precipSum: d.precipSum, windMaxKph: d.windMaxKph, code: d.code,
        })),
      };
    }

    case "list_budgets": {
      const { budgets, periodLabel } = await getBudgetsWithSpending();
      return { periodLabel, budgets: budgets.map((b) => ({ id: b.id, category: b.category, limitAmount: b.limitAmount, spent: b.spent, currency: b.currency })) };
    }

    case "list_goals": {
      const goals = await getFinanceGoals();
      return goals.map((g) => ({
        id: g.id, name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount,
        currency: g.currency, deadline: g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : null,
      }));
    }

    case "list_task_tags": {
      const tags = await getTaskTags();
      return tags.map((t) => ({ id: t.id, name: t.name }));
    }

    case "list_note_tags": {
      const tags = await getTags();
      return tags.map((t) => ({ id: t.id, name: t.name }));
    }

    case "get_recipe": {
      const idOrSlug = asStr(args.recipeId);
      const search = asStr(args.search);
      let key = idOrSlug;
      if (!key && search) {
        const teamIds = await getUserTeamIds(userId);
        const r = await prisma.recipe.findFirst({
          where: {
            OR: [{ ownerId: userId }, ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : [])],
            title: { contains: search, mode: "insensitive" },
          },
          select: { id: true },
          orderBy: { updatedAt: "desc" },
        });
        key = r?.id;
      }
      if (!key) return null;
      const recipe = await getRecipe(key);
      if (!recipe) return null;
      return recipe;
    }

    case "list_care_agenda": {
      return getCareAgenda();
    }

    case "list_maintenance": {
      return getMaintenanceOverview();
    }

    case "list_hot_topics": {
      return getHotTopics();
    }

    case "list_trash": {
      const { items, retentionDays } = await getTrash();
      return {
        retentionDays,
        items: items.slice(0, clampLimit(args.limit)).map((it) => ({
          id: it.id, module: it.module, label: it.title, deletedAt: it.deletedAt,
        })),
      };
    }

    case "list_project_groups": {
      const groups = await getProjectGroups();
      return groups.map((g) => ({ id: g.id, name: g.name, projectCount: g.projectIds?.length ?? 0 }));
    }

    case "list_note_groups": {
      const groups = await getNoteGroups();
      return groups.map((g) => ({ id: g.id, name: g.name }));
    }

    case "list_cookbooks": {
      const cookbooks = await getCookbooks();
      return cookbooks.map((c) => ({ id: c.id, name: c.name, recipeCount: c.recipeCount }));
    }

    case "get_wallet_overview": {
      const o = await getWalletOverview();
      return { totalNet: o.totalNet, currency: o.currency, monthlyRate: o.monthlyRate, projection6m: o.projection6m };
    }

    case "list_expiring_pantry": {
      const days = typeof args.days === "number" ? Math.max(1, Math.min(60, args.days)) : 7;
      const items = await getExpiringSoon(days);
      return items.slice(0, clampLimit(args.limit)).map((i) => ({
        id: i.id, name: i.name, quantity: i.quantity, unit: i.unit,
        expiresAt: i.expiresAt ? new Date(i.expiresAt).toISOString().slice(0, 10) : null,
      }));
    }

    case "list_enclosures": {
      const encs = await getEnclosures();
      return encs.map((e) => ({ id: e.id, name: e.name, type: e.type, location: e.location }));
    }

    case "get_pet_welfare": {
      return getPetWelfare();
    }

    case "list_news_sources": {
      const sources = await getSources();
      return sources.map((s) => ({ id: s.id, name: s.name, leaning: s.leaning, enabled: s.enabled }));
    }

    case "get_news_topic_view": {
      const name = asStr(args.topicName) ?? asStr(args.search);
      if (!name) return { note: "Podaj nazwę tematu (topicName)." };
      const topics = await getTopics();
      const topic = topics.find((t) => t.title.toLowerCase().includes(name.toLowerCase()));
      if (!topic) return { note: `Nie znaleziono tematu: „${name}".` };
      return getTopicView(topic.id);
    }

    case "list_care_history": {
      const petName = asStr(args.petName) ?? asStr(args.search);
      if (!petName) return { note: "Podaj imię zwierzęcia (petName)." };
      const teamIds = await getUserTeamIds(userId);
      const pet = await prisma.pet.findFirst({
        where: {
          OR: [
            { ownerId: userId },
            ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
            { shares: { some: { userId } } },
          ],
          name: { contains: petName, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });
      if (!pet) return { note: `Nie znaleziono zwierzęcia: „${petName}".` };
      const history = await getCareHistory(pet.id, clampLimit(args.limit, 50));
      return { pet: pet.name, history };
    }

    default:
      throw new Error(`Nieznane narzędzie: ${name}`);
  }
}
