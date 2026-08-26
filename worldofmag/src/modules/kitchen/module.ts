import { ChefHat, BookOpen, CalendarRange, Library, Package } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "kitchen",
  label: "Kuchnia",
  href: "/kitchen",
  permission: "module.kitchen",
  color: "var(--accent-orange)",
  Icon: ChefHat,
  szybkieCele: [
    { id: "przepisy", etykieta: "Przepisy", href: "/kitchen/recipes", Icon: BookOpen },
    { id: "plan", etykieta: "Plan tygodnia", href: "/kitchen/plan", Icon: CalendarRange },
    { id: "spizarnia", etykieta: "Spiżarnia", href: "/kitchen/pantry", Icon: Package },
    { id: "ksiazki", etykieta: "Książki", href: "/kitchen/cookbooks", Icon: Library },
  ],
  defaultEnabled: true,
});
