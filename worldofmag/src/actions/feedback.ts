"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { assertProjectAccess } from "@/actions/taskProjects";

// 031: „wyrzutnik" na zgłoszenia od użytkowników.
//
// Reguła w Omnii jest normalnie taka, że zadanie można dodać tylko do projektu, którego jest się
// właścicielem albo do którego ma się udostępnienie (`assertProjectAccess`). Skrzynka zgłoszeń to
// JEDYNY, świadomy wyjątek: KAŻDY zalogowany użytkownik może tą drogą WRZUCIĆ zgłoszenie do
// projektu wskazanego przez administratora — ale nie zyskuje przez to prawa do jego ODCZYTU ani
// modyfikacji (te ścieżki dalej idą przez zwykły guard).
//
// Wyjątek jest celowo wąski: dotyczy wyłącznie funkcji `submitFeedbackTask` (tworzy zadanie,
// nic więcej) i wyłącznie jednego, wyznaczonego projektu. Nie ma dla niego uprawnienia RBAC,
// żeby nie dało się go przypadkiem rozszerzyć z panelu administratora.

// Klucz w `Config` wskazujący projekt-skrzynkę. Puste = fallback na projekt „Omnia" administratora.
// NIE eksportujemy: w pliku "use server" wolno eksportować wyłącznie funkcje async.
const FEEDBACK_PROJECT_CONFIG_KEY = "feedback_project_id";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 60_000;

/**
 * Wyznacza projekt-skrzynkę zgłoszeń:
 *  1. `Config.feedback_project_id` (ustawiany w /admin/config), jeśli taki projekt istnieje,
 *  2. fallback: najstarszy projekt o nazwie „Omnia" należący do użytkownika z rolą ADMIN.
 * Zwraca `null`, gdy skrzynki nie da się wyznaczyć (świeża instalacja bez admina).
 */
async function resolveFeedbackProjectId(): Promise<string | null> {
  const cfg = await prisma.config.findUnique({ where: { key: FEEDBACK_PROJECT_CONFIG_KEY } });
  const configured = cfg?.value?.trim();
  if (configured) {
    const exists = await prisma.taskProject.findUnique({ where: { id: configured }, select: { id: true } });
    if (exists) return exists.id;
    // Wskazano nieistniejący projekt — nie gubimy zgłoszenia, lecimy fallbackiem.
  }

  const adminIds = (
    await prisma.userRole.findMany({ where: { role: "ADMIN" }, select: { userId: true } })
  ).map((r) => r.userId);
  if (adminIds.length === 0) return null;

  const project = await prisma.taskProject.findFirst({
    where: { ownerId: { in: adminIds }, name: { equals: "Omnia", mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return project?.id ?? null;
}

export interface FeedbackInboxInfo {
  /** Id projektu-skrzynki (null = brak skonfigurowanej skrzynki). */
  projectId: string | null;
  /** Czy zalogowany użytkownik może OGLĄDAĆ zawartość skrzynki (właściciel / członek / admin). */
  canRead: boolean;
}

/**
 * Informacja dla UI: czy po utworzeniu zgłoszenia wolno zaproponować przejście do zadania.
 * Bez tego proponowaliśmy przejście do projektu, którego użytkownik i tak nie może otworzyć.
 */
export async function getFeedbackInboxInfo(): Promise<FeedbackInboxInfo> {
  const user = await requireAuth();
  const projectId = await resolveFeedbackProjectId();
  if (!projectId) return { projectId: null, canRead: false };
  try {
    await assertProjectAccess(projectId, user.id);
    return { projectId, canRead: true };
  } catch {
    return { projectId, canRead: false };
  }
}

export interface SubmitFeedbackResult {
  taskId: string;
  projectId: string;
  /** Czy użytkownik może otworzyć utworzone zadanie (decyduje o przycisku „Otwórz w zadaniach"). */
  canRead: boolean;
}

/**
 * Tworzy zgłoszenie (zadanie) w skrzynce administratora. Świadomie POMIJA `assertProjectAccess`
 * — to jedyne miejsce w aplikacji z takim odstępstwem (patrz komentarz na górze pliku).
 */
export async function submitFeedbackTask(input: {
  title: string;
  description?: string;
}): Promise<SubmitFeedbackResult> {
  const user = await requireAuth();

  const title = input.title?.trim().slice(0, TITLE_MAX);
  if (!title) throw new Error("Tytuł zgłoszenia nie może być pusty");
  const description = (input.description ?? "").slice(0, DESCRIPTION_MAX);

  const projectId = await resolveFeedbackProjectId();
  if (!projectId) throw new Error("Skrzynka zgłoszeń nie jest skonfigurowana — skontaktuj się z administratorem.");

  // `createdById` zostawia ślad, KTO zgłosił (admin widzi autora zgłoszenia w zadaniu).
  const task = await prisma.task.create({
    data: { title, description, projectId, createdById: user.id },
    select: { id: true },
  });

  let canRead = false;
  try {
    await assertProjectAccess(projectId, user.id);
    canRead = true;
  } catch {
    canRead = false;
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${projectId}`);
  return { taskId: task.id, projectId, canRead };
}
