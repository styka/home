"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, Shield, KeyRound, Loader2 } from "lucide-react";
import { getAuditLog, type AuditEntry } from "@/actions/access";
import type { KeysetPage } from "@/lib/pagination";

const CAT_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  rbac: { label: "RBAC", icon: <Shield size={13} />, color: "var(--accent-purple)" },
  config: { label: "Konfiguracja", icon: <KeyRound size={13} />, color: "var(--accent-amber)" },
};

type Tab = "all" | "rbac" | "config";

export function AuditLogPage({ page: initial }: { page: KeysetPage<AuditEntry> }) {
  const [entries, setEntries] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [tab, setTab] = useState<Tab>("all");
  const [pending, startTransition] = useTransition();

  function switchTab(next: Tab) {
    setTab(next);
    startTransition(async () => {
      const p = await getAuditLog(next === "all" ? undefined : { category: next });
      setEntries(p.items);
      setCursor(p.nextCursor);
      setHasMore(p.hasMore);
    });
  }

  function loadMore() {
    startTransition(async () => {
      const p = await getAuditLog({ category: tab === "all" ? undefined : tab, cursor });
      setEntries((prev) => [...prev, ...p.items]);
      setCursor(p.nextCursor);
      setHasMore(p.hasMore);
    });
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} /> Admin
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Shield size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Dziennik audytu</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Zmiany uprawnień (RBAC) i konfiguracji systemu — kto, co i kiedy.
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["all", "rbac", "config"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                border: "1px solid var(--border)",
                background: tab === t ? "var(--bg-elevated)" : "transparent",
                color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {t === "all" ? "Wszystko" : CAT_META[t].label}
            </button>
          ))}
          {pending && <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)", alignSelf: "center" }} />}
        </div>

        {entries.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Brak wpisów audytu.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {entries.map((e) => {
              const meta = CAT_META[e.category] ?? { label: e.category, icon: <Shield size={13} />, color: "var(--text-muted)" };
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                  <span style={{ color: meta.color, flexShrink: 0, marginTop: 2 }} title={meta.label}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{e.detail ?? e.action}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      <span className="mono">{e.action}</span>
                      {e.actorEmail ? ` · ${e.actorEmail}` : ""}
                      {" · "}
                      {new Date(e.createdAt).toLocaleString("pl-PL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <button
              onClick={loadMore}
              disabled={pending}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px",
                borderRadius: 8, fontSize: 12, cursor: pending ? "default" : "pointer",
                border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)",
              }}
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : null} Załaduj starsze
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
