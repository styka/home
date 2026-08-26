import { Wallet, BarChart3, Coins, Target } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "portfel",
  label: "Portfel",
  href: "/portfel",
  permission: "module.portfel",
  color: "var(--accent-green)",
  Icon: Wallet,
  sideNav: () => import("./ui/PortfelSideNav").then((m) => ({ default: m.PortfelSideNav })),
  szybkieCele: [
    { id: "budzety", etykieta: "Budżety i cele", href: "/portfel/budzety", Icon: Target },
    { id: "raporty", etykieta: "Raporty", href: "/portfel/raporty", Icon: BarChart3 },
    { id: "ustawienia", etykieta: "Waluty", href: "/portfel/ustawienia", Icon: Coins },
  ],
  defaultEnabled: true,
});
