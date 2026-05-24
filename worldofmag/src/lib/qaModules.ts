export interface QaModuleInfo {
  slug: string;
  label: string;
  iconName: string;
  color: string;
}

export const QA_MODULES: QaModuleInfo[] = [
  { slug: "shopping", label: "Zakupy", iconName: "ShoppingCart", color: "var(--accent-blue)" },
  { slug: "tasks", label: "Zadania", iconName: "CheckSquare", color: "var(--accent-green)" },
  { slug: "notes", label: "Notatki", iconName: "FileText", color: "var(--accent-amber)" },
  { slug: "kitchen", label: "Kuchnia", iconName: "ChefHat", color: "var(--accent-orange)" },
  { slug: "home", label: "Strona główna", iconName: "Home", color: "var(--text-secondary)" },
  { slug: "reports", label: "Raporty", iconName: "BookOpen", color: "var(--accent-purple)" },
  { slug: "teams", label: "Zespoły", iconName: "Users", color: "var(--accent-blue)" },
  { slug: "settings", label: "Ustawienia", iconName: "Settings", color: "var(--text-secondary)" },
  { slug: "auth", label: "Logowanie", iconName: "Lock", color: "var(--text-muted)" },
  { slug: "admin", label: "Admin", iconName: "Shield", color: "var(--accent-purple)" },
  { slug: "qa", label: "QA (meta)", iconName: "FlaskConical", color: "var(--accent-red)" },
];

export function getModuleInfo(slug: string): QaModuleInfo {
  return QA_MODULES.find((m) => m.slug === slug) ?? {
    slug,
    label: slug,
    iconName: "Sparkles",
    color: "var(--text-muted)",
  };
}
