"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, Trash2, Plus, Minus, ImagePlus, Loader2 } from "lucide-react";
import {
  addStorageItem,
  updateStorageItem,
  deleteStorageItem,
  adjustStorageQuantity,
} from "@/actions/storage";
import { useToast } from "@/components/ui/Toast";
import { fileToDownscaledDataUrl } from "@/lib/image-utils";
import { BatchesManager } from "./BatchesManager";
import type { StorageItemWithMovements } from "@/actions/storage";
import type { StorageSupplier } from "@prisma/client";

interface StorageEditSheetProps {
  open: boolean;
  onClose: () => void;
  item?: StorageItemWithMovements | null;
  defaultWarehouse?: string | null;
  suppliers?: StorageSupplier[];
  currency?: string;
  pro?: boolean;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-elevated)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function StorageEditSheet({ open, onClose, item, defaultWarehouse, suppliers = [], currency = "PLN", pro = false }: StorageEditSheetProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [barcode, setBarcode] = useState(item?.barcode ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [warehouse, setWarehouse] = useState(item?.warehouse ?? defaultWarehouse ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [quantity, setQuantity] = useState<string>(item?.quantity?.toString() ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [minQuantity, setMinQuantity] = useState<string>(item?.minQuantity?.toString() ?? "");
  const [unitPrice, setUnitPrice] = useState<string>(item?.unitPrice?.toString() ?? "");
  const [photoUrl, setPhotoUrl] = useState<string>(item?.photoUrl ?? "");
  const [expiresAt, setExpiresAt] = useState<string>(toDateInput(item?.expiresAt));
  const [warrantyUntil, setWarrantyUntil] = useState<string>(toDateInput(item?.warrantyUntil));
  const [supplierId, setSupplierId] = useState<string>(item?.supplierId ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setSku(item?.sku ?? "");
      setBarcode(item?.barcode ?? "");
      setCategory(item?.category ?? "");
      setWarehouse(item?.warehouse ?? defaultWarehouse ?? "");
      setLocation(item?.location ?? "");
      setQuantity(item?.quantity?.toString() ?? "");
      setUnit(item?.unit ?? "");
      setMinQuantity(item?.minQuantity?.toString() ?? "");
      setUnitPrice(item?.unitPrice?.toString() ?? "");
      setPhotoUrl(item?.photoUrl ?? "");
      setExpiresAt(toDateInput(item?.expiresAt));
      setWarrantyUntil(toDateInput(item?.warrantyUntil));
      setSupplierId(item?.supplierId ?? "");
      setNotes(item?.notes ?? "");
    }
  }, [open, item, defaultWarehouse]);

  if (!open) return null;

  async function handlePhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await fileToDownscaledDataUrl(file, { maxDim: 800, quality: 0.75 });
      setPhotoUrl(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd zdjęcia", "error");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleSave() {
    if (!name.trim()) {
      showToast("Nazwa jest wymagana", "error");
      return;
    }
    const payload = {
      name: name.trim(),
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      category: category.trim() || null,
      warehouse: warehouse.trim() || null,
      location: location.trim() || null,
      quantity: quantity ? Number(quantity) : null,
      unit: unit.trim() || null,
      minQuantity: minQuantity ? Number(minQuantity) : null,
      unitPrice: unitPrice ? Number(unitPrice) : null,
      photoUrl: photoUrl || null,
      expiresAt: expiresAt || null,
      warrantyUntil: warrantyUntil || null,
      supplierId: supplierId || null,
      notes: notes.trim() || null,
    };
    startTransition(async () => {
      try {
        if (item) await updateStorageItem(item.id, payload);
        else await addStorageItem(payload);
        showToast("Zapisano", "success");
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function handleAdjust(delta: number) {
    if (!item) return;
    startTransition(async () => {
      try {
        const updated = await adjustStorageQuantity(item.id, delta);
        setQuantity(updated.quantity?.toString() ?? "");
        showToast(delta > 0 ? "Przyjęcie +1" : "Wydanie −1", "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function handleDelete() {
    if (!item) return;
    if (!confirm("Usunąć tę pozycję z magazynu?")) return;
    startTransition(async () => {
      try {
        await deleteStorageItem(item.id);
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
            <Field label="Magazyn">
              <input
                type="text"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                placeholder="garaż, magazyn główny…"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="Lokalizacja">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="regał A3, strych, szafa…"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Ilość">
              <div className="flex items-center gap-1">
                {item ? (
                  <button
                    type="button"
                    onClick={() => handleAdjust(-1)}
                    disabled={pending}
                    aria-label="Wydanie"
                    className="p-1.5 rounded border disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    <Minus size={14} />
                  </button>
                ) : null}
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border text-sm text-right tabular-nums"
                  style={inputStyle}
                />
                {item ? (
                  <button
                    type="button"
                    onClick={() => handleAdjust(1)}
                    disabled={pending}
                    aria-label="Przyjęcie"
                    className="p-1.5 rounded border disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    <Plus size={14} />
                  </button>
                ) : null}
              </div>
            </Field>
            <Field label="Jednostka">
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="szt, kg, opak…"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Kategoria">
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="narzędzia, chemia…"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="SKU (wewn.)">
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="kod wewnętrzny"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Kod kreskowy (EAN)">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="5901234123457"
                inputMode="numeric"
                className="w-full px-2 py-1.5 rounded border text-sm tabular-nums"
                style={inputStyle}
              />
            </Field>
            <Field label={`Wartość / szt. (${currency})`}>
              <input
                type="number"
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="np. 49.99"
                className="w-full px-2 py-1.5 rounded border text-sm text-right tabular-nums"
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Termin ważności">
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="Gwarancja do">
              <input
                type="date"
                value={warrantyUntil}
                onChange={(e) => setWarrantyUntil(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </Field>
          </div>

          {pro && suppliers.length > 0 ? (
            <Field label="Dostawca">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              >
                <option value="">— brak —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="Zdjęcie">
            <div className="flex items-center gap-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="w-16 h-16 rounded object-cover border" style={{ borderColor: "var(--border)" }} />
              ) : null}
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files)} />
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {photoUrl ? "Zmień" : "Dodaj zdjęcie"}
              </button>
              {photoUrl ? (
                <button type="button" onClick={() => setPhotoUrl("")} className="text-xs" style={{ color: "var(--accent-red)" }}>
                  Usuń
                </button>
              ) : null}
            </div>
          </Field>

          <Field label="Stan minimalny (uzupełnianie)">
            <input
              type="number"
              step="any"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              placeholder="np. 2"
              className="w-full px-2 py-1.5 rounded border text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Notatki">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 rounded border text-sm resize-none"
              style={inputStyle}
            />
          </Field>

          {pro && item ? (
            <div className="pt-1 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="pt-2">
                <BatchesManager itemId={item.id} />
              </div>
            </div>
          ) : null}

          {item && item.movements.length > 0 ? (
            <div>
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Historia ruchów
              </span>
              <ul className="mt-1 flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                {item.movements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span>
                      {m.reason ?? "ruch"}
                      {m.note ? ` — ${m.note}` : ""}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ color: m.delta >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
                    >
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
              style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}
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
