"use client";

import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { RefreshCw, X, RotateCcw, Trash2, ChevronDown } from "lucide-react";
import type { CategoryIconVariantData } from "@/actions/categoryIcons";
import {
  getAllUserIconVariantsFlat,
  saveAndActivateCategoryIcon,
  setActiveCategoryIcon,
  deactivateCategoryIcon,
  deleteCategoryIconVariant,
  upsertCategoryEmojiOverride,
} from "@/actions/categoryIcons";
import { EMOJI_DATA, getCategoryEmojis } from "@/lib/emojiData";

interface CategoryIconPickerProps {
  category: string;
  open: boolean;
  onClose: () => void;
  onSelect: (svgContent: string) => void;
  onReset: () => void;
}

function SvgTile({
  svgContent,
  isActive,
  onClick,
  onDelete,
  label,
}: {
  svgContent: string;
  isActive?: boolean;
  onClick: () => void;
  onDelete?: () => void;
  label?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center gap-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onClick}
        className="w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95"
        style={{
          backgroundColor: hovered || isActive ? "var(--bg-hover)" : "var(--bg-surface)",
          border: `1.5px solid ${isActive ? "var(--accent-blue)" : hovered ? "var(--text-secondary)" : "var(--border)"}`,
        }}
        aria-label="Wybierz ikonę"
      >
        <svg
          viewBox="0 0 24 24"
          width={52}
          height={52}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--text-secondary)" }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </button>
      {label && (
        <span className="text-[9px] truncate w-full text-center" style={{ color: "var(--text-muted)" }}>
          {label === "__library__" ? "—" : label}
        </span>
      )}
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

function EmojiGrid({
  category,
  onSelect,
}: {
  category: string;
  onSelect: (emoji: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const categoryDefaults = getCategoryEmojis(category);

  const allEmoji = EMOJI_DATA.map((e) => e.emoji);

  const filtered = search.trim()
    ? EMOJI_DATA.filter((e) =>
        e.keywords.some((k) => k.includes(search.toLowerCase()))
      ).map((e) => e.emoji)
    : showAll
    ? allEmoji
    : categoryDefaults;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
          placeholder="🔍 Szukaj emoji…"
          className="flex-1 text-xs focus:outline-none rounded-lg px-2 py-1.5"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
        />
        {!search && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg whitespace-nowrap"
            style={{
              backgroundColor: showAll ? "var(--bg-hover)" : "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: showAll ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <ChevronDown size={10} style={{ transform: showAll ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
            {showAll ? "Sugerowane" : `Wszystkie (${allEmoji.length})`}
          </button>
        )}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))", maxHeight: showAll ? 200 : undefined, overflowY: showAll ? "auto" : undefined }}>
        {filtered.length === 0 ? (
          <p className="col-span-8 text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>Brak wyników</p>
        ) : (
          filtered.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="aspect-square rounded-lg flex items-center justify-center transition-colors active:scale-95"
              style={{ fontSize: 22 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
              aria-label={`Wybierz ${emoji}`}
            >
              {emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function CategoryIconPicker({
  category,
  open,
  onClose,
  onSelect,
  onReset,
}: CategoryIconPickerProps) {
  const [allUserIcons, setAllUserIcons] = useState<CategoryIconVariantData[]>([]);
  const [newlyGenerated, setNewlyGenerated] = useState<string[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [showAllMine, setShowAllMine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didInit = useRef(false);
  const newIconsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const categoryIcons = allUserIcons.filter((v) => v.categoryName === category);
  const otherIcons = allUserIcons.filter((v) => v.categoryName !== category);
  const displayedSaved = showAllMine ? allUserIcons : categoryIcons;

  async function loadSaved() {
    setLoadingSaved(true);
    try {
      const variants = await getAllUserIconVariantsFlat();
      setAllUserIcons(variants);
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
      setTimeout(() => {
        newIconsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
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
      setShowAllMine(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSelectEmoji(emoji: string) {
    try {
      await upsertCategoryEmojiOverride(category, emoji);
      await deactivateCategoryIcon(category);
    } catch { /* silent */ }
    setAllUserIcons((prev) => prev.map((v) => v.categoryName === category ? { ...v, isActive: false } : v));
    onReset();
    onClose();
  }

  async function handleSelectSaved(variant: CategoryIconVariantData) {
    onSelect(variant.svgContent);
    try {
      await setActiveCategoryIcon(variant.id);
      setAllUserIcons((prev) => prev.map((v) => ({
        ...v,
        isActive: v.categoryName === category ? v.id === variant.id : v.isActive,
      })));
    } catch { /* server will correct on reload */ }
    onClose();
  }

  async function handleSelectNew(svgContent: string) {
    onSelect(svgContent);
    try {
      const saved = await saveAndActivateCategoryIcon(category, svgContent);
      setNewlyGenerated((prev) => prev.filter((s) => s !== svgContent));
      setAllUserIcons((prev) => [
        { ...saved, createdAt: new Date(saved.createdAt) },
        ...prev.map((v) => v.categoryName === category ? { ...v, isActive: false } : v),
      ]);
    } catch { /* optimistic stays */ }
    onClose();
  }

  async function handleDelete(variant: CategoryIconVariantData) {
    setAllUserIcons((prev) => prev.filter((v) => v.id !== variant.id));
    if (variant.isActive) onReset();
    try {
      await deleteCategoryIconVariant(variant.id);
    } catch {
      setAllUserIcons((prev) =>
        [...prev, variant].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    }
  }

  async function handleReset() {
    onReset();
    try {
      await deactivateCategoryIcon(category);
      setAllUserIcons((prev) => prev.map((v) => v.categoryName === category ? { ...v, isActive: false } : v));
    } catch { /* silent */ }
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl outline-none"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            maxHeight: "min(90vh, 700px)",
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
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 pb-2 space-y-5">

            {/* Section 1: System emoji */}
            <div>
              <SectionLabel label="Systemowe" />
              <EmojiGrid category={category} onSelect={handleSelectEmoji} />
            </div>

            {/* Section 2: User's saved icons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel label={`Moje ikony${categoryIcons.length > 0 ? ` (${categoryIcons.length} dla tej kategorii)` : ""}`} />
                {otherIcons.length > 0 && (
                  <button
                    onClick={() => setShowAllMine((v) => !v)}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: showAllMine ? "var(--bg-hover)" : "transparent",
                      border: "1px solid var(--border)",
                      color: showAllMine ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    <ChevronDown size={10} style={{ transform: showAllMine ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
                    {showAllMine ? "Tylko ta kategoria" : `Wszystkie (${allUserIcons.length})`}
                  </button>
                )}
              </div>
              {loadingSaved ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)}
                </div>
              ) : displayedSaved.length === 0 ? (
                <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>
                  {allUserIcons.length === 0 ? "Brak zapisanych ikon — wygeneruj pierwszą poniżej." : "Brak ikon dla tej kategorii."}
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {displayedSaved.map((variant) => (
                    <SvgTile
                      key={variant.id}
                      svgContent={variant.svgContent}
                      isActive={variant.isActive && variant.categoryName === category}
                      label={showAllMine ? variant.categoryName : undefined}
                      onClick={() => handleSelectSaved(variant)}
                      onDelete={() => handleDelete(variant)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Newly generated */}
            <div ref={newIconsRef}>
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
