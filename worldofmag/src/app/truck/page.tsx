export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getVehicleProfile } from "@/actions/truck";
import { TruckPlannerPage } from "@/components/truck/TruckPlannerPage";

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
