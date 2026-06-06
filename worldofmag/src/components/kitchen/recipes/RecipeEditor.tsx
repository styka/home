"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { parseQuantity } from "@/lib/parseQuantity";
import { llm } from "@/lib/llm-client";
import { ServingSelector } from "@/components/kitchen/shared/ServingSelector";
import { DurationInput } from "@/components/kitchen/shared/DurationInput";
import { RecipeImagesEditor } from "./RecipeImagesEditor";
import { useToast } from "@/components/ui/Toast";
import { createRecipe, updateRecipe } from "@/actions/recipes";
import type {
  RecipeFull,
  CreateRecipeInput,
  IngredientInput,
  StepInput,
  Difficulty,
  MealType,
} from "@/types/kitchen";
import { MEAL_TYPE_LABELS, DIFFICULTY_LABELS } from "@/types/kitchen";

interface RecipeEditorProps {
  recipe?: RecipeFull;
  cookbooks: Array<{ id: string; name: string; emoji: string }>;
  hasAI?: boolean;
}

interface IngredientRow extends IngredientInput {
  _key: string;
}

interface StepRow extends StepInput {
  _key: string;
}

function makeKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function RecipeEditor({ recipe, cookbooks, hasAI }: RecipeEditorProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [categorizePending, setCategorizePending] = useState(false);

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(recipe?.coverImageUrl ?? "");
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [prepMinutes, setPrepMinutes] = useState<string>(recipe?.prepMinutes?.toString() ?? "");
  const [cookMinutes, setCookMinutes] = useState<string>(recipe?.cookMinutes?.toString() ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>((recipe?.difficulty as Difficulty) ?? "easy");
  const [cuisine, setCuisine] = useState(recipe?.cuisine ?? "");
  const [mealType, setMealType] = useState<MealType | "">((recipe?.mealType as MealType) ?? "");
  const [cookbookId, setCookbookId] = useState<string>(recipe?.cookbookId ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? "");

  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    recipe?.ingredients.map((ing) => ({
      _key: ing.id,
      name: ing.name,
      productId: ing.productId,
      quantity: ing.quantity,
      unit: ing.unit,
      groupName: ing.groupName,
      note: ing.note,
      isOptional: ing.isOptional,
      order: ing.order,
    })) ?? [{ _key: makeKey(), name: "" }]
  );

  const [steps, setSteps] = useState<StepRow[]>(
    recipe?.steps.map((s) => ({
      _key: s.id,
      text: s.text,
      order: s.order,
      durationMin: s.durationMin,
      temperature: s.temperature,
      imageUrl: s.imageUrl,
    })) ?? [{ _key: makeKey(), text: "" }]
  );

  function addIngredient() {
    setIngredients((prev) => [...prev, { _key: makeKey(), name: "" }]);
  }

  function updateIngredientLocal(key: string, patch: Partial<IngredientRow>) {
    setIngredients((prev) => prev.map((ing) => (ing._key === key ? { ...ing, ...patch } : ing)));
  }

  function removeIngredient(key: string) {
    setIngredients((prev) => prev.filter((ing) => ing._key !== key));
  }

  function handleIngredientSmartPaste(key: string, raw: string) {
    const parsed = parseQuantity(raw);
    updateIngredientLocal(key, {
      name: parsed.name,
      quantity: parsed.quantity ?? null,
      unit: parsed.unit ?? null,
    });
  }

  async function handleAIParse() {
    if (!aiText.trim()) {
      showToast("Wklej tekst do parsowania", "error");
      return;
    }
    setAiPending(true);
    try {
      const res = await llm.kitchen.parseIngredients(aiText.trim());
      if (res.error) {
        showToast(res.error, "error");
        return;
      }
      const parsed = res.ingredients ?? [];
      if (parsed.length === 0) {
        showToast("AI nie znalazło składników", "info");
        return;
      }
      setIngredients((prev) => {
        // jeśli aktualne pole pierwszy ingredient jest puste — zastąp; inaczej dopisz
        const isEmptySingle = prev.length === 1 && !prev[0].name.trim();
        const merged: IngredientRow[] = parsed.map((p) => ({
          _key: makeKey(),
          name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          note: p.note,
          isOptional: p.isOptional,
        }));
        return isEmptySingle ? merged : [...prev, ...merged];
      });
      showToast(`AI dodało ${parsed.length} składników`, "success");
      setAiOpen(false);
      setAiText("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd AI", "error");
    } finally {
      setAiPending(false);
    }
  }

  async function handleAICategorize() {
    if (!title.trim()) {
      showToast("Najpierw wpisz tytuł", "error");
      return;
    }
    setCategorizePending(true);
    try {
      const res = await llm.kitchen.categorize({
        title: title.trim(),
        description: description.trim() || null,
        ingredients: ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim() })),
        steps: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim() })),
      });
      if (res.error) {
        showToast(res.error, "error");
        return;
      }
      const changed: string[] = [];
      // TODO(kitchen-v2): res.tags pomijane — edytor nie ma inline TagPicker.
      // Można dorobić: getTags() + dialog "Sugerowane tagi" z create-on-fly,
      // a po wybraniu zapisać w `tagIds` w CreateRecipeInput.
      if (res.cuisine && !cuisine.trim()) {
        setCuisine(res.cuisine);
        changed.push("kuchnia");
      }
      if (res.mealType && !mealType) {
        setMealType(res.mealType);
        changed.push("posiłek");
      }
      if (res.difficulty) {
        setDifficulty(res.difficulty);
        changed.push("trudność");
      }
      showToast(
        changed.length > 0 ? `AI ustawiło: ${changed.join(", ")}` : "AI: brak zmian",
        changed.length > 0 ? "success" : "info"
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd AI", "error");
    } finally {
      setCategorizePending(false);
    }
  }

  function addStep() {
    setSteps((prev) => [...prev, { _key: makeKey(), text: "" }]);
  }

  function updateStepLocal(key: string, patch: Partial<StepRow>) {
    setSteps((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  }

  function removeStep(key: string) {
    setSteps((prev) => prev.filter((s) => s._key !== key));
  }

  function handleSave() {
    if (!title.trim()) {
      showToast("Tytuł jest wymagany", "error");
      return;
    }
    const payload: CreateRecipeInput = {
      title: title.trim(),
      description: description.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      servings,
      prepMinutes: prepMinutes ? Number(prepMinutes) : null,
      cookMinutes: cookMinutes ? Number(cookMinutes) : null,
      difficulty,
      cuisine: cuisine.trim() || null,
      mealType: mealType || null,
      cookbookId: cookbookId || null,
      notes,
      ingredients: ingredients
        .filter((ing) => ing.name.trim())
        .map((ing, idx) => ({
          name: ing.name.trim(),
          productId: ing.productId ?? null,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          groupName: ing.groupName ?? null,
          note: ing.note ?? null,
          isOptional: ing.isOptional ?? false,
          order: idx,
        })),
      steps: steps
        .filter((s) => s.text.trim())
        .map((s, idx) => ({
          text: s.text,
          order: idx,
          durationMin: s.durationMin ?? null,
          temperature: s.temperature ?? null,
        })),
    };

    startTransition(async () => {
      try {
        if (recipe) {
          await updateRecipe(recipe.id, payload);
          showToast("Przepis zapisany", "success");
          router.push(`/kitchen/recipes/${recipe.slug}`);
        } else {
          const created = await createRecipe(payload);
          showToast("Przepis utworzony", "success");
          router.push(`/kitchen/recipes/${created.slug}`);
        }
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd zapisu", "error");
      }
    });
  }

  const isEdit = !!recipe;

  return (
    <div className="px-4 md:px-6 py-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} /> Anuluj
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
        >
          <Save size={14} /> {pending ? "Zapisuję…" : "Zapisz"}
        </button>
      </div>

      <h1 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
        {isEdit ? "Edycja przepisu" : "Nowy przepis"}
      </h1>

      <div className="flex flex-col gap-3">
        <Field label="Tytuł">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="np. Spaghetti Carbonara"
            autoFocus
            className="w-full px-3 py-2 rounded border text-sm"
            style={inputStyle}
          />
        </Field>

        <Field label="Krótki opis (opcjonalny)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded border text-sm resize-y"
            style={inputStyle}
          />
        </Field>

        <Field label="URL zdjęcia (opcjonalny)">
          <input
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 rounded border text-sm"
            style={inputStyle}
          />
        </Field>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Czas przygotowania">
            <DurationInput
              value={prepMinutes ? Number(prepMinutes) : null}
              onChange={(n) => setPrepMinutes(n == null ? "" : String(n))}
              ariaLabel="Czas przygotowania"
            />
          </Field>
          <Field label="Czas gotowania">
            <DurationInput
              value={cookMinutes ? Number(cookMinutes) : null}
              onChange={(n) => setCookMinutes(n == null ? "" : String(n))}
              ariaLabel="Czas gotowania"
            />
          </Field>
          <Field label="Porcje">
            <div className="flex items-center h-9">
              <ServingSelector value={servings} onChange={setServings} />
            </div>
          </Field>
          <Field label="Trudność">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full px-2 py-1.5 rounded border text-sm"
              style={inputStyle}
            >
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </Field>
        </div>

        {hasAI ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAICategorize}
              disabled={categorizePending}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-50"
              style={{ color: "var(--accent-purple)" }}
              title="AI uzupełni kuchnię, posiłek i trudność na podstawie tytułu, składników i kroków"
            >
              <Wand2 size={12} /> {categorizePending ? "Zgaduję…" : "Zgaduj kategorię (AI)"}
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Field label="Kuchnia">
            <input
              type="text"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="np. włoska"
              className="w-full px-2 py-1.5 rounded border text-sm"
              style={inputStyle}
            />
          </Field>
          <Field label="Posiłek">
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType | "")}
              className="w-full px-2 py-1.5 rounded border text-sm"
              style={inputStyle}
            >
              <option value="">—</option>
              {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((mt) => (
                <option key={mt} value={mt}>{MEAL_TYPE_LABELS[mt]}</option>
              ))}
            </select>
          </Field>
          <Field label="Książka kucharska">
            <select
              value={cookbookId}
              onChange={(e) => setCookbookId(e.target.value)}
              className="w-full px-2 py-1.5 rounded border text-sm"
              style={inputStyle}
            >
              <option value="">— brak —</option>
              {cookbooks.map((cb) => (
                <option key={cb.id} value={cb.id}>{cb.emoji} {cb.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Składniki
            </h2>
            <div className="flex items-center gap-1">
              {hasAI ? (
                <button
                  type="button"
                  onClick={() => setAiOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
                  style={{ color: "var(--accent-purple)" }}
                >
                  <Sparkles size={12} /> Wklej AI
                </button>
              ) : null}
              <button
                type="button"
                onClick={addIngredient}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{ color: "var(--accent-orange)" }}
              >
                <Plus size={12} /> Dodaj
              </button>
            </div>
          </div>

          {aiOpen ? (
            <div
              className="mb-2 p-2 rounded border"
              style={{ borderColor: "var(--accent-purple)", backgroundColor: "var(--bg-surface)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Wklej blok tekstu — AI rozpozna składniki.
              </p>
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={5}
                placeholder={"400 g mąki\n2 jajka\nszczypta soli"}
                className="w-full px-2 py-1.5 rounded border text-xs"
                style={inputStyle}
              />
              <div className="flex items-center justify-end gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  className="px-2 py-1 rounded text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleAIParse}
                  disabled={aiPending}
                  className="px-2 py-1 rounded text-xs disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}
                >
                  {aiPending ? "Parsuję…" : "Parsuj"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            {ingredients.map((ing, idx) => (
              <div
                key={ing._key}
                className="flex items-center gap-1.5 p-1.5 rounded border"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
              >
                <input
                  type="number"
                  step="any"
                  value={ing.quantity ?? ""}
                  onChange={(e) =>
                    updateIngredientLocal(ing._key, {
                      quantity: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="ilość"
                  className="w-16 px-1.5 py-1 rounded border text-xs"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={ing.unit ?? ""}
                  onChange={(e) => updateIngredientLocal(ing._key, { unit: e.target.value || null })}
                  placeholder="jedn."
                  className="w-16 px-1.5 py-1 rounded border text-xs"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => updateIngredientLocal(ing._key, { name: e.target.value })}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    if (raw && ing.quantity == null && /\d/.test(raw)) {
                      handleIngredientSmartPaste(ing._key, raw);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && idx === ingredients.length - 1) {
                      e.preventDefault();
                      addIngredient();
                    }
                  }}
                  placeholder="nazwa składnika"
                  className="flex-1 min-w-0 px-2 py-1 rounded border text-sm"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={ing.note ?? ""}
                  onChange={(e) => updateIngredientLocal(ing._key, { note: e.target.value || null })}
                  placeholder="notka"
                  className="w-28 px-1.5 py-1 rounded border text-xs"
                  style={inputStyle}
                />
                <label className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={ing.isOptional ?? false}
                    onChange={(e) => updateIngredientLocal(ing._key, { isOptional: e.target.checked })}
                  />
                  opc.
                </label>
                <button
                  type="button"
                  onClick={() => removeIngredient(ing._key)}
                  aria-label="Usuń składnik"
                  style={{ color: "var(--accent-red)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Przygotowanie
            </h2>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ color: "var(--accent-orange)" }}
            >
              <Plus size={12} /> Dodaj krok
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {steps.map((s, idx) => (
              <div
                key={s._key}
                className="flex flex-col gap-1.5 p-2 rounded border"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: "var(--bg-elevated)", color: "var(--accent-orange)" }}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Krok</span>
                  <button
                    type="button"
                    onClick={() => removeStep(s._key)}
                    aria-label="Usuń krok"
                    className="ml-auto"
                    style={{ color: "var(--accent-red)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={s.text}
                  onChange={(e) => updateStepLocal(s._key, { text: e.target.value })}
                  placeholder="Opisz krok…"
                  rows={2}
                  className="w-full px-2 py-1.5 rounded border text-sm resize-y"
                  style={inputStyle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      addStep();
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Timer (min):
                    <input
                      type="number"
                      min={0}
                      value={s.durationMin ?? ""}
                      onChange={(e) =>
                        updateStepLocal(s._key, {
                          durationMin: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-16 px-1.5 py-0.5 rounded border text-xs"
                      style={inputStyle}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Temp:
                    <input
                      type="text"
                      value={s.temperature ?? ""}
                      onChange={(e) => updateStepLocal(s._key, { temperature: e.target.value || null })}
                      placeholder="180°C"
                      className="w-20 px-1.5 py-0.5 rounded border text-xs"
                      style={inputStyle}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Field label="Notatki kucharza">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="np. Najlepiej z guanciale, pieprz świeżo mielony."
            className="w-full px-3 py-2 rounded border text-sm resize-y"
            style={inputStyle}
          />
        </Field>

        {recipe ? (
          <RecipeImagesEditor recipeId={recipe.id} images={recipe.images} hasAI={hasAI} />
        ) : (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Zdjęcia i załączniki
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Zapisz przepis, aby dodać zdjęcia kartek i odczytać z nich tekst (OCR).
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-elevated)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
