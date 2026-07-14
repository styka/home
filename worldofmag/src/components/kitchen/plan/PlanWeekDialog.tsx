"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Loader2, Wand2, ChefHat } from "lucide-react";
import { runJob } from "@/lib/jobs/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { bulkSetMealPlan } from "@/actions/mealPlans";
import type { MealSlot } from "@/types/kitchen";
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from "@/types/kitchen";
import { dateKey, formatDayShort, getWeekDays } from "@/lib/kitchenDate";
import { polishPlural } from "@/lib/polishPlural";

interface PlanWeekDialogProps {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  recipeCount: number;
}

interface Suggestion {
  date: string;
  slot: MealSlot;
  recipeId: string;
  slug: string;
  title: string;
  servings: number;
  reason: string;
}

const SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: "☕",
  lunch: "🍽",
  dinner: "🌙",
  snack: "🍪",
};

type Step = "prefs" | "loading" | "review";

export function PlanWeekDialog({ open, onClose, weekStart, recipeCount }: PlanWeekDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("prefs");

  const [people, setPeople] = useState(2);
  const [selectedSlots, setSelectedSlots] = useState<Set<MealSlot>>(new Set<MealSlot>(["lunch", "dinner"]));
  const [avoid, setAvoid] = useState("");
  const [cuisines, setCuisines] = useState("");
  const [maxMinutes, setMaxMinutes] = useState<string>("");
  const [mustUsePantry, setMustUsePantry] = useState(true);
  const [noRepeats, setNoRepeats] = useState(true);
  const [replace, setReplace] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggleSlot(slot: MealSlot) {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  function key(s: Suggestion) {
    return `${s.date}::${s.slot}::${s.recipeId}`;
  }

  async function handleGenerate() {
    if (selectedSlots.size === 0) {
      showToast("Wybierz co najmniej jeden slot", "error");
      return;
    }
    setStep("loading");
    try {
      // Z-131 (T-17): plan tygodnia przez kolejkę zadań. Błędy rzuca → catch niżej.
      const res = await runJob<{ suggestions: Suggestion[] }>("kitchen.planWeek", {
        weekStart: dateKey(weekStart),
        slots: Array.from(selectedSlots),
        people,
        avoid: avoid.split(",").map((s) => s.trim()).filter(Boolean),
        cuisines: cuisines.split(",").map((s) => s.trim()).filter(Boolean),
        maxMinutes: maxMinutes ? Number(maxMinutes) : null,
        mustUsePantry,
        noRepeats,
      });
      if (!res?.suggestions) {
        showToast("Brak odpowiedzi AI", "error");
        setStep("prefs");
        return;
      }
      if (res.suggestions.length === 0) {
        showToast("AI nie zaproponowało żadnego posiłku — rozluźnij preferencje", "info");
        setStep("prefs");
        return;
      }
      setSuggestions(res.suggestions);
      setExcluded(new Set());
      setStep("review");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd AI", "error");
      setStep("prefs");
    }
  }

  function handleApply() {
    const toApply = suggestions.filter((s) => !excluded.has(key(s)));
    if (toApply.length === 0) {
      showToast("Nie wybrałeś żadnej propozycji", "error");
      return;
    }
    startTransition(async () => {
      try {
        const res = await bulkSetMealPlan({
          replace,
          entries: toApply.map((s) => ({
            date: new Date(`${s.date}T12:00:00`),
            slot: s.slot,
            recipeId: s.recipeId,
            servings: s.servings,
          })),
        });
        const skipMsg = res.skipped > 0 ? ` (pominięto ${res.skipped} zajętych)` : "";
        showToast(`Dodano ${res.added} pozycji do planu${skipMsg}`, "success");
        onClose();
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd zapisu", "error");
      }
    });
  }

  function handleClose() {
    setStep("prefs");
    setSuggestions([]);
    setExcluded(new Set());
    onClose();
  }

  const weekDays = getWeekDays(weekStart);
  const matrix = new Map<string, Suggestion>();
  for (const s of suggestions) matrix.set(`${s.date}::${s.slot}`, s);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--accent-purple)" }} />
          AI: Plan tygodnia
        </span>
      }
      footer={
        <div className="flex items-center justify-between" style={{ width: "100%" }}>
          {step === "review" ? (
            <button
              type="button"
              onClick={() => setStep("prefs")}
              className="px-3 py-1.5 rounded text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              ← Wstecz
            </button>
          ) : <span />}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={handleClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
              Anuluj
            </button>
            {step === "prefs" ? (
              <button
                onClick={handleGenerate}
                disabled={selectedSlots.size === 0 || recipeCount === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}
              >
                <Wand2 size={14} /> Generuj plan
              </button>
            ) : null}
            {step === "review" ? (
              <button
                onClick={handleApply}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
              >
                {pending ? "Zapisuję…" : `Zaakceptuj ${suggestions.length - excluded.size}`}
              </button>
            ) : null}
          </div>
        </div>
      }
    >
      <>

        {step === "prefs" && recipeCount === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center gap-3">
            <ChefHat size={36} style={{ color: "var(--text-muted)" }} />
            <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Brak przepisów w bibliotece
            </h4>
            <p className="text-xs max-w-xs" style={{ color: "var(--text-secondary)" }}>
              AI losuje plan tylko z Twoich własnych przepisów. Dodaj kilka, a potem wróć tutaj.
            </p>
            <Link
              href="/kitchen/recipes/new"
              onClick={handleClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
              style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
            >
              Dodaj przepis
            </Link>
          </div>
        ) : null}

        {step === "prefs" && recipeCount > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              AI wybierze przepisy z Twojej biblioteki dla każdego slotu w tygodniu na podstawie preferencji.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Liczba osób
                </span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={people}
                  onChange={(e) => setPeople(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                  className="px-2 py-1.5 rounded border text-sm"
                  style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Max czas/posiłek (min)
                </span>
                <input
                  type="number"
                  min={0}
                  placeholder="bez limitu"
                  value={maxMinutes}
                  onChange={(e) => setMaxMinutes(e.target.value)}
                  className="px-2 py-1.5 rounded border text-sm"
                  style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Posiłki dziennie
              </span>
              <div className="flex gap-1 flex-wrap">
                {MEAL_SLOTS.map((slot) => {
                  const active = selectedSlots.has(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => toggleSlot(slot)}
                      className="px-2.5 py-1 rounded text-xs"
                      style={{
                        backgroundColor: active ? "var(--accent-orange)" : "var(--bg-elevated)",
                        color: active ? "#0d0d0d" : "var(--text-secondary)",
                      }}
                    >
                      {SLOT_EMOJI[slot]} {MEAL_SLOT_LABELS[slot]}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Unikaj (rozdziel przecinkami)
              </span>
              <input
                type="text"
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                placeholder="boczek, ryba"
                className="px-2 py-1.5 rounded border text-sm"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Preferowane kuchnie (rozdziel przecinkami)
              </span>
              <input
                type="text"
                value={cuisines}
                onChange={(e) => setCuisines(e.target.value)}
                placeholder="polska, włoska"
                className="px-2 py-1.5 rounded border text-sm"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>

            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={mustUsePantry} onChange={(e) => setMustUsePantry(e.target.checked)} />
                <span style={{ color: "var(--text-primary)" }}>Priorytet: użyj produktów ze spiżarni</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={noRepeats} onChange={(e) => setNoRepeats(e.target.checked)} />
                <span style={{ color: "var(--text-primary)" }}>Nie powtarzaj przepisów w tygodniu</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                <span style={{ color: "var(--text-primary)" }}>Nadpisz istniejące wpisy w planie</span>
              </label>
            </div>
          </div>
        ) : null}

        {step === "loading" ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent-purple)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              AI tworzy plan na podstawie Twoich przepisów…
            </p>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              AI zaproponowało {suggestions.length} {polishPlural(suggestions.length, ["posiłek", "posiłki", "posiłków"])}. Odznacz te których nie chcesz.
            </p>
            <div className="flex flex-col gap-2">
              {weekDays.map((d) => {
                const k = dateKey(d);
                const daySlots = Array.from(selectedSlots).filter((slot) => matrix.has(`${k}::${slot}`));
                if (daySlots.length === 0) return null;
                return (
                  <section
                    key={k}
                    className="rounded border p-2"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
                  >
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                      {formatDayShort(d)}
                    </h4>
                    <div className="flex flex-col gap-1">
                      {daySlots.map((slot) => {
                        const sug = matrix.get(`${k}::${slot}`)!;
                        const isExcluded = excluded.has(key(sug));
                        return (
                          <label
                            key={`${k}::${slot}`}
                            className="flex items-start gap-2 text-sm py-1 px-1.5 rounded cursor-pointer"
                            style={{
                              backgroundColor: isExcluded ? "transparent" : "var(--bg-surface)",
                              color: isExcluded ? "var(--text-muted)" : "var(--text-primary)",
                              textDecoration: isExcluded ? "line-through" : "none",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => {
                                setExcluded((prev) => {
                                  const next = new Set(prev);
                                  const k2 = key(sug);
                                  if (next.has(k2)) next.delete(k2);
                                  else next.add(k2);
                                  return next;
                                });
                              }}
                              className="mt-0.5"
                            />
                            <span className="text-base" style={{ flexShrink: 0 }}>{SLOT_EMOJI[slot]}</span>
                            <span className="flex-1 min-w-0">
                              <span className="font-medium">{sug.title}</span>
                              {sug.reason ? (
                                <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                                  {sug.reason}
                                </span>
                              ) : null}
                            </span>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {sug.servings}p
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : null}

      </>
    </Modal>
  );
}
