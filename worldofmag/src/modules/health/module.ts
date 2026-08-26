import { HeartPulse, Pill } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "health",
  label: "Zdrowie",
  href: "/health",
  permission: "module.health",
  color: "var(--accent-red)",
  Icon: HeartPulse,
  szybkieCele: [
    { id: "wizyty", etykieta: "Wizyty i badania", href: "/health", Icon: HeartPulse },
    { id: "leki", etykieta: "Leki i pielęgnacja", href: "/health/leki", Icon: Pill },
  ],
  defaultEnabled: true,
});
