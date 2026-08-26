"use server";

import { prisma } from "@/platform/db/prisma";
import { requireAuth, isAdminSession } from "@/platform/auth/serverUtils";
import { userTimeZone, dataWStrefie } from "@/lib/userTime";
import { czyPokazanoDzisiaj, zapiszPokazane } from "@/lib/promptWznowienia";

/**
 * 106 — PROMPT WZNOWIENIA PRACY.
 *
 * Problem, który to rozwiązuje: część roboty (np. zbieranie zgłoszeń CSP) wymaga, żeby minęło kilka
 * dni — a przez te kilka dni nie ma czego zrobić. Sesja się kończy, kontekst przepada i wraca się do
 * tematu przypadkiem albo wcale. Zwykłe powiadomienie tego nie ratuje: ginie w dzwonku razem
 * z resztą i nie niesie tego, co jest naprawdę potrzebne — GOTOWEGO tekstu do wklejenia.
 *
 * Dlatego to jest dialog, a nie powiadomienie, i dlatego treść mieszka w bazie, a nie w kodzie:
 * zmienia się razem z postępem prac, więc zmienia ją migracja — tą samą drogą, którą dostarczamy
 * raporty.
 */

export type PromptWznowieniaDTO = {
  klucz: string;
  tytul: string;
  wstep: string;
  tresc: string;
};

/**
 * Prompt do pokazania administratorowi — albo `null`.
 *
 * `null` znaczy jedną z trzech rzeczy i wszystkie są normalne: nie jesteś administratorem, nie ma
 * aktywnego promptu, albo widziałeś go już dzisiaj.
 */
export async function getPromptDoPokazania(): Promise<PromptWznowieniaDTO | null> {
  const user = await requireAuth();
  if (!(await isAdminSession())) return null;

  const prompt = await prisma.promptWznowienia.findFirst({
    where: { aktywny: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!prompt) return null;

  const pref = await prisma.userMenuPref.findUnique({
    where: { userId: user.id },
    select: { promptyPokazane: true },
  });
  if (czyPokazanoDzisiaj(pref?.promptyPokazane, prompt.klucz, dataWStrefie(userTimeZone()))) return null;

  return { klucz: prompt.klucz, tytul: prompt.tytul, wstep: prompt.wstep, tresc: prompt.tresc };
}

/**
 * Zapamiętuje, że użytkownik widział prompt DZISIAJ.
 *
 * Świadomie BEZ `revalidatePath`: zapis dotyczy wyłącznie tego, czy dialog ma się pokazać ponownie,
 * a odświeżenie ścieżki przeładowałoby stronę pod użytkownikiem w chwili, gdy zamyka okno.
 */
export async function oznaczPromptPokazany(klucz: string): Promise<void> {
  const user = await requireAuth();
  if (!(await isAdminSession())) return;

  const pref = await prisma.userMenuPref.findUnique({
    where: { userId: user.id },
    select: { promptyPokazane: true },
  });
  const mapa = zapiszPokazane(pref?.promptyPokazane, klucz, dataWStrefie(userTimeZone()));

  await prisma.userMenuPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, promptyPokazane: mapa },
    update: { promptyPokazane: mapa },
  });
}
