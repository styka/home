export interface ReportCategoryInfo {
  slug: string;
  label: string;
  color: string;
}

export const REPORT_CATEGORIES: Record<string, ReportCategoryInfo> = {
  refactoring:  { slug: "refactoring",  label: "Refaktoryzacja",  color: "var(--accent-purple)" },
  architecture: { slug: "architecture", label: "Architektura",    color: "var(--accent-blue)"   },
  security:     { slug: "security",     label: "Bezpieczeństwo",  color: "var(--accent-red)"    },
  performance:  { slug: "performance",  label: "Wydajność",       color: "var(--accent-green)"  },
  general:      { slug: "general",      label: "Ogólny",          color: "var(--text-muted)"    },
  proposal:     { slug: "proposal",     label: "Propozycja",      color: "var(--accent-amber)"  },
  ux:           { slug: "ux",           label: "UX",              color: "var(--accent-purple)" },
};

export function getCategoryInfo(cat: string): ReportCategoryInfo {
  return REPORT_CATEGORIES[cat] ?? REPORT_CATEGORIES.general;
}
