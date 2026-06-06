"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight, Play, Pause, Square, List, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { markRecipeCooked } from "@/actions/recipes";
import { ServingSelector } from "@/components/kitchen/shared/ServingSelector";
import type { RecipeFull } from "@/types/kitchen";

interface CookModeProps {
  recipe: RecipeFull;
}

interface TimerState {
  stepId: string;
  remaining: number; // seconds
  running: boolean;
}

function scaleQty(qty: number | null, factor: number): number | null {
  if (qty == null) return null;
  return Math.round(qty * factor * 100) / 100;
}

function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function CookMode({ recipe }: CookModeProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [stepIdx, setStepIdx] = useState(0);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [completedDialog, setCompletedDialog] = useState(false);
  const [completedServings, setCompletedServings] = useState(recipe.servings);
  const [pendingCook, startCook] = useTransition();
  const [timers, setTimers] = useState<TimerState[]>(() =>
    recipe.steps
      .filter((s) => s.durationMin != null)
      .map((s) => ({ stepId: s.id, remaining: (s.durationMin ?? 0) * 60, running: false }))
  );
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const steps = recipe.steps;
  const currentStep = steps[stepIdx];

  // Wake lock — keep screen on while cook mode is open
  useEffect(() => {
    let cancelled = false;
    async function acquire() {
      try {
        if ("wakeLock" in navigator) {
          const lock = await (navigator as Navigator & {
            wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> };
          }).wakeLock.request("screen");
          if (cancelled) {
            await lock.release();
            return;
          }
          wakeLockRef.current = lock;
        }
      } catch {
        // ignore — not supported in this browser
      }
    }
    acquire();
    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, []);

  // Timer ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (!t.running) return t;
          if (t.remaining <= 0) return t;
          const remaining = t.remaining - 1;
          changed = true;
          if (remaining === 0) {
            // beep + vibrate
            try {
              if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
            } catch {
              /* noop */
            }
          }
          return { ...t, remaining, running: remaining > 0 };
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof recipe.ingredients>();
    for (const ing of recipe.ingredients) {
      const key = ing.groupName ?? "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ing);
    }
    return Array.from(groups.entries());
  }, [recipe.ingredients]);

  function next() {
    if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
    else setCompletedDialog(true);
  }
  function prev() {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  }

  function handleTimerToggle(stepId: string) {
    setTimers((prev) =>
      prev.map((t) => (t.stepId === stepId ? { ...t, running: !t.running } : t))
    );
  }
  function handleTimerReset(stepId: string, defaultMin: number) {
    setTimers((prev) =>
      prev.map((t) =>
        t.stepId === stepId ? { ...t, remaining: defaultMin * 60, running: false } : t
      )
    );
  }

  function handleExit() {
    router.push(`/kitchen/recipes/${recipe.slug}`);
  }

  function handleConfirmCooked() {
    startCook(async () => {
      try {
        await markRecipeCooked(recipe.id, completedServings);
        showToast("Zapisano. Smacznego!", "success");
        router.push(`/kitchen/recipes/${recipe.slug}`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (completedDialog || ingredientsOpen) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        handleExit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, completedDialog, ingredientsOpen]);

  if (steps.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: "var(--kitchen-cook-bg, #050505)", color: "var(--on-accent)" }}
      >
        <p className="text-lg mb-4">Ten przepis nie ma jeszcze kroków.</p>
        <button
          onClick={handleExit}
          className="px-4 py-2 rounded text-sm"
          style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
        >
          Wyjdź
        </button>
      </div>
    );
  }

  const activeTimer = timers.find((t) => t.stepId === currentStep?.id);
  const runningTimers = timers.filter((t) => t.running && t.remaining > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "var(--kitchen-cook-bg, #050505)", color: "var(--on-accent)" }}
    >
      {/* Top bar */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "#222" }}
      >
        <button
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "#999" }}
        >
          <X size={16} /> Wyjdź
        </button>
        <div className="text-xs" style={{ color: "#999" }}>
          {recipe.title} · Krok {stepIdx + 1} / {steps.length}
        </div>
        <button
          onClick={() => setIngredientsOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "#999" }}
          aria-label="Pokaż składniki"
        >
          <List size={16} />
        </button>
      </header>

      {/* Step content */}
      <main className="flex-1 relative overflow-hidden">
        {/* Tap zones (mobile-friendly) */}
        <button
          type="button"
          onClick={prev}
          className="absolute inset-y-0 left-0 w-1/3 z-10"
          style={{ background: "transparent" }}
          aria-label="Poprzedni krok"
        />
        <button
          type="button"
          onClick={next}
          className="absolute inset-y-0 right-0 w-1/3 z-10"
          style={{ background: "transparent" }}
          aria-label="Następny krok"
        />

        <div
          aria-live="polite"
          className="h-full flex flex-col items-center justify-center px-6 md:px-12 text-center"
        >
          <p
            className="leading-snug max-w-3xl"
            style={{
              fontSize: "clamp(22px, 4vw, 36px)",
              color: "var(--on-accent)",
              whiteSpace: "pre-wrap",
            }}
          >
            {currentStep?.text}
          </p>
          {currentStep?.temperature ? (
            <p className="mt-4 text-base" style={{ color: "var(--accent-amber)" }}>
              🌡 {currentStep.temperature}
            </p>
          ) : null}

          {activeTimer ? (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div
                className="text-4xl md:text-6xl tabular-nums"
                style={{
                  color: activeTimer.remaining === 0 ? "var(--accent-green)" : "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatMmSs(activeTimer.remaining)}
              </div>
              <div className="flex items-center gap-2 z-20 relative">
                <button
                  type="button"
                  onClick={() => handleTimerToggle(activeTimer.stepId)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm"
                  style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
                >
                  {activeTimer.running ? <Pause size={16} /> : <Play size={16} />}
                  {activeTimer.running ? "Pauza" : "Start"}
                </button>
                <button
                  type="button"
                  onClick={() => handleTimerReset(activeTimer.stepId, currentStep?.durationMin ?? 0)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border"
                  style={{ borderColor: "#333", color: "var(--on-accent)" }}
                >
                  <Square size={14} /> Reset
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Floating running timers */}
        {runningTimers.length > 0 ? (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
            {runningTimers.map((t) => {
              const step = recipe.steps.find((s) => s.id === t.stepId);
              const idx = recipe.steps.findIndex((s) => s.id === t.stepId) + 1;
              return (
                <div
                  key={t.stepId}
                  className="text-xs px-2 py-1 rounded-full tabular-nums"
                  style={{ backgroundColor: "rgba(255, 138, 61, 0.16)", color: "var(--accent-orange)" }}
                  title={step?.text}
                >
                  Krok {idx}: {formatMmSs(t.remaining)}
                </div>
              );
            })}
          </div>
        ) : null}
      </main>

      {/* Bottom bar with prev/next + progress */}
      <footer
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t z-20"
        style={{ borderColor: "#222" }}
      >
        <button
          type="button"
          onClick={prev}
          disabled={stepIdx === 0}
          className="inline-flex items-center gap-1 px-3 py-2 rounded text-sm disabled:opacity-30"
          style={{ color: "var(--on-accent)" }}
        >
          <ChevronLeft size={16} /> Poprzedni
        </button>
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                backgroundColor: i === stepIdx ? "var(--accent-orange)" : i < stepIdx ? "var(--accent-green)" : "#333",
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          className="inline-flex items-center gap-1 px-3 py-2 rounded text-sm"
          style={{
            color: stepIdx === steps.length - 1 ? "#0d0d0d" : "#fff",
            backgroundColor: stepIdx === steps.length - 1 ? "var(--accent-green)" : "transparent",
          }}
        >
          {stepIdx === steps.length - 1 ? "Skończone" : "Następny"} <ChevronRight size={16} />
        </button>
      </footer>

      {/* Ingredients sheet */}
      {ingredientsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={() => setIngredientsOpen(false)}
        >
          <div
            className="w-full md:w-[460px] md:rounded border max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Składniki ({recipe.servings} porcji)
              </h3>
              <button onClick={() => setIngredientsOpen(false)} aria-label="Zamknij" style={{ color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              {grouped.map(([group, items]) => (
                <div key={group}>
                  {group ? (
                    <h4 className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>
                      {group}
                    </h4>
                  ) : null}
                  <ul className="flex flex-col gap-1">
                    {items.map((ing) => {
                      const q = scaleQty(ing.quantity, 1);
                      return (
                        <li key={ing.id} className="text-sm" style={{ color: "var(--text-primary)" }}>
                          {q != null ? <span className="tabular-nums">{q}</span> : null}
                          {q != null && ing.unit ? <span>{` ${ing.unit}`}</span> : null}
                          {q != null ? " " : ""}
                          {ing.name}
                          {ing.note ? <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }}>— {ing.note}</span> : null}
                          {ing.isOptional ? <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>(opc.)</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Mark cooked dialog */}
      {completedDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-sm rounded border p-5"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Ugotowane!
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              {recipe.title}
            </p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Ile porcji wyszło?</span>
              <ServingSelector value={completedServings} onChange={setCompletedServings} />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setCompletedDialog(false)}
                className="px-3 py-1.5 rounded text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Wróć
              </button>
              <button
                onClick={handleConfirmCooked}
                disabled={pendingCook}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-green)", color: "#0d0d0d" }}
              >
                <CheckCircle2 size={14} /> {pendingCook ? "Zapisuję…" : "Zapisz"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
