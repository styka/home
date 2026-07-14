"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { RecipeCard } from "@/components/kitchen/recipes/RecipeCard";
import { CookbookEditDialog } from "./CookbookEditDialog";
import { polishPlural } from "@/lib/polishPlural";
import type { Cookbook, RecipeListItem } from "@/types/kitchen";

interface CookbookViewProps {
  cookbook: Cookbook;
  recipes: RecipeListItem[];
  canEdit: boolean;
}

export function CookbookView({ cookbook, recipes, canEdit }: CookbookViewProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="px-4 md:px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href="/kitchen/cookbooks"
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} /> Książki
        </Link>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <Pencil size={14} /> Edytuj
          </button>
        ) : null}
      </div>

      <header
        className="rounded border p-4 flex items-center gap-3"
        style={{
          backgroundColor: cookbook.color ?? "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="text-4xl flex-shrink-0" aria-hidden>{cookbook.emoji}</div>
        <div className="flex-1 min-w-0">
          <h1
            className="text-lg font-semibold"
            style={{ color: cookbook.color ? "#0d0d0d" : "var(--text-primary)" }}
          >
            {cookbook.name}
          </h1>
          {cookbook.description ? (
            <p
              className="text-sm mt-0.5"
              style={{ color: cookbook.color ? "rgba(13,13,13,0.75)" : "var(--text-secondary)" }}
            >
              {cookbook.description}
            </p>
          ) : null}
          <div
            className="text-xs mt-0.5"
            style={{ color: cookbook.color ? "rgba(13,13,13,0.6)" : "var(--text-muted)" }}
          >
            {recipes.length} {polishPlural(recipes.length, ["przepis", "przepisy", "przepisów"])}
          </div>
        </div>
      </header>

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            W tej książce nie ma jeszcze przepisów.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Dodaj przepis lub edytuj istniejący — w polu „Książka kucharska” wybierz „{cookbook.name}”.
          </p>
          <Link
            href="/kitchen/recipes/new"
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
            style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
          >
            <Plus size={14} /> Nowy przepis
          </Link>
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
        >
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}

      <CookbookEditDialog open={editing} onClose={() => setEditing(false)} cookbook={cookbook} />
    </div>
  );
}
