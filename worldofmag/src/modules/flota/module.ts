import { Car } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "flota",
  label: "Flota",
  href: "/flota",
  permission: "module.flota",
  color: "var(--accent-blue)",
  Icon: Car,
  sideNav: () => import("./ui/FlotaSideNav").then((m) => ({ default: m.FlotaSideNav })),
  defaultEnabled: true,
  ai: () => import("./ai"),
  calendar: () => import("./calendar"),
});
