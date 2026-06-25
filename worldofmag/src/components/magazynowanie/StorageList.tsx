"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Warehouse, AlertTriangle, ClipboardList, Camera, ShoppingCart, CalendarClock, ShieldCheck } from "lucide-react";
import { StorageEditSheet } from "./StorageEditSheet";
import { addLowStockToShoppingList, type ExpiringEntry } from "@/actions/storage";
import { useToast } from "@/components/ui/Toast";
import type { StorageItemWithMovements } from "@/actions/storage";
import type { StorageSupplier } from "@prisma/client";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface StorageListProps {
  items: StorageItemWithMovements[];
  lowStock: StorageItemWithMovements[];
  expiring?: ExpiringEntry[];
  shoppingLists: { id: string; name: string }[];
  suppliers?: StorageSupplier[];
  currency?: string;
  pro?: boolean;
}

const NO_WAREHOUSE = "Bez magazynu";

export function StorageList({ items, lowStock, expiring = [], shoppingLists, suppliers = [], currency = "PLN", pro = false }: StorageListProps) {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [activeWarehouse, setActiveWarehouse] = useState<string>("");
  const [editing, setEditing] = useState<{ item: StorageItemWithMovements | null; warehouse?: string } | null>(null);
  const [replenishList, setReplenishList] = useState<string>(shoppingLists[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [focused, setFocused] = useState<number>(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  const warehouses = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) set.add(i.warehouse?.trim() || NO_WAREHOUSE);
    return Array.from(set).sort();
  }, [items]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (q && !`${i.name} ${i.sku ?? ""} ${i.category ?? ""}`.toLowerCase().includes(q)) return false;
      if (activeWarehouse && (i.warehouse?.trim() || NO_WAREHOUSE) !== activeWarehouse) return false;
      return true;
    });
    const map = new Map<string, StorageItemWithMovements[]>();
    for (const i of filtered) {
      const wh = i.warehouse?.trim() || NO_WAREHOUSE;
      if (!map.has(wh)) map.set(wh, []);
      map.get(wh)!.push(i);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items, search, activeWarehouse]);

  // Z-232: częściowy keyset — j/k fokus po głównej liście (pozycje w kolejności
  // wyświetlania, sekcje magazynów spłaszczone), Enter/e = otwórz arkusz edycji,
  // a = dodaj, / = szukaj. Usuń/zmiana ilości są w arkuszu (StorageEditSheet);
  // sekcje „do uzupełnienia"/„terminy" zostają pod myszą.
  const orderedItems = useMemo(() => grouped.flatMap(([, list]) => list), [grouped]);
  const indexOf = useMemo(() => new Map(orderedItems.map((it, idx) => [it.id, idx])), [orderedItems]);

  const shortcutHandlers = useMemo(
    () => ({
      onNavigateDown: () => { if (!editing) setFocused((i) => Math.min(orderedItems.length - 1, i + 1)); },
      onNavigateUp: () => { if (!editing) setFocused((i) => Math.max(0, i - 1)); },
      onEnter: () => { if (!editing && focused >= 0 && orderedItems[focused]) setEditing({ item: orderedItems[focused] }); },
      onEdit: () => { if (!editing && focused >= 0 && orderedItems[focused]) setEditing({ item: orderedItems[focused] }); },
      onQuickAdd: () => { if (!editing) setEditing({ item: null, warehouse: activeWarehouse && activeWarehouse !== NO_WAREHOUSE ? activeWarehouse : undefined }); },
      onSearch: () => { searchRef.current?.focus(); },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderedItems, focused, editing, activeWarehouse]
  );
  useKeyboardShortcuts(shortcutHandlers);

  function handleReplenish() {
    if (!replenishList) {
      showToast("Najpierw utwórz listę zakupów", "error");
      return;
    }
    startTransition(async () => {
      try {
        const { addedItems } = await addLowStockToShoppingList(replenishList);
        showToast(`Dodano ${addedItems.length} pozycji do listy zakupów`, "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd", "error");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
        <Warehouse size={48} style={{ color: "var(--text-muted)" }} />
        <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Magazyn jest pusty
        </h2>
        <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
          Dodaj pozycje ręcznie albo zeskanuj zdjęcie półki, regału czy szafy — AI rozpozna przedmioty i utworzy listę.
        </p>
        <div className="mt-6 flex items-center gap-2">
          <Link
            href="/magazynowanie/scan"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <Camera size={16} /> Skanuj zdjęcie
          </Link>
          <button
            type="button"
            onClick={() => setEditing({ item: null })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-sm"
            style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}
          >
            <Plus size={16} /> Dodaj pozycję
          </button>
        </div>
        {editing ? <StorageEditSheet open onClose={() => setEditing(null)} item={null} suppliers={suppliers} currency={currency} pro={pro} /> : null}
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
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj w magazynie…"
            className="flex-1 bg-transparent border-none outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <Link
          href="/magazynowanie/scan"
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded border text-sm whitespace-nowrap"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          title="Inwentaryzacja ze zdjęcia"
        >
          <Camera size={14} /> Skanuj
        </Link>
        <Link
          href="/magazynowanie/stocktake"
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded border text-sm whitespace-nowrap"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          title="Spis (stocktake)"
        >
          <ClipboardList size={14} /> Spis
        </Link>
        <button
          type="button"
          onClick={() => setEditing({ item: null, warehouse: activeWarehouse && activeWarehouse !== NO_WAREHOUSE ? activeWarehouse : undefined })}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm"
          style={{ backgroundColor: "var(--accent-blue)", color: "#0d0d0d" }}
        >
          <Plus size={16} /> Dodaj
        </button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveWarehouse("")}
          className="px-2.5 py-1 rounded text-xs whitespace-nowrap"
          style={{
            backgroundColor: activeWarehouse === "" ? "var(--accent-blue)" : "var(--bg-surface)",
            color: activeWarehouse === "" ? "#0d0d0d" : "var(--text-secondary)",
          }}
        >
          Wszystko
        </button>
        {warehouses.map((wh) => {
          const isActive = activeWarehouse === wh;
          return (
            <button
              key={wh}
              type="button"
              onClick={() => setActiveWarehouse(wh)}
              className="px-2.5 py-1 rounded text-xs whitespace-nowrap"
              style={{
                backgroundColor: isActive ? "var(--accent-blue)" : "var(--bg-surface)",
                color: isActive ? "#0d0d0d" : "var(--text-secondary)",
              }}
            >
              🏷️ {wh}
            </button>
          );
        })}
      </div>

      {lowStock.length > 0 ? (
        <section
          className="rounded border p-3"
          style={{ borderColor: "var(--accent-amber)", backgroundColor: "rgba(255, 152, 0, 0.06)" }}
        >
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h3
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--accent-amber)" }}
            >
              <AlertTriangle size={12} /> Do uzupełnienia ({lowStock.length})
            </h3>
            <div className="flex items-center gap-1">
              <select
                value={replenishList}
                onChange={(e) => setReplenishList(e.target.value)}
                className="px-1.5 py-1 rounded border text-xs"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                {shoppingLists.length === 0 ? <option value="">brak list</option> : null}
                {shoppingLists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleReplenish}
                disabled={pending || shoppingLists.length === 0}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-amber)", color: "#0d0d0d" }}
              >
                <ShoppingCart size={12} /> Do zakupów
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {lowStock.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setEditing({ item: i })}
                className="flex items-center justify-between text-sm text-left px-2 py-1 rounded"
                style={{ color: "var(--text-primary)" }}
              >
                <span>{i.name}</span>
                <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {i.quantity ?? 0}/{i.minQuantity}{i.unit ? ` ${i.unit}` : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {expiring.length > 0 ? (
        <section
          className="rounded border p-3"
          style={{ borderColor: "var(--accent-red)", backgroundColor: "rgba(244, 67, 54, 0.06)" }}
        >
          <h3
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--accent-red)" }}
          >
            <CalendarClock size={12} /> Terminy i gwarancje ({expiring.length})
          </h3>
          <div className="flex flex-col gap-1">
            {expiring.map((e) => {
              const target = items.find((i) => i.id === e.id) ?? null;
              return (
                <button
                  key={`${e.id}-${e.kind}`}
                  type="button"
                  onClick={() => target && setEditing({ item: target })}
                  className="flex items-center justify-between gap-2 text-sm text-left px-2 py-1 rounded"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span className="flex items-center gap-1.5 min-w-0 truncate">
                    {e.kind === "gwarancja" ? <ShieldCheck size={12} style={{ color: "var(--text-muted)" }} /> : <CalendarClock size={12} style={{ color: "var(--text-muted)" }} />}
                    {e.name}
                    <span style={{ color: "var(--text-muted)" }}>· {e.kind}</span>
                  </span>
                  <span
                    className="text-xs tabular-nums whitespace-nowrap"
                    style={{ color: e.daysLeft < 0 ? "var(--accent-red)" : e.daysLeft <= 7 ? "var(--accent-amber)" : "var(--text-muted)" }}
                  >
                    {e.daysLeft < 0 ? `${-e.daysLeft} dni po` : e.daysLeft === 0 ? "dziś" : `za ${e.daysLeft} dni`}
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
        {grouped.map(([wh, list]) => (
          <section key={wh}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
              🏷️ {wh} ({list.length})
            </h3>
            <ul className="flex flex-col gap-0.5">
              {list.map((i) => {
                const belowMin = i.minQuantity != null && (i.quantity ?? 0) < i.minQuantity;
                const fidx = indexOf.get(i.id) ?? -1;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ item: i })}
                      onMouseEnter={() => setFocused(fidx)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded text-sm text-left"
                      style={{ backgroundColor: focused === fidx ? "var(--bg-elevated)" : "var(--bg-surface)", color: "var(--text-primary)", outline: focused === fidx ? "1px solid var(--border-focus)" : "none" }}
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {i.name}
                        {i.location ? (
                          <span style={{ color: "var(--text-muted)" }}> · {i.location}</span>
                        ) : null}
                      </span>
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {i.quantity != null ? `${i.quantity}${i.unit ? ` ${i.unit}` : ""}` : "—"}
                      </span>
                      {belowMin ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-amber)", color: "#0d0d0d" }}>
                          poniżej min
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
        <StorageEditSheet
          open
          onClose={() => setEditing(null)}
          item={editing.item}
          defaultWarehouse={editing.warehouse ?? null}
          suppliers={suppliers}
          currency={currency}
          pro={pro}
        />
      ) : null}
    </div>
  );
}
