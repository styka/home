import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default function KitchenPlanPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <CalendarDays size={48} style={{ color: "var(--text-muted)" }} />
      <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Plan posiłków
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
        Wkrótce — Faza 2. Tygodniowy plan, drag-and-drop, generowanie listy zakupów na cały tydzień.
      </p>
    </div>
  );
}
