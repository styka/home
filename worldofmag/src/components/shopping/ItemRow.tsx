"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { Trash2, AlertCircle, ChevronRight } from "lucide-react";
import type { Item, ItemStatus } from "@/types";
import { STATUS_CYCLE } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/cn";
import { updateItemStatus, updateItem, deleteItem } from "@/actions/items";

interface ItemRowProps {
  item: Item;
  isFocused: boolean;
  isEditing: boolean;
  onFocus: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
}

export function ItemRow({ item, isFocused, isEditing, onFocus, onStartEdit, onStopEdit, rowRef }: ItemRowProps) {
  const [, startTransition] = useTransition();
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(item.quantity?.toString() ?? "");
  const [editUnit, setEditUnit] = useState(item.unit ?? "");
  const [editNotes, setEditNotes] = useState(item.notes ?? "");
  const editNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditName(item.name);
      setEditQty(item.quantity?.toString() ?? "");
      setEditUnit(item.unit ?? "");
      setEditNotes(item.notes ?? "");
      setTimeout(() => editNameRef.current?.focus(), 10);
    }
  }, [isEditing, item]);

  function cycleStatus() {
    const idx = STATUS_CYCLE.indexOf(item.status as "NEEDED" | "IN_CART" | "DONE");
    const next: ItemStatus = idx === -1 || idx === STATUS_CYCLE.length - 1
      ? STATUS_CYCLE[0]
      : STATUS_CYCLE[idx + 1];
    startTransition(() => { updateItemStatus(item.id, next); });
  }

  function markMissing() {
    startTransition(() => { updateItemStatus(item.id, "MISSING"); });
  }

  function handleDelete() {
    startTransition(() => { deleteItem(item.id); });
  }

  function handleSaveEdit() {
    if (!editName.trim()) { onStopEdit(); return; }
    startTransition(() => {
      updateItem(item.id, {
        name: editName.trim(),
        quantity: editQty ? parseFloat(editQty) : null,
        unit: editUnit.trim() || null,
        notes: editNotes.trim() || null,
      });
    });
    onStopEdit();
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); }
    if (e.key === "Escape") { onStopEdit(); }
  }

  const isDone = item.status === "DONE";
  const isMissing = item.status === "MISSING";

  if (isEditing) {
    return (
      <div
        ref={rowRef}
        className="flex flex-col gap-2 px-4 py-3 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-elevated)",
        }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={editNameRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className="flex-1 bg-transparent mono text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder="Item name"
          />
          <input
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className="w-16 bg-transparent text-xs text-right focus:outline-none"
            style={{ color: "var(--text-secondary)" }}
            placeholder="qty"
            type="number"
          />
          <input
            value={editUnit}
            onChange={(e) => setEditUnit(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className="w-16 bg-transparent text-xs focus:outline-none"
            style={{ color: "var(--text-secondary)" }}
            placeholder="unit"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className="flex-1 bg-transparent text-xs focus:outline-none"
            style={{ color: "var(--text-muted)" }}
            placeholder="Notes... (Enter to save, Esc to cancel)"
          />
          <button
            onClick={handleSaveEdit}
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
          >
            Save
          </button>
          <button
            onClick={onStopEdit}
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      onClick={onFocus}
      onDoubleClick={onStartEdit}
      className={cn(
        "flex items-center gap-3 px-4 py-3 md:py-2.5 border-b cursor-default select-none group",
      )}
      style={{
        borderColor: "var(--border)",
        backgroundColor: isFocused ? "var(--bg-elevated)" : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isFocused) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isFocused) e.currentTarget.style.backgroundColor = "";
      }}
    >
      {/* Status toggle button */}
      <button
        onClick={(e) => { e.stopPropagation(); cycleStatus(); }}
        className="w-5 h-5 md:w-4 md:h-4 rounded border flex-shrink-0 flex items-center justify-center focus:outline-none"
        style={{
          borderColor: isDone
            ? "var(--accent-green)"
            : isMissing
            ? "var(--accent-amber)"
            : isFocused
            ? "var(--border-focus)"
            : "var(--border)",
          backgroundColor: isDone
            ? "rgba(34,197,94,0.2)"
            : isMissing
            ? "rgba(245,158,11,0.2)"
            : "transparent",
        }}
        title="Toggle status (Space)"
      >
        {isDone && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {isMissing && (
          <span style={{ color: "var(--accent-amber)", fontSize: 10, lineHeight: 1 }}>!</span>
        )}
      </button>

      {/* Qty + unit column */}
      <div className="flex-shrink-0 text-right" style={{ width: 72 }}>
        {(item.quantity != null || item.unit) ? (
          <span className="mono text-xs" style={{ color: "var(--text-muted)" }}>
            {item.quantity != null ? item.quantity : ""}{item.unit ? ` ${item.unit}` : ""}
          </span>
        ) : null}
      </div>

      {/* Name column */}
      <div className="flex-1 min-w-0">
        <span
          className={cn("mono text-sm", isDone && "line-through")}
          style={{ color: isDone ? "var(--text-muted)" : "var(--text-primary)" }}
        >
          {item.name}
        </span>
        {item.notes && (
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {item.notes}
          </div>
        )}
      </div>

      {/* Priority indicator */}
      {item.priority > 0 && (
        <ChevronRight
          size={14}
          style={{ color: item.priority >= 2 ? "var(--accent-red)" : "var(--accent-amber)", flexShrink: 0 }}
        />
      )}

      {/* Status badge */}
      <StatusBadge status={item.status} />

      {/* Action buttons — visible on focus/hover */}
      {isFocused && (
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={(e) => { e.stopPropagation(); markMissing(); }}
            className="p-1 rounded focus:outline-none"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-amber)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            title="Mark as missing"
          >
            <AlertCircle size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            className="p-1 rounded focus:outline-none"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            title="Edit (e)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2L12 4.5L5 11.5H2.5V9L9.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="p-1 rounded focus:outline-none"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            title="Delete (d)"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
