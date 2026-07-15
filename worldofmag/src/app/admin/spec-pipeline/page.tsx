export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  GitBranch,
  ChevronLeft,
  Sparkles,
  Map,
  ListChecks,
  Hammer,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { AdminDocsViewer } from "@/components/admin/AdminDocsViewer";
import {
  SPEC_PIPELINE_DOCS,
  SPEC_PIPELINE_GENERATED_AT,
} from "@/generated/spec-pipeline";

const STAGES: {
  cmd: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { cmd: "/specify", label: "Specyfikacja", desc: "Pomysł → co i po co (kryteria akceptacji)", icon: <Sparkles size={16} />, color: "var(--accent-purple)" },
  { cmd: "/plan", label: "Plan", desc: "Spec → jak (migracja, akcje, RBAC, UI)", icon: <Map size={16} />, color: "var(--accent-blue)" },
  { cmd: "/tasks", label: "Zadania", desc: "Plan → lista kroków (łatwe → trudne)", icon: <ListChecks size={16} />, color: "var(--accent-blue)" },
  { cmd: "/implement", label: "Implementacja", desc: "Wykonanie zadań + commity", icon: <Hammer size={16} />, color: "var(--accent-amber)" },
  { cmd: "/verify", label: "Weryfikacja", desc: "Zachowanie vs kryteria + bramki", icon: <CheckCircle2 size={16} />, color: "var(--accent-green)" },
  { cmd: "/review", label: "Recenzja", desc: "Poprawność + konwencje → werdykt", icon: <Eye size={16} />, color: "var(--accent-green)" },
];

export default async function AdminSpecPipelinePage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} />
          Admin
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <GitBranch size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Spec-Driven Pipeline
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, marginTop: 4, lineHeight: 1.7 }}>
          Powtarzalny sposób budowania kolejnych modyfikacji Omnii z Claude Code: najpierw{" "}
          <strong style={{ color: "var(--text-primary)" }}>co i po co</strong>, potem{" "}
          <strong style={{ color: "var(--text-primary)" }}>jak</strong>, potem kroki — a na końcu{" "}
          <strong style={{ color: "var(--text-primary)" }}>weryfikacja i recenzja</strong>. Wzorowany na{" "}
          <strong style={{ color: "var(--text-primary)" }}>GitHub Spec Kit</strong>, dostosowany do Omnii.
          Uruchamiasz go <strong style={{ color: "var(--text-primary)" }}>jedną komendą</strong>{" "}
          <code style={{ fontFamily: "monospace" }}>/specify</code>: pytania pojawiają się tylko{" "}
          <strong style={{ color: "var(--text-primary)" }}>raz</strong> (na starcie, z wyraźnie
          oznaczoną odpowiedzią rekomendowaną), a kolejne etapy{" "}
          <strong style={{ color: "var(--text-primary)" }}>przechodzą automatycznie</strong> aż do merge
          do <code style={{ fontFamily: "monospace" }}>develop</code>. Komendy i agenty żyją w katalogu{" "}
          <code style={{ fontFamily: "monospace" }}>.claude/</code>; artefakty każdej zmiany lądują w{" "}
          <code style={{ fontFamily: "monospace" }}>specs/&lt;NNN-slug&gt;/</code>.
        </p>

        {/* Flow strip */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 10,
          marginBottom: 28,
        }}>
          {STAGES.map((s, i) => (
            <div key={s.cmd} style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ color: s.color, display: "flex" }}>{s.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {i + 1}.
                </span>
                <code style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                  {s.cmd}
                </code>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {s.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Full guide + constitution (baked from .claude/spec-pipeline/*.md) */}
        <AdminDocsViewer docs={SPEC_PIPELINE_DOCS} generatedAt={SPEC_PIPELINE_GENERATED_AT} />
      </div>
    </div>
  );
}
