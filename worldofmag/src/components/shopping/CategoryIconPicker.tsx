"use client";

import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { RefreshCw, X, RotateCcw, Trash2 } from "lucide-react";
import type { CategoryIconVariantData } from "@/actions/categoryIcons";
import {
  getCategoryIconVariants,
  saveAndActivateCategoryIcon,
  setActiveCategoryIcon,
  deactivateCategoryIcon,
  deleteCategoryIconVariant,
  upsertCategoryEmojiOverride,
} from "@/actions/categoryIcons";

// Suggested emoji alternatives per category
const CATEGORY_EMOJI_SUGGESTIONS: Record<string, string[]> = {
  "Produce":            ["🥕","🍎","🥦","🧅","🥬","🍅","🫑","🥑"],
  "Dairy & Eggs":       ["🧀","🥛","🧈","🥚","🫙","🍳","🥗"],
  "Meat & Fish":        ["🥩","🍗","🥓","🐟","🦐","🍖","🌭"],
  "Bakery":             ["🍞","🥖","🥐","🧁","🥨","🍩","🥞"],
  "Dry Goods & Pasta":  ["🌾","🍚","🍝","🫘","🥜","🌰","🍜"],
  "Drinks":             ["🍺","🧃","☕","🫖","💧","🍷","🥤"],
  "Frozen":             ["🧊","🍦","❄️","🥶","🍧","🫙"],
  "Snacks & Sweets":    ["🍫","🍬","🍭","🍿","🍪","🧆","🍡"],
  "Condiments & Oils":  ["🫙","🧂","🌶️","🍯","🫚","🥫","🧄"],
  "Spices & Herbs":     ["🌿","🌶️","🧄","🫛","🌱","🍃","🌺"],
  "Cleaning & Hygiene": ["🧴","🧼","🪥","🧻","🫧","🧹","🪣"],
  "Canned & Preserved": ["🥫","🫙","🥡","🧆","🫒"],
  "Other":              ["📦","🛒","🏠","🎁","⚙️","🔑","🌍"],
};

interface CategoryIconPickerProps {
  category: string;
  open: boolean;
  onClose: () => void;
  /** Called with svg string on SVG selection, or empty string on emoji selection */
  onSelect: (svgContent: string) => void;
  onReset: () => void;
}

function SvgTile({
  svgContent,
  isActive,
  onClick,
  onDelete,
}: {
  svgContent: string;
  isActive?: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative aspect-square"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onClick}
        className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95"
        style={{
          backgroundColor: hovered || isActive ? "var(--bg-hover)" : "var(--bg-surface)",
          border: `1.5px solid ${isActive ? "var(--accent-blue)" : hovered ? "var(--text-secondary)" : "var(--border)"}`,
        }}
        aria-label="Wybierz ikonę"
      >
        <svg
          viewBox="0 0 24 24"
          width={36}
          height={36}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--text-secondary)" }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </button>
      {onDelete && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center z-10"
          style={{ width: 18, height: 18, backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          aria-label="Usuń"
        >
          <Trash2 size={10} />
        </button>
      )}
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 6, height: 6, backgroundColor: "var(--accent-blue)" }} />
      )}
    </div>
  );
}

function EmojiTile({ emoji, onClick }: { emoji: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="aspect-square rounded-xl flex items-center justify-center text-xl transition-all duration-150 active:scale-95"
      style={{
        backgroundColor: hovered ? "var(--bg-hover)" : "var(--bg-surface)",
        border: `1.5px solid ${hovered ? "var(--text-secondary)" : "var(--border)"}`,
      }}
      aria-label={`Wybierz ${emoji}`}
    >
      {emoji}
    </button>
  );
}

function SkeletonTile() {
  return <div className="aspect-square rounded-xl animate-pulse" style={{ backgroundColor: "var(--bg-surface)" }} />;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs mb-2 font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
      {label}
    </p>
  );
}

export function CategoryIconPicker({
  category,
  open,
  onClose,
  onSelect,
  onReset,
}: CategoryIconPickerProps) {
  const [savedVariants, setSavedVariants] = useState<CategoryIconVariantData[]>([]);
  const [newlyGenerated, setNewlyGenerated] = useState<string[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didInit = useRef(false);

  const systemEmojis = CATEGORY_EMOJI_SUGGESTIONS[category] ?? ["📦"];

  async function loadSaved() {
    setLoadingSaved(true);
    try {
      const variants = await getCategoryIconVariants(category);
      setSavedVariants(variants);
    } catch { /* silent */ }
    finally { setLoadingSaved(false); }
  }

  async function generateNew() {
    setLoadingNew(true);
    setError(null);
    try {
      const res = await fetch("/api/llm/category-icons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd generowania");
      setNewlyGenerated((prev) => [...prev, ...(data.svgs ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd połączenia");
    } finally {
      setLoadingNew(false);
    }
  }

  useEffect(() => {
    if (open && !didInit.current) {
      didInit.current = true;
      loadSaved();
      generateNew();
    }
    if (!open) {
      didInit.current = false;
      setNewlyGenerated([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSelectEmoji(emoji: string) {
    try {
      await upsertCategoryEmojiOverride(category, emoji);
      await deactivateCategoryIcon(category);
    } catch { /* silent */ }
    setSavedVariants((prev) => prev.map((v) => ({ ...v, isActive: false })));
    onReset(); // clear any SVG override in parent
    onClose();
  }

  async function handleSelectSaved(variant: CategoryIconVariantData) {
    onSelect(variant.svgContent);
    try {
      await setActiveCategoryIcon(variant.id);
      setSavedVariants((prev) => prev.map((v) => ({ ...v, isActive: v.id === variant.id })));
    } catch { /* server will correct on reload */ }
    onClose();
  }

  async function handleSelectNew(svgContent: string) {
    onSelect(svgContent);
    try {
      const saved = await saveAndActivateCategoryIcon(category, svgContent);
      setNewlyGenerated((prev) => prev.filter((s) => s !== svgContent));
      setSavedVariants((prev) => [
        { ...saved, createdAt: new Date(saved.createdAt) },
        ...prev.map((v) => ({ ...v, isActive: false })),
      ]);
    } catch { /* optimistic stays, DB syncs on reload */ }
    onClose();
  }

  async function handleDelete(variant: CategoryIconVariantData) {
    setSavedVariants((prev) => prev.filter((v) => v.id !== variant.id));
    if (variant.isActive) onReset();
    try {
      await deleteCategoryIconVariant(variant.id);
    } catch {
      setSavedVariants((prev) =>
        [...prev, variant].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    }
  }

  async function handleReset() {
    onReset();
    try {
      await deactivateCategoryIcon(category);
      setSavedVariants((prev) => prev.map((v) => ({ ...v, isActive: false })));
    } catch { /* silent */ }
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl outline-none"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            maxHeight: "min(90vh, 640px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
            <Dialog.Title className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Ikona kategorii
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)" }}>
                {category}
              </span>
              <Dialog.Close asChild>
                <button className="rounded-lg p-1.5 transition-colors" style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  aria-label="Zamknij"
                >
                  <X size={14} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-5">

            {/* Section 1: System emoji */}
            <div>
              <SectionLabel label="Systemowe" />
              <div className="grid grid-cols-4 gap-2">
                {systemEmojis.map((emoji) => (
                  <EmojiTile key={emoji} emoji={emoji} onClick={() => handleSelectEmoji(emoji)} />
                ))}
              </div>
            </div>

            {/* Section 2: Saved SVG variants */}
            {(loadingSaved || savedVariants.length > 0) && (
              <div>
                <SectionLabel label="Moje ikony" />
                <div className="grid grid-cols-4 gap-2">
                  {loadingSaved
                    ? Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)
                    : savedVariants.map((variant) => (
                        <SvgTile
                          key={variant.id}
                          svgContent={variant.svgContent}
                          isActive={variant.isActive}
                          onClick={() => handleSelectSaved(variant)}
                          onDelete={() => handleDelete(variant)}
                        />
                      ))}
                </div>
              </div>
            )}

            {/* Section 3: Newly generated */}
            <div>
              <SectionLabel label="Nowe propozycje" />
              {error ? (
                <div className="flex flex-col items-center py-4 gap-2">
                  <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>{error}</p>
                  <button onClick={generateNew} className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    Spróbuj ponownie
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {loadingNew && newlyGenerated.length === 0
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)
                    : newlyGenerated.map((svg, i) => (
                        <SvgTile key={i} svgContent={svg} onClick={() => handleSelectNew(svg)} />
                      ))}
                  {loadingNew && newlyGenerated.length > 0 &&
                    Array.from({ length: 3 }).map((_, i) => <SkeletonTile key={`sk-${i}`} />)}
                  {!loadingNew && newlyGenerated.length === 0 && !error && (
                    <p className="col-span-3 text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>
                      Kliknij „Losuj więcej" by wygenerować ikony
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={generateNew}
              disabled={loadingNew}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              onMouseEnter={(e) => { if (!loadingNew) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
            >
              <RefreshCw size={14} className={loadingNew ? "animate-spin" : ""} />
              Losuj więcej
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-xl py-2.5 px-3.5 text-sm transition-all active:scale-[0.98]"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
              title="Przywróć domyślną ikonę"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline text-xs">Reset</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
