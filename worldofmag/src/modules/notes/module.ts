import { FileText, Folder, Plus, Tag } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "notes",
  label: "Notatki",
  href: "/notes",
  permission: "module.notes",
  color: "var(--accent-amber)",
  Icon: FileText,
  szybkieCele: [
    { id: "nowa", etykieta: "Nowa notatka", href: "/notes/all?akcja=nowa-notatka", Icon: Plus },
    { id: "wszystkie", etykieta: "Wszystkie", href: "/notes/all", Icon: FileText },
    { id: "foldery", etykieta: "Foldery", href: "/notes/groups", Icon: Folder },
    { id: "tagi", etykieta: "Tagi", href: "/notes/tags", Icon: Tag },
  ],
  defaultEnabled: true,
});
