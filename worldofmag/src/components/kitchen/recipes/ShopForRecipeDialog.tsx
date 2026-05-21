"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { X, ShoppingCart } from "lucide-react";
import { shopForRecipe } from "@/actions/recipes";
import { ServingSelector } from "@/components/kitchen/shared/ServingSelector";
import { useToast } from "@/components/ui/Toast";
import type { RecipeFull } from "@/types/kitchen";

interface ShoppingListOption {
  id: string;
  name: string;
}

interface ShopForRecipeDialogProps {
  recipe: RecipeFull;
  lists: ShoppingListOption[];
  open: boolean;
  onClose: () => void;
  defaultServings: number;
}

export function ShopForRecipeDialog({
  recipe,
  lists,
  open,
  onClose,
  defaultServings,
}: ShopForRecipeDialogProps) {
  const [listId, setListId] = useState<string>(lists[0]?.id ?? "");
  const [servings, setServings] = useState(defaultServings);
  const [skipPantry, setSkipPantry] = useState(true);
  const [skipOptional, setSkipOptional] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [submitting, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setServings(defaultServings);
      setListId(lists[0]?.id ?? "");
      setExcluded(new Set());
    }
  }, [open, defaultServings, lists]);

  const includedCount = useMemo(() => {
    return recipe.ingredients.filter((ing) => {
      if (excluded.has(ing.id)) return false;
      if (skipOptional && ing.isOptional) return false;
      return true;
    }).length;
  }, [recipe.ingredients, excluded, skipOptional]);

  if (!open) return null;

  function toggleExclude(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    if (!listId) {
      showToast("Wybierz listę docelową", "error");
      return;
    }
    const overrides = Array.from(excluded).map((id) => ({ ingredientId: id, include: false }));
    startTransition(async () => {
      try {
        const result = await shopForRecipe({
          recipeId: recipe.id,
          listId,
          servings,
          skipPantry,
          skipOptional,
          ingredientOverrides: overrides,
        });
        showToast(
          `Dodano ${result.addedItems.length} pozycji${
            result.skippedFromPantry.length > 0
              ? ` (${result.skippedFromPantry.length} w spiżarni)`
              : ""
          }`,
          "success"
        );
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd dodawania", "error");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:w-[500px] md:rounded border max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <ShoppingCart size={16} style={{ color: "var(--accent-orange)" }} />
            Dodaj do listy zakupów
          </h3>
          <button onClick={onClose} aria-label="Zamknij" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          {lists.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--accent-amber)" }}>
              Nie masz żadnej listy zakupów. Utwórz najpierw listę w module Zakupy.
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: "var(--text-secondary)" }}>Lista docelowa</span>
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="px-2 py-1.5 rounded border text-sm"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Porcje</span>
            <ServingSelector value={servings} onChange={setServings} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipPantry} onChange={(e) => setSkipPantry(e.target.checked)} />
            <span style={{ color: "var(--text-primary)" }}>Pomiń to co mam w spiżarni</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipOptional} onChange={(e) => setSkipOptional(e.target.checked)} />
            <span style={{ color: "var(--text-primary)" }}>Pomiń składniki opcjonalne</span>
          </label>

          <div className="flex flex-col gap-1 mt-1">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Składniki ({includedCount} aktywne)
            </span>
            <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {recipe.ingredients.length === 0 ? (
                <li className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Ten przepis nie ma jeszcze składników.
                </li>
              ) : null}
              {recipe.ingredients.map((ing) => {
                const checked = !excluded.has(ing.id) && !(skipOptional && ing.isOptional);
                const scale = recipe.servings > 0 ? servings / recipe.servings : 1;
                const scaledQty = ing.quantity != null ? Math.round(ing.quantity * scale * 100) / 100 : null;
                return (
                  <li key={ing.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={skipOptional && ing.isOptional}
                      onChange={() => toggleExclude(ing.id)}
                    />
                    <span style={{ color: checked ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {scaledQty != null ? `${scaledQty}${ing.unit ? ` ${ing.unit}` : ""} ` : ""}
                      {ing.name}
                      {ing.isOptional ? (
                        <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          (opc.)
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Anuluj
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || lists.length === 0 || includedCount === 0}
            className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
          >
            {submitting ? "Dodaję…" : `Dodaj ${includedCount} ${includedCount === 1 ? "pozycję" : "pozycji"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
