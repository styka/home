"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Users, Pencil, ShoppingCart, CheckCircle2, Trash2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { ServingSelector } from "@/components/kitchen/shared/ServingSelector";
import { ShopForRecipeDialog } from "./ShopForRecipeDialog";
import { useToast } from "@/components/ui/Toast";
import { markRecipeCooked, deleteRecipe } from "@/actions/recipes";
import type { RecipeFull } from "@/types/kitchen";
import { DIFFICULTY_LABELS, MEAL_TYPE_LABELS } from "@/types/kitchen";

interface RecipeViewProps {
  recipe: RecipeFull;
  lists: Array<{ id: string; name: string }>;
  canEdit: boolean;
}

function scaleQuantity(qty: number | null, factor: number): number | null {
  if (qty == null) return null;
  return Math.round(qty * factor * 100) / 100;
}

export function RecipeView({ recipe, lists, canEdit }: RecipeViewProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [servings, setServings] = useState(recipe.servings);
  const [shopOpen, setShopOpen] = useState(false);
  const [pendingDelete, startDelete] = useTransition();
  const [pendingCook, startCook] = useTransition();

  const scale = useMemo(
    () => (recipe.servings > 0 ? servings / recipe.servings : 1),
    [servings, recipe.servings]
  );

  const totalMins = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof recipe.ingredients>();
    for (const ing of recipe.ingredients) {
      const key = ing.groupName ?? "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [recipe.ingredients]);

  function handleDelete() {
    if (!confirm("Usunąć przepis? Tej operacji nie da się cofnąć.")) return;
    startDelete(async () => {
      try {
        await deleteRecipe(recipe.id);
        showToast("Przepis usunięty", "success");
        router.push("/kitchen/recipes");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd usuwania", "error");
      }
    });
  }

  function handleCooked() {
    startCook(async () => {
      try {
        await markRecipeCooked(recipe.id, servings);
        showToast(`Zaznaczono jako ugotowane (${servings} porcji)`, "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  return (
    <div className="px-4 md:px-6 py-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/kitchen/recipes"
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} /> Przepisy
        </Link>
        <div className="flex items-center gap-1">
          {canEdit ? (
            <Link
              href={`/kitchen/recipes/${recipe.slug}/edit`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <Pencil size={14} /> Edytuj
            </Link>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pendingDelete}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm disabled:opacity-50"
              style={{ color: "var(--accent-red)" }}
            >
              <Trash2 size={14} /> Usuń
            </button>
          ) : null}
        </div>
      </div>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {recipe.title}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {recipe.cuisine ? <span>{recipe.cuisine}</span> : null}
          {recipe.mealType ? <span>· {MEAL_TYPE_LABELS[recipe.mealType as keyof typeof MEAL_TYPE_LABELS] ?? recipe.mealType}</span> : null}
          {totalMins > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {totalMins} min
            </span>
          ) : null}
          <span>· {DIFFICULTY_LABELS[recipe.difficulty as keyof typeof DIFFICULTY_LABELS] ?? recipe.difficulty}</span>
          {recipe.cookCount > 0 ? <span>· ugotowano {recipe.cookCount}×</span> : null}
        </div>
        {recipe.description ? (
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {recipe.description}
          </p>
        ) : null}
      </header>

      {recipe.coverImageUrl ? (
        <div
          className="w-full mb-4 rounded overflow-hidden border"
          style={{
            aspectRatio: "16 / 9",
            backgroundImage: `url(${recipe.coverImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderColor: "var(--border)",
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <ServingSelector value={servings} onChange={setServings} label="Porcje" />
        {recipe.steps.length > 0 ? (
          <Link
            href={`/kitchen/recipes/${recipe.slug}/cook`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
            style={{ backgroundColor: "#0d0d0d", color: "var(--accent-orange)", border: "1px solid var(--accent-orange)" }}
          >
            <Play size={14} /> Cook Mode
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setShopOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
          style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
        >
          <ShoppingCart size={14} /> Do listy zakupów
        </button>
        <button
          type="button"
          onClick={handleCooked}
          disabled={pendingCook}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <CheckCircle2 size={14} /> Ugotowałem
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px,1fr] gap-6">
        <section>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Składniki
          </h2>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Brak składników.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {grouped.map(([group, items]) => (
                <div key={group}>
                  {group ? (
                    <h3 className="text-xs font-semibold uppercase mt-1 mb-1" style={{ color: "var(--text-secondary)" }}>
                      {group}
                    </h3>
                  ) : null}
                  <ul className="flex flex-col gap-1">
                    {items.map((ing) => {
                      const qty = scaleQuantity(ing.quantity, scale);
                      return (
                        <li key={ing.id} className="text-sm" style={{ color: "var(--text-primary)" }}>
                          {qty != null ? <span className="tabular-nums">{qty}</span> : null}
                          {qty != null && ing.unit ? <span>{` ${ing.unit}`}</span> : null}
                          {qty != null ? " " : ""}
                          <span>{ing.name}</span>
                          {ing.note ? (
                            <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              — {ing.note}
                            </span>
                          ) : null}
                          {ing.isOptional ? (
                            <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                              (opc.)
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Przygotowanie
          </h2>
          {recipe.steps.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Brak kroków.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {recipe.steps.map((step, idx) => (
                <li key={step.id} className="flex gap-3 text-sm">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ backgroundColor: "var(--bg-elevated)", color: "var(--accent-orange)" }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 flex flex-col gap-1">
                    <p style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{step.text}</p>
                    {(step.durationMin || step.temperature) ? (
                      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {step.durationMin ? <span>⏲ {step.durationMin} min</span> : null}
                        {step.temperature ? <span>🌡 {step.temperature}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {recipe.notes && recipe.notes.trim() ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Notatki kucharza
          </h2>
          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
            {recipe.notes}
          </p>
        </section>
      ) : null}

      {recipe.tags.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-1">
          {recipe.tags.map(({ tag }) => (
            <span
              key={tag.id}
              className="text-[11px] px-2 py-0.5 rounded"
              style={{ backgroundColor: tag.color ?? "var(--bg-elevated)", color: "var(--text-secondary)" }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      <ShopForRecipeDialog
        recipe={recipe}
        lists={lists}
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        defaultServings={servings}
      />
    </div>
  );
}
