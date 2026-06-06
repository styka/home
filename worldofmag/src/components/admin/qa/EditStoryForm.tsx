"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import { createStory, updateStory } from "@/actions/qa";

interface Props {
  mode: "create" | "edit";
  epicSlug: string;
  epicTitle: string;
  initial?: { slug: string; title: string; description: string | null; order: number };
}

export function EditStoryForm({ mode, epicSlug, epicTitle, initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) {
      setError("Tytuł jest wymagany");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createStory({ title, epicSlug, description, order, slug: slug || undefined });
        } else {
          await updateStory(initial!.slug, { title, description, order });
        }
        router.push("/admin/qa");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd");
      }
    });
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/admin/qa"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}
        >
          <ArrowLeft size={14} /> QA admin
        </Link>

        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
          {mode === "create" ? "Nowa User Story" : `Edycja: ${initial!.title}`}
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 24px" }}>
          Epic: <strong>{epicTitle}</strong>
        </p>

        {error && <div style={errBox}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Tytuł">
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} autoFocus />
          </Field>

          {mode === "create" && (
            <Field label="Slug (opcjonalnie — auto z tytułu)">
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="story-..." style={inputStyle} />
            </Field>
          )}

          <Field label="Opis (krótki)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          <Field label="Kolejność (mniejsze = wyżej)">
            <input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 0)} style={{ ...inputStyle, maxWidth: 100 }} />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
            <Link href="/admin/qa" style={cancelBtn}>Anuluj</Link>
            <button onClick={handleSave} disabled={isPending || !title.trim()} style={saveBtn(isPending || !title.trim())}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Zapisz
            </button>
          </div>
        </div>
      </div>
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
