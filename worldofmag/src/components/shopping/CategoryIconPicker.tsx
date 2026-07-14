"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw, RotateCcw, Trash2, ChevronDown, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { CategoryIconVariantData } from "@/actions/categoryIcons";
import {
  getAllUserIconVariantsFlat,
  saveAndActivateCategoryIcon,
  setActiveCategoryIcon,
  deactivateCategoryIcon,
  deleteCategoryIconVariant,
  upsertCategoryEmojiOverride,
} from "@/actions/categoryIcons";
import dynamic from "next/dynamic";
import { Theme } from "emoji-picker-react";
import { IconDisplay } from "@/components/shopping/IconDisplay";
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface CategoryIconPickerProps {
  category: string;
  open: boolean;
  onClose: () => void;
  /** Called with svg string (SVG) or emoji character; parent uses isSvg() to distinguish */
  onSelect: (value: string) => void;
  onReset: () => void;
}

const isSvg = (s: string) => s.trimStart().startsWith("<");

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
        <IconDisplay content={svgContent} size={52} />
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


export function CategoryIconPicker({ category, open, onClose, onSelect, onReset }: CategoryIconPickerProps) {
  const [allUserIcons, setAllUserIcons] = useState<CategoryIconVariantData[]>([]);
  const [newlyGenerated, setNewlyGenerated] = useState<string[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [showAllMine, setShowAllMine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [additionalText, setAdditionalText] = useState("");
  const [loadingHints, setLoadingHints] = useState(false);
  const didInit = useRef(false);
  const newIconsRef = useRef<HTMLDivElement>(null);

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
        body: JSON.stringify({ category, additionalText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd generowania");
      setNewlyGenerated((prev) => [...prev, ...(data.svgs ?? [])]);
      setTimeout(() => newIconsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd połączenia");
    } finally {
      setLoadingNew(false);
    }
  }

  async function fetchHints() {
    if (!category) return;
    setLoadingHints(true);
    try {
      const res = await fetch("/api/llm/category-hints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (res.ok && data.hints) setAdditionalText(data.hints);
    } catch { /* silent */ }
    finally { setLoadingHints(false); }
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
    // Save to DB
    try {
      await upsertCategoryEmojiOverride(category, emoji);
      await deactivateCategoryIcon(category);
    } catch { /* silent */ }
    // Update local icon state (deactivate SVG variants)
    setAllUserIcons((prev) => prev.map((v) => v.categoryName === category ? { ...v, isActive: false } : v));
    // Notify parent with emoji string — parent uses isSvg() to distinguish SVG from emoji
    onSelect(emoji);
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
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={
        <span className="flex items-center gap-2">
          Ikona kategorii
          <span className="text-xs px-2 py-0.5 rounded-full font-normal" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)" }}>
            {category}
          </span>
        </span>
      }
      footer={
        <div className="space-y-3" style={{ width: "100%" }}>
          {/* Additional text hint */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>
              Dodatkowe wskazówki dla generatora (opcjonalnie)
            </label>
            <div className="flex gap-1.5">
              <input
                value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
                placeholder="np. owoce tropikalne, intensywne kolory…"
                className="flex-1 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
              />
              {category && (
                <button
                  onClick={fetchHints}
                  disabled={loadingHints}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-40 shrink-0"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { if (!loadingHints) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
                  title="Wygeneruj podpowiedzi"
                >
                  <Sparkles size={11} className={loadingHints ? "animate-pulse" : ""} />
                  Sugeruj
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
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
        </div>
      }
    >
      {/* Section 1: Emoji */}
      <div>
        <SectionLabel label="Systemowe" />
        <div style={{ borderRadius: 12, overflow: "hidden" }}>
          <EmojiPicker
            onEmojiClick={(emojiData) => void handleSelectEmoji(emojiData.emoji)}
            theme={Theme.DARK}
            searchPlaceholder="Szukaj emoji…"
            width="100%"
            height={300}
            previewConfig={{ showPreview: false }}
            lazyLoadEmojis
            style={{ "--epr-bg-color": "var(--bg-surface)", "--epr-category-label-bg-color": "var(--bg-surface)", "--epr-search-border-color": "var(--border)" } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Section 2: User icons */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel label={`Moje ikony${categoryIcons.length > 0 ? ` (${categoryIcons.length})` : ""}`} />
          {otherIcons.length > 0 && (
            <button
              onClick={() => setShowAllMine((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg"
              style={{ backgroundColor: showAllMine ? "var(--bg-hover)" : "transparent", border: "1px solid var(--border)", color: showAllMine ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              <ChevronDown size={10} style={{ transform: showAllMine ? "rotate(180deg)" : undefined }} />
              {showAllMine ? "Tylko ta kategoria" : `Wszystkie (${allUserIcons.length})`}
            </button>
          )}
        </div>
        {loadingSaved ? (
          <div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)}</div>
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

      {/* Section 3: Generated */}
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
            {loadingNew && newlyGenerated.length > 0 && Array.from({ length: 3 }).map((_, i) => <SkeletonTile key={`sk-${i}`} />)}
            {!loadingNew && newlyGenerated.length === 0 && !error && (
              <p className="col-span-3 text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>
                Kliknij „Losuj więcej” by wygenerować ikony
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
