"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUpDown } from "lucide-react";
import type { SortMode, StoreWithGraph } from "@/types";

interface SortControlProps {
  sortMode: SortMode;
  stores: StoreWithGraph[];
  onChange: (mode: SortMode) => void;
}

function sortLabel(mode: SortMode): string {
  if (mode.type === "category") return "Kategoria A-Z";
  if (mode.type === "product") return "Produkt A-Z";
  return `🏪 ${mode.storeName}`;
}

export function SortControl({ sortMode, stores, onChange }: SortControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(mode: SortMode) {
    onChange(mode);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
        style={{
          backgroundColor: "var(--bg-elevated)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <ArrowUpDown size={12} />
        <span className="hidden sm:inline">{sortLabel(sortMode)}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded min-w-[160px] py-1"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <DropItem
            label="Kategoria A-Z"
            active={sortMode.type === "category"}
            onClick={() => select({ type: "category" })}
          />
          <DropItem
            label="Produkt A-Z"
            active={sortMode.type === "product"}
            onClick={() => select({ type: "product" })}
          />
          {stores.length > 0 && (
            <>
              <div
                className="mx-2 my-1"
                style={{ borderTop: "1px solid var(--border)" }}
              />
              {stores.map(s => (
                <DropItem
                  key={s.id}
                  label={`🏪 ${s.name}`}
                  active={sortMode.type === "store" && sortMode.storeId === s.id}
                  onClick={() => select({ type: "store", storeId: s.id, storeName: s.name })}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DropItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs"
      style={{
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        backgroundColor: active ? "var(--bg-hover)" : "transparent",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = active ? "var(--bg-hover)" : "transparent"; }}
    >
      {label}
    </button>
  );
}
