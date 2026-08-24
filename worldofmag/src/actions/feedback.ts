"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { assertProjectAccess } from "@/modules/tasks/contract";
import { SUFIT_LISTY } from "@/platform/pagination";
import { enqueue } from "@/platform/jobs/queue";
import { ensureJobWorker } from "@/lib/jobs/registry";
import { roboczyTytul, poprawnyZrzut } from "@/lib/ai/zgloszenie";
import { logEvent } from "@/platform/observability/log";
import type { TaskPriority } from "@/types";

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

/** Priorytet domyślny zgłoszenia: „coś do zrobienia", ale nie awaria. */
const DEFAULT_PRIORITY: TaskPriority = "MEDIUM";
const PRIORITIES: readonly TaskPriority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];

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
    await prisma.userRole.findMany({ take: SUFIT_LISTY, where: { role: "ADMIN" }, select: { userId: true } })
  ).map((r) => r.userId);
  if (adminIds.length === 0) return null;

  // 079: „projekt należący do któregokolwiek administratora" = projekt w JEGO przestrzeni
  // OSOBISTEJ. Przekład jeden do jednego przez lustro; projekty zespołowe nie wchodziły i nie
  // wchodzą. Warunek idzie RELACJĄ (klucz obcy z 0243), więc nie dokłada osobnego zapytania.
  const project = await prisma.taskProject.findFirst({
    where: {
      workspace: { personalUserId: { in: adminIds } },
      name: { equals: "Omnia", mode: "insensitive" },
    },
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
  /** 099: tytuł, pod jakim zgłoszenie faktycznie powstało — UI potwierdza nim utworzenie od ręki. */
  title: string;
  /** 099: czy do zadania trafił zrzut wskazanego elementu (odrzucony zrzut nie jest błędem). */
  hasScreenshot: boolean;
}


/**
 * Tworzy zgłoszenie (zadanie) w skrzynce administratora. Świadomie POMIJA `assertProjectAccess`
 * — to jedyne miejsce w aplikacji z takim odstępstwem (patrz komentarz na górze pliku).
 */
export async function submitFeedbackTask(input: {
  /**
   * 099: tytuł jest OPCJONALNY.
   *
   * Podaje go wyłącznie asystent, gdy zgłoszenie wychodzi ze zwykłej rozmowy (akcja
   * `submit_feedback` — model już wtedy wymyślił tytuł). Tryb wskazywania go NIE podaje: zapis ma
   * być natychmiastowy, więc tytuł roboczy nadajemy tutaj, a ładniejszy dorabia zadanie w tle.
   */
  title?: string;
  description?: string;
  /** 099: priorytet wybrany przez zgłaszającego w chwili opisywania. */
  priority?: TaskPriority;
  /** 099: zrzut wskazanego elementu jako data URL (PNG/JPEG). */
  screenshotDataUrl?: string;
}): Promise<SubmitFeedbackResult> {
  const user = await requireAuth();

  const description = (input.description ?? "").slice(0, DESCRIPTION_MAX);
  const podanyTytul = input.title?.trim().slice(0, TITLE_MAX);
  // Bez tytułu i bez opisu nie ma zgłoszenia — ale sam brak tytułu nie jest już błędem.
  if (!podanyTytul && !description.trim()) throw new Error("Zgłoszenie nie może być puste");
  const title = podanyTytul || roboczyTytul(description);
  const priority = PRIORITIES.includes(input.priority as TaskPriority)
    ? (input.priority as TaskPriority)
    : DEFAULT_PRIORITY;

  const projectId = await resolveFeedbackProjectId();
  if (!projectId) throw new Error("Skrzynka zgłoszeń nie jest skonfigurowana — skontaktuj się z administratorem.");

  // `createdById` zostawia ślad, KTO zgłosił (admin widzi autora zgłoszenia w zadaniu).
  const task = await prisma.task.create({
    data: { title, description, projectId, createdById: user.id, priority },
    select: { id: true },
  });

  // 099 (AC-6, AC-8): zrzut jest DODATKIEM. Zapisujemy go osobno i po zadaniu — gdyby poszedł
  // wspólną transakcją, uszkodzony obraz kasowałby całe zgłoszenie, czyli to, po co tu przyszliśmy.
  const hasScreenshot = poprawnyZrzut(input.screenshotDataUrl);
  if (hasScreenshot) {
    try {
      await prisma.taskAttachment.create({
        data: { taskId: task.id, name: "Zrzut wskazanego elementu", kind: "screenshot", url: input.screenshotDataUrl! },
      });
    } catch (e) {
      logEvent("warn", "feedback.zrzut.nieudany", { taskId: task.id, blad: String(e) });
    }
  }

  // 099 (AC-1, AC-3, AC-4): ładny tytuł dorabia KOLEJKA, nie ta akcja.
  //
  // Żądanie wystrzelone z przeglądarki ginie razem z zamknięciem asystenta — a to jest dokładnie
  // ten scenariusz, dla którego cała zmiana powstała. Kolejka ma trwały stan i ponawianie, więc
  // tytuł dojedzie niezależnie od tego, co zgłaszający zrobi ze swoją kartą. Awaria kolejkowania
  // NIE może wywrócić zgłoszenia: zadanie ma już pełnoprawny tytuł roboczy.
  if (!podanyTytul) {
    try {
      await enqueue(
        "tasks.feedbackTitle",
        { taskId: task.id, tytulRoboczy: title },
        { ownerId: user.id, dedupeKey: `tasks.feedbackTitle:${task.id}`, maxAttempts: 2 }
      );
      // Worker startuje leniwie i tylko z tras `/api/jobs`; ta ścieżka ich nie dotyka.
      ensureJobWorker();
    } catch (e) {
      logEvent("warn", "feedback.tytul.niezakolejkowany", { taskId: task.id, blad: String(e) });
    }
  }

  let canRead = false;
  try {
    await assertProjectAccess(projectId, user.id);
    canRead = true;
  } catch {
    canRead = false;
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${projectId}`);
  return { taskId: task.id, projectId, canRead, title, hasScreenshot };
}
