"use client";

import { X } from "lucide-react";
import { MEAL_TYPE_LABELS } from "@/types/kitchen";
import type { MealType } from "@/types/kitchen";
import type { Tag } from "@prisma/client";

export interface RecipeFilterState {
  cuisine: string | null;
  mealType: MealType | null;
  tagIds: string[];
  maxMinutes: number | null;
  cookbookId: string | null;
}

interface RecipeFiltersProps {
  state: RecipeFilterState;
  onChange: (next: RecipeFilterState) => void;
  cuisines: string[];
  tags: Tag[];
  cookbooks: Array<{ id: string; name: string; emoji: string }>;
}

const MAX_MINUTES_PRESETS: Array<{ label: string; value: number }> = [
  { label: "≤15 min", value: 15 },
  { label: "≤30 min", value: 30 },
  { label: "≤60 min", value: 60 },
];

export function RecipeFilters({ state, onChange, cuisines, tags, cookbooks }: RecipeFiltersProps) {
  const activeCount =
    (state.cuisine ? 1 : 0) +
    (state.mealType ? 1 : 0) +
    state.tagIds.length +
    (state.maxMinutes != null ? 1 : 0) +
    (state.cookbookId ? 1 : 0);

  function toggleTag(id: string) {
    const next = state.tagIds.includes(id)
      ? state.tagIds.filter((t) => t !== id)
      : [...state.tagIds, id];
    onChange({ ...state, tagIds: next });
  }

  function clearAll() {
    onChange({ cuisine: null, mealType: null, tagIds: [], maxMinutes: null, cookbookId: null });
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {cuisines.length > 0 ? (
          <select
            value={state.cuisine ?? ""}
            onChange={(e) => onChange({ ...state, cuisine: e.target.value || null })}
            className="px-2 py-1 rounded border text-xs"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">Kuchnia: dowolna</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : null}

        <select
          value={state.mealType ?? ""}
          onChange={(e) => onChange({ ...state, mealType: (e.target.value || null) as MealType | null })}
          className="px-2 py-1 rounded border text-xs"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <option value="">Posiłek: dowolny</option>
          {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((mt) => (
            <option key={mt} value={mt}>{MEAL_TYPE_LABELS[mt]}</option>
          ))}
        </select>

        {cookbooks.length > 0 ? (
          <select
            value={state.cookbookId ?? ""}
            onChange={(e) => onChange({ ...state, cookbookId: e.target.value || null })}
            className="px-2 py-1 rounded border text-xs"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">Książka: dowolna</option>
            {cookbooks.map((cb) => (
              <option key={cb.id} value={cb.id}>{cb.emoji} {cb.name}</option>
            ))}
          </select>
        ) : null}

        <div className="flex items-center gap-1">
          {MAX_MINUTES_PRESETS.map(({ label, value }) => {
            const isActive = state.maxMinutes === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...state, maxMinutes: isActive ? null : value })}
                className="px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: isActive ? "var(--accent-orange)" : "var(--bg-surface)",
                  color: isActive ? "#0d0d0d" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={12} /> Wyczyść filtry ({activeCount})
          </button>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const isActive = state.tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="px-2 py-0.5 rounded text-[11px]"
                style={{
                  backgroundColor: isActive ? "var(--accent-orange)" : (tag.color ?? "var(--bg-elevated)"),
                  color: isActive ? "#0d0d0d" : "var(--text-secondary)",
                }}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
