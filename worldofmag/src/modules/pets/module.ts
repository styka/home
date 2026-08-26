import { PawPrint, CalendarDays } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "pets",
  label: "Zwierzęta",
  href: "/pets",
  permission: "module.pets",
  color: "var(--accent-orange)",
  Icon: PawPrint,
  sideNav: () => import("./ui/PetsSideNav").then((m) => ({ default: m.PetsSideNav })),
  szybkieCele: [
    { id: "zwierzeta", etykieta: "Zwierzęta", href: "/pets", Icon: PawPrint },
    { id: "kalendarz", etykieta: "Kalendarz opieki", href: "/pets/calendar", Icon: CalendarDays },
  ],
  defaultEnabled: true,
});
