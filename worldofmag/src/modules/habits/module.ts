import { Flame, Plus } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "habits",
  label: "Nawyki",
  href: "/habits",
  permission: "module.habits",
  color: "var(--accent-orange)",
  Icon: Flame,
  szybkieCele: [
    { id: "nowy", etykieta: "Nowy nawyk", href: "/habits?akcja=nowy-nawyk", Icon: Plus },
  ],
  defaultEnabled: true,
});
