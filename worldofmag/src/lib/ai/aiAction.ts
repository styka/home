// Typ akcji AI „magicznej ikony" — wspólny dla agenta (proponuje), panelu
// przeglądu (ActionDrawer) i executora (wykonuje). Trzymany w lib/ai (nie w
// pliku API-route), bo to model domenowy używany po obu stronach klient/serwer.
//
// Lista modułów musi pokrywać `MODULES` w `agent/route.ts`.
export type AIActionModule =
  | "shopping"
  | "tasks"
  | "notes"
  | "pets"
  | "habits"
  | "portfel"
  | "kitchen"
  | "flota"
  | "magazynowanie"
  | "health"
  | "languages"
  | "news"
  | "weather"
  | "reports";

export interface AIAction {
  id: string;
  module: AIActionModule;
  description: string;
  type: string;
  params: Record<string, unknown>;
  searchQuery?: string;
}
