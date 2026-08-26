import { GraduationCap } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "languages",
  label: "Nauka języków",
  href: "/languages",
  permission: "module.languages",
  color: "var(--accent-purple)",
  Icon: GraduationCap,
  sideNav: () => import("./ui/LanguagesSideNav").then((m) => ({ default: m.LanguagesSideNav })),
  szybkieCele: [
    { id: "talie", etykieta: "Talie", href: "/languages", Icon: GraduationCap },
  ],
  defaultEnabled: true,
});
