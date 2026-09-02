export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import calendarModule from "@/modules/calendar/module";
import weatherModule from "@/modules/weather/module";
import { getCalendarEvents } from "@/actions/calendarAgenda";
import { getKalendarzPrognoza, type DzienPrognozyKalendarza } from "@/modules/weather/contract";
import { CalendarPage } from "@/modules/calendar/ui/CalendarPage";

export default async function CalendarRootPage({ searchParams }: { searchParams?: { module?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, calendarModule.permission)) redirect("/");

  const now = new Date();
  const year = now.getFullYear();
  const month0 = now.getMonth();
  // 115 (Z-INT-15): prognoza domyślnej lokalizacji do komórek siatki — tylko z modułem Pogoda;
  // wyłączona preferencja albo awaria Open-Meteo zwraca pustą listę, nigdy nie blokuje agendy.
  const [events, prognoza] = await Promise.all([
    getCalendarEvents(year, month0),
    hasPermission(session, weatherModule.permission)
      ? getKalendarzPrognoza().then((p) => p.dni).catch((): DzienPrognozyKalendarza[] => [])
      : Promise.resolve<DzienPrognozyKalendarza[]>([]),
  ]);

  return <CalendarPage initialYear={year} initialMonth0={month0} initialEvents={events} prognoza={prognoza} viewParams={searchParams ?? {}} />;
}
