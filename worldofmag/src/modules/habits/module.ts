import { Flame } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "habits",
  label: "Nawyki",
  href: "/habits",
  permission: "module.habits",
  color: "var(--accent-orange)",
  Icon: Flame,
  defaultEnabled: true,
  ai: () => import("./ai"),
});
