import { Truck } from "lucide-react";
import { defineModule } from "@/platform/registry";

/**
 * Deklaracja modułu Trasy TIR. Jedno miejsce zamiast wpisu w rejestrze menu ORAZ w słowniku
 * uprawnień ORAZ w mapowaniu ścieżek — patrz `src/platform/registry.ts`.
 */
export default defineModule({
  id: "truck",
  label: "Trasy TIR",
  href: "/truck",
  permission: "module.truck",
  color: "var(--accent-blue)",
  Icon: Truck,
  defaultEnabled: true,
});
