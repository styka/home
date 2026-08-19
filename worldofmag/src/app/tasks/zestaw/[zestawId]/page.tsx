import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { TasksRouteView } from "@/modules/tasks/ui/TasksRouteView";

export const dynamic = "force-dynamic";

/**
 * 080 (Z3): widok ZAPISANEGO ZESTAWU PROJEKTÓW, z zakresem w segmencie ścieżki.
 *
 * Poprzedni adres `/tasks/multi?group=<id>` trzymał zakres w parametrze zapytania, a te potrafią
 * nie dotrzeć przy ponownym renderze wywołanym z akcji (`revalidatePath`). Efektem był pusty widok
 * — „🗂 Wiele projektów (0)" — po każdej zmianie statusu zadania. `params` są częścią trasy, więc
 * Next ma je zawsze i cała ta klasa błędu znika strukturalnie, a nie przez łatkę.
 *
 * Stary adres nadal działa: `/tasks/[projectId]` przekierowuje tutaj (zapisane ulubione widoki
 * właściciela muszą przeżyć tę zmianę).
 *
 * Kontrola uprawnienia `module.tasks` dziedziczy się z `src/app/tasks/layout.tsx` — trasa leży
 * pod `/tasks`, więc guard z 098 obejmuje ją bez dodatkowego kodu.
 */
export default async function TaskSetPage({
  params,
  searchParams,
}: {
  params: { zestawId: string };
  searchParams?: Record<string, string | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  return <TasksRouteView projectId="" zestawId={params.zestawId} searchParams={searchParams} />;
}
