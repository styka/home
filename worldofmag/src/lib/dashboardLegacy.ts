import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { getTodaysMeals } from "@/modules/kitchen/contract";
import { getExpiringSoon } from "@/modules/kitchen/contract";
import { getCareAgenda } from "@/modules/pets/contract";
import { getVehicles } from "@/modules/flota/contract";
import { getWalletOverview } from "@/modules/portfel/contract";
import { getDecks } from "@/modules/languages/contract";
import { getHealthEvents } from "@/modules/health/contract";
import { getLowStock, getExpiringStorage } from "@/modules/magazynowanie/contract";
import type { TaskPriority, CareAgendaItem } from "@/types";
import type { DashboardSnapshot } from "@/modules/home/contract";
import { collectDashboardSnapshot } from "@/lib/dashboardSnapshot";

/**
 * 050/T-2 — MIGAWKA PULPITU WYODRĘBNIONA Z TRASY. **Czysta przenosina.**
 *
 * Powód jest jeden i konkretny: dopóki te obliczenia żyły w ciele komponentu trasy, nie dało się ich
 * **zawołać** — a bez tego nie ma jak zrzucić wyniku „przed" i porównać go z „po". 049 odłożyło
 * z tego powodu rozbicie pulpitu na wkłady modułowe: przenoszenie jedenastu bloków obliczeń, którego
 * jedynym sprawdzeniem byłby kompilator, to ryzyko cichej regresji na produkcji.
 *
 * Funkcja bierze `userId` i `permissions` **parametrem** — nie sięga po sesję, więc da się ją wywołać
 * ze skryptu (tak samo jak `collectCalendarEvents`). Treść jest przeniesiona 1:1: te same zapytania,
 * ta sama kolejność, te same `try/catch` i te same wartości domyślne.
 *
 * **To jest stan przejściowy.** Kolejne zadania rozbiją tę funkcję na wkłady deklarowane przez moduły
 * i wtedy zniknie razem z importami kontraktów.
 */
export async function collectDashboardSnapshotLegacy(
  userId: string,
  userPermissions: string[],
  isAdmin: boolean,
): Promise<DashboardSnapshot & { adminStats: { userCount: number; teamCount: number; reportCount: number } | null }> {
  const has = (slug: string) => userPermissions.includes(slug);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const teamIds = await getUserTeamIds(userId);
  const reportAccessFilter = {
    OR: [
      { authorId: userId },
      { authorId: null },
      ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
    ],
  };

  // 050: aktywność i zaproszenia WYPADŁY z tej funkcji — sięgają po sesję (`headers()`), więc
  // wywołane ze skryptu rzucają „headers was called outside a request scope". To dane konta, nie
  // modułu; zostają w trasie zgodnie z planem §7.4. Zrzut je wykrył od razu.

  // Tasks (conditional)
  let todayTasks = 0;
  let overdueTasks = 0;
  let todayTaskPreview: Array<{
    id: string;
    title: string;
    priority: TaskPriority;
    projectId: string | null;
    projectName: string | null;
    projectEmoji: string | null;
  }> = [];

  if (has("module.tasks")) {
    const [todayCnt, overdueCnt, todayList] = await Promise.all([
      prisma.task.count({
        where: {
          OR: [{ createdById: userId }, { assigneeId: userId }],
          dueDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      }),
      prisma.task.count({
        where: {
          OR: [{ createdById: userId }, { assigneeId: userId }],
          dueDate: { lt: todayStart },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      }),
      prisma.task.findMany({
        where: {
          OR: [{ createdById: userId }, { assigneeId: userId }],
          dueDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        take: 3,
        include: { project: { select: { id: true, name: true, emoji: true } } },
      }),
    ]);
    todayTasks = todayCnt;
    overdueTasks = overdueCnt;
    todayTaskPreview = todayList.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority as TaskPriority,
      projectId: t.projectId,
      projectName: t.project?.name ?? null,
      projectEmoji: t.project?.emoji ?? null,
    }));
  }


  // Kitchen (conditional)
  let todayMealsForUI: Array<{ id: string; slot: string; title: string; servings: number; recipeSlug: string | null }> = [];
  let expiringCount = 0;

  if (has("module.kitchen")) {
    try {
      const [todayMeals, expiring] = await Promise.all([getTodaysMeals(), getExpiringSoon(3)]);
      todayMealsForUI = todayMeals.map((m) => ({
        id: m.id,
        slot: m.slot,
        title: m.recipe?.title ?? m.customTitle ?? "—",
        servings: m.servings,
        recipeSlug: m.recipe?.slug ?? null,
      }));
      expiringCount = expiring.length;
    } catch {
      todayMealsForUI = [];
      expiringCount = 0;
    }
  }

  // Pets (conditional) — care agenda (overdue / today / upcoming)
  let petCareDue = 0;
  let petAgenda: CareAgendaItem[] = [];
  if (has("module.pets")) {
    try {
      const agenda = await getCareAgenda();
      petCareDue = agenda.filter((a) => a.bucket === "OVERDUE" || a.bucket === "TODAY").length;
      petAgenda = agenda.slice(0, 4);
    } catch {
      petCareDue = 0;
      petAgenda = [];
    }
  }

  // Flota (conditional) — vehicle count + inspection/insurance due within 30 days
  let vehiclesCount = 0;
  let vehicleAlerts: Array<{ id: string; name: string; type: "inspection" | "insurance"; dueAt: string; daysLeft: number }> = [];
  if (has("module.flota")) {
    try {
      const vehicles = await getVehicles();
      vehiclesCount = vehicles.length;
      const horizon = 30;
      for (const v of vehicles) {
        const checks: Array<["inspection" | "insurance", Date | null]> = [
          ["inspection", v.inspectionDue],
          ["insurance", v.insuranceDue],
        ];
        for (const [type, due] of checks) {
          if (!due) continue;
          const daysLeft = Math.ceil((new Date(due).getTime() - todayStart.getTime()) / 86_400_000);
          if (daysLeft <= horizon) {
            vehicleAlerts.push({ id: v.id, name: v.name, type, dueAt: new Date(due).toISOString(), daysLeft });
          }
        }
      }
      vehicleAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
      vehicleAlerts = vehicleAlerts.slice(0, 4);
    } catch {
      vehiclesCount = 0;
      vehicleAlerts = [];
    }
  }


  // Nauka języków (conditional) — karty do powtórki (SRS)
  let languagesDue = 0;
  let languageDecks: Array<{ id: string; name: string; targetLang: string; dueCount: number }> = [];
  if (has("module.languages")) {
    try {
      const decks = await getDecks();
      languagesDue = decks.reduce((sum, d) => sum + (d.dueCount ?? 0), 0);
      languageDecks = decks
        .filter((d) => (d.dueCount ?? 0) > 0)
        .sort((a, b) => (b.dueCount ?? 0) - (a.dueCount ?? 0))
        .slice(0, 4)
        .map((d) => ({ id: d.id, name: d.name, targetLang: d.targetLang, dueCount: d.dueCount ?? 0 }));
    } catch {
      languagesDue = 0;
      languageDecks = [];
    }
  }

  // Zdrowie (conditional) — nadchodzące wizyty i badania
  let healthUpcomingCount = 0;
  let healthUpcoming: Array<{ id: string; kind: "VISIT" | "TEST"; title: string; specialty: string | null; scheduledAt: string }> = [];
  if (has("module.health")) {
    try {
      const events = await getHealthEvents({ scope: "upcoming" });
      const planned = events.filter((e) => e.status !== "CANCELLED");
      healthUpcomingCount = planned.length;
      healthUpcoming = planned.slice(0, 4).map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        specialty: e.specialty,
        scheduledAt: new Date(e.scheduledAt).toISOString(),
      }));
    } catch {
      healthUpcomingCount = 0;
      healthUpcoming = [];
    }
  }

  // Magazynowanie (conditional) — braki i terminy/gwarancje
  let storageLowStock = 0;
  let storageExpiring = 0;
  if (has("module.magazynowanie")) {
    try {
      const [low, expiring] = await Promise.all([getLowStock(), getExpiringStorage(30)]);
      storageLowStock = low.length;
      storageExpiring = expiring.length;
    } catch {
      storageLowStock = 0;
      storageExpiring = 0;
    }
  }

  // Admin stats (conditional)
  let adminStats: { userCount: number; teamCount: number; reportCount: number } | null = null;
  if (isAdmin) {
    const [userCount, teamCount, reportCount] = await Promise.all([
      prisma.user.count(),
      prisma.team.count(),
      prisma.report.count(),
    ]);
    adminStats = { userCount, teamCount, reportCount };
  }




  const zDeklaracji = await collectDashboardSnapshot(userId, userPermissions, { todayStart, todayEnd, teamIds });

  return {
    ...zDeklaracji,
    todayTasks,
    overdueTasks,
    todayTaskPreview,
    todayMeals: todayMealsForUI,
    expiringSoon: expiringCount,
    petCareDue,
    petAgenda,
    vehiclesCount,
    vehicleAlerts,
    languagesDue,
    languageDecks,
    healthUpcomingCount,
    healthUpcoming,
    storageLowStock,
    storageExpiring,
    adminStats,
  };
}
