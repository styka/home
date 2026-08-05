import { BookOpen } from "lucide-react";
import { defineModule } from "@/platform/registry";

/**
 * Raporty są dostępne dla KAŻDEGO zalogowanego użytkownika — `permission: null` nie jest
 * przeoczeniem, tylko decyzją: raporty użytkownika powstają m.in. z sesji z asystentem i nigdy
 * nie miały własnego sluga (dotąd zapisane jako `permission: null` w rejestrze menu).
 */
export default defineModule({
  id: "reports",
  label: "Raporty",
  href: "/reports",
  permission: null,
  color: "var(--accent-purple)",
  Icon: BookOpen,
  defaultEnabled: true,
});
