import { CheckSquare } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "tasks",
  label: "Zadania",
  href: "/tasks",
  permission: "module.tasks",
  color: "var(--accent-green)",
  Icon: CheckSquare,
  defaultEnabled: true,
});
