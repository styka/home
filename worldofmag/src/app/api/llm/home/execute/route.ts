import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import type { AIAction } from "@/platform/ai/aiAction";
import { getAiCatalog } from "@/lib/ai/catalog";
import { toUserFacingError, type ExecOutcome, type ActionResult } from "@/lib/ai/executorShared";
import { hasContract, validateActionParams } from "@/platform/ai/actionContract";


async function executeAction(
  action: AIAction,
  userId: string,
  activeListId?: string,
  currentProjectId?: string
): Promise<string | ExecOutcome> {
  const { module, type } = action;

  // 031: JEDEN choke point walidacji — zanim akcja dotknie jakiegokolwiek modułu.
  // Asystent nie ma drogi obejścia reguł, które obowiązują użytkownika w formularzu: te same
  // reguły (kontrakt akcji) sprawdza front dla UX, a TUTAJ sprawdzamy je rozstrzygająco.
  if (!hasContract(type)) throw new Error(`Nieznana akcja: ${type}`);
  const invalid = validateActionParams(action);
  if (invalid.length > 0) throw new Error(invalid.join(" "));

  // 049: rejestr egzekutorów pochodzi z DEKLARACJI modułów (rozdz. 9.6). Wcześniej był tu łańcuch
  // szesnastu `if (module === …)` — równoległa lista, którą trzeba było pamiętać przy każdym nowym
  // module i której nic nie pilnowało. Teraz moduł bez deklaracji po prostu nie ma egzekutora,
  // a `check:actions` tego dopilnuje przed wdrożeniem.
  const { executeByModule } = await getAiCatalog();
  const execute = executeByModule[module];
  if (execute) return execute(action, userId, { activeListId, currentProjectId });

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
      // 031: odmowa dostępu wraca jako JEDEN, zrozumiały komunikat — bez wyciekania treści
      // cudzych rekordów i bez technicznego „Access denied".
      results.push({
        id: action.id,
        success: false,
        description: action.description,
        error: toUserFacingError(e),
      });
    }
  }

  return NextResponse.json({ results });
}
