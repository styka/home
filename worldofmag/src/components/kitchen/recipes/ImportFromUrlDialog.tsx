"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { llm } from "@/lib/llm-client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { stashImportDraft } from "@/lib/kitchen/recipeImportDraft";
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
      // K5: do rewizji przed zapisem (parsowanie strony bywa niedokładne).
      stashImportDraft({ source: "url", recipe: payload });
      onClose();
      router.push(`/kitchen/recipes/new?import=1`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd importu", "error");
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
          <Globe size={16} style={{ color: "var(--accent-purple)" }} />
          Import z URL
        </span>
      }
      footer={
        <>
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
        </>
      }
    >
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
    </Modal>
  );
}
