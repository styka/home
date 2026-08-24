// 099: dorobienie tytułu zgłoszenia — JEDYNE miejsce, w którym model bierze udział w zgłoszeniu.
//
// Dlaczego zadanie w tle, a nie wywołanie z akcji albo strzał z przeglądarki:
//   • z akcji — zgłaszający musiałby czekać na model, a to jest dokładnie ten ból, który usuwamy;
//   • z przeglądarki — zamknięcie asystenta przerywa trwające żądania (`abort()` w `handleClose`),
//     więc tytuł ginąłby przy najczęstszym scenariuszu: „opisałem, zamykam, wracam do pracy".
// Kolejka ma trwały stan i ponawianie, więc jest jedyną drogą, która dowozi bez oczekiwania.
//
// Handler jest CELOWO ostrożny: gdy zadania już nie ma, gdy tytuł zdążył zmienić człowiek albo gdy
// model jest niedostępny — kończy się cicho, a zgłoszenie zostaje z pełnoprawnym tytułem roboczym.
// Kosmetyka nigdy nie wygrywa z decyzją człowieka i nigdy nie jest powodem błędu.

import { prisma } from "@/platform/db/prisma";
import { chatComplete } from "@/platform/llm/chat";
import { updateWithVersion } from "@/platform/concurrency/version";
import { usageFromChat, type AiUsageInfo } from "@/platform/ai/usage";
import { logEvent } from "@/platform/observability/log";
import type { JobContext } from "@/platform/jobs/types";
import { czyTytulRoboczy, PREFIKS_ZGLOSZENIA } from "@/lib/ai/feedbackTitle";

export interface FeedbackTitlePayload {
  taskId: string;
  /** Tytuł nadany przy zapisie — podmieniamy TYLKO jego (patrz: decyzja człowieka wygrywa). */
  tytulRoboczy: string;
}

export interface FeedbackTitleResult {
  /** Tytuł po przebiegu — nowy albo ten sam, gdy nic nie zmienialiśmy. */
  title: string;
  /** Czemu nic nie zmieniliśmy (gdy nie zmienialiśmy) — do diagnostyki, nie do UI. */
  skipped?: "brak-zadania" | "tytul-zmieniony" | "model-niedostepny" | "pusta-odpowiedz" | "konflikt";
  usage?: AiUsageInfo;
}

/** Ile znaków tytułu w ogóle przyjmujemy od modelu. */
const MAX_TITLE = 80;

export async function feedbackTitleHandler(
  payload: FeedbackTitlePayload,
  _ctx: JobContext
): Promise<FeedbackTitleResult> {
  const { taskId, tytulRoboczy } = payload;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, description: true, version: true },
  });
  if (!task) return { title: tytulRoboczy, skipped: "brak-zadania" };
  if (!czyTytulRoboczy(task.title, tytulRoboczy)) {
    return { title: task.title, skipped: "tytul-zmieniony" };
  }

  const opis = (task.description ?? "").slice(0, 4000);
  const res = await chatComplete({
    // Typ operacji `dispatch` = krótkie, tanie przetwarzanie tekstu. Model wybiera admin
    // w `/admin/llm` (C-40) — tu nie ma ani nazwy dostawcy, ani nazwy modelu.
    op: "dispatch",
    source: "feedback_title",
    maxTokens: 60,
    messages: [
      {
        role: "system",
        content:
          "Jesteś redaktorem listy zgłoszeń. Z opisu zgłoszenia ułóż JEDEN zwięzły, konkretny tytuł " +
          "po polsku (max 80 znaków). Sam tytuł — bez cudzysłowów, bez kropki na końcu, bez emoji, " +
          "bez przedrostków w rodzaju „Zgłoszenie:”. Nazwij PROBLEM, nie powtarzaj całego opisu.",
      },
      { role: "user", content: opis || tytulRoboczy },
    ],
  });

  if (!res.ok) {
    // Brak modelu to nie awaria zgłoszenia — zadanie zostaje z tytułem roboczym.
    logEvent("info", "feedback.tytul.model-niedostepny", { taskId, status: res.status });
    return { title: tytulRoboczy, skipped: "model-niedostepny" };
  }

  const nowy = oczyscTytul(res.content);
  if (!nowy) return { title: tytulRoboczy, skipped: "pusta-odpowiedz", usage: usageFromChat([{ res, label: "Tytuł zgłoszenia", op: "dispatch" }]) };

  try {
    // `Task` ma kolumnę `version`, więc zapis MUSI iść przez `updateWithVersion` (bramka
    // `check:versioning`). Wersja z odczytu jest tu dodatkową ochroną: gdy ktoś zmienił zadanie
    // między odczytem a zapisem, wolimy nie ruszać niczego.
    await updateWithVersion(
      prisma.task,
      "Zadanie",
      task.id,
      { title: `${PREFIKS_ZGLOSZENIA}${nowy}` },
      task.version,
    );
  } catch {
    return { title: task.title, skipped: "konflikt", usage: usageFromChat([{ res, label: "Tytuł zgłoszenia", op: "dispatch" }]) };
  }

  return { title: `${PREFIKS_ZGLOSZENIA}${nowy}`, usage: usageFromChat([{ res, label: "Tytuł zgłoszenia", op: "dispatch" }]) };
}

/** Modele lubią dokleić cudzysłów, kropkę albo własny przedrostek — obcinamy to jednym miejscem. */
function oczyscTytul(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'„»]+|["'”«.]+$/g, "")
    .replace(/^(zgłoszenie|tytuł)\s*[:—-]\s*/i, "")
    .replace(/^🐛\s*/, "")
    .trim()
    .slice(0, MAX_TITLE);
}
