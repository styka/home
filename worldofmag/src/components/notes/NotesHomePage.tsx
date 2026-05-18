"use client";

import Link from "next/link";
import { FileText, ChevronRight, Pin, FolderOpen, Tag } from "lucide-react";
import { AICommandSheet } from "@/components/home/AICommandSheet";

interface RecentNote {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  group: { id: string; name: string } | null;
  createdAt: string;
}

interface NotesHomePageProps {
  recentNotes: RecentNote[];
  totalCount: number;
  pinnedCount: number;
  groupCount: number;
  tagCount: number;
}

export function NotesHomePage({
  recentNotes,
  totalCount,
  pinnedCount,
  groupCount,
  tagCount,
}: NotesHomePageProps) {
  return (
    <>
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        backgroundColor: "var(--bg-base)",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <FileText size={22} style={{ color: "var(--accent-amber)" }} />
            Notatki
          </h1>
          <Link
            href="/notes/all"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Wszystkie notatki
            <ChevronRight size={13} />
          </Link>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <StatTile value={totalCount} label="Notatki" color="var(--accent-amber)" />
          <StatTile value={pinnedCount} label="Przypięte" color="var(--accent-blue)" />
          <StatTile value={groupCount} label="Grupy" color="var(--accent-green)" />
          <StatTile value={tagCount} label="Tagi" color="var(--accent-purple)" />
        </div>

        {/* Recent notes */}
        {recentNotes.length > 0 && (
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Ostatnie notatki
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentNotes.map((note) => (
                <Link
                  key={note.id}
                  href="/notes/all"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    textDecoration: "none",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {note.title || "Bez tytułu"}
                    </span>
                    {note.pinned && (
                      <Pin size={12} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
                    )}
                    <ChevronRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  </div>
                  {note.content && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {note.content.slice(0, 80)}
                    </span>
                  )}
                  {note.group && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {note.group.name}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Management */}
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Zarządzanie
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { href: "/notes/groups", icon: <FolderOpen size={15} />, label: "Grupy" },
              { href: "/notes/tags", icon: <Tag size={15} />, label: "Tagi" },
            ].map(({ href, icon, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "12px 8px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  textDecoration: "none",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  transition: "background 0.1s",
                }}
              >
                <span style={{ color: "var(--accent-amber)" }}>{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
    <AICommandSheet context={["notes"]} placeholder={'Np. "Dodaj notatkę o..." lub "Dopisz do notatki X..."'} />
    </>
  );
}

function StatTile({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <p style={{ fontSize: 24, fontWeight: 700, color, margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, marginTop: 4 }}>
        {label}
      </p>
    </div>
  );
}
