import { ShoppingCart, Map, Package, Plus, Tags } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "shopping",
  label: "Zakupy",
  href: "/shopping",
  permission: "module.shopping",
  color: "var(--accent-blue)",
  Icon: ShoppingCart,
  sideNav: () => import("./ui/ShoppingSideNav").then((m) => ({ default: m.ShoppingSideNav })),
  szybkieCele: [
    { id: "nowa", etykieta: "Nowa lista", href: "/shopping?akcja=nowa-lista", Icon: Plus },
    { id: "mapy", etykieta: "Mapy sklepów", href: "/shopping/stores", Icon: Map },
    { id: "kategorie", etykieta: "Kategorie", href: "/shopping/categories", Icon: Tags },
    { id: "produkty", etykieta: "Produkty", href: "/shopping/products", Icon: Package },
  ],
  defaultEnabled: true,
});
