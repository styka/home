"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search, Trash2, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ServingSelector } from "@/components/kitchen/shared/ServingSelector";
import { useToast } from "@/components/ui/Toast";
import {
  setMealPlanEntry,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  markMealCooked,
} from "@/actions/mealPlans";
import type { MealSlot } from "@/types/kitchen";
import { MEAL_SLOT_LABELS } from "@/types/kitchen";
import type { MealPlanEntryWithRecipe } from "@/actions/mealPlans";
import { formatDayLong } from "@/lib/kitchenDate";

export interface RecipePickerItem {
  id: string;
  title: string;
  servings: number;
  slug: string;
}

interface SlotEditorSheetProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  slot: MealSlot;
  entry?: MealPlanEntryWithRecipe | null;
  recipes: RecipePickerItem[];
  teamId?: string | null;
}

export function SlotEditorSheet({
  open,
  onClose,
  date,
  slot,
  entry,
  recipes,
  teamId,
}: SlotEditorSheetProps) {
  const [query, setQuery] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(entry?.recipeId ?? null);
  const [customTitle, setCustomTitle] = useState(entry?.customTitle ?? "");
  const [servings, setServings] = useState(entry?.servings ?? 2);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setSelectedRecipeId(entry?.recipeId ?? null);
      setCustomTitle(entry?.customTitle ?? "");
      setServings(entry?.servings ?? entry?.recipe?.servings ?? 2);
      setQuery("");
    }
  }, [open, entry]);

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes.slice(0, 30);
    return recipes
      .filter((r) => r.title.toLowerCase().includes(q))
      .slice(0, 30);
  }, [recipes, query]);

  function handleSelectRecipe(id: string, defaultServings: number) {
    setSelectedRecipeId(id);
    setCustomTitle("");
    setServings(defaultServings);
  }

  function handleSave() {
    if (!selectedRecipeId && !customTitle.trim()) {
      showToast("Wybierz przepis lub wpisz tytuł", "error");
      return;
    }
    startTransition(async () => {
      try {
        if (entry) {
          await updateMealPlanEntry(entry.id, {
            recipeId: selectedRecipeId,
            customTitle: selectedRecipeId ? null : customTitle.trim() || null,
            servings,
          });
        } else {
          await setMealPlanEntry({
            date,
            slot,
            recipeId: selectedRecipeId,
            customTitle: selectedRecipeId ? null : customTitle.trim() || null,
            servings,
            teamId: teamId ?? null,
          });
        }
        showToast(entry ? "Wpis zaktualizowany" : "Wpis dodany", "success");
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd zapisu", "error");
      }
    });
  }

  function handleDelete() {
    if (!entry) return;
    if (!confirm("Usunąć ten wpis z planu?")) return;
    startTransition(async () => {
      try {
        await deleteMealPlanEntry(entry.id);
        showToast("Usunięto z planu", "success");
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function handleCooked() {
    if (!entry) return;
    startTransition(async () => {
      try {
        await markMealCooked(entry.id);
        showToast("Zaznaczono jako ugotowane", "success");
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={
        <span className="flex flex-col">
          <span>{MEAL_SLOT_LABELS[slot]}</span>
          <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>{formatDayLong(date)}</span>
        </span>
      }
      footer={
        <div className="flex items-center justify-between" style={{ width: "100%" }}>
          <div className="flex items-center gap-1">
            {entry ? (
              <>
                <button type="button" onClick={handleCooked} disabled={pending || entry.status === "COOKED"} className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs disabled:opacity-50" style={{ color: "var(--accent-green)" }}>
                  <CheckCircle2 size={14} /> Ugotowane
                </button>
                <button type="button" onClick={handleDelete} disabled={pending} className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs disabled:opacity-50" style={{ color: "var(--accent-red)" }}>
                  <Trash2 size={14} /> Usuń
                </button>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
              Anuluj
            </button>
            <button onClick={handleSave} disabled={pending} className="px-3 py-1.5 rounded text-sm disabled:opacity-50" style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}>
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
          </div>
        </div>
      }
    >
        <>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
          >
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Wybierz przepis…"
              className="flex-1 bg-transparent border-none outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          <div
            className="flex flex-col gap-0.5 max-h-56 overflow-y-auto border rounded"
            style={{ borderColor: "var(--border)" }}
          >
            {filteredRecipes.length === 0 ? (
              <div className="px-3 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                Brak pasujących przepisów.
              </div>
            ) : (
              filteredRecipes.map((r) => {
                const isSelected = selectedRecipeId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRecipe(r.id, r.servings)}
                    className="flex items-center justify-between px-3 py-2 text-sm text-left"
                    style={{
                      backgroundColor: isSelected ? "var(--bg-elevated)" : "transparent",
                      color: isSelected ? "var(--accent-orange)" : "var(--text-primary)",
                    }}
                  >
                    <span>{r.title}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{r.servings}p</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>lub własny tytuł:</span>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                if (e.target.value.trim()) setSelectedRecipeId(null);
              }}
              placeholder="np. obiad u rodziców"
              className="flex-1 px-2 py-1 rounded border text-sm"
              style={{
                backgroundColor: "var(--bg-elevated)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Porcje</span>
            <ServingSelector value={servings} onChange={setServings} />
          </div>
        </>
    </Modal>
  );
}
