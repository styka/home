export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getCalendarEvents } from "@/actions/calendar";
import { MODULE_META, type CalendarModule } from "@/lib/calendar";
import { CalendarPage } from "@/components/calendar/CalendarPage";

export default async function CalendarRootPage({ searchParams }: { searchParams?: { module?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.CALENDAR)) redirect("/");

  const now = new Date();
  const year = now.getFullYear();
  const month0 = now.getMonth();
  const events = await getCalendarEvents(year, month0);

  // P4: opcjonalny wstępny filtr modułu z query (np. /calendar?module=pets).
  const m = searchParams?.module;
  const initialModule = m && m in MODULE_META ? (m as CalendarModule) : null;

  return <CalendarPage initialYear={year} initialMonth0={month0} initialEvents={events} initialModule={initialModule} />;
}
