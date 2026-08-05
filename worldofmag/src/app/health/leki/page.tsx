export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import healthModule from "@/modules/health/module";
import { getMedicationSchedules, getMedicationDay } from "@/modules/health/actions/medications";
import { MedicationsPage } from "@/modules/health/ui/MedicationsPage";

export default async function HealthMedicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, healthModule.permission)) redirect("/");

  const [schedules, today] = await Promise.all([getMedicationSchedules(), getMedicationDay()]);

  return <MedicationsPage schedules={schedules} today={today} />;
}
