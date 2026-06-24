"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, ChefHat, Globe, ChevronDown, Camera, Sparkles } from "lucide-react";
import { RecipeCard } from "./RecipeCard";
import { RecipeFilters, type RecipeFilterState } from "./RecipeFilters";
import { ImportFromUrlDialog } from "./ImportFromUrlDialog";
import { ImportFromImageDialog } from "./ImportFromImageDialog";
import { ImportFromAIDialog } from "./ImportFromAIDialog";
import { PantrySuggestionsPanel } from "./PantrySuggestionsPanel";
import type { RecipeListItem } from "@/types/kitchen";
import type { Tag } from "@prisma/client";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface RecipeListProps {
  recipes: RecipeListItem[];
  tags: Tag[];
  cookbooks: Array<{ id: string; name: string; emoji: string }>;
  hasAI?: boolean;
}

const EMPTY_FILTERS: RecipeFilterState = {
  cuisine: null,
  mealType: null,
  tagIds: [],
  maxMinutes: null,
  cookbookId: null,
};

export function RecipeList({ recipes, tags, cookbooks, hasAI }: RecipeListProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<RecipeFilterState>(EMPTY_FILTERS);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [imageImportOpen, setImageImportOpen] = useState(false);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Z-232: wspólny hub zamiast własnego listenera. Karty są nawigacyjne (link do
  // detalu), więc tylko / = szukaj i a/n = nowy; skróty nieaktywne, gdy otwarty
  // któryś z dialogów importu (jak w oryginale).
  const dialogOpen = importOpen || imageImportOpen || aiImportOpen;
  const shortcutHandlers = useMemo(
    () => ({
      onSearch: () => { if (!dialogOpen) searchInputRef.current?.focus(); },
      onQuickAdd: () => { if (!dialogOpen) router.push("/kitchen/recipes/new"); },
    }),
    [dialogOpen, router]
  );
  useKeyboardShortcuts(shortcutHandlers);

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
    return (
      <>
        <EmptyState
          hasAI={hasAI}
          onImportUrl={() => setImportOpen(true)}
          onGenerateAI={() => setAiImportOpen(true)}
        />
        <ImportFromUrlDialog open={importOpen} onClose={() => setImportOpen(false)} />
      </>
    );
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
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj przepisów… ( / )"
            className="flex-1 bg-transparent border-none outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        {hasAI ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm whitespace-nowrap"
              style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
            >
              <Plus size={16} /> Nowy <ChevronDown size={12} />
            </button>
            {menuOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 mt-1 w-52 z-50 rounded border shadow-lg"
                  style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
                >
                  <Link
                    href="/kitchen/recipes/new"
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                    style={{ color: "var(--text-primary)" }}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Plus size={14} /> Pusty przepis
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setImportOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <Globe size={14} style={{ color: "var(--accent-purple)" }} /> Import z URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setImageImportOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <Camera size={14} style={{ color: "var(--accent-purple)" }} /> Import ze zdjęcia (OCR)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setAiImportOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <Sparkles size={14} style={{ color: "var(--accent-purple)" }} /> Wygeneruj z AI
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <Link
            href="/kitchen/recipes/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm whitespace-nowrap"
            style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
          >
            <Plus size={16} /> Nowy
          </Link>
        )}
      </div>

      <RecipeFilters
        state={filters}
        onChange={setFilters}
        cuisines={cuisines}
        tags={tags}
        cookbooks={cookbooks}
      />

      <PantrySuggestionsPanel />

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

      <ImportFromUrlDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ImportFromImageDialog open={imageImportOpen} onClose={() => setImageImportOpen(false)} />
      <ImportFromAIDialog open={aiImportOpen} onClose={() => setAiImportOpen(false)} />
    </div>
  );
}

function EmptyState({
  hasAI,
  onImportUrl,
  onGenerateAI,
}: {
  hasAI?: boolean;
  onImportUrl: () => void;
  onGenerateAI: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <ChefHat size={48} style={{ color: "var(--text-muted)" }} />
      <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Brak przepisów
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
        Zacznij od stworzenia swojego pierwszego przepisu. Możesz dodać składniki, kroki, czas i porcje, a potem jednym kliknięciem wygenerować listę zakupów.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/kitchen/recipes/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm"
          style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
        >
          <Plus size={16} /> Dodaj pierwszy przepis
        </Link>
        {hasAI ? (
          <>
            <button
              type="button"
              onClick={onImportUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border text-sm"
              style={{ borderColor: "var(--accent-purple)", color: "var(--accent-purple)" }}
            >
              <Globe size={14} /> Import z URL
            </button>
            <button
              type="button"
              onClick={onGenerateAI}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border text-sm"
              style={{ borderColor: "var(--accent-purple)", color: "var(--accent-purple)" }}
            >
              <Sparkles size={14} /> Wygeneruj z AI
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
