import { Wallet } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "portfel",
  label: "Portfel",
  href: "/portfel",
  permission: "module.portfel",
  color: "var(--accent-green)",
  Icon: Wallet,
  sideNav: () => import("./ui/PortfelSideNav").then((m) => ({ default: m.PortfelSideNav })),
  defaultEnabled: true,
  ai: () => import("./ai"),
});
