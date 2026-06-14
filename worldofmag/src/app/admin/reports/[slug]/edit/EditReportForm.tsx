"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Trash2, Columns, Eye, Edit3, HardDrive, Database } from "lucide-react";
import { updateReport, deleteReport } from "@/actions/reports";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";

const CATEGORIES = [
  { value: "architecture", label: "Architektura" },
  { value: "refactoring", label: "Refaktoryzacja" },
  { value: "security", label: "Bezpieczeństwo" },
  { value: "performance", label: "Wydajność" },
  { value: "ux", label: "UX" },
  { value: "proposal", label: "Propozycja" },
  { value: "general", label: "Ogólny" },
  { value: "backlog", label: "🚧 Backlog luk" },
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

interface Props {
  report: { title: string; slug: string; category: string; content: string; storage: "db" | "drive" };
}

export function EditReportForm({ report }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [title, setTitle] = useState(report.title);
  const [category, setCategory] = useState(report.category);
  const [content, setContent] = useState(report.content);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"edit" | "split" | "preview">("edit");
  const previewHtml = useMemo(() => markdownToHtml(content), [content]);

  function handleSave() {
    if (!title.trim() || !content.trim()) {
      setError("Tytuł i treść są wymagane.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateReport(report.slug, { title: title.trim(), category, content: content.trim() });
        router.push(`/admin/reports/${report.slug}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd zapisu");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Usunąć raport? Tej operacji nie można cofnąć.")) return;
    setIsDeleting(true);
    startTransition(async () => {
      try {
        await deleteReport(report.slug);
        router.push("/admin/reports");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd usuwania");
        setIsDeleting(false);
      }
    });
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        <Link
          href={`/admin/reports/${report.slug}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}
        >
          <ArrowLeft size={14} />
          {report.title}
        </Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Edytuj raport
            </h1>
            <span
              title={report.storage === "drive" ? "Treść przechowywana na Dysku Google" : "Treść przechowywana w bazie danych"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                color: report.storage === "drive" ? "var(--accent-green)" : "var(--text-muted)",
              }}
            >
              {report.storage === "drive" ? <HardDrive size={11} /> : <Database size={11} />}
              {report.storage === "drive" ? "Dysk Google" : "Baza"}
            </span>
          </div>
          <button
            onClick={handleDelete}
            disabled={isPending || isDeleting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.4)",
              background: "transparent",
              color: "var(--accent-red)",
              cursor: "pointer",
              opacity: isPending || isDeleting ? 0.5 : 1,
            }}
          >
            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Usuń raport
          </button>
        </div>

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
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
              Kategoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", width: "auto", minWidth: 200 }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                Treść (Markdown)
              </label>
              <div style={{ display: "flex", gap: 2 }}>
                {([["edit", <Edit3 key="e" size={12} />, "Edytor"], ["split", <Columns key="s" size={12} />, "Split"], ["preview", <Eye key="p" size={12} />, "Podgląd"]] as const).map(([mode, icon, label]) => (
                  <button key={mode} onClick={() => setPreviewMode(mode)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: previewMode === mode ? "var(--bg-hover)" : "none", color: previewMode === mode ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer" }}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>
            <style>{MARKDOWN_STYLES}</style>
            <div style={{ display: "flex", gap: 12 }}>
              {previewMode !== "preview" && (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={28}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, flex: 1, minWidth: 0 }}
                />
              )}
              {previewMode !== "edit" && (
                <div
                  style={{ flex: 1, minWidth: 0, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", overflowY: "auto", minHeight: 500 }}
                  dangerouslySetInnerHTML={{ __html: previewHtml || '<p style="color:var(--text-muted);font-size:13px">Wpisz treść po lewej…</p>' }}
                />
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
            <Link
              href={`/admin/reports/${report.slug}`}
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
              disabled={isPending || !title.trim() || !content.trim()}
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
                color: "var(--on-accent)",
                cursor: isPending ? "wait" : "pointer",
                opacity: isPending || !title.trim() || !content.trim() ? 0.6 : 1,
              }}
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Zapisz zmiany
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
