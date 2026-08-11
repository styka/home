import { Newspaper } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "news",
  label: "Wiadomości",
  href: "/wiadomosci",
  permission: "module.news",
  color: "var(--accent-blue)",
  Icon: Newspaper,
  defaultEnabled: true,
});
