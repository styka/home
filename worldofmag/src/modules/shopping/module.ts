import { ShoppingCart } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "shopping",
  label: "Zakupy",
  href: "/shopping",
  permission: "module.shopping",
  color: "var(--accent-blue)",
  Icon: ShoppingCart,
  sideNav: () => import("./ui/ShoppingSideNav").then((m) => ({ default: m.ShoppingSideNav })),
  defaultEnabled: true,
});
