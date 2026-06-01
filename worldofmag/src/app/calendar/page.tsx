export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getCalendarEvents } from "@/actions/calendar";
import { CalendarPage } from "@/components/calendar/CalendarPage";

export default async function CalendarRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.CALENDAR)) redirect("/");

  const now = new Date();
  const year = now.getFullYear();
  const month0 = now.getMonth();
  const events = await getCalendarEvents(year, month0);

  return <CalendarPage initialYear={year} initialMonth0={month0} initialEvents={events} />;
}
