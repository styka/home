import { FlaskConical } from "lucide-react";
import { defineModule } from "@/platform/registry";

/**
 * QA to narzędzie wewnętrzne — jako jedyny moduł jest domyślnie WYŁĄCZONY w menu
 * (`defaultEnabled: false`); użytkownik włącza go z sekcji „Więcej…".
 */
export default defineModule({
  id: "qa",
  label: "QA",
  href: "/qa",
  permission: "module.qa",
  color: "var(--accent-red)",
  Icon: FlaskConical,
  defaultEnabled: false,
});
