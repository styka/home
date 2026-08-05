import { FileText } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "notes",
  label: "Notatki",
  href: "/notes",
  permission: "module.notes",
  color: "var(--accent-amber)",
  Icon: FileText,
  defaultEnabled: true,
});
