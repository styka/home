import { assertProjectAccess } from "@/actions/taskProjects";

/**
 * Z-052/Z-190: dostęp do pojedynczego zadania. Zadania w projekcie chroni dostęp
 * do projektu; zadania bez projektu (osobiste, `projectId=null`) — własność przez
 * twórcę lub przypisanie, spójnie z `getAllUserTasks`. Domyka IDOR na zadaniach
 * `projectId=null`, które wcześniej omijały guard `if (task.projectId)`.
 *
 * Wydzielone z `actions/tasks.ts` (która jest "use server"), żeby dało się to
 * pokryć testem izolacji bez wystawiania funkcji jako Server Action.
 */
export async function assertTaskAccess(
  task: { projectId: string | null; createdById: string | null; assigneeId: string | null },
  userId: string,
): Promise<void> {
  if (task.projectId) {
    await assertProjectAccess(task.projectId, userId);
    return;
  }
  if (task.createdById === userId || task.assigneeId === userId) return;
  throw new Error("Access denied");
}
