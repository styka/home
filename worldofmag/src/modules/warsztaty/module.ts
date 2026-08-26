import { Wrench, CalendarCheck } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "warsztaty",
  label: "Warsztaty",
  href: "/warsztaty",
  permission: "module.warsztaty",
  color: "var(--accent-amber)",
  Icon: Wrench,
  szybkieCele: [
    { id: "warsztaty", etykieta: "Warsztaty", href: "/warsztaty", Icon: Wrench },
    { id: "przeglady", etykieta: "Przeglądy", href: "/warsztaty/przeglady", Icon: CalendarCheck },
  ],
  defaultEnabled: true,
});
