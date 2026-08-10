// K5: przekazanie szkicu przepisu z importu (OCR/URL/AI) do edytora do REWIZJI przed zapisem.
// Jakość OCR/parsowania bywa zmienna — użytkownik musi móc poprawić dane zanim trafią do bazy.
// Szkic jest za duży na query-string, więc trzymamy go w sessionStorage (jednorazowo).

import type { CreateRecipeInput } from "@/types/kitchen";

const KEY = "wom_recipe_import_draft";

export type RecipeImportSource = "image" | "url" | "ai";

export type RecipeImportDraft = {
  source: RecipeImportSource;
  recipe: CreateRecipeInput;
};

export function stashImportDraft(draft: RecipeImportDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* sessionStorage niedostępny — ignorujemy, edytor otworzy się pusty */
  }
}

/** Pobiera i USUWA szkic (jednorazowy). */
export function popImportDraft(): RecipeImportDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as RecipeImportDraft;
  } catch {
    return null;
  }
}
