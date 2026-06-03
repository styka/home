"use client";

import { useEffect, useState, useTransition } from "react";
import { Layers, Plus, Trash2, ArrowUpFromLine, Loader2, AlertTriangle } from "lucide-react";
import { getStorageItem, addBatch, deleteBatch, issueByFEFO } from "@/actions/storage";
import { useToast } from "@/components/ui/Toast";
import type { StorageBatch } from "@prisma/client";

const inputStyle: React.CSSProperties = { backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" };

/**
 * Zarządzanie partiami/seriami pozycji (tryb pro). Samodzielnie doczytuje partie
 * z serwera. Wydanie FEFO zdejmuje z partii o najwcześniejszej dacie ważności.
 */
export function BatchesManager({ itemId }: { itemId: string }) {
  const { showToast } = useToast();
  const [batches, setBatches] = useState<StorageBatch[] | null>(null);
  const [pending, startTransition] = useTransition();

  const [lotNo, setLotNo] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [qty, setQty] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [issueQty, setIssueQty] = useState("");

  async function reload() {
    const detail = await getStorageItem(itemId);
    setBatches(detail?.batches ?? []);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  function add() {
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      showToast("Podaj ilość partii", "error");
      return;
    }
    startTransition(async () => {
      try {
        await addBatch(itemId, { lotNo: lotNo || null, serialNo: serialNo || null, quantity: q, expiresAt: expiresAt || null });
        setLotNo(""); setSerialNo(""); setQty(""); setExpiresAt("");
        await reload();
        showToast("Dodano partię", "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function removeBatch(id: string) {
    startTransition(async () => {
      try {
        await deleteBatch(id);
        await reload();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  function fefo() {
    const q = Number(issueQty);
    if (!Number.isFinite(q) || q <= 0) {
      showToast("Podaj ilość do wydania", "error");
      return;
    }
    startTransition(async () => {
      try {
        await issueByFEFO(itemId, q, "wydanie FEFO");
        setIssueQty("");
        await reload();
        showToast("Wydano wg FEFO", "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  const now = Date.now();

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        <Layers size={12} /> Partie / serie (FEFO)
      </span>

      {batches === null ? (
        <div className="flex items-center gap-2 text-xs py-2" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={13} className="animate-spin" /> Wczytuję…
        </div>
      ) : batches.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Brak partii. Dodaj, by śledzić daty ważności i wydawać wg FEFO.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {batches.map((b) => {
            const expSoon = b.expiresAt && b.expiresAt.getTime() - now < 30 * 86_400_000;
            return (
              <li key={b.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: "var(--bg-elevated)" }}>
                <span className="min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                  {b.lotNo || b.serialNo || "partia"}
                  {b.expiresAt ? (
                    <span style={{ color: expSoon ? "var(--accent-red)" : "var(--text-muted)" }}>
                      {" "}· do {b.expiresAt.toISOString().slice(0, 10)}{expSoon ? " ⚠" : ""}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>{b.quantity}</span>
                  <button type="button" onClick={() => removeBatch(b.id)} disabled={pending} aria-label="Usuń partię" style={{ color: "var(--text-muted)" }}><Trash2 size={12} /></button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Dodaj partię */}
      <div className="grid grid-cols-[1fr_1fr] gap-1.5">
        <input value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="Nr partii" className="px-2 py-1.5 rounded border text-xs" style={inputStyle} />
        <input value={serialNo} onChange={(e) => setSerialNo(e.target.value)} placeholder="Nr seryjny" className="px-2 py-1.5 rounded border text-xs" style={inputStyle} />
        <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" step="any" placeholder="Ilość" className="px-2 py-1.5 rounded border text-xs text-right tabular-nums" style={inputStyle} />
        <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} type="date" className="px-2 py-1.5 rounded border text-xs" style={inputStyle} />
      </div>
      <button type="button" onClick={add} disabled={pending} className="self-start inline-flex items-center gap-1 text-xs px-2 py-1 rounded border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--accent-blue)" }}>
        <Plus size={12} /> Dodaj partię
      </button>

      {/* Wydanie FEFO */}
      {batches && batches.length > 0 ? (
        <div className="flex items-center gap-1.5 mt-1">
          <input value={issueQty} onChange={(e) => setIssueQty(e.target.value)} type="number" step="any" placeholder="Ilość" className="w-20 px-2 py-1.5 rounded border text-xs text-right tabular-nums" style={inputStyle} />
          <button type="button" onClick={fefo} disabled={pending} className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded disabled:opacity-50" style={{ backgroundColor: "var(--accent-red)", color: "#0d0d0d" }}>
            <ArrowUpFromLine size={12} /> Wydaj FEFO
          </button>
          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <AlertTriangle size={10} /> zdejmie z najwcześniej wygasającej
          </span>
        </div>
      ) : null}
    </div>
  );
}
