export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import habitsModule from "@/modules/habits/module";
import { getHabits } from "@/modules/habits/actions/habits";
import { HabitsPage } from "@/modules/habits/ui/HabitsPage";

export default async function HabitsRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, habitsModule.permission)) redirect("/");

  const habits = await getHabits();

  return <HabitsPage habits={habits} />;
}
