export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getWorkshop, getWarsztatSettings } from "@/actions/warsztat";
import { WorkshopDetail } from "@/components/warsztaty/WorkshopDetail";

export default async function WorkshopDetailPage({ params, searchParams }: { params: { workshopId: string }; searchParams?: { tab?: string } }) {
  const [workshop, { mode }] = await Promise.all([
    getWorkshop(params.workshopId),
    getWarsztatSettings(),
  ]);
  if (!workshop) notFound();
  return <WorkshopDetail workshop={workshop} mode={mode} viewParams={searchParams ?? {}} />;
}
