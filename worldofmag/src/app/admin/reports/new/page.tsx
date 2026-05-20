"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { createReport } from "@/actions/reports";

const CATEGORIES = [
  { value: "architecture", label: "Architektura" },
  { value: "refactoring", label: "Refaktoryzacja" },
  { value: "security", label: "Bezpieczeństwo" },
  { value: "performance", label: "Wydajność" },
  { value: "ux", label: "UX" },
  { value: "proposal", label: "Propozycja" },
  { value: "general", label: "Ogólny" },
];

const inputStyle = {
  width: "100%",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
};

export default function NewReportPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("general");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugManuallyEdited) {
      setSlug(
        v
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
      );
    }
  }

  function handleSave() {
    if (!title.trim() || !slug.trim() || !content.trim()) {
      setError("Tytuł, slug i treść są wymagane.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createReport({ title: title.trim(), slug: slug.trim(), category, content: content.trim() });
        router.push("/admin/reports");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd zapisu");
      }
    });
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        <Link
          href="/admin/reports"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}
        >
          <ArrowLeft size={14} />
          Raporty
        </Link>

        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 24 }}>
          Nowy raport
        </h1>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--accent-red)", fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
              Tytuł
            </label>
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Tytuł raportu"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                Slug (URL)
              </label>
              <input
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugManuallyEdited(true); }}
                placeholder="np. moj-raport"
                style={{ ...inputStyle, fontFamily: "monospace" }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                Kategoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
              Treść (Markdown)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Tytuł raportu&#10;&#10;Treść w formacie Markdown..."
              rows={24}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
            <Link
              href="/admin/reports"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              Anuluj
            </Link>
            <button
              onClick={handleSave}
              disabled={isPending || !title.trim() || !slug.trim() || !content.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent-purple)",
                color: "#fff",
                cursor: isPending ? "wait" : "pointer",
                opacity: isPending || !title.trim() || !slug.trim() || !content.trim() ? 0.6 : 1,
              }}
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Zapisz raport
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
