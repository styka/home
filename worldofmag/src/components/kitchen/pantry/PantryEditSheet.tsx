"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Trash2 } from "lucide-react";
import { addPantryItem, updatePantryItem, deletePantryItem } from "@/actions/pantry";
import { useToast } from "@/components/ui/Toast";
import type { PantryItemWithProduct } from "@/actions/pantry";

const LOCATION_OPTIONS = ["spiżarnia", "lodówka", "zamrażarka", "przyprawy", "inne"];

interface PantryEditSheetProps {
  open: boolean;
  onClose: () => void;
  item?: PantryItemWithProduct | null;
  defaultLocation?: string | null;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function PantryEditSheet({ open, onClose, item, defaultLocation }: PantryEditSheetProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [quantity, setQuantity] = useState<string>(item?.quantity?.toString() ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [location, setLocation] = useState(item?.location ?? defaultLocation ?? "spiżarnia");
  const [expiresAt, setExpiresAt] = useState<string>(toDateInput(item?.expiresAt));
  const [minQuantity, setMinQuantity] = useState<string>(item?.minQuantity?.toString() ?? "");
  const [autoShop, setAutoShop] = useState<boolean>(item?.autoShop ?? false);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setQuantity(item?.quantity?.toString() ?? "");
      setUnit(item?.unit ?? "");
      setLocation(item?.location ?? defaultLocation ?? "spiżarnia");
      setExpiresAt(toDateInput(item?.expiresAt));
      setMinQuantity(item?.minQuantity?.toString() ?? "");
      setAutoShop(item?.autoShop ?? false);
    }
  }, [open, item, defaultLocation]);

  if (!open) return null;

  function handleSave() {
    if (!name.trim()) {
      showToast("Nazwa jest wymagana", "error");
      return;
    }
    const payload = {
      name: name.trim(),
      quantity: quantity ? Number(quantity) : null,
      unit: unit.trim() || null,
      location: location || null,
      expiresAt: expiresAt ? new Date(`${expiresAt}T12:00:00`) : null,
      minQuantity: minQuantity ? Number(minQuantity) : null,
      autoShop,
    };
    startTransition(async () => {
      try {
        if (item) await updatePantryItem(item.id, payload);
        else await addPantryItem(payload);
        showToast("Zapisano", "success");
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function handleDelete() {
    if (!item) return;
    if (!confirm("Usunąć tę pozycję ze spiżarni?")) return;
    startTransition(async () => {
      try {
        await deletePantryItem(item.id);
        showToast("Usunięto", "success");
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
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
        className="w-full md:w-[480px] md:rounded border max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {item ? "Edytuj pozycję" : "Nowa pozycja"}
          </h3>
          <button onClick={onClose} aria-label="Zamknij" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          <Field label="Nazwa">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded border text-sm"
              style={inputStyle}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ilość">
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="Jednostka">
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="szt, g, ml…"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Lokalizacja">
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-2 py-1.5 rounded border text-sm"
              style={inputStyle}
            >
              {LOCATION_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Termin ważności">
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-2 py-1.5 rounded border text-sm"
              style={inputStyle}
            />
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <Field label="Minimum (auto-uzupełnianie)">
              <input
                type="number"
                step="any"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="np. 0.5"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
            <label className="flex items-center gap-1.5 text-xs px-1 py-1.5" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={autoShop}
                onChange={(e) => setAutoShop(e.target.checked)}
              />
              Auto-uzupełnij
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div>
            {item ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs disabled:opacity-50"
                style={{ color: "var(--accent-red)" }}
              >
                <Trash2 size={14} /> Usuń
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={pending}
              className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
            >
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
          </div>
        </div>
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
