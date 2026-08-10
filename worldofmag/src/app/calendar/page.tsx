export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import calendarModule from "@/modules/calendar/module";
import { getCalendarEvents } from "@/modules/calendar/actions/calendar";
import { CalendarPage } from "@/modules/calendar/ui/CalendarPage";

export default async function CalendarRootPage({ searchParams }: { searchParams?: { module?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, calendarModule.permission)) redirect("/");

  const now = new Date();
  const year = now.getFullYear();
  const month0 = now.getMonth();
  const events = await getCalendarEvents(year, month0);

  return <CalendarPage initialYear={year} initialMonth0={month0} initialEvents={events} viewParams={searchParams ?? {}} />;
}
