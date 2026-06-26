"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Camera, Plus, Loader2, Trash2, FileScan } from "lucide-react";
import { createDocument, deleteDocument, type StorageDocumentWithLines } from "@/actions/storage";
import { llm } from "@/lib/llm-client";
import { fileToDownscaledDataUrl } from "@/lib/image-utils";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { StorageSupplier } from "@prisma/client";

const inputStyle: React.CSSProperties = { backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" };

type DocType = "PZ" | "WZ" | "faktura";
interface DraftLine { name: string; quantity: string; unit: string; unitPrice: string }

export function DocumentsPage({
  documents,
  suppliers,
  currency,
}: {
  documents: StorageDocumentWithLines[];
  suppliers: StorageSupplier[];
  currency: string;
}) {
  const { showToast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<DocType>("faktura");
  const [number, setNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ name: "", quantity: "1", unit: "", unitPrice: "" }]);
  const [applyToStock, setApplyToStock] = useState(true);
  const [pending, startTransition] = useTransition();

  function openBlank() {
    setType("faktura");
    setNumber("");
    setSupplierId("");
    setLines([{ name: "", quantity: "1", unit: "", unitPrice: "" }]);
    setApplyToStock(true);
    setEditorOpen(true);
  }

  async function handleScan(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      const res = await llm.magazynowanie.document(dataUrl);
      if (res.error) {
        showToast(res.error, "error");
        return;
      }
      setType("faktura");
      setNumber(res.number ?? "");
      const matched = res.supplier ? suppliers.find((s) => s.name.toLowerCase() === res.supplier!.toLowerCase()) : null;
      setSupplierId(matched?.id ?? "");
      const docLines = res.lines ?? [];
      setLines(
        docLines.length > 0
          ? docLines.map((l) => ({ name: l.name, quantity: String(l.quantity), unit: l.unit ?? "", unitPrice: l.unitPrice != null ? String(l.unitPrice) : "" }))
          : [{ name: "", quantity: "1", unit: "", unitPrice: "" }]
      );
      setApplyToStock(true);
      setEditorOpen(true);
      showToast(`Rozpoznano ${docLines.length} pozycji`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Błąd skanu", "error");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function save() {
    const clean = lines
      .map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity) || 0, unit: l.unit.trim() || null, unitPrice: l.unitPrice ? Number(l.unitPrice) : null }))
      .filter((l) => l.name);
    if (clean.length === 0) {
      showToast("Dodaj przynajmniej jedną pozycję", "error");
      return;
    }
    startTransition(async () => {
      try {
        await createDocument({ type, number: number.trim() || null, supplierId: supplierId || null, lines: clean, applyToStock });
        showToast(applyToStock ? "Zapisano i zaksięgowano na stan" : "Zapisano dokument", "success");
        setEditorOpen(false);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Usunąć dokument? (stan nie zostanie cofnięty)")) return;
    startTransition(async () => {
      await deleteDocument(id);
    });
  }

  return (
    <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          <FileText size={20} style={{ color: "var(--accent-blue)" }} /> Dokumenty
        </h2>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleScan(e.target.files)} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={scanning} className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--accent-purple)" }}>
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <FileScan size={15} />} Skanuj
          </button>
          <button type="button" onClick={openBlank} className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm" style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}>
            <Plus size={16} /> Nowy
          </button>
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Zeskanuj zdjęcie faktury lub WZ — AI odczyta pozycje, a Ty jednym kliknięciem zaksięgujesz je na stan.
      </p>

      {documents.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Brak dokumentów.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: d.type === "WZ" ? "var(--accent-red)" : "var(--accent-green)", color: "#0d0d0d" }}>{d.type}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {d.number || "—"}{d.supplier ? ` · ${d.supplier.name}` : ""}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {d.date.toISOString().slice(0, 10)} · {d.lines.length} poz.{d.totalCost ? ` · ${d.totalCost.toFixed(2)} ${currency}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => remove(d.id)} aria-label="Usuń" style={{ color: "var(--text-muted)" }}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}

      {editorOpen ? (
        <Modal
          wide
          onClose={() => setEditorOpen(false)}
          title="Dokument magazynowy"
          footer={
            <>
              <button onClick={() => setEditorOpen(false)} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>Anuluj</button>
              <button onClick={save} disabled={pending} className="px-3 py-1.5 rounded text-sm disabled:opacity-50" style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}>
                {pending ? "Zapisuję…" : "Zapisz"}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            {(["PZ", "faktura", "WZ"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className="px-2 py-1.5 rounded text-sm border" style={{ borderColor: type === t ? "var(--accent-blue)" : "var(--border)", color: type === t ? "var(--accent-blue)" : "var(--text-secondary)" }}>
                {t === "PZ" ? "Przyjęcie (PZ)" : t === "WZ" ? "Wydanie (WZ)" : "Faktura"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Numer dokumentu" className="px-3 py-2 rounded border text-sm" style={inputStyle} />
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="px-3 py-2 rounded border text-sm" style={inputStyle}>
              <option value="">— dostawca —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[1fr_3.5rem_3rem_4rem] gap-1.5 text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              <span>Nazwa</span><span className="text-right">Ilość</span><span>Jedn.</span><span className="text-right">Cena</span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_3.5rem_3rem_4rem] gap-1.5">
                <input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="Nazwa" className="px-2 py-1.5 rounded border text-sm" style={inputStyle} />
                <input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} type="number" step="any" className="px-1.5 py-1.5 rounded border text-sm text-right tabular-nums" style={inputStyle} />
                <input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} placeholder="szt" className="px-1.5 py-1.5 rounded border text-sm" style={inputStyle} />
                <input value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} type="number" step="any" placeholder="0" className="px-1.5 py-1.5 rounded border text-sm text-right tabular-nums" style={inputStyle} />
              </div>
            ))}
            <button type="button" onClick={() => setLines((ls) => [...ls, { name: "", quantity: "1", unit: "", unitPrice: "" }])} className="self-start inline-flex items-center gap-1 text-xs" style={{ color: "var(--accent-blue)" }}>
              <Plus size={13} /> Pozycja
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={applyToStock} onChange={(e) => setApplyToStock(e.target.checked)} className="w-4 h-4" />
            Zaksięguj na stan ({type === "WZ" ? "zdejmij" : "dodaj"} ilości)
          </label>
        </Modal>
      ) : null}
    </div>
  );
}
