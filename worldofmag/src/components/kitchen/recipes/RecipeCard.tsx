"use client";

import Link from "next/link";
import { Clock, Users, ChefHat, Star } from "lucide-react";
import type { RecipeListItem } from "@/types/kitchen";
import { DIFFICULTY_LABELS } from "@/types/kitchen";

interface RecipeCardProps {
  recipe: RecipeListItem;
  highlightQuery?: string;
}

function totalMinutes(r: RecipeListItem): number | null {
  const m = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
  return m > 0 ? m : null;
}

function formatLastCooked(date: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "dziś";
  if (diff === 1) return "wczoraj";
  if (diff < 7) return `${diff} dni temu`;
  if (diff < 30) return `${Math.floor(diff / 7)} tyg. temu`;
  return d.toLocaleDateString("pl-PL");
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const total = totalMinutes(recipe);
  const lastCooked = formatLastCooked(recipe.lastCookedAt);
  const visibleTags = recipe.tags.slice(0, 3);
  const extraTags = recipe.tags.length - visibleTags.length;

  return (
    <Link
      href={`/kitchen/recipes/${recipe.slug}`}
      className="flex flex-col rounded overflow-hidden border transition-colors"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      <div
        className="relative w-full"
        style={{
          aspectRatio: "16 / 9",
          backgroundColor: "var(--bg-elevated)",
          backgroundImage: recipe.coverImageUrl ? `url(${recipe.coverImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!recipe.coverImageUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: "var(--text-muted)" }}
          >
            <ChefHat size={32} />
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
            {recipe.title}
          </h3>
          {recipe.rating != null && recipe.rating > 0 ? (
            <span className="flex items-center gap-0.5 text-xs flex-shrink-0" style={{ color: "var(--accent-amber)" }}>
              <Star size={11} fill="currentColor" />
              {recipe.rating.toFixed(1)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {total != null ? (
            <span className="inline-flex items-center gap-1"><Clock size={11} />{total} min</span>
          ) : null}
          <span className="inline-flex items-center gap-1"><Users size={11} />{recipe.servings}p</span>
          {recipe.difficulty ? (
            <span>{DIFFICULTY_LABELS[recipe.difficulty as keyof typeof DIFFICULTY_LABELS] ?? recipe.difficulty}</span>
          ) : null}
          {lastCooked ? <span>· ost. {lastCooked}</span> : null}
        </div>
        {visibleTags.length > 0 || recipe.cuisine ? (
          <div className="flex flex-wrap gap-1">
            {recipe.cuisine ? (
              <span
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
              >
                {recipe.cuisine}
              </span>
            ) : null}
            {visibleTags.map(({ tag }) => (
              <span
                key={tag.id}
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ backgroundColor: tag.color ?? "var(--bg-elevated)", color: "var(--text-secondary)" }}
              >
                {tag.name}
              </span>
            ))}
            {extraTags > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>
                +{extraTags}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
