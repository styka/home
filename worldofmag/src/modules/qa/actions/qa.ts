"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import qaModule from "../module";
import type { QaEpic, QaUserStory, QaTestScenario } from "@prisma/client";

async function requireQaAccess() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!hasPermission(session, qaModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    throw new Error("Forbidden");
  }
  return session.user;
}

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
  return session!.user;
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" }[ch] ?? ch))
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Read (QA permission required) ────────────────────────────────────────

export interface EpicWithCounts extends QaEpic {
  storyCount: number;
  scenarioCount: number;
}

export interface ModuleStats {
  module: string;
  epicCount: number;
  storyCount: number;
  scenarioCount: number;
}

export async function getModuleStats(): Promise<ModuleStats[]> {
  await requireQaAccess();
  const epics = await prisma.qaEpic.findMany({
    select: {
      module: true,
      userStories: {
        select: { _count: { select: { scenarios: true } } },
      },
    },
  });
  const map = new Map<string, ModuleStats>();
  for (const e of epics) {
    if (!map.has(e.module)) {
      map.set(e.module, { module: e.module, epicCount: 0, storyCount: 0, scenarioCount: 0 });
    }
    const s = map.get(e.module)!;
    s.epicCount += 1;
    s.storyCount += e.userStories.length;
    s.scenarioCount += e.userStories.reduce((sum, st) => sum + st._count.scenarios, 0);
  }
  return Array.from(map.values()).sort((a, b) => a.module.localeCompare(b.module));
}

export interface ModuleTree extends QaEpic {
  userStories: (QaUserStory & { scenarios: QaTestScenario[] })[];
}

export async function getModuleTree(module: string): Promise<ModuleTree[]> {
  await requireQaAccess();
  return prisma.qaEpic.findMany({
    where: { module },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      userStories: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          scenarios: {
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
}

export interface ScenarioWithContext extends QaTestScenario {
  story: QaUserStory & { epic: QaEpic };
  siblings: { slug: string; title: string; order: number }[];
}

export async function getScenarioWithContext(slug: string): Promise<ScenarioWithContext | null> {
  await requireQaAccess();
  const scenario = await prisma.qaTestScenario.findUnique({
    where: { slug },
    include: { story: { include: { epic: true } } },
  });
  if (!scenario) return null;
  const siblings = await prisma.qaTestScenario.findMany({
    where: { storyId: scenario.storyId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { slug: true, title: true, order: true },
  });
  return { ...scenario, siblings };
}

// ─── Admin: full tree (no permission filter beyond admin) ──────────────────

export async function getAllEpics(): Promise<EpicWithCounts[]> {
  await requireAdmin();
  const rows = await prisma.qaEpic.findMany({
    orderBy: [{ module: "asc" }, { order: "asc" }],
    include: {
      _count: { select: { userStories: true } },
      userStories: { select: { _count: { select: { scenarios: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    module: r.module,
    order: r.order,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    storyCount: r._count.userStories,
    scenarioCount: r.userStories.reduce((sum, s) => sum + s._count.scenarios, 0),
  }));
}

export async function getEpicForAdmin(slug: string) {
  await requireAdmin();
  return prisma.qaEpic.findUnique({
    where: { slug },
    include: {
      userStories: {
        orderBy: [{ order: "asc" }],
        include: { _count: { select: { scenarios: true } } },
      },
    },
  });
}

/** Epik z pełnym drzewem historyjek i scenariuszy — dla drzewa redakcyjnego w panelu admina. */
export type AdminEpicTreeNode = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  module: string;
  order: number;
  stories: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    order: number;
    scenarios: { id: string; slug: string; title: string; type: string; priority: string; order: number }[];
  }[];
};

/**
 * 047: pełne drzewo Epik → Historyjka → Scenariusz dla panelu redakcyjnego.
 *
 * Powstało, żeby `app/admin/qa/page.tsx` przestał odpytywać Prismę z pominięciem kontraktu modułu
 * (dług nazwany w recenzji 046). `getAllEpics` się do tego nie nadaje — zwraca **liczniki**
 * historyjek i scenariuszy, a drzewo redakcyjne potrzebuje ich treści. To dwie różne potrzeby,
 * więc kontrakt dostaje drugą funkcję zamiast rozdmuchanego wariantu jednej.
 */
export async function getEpicTreeForAdmin(): Promise<AdminEpicTreeNode[]> {
  await requireAdmin();
  const rows = await prisma.qaEpic.findMany({
    orderBy: [{ module: "asc" }, { order: "asc" }],
    include: {
      userStories: {
        orderBy: [{ order: "asc" }],
        include: {
          scenarios: {
            orderBy: [{ order: "asc" }],
            select: { id: true, slug: true, title: true, type: true, priority: true, order: true },
          },
        },
      },
    },
  });

  return rows.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    module: e.module,
    order: e.order,
    stories: e.userStories.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      description: s.description,
      order: s.order,
      scenarios: s.scenarios,
    })),
  }));
}

export async function getStoryForAdmin(slug: string) {
  await requireAdmin();
  return prisma.qaUserStory.findUnique({
    where: { slug },
    include: {
      epic: true,
      scenarios: { orderBy: [{ order: "asc" }] },
    },
  });
}

export async function getScenarioForAdmin(slug: string) {
  await requireAdmin();
  return prisma.qaTestScenario.findUnique({
    where: { slug },
    include: { story: { include: { epic: true } } },
  });
}

// ─── Mutations (Admin only) ────────────────────────────────────────────────

export async function createEpic(data: {
  title: string;
  slug?: string;
  module: string;
  description?: string;
  order?: number;
}): Promise<QaEpic> {
  await requireAdmin();
  const slug = normalizeSlug(data.slug ?? `epic-${data.module}-${data.title}`);
  const epic = await prisma.qaEpic.create({
    data: {
      title: data.title.trim(),
      slug,
      module: data.module,
      description: data.description?.trim() || null,
      order: data.order ?? 0,
    },
  });
  revalidatePath("/admin/qa");
  revalidatePath(`/qa/${data.module}`);
  revalidatePath("/qa");
  return epic;
}

export async function updateEpic(
  slug: string,
  data: { title?: string; description?: string; module?: string; order?: number },
): Promise<QaEpic> {
  await requireAdmin();
  const before = await prisma.qaEpic.findUnique({ where: { slug } });
  const epic = await prisma.qaEpic.update({
    where: { slug },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      ...(data.module !== undefined ? { module: data.module } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
  });
  revalidatePath("/admin/qa");
  if (before) revalidatePath(`/qa/${before.module}`);
  revalidatePath(`/qa/${epic.module}`);
  revalidatePath("/qa");
  return epic;
}

export async function deleteEpic(slug: string): Promise<void> {
  await requireAdmin();
  const before = await prisma.qaEpic.findUnique({ where: { slug } });
  await prisma.qaEpic.delete({ where: { slug } });
  revalidatePath("/admin/qa");
  if (before) revalidatePath(`/qa/${before.module}`);
  revalidatePath("/qa");
}

export async function createStory(data: {
  title: string;
  slug?: string;
  epicSlug: string;
  description?: string;
  order?: number;
}): Promise<QaUserStory> {
  await requireAdmin();
  const epic = await prisma.qaEpic.findUnique({ where: { slug: data.epicSlug } });
  if (!epic) throw new Error("Epic nie istnieje");
  const slug = normalizeSlug(data.slug ?? `story-${data.title}`);
  const story = await prisma.qaUserStory.create({
    data: {
      title: data.title.trim(),
      slug,
      epicId: epic.id,
      description: data.description?.trim() || null,
      order: data.order ?? 0,
    },
  });
  revalidatePath("/admin/qa");
  revalidatePath(`/qa/${epic.module}`);
  return story;
}

export async function updateStory(
  slug: string,
  data: { title?: string; description?: string; order?: number },
): Promise<QaUserStory> {
  await requireAdmin();
  const story = await prisma.qaUserStory.update({
    where: { slug },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
    include: { epic: true },
  });
  revalidatePath("/admin/qa");
  revalidatePath(`/qa/${story.epic.module}`);
  return story;
}

export async function deleteStory(slug: string): Promise<void> {
  await requireAdmin();
  const before = await prisma.qaUserStory.findUnique({
    where: { slug },
    include: { epic: true },
  });
  await prisma.qaUserStory.delete({ where: { slug } });
  revalidatePath("/admin/qa");
  if (before) revalidatePath(`/qa/${before.epic.module}`);
}

export async function createScenario(data: {
  title: string;
  slug?: string;
  storySlug: string;
  type?: string;
  priority?: string;
  content: string;
  order?: number;
}): Promise<QaTestScenario> {
  const user = await requireAdmin();
  const story = await prisma.qaUserStory.findUnique({
    where: { slug: data.storySlug },
    include: { epic: true },
  });
  if (!story) throw new Error("User Story nie istnieje");
  const slug = normalizeSlug(data.slug ?? `scenario-${data.title}`);
  const scenario = await prisma.qaTestScenario.create({
    data: {
      title: data.title.trim(),
      slug,
      storyId: story.id,
      type: data.type ?? "positive",
      priority: data.priority ?? "P1",
      content: data.content,
      order: data.order ?? 0,
      authorId: user.id,
    },
  });
  revalidatePath("/admin/qa");
  revalidatePath(`/qa/${story.epic.module}`);
  return scenario;
}

export async function updateScenario(
  slug: string,
  data: { title?: string; type?: string; priority?: string; content?: string; order?: number },
): Promise<QaTestScenario> {
  await requireAdmin();
  const scenario = await prisma.qaTestScenario.update({
    where: { slug },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
    include: { story: { include: { epic: true } } },
  });
  revalidatePath("/admin/qa");
  revalidatePath(`/qa/${scenario.story.epic.module}`);
  revalidatePath(`/qa/scenariusz/${slug}`);
  return scenario;
}

export async function deleteScenario(slug: string): Promise<void> {
  await requireAdmin();
  const before = await prisma.qaTestScenario.findUnique({
    where: { slug },
    include: { story: { include: { epic: true } } },
  });
  await prisma.qaTestScenario.delete({ where: { slug } });
  revalidatePath("/admin/qa");
  if (before) revalidatePath(`/qa/${before.story.epic.module}`);
}
