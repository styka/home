export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getLocations, getWatchers } from "@/actions/weather";
import { WeatherPage } from "@/components/weather/WeatherPage";

export default async function PogodaRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.WEATHER)) redirect("/");

  const [locations, watchers] = await Promise.all([getLocations(), getWatchers()]);

  return <WeatherPage locations={locations} watchers={watchers} />;
}
