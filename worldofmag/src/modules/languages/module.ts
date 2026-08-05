import { GraduationCap } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "languages",
  label: "Nauka języków",
  href: "/languages",
  permission: "module.languages",
  color: "var(--accent-purple)",
  Icon: GraduationCap,
  defaultEnabled: true,
});
