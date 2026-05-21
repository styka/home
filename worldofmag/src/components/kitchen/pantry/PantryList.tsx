"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Package, AlertTriangle, ClipboardList } from "lucide-react";
import { PantryEditSheet } from "./PantryEditSheet";
import type { PantryItemWithProduct } from "@/actions/pantry";

interface PantryListProps {
  items: PantryItemWithProduct[];
  expiringSoon: PantryItemWithProduct[];
}

const LOCATION_ICON: Record<string, string> = {
  spiżarnia: "🥫",
  lodówka: "❄️",
  zamrażarka: "🧊",
  przyprawy: "🌿",
  inne: "📦",
};

function formatExpiry(date: Date | null): { text: string; color: string } | null {
  if (!date) return null;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: "przeterminowane", color: "var(--kitchen-expired)" };
  if (diff === 0) return { text: "dziś", color: "var(--kitchen-expired)" };
  if (diff === 1) return { text: "jutro", color: "var(--kitchen-expiring)" };
  if (diff <= 3) return { text: `za ${diff} dni`, color: "var(--kitchen-expiring)" };
  if (diff <= 7) return { text: `za ${diff} dni`, color: "var(--text-secondary)" };
  return { text: d.toLocaleDateString("pl-PL"), color: "var(--text-muted)" };
}

export function PantryList({ items, expiringSoon }: PantryListProps) {
  const [search, setSearch] = useState("");
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [editing, setEditing] = useState<{ item: PantryItemWithProduct | null; location?: string } | null>(null);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false;
      if (activeLocation && (i.location ?? "spiżarnia") !== activeLocation) return false;
      return true;
    });
    const map = new Map<string, PantryItemWithProduct[]>();
    for (const i of filtered) {
      const loc = i.location ?? "spiżarnia";
      if (!map.has(loc)) map.set(loc, []);
      map.get(loc)!.push(i);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items, search, activeLocation]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) set.add(i.location ?? "spiżarnia");
    return Array.from(set).sort();
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
        <Package size={48} style={{ color: "var(--text-muted)" }} />
        <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Spiżarnia jest pusta
        </h2>
        <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
          Dodaj pierwszą pozycję, żeby zacząć śledzić swój zapas. Pozycje ze spiżarni będą automatycznie pomijane przy generowaniu listy zakupów.
        </p>
        <button
          type="button"
          onClick={() => setEditing({ item: null })}
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm"
          style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
        >
          <Plus size={16} /> Dodaj pozycję
        </button>
        {editing ? <PantryEditSheet open onClose={() => setEditing(null)} item={null} /> : null}
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 flex-1 px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj w spiżarni…"
            className="flex-1 bg-transparent border-none outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <Link
          href="/kitchen/pantry/stocktake"
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded border text-sm whitespace-nowrap"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          title="Inwentaryzacja"
        >
          <ClipboardList size={14} /> Stocktake
        </Link>
        <button
          type="button"
          onClick={() => setEditing({ item: null })}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm"
          style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
        >
          <Plus size={16} /> Dodaj
        </button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveLocation("")}
          className="px-2.5 py-1 rounded text-xs whitespace-nowrap"
          style={{
            backgroundColor: activeLocation === "" ? "var(--accent-orange)" : "var(--bg-surface)",
            color: activeLocation === "" ? "#0d0d0d" : "var(--text-secondary)",
          }}
        >
          Wszystko
        </button>
        {locations.map((loc) => {
          const isActive = activeLocation === loc;
          return (
            <button
              key={loc}
              type="button"
              onClick={() => setActiveLocation(loc)}
              className="px-2.5 py-1 rounded text-xs whitespace-nowrap"
              style={{
                backgroundColor: isActive ? "var(--accent-orange)" : "var(--bg-surface)",
                color: isActive ? "#0d0d0d" : "var(--text-secondary)",
              }}
            >
              {LOCATION_ICON[loc] ?? "📦"} {loc}
            </button>
          );
        })}
      </div>

      {expiringSoon.length > 0 ? (
        <section
          className="rounded border p-3"
          style={{ borderColor: "var(--kitchen-expiring)", backgroundColor: "rgba(255, 152, 0, 0.06)" }}
        >
          <h3
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--kitchen-expiring)" }}
          >
            <AlertTriangle size={12} /> Termin ważności ({expiringSoon.length})
          </h3>
          <div className="flex flex-col gap-1">
            {expiringSoon.map((i) => {
              const exp = formatExpiry(i.expiresAt);
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setEditing({ item: i })}
                  className="flex items-center justify-between text-sm text-left px-2 py-1 rounded"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span>
                    {i.name}
                    {i.quantity != null ? (
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}
                        — {i.quantity}{i.unit ? ` ${i.unit}` : ""}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs" style={{ color: exp?.color ?? "var(--text-muted)" }}>
                    {exp?.text}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-4">
        {grouped.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
            Brak pozycji.
          </p>
        ) : null}
        {grouped.map(([loc, list]) => (
          <section key={loc}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
              {LOCATION_ICON[loc] ?? "📦"} {loc} ({list.length})
            </h3>
            <ul className="flex flex-col gap-0.5">
              {list.map((i) => {
                const exp = formatExpiry(i.expiresAt);
                const belowMin = i.minQuantity != null && (i.quantity ?? 0) < i.minQuantity;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ item: i })}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded text-sm text-left"
                      style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                    >
                      <span className="flex-1 min-w-0 truncate">{i.name}</span>
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {i.quantity != null ? `${i.quantity}${i.unit ? ` ${i.unit}` : ""}` : "—"}
                      </span>
                      {belowMin ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--kitchen-expiring)", color: "#0d0d0d" }}>
                          poniżej min
                        </span>
                      ) : null}
                      {exp ? (
                        <span className="text-[10px] tabular-nums" style={{ color: exp.color }}>
                          {exp.text}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {editing ? (
        <PantryEditSheet
          open
          onClose={() => setEditing(null)}
          item={editing.item}
          defaultLocation={editing.location ?? (activeLocation || null)}
        />
      ) : null}
    </div>
  );
}
