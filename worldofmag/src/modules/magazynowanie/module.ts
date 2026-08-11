import { Warehouse } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "magazynowanie",
  label: "Magazynowanie",
  href: "/magazynowanie",
  permission: "module.magazynowanie",
  color: "var(--accent-blue)",
  Icon: Warehouse,
  defaultEnabled: true,
  ai: () => import("./ai"),
  jobs: () => import("./jobs"),
});
