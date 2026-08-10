"use client";

import { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}

export function SearchBar({ value, onChange, onClose }: SearchBarProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b"
      style={{ borderColor: "var(--accent-blue)", backgroundColor: "var(--bg-elevated)" }}
    >
      <Search size={14} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { onChange(""); onClose(); }
        }}
        placeholder="Search items…"
        className="flex-1 bg-transparent mono text-sm focus:outline-none"
        style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
      />
      {value && (
        <button
          onClick={() => { onChange(""); onClose(); }}
          className="focus:outline-none"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={14} />
        </button>
      )}
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        <kbd>Esc</kbd> to close
      </span>
    </div>
  );
}
