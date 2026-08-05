export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import flotaModule from "@/modules/flota/module";
import { getVehicle } from "@/modules/flota/actions/flota";
import { VehicleDetailPage } from "@/modules/flota/ui/VehicleDetailPage";

interface Props {
  params: { vehicleId: string };
}

export default async function VehiclePage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, flotaModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const vehicle = await getVehicle(params.vehicleId).catch(() => null);
  if (!vehicle) notFound();

  return <VehicleDetailPage vehicle={vehicle} />;
}
