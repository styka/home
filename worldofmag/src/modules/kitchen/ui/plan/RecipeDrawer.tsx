"use client";

import { useMemo, useState } from "react";
import { Search, BookMarked, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import type { RecipePickerItem } from "./SlotEditorSheet";

interface RecipeDrawerProps {
  recipes: RecipePickerItem[];
}

export function RecipeDrawer({ recipes }: RecipeDrawerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, query]);

  return (
    <aside
      className="flex flex-col rounded border h-full overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-2 border-b text-xs font-semibold uppercase tracking-wide"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <BookMarked size={12} /> Przepisy ({filtered.length})
      </div>
      <div className="px-2 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        >
          <Search size={12} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj…"
            className="flex-1 bg-transparent border-none outline-none text-xs"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
            {recipes.length === 0 ? "Brak przepisów." : "Brak pasujących."}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((r) => (
              <DraggableRecipe key={r.id} recipe={r} />
            ))}
          </ul>
        )}
      </div>
      <div
        className="px-3 py-1.5 border-t text-[10px]"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        Przeciągnij przepis na slot w planie
      </div>
    </aside>
  );
}

function DraggableRecipe({ recipe }: { recipe: RecipePickerItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe::${recipe.id}`,
    data: { type: "recipe", recipeId: recipe.id, servings: recipe.servings },
  });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs"
      style={{
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text-primary)",
        cursor: "grab",
        opacity: isDragging ? 0.5 : 1,
      }}
      title={recipe.title}
    >
      <GripVertical size={10} style={{ color: "var(--text-muted)" }} />
      <span className="flex-1 truncate">{recipe.title}</span>
      <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
        {recipe.servings}p
      </span>
    </li>
  );
}
