export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUnits } from "@/actions/units";
import { UnitManager } from "@/components/shopping/UnitManager";

export default async function UnitsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const units = await getUnits();

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: "24px 20px" }}>
        <UnitManager units={units} />
      </div>
    </div>
  );
}
