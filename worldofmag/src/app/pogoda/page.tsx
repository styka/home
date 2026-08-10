export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import weatherModule from "@/modules/weather/module";
import { getLocations, getWatchers } from "@/modules/weather/actions/weather";
import { getUsdPlnRate } from "@/lib/usdPlnRate";
import { WeatherPage } from "@/modules/weather/ui/WeatherPage";

export default async function PogodaRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, weatherModule.permission)) redirect("/");

  const [locations, watchers, usdPlnRate] = await Promise.all([
    getLocations(),
    getWatchers(),
    getUsdPlnRate(),
  ]);
  // „Dodaj do zadań" pokazujemy tylko komuś, kto ma dostęp do modułu Zadania — akcja i tak to
  // sprawdza po stronie serwera, ale przycisk, który zawsze kończy się błędem, byłby wadą UX.
  const canAddToTasks = hasPermission(session, PERMISSIONS.TASKS);

  return (
    <WeatherPage
      locations={locations}
      watchers={watchers}
      usdPlnRate={usdPlnRate}
      canAddToTasks={canAddToTasks}
    />
  );
}
