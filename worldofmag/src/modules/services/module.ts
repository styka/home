import { Handshake } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "services",
  label: "Usługi",
  href: "/services",
  permission: "module.services",
  color: "var(--accent-blue)",
  Icon: Handshake,
  defaultEnabled: true,
  calendar: () => import("./calendar"),
});
