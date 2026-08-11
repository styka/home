import { HeartPulse } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "health",
  label: "Zdrowie",
  href: "/health",
  permission: "module.health",
  color: "var(--accent-red)",
  Icon: HeartPulse,
  defaultEnabled: true,
  ai: () => import("./ai"),
  calendar: () => import("./calendar"),
});
