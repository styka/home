export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CalendarRange } from "lucide-react";
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
  // P4: opieka nad zwierzętami jest częścią wspólnego kalendarza (NM1) — link do widoku miesięcznego.
  const hasCalendar = hasPermission(session, PERMISSIONS.CALENDAR);

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<CalendarDays size={22} />}
          iconColor="var(--accent-orange)"
          title="Kalendarz opieki"
          subtitle="Wszystkie zaległe i nadchodzące zadania opieki nad zwierzętami"
          action={
            hasCalendar ? (
              <Link href="/calendar?module=pets" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 13, textDecoration: "none" }}>
                <CalendarRange size={14} /> Widok miesięczny
              </Link>
            ) : undefined
          }
        />
        <CareAgenda items={agenda} emptyHint="Zaplanuj leki, szczepienia lub rutyny w profilu zwierzęcia." />
      </div>
    </div>
  );
}
