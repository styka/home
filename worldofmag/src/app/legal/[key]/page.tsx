export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { getLegalDoc } from "@/lib/legal/documents";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default async function LegalDocPage({ params }: { params: { key: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const doc = getLegalDoc(params.key);
  if (!doc) notFound();

  const html = markdownToHtml(doc.markdown);

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <style>{MARKDOWN_STYLES}</style>

      <div style={{
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-surface)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <Link href="/legal" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={14} /> Dokumenty
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{doc.title}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>wersja {doc.version}</span>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {doc.draft ? (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", marginBottom: 18,
            background: "color-mix(in srgb, var(--accent-amber) 12%, transparent)",
            border: "1px solid var(--accent-amber)", borderRadius: 8, color: "var(--accent-amber)", fontSize: 13,
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Wersja robocza — dokument wymaga weryfikacji prawnej przed publicznym startem.</span>
          </div>
        ) : null}
        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
