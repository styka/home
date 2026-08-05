import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getStorageSettings } from "@/actions/storage";
import { StorageNav } from "@/components/magazynowanie/StorageNav";

export default async function MagazynowanieLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.MAGAZYNOWANIE) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const { mode } = await getStorageSettings();

  return <StorageNav mode={mode}>{children}</StorageNav>;
}
