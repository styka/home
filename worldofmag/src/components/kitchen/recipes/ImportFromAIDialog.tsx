"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import { llm } from "@/lib/llm-client";
import { useToast } from "@/components/ui/Toast";
import { stashImportDraft } from "@/lib/kitchen/recipeImportDraft";
import type { CreateRecipeInput, MealType, Difficulty } from "@/types/kitchen";

interface ImportFromAIDialogProps {
  open: boolean;
  onClose: () => void;
}

const VALID_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack", "dessert"];

export function ImportFromAIDialog({ open, onClose }: ImportFromAIDialogProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const { showToast } = useToast();

  if (!open) return null;

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      showToast("Opisz danie", "error");
      return;
    }
    setPending(true);
    try {
      const res = await llm.kitchen.generateRecipe(trimmed);
      if (res.error || !res.recipe) {
        showToast(res.error ?? "Nie udało się wygenerować", "error");
        return;
      }
      const r = res.recipe;
      const payload: CreateRecipeInput = {
        title: r.title,
        description: r.description,
        servings: r.servings ?? 2,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
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
      // K5: do rewizji przed zapisem — AI bywa kreatywne, użytkownik zatwierdza.
      stashImportDraft({ source: "ai", recipe: payload });
      onClose();
      router.push(`/kitchen/recipes/new?import=1`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd generowania", "error");
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
            <Sparkles size={16} style={{ color: "var(--accent-purple)" }} />
            Wygeneruj przepis z AI
          </h3>
          <button onClick={onClose} aria-label="Zamknij" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Opisz danie jednym zdaniem — AI ułoży pełen przepis (składniki + kroki).
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="np. pierogi ruskie dla 4 osób; szybki obiad z kurczakiem na 30 min; wegański deser bez piekarnika"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
            className="w-full px-3 py-2 rounded border text-sm resize-y"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <p className="text-[10px] text-right" style={{ color: "var(--text-muted)" }}>
            {prompt.length}/500
          </p>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
            Anuluj
          </button>
          <button
            onClick={handleGenerate}
            disabled={pending || !prompt.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}
          >
            <Sparkles size={14} /> {pending ? "Generuję…" : "Wygeneruj"}
          </button>
        </div>
      </div>
    </div>
  );
}
