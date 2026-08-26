import { Calendar, CalendarDays } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "calendar",
  label: "Kalendarz",
  href: "/calendar",
  permission: "module.calendar",
  color: "var(--accent-purple)",
  Icon: Calendar,
  szybkieCele: [
    { id: "dzis", etykieta: "Dziś", href: "/calendar", Icon: CalendarDays },
  ],
  defaultEnabled: true,
});
