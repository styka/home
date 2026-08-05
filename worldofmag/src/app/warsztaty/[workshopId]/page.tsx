export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getWorkshop, getWarsztatSettings } from "@/modules/warsztaty/actions/warsztat";
import { WorkshopDetail } from "@/modules/warsztaty/ui/WorkshopDetail";

export default async function WorkshopDetailPage({ params, searchParams }: { params: { workshopId: string }; searchParams?: { tab?: string } }) {
  const [workshop, { mode }] = await Promise.all([
    getWorkshop(params.workshopId),
    getWarsztatSettings(),
  ]);
  if (!workshop) notFound();
  return <WorkshopDetail workshop={workshop} mode={mode} viewParams={searchParams ?? {}} />;
}
