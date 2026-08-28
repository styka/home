import type { ModuleServerContributions } from "@/platform/registry.server";
import contactsServer from "@/modules/contacts/module.server";
import flotaServer from "@/modules/flota/module.server";
import habitsServer from "@/modules/habits/module.server";
import healthServer from "@/modules/health/module.server";
import kitchenServer from "@/modules/kitchen/module.server";
import languagesServer from "@/modules/languages/module.server";
import magazynowanieServer from "@/modules/magazynowanie/module.server";
import newsServer from "@/modules/news/module.server";
import notesServer from "@/modules/notes/module.server";
import petsServer from "@/modules/pets/module.server";
import portfelServer from "@/modules/portfel/module.server";
import reportsServer from "@/modules/reports/module.server";
import servicesServer from "@/modules/services/module.server";
import shoppingServer from "@/modules/shopping/module.server";
import tasksServer from "@/modules/tasks/module.server";
import warsztatyServer from "@/modules/warsztaty/module.server";
import weatherServer from "@/modules/weather/module.server";
import youtubeServer from "@/modules/youtube/module.server";
import roslinyServer from "@/modules/rosliny/module.server";

/**
 * 049 — KORZEŃ KOMPOZYCJI DLA STRONY SERWEROWEJ.
 *
 * Odpowiednik `src/lib/modules.tsx`, ale dla wkładów, których **nie wolno wysłać do przeglądarki**.
 * Klient nigdy nie importuje tego pliku; importują go wyłącznie katalog asystenta, rejestr zadań
 * i agregat kalendarza.
 *
 * Same pliki `module.server.ts` są malutkie (trzy leniwe loadery), więc statyczny import
 * dwudziestu z nich nic nie kosztuje — koszt pojawia się dopiero przy faktycznym wywołaniu loadera.
 */
export const MODULE_SERVER: Record<string, ModuleServerContributions> = {
  contacts: contactsServer,
  flota: flotaServer,
  habits: habitsServer,
  health: healthServer,
  kitchen: kitchenServer,
  languages: languagesServer,
  magazynowanie: magazynowanieServer,
  news: newsServer,
  youtube: youtubeServer,
  rosliny: roslinyServer,
  notes: notesServer,
  pets: petsServer,
  portfel: portfelServer,
  reports: reportsServer,
  services: servicesServer,
  shopping: shoppingServer,
  tasks: tasksServer,
  warsztaty: warsztatyServer,
  weather: weatherServer,
};
