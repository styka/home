"use client";

import { useState } from "react";
import { Trash2, Sparkles } from "lucide-react";
import type { CategoryIconVariantData } from "@/actions/categoryIcons";
import { deleteCategoryIconVariant } from "@/actions/categoryIcons";
import { CategoryIconPicker } from "./CategoryIconPicker";

interface CategoryIconsManagerProps {
  variants: Record<string, CategoryIconVariantData[]>;
  allCategories: string[];
}

const isSvg = (s: string) => s.trimStart().startsWith("<");

function CategoryRow({
  categoryName,
  icon,
  onChangeIcon,
  onDeleteIcon,
}: {
  categoryName: string;
  icon: CategoryIconVariantData | null;
  onChangeIcon: () => void;
  onDeleteIcon: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-4 px-4 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Category name */}
      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
        {categoryName}
      </span>

      {/* Icon slot */}
      {icon ? (
        <div
          className="relative flex items-center gap-2"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Icon preview */}
          <button
            onClick={onChangeIcon}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{
              backgroundColor: hovered ? "var(--bg-hover)" : "var(--bg-surface)",
              border: `1.5px solid ${hovered ? "var(--accent-blue)" : "var(--border)"}`,
            }}
            title="Zmień ikonę"
          >
            {isSvg(icon.svgContent) ? (
              <svg
                viewBox="0 0 24 24"
                width={24}
                height={24}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--text-secondary)" }}
                dangerouslySetInnerHTML={{ __html: icon.svgContent }}
              />
            ) : (
              <span className="text-lg">{icon.svgContent}</span>
            )}
          </button>

          {/* Delete button */}
          <button
            onClick={onDeleteIcon}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 28, height: 28, color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
            aria-label="Usuń ikonę"
            title="Usuń ikonę — kategoria wróci do domyślnego emoji"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={onChangeIcon}
          className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition-colors"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <Sparkles size={11} />
          Wybierz ikonę
        </button>
      )}
    </div>
  );
}

export function CategoryIconsManager({ variants: initialVariants, allCategories }: CategoryIconsManagerProps) {
  // Flatten to one icon per category (use the active one, or the first if none active)
  const [iconMap, setIconMap] = useState<Record<string, CategoryIconVariantData | null>>(() => {
    const map: Record<string, CategoryIconVariantData | null> = {};
    for (const cat of allCategories) {
      const catVariants = initialVariants[cat] ?? [];
      map[cat] = catVariants.find((v) => v.isActive) ?? catVariants[0] ?? null;
    }
    return map;
  });

  const [pickerCategory, setPickerCategory] = useState<string | null>(null);

  async function handleDelete(categoryName: string) {
    const icon = iconMap[categoryName];
    if (!icon) return;
    setIconMap((prev) => ({ ...prev, [categoryName]: null }));
    try {
      await deleteCategoryIconVariant(icon.id);
    } catch {
      setIconMap((prev) => ({ ...prev, [categoryName]: icon }));
    }
  }

  function handleSelected(categoryName: string, svg: string) {
    const newVariant: CategoryIconVariantData = {
      id: `temp-${Date.now()}`,
      categoryName,
      svgContent: svg,
      isActive: true,
      createdAt: new Date(),
    };
    setIconMap((prev) => ({ ...prev, [categoryName]: newVariant }));
  }

  // Sort: categories with icons first
  const sorted = [...allCategories].sort((a, b) => {
    const aHas = !!iconMap[a];
    const bHas = !!iconMap[b];
    if (aHas === bHas) return a.localeCompare(b, "pl");
    return aHas ? -1 : 1;
  });

  const withIconsCount = sorted.filter((c) => !!iconMap[c]).length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Ikony kategorii
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Jedna ikona SVG na kategorię — kliknij by zmienić, lub kosz by usunąć.
          {" "}{withIconsCount} z {allCategories.length} kategorii ma ikonę.
        </p>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        {sorted.map((categoryName, i) => (
          <div key={categoryName} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : undefined }}>
            <CategoryRow
              categoryName={categoryName}
              icon={iconMap[categoryName] ?? null}
              onChangeIcon={() => setPickerCategory(categoryName)}
              onDeleteIcon={() => handleDelete(categoryName)}
            />
          </div>
        ))}
      </div>

      {pickerCategory && (
        <CategoryIconPicker
          category={pickerCategory}
          open={true}
          onClose={() => setPickerCategory(null)}
          onSelect={(svg) => handleSelected(pickerCategory, svg)}
          onReset={() => setIconMap((prev) => ({ ...prev, [pickerCategory]: null }))}
        />
      )}
    </div>
  );
}
