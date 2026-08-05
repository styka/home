import { Wrench } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "warsztaty",
  label: "Warsztaty",
  href: "/warsztaty",
  permission: "module.warsztaty",
  color: "var(--accent-amber)",
  Icon: Wrench,
  defaultEnabled: true,
});
