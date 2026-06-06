"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Globe } from "lucide-react";
import { llm } from "@/lib/llm-client";
import { useToast } from "@/components/ui/Toast";
import { createRecipe } from "@/actions/recipes";
import type { CreateRecipeInput, MealType, Difficulty } from "@/types/kitchen";

interface ImportFromUrlDialogProps {
  open: boolean;
  onClose: () => void;
}

const VALID_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack", "dessert"];

export function ImportFromUrlDialog({ open, onClose }: ImportFromUrlDialogProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const { showToast } = useToast();

  if (!open) return null;

  async function handleImport() {
    if (!url.trim()) {
      showToast("Wpisz URL", "error");
      return;
    }
    setPending(true);
    try {
      const res = await llm.kitchen.importFromUrl(url.trim());
      if (res.error || !res.recipe) {
        showToast(res.error ?? "Nie udało się zaimportować", "error");
        return;
      }
      const r = res.recipe;
      const payload: CreateRecipeInput = {
        title: r.title,
        description: r.description,
        servings: r.servings ?? 2,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        coverImageUrl: r.coverImageUrl,
        cuisine: r.cuisine,
        mealType: r.mealType && (VALID_MEAL_TYPES as string[]).includes(r.mealType)
          ? (r.mealType as MealType)
          : null,
        difficulty: "easy" as Difficulty,
        ingredients: r.ingredients.map((ing, idx) => ({
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          note: ing.note ?? null,
          isOptional: ing.isOptional ?? false,
          order: idx,
        })),
        steps: r.steps.map((s, idx) => ({ text: s.text, order: idx })),
      };
      const created = await createRecipe(payload);
      showToast("Zaimportowano przepis", "success");
      router.push(`/kitchen/recipes/${created.slug}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd importu", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:w-[480px] md:rounded border"
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
            <Globe size={16} style={{ color: "var(--accent-purple)" }} />
            Import z URL
          </h3>
          <button onClick={onClose} aria-label="Zamknij" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Wklej link do przepisu. AI pobierze stronę i wyciągnie składniki + kroki (najpierw spróbuje schema.org JSON-LD, potem LLM).
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleImport();
            }}
            className="w-full px-3 py-2 rounded border text-sm"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
            Anuluj
          </button>
          <button
            onClick={handleImport}
            disabled={pending}
            className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}
          >
            {pending ? "Importuję…" : "Importuj"}
          </button>
        </div>
      </div>
    </div>
  );
}
