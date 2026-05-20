import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { categorize } from "@/lib/categorize";
import { parseQuantity } from "@/lib/parseQuantity";
import { getUserTeamIds } from "@/lib/server-utils";
import type { AIAction } from "@/app/api/llm/home/interpret/route";

export interface ActionResult {
  id: string;
  success: boolean;
  description: string;
  error?: string;
}

async function executeAction(action: AIAction, userId: string, activeListId?: string): Promise<string> {
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

  throw new Error(`Nieznany typ akcji: ${module}/${type}`);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { actions?: AIAction[]; activeListId?: string };
  const { actions = [], activeListId } = body;

  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      const message = await executeAction(action, session.user.id, activeListId);
      results.push({ id: action.id, success: true, description: message });
      // Audit log
      await prisma.userActivity.create({
        data: {
          userId: session.user.id,
          module: "llm",
          action: `${action.module}/${action.type}`,
          metadata: { params: action.params, searchQuery: action.searchQuery, result: message },
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
