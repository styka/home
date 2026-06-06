"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Loader2, ArrowLeft, Eye, Code } from "lucide-react";
import { createScenario, updateScenario } from "@/actions/qa";
import { SCENARIO_TYPES, PRIORITIES, getScenarioTypeLabel, getPriorityLabel } from "@/lib/qaConstants";

const TEMPLATE = `## Warunki wstępne

- Jesteś zalogowany jako użytkownik z dostępem do modułu
- ...

## Kroki

1. Otwórz ...
2. Kliknij ...
3. ...

## Oczekiwany rezultat

- ...
- ...

## Notatki

> ...
`;

interface Props {
  mode: "create" | "edit";
  storySlug: string;
  storyTitle: string;
  epicTitle: string;
  initial?: { slug: string; title: string; type: string; priority: string; content: string; order: number };
}

export function EditScenarioForm({ mode, storySlug, storyTitle, epicTitle, initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState(initial?.type ?? "positive");
  const [priority, setPriority] = useState(initial?.priority ?? "P1");
  const [content, setContent] = useState(initial?.content ?? TEMPLATE);
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  async function togglePreview() {
    if (!showPreview) {
      const { markdownToHtml } = await import("@/lib/markdown");
      setPreviewHtml(markdownToHtml(content));
    }
    setShowPreview((v) => !v);
  }

  function handleSave() {
    if (!title.trim() || !content.trim()) {
      setError("Tytuł i treść są wymagane");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createScenario({ title, storySlug, type, priority, content, order, slug: slug || undefined });
        } else {
          await updateScenario(initial!.slug, { title, type, priority, content, order });
        }
        router.push("/admin/qa");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd");
      }
    });
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link
          href="/admin/qa"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}
        >
          <ArrowLeft size={14} /> QA admin
        </Link>

        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
          {mode === "create" ? "Nowy scenariusz" : `Edycja: ${initial!.title}`}
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 24px" }}>
          {epicTitle} › <strong>{storyTitle}</strong>
        </p>

        {error && <div style={errBox}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Tytuł">
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} autoFocus />
          </Field>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Field label="Typ">
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, cursor: "pointer", minWidth: 160 }}>
                {SCENARIO_TYPES.map((t) => <option key={t} value={t}>{getScenarioTypeLabel(t)}</option>)}
              </select>
            </Field>
            <Field label="Priorytet">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...inputStyle, cursor: "pointer", minWidth: 180 }}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{getPriorityLabel(p)}</option>)}
              </select>
            </Field>
            <Field label="Kolejność">
              <input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 0)} style={{ ...inputStyle, maxWidth: 90 }} />
            </Field>
          </div>

          {mode === "create" && (
            <Field label="Slug (opcjonalnie — auto z tytułu)">
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="scenario-..." style={inputStyle} />
            </Field>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={labelStyle}>Treść (Markdown)</label>
              <button
                onClick={togglePreview}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "pointer",
                }}
              >
                {showPreview ? <><Code size={11} /> Edytuj</> : <><Eye size={11} /> Podgląd</>}
              </button>
            </div>
            {showPreview ? (
              <div
                className="md-content"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                style={{ minHeight: 300, padding: 16, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}
              />
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={26}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
              />
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
            <Link href="/admin/qa" style={cancelBtn}>Anuluj</Link>
            <button onClick={handleSave} disabled={isPending || !title.trim() || !content.trim()} style={saveBtn(isPending || !title.trim() || !content.trim())}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Zapisz
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .md-content h2 { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 16px 0 8px; }
        .md-content p, .md-content li { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
        .md-content ul, .md-content ol { padding-left: 20px; margin: 8px 0; }
        .md-content code { background: var(--bg-elevated); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
        .md-content table { border-collapse: collapse; margin: 8px 0; font-size: 12px; }
        .md-content th, .md-content td { border: 1px solid var(--border); padding: 4px 8px; color: var(--text-secondary); }
        .md-content blockquote { border-left: 3px solid var(--accent-amber); padding-left: 12px; margin: 8px 0; color: var(--text-muted); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 14, outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6,
};
const cancelBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", textDecoration: "none",
};
const saveBtn = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent-red)", color: "var(--on-accent)", cursor: disabled ? "wait" : "pointer", opacity: disabled ? 0.6 : 1,
});
const errBox: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--accent-red)", fontSize: 13, marginBottom: 20,
};
