import { ChefHat } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "kitchen",
  label: "Kuchnia",
  href: "/kitchen",
  permission: "module.kitchen",
  color: "var(--accent-orange)",
  Icon: ChefHat,
  defaultEnabled: true,
});
