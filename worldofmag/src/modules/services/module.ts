import { Handshake, BadgeCheck, Inbox, Store } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "services",
  label: "Usługi",
  href: "/services",
  permission: "module.services",
  color: "var(--accent-blue)",
  Icon: Handshake,
  szybkieCele: [
    { id: "ogloszenia", etykieta: "Ogłoszenia", href: "/services", Icon: Store },
    { id: "zlecenia", etykieta: "Moje zlecenia", href: "/services/requests", Icon: Inbox },
    { id: "profil", etykieta: "Mój profil", href: "/services/provider", Icon: BadgeCheck },
  ],
  defaultEnabled: true,
});
