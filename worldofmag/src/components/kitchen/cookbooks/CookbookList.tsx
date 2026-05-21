"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { CookbookEditDialog } from "./CookbookEditDialog";
import { polishPlural } from "@/lib/polishPlural";
import type { CookbookWithCount } from "@/actions/cookbooks";

interface CookbookListProps {
  cookbooks: CookbookWithCount[];
}

export function CookbookList({ cookbooks }: CookbookListProps) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="px-4 md:px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Książki kucharskie
        </h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
          style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
        >
          <Plus size={14} /> Nowa
        </button>
      </div>

      {cookbooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <BookOpen size={48} style={{ color: "var(--text-muted)" }} />
          <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Brak książek kucharskich
          </h2>
          <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
            Twórz kolekcje przepisów według tematu — np. „Mama", „Włoska klasyka", „Desery".
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm"
            style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
          >
            <Plus size={16} /> Utwórz pierwszą
          </button>
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        >
          {cookbooks.map((cb) => (
            <Link
              key={cb.id}
              href={`/kitchen/cookbooks/${cb.id}`}
              className="flex flex-col items-center justify-center text-center rounded border p-4 transition-colors"
              style={{
                backgroundColor: cb.color ?? "var(--bg-surface)",
                borderColor: "var(--border)",
                minHeight: 140,
              }}
            >
              <div className="text-4xl mb-2" aria-hidden>{cb.emoji}</div>
              <div className="text-sm font-medium" style={{ color: cb.color ? "#0d0d0d" : "var(--text-primary)" }}>
                {cb.name}
              </div>
              <div className="text-xs mt-1" style={{ color: cb.color ? "rgba(13,13,13,0.7)" : "var(--text-muted)" }}>
                {cb.recipeCount} {polishPlural(cb.recipeCount, ["przepis", "przepisy", "przepisów"])}
              </div>
            </Link>
          ))}
        </div>
      )}

      <CookbookEditDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
