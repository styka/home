// Z-193 — ujednolicony model „Udostępnij": JEDNA mapa, która opisuje, jak każdy
// moduł potrafi się dzielić. Koniec zamętu trzech mechanizmów rozsianych po UI:
//   - "team"           — własność zespołu (ownerTeamId), ustawiana przy tworzeniu/edycji,
//   - "entity"         — udostępnienie pojedynczej encji z rolą (VIEWER/EDITOR): TaskShare/PetShare,
//   - "projectMembers" — członkostwo w projekcie/kolekcji: TaskProjectMember.
// Komponent wejścia („Udostępnij") czyta tę mapę i pokazuje spójnie dostępne opcje.
// Czyste dane + helpery (testowalne, bez zależności od Prismy/UI).

export type ShareMechanism = "team" | "entity" | "projectMembers";

export interface ShareCapability {
  /** id modułu (zgodny z `src/lib/modules`). */
  module: string;
  /** etykieta udostępnianej encji (mianownik l.poj.), do spójnego języka UI. */
  entityLabel: string;
  /** mechanizmy współdzielenia dostępne w tym module (w kolejności preferencji). */
  mechanisms: ShareMechanism[];
}

export const SHARE_MECHANISM_LABELS: Record<ShareMechanism, string> = {
  team: "Zespół / rodzina",
  entity: "Konkretna osoba (rola)",
  projectMembers: "Członkowie projektu",
};

// Źródło prawdy: model własności (ownerTeamId) + per-encja sharing z CLAUDE.md.
// Moduły user-only (Stores/News/Weather/ProjectGroup) świadomie NIE są tu wymienione.
export const SHARE_CAPABILITIES: Record<string, ShareCapability> = {
  tasks: { module: "tasks", entityLabel: "projekt zadań", mechanisms: ["team", "entity", "projectMembers"] },
  pets: { module: "pets", entityLabel: "zwierzę", mechanisms: ["team", "entity"] },
  shopping: { module: "shopping", entityLabel: "lista zakupów", mechanisms: ["team"] },
  notes: { module: "notes", entityLabel: "notatka", mechanisms: ["team"] },
  kitchen: { module: "kitchen", entityLabel: "przepisy / plan", mechanisms: ["team"] },
  health: { module: "health", entityLabel: "zdrowie", mechanisms: ["team"] },
  habits: { module: "habits", entityLabel: "nawyk", mechanisms: ["team"] },
  flota: { module: "flota", entityLabel: "pojazd", mechanisms: ["team"] },
  portfel: { module: "portfel", entityLabel: "element budżetu", mechanisms: ["team"] },
  languages: { module: "languages", entityLabel: "talia słówek", mechanisms: ["team"] },
  magazynowanie: { module: "magazynowanie", entityLabel: "magazyn", mechanisms: ["team"] },
  warsztaty: { module: "warsztaty", entityLabel: "warsztat", mechanisms: ["team"] },
  contacts: { module: "contacts", entityLabel: "kontakt", mechanisms: ["team"] },
};

/** Zwraca opis możliwości współdzielenia modułu albo null (moduł user-only / nieznany). */
export function getShareCapability(module: string): ShareCapability | null {
  return SHARE_CAPABILITIES[module] ?? null;
}

/** Czy moduł obsługuje dany mechanizm współdzielenia. */
export function canShare(module: string, mechanism: ShareMechanism): boolean {
  return !!SHARE_CAPABILITIES[module]?.mechanisms.includes(mechanism);
}

/** Czy moduł w ogóle cokolwiek udostępnia (ma jakikolwiek mechanizm). */
export function isShareable(module: string): boolean {
  return (SHARE_CAPABILITIES[module]?.mechanisms.length ?? 0) > 0;
}
