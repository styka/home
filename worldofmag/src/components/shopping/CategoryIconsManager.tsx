"use client";

import { useState } from "react";
import { Trash2, Plus, Sparkles } from "lucide-react";
import type { CategoryIconVariantData } from "@/actions/categoryIcons";
import { setActiveCategoryIcon, deleteCategoryIconVariant } from "@/actions/categoryIcons";
import { CategoryIconPicker } from "./CategoryIconPicker";

interface CategoryIconsManagerProps {
  variants: Record<string, CategoryIconVariantData[]>;
  allCategories: string[];
}

function SvgTile({
  variant,
  onActivate,
  onDelete,
}: {
  variant: CategoryIconVariantData;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative aspect-square"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onActivate}
        className="w-full h-full rounded-xl flex items-center justify-center transition-all active:scale-95"
        style={{
          backgroundColor: hovered || variant.isActive ? "var(--bg-hover)" : "var(--bg-surface)",
          border: `1.5px solid ${variant.isActive ? "var(--accent-blue)" : hovered ? "var(--text-secondary)" : "var(--border)"}`,
        }}
        title={variant.isActive ? "Aktywna" : "Ustaw jako aktywną"}
      >
        <svg
          viewBox="0 0 24 24"
          width={40}
          height={40}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--text-secondary)" }}
          dangerouslySetInnerHTML={{ __html: variant.svgContent }}
        />
      </button>

      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center z-10"
          style={{ width: 18, height: 18, backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          aria-label="Usuń"
        >
          <Trash2 size={10} />
        </button>
      )}

      {variant.isActive && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: 6, height: 6, backgroundColor: "var(--accent-blue)" }}
        />
      )}
    </div>
  );
}

export function CategoryIconsManager({ variants: initialVariants, allCategories }: CategoryIconsManagerProps) {
  const [localVariants, setLocalVariants] = useState(initialVariants);
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);

  // Merge: categories with icons first (sorted), then the rest
  const withIcons = Object.keys(localVariants).sort();
  const withoutIcons = allCategories.filter((c) => !localVariants[c]).sort();
  const allSorted = [...withIcons, ...withoutIcons];

  async function handleActivate(variantId: string, categoryName: string) {
    setLocalVariants((prev) => ({
      ...prev,
      [categoryName]: prev[categoryName].map((v) => ({ ...v, isActive: v.id === variantId })),
    }));
    try {
      await setActiveCategoryIcon(variantId);
    } catch { /* optimistic stays, reload corrects */ }
  }

  async function handleDelete(variant: CategoryIconVariantData) {
    setLocalVariants((prev) => {
      const updated = (prev[variant.categoryName] ?? []).filter((v) => v.id !== variant.id);
      if (updated.length === 0) {
        const next = { ...prev };
        delete next[variant.categoryName];
        return next;
      }
      return { ...prev, [variant.categoryName]: updated };
    });
    try {
      await deleteCategoryIconVariant(variant.id);
    } catch {
      setLocalVariants((prev) => ({
        ...prev,
        [variant.categoryName]: [variant, ...(prev[variant.categoryName] ?? [])],
      }));
    }
  }

  function handlePickerSelect(svg: string, categoryName: string) {
    setLocalVariants((prev) => {
      const existing = prev[categoryName] ?? [];
      const newVariant: CategoryIconVariantData = {
        id: `temp-${Date.now()}`,
        categoryName,
        svgContent: svg,
        isActive: true,
        createdAt: new Date(),
      };
      return {
        ...prev,
        [categoryName]: [newVariant, ...existing.map((v) => ({ ...v, isActive: false }))],
      };
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Moje ikony kategorii
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Ikony generowane przez AI — kliknij by aktywować, hover by usunąć
        </p>
      </div>

      <div className="space-y-3">
        {allSorted.map((categoryName) => {
          const items = localVariants[categoryName] ?? [];
          const hasIcons = items.length > 0;

          return (
            <div
              key={categoryName}
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}
            >
              {/* Category header */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: hasIcons ? "1px solid var(--border)" : undefined }}
              >
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {categoryName}
                </span>
                <button
                  onClick={() => setPickerCategory(categoryName)}
                  className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 transition-colors"
                  style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  {hasIcons ? <Plus size={11} /> : <Sparkles size={11} />}
                  {hasIcons ? "Dodaj więcej" : "Generuj ikony"}
                </button>
              </div>

              {/* Icons grid or empty hint */}
              {hasIcons ? (
                <div className="p-3">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {items.map((variant) => (
                      <SvgTile
                        key={variant.id}
                        variant={variant}
                        onActivate={() => handleActivate(variant.id, categoryName)}
                        onDelete={() => handleDelete(variant)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  Brak ikon — kliknij „Generuj ikony" by dodać pierwszą.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {pickerCategory && (
        <CategoryIconPicker
          category={pickerCategory}
          open={true}
          onClose={() => setPickerCategory(null)}
          onSelect={(svg) => handlePickerSelect(svg, pickerCategory)}
          onReset={() => {}}
        />
      )}
    </div>
  );
}
