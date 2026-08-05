import { Users } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "contacts",
  label: "Kontakty",
  href: "/contacts",
  permission: "module.contacts",
  color: "var(--accent-blue)",
  Icon: Users,
  defaultEnabled: true,
});
