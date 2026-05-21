"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart, Plus, CheckCircle2, PanelRightOpen, PanelRightClose } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { addDays, subDays } from "date-fns";
import { useToast } from "@/components/ui/Toast";
import { moveMealPlanEntry, setMealPlanEntry } from "@/actions/mealPlans";
import { SlotEditorSheet, type RecipePickerItem } from "./SlotEditorSheet";
import { ShoppingFromPlanDialog } from "./ShoppingFromPlanDialog";
import { RecipeDrawer } from "./RecipeDrawer";
import type { MealPlanEntryWithRecipe } from "@/actions/mealPlans";
import type { MealSlot } from "@/types/kitchen";
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from "@/types/kitchen";
import {
  getWeekStart,
  getWeekDays,
  getWeekEnd,
  formatWeekRange,
  formatDayShort,
  dateKey,
  isToday,
} from "@/lib/kitchenDate";

interface MealPlanWeekProps {
  initialWeek: string; // YYYY-MM-DD anchor (any date in week)
  entries: MealPlanEntryWithRecipe[];
  recipes: RecipePickerItem[];
  lists: Array<{ id: string; name: string }>;
}

const SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: "☕",
  lunch: "🍽",
  dinner: "🌙",
  snack: "🍪",
};

interface SlotMatrix {
  [dateKey: string]: { [slot in MealSlot]?: MealPlanEntryWithRecipe };
}

function buildMatrix(entries: MealPlanEntryWithRecipe[]): SlotMatrix {
  const matrix: SlotMatrix = {};
  for (const e of entries) {
    const k = dateKey(new Date(e.date));
    if (!matrix[k]) matrix[k] = {};
    matrix[k][e.slot as MealSlot] = e;
  }
  return matrix;
}

function entryLabel(e: MealPlanEntryWithRecipe): string {
  return e.recipe?.title ?? e.customTitle ?? "—";
}

const DRAWER_KEY = "kitchen.plan.drawerOpen";

export function MealPlanWeek({ initialWeek, entries, recipes, lists }: MealPlanWeekProps) {
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date(`${initialWeek}T12:00:00`));
  const [editing, setEditing] = useState<{ date: Date; slot: MealSlot; entry?: MealPlanEntryWithRecipe | null } | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAWER_KEY);
      if (stored != null) setDrawerOpen(stored === "1");
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAWER_KEY, drawerOpen ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [drawerOpen]);

  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const matrix = useMemo(() => buildMatrix(entries), [entries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;
    const [dateStr, slot] = overId.split("::");
    if (!dateStr || !slot) return;
    const target = new Date(`${dateStr}T12:00:00`);

    if (activeId.startsWith("recipe::")) {
      const data = event.active.data.current as { recipeId?: string; servings?: number } | undefined;
      const recipeId = data?.recipeId ?? activeId.slice("recipe::".length);
      const servings = data?.servings ?? 2;
      const existing = matrix[dateStr]?.[slot as MealSlot];
      startTransition(async () => {
        try {
          if (existing) {
            showToast("Slot zajęty — kliknij, by zamienić", "info");
            return;
          }
          await setMealPlanEntry({ date: target, slot: slot as MealSlot, recipeId, servings });
          showToast("Dodano do planu", "success");
        } catch (e) {
          showToast(e instanceof Error ? e.message : "Błąd dodawania", "error");
        }
      });
      return;
    }

    startTransition(async () => {
      try {
        await moveMealPlanEntry(activeId, target, slot as MealSlot);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd przenoszenia", "error");
      }
    });
  }

  function goPrev() {
    setAnchorDate((d) => subDays(d, 7));
  }
  function goNext() {
    setAnchorDate((d) => addDays(d, 7));
  }
  function goToday() {
    setAnchorDate(new Date());
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing || shoppingOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        goNext();
      } else if (e.key === "t" || e.key === "T") {
        goToday();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, shoppingOpen]);

  function openEditor(date: Date, slot: MealSlot, entry?: MealPlanEntryWithRecipe) {
    setEditing({ date, slot, entry });
  }

  return (
    <div className="px-3 md:px-6 py-3 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
            aria-label="Poprzedni tydzień"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 h-8 rounded text-sm"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
          >
            Dziś
          </button>
          <button
            type="button"
            onClick={goNext}
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
            aria-label="Następny tydzień"
          >
            <ChevronRight size={16} />
          </button>
          <span className="ml-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {formatWeekRange(anchorDate)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            aria-label={drawerOpen ? "Ukryj panel przepisów" : "Pokaż panel przepisów"}
            title={drawerOpen ? "Ukryj panel przepisów" : "Pokaż panel przepisów"}
          >
            {drawerOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setShoppingOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
            style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
          >
            <ShoppingCart size={14} /> Lista zakupów z planu
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          className="hidden md:grid gap-3"
          style={{ gridTemplateColumns: drawerOpen ? "1fr 240px" : "1fr" }}
        >
          {/* Desktop: grid 7 cols × 4 slot rows */}
          <div
            className="grid gap-1 border rounded overflow-hidden"
            style={{
              gridTemplateColumns: "100px repeat(7, minmax(0, 1fr))",
              borderColor: "var(--border)",
              backgroundColor: "var(--border)",
            }}
          >
          <div style={{ backgroundColor: "var(--bg-surface)" }} />
          {weekDays.map((d) => (
            <div
              key={dateKey(d)}
              className="px-2 py-1.5 text-xs font-medium text-center"
              style={{
                backgroundColor: "var(--bg-surface)",
                color: isToday(d) ? "var(--accent-orange)" : "var(--text-secondary)",
              }}
            >
              {formatDayShort(d)}
            </div>
          ))}

          {MEAL_SLOTS.map((slot) => (
            <ShellRow key={slot}>
              <SlotLabel slot={slot} />
              {weekDays.map((d) => {
                const k = dateKey(d);
                const entry = matrix[k]?.[slot];
                return (
                  <SlotCell
                    key={`${k}::${slot}`}
                    id={`${k}::${slot}`}
                    onClick={() => openEditor(d, slot, entry)}
                    isToday={isToday(d)}
                  >
                    {entry ? <DraggableEntry entry={entry} /> : <EmptySlot />}
                  </SlotCell>
                );
              })}
            </ShellRow>
          ))}
          </div>
          {drawerOpen ? <RecipeDrawer recipes={recipes} /> : null}
        </div>

        {/* Mobile: list dni */}
        <div className="md:hidden flex flex-col gap-3">
          {weekDays.map((d) => {
            const k = dateKey(d);
            return (
              <div
                key={k}
                className="rounded border"
                style={{ borderColor: isToday(d) ? "var(--accent-orange)" : "var(--border)", backgroundColor: "var(--bg-surface)" }}
              >
                <div
                  className="px-3 py-2 text-sm font-semibold border-b"
                  style={{
                    color: isToday(d) ? "var(--accent-orange)" : "var(--text-primary)",
                    borderColor: "var(--border)",
                  }}
                >
                  {formatDayShort(d)}
                </div>
                <div className="flex flex-col gap-1 p-2">
                  {MEAL_SLOTS.map((slot) => {
                    const entry = matrix[k]?.[slot];
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => openEditor(d, slot, entry)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left"
                        style={{
                          backgroundColor: "var(--bg-elevated)",
                          color: entry ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      >
                        <span>{SLOT_EMOJI[slot]}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{MEAL_SLOT_LABELS[slot]}</span>
                        <span className="flex-1 truncate ml-1">
                          {entry ? (
                            <>
                              {entryLabel(entry)} <span style={{ color: "var(--text-muted)" }}>· {entry.servings}p</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                        {entry?.status === "COOKED" ? (
                          <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DndContext>

      {editing ? (
        <SlotEditorSheet
          open
          onClose={() => setEditing(null)}
          date={editing.date}
          slot={editing.slot}
          entry={editing.entry}
          recipes={recipes}
        />
      ) : null}

      <ShoppingFromPlanDialog
        open={shoppingOpen}
        onClose={() => setShoppingOpen(false)}
        defaultFrom={getWeekStart(anchorDate)}
        defaultTo={getWeekEnd(anchorDate)}
        lists={lists}
      />

      {pending ? (
        <div className="fixed bottom-4 right-4 text-xs px-3 py-1.5 rounded" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          Synchronizuję…
        </div>
      ) : null}
    </div>
  );
}

function ShellRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SlotLabel({ slot }: { slot: MealSlot }) {
  return (
    <div
      className="px-2 py-2 text-xs font-medium flex items-center gap-1"
      style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }}
    >
      <span>{SLOT_EMOJI[slot]}</span>
      {MEAL_SLOT_LABELS[slot]}
    </div>
  );
}

function SlotCell({
  id,
  onClick,
  isToday,
  children,
}: {
  id: string;
  onClick: () => void;
  isToday: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className="px-1.5 py-1.5 min-h-[64px] cursor-pointer"
      style={{
        backgroundColor: isOver
          ? "var(--bg-hover)"
          : isToday
          ? "rgba(255, 138, 61, 0.08)"
          : "var(--bg-surface)",
      }}
    >
      {children}
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-muted)" }}>
      <Plus size={14} />
    </div>
  );
}

function DraggableEntry({ entry }: { entry: MealPlanEntryWithRecipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id });
  const isCooked = entry.status === "COOKED";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => e.stopPropagation()}
      className="text-xs px-2 py-1 rounded"
      style={{
        backgroundColor: isCooked ? "var(--bg-elevated)" : "rgba(255, 138, 61, 0.16)",
        color: isCooked ? "var(--text-muted)" : "var(--text-primary)",
        opacity: isDragging ? 0.5 : 1,
        cursor: "grab",
        lineHeight: 1.3,
      }}
    >
      <div className="font-medium truncate">{entryLabel(entry)}</div>
      <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span>{entry.servings}p</span>
        {isCooked ? <CheckCircle2 size={10} style={{ color: "var(--accent-green)" }} /> : null}
      </div>
    </div>
  );
}

