export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getHabits } from "@/actions/habits";
import { HabitsPage } from "@/components/habits/HabitsPage";

export default async function HabitsRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.HABITS)) redirect("/");

  const habits = await getHabits();

  return <HabitsPage habits={habits} />;
}
