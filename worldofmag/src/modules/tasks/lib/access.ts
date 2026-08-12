import { requireTaskModuleAccess } from "./sharingGuard";

/**
 * Z-052/Z-190: dostęp do pojedynczego zadania.
 *
 * **052:** reguła dziedziczenia „zadanie w projekcie → decyduje projekt" zniknęła stąd do
 * deklaracji zasobów (`../sharing.ts`) i jest rozstrzygana przez `platform/sharing`. Ten plik
 * zostaje jako **nazwa dla wołających** — komunikat odmowy bez zmian, więc użytkownik nie widzi
 * różnicy.
 *
 * **`id` jest WYMAGANE, a nie opcjonalne** — i to jest decyzja, nie drobiazg. Przy opcjonalnym
 * identyfikatorze wołający, którego `select` go nie pobiera, po cichu wracałby do starej reguły
 * i nowy mechanizm nigdy by się tam nie uruchomił. Wymóg w typie zamienia to w błąd kompilacji.
 */
export async function assertTaskAccess(
  task: { id: string; projectId: string | null; createdById: string | null; assigneeId: string | null },
  userId: string,
): Promise<void> {
  await requireTaskModuleAccess(userId, { type: "tasks.task", id: task.id }, "task.edit");
}
