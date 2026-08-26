import { Newspaper, BookOpenText, Clock } from "lucide-react";
import { defineModule } from "@/platform/registry";

export default defineModule({
  id: "news",
  label: "Wiadomości",
  href: "/wiadomosci",
  permission: "module.news",
  color: "var(--accent-blue)",
  Icon: Newspaper,
  szybkieCele: [
    { id: "tematy", etykieta: "Tematy", href: "/wiadomosci", Icon: Newspaper },
    { id: "os-czasu", etykieta: "Oś czasu", href: "/wiadomosci?tresc=timeline", Icon: Clock },
    { id: "czytanie", etykieta: "Tryb czytania", href: "/wiadomosci?czytanie=1", Icon: BookOpenText },
  ],
  defaultEnabled: true,
});
