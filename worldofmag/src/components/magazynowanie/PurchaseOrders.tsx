"use client";

import { useState, useTransition } from "react";
import { Plus, ShoppingBag, Sparkles, Loader2, Copy, Mail, Trash2, X, ChevronDown, ChevronRight } from "lucide-react";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  type PurchaseOrderWithLines,
} from "@/actions/storage";
import { llm } from "@/lib/llm-client";
import { useToast } from "@/components/ui/Toast";
import type { StorageSupplier } from "@prisma/client";

const inputStyle: React.CSSProperties = { backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" };

const STATUS_LABEL: Record<string, string> = { draft: "Szkic", sent: "Wysłane", received: "Przyjęte" };

interface LowItem { name: string; deficit: number; unit: string | null }

export function PurchaseOrders({
  orders,
  suppliers,
  lowStock,
}: {
  orders: PurchaseOrderWithLines[];
  suppliers: StorageSupplier[];
  lowStock: LowItem[];
}) {
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          <ShoppingBag size={20} style={{ color: "var(--accent-blue)" }} /> Zamówienia
        </h2>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm" style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}>
          <Plus size={16} /> Nowe
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Brak zamówień. Utwórz pierwsze — możesz zasiać je brakami magazynowymi.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} expanded={expanded === o.id} onToggle={() => setExpanded(expanded === o.id ? null : o.id)} onToast={showToast} />
          ))}
        </ul>
      )}

      {creating ? (
        <OrderCreator suppliers={suppliers} lowStock={lowStock} onClose={() => setCreating(false)} onToast={showToast} />
      ) : null}
    </div>
  );
}

function OrderRow({
  order,
  expanded,
  onToggle,
  onToast,
}: {
  order: PurchaseOrderWithLines;
  expanded: boolean;
  onToggle: () => void;
  onToast: (m: string, t: "success" | "error") => void;
}) {
  const [draft, setDraft] = useState(order.draftText ?? "");
  const [drafting, setDrafting] = useState(false);
  const [pending, startTransition] = useTransition();

  async function generate() {
    setDrafting(true);
    try {
      const res = await llm.magazynowanie.orderDraft({
        supplier: order.supplier?.name,
        lines: order.lines.map((l) => ({ name: l.name, quantity: l.quantity, unit: l.unit })),
      });
      if (res.unavailable || !res.text) {
        onToast("AI niedostępne", "error");
        return;
      }
      setDraft(res.text);
      startTransition(async () => {
        await updatePurchaseOrder(order.id, { draftText: res.text });
      });
    } finally {
      setDrafting(false);
    }
  }

  function setStatus(status: "draft" | "sent" | "received") {
    startTransition(async () => {
      try {
        await updatePurchaseOrder(order.id, { status });
        onToast("Zaktualizowano", "success");
      } catch (e) {
        onToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function remove() {
    if (!confirm("Usunąć zamówienie?")) return;
    startTransition(async () => {
      await deletePurchaseOrder(order.id);
    });
  }

  const mailto = order.supplier?.email
    ? `mailto:${order.supplier.email}?subject=${encodeURIComponent("Zamówienie")}&body=${encodeURIComponent(draft)}`
    : null;

  return (
    <li className="rounded border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        {expanded ? <ChevronDown size={15} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {order.supplier?.name ?? "Bez dostawcy"} · {order.lines.length} poz.
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{order.date.toISOString().slice(0, 10)}</div>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}>{STATUS_LABEL[order.status] ?? order.status}</span>
      </button>

      {expanded ? (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t" style={{ borderColor: "var(--border)" }}>
          <ul className="mt-2 flex flex-col gap-0.5">
            {order.lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between text-sm" style={{ color: "var(--text-secondary)" }}>
                <span>{l.name}</span>
                <span className="tabular-nums text-xs">{l.quantity}{l.unit ? ` ${l.unit}` : ""}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(["draft", "sent", "received"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} disabled={pending} className="px-2 py-1 rounded text-xs border disabled:opacity-50" style={{ borderColor: order.status === s ? "var(--accent-blue)" : "var(--border)", color: order.status === s ? "var(--accent-blue)" : "var(--text-secondary)" }}>
                {STATUS_LABEL[s]}
              </button>
            ))}
            <button type="button" onClick={generate} disabled={drafting} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs disabled:opacity-50" style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}>
              {drafting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Redaguj AI
            </button>
            <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ color: "var(--accent-red)" }}>
              <Trash2 size={12} /> Usuń
            </button>
          </div>

          {draft ? (
            <div className="flex flex-col gap-1.5">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="px-2 py-1.5 rounded border text-sm resize-y" style={inputStyle} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(draft); onToast("Skopiowano", "success"); }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <Copy size={12} /> Kopiuj
                </button>
                {mailto ? (
                  <a href={mailto} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <Mail size={12} /> Wyślij mailem
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function OrderCreator({
  suppliers,
  lowStock,
  onClose,
  onToast,
}: {
  suppliers: StorageSupplier[];
  lowStock: LowItem[];
  onClose: () => void;
  onToast: (m: string, t: "success" | "error") => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Array<{ name: string; quantity: string; unit: string }>>([{ name: "", quantity: "1", unit: "" }]);
  const [pending, startTransition] = useTransition();

  function seedFromLowStock() {
    if (lowStock.length === 0) {
      onToast("Brak braków magazynowych", "error");
      return;
    }
    setLines(lowStock.map((l) => ({ name: l.name, quantity: String(l.deficit || 1), unit: l.unit ?? "" })));
  }

  function setLine(i: number, patch: Partial<{ name: string; quantity: string; unit: string }>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function save() {
    const clean = lines.map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity) || 0, unit: l.unit.trim() || null })).filter((l) => l.name);
    if (clean.length === 0) {
      onToast("Dodaj przynajmniej jedną pozycję", "error");
      return;
    }
    startTransition(async () => {
      try {
        await createPurchaseOrder({ supplierId: supplierId || null, lines: clean });
        onToast("Utworzono zamówienie", "success");
        onClose();
      } catch (e) {
        onToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full md:w-[480px] md:rounded border p-4 flex flex-col gap-3 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", borderTopLeftRadius: 12, borderTopRightRadius: 12 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Nowe zamówienie</h3>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
        </div>

        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="px-3 py-2 rounded border text-sm" style={inputStyle}>
          <option value="">— dostawca (opcjonalnie) —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <button type="button" onClick={seedFromLowStock} className="self-start text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--accent-amber)", color: "var(--accent-amber)" }}>
          Zasiej brakami ({lowStock.length})
        </button>

        <div className="flex flex-col gap-1.5">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="Nazwa" className="flex-1 px-2 py-1.5 rounded border text-sm" style={inputStyle} />
              <input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} type="number" step="any" className="w-16 px-2 py-1.5 rounded border text-sm text-right tabular-nums" style={inputStyle} />
              <input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} placeholder="szt" className="w-14 px-2 py-1.5 rounded border text-sm" style={inputStyle} />
            </div>
          ))}
          <button type="button" onClick={() => setLines((ls) => [...ls, { name: "", quantity: "1", unit: "" }])} className="self-start inline-flex items-center gap-1 text-xs" style={{ color: "var(--accent-blue)" }}>
            <Plus size={13} /> Dodaj pozycję
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>Anuluj</button>
          <button onClick={save} disabled={pending} className="px-3 py-1.5 rounded text-sm disabled:opacity-50" style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}>Utwórz</button>
        </div>
      </div>
    </div>
  );
}
