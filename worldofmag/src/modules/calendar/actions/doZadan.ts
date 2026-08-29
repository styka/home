"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/platform/auth/session";
import { requireAuth } from "@/platform/auth/serverUtils";
import { hasPermission } from "@/platform/auth/permissions";
import { createTask, tasksModule } from "@/modules/tasks/contract";

/**
 * 115 (Z-INT-01): „Do zadań" z pozycji WSPÓLNEJ AGENDY — jeden mechanizm huba zamiast
 * tuzina bliźniaczych przycisków per moduł. Pozycja dowolnego wkładu (przegląd auta,
 * zabieg roślinny, urodziny…) staje się zadaniem z terminem i odnośnikiem do źródła.
 *
 * Guard: sesja + uprawnienie do modułu Zadania (wzorzec `addIdeaToTasks` z Pogody).
 * Dane pozycji przychodzą z klienta, ale niczego nie autoryzują — tworzą wyłącznie
 * ZADANIE wołającego, przez kontrakt Zadań z jego własnymi guardami.
 */
export async function dodajPozycjeDoZadan(data: {
  title: string;
  /** Dzień pozycji "YYYY-MM-DD" (klucz siatki). */
  date: string;
  /** Pełny znacznik czasu ISO, gdy pozycja ma godzinę. */
  at?: string | null;
  href: string;
  moduleLabel: string;
}): Promise<{ id: string }> {
  await requireAuth();
  const session = await auth();
  if (!hasPermission(session, tasksModule.permission)) throw new Error("Brak dostępu do modułu Zadania");

  const title = data.title.trim();
  if (!title) throw new Error("Pozycja bez tytułu");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("Nieprawidłowa data pozycji");

  // Termin: godzina pozycji, a bez niej południe dnia — północ przy strefach ląduje „wczoraj".
  const dueDate = data.at ? new Date(data.at) : new Date(`${data.date}T12:00:00`);
  if (isNaN(dueDate.getTime())) throw new Error("Nieprawidłowa data pozycji");

  const task = await createTask({
    title,
    dueDate,
    description: `Z kalendarza (${data.moduleLabel}).\nŹródło: ${data.href}`,
  });

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  return { id: task.id };
}
