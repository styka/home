"use client";

import { useEffect, useState, useTransition } from "react";
import { X, ShoppingCart, Loader2 } from "lucide-react";
import { addDays, format } from "date-fns";
import {
  generateShoppingListFromPlan,
  previewShoppingListFromPlan,
  type ShoppingListPreviewItem,
} from "@/actions/mealPlans";
import { useToast } from "@/components/ui/Toast";

interface ShoppingFromPlanDialogProps {
  open: boolean;
  onClose: () => void;
  defaultFrom: Date;
  defaultTo: Date;
  lists: Array<{ id: string; name: string }>;
}

type RangeMode = "week" | "next3" | "custom";

function toInputDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseInputDate(s: string): Date {
  return new Date(`${s}T12:00:00`);
}

export function ShoppingFromPlanDialog({
  open,
  onClose,
  defaultFrom,
  defaultTo,
  lists,
}: ShoppingFromPlanDialogProps) {
  const [listId, setListId] = useState<string>(lists[0]?.id ?? "");
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [customFrom, setCustomFrom] = useState<string>(toInputDate(defaultFrom));
  const [customTo, setCustomTo] = useState<string>(toInputDate(defaultTo));
  const [skipPantry, setSkipPantry] = useState(true);
  const [consolidate, setConsolidate] = useState(true);
  const [skipOptional, setSkipOptional] = useState(false);
  const [pending, startTransition] = useTransition();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<ShoppingListPreviewItem[]>([]);
  const [previewSkipped, setPreviewSkipped] = useState(0);
  const [previewMerged, setPreviewMerged] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setListId(lists[0]?.id ?? "");
      setRangeMode("week");
      setCustomFrom(toInputDate(defaultFrom));
      setCustomTo(toInputDate(defaultTo));
    }
  }, [open, lists, defaultFrom, defaultTo]);

  function getRange(): { from: Date; to: Date } {
    if (rangeMode === "next3") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { from: start, to: addDays(start, 2) };
    }
    if (rangeMode === "custom") {
      return { from: parseInputDate(customFrom), to: parseInputDate(customTo) };
    }
    return { from: defaultFrom, to: defaultTo };
  }

  useEffect(() => {
    if (!open) return;
    const { from, to } = getRange();
    setPreviewLoading(true);
    let cancelled = false;
    previewShoppingListFromPlan({ from, to, skipPantry, consolidate, skipOptional })
      .then((res) => {
        if (cancelled) return;
        setPreviewItems(res.items);
        setPreviewSkipped(res.skippedFromPantry.length);
        setPreviewMerged(res.mergedCount);
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewItems([]);
        setPreviewSkipped(0);
        setPreviewMerged(0);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rangeMode, customFrom, customTo, skipPantry, consolidate, skipOptional]);

  if (!open) return null;

  function handleConfirm() {
    if (!listId) {
      showToast("Wybierz listę docelową", "error");
      return;
    }
    const { from, to } = getRange();
    startTransition(async () => {
      try {
        const result = await generateShoppingListFromPlan({
          from,
          to,
          listId,
          skipPantry,
          consolidate,
          skipOptional,
        });
        const merged = result.mergedCount > 0 ? ` (skonsolidowano ${result.mergedCount})` : "";
        const skipped =
          result.skippedFromPantry.length > 0
            ? ` · ${result.skippedFromPantry.length} pominięto (spiżarnia)`
            : "";
        showToast(`Dodano ${result.addedItems.length} pozycji${merged}${skipped}`, "success");
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd generowania", "error");
      }
    });
  }

  const toAdd = previewItems.filter((i) => !i.fromPantry);

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
        <div
          className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <ShoppingCart size={16} style={{ color: "var(--accent-orange)" }} />
            Lista zakupów z planu
          </h3>
          <button onClick={onClose} aria-label="Zamknij" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Zakres
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="range"
                checked={rangeMode === "week"}
                onChange={() => setRangeMode("week")}
              />
              <span style={{ color: "var(--text-primary)" }}>Bieżący tydzień</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                ({format(defaultFrom, "d.MM")}–{format(defaultTo, "d.MM")})
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="range"
                checked={rangeMode === "next3"}
                onChange={() => setRangeMode("next3")}
              />
              <span style={{ color: "var(--text-primary)" }}>Najbliższe 3 dni</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="range"
                checked={rangeMode === "custom"}
                onChange={() => setRangeMode("custom")}
              />
              <span style={{ color: "var(--text-primary)" }}>Wybierz daty:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setRangeMode("custom");
                }}
                className="px-1.5 py-0.5 rounded border text-xs"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <span style={{ color: "var(--text-muted)" }}>–</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setRangeMode("custom");
                }}
                className="px-1.5 py-0.5 rounded border text-xs"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
          </fieldset>

          {lists.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--accent-amber)" }}>
              Brak list zakupów. Utwórz najpierw listę w module Zakupy.
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Lista docelowa
              </span>
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="px-2 py-1.5 rounded border text-sm"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipPantry} onChange={(e) => setSkipPantry(e.target.checked)} />
              <span style={{ color: "var(--text-primary)" }}>Pomiń to co jest w spiżarni</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={consolidate} onChange={(e) => setConsolidate(e.target.checked)} />
              <span style={{ color: "var(--text-primary)" }}>Konsoliduj duplikaty</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipOptional} onChange={(e) => setSkipOptional(e.target.checked)} />
              <span style={{ color: "var(--text-primary)" }}>Pomiń składniki opcjonalne</span>
            </label>
          </div>

          <section className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Podgląd
              </h4>
              {previewLoading ? (
                <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-muted)" }} />
              ) : (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {toAdd.length} {toAdd.length === 1 ? "pozycja" : toAdd.length % 10 >= 2 && toAdd.length % 10 <= 4 && (toAdd.length % 100 < 10 || toAdd.length % 100 >= 20) ? "pozycje" : "pozycji"}
                  {previewMerged > 0 ? ` · skonsolidowano ${previewMerged}` : ""}
                  {previewSkipped > 0 ? ` · ${previewSkipped} w spiżarni` : ""}
                </span>
              )}
            </div>
            {!previewLoading && previewItems.length === 0 ? (
              <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
                Brak zaplanowanych przepisów w tym zakresie.
              </p>
            ) : null}
            <ul
              className="flex flex-col gap-0.5 max-h-48 overflow-y-auto rounded border"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
            >
              {previewItems.map((item, idx) => (
                <li
                  key={`${item.name}-${idx}`}
                  className="flex items-center justify-between gap-2 px-2.5 py-1 text-xs"
                  style={{
                    color: item.fromPantry ? "var(--text-muted)" : "var(--text-primary)",
                    textDecoration: item.fromPantry ? "line-through" : "none",
                  }}
                  title={item.fromPantry ? "Masz w spiżarni — zostanie pominięte" : undefined}
                >
                  <span className="flex-1 min-w-0 truncate">
                    {item.quantity != null ? (
                      <span className="tabular-nums">{item.quantity}{item.unit ? ` ${item.unit}` : ""} </span>
                    ) : null}
                    {item.name}
                  </span>
                  {item.sourceCount > 1 ? (
                    <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      ({item.sourceCount}×)
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div
          className="flex justify-end gap-2 px-4 py-3 border-t sticky bottom-0"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
            Anuluj
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending || lists.length === 0 || toAdd.length === 0}
            className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
          >
            {pending ? "Generuję…" : `Dodaj ${toAdd.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
