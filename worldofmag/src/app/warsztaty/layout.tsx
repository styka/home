import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getWarsztatSettings } from "@/actions/warsztat";
import { WarsztatNav } from "@/components/warsztaty/WarsztatNav";

export default async function WarsztatyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.WARSZTATY) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const { mode } = await getWarsztatSettings();

  return <WarsztatNav mode={mode}>{children}</WarsztatNav>;
}
