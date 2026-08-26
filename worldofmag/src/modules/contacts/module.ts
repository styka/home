import { Users, UserPlus } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "contacts",
  label: "Kontakty",
  href: "/contacts",
  permission: "module.contacts",
  color: "var(--accent-blue)",
  Icon: Users,
  szybkieCele: [
    { id: "nowy", etykieta: "Nowy kontakt", href: "/contacts?akcja=nowy-kontakt", Icon: UserPlus },
  ],
  defaultEnabled: true,
});
