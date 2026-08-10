export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import tasksModule from "@/modules/tasks/module";
import weatherModule from "@/modules/weather/module";
import { getIdeaLibrary } from "@/modules/weather/actions/weather";
import { getUsdPlnRate } from "@/lib/usdPlnRate";
import { IdeaLibraryPage } from "@/modules/weather/ui/IdeaLibraryPage";

/**
 * 037: biblioteka pomysłów „co robić". Podstrona modułu Pogoda, więc chroni ją to samo uprawnienie —
 * `permissionForPath` mapuje całe `/pogoda*` na `module.weather` i nie wymaga nowego sluga (C-22).
 */
export default async function PogodaPomyslyPage({
  searchParams,
}: {
  searchParams?: { idea?: string; filter?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, weatherModule.permission)) redirect("/");

  const [ideas, usdPlnRate] = await Promise.all([getIdeaLibrary(), getUsdPlnRate()]);

  return (
    <IdeaLibraryPage
      ideas={ideas}
      usdPlnRate={usdPlnRate}
      canAddToTasks={hasPermission(session, tasksModule.permission)}
      initialIdeaId={searchParams?.idea}
      viewParams={searchParams ?? {}}
    />
  );
}
