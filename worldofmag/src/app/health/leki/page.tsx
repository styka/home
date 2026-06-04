export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getMedicationSchedules, getMedicationDay } from "@/actions/medications";
import { MedicationsPage } from "@/components/health/MedicationsPage";

export default async function HealthMedicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.HEALTH)) redirect("/");

  const [schedules, today] = await Promise.all([getMedicationSchedules(), getMedicationDay()]);

  return <MedicationsPage schedules={schedules} today={today} />;
}
