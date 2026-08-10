import { PawPrint } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "pets",
  label: "Zwierzęta",
  href: "/pets",
  permission: "module.pets",
  color: "var(--accent-orange)",
  Icon: PawPrint,
  defaultEnabled: true,
});
