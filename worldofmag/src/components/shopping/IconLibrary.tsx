"use client";

import { useState, useRef } from "react";
import { Trash2, Plus, RefreshCw, X, FolderOpen, FolderSymlink } from "lucide-react";
import Link from "next/link";
import type { CategoryIconVariantData } from "@/actions/categoryIcons";
import { deleteCategoryIconVariant, saveToLibrary, assignIconToCategory } from "@/actions/categoryIcons";
import { getCategoryHints } from "@/lib/categoryIconHints";

interface IconLibraryProps {
  initialIcons: CategoryIconVariantData[];
  allCategories: string[];
}

function SvgTile({
  variant,
  allCategories,
  onDelete,
  onAssigned,
}: {
  variant: CategoryIconVariantData;
  allCategories: string[];
  onDelete: () => void;
  onAssigned: (categoryName: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

  async function handleAssign(cat: string) {
    setAssigning(true);
    setAssignOpen(false);
    try {
      await assignIconToCategory(variant.id, cat);
      onAssigned(cat);
    } catch { /* silent */ }
    finally { setAssigning(false); }
  }

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setAssignOpen(false); }}
    >
      <div
        className="w-full aspect-square rounded-xl flex items-center justify-center"
        style={{
          backgroundColor: hovered ? "var(--bg-hover)" : "var(--bg-surface)",
          border: `1.5px solid ${hovered ? "var(--text-secondary)" : "var(--border)"}`,
          transition: "background-color 0.1s, border-color 0.1s",
          opacity: assigning ? 0.5 : 1,
        }}
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
          dangerouslySetInnerHTML={{ __html: variant.svgContent }}
        />
      </div>
      <span
        className="text-[9px] truncate w-full text-center px-0.5"
        style={{ color: "var(--text-muted)" }}
        title={variant.categoryName === "__library__" ? undefined : variant.categoryName}
      >
        {variant.categoryName === "__library__" ? "—" : variant.categoryName}
      </span>

      {/* Hover actions */}
      {hovered && !assigning && (
        <>
          <button
            onClick={onDelete}
            className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center z-10"
            style={{ width: 18, height: 18, backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            aria-label="Usuń"
          >
            <Trash2 size={10} />
          </button>
          <button
            onClick={() => setAssignOpen((v) => !v)}
            className="absolute -top-1.5 -left-1.5 rounded-full flex items-center justify-center z-10"
            style={{ width: 18, height: 18, backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-blue)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            aria-label="Przypisz do kategorii"
            title="Przypisz do kategorii"
          >
            <FolderSymlink size={10} />
          </button>
        </>
      )}

      {/* Category assignment dropdown */}
      {assignOpen && (
        <div
          className="absolute z-20 rounded-lg shadow-xl"
          style={{
            top: "100%",
            left: 0,
            marginTop: 4,
            minWidth: 160,
            maxWidth: 200,
            maxHeight: 200,
            overflowY: "auto",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); setAssignOpen(false); }}
        >
          <p className="text-[10px] px-2 pt-2 pb-1 font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Przypisz do kategorii
          </p>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleAssign(cat)}
              className="w-full text-left px-2 py-1.5 text-xs"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-full aspect-square rounded-xl animate-pulse" style={{ backgroundColor: "var(--bg-surface)" }} />
      <div className="h-2.5 w-10 rounded animate-pulse" style={{ backgroundColor: "var(--bg-surface)" }} />
    </div>
  );
}

function GeneratorDialog({ onSaved }: { onSaved: (icon: CategoryIconVariantData) => void }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [additionalText, setAdditionalText] = useState("");
  const [detail, setDetail] = useState(50);
  const [generated, setGenerated] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const newRef = useRef<HTMLDivElement>(null);

  function handleThemeChange(val: string) {
    setTheme(val);
    const hints = getCategoryHints(val.trim());
    if (hints) setAdditionalText(hints);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/llm/category-icons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: theme.trim(), detail, additionalText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd generowania");
      setGenerated((prev) => [...prev, ...(data.svgs ?? [])]);
      setTimeout(() => newRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd połączenia");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(svg: string) {
    setSaving(svg);
    try {
      const saved = await saveToLibrary(svg, theme.trim() || undefined);
      onSaved(saved);
      setGenerated((prev) => prev.filter((s) => s !== svg));
    } catch { /* silent */ }
    finally { setSaving(null); }
  }

  function handleClose() {
    setOpen(false);
    setTheme("");
    setAdditionalText("");
    setGenerated([]);
    setError(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-[0.98]"
        style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
      >
        <Plus size={14} />
        Generuj nowe
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div
            className="relative w-[calc(100vw-32px)] max-w-[480px] rounded-2xl shadow-2xl"
            style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", maxHeight: "min(90vh, 680px)", display: "flex", flexDirection: "column" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Generuj ikony</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Kliknij wygenerowaną ikonę by zapisać do biblioteki</p>
              </div>
              <button onClick={handleClose} className="rounded-lg p-1.5" style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                <X size={14} />
              </button>
            </div>

            {/* Controls */}
            <div className="px-5 pb-3 space-y-2 shrink-0">
              <div className="flex gap-2">
                <input
                  value={theme}
                  onChange={(e) => handleThemeChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generate()}
                  placeholder="Temat / kategoria (opcjonalnie)"
                  className="flex-1 text-sm focus:outline-none rounded-xl px-3 py-2"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
                />
                <button
                  onClick={generate}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
                >
                  <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                  Generuj
                </button>
              </div>
              <input
                value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
                placeholder="Dodatkowe wskazówki (opcjonalnie)…"
                className="w-full text-xs focus:outline-none rounded-lg px-2.5 py-1.5"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Szczegółowość</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {detail <= 30 ? "Bardzo proste" : detail <= 70 ? "Standardowe" : "Szczegółowe"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>Proste</span>
                  <input type="range" min={0} max={100} value={detail} onChange={(e) => setDetail(Number(e.target.value))} className="flex-1 accent-blue-500" style={{ height: 4 }} />
                  <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>Szczegółowe</span>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {error && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>{error}</p>}
              {loading && generated.length === 0 ? (
                <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)}</div>
              ) : generated.length > 0 ? (
                <div ref={newRef}>
                  <div className="grid grid-cols-3 gap-2">
                    {generated.map((svg, i) => {
                      const isSaving = saving === svg;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSave(svg)}
                          disabled={isSaving}
                          className="aspect-square rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                          style={{ backgroundColor: "var(--bg-surface)", border: "1.5px solid var(--border)" }}
                          onMouseEnter={(e) => { if (!isSaving) { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--text-secondary)"; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                        >
                          <svg viewBox="0 0 24 24" width={52} height={52} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: svg }} />
                        </button>
                      );
                    })}
                    {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonTile key={`sk-${i}`} />)}
                  </div>
                </div>
              ) : !loading && !error ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
                  Wpisz temat lub wskazówki i kliknij „Generuj"
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function IconLibrary({ initialIcons, allCategories }: IconLibraryProps) {
  const [icons, setIcons] = useState(initialIcons);

  function handleDelete(id: string) {
    setIcons((prev) => prev.filter((v) => v.id !== id));
    deleteCategoryIconVariant(id).catch(() => { /* revert not needed, reload corrects */ });
  }

  function handleSaved(icon: CategoryIconVariantData) {
    setIcons((prev) => [icon, ...prev]);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Biblioteka ikon
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {icons.length} {icons.length === 1 ? "ikona" : icons.length < 5 ? "ikony" : "ikon"} — hover by zarządzać
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/shopping/icons/categories"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-all"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          >
            <FolderOpen size={12} />
            Przypisania
          </Link>
          <GeneratorDialog onSaved={handleSaved} />
        </div>
      </div>

      {/* Grid */}
      {icons.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          <p className="text-sm mb-1">Brak ikon w bibliotece</p>
          <p className="text-xs">Kliknij „Generuj nowe" by dodać pierwsze ikony</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
          {icons.map((variant) => (
            <SvgTile
              key={variant.id}
              variant={variant}
              allCategories={allCategories}
              onDelete={() => handleDelete(variant.id)}
              onAssigned={(cat) => {
                // Optimistic: update label to show assigned category
                setIcons((prev) => prev.map((v) => v.id === variant.id ? { ...v, categoryName: cat } : v));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
