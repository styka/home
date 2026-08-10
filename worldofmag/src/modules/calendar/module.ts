import { Calendar } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "calendar",
  label: "Kalendarz",
  href: "/calendar",
  permission: "module.calendar",
  color: "var(--accent-purple)",
  Icon: Calendar,
  defaultEnabled: true,
});
