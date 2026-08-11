import { CloudSun } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "weather",
  label: "Pogoda",
  href: "/pogoda",
  permission: "module.weather",
  color: "var(--accent-amber)",
  Icon: CloudSun,
  defaultEnabled: true,
});
