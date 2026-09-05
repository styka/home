import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { TasksRouteView } from "@/modules/tasks/ui/TasksRouteView";

export const dynamic = "force-dynamic";

/**
 * 125: widok ZBIORCZY OBSZARU-KATEGORII — następca widoku zapisanego zestawu. Zakres = zadania
 * projektów całego poddrzewa obszaru (obszar + pod-obszary aż do liści), liczony w
 * `TasksRouteView` z segmentu ścieżki (nigdy z parametrów zapytania — lekcja 080).
 *
 * Kontrola uprawnienia `module.tasks` dziedziczy się z `src/app/tasks/layout.tsx`.
 */
export default async function ObszarPage({
  params,
  searchParams,
}: {
  params: { obszarId: string };
  searchParams?: Record<string, string | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  return <TasksRouteView projectId="" obszarId={params.obszarId} searchParams={searchParams} />;
}
