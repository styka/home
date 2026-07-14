import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { executePetAction } from "@/lib/ai/executors/petExecutor";
import { executeHealthAction } from "@/lib/ai/executors/healthExecutor";
import { executeLanguageAction } from "@/lib/ai/executors/languageExecutor";
import { executeNewsAction } from "@/lib/ai/executors/newsExecutor";
import { executeWeatherAction } from "@/lib/ai/executors/weatherExecutor";
import { executeWarsztatAction } from "@/lib/ai/executors/warsztatExecutor";
import { executeReportAction } from "@/lib/ai/executors/reportExecutor";
import { executeNotesAction } from "@/lib/ai/executors/notesExecutor";
import { executeShoppingAction } from "@/lib/ai/executors/shoppingExecutor";
import { executeTasksAction } from "@/lib/ai/executors/tasksExecutor";
import { executeHabitsAction } from "@/lib/ai/executors/habitsExecutor";
import { executePortfelAction } from "@/lib/ai/executors/portfelExecutor";
import { executeFlotaAction } from "@/lib/ai/executors/flotaExecutor";
import { executeKitchenAction } from "@/lib/ai/executors/kitchenExecutor";
import { executeStorageAction } from "@/lib/ai/executors/storageExecutor";
import type { AIAction } from "@/lib/ai/aiAction";
import type { ExecOutcome, ActionResult } from "@/lib/ai/executors/shared";


async function executeAction(
  action: AIAction,
  userId: string,
  activeListId?: string,
  currentProjectId?: string
): Promise<string | ExecOutcome> {
  const { module, type } = action;

  if (module === "shopping") {
    return executeShoppingAction(action, userId, activeListId);
  }

  if (module === "tasks") {
    return executeTasksAction(action, userId, currentProjectId);
  }

  if (module === "notes") {
    return executeNotesAction(action, userId);
  }

  if (module === "pets") {
    return executePetAction(action, userId);
  }

  // ── Nawyki ────────────────────────────────────────────────────────────────
  if (module === "habits") {
    return executeHabitsAction(action, userId);
  }

  // ── Portfel ───────────────────────────────────────────────────────────────
  if (module === "portfel") {
    return executePortfelAction(action, userId);
  }

  // ── Kuchnia ───────────────────────────────────────────────────────────────
  if (module === "kitchen") {
    return executeKitchenAction(action, userId);
  }

  // ── Flota ─────────────────────────────────────────────────────────────────
  if (module === "flota") {
    return executeFlotaAction(action, userId);
  }

  // ── Magazynowanie ───────────────────────────────────────────────────────────
  if (module === "magazynowanie") {
    return executeStorageAction(action, userId);
  }

  // ── Warsztaty ─────────────────────────────────────────────────────────────
  if (module === "warsztaty") {
    return executeWarsztatAction(action, userId);
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
