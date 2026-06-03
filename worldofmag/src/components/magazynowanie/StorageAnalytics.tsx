"use client";

import { useState } from "react";
import { Sparkles, Loader2, Download, TrendingUp, PackageX, Boxes, Wallet, AlertTriangle } from "lucide-react";
import { llm } from "@/lib/llm-client";
import type { StorageAnalytics as Analytics } from "@/actions/storage";

interface Props {
  analytics: Analytics;
  exportRows: Array<{ name: string; warehouse: string | null; location: string | null; quantity: number; unit: string | null; unitPrice: number | null }>;
}

function fmt(n: number, currency: string) {
  return `${n.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} ${currency}`;
}

export function StorageAnalytics({ analytics, exportRows }: Props) {
  const a = analytics;
  const [tips, setTips] = useState<string[] | null>(null);
  const [loadingTips, setLoadingTips] = useState(false);

  async function loadTips() {
    setLoadingTips(true);
    try {
      const res = await llm.magazynowanie.insights({
        currency: a.currency,
        totalValue: a.totalValue,
        itemCount: a.itemCount,
        lowStockCount: a.lowStockCount,
        deadStockCount: a.deadStockCount,
        topValue: a.abc.slice(0, 5).map((x) => ({ name: x.name, value: x.value })),
        deadStock: a.deadStock.slice(0, 5).map((x) => ({ name: x.name, value: x.value })),
      });
      setTips(res.tips ?? []);
    } finally {
      setLoadingTips(false);
    }
  }

  function exportCsv() {
    const header = ["Nazwa", "Magazyn", "Lokalizacja", "Ilość", "Jednostka", "Cena", "Wartość"];
    const lines = exportRows.map((r) =>
      [r.name, r.warehouse ?? "", r.location ?? "", r.quantity, r.unit ?? "", r.unitPrice ?? "", (r.quantity * (r.unitPrice ?? 0)).toFixed(2)]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `magazyn-wycena-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const maxWhValue = Math.max(1, ...a.valueByWarehouse.map((w) => w.value));
  const maxTrend = Math.max(1, ...a.movementTrend.map((t) => Math.max(t.in, t.out)));

  return (
    <div className="px-4 md:px-6 py-4 max-w-3xl mx-auto flex flex-col gap-5">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi icon={Wallet} label="Wartość magazynu" value={fmt(a.totalValue, a.currency)} color="var(--accent-green)" />
        <Kpi icon={Boxes} label="Pozycji" value={String(a.itemCount)} color="var(--accent-blue)" />
        <Kpi icon={AlertTriangle} label="Poniżej min." value={String(a.lowStockCount)} color="var(--accent-amber)" />
        <Kpi icon={PackageX} label="Martwy zapas" value={String(a.deadStockCount)} color="var(--accent-red)" />
      </div>

      {/* AI wgląd */}
      <section className="rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--accent-purple)" }}>
            <Sparkles size={15} /> Wnioski AI
          </h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <Download size={12} /> CSV
            </button>
            <button type="button" onClick={loadTips} disabled={loadingTips} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-50" style={{ backgroundColor: "var(--accent-purple)", color: "#fff" }}>
              {loadingTips ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Analizuj
            </button>
          </div>
        </div>
        {tips === null ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Kliknij „Analizuj”, by AI podsumowała stan magazynu i rekomendacje.</p>
        ) : tips.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Brak wniosków (lub AI niedostępne).</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--accent-purple)" }}>•</span> {t}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Trend ruchów */}
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          <TrendingUp size={15} /> Ruch (14 dni)
        </h3>
        <div className="flex items-end gap-1 h-28 px-1">
          {a.movementTrend.map((t) => (
            <div key={t.date} className="flex-1 flex flex-col justify-end gap-0.5" title={`${t.date}: +${t.in} / -${t.out}`}>
              <div style={{ height: `${(t.in / maxTrend) * 90}%`, backgroundColor: "var(--accent-green)", borderRadius: 2, minHeight: t.in > 0 ? 2 : 0 }} />
              <div style={{ height: `${(t.out / maxTrend) * 90}%`, backgroundColor: "var(--accent-red)", borderRadius: 2, minHeight: t.out > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: "var(--accent-green)" }} /> przyjęcia</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: "var(--accent-red)" }} /> wydania</span>
        </div>
      </section>

      {/* Wartość wg magazynu */}
      {a.valueByWarehouse.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Wartość wg magazynu</h3>
          <div className="flex flex-col gap-1.5">
            {a.valueByWarehouse.map((w) => (
              <div key={w.warehouse} className="flex items-center gap-2">
                <span className="w-28 text-xs truncate" style={{ color: "var(--text-secondary)" }}>{w.warehouse}</span>
                <div className="flex-1 h-4 rounded overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
                  <div style={{ width: `${(w.value / maxWhValue) * 100}%`, height: "100%", backgroundColor: "var(--accent-blue)" }} />
                </div>
                <span className="w-24 text-right text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(w.value, a.currency)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ABC */}
      {a.abc.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Analiza ABC (Pareto wg wartości)</h3>
          <ul className="flex flex-col gap-0.5">
            {a.abc.slice(0, 12).map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded text-sm" style={{ backgroundColor: "var(--bg-surface)" }}>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: x.klasa === "A" ? "var(--accent-green)" : x.klasa === "B" ? "var(--accent-amber)" : "var(--bg-elevated)", color: x.klasa === "C" ? "var(--text-muted)" : "#0d0d0d" }}>{x.klasa}</span>
                  <span className="truncate" style={{ color: "var(--text-primary)" }}>{x.name}</span>
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(x.value, a.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Martwy zapas */}
      {a.deadStock.length > 0 ? (
        <section>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-2" style={{ color: "var(--accent-red)" }}>
            <PackageX size={15} /> Martwy zapas (bez ruchu)
          </h3>
          <ul className="flex flex-col gap-0.5">
            {a.deadStock.slice(0, 12).map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded text-sm" style={{ backgroundColor: "var(--bg-surface)" }}>
                <span className="truncate" style={{ color: "var(--text-primary)" }}>{x.name}</span>
                <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {x.lastMove ? `od ${x.lastMove.toISOString().slice(0, 10)}` : "brak ruchu"}{x.value > 0 ? ` · ${fmt(x.value, a.currency)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: typeof Wallet; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
      <Icon size={16} style={{ color }} />
      <span className="text-lg font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</span>
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}
