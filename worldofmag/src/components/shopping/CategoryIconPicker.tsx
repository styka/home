"use client";

import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { RefreshCw, X, RotateCcw } from "lucide-react";

interface CategoryIconPickerProps {
  category: string;
  open: boolean;
  onClose: () => void;
  onSelect: (svgContent: string) => void;
  onReset: () => void;
}

export function CategoryIconPicker({
  category,
  open,
  onClose,
  onSelect,
  onReset,
}: CategoryIconPickerProps) {
  const [svgs, setSvgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const didGenerate = useRef(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/llm/category-icons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd generowania");
      setSvgs(data.svgs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd połączenia");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !didGenerate.current) {
      didGenerate.current = true;
      generate();
    }
    if (!open) {
      didGenerate.current = false;
      setSvgs([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSelect(svgContent: string) {
    onSelect(svgContent);
    onClose();
  }

  function handleReset() {
    onReset();
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 shadow-2xl outline-none"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Ikona kategorii
            </Dialog.Title>
            <div className="flex items-center gap-1">
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)" }}>
                {category}
              </span>
              <Dialog.Close asChild>
                <button
                  className="ml-1 rounded-lg p-1.5 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  aria-label="Zamknij"
                >
                  <X size={14} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Icon grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl animate-pulse"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  />
                ))
              : error
              ? (
                  <div className="col-span-3 flex flex-col items-center justify-center py-8 gap-3">
                    <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
                      {error}
                    </p>
                    <button
                      onClick={generate}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      Spróbuj ponownie
                    </button>
                  </div>
                )
              : svgs.map((svgContent, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(svgContent)}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="aspect-square rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95"
                    style={{
                      backgroundColor: hoveredIdx === i ? "var(--bg-hover)" : "var(--bg-surface)",
                      border: `1.5px solid ${hoveredIdx === i ? "var(--text-primary)" : "var(--border)"}`,
                    }}
                    aria-label={`Ikona ${i + 1}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="44"
                      height="44"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: hoveredIdx === i ? "var(--text-primary)" : "var(--text-secondary)" }}
                      dangerouslySetInnerHTML={{ __html: svgContent }}
                    />
                  </button>
                ))}
          </div>

          {/* Footer actions */}
          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Losuj więcej
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3.5 text-sm transition-all active:scale-[0.98]"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
              title="Przywróć domyślną ikonę"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
