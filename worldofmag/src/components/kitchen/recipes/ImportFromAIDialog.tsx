"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { runJob } from "@/lib/jobs/client";
import { Modal } from "@/components/ui/Modal";
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

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      showToast("Opisz danie", "error");
      return;
    }
    setPending(true);
    try {
      // Z-131 (T-17): generacja przepisu przez kolejkę zadań. Błędy rzuca → catch niżej.
      type GenRecipe = {
        title: string; description: string | null; servings: number | null;
        prepMinutes: number | null; cookMinutes: number | null; cuisine: string | null;
        mealType: string | null;
        ingredients: { name: string; quantity: number | null; unit: string | null; note: string | null; isOptional?: boolean }[];
        steps: { text: string }[];
      };
      const res = await runJob<{ recipe: GenRecipe }>("kitchen.generateRecipe", { prompt: trimmed });
      if (!res?.recipe) {
        showToast("Nie udało się wygenerować", "error");
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
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--accent-purple)" }} />
          Wygeneruj przepis z AI
        </span>
      }
      footer={
        <>
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
        </>
      }
    >
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
    </Modal>
  );
}
