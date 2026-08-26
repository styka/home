import { Home, LayoutDashboard } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "home",
  label: "Strona główna",
  href: "/",
  exact: true,
  permission: "module.home",
  color: "var(--text-secondary)",
  Icon: Home,
  szybkieCele: [
    { id: "pulpit", etykieta: "Pulpit", href: "/", Icon: LayoutDashboard },
  ],
  defaultEnabled: true,
});
