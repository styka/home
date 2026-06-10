"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { RecipeEditor } from "./RecipeEditor";
import { popImportDraft, type RecipeImportDraft } from "@/lib/kitchen/recipeImportDraft";

const SOURCE_LABELS: Record<string, string> = {
  image: "ze zdjęcia (OCR)",
  url: "z adresu URL",
  ai: "wygenerowane przez AI",
};

interface Props {
  cookbooks: Array<{ id: string; name: string; emoji: string }>;
  hasAI?: boolean;
}

/** K5: ekran rewizji importu — wczytuje szkic z sessionStorage i przekazuje do edytora. */
export function RecipeImportReview({ cookbooks, hasAI }: Props) {
  const [draft, setDraft] = useState<RecipeImportDraft | null | undefined>(undefined);

  useEffect(() => {
    setDraft(popImportDraft());
  }, []);

  if (draft === undefined) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  // Brak szkicu (np. odświeżenie strony) — zwykły pusty edytor nowego przepisu.
  return (
    <RecipeEditor
      cookbooks={cookbooks}
      hasAI={hasAI}
      initialDraft={draft?.recipe ?? null}
      importSourceLabel={draft ? SOURCE_LABELS[draft.source] : undefined}
    />
  );
}
