// Z-010: handler akcji asystenta dla modułu Nawyki.
// Scala trzy dawne bloki `module === "habits"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { getUserTeamIds } from "@/lib/server-utils";
import { toggleHabitDay, createHabit, updateHabit, setHabitArchived, deleteHabit } from "@/actions/habits";
import { asStr, undoAction, resolveByName, ownerOrArr, type ExecOutcome } from "@/lib/ai/executors/shared";
import { isoDate } from "@/lib/habitStats";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeHabitsAction(action: AIAction, userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

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

  if (type === "create_habit") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę nawyku");
    const habit = await createHabit({
      name,
      description: asStr(params.description) ?? null,
      icon: asStr(params.icon),
    });
    return `Utworzono nawyk „${habit.name}"`;
  }

  const teamOr = await ownerOrArr(userId);
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

  throw new Error(`Nieznany typ akcji nawyków: ${type}`);
}
