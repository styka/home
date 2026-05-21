"use client";

import { useEffect, useState, useTransition } from "react";
import { X, ShoppingCart } from "lucide-react";
import { generateShoppingListFromPlan } from "@/actions/mealPlans";
import { useToast } from "@/components/ui/Toast";

interface ShoppingFromPlanDialogProps {
  open: boolean;
  onClose: () => void;
  defaultFrom: Date;
  defaultTo: Date;
  lists: Array<{ id: string; name: string }>;
}

export function ShoppingFromPlanDialog({
  open,
  onClose,
  defaultFrom,
  defaultTo,
  lists,
}: ShoppingFromPlanDialogProps) {
  const [listId, setListId] = useState<string>(lists[0]?.id ?? "");
  const [skipPantry, setSkipPantry] = useState(true);
  const [consolidate, setConsolidate] = useState(true);
  const [skipOptional, setSkipOptional] = useState(false);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (open) setListId(lists[0]?.id ?? "");
  }, [open, lists]);

  if (!open) return null;

  function handleConfirm() {
    if (!listId) {
      showToast("Wybierz listę docelową", "error");
      return;
    }
    startTransition(async () => {
      try {
        const result = await generateShoppingListFromPlan({
          from: defaultFrom,
          to: defaultTo,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:w-[480px] md:rounded border"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
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
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Z aktualnie wybranego tygodnia. Pozycje z różnych przepisów zostaną skonsolidowane.
          </p>

          {lists.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--accent-amber)" }}>
              Brak list zakupów. Utwórz najpierw listę w module Zakupy.
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: "var(--text-secondary)" }}>Lista docelowa</span>
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

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipPantry} onChange={(e) => setSkipPantry(e.target.checked)} />
            <span style={{ color: "var(--text-primary)" }}>Pomiń to co jest w spiżarni</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={consolidate} onChange={(e) => setConsolidate(e.target.checked)} />
            <span style={{ color: "var(--text-primary)" }}>Konsoliduj duplikaty (cebula w 3 przepisach → 3 szt)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipOptional} onChange={(e) => setSkipOptional(e.target.checked)} />
            <span style={{ color: "var(--text-primary)" }}>Pomiń składniki opcjonalne</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
            Anuluj
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending || lists.length === 0}
            className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
          >
            {pending ? "Generuję…" : "Dodaj do listy"}
          </button>
        </div>
      </div>
    </div>
  );
}
