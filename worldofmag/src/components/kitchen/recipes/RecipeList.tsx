"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, ChefHat } from "lucide-react";
import { RecipeCard } from "./RecipeCard";
import { RecipeFilters, type RecipeFilterState } from "./RecipeFilters";
import type { RecipeListItem, MealType } from "@/types/kitchen";
import type { Tag } from "@prisma/client";

interface RecipeListProps {
  recipes: RecipeListItem[];
  tags: Tag[];
  cookbooks: Array<{ id: string; name: string; emoji: string }>;
}

const EMPTY_FILTERS: RecipeFilterState = {
  cuisine: null,
  mealType: null,
  tagIds: [],
  maxMinutes: null,
  cookbookId: null,
};

export function RecipeList({ recipes, tags, cookbooks }: RecipeListProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<RecipeFilterState>(EMPTY_FILTERS);

  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) if (r.cuisine) set.add(r.cuisine);
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (q) {
        const inText =
          r.title.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q) ?? false) ||
          (r.cuisine?.toLowerCase().includes(q) ?? false) ||
          r.tags.some(({ tag }) => tag.name.toLowerCase().includes(q));
        if (!inText) return false;
      }
      if (filters.cuisine && r.cuisine !== filters.cuisine) return false;
      if (filters.mealType && r.mealType !== filters.mealType) return false;
      if (filters.cookbookId && r.cookbookId !== filters.cookbookId) return false;
      if (filters.maxMinutes != null) {
        const total = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
        if (total > filters.maxMinutes) return false;
      }
      if (filters.tagIds.length > 0) {
        const rTagIds = new Set(r.tags.map(({ tag }) => tag.id));
        for (const tid of filters.tagIds) if (!rTagIds.has(tid)) return false;
      }
      return true;
    });
  }, [recipes, search, filters]);

  if (recipes.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="px-4 md:px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 flex-1 px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj przepisów…"
            className="flex-1 bg-transparent border-none outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <Link
          href="/kitchen/recipes/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm whitespace-nowrap"
          style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
        >
          <Plus size={16} /> Nowy
        </Link>
      </div>

      <RecipeFilters
        state={filters}
        onChange={setFilters}
        cuisines={cuisines}
        tags={tags}
        cookbooks={cookbooks}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
          Brak przepisów spełniających filtry.
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
        >
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <ChefHat size={48} style={{ color: "var(--text-muted)" }} />
      <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Brak przepisów
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
        Zacznij od stworzenia swojego pierwszego przepisu. Możesz dodać składniki, kroki, czas i porcje, a potem jednym kliknięciem wygenerować listę zakupów.
      </p>
      <Link
        href="/kitchen/recipes/new"
        className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm"
        style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
      >
        <Plus size={16} /> Dodaj pierwszy przepis
      </Link>
    </div>
  );
}
