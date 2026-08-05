import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import warsztatyModule from "@/modules/warsztaty/module";
import { getWarsztatSettings } from "@/modules/warsztaty/actions/warsztat";
import { WarsztatNav } from "@/modules/warsztaty/ui/WarsztatNav";

export default async function WarsztatyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, warsztatyModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const { mode } = await getWarsztatSettings();

  return <WarsztatNav mode={mode}>{children}</WarsztatNav>;
}
