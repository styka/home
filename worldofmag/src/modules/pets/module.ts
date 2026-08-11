import { PawPrint } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "pets",
  label: "Zwierzęta",
  href: "/pets",
  permission: "module.pets",
  color: "var(--accent-orange)",
  Icon: PawPrint,
  sideNav: () => import("./ui/PetsSideNav").then((m) => ({ default: m.PetsSideNav })),
  defaultEnabled: true,
  ai: () => import("./ai"),
  calendar: () => import("./calendar"),
  jobs: () => import("./jobs"),
});
