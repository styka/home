export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getVehicleProfile } from "@/modules/truck/actions/truck";
import { TruckPlannerPage } from "@/modules/truck/ui/TruckPlannerPage";

export default async function TruckRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.TRUCK) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const profile = await getVehicleProfile();
  const initialProfile = profile
    ? {
        weight: profile.weight,
        height: profile.height,
        length: profile.length,
        width: profile.width,
        axleload: profile.axleload,
      }
    : null;

  return <TruckPlannerPage initialProfile={initialProfile} />;
}
