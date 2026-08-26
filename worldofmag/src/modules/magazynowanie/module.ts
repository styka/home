import { Warehouse, ArrowLeftRight, ClipboardList, QrCode, Search } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "magazynowanie",
  label: "Magazynowanie",
  href: "/magazynowanie",
  permission: "module.magazynowanie",
  color: "var(--accent-blue)",
  Icon: Warehouse,
  szybkieCele: [
    { id: "szukaj", etykieta: "Gdzie to jest?", href: "/magazynowanie/szukaj", Icon: Search },
    { id: "etykiety", etykieta: "Etykiety QR", href: "/magazynowanie/etykiety", Icon: QrCode },
    { id: "przeplyw", etykieta: "Przyjęcia i wydania", href: "/magazynowanie/przeplyw", Icon: ArrowLeftRight },
    { id: "remanent", etykieta: "Remanent", href: "/magazynowanie/stocktake", Icon: ClipboardList },
  ],
  defaultEnabled: true,
});
