import { CheckSquare, AlertCircle, CalendarClock, LayoutList, Plus, Tag } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "tasks",
  label: "Zadania",
  href: "/tasks",
  permission: "module.tasks",
  color: "var(--accent-green)",
  Icon: CheckSquare,
  sideNav: () => import("./ui/TasksSideNav").then((m) => ({ default: m.TasksSideNav })),
  szybkieCele: [
    { id: "nowy-projekt", etykieta: "Nowy projekt", href: "/tasks?akcja=nowy-projekt", Icon: Plus },
    { id: "dzis", etykieta: "Dziś", href: "/tasks/today", Icon: CalendarClock },
    { id: "zalegle", etykieta: "Zaległe", href: "/tasks/overdue", Icon: AlertCircle },
    { id: "wszystkie", etykieta: "Wszystkie", href: "/tasks/all", Icon: LayoutList },
    { id: "tagi", etykieta: "Tagi", href: "/tasks/tags", Icon: Tag },
  ],
  defaultEnabled: true,
});
