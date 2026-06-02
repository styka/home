"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Loader2, Plus, Trash2, Save } from "lucide-react";
import { llm } from "@/lib/llm-client";
import { bulkAddStorageItems } from "@/actions/storage";
import { useToast } from "@/components/ui/Toast";

const MAX_DIM = 1400;
const JPEG_QUALITY = 0.82;

// Downscale po stronie klienta — zdjęcie służy tylko do rozpoznania przez AI
// (nie zapisujemy go w bazie), więc utrzymujemy rozsądny rozmiar requestu.
function fileToDownscaledDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Nie udało się wczytać obrazu"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Brak kontekstu canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface ScannedItem {
  name: string;
  quantity: string;
  unit: string;
  category: string;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-elevated)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export function StorageScan() {
  const router = useRouter();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, startSaving] = useTransition();
  const [rows, setRows] = useState<ScannedItem[] | null>(null);
  const [warehouse, setWarehouse] = useState("");
  const [location, setLocation] = useState("");

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      const res = await llm.magazynowanie.scan(dataUrl);
      if (res.error) {
        showToast(res.error, "error");
        return;
      }
      const items = res.items ?? [];
      if (items.length === 0) {
        showToast("Nie rozpoznano żadnych przedmiotów", "info");
        return;
      }
      setRows(
        items.map((i) => ({
          name: i.name,
          quantity: i.quantity != null ? String(i.quantity) : "",
          unit: i.unit ?? "",
          category: i.category ?? "",
        }))
      );
      showToast(`Rozpoznano ${items.length} pozycji — sprawdź i zapisz`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd skanowania", "error");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateRow(idx: number, patch: Partial<ScannedItem>) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)) : prev));
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  }

  function handleSave() {
    if (!rows || rows.length === 0) return;
    const items = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        quantity: r.quantity ? Number(r.quantity) : null,
        unit: r.unit.trim() || null,
        category: r.category.trim() || null,
      }));
    if (items.length === 0) {
      showToast("Brak pozycji do zapisania", "error");
      return;
    }
    startSaving(async () => {
      try {
        const count = await bulkAddStorageItems(items, {
          warehouse: warehouse.trim() || null,
          location: location.trim() || null,
        });
        showToast(`Dodano ${count} pozycji`, "success");
        router.push("/magazynowanie");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd zapisu", "error");
      }
    });
  }

  return (
    <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.push("/magazynowanie")}
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} /> Magazyn
        </button>
        {rows && rows.length > 0 ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}
          >
            <Save size={14} /> {saving ? "Zapisuję…" : `Zapisz (${rows.length})`}
          </button>
        ) : null}
      </div>

      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Inwentaryzacja ze zdjęcia
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Zrób lub wybierz zdjęcie półki, regału, szafy czy garażu. AI rozpozna przedmioty, a Ty
        poprawisz listę przed zapisem.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded border text-sm disabled:opacity-50 mb-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
      >
        {scanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        {scanning ? "Rozpoznaję…" : rows ? "Zeskanuj kolejne zdjęcie" : "Zrób / wybierz zdjęcie"}
      </button>

      {rows ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Magazyn</span>
              <input
                type="text"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                placeholder="garaż, magazyn główny…"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Lokalizacja</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="regał A3, strych…"
                className="w-full px-2 py-1.5 rounded border text-sm"
                style={inputStyle}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            {rows.map((r, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded border"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
              >
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => updateRow(idx, { name: e.target.value })}
                  placeholder="nazwa"
                  className="flex-1 min-w-0 px-2 py-1 rounded border text-sm"
                  style={inputStyle}
                />
                <input
                  type="number"
                  step="any"
                  value={r.quantity}
                  onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                  placeholder="ilość"
                  className="w-16 px-2 py-1 rounded border text-sm text-right tabular-nums"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={r.unit}
                  onChange={(e) => updateRow(idx, { unit: e.target.value })}
                  placeholder="jedn."
                  className="w-14 px-2 py-1 rounded border text-sm"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label="Usuń"
                  className="p-1.5"
                  style={{ color: "var(--accent-red)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRows([...rows, { name: "", quantity: "", unit: "", category: "" }])}
            className="mt-2 inline-flex items-center gap-1 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plus size={14} /> Dodaj wiersz
          </button>
        </>
      ) : null}
    </div>
  );
}
