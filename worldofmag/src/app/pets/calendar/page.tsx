export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getCareAgenda } from "@/actions/petCare";
import { PageHeader, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { CareAgenda } from "@/components/pets/CareAgenda";

export default async function PetsCalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.PETS)) redirect("/");

  const agenda = await getCareAgenda();

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<CalendarDays size={22} />}
          iconColor="var(--accent-orange)"
          title="Kalendarz opieki"
          subtitle="Wszystkie zaległe i nadchodzące zadania opieki nad zwierzętami"
        />
        <CareAgenda items={agenda} emptyHint="Zaplanuj leki, szczepienia lub rutyny w profilu zwierzęcia." />
      </div>
    </div>
  );
}
