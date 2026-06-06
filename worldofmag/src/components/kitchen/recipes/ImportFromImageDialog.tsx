"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Camera, Upload, Loader2 } from "lucide-react";
import { llm } from "@/lib/llm-client";
import { useToast } from "@/components/ui/Toast";
import { createRecipe } from "@/actions/recipes";
import type { CreateRecipeInput, MealType, Difficulty } from "@/types/kitchen";

interface ImportFromImageDialogProps {
  open: boolean;
  onClose: () => void;
}

const VALID_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack", "dessert"];
const MAX_BYTES = 8 * 1024 * 1024;

export function ImportFromImageDialog({ open, onClose }: ImportFromImageDialogProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { showToast } = useToast();

  if (!open) return null;

  function readFile(file: File) {
    if (file.size > MAX_BYTES) {
      showToast("Plik za duży (max 8 MB)", "error");
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast("To nie jest obraz", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.onerror = () => showToast("Nie udało się odczytać pliku", "error");
    reader.readAsDataURL(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }

  function handleClear() {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImport() {
    if (!preview) {
      showToast("Najpierw wybierz zdjęcie", "error");
      return;
    }
    setPending(true);
    try {
      const res = await llm.kitchen.ocrImage(preview);
      if (res.error || !res.recipe) {
        showToast(res.error ?? "Nie udało się rozpoznać", "error");
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
      const created = await createRecipe(payload);
      showToast("Zaimportowano przepis ze zdjęcia", "success");
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
        className="w-full md:w-[520px] md:rounded border max-h-[92vh] overflow-y-auto"
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
            <Camera size={16} style={{ color: "var(--accent-purple)" }} />
            Import ze zdjęcia (OCR)
          </h3>
          <button onClick={onClose} aria-label="Zamknij" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Zrób zdjęcie strony z książki kucharskiej, kartki z notatkami lub ekranu z przepisem.
            AI rozpozna składniki i kroki.
          </p>

          {!preview ? (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center gap-2 py-10 rounded border-2 border-dashed cursor-pointer"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-secondary)",
              }}
            >
              <Upload size={28} style={{ color: "var(--text-muted)" }} />
              <span className="text-sm">Kliknij lub upuść plik</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                JPG, PNG, WebP · max 8 MB
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Podgląd"
                className="w-full rounded border"
                style={{ borderColor: "var(--border)", maxHeight: 320, objectFit: "contain" }}
              />
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-2 right-2 rounded-full p-1"
                style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "var(--on-accent)" }}
                aria-label="Usuń zdjęcie"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
            Anuluj
          </button>
          <button
            onClick={handleImport}
            disabled={pending || !preview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {pending ? "Rozpoznaję…" : "Rozpoznaj i importuj"}
          </button>
        </div>
      </div>
    </div>
  );
}
