import { CloudSun, Lightbulb } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "weather",
  label: "Pogoda",
  href: "/pogoda",
  permission: "module.weather",
  color: "var(--accent-amber)",
  Icon: CloudSun,
  szybkieCele: [
    { id: "prognoza", etykieta: "Prognoza", href: "/pogoda", Icon: CloudSun },
    { id: "pomysly", etykieta: "Biblioteka pomysłów", href: "/pogoda/pomysly", Icon: Lightbulb },
  ],
  defaultEnabled: true,
});
