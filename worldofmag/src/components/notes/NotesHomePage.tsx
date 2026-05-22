"use client";

import Link from "next/link";
import { FileText, ChevronRight, Pin, FolderOpen, Tag, Plus, LayoutList } from "lucide-react";
import { PageHeader, StatTile, SectionHeading, ManagementGrid, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";

interface RecentNote {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  group: { id: string; name: string } | null;
  createdAt: string;
}

interface PinnedNote {
  id: string;
  title: string;
  content: string;
  group: { id: string; name: string } | null;
}

interface NotesHomePageProps {
  recentNotes: RecentNote[];
  pinnedNotes: PinnedNote[];
  totalCount: number;
  pinnedCount: number;
  groupCount: number;
  tagCount: number;
}

export function NotesHomePage({
  recentNotes,
  pinnedNotes,
  totalCount,
  pinnedCount,
  groupCount,
  tagCount,
}: NotesHomePageProps) {
  const subtitle =
    totalCount === 0
      ? "Zacznij od stworzenia pierwszej notatki"
      : pinnedCount > 0
      ? `${totalCount} ${pluralizePolish(totalCount, "notatka", "notatki", "notatek")} · ${pinnedCount} przypięte`
      : `${totalCount} ${pluralizePolish(totalCount, "notatka", "notatki", "notatek")}`;

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<FileText size={22} />}
          iconColor="var(--accent-amber)"
          title="Notatki"
          subtitle={subtitle}
          action={
            <Link
              href="/notes/all?new=1"
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
              <Plus size={13} />
              Nowa notatka
            </Link>
          }
        />

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <StatTile value={totalCount} label="Notatki" color="var(--accent-amber)" href="/notes/all" />
          <StatTile
            value={pinnedCount}
            label="Przypięte"
            color={pinnedCount > 0 ? "var(--accent-blue)" : "var(--text-muted)"}
            icon={<Pin size={14} />}
            href="/notes/all?pinned=1"
          />
          <StatTile value={groupCount} label="Grupy" color="var(--accent-green)" href="/notes/groups" />
          <StatTile value={tagCount} label="Tagi" color="var(--accent-purple)" href="/notes/tags" />
        </div>

        {/* Pinned notes */}
        {pinnedNotes.length > 0 && (
          <div>
            <SectionHeading>Przypięte</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pinnedNotes.map((note) => (
                <NoteRow key={note.id} id={note.id} title={note.title} content={note.content} group={note.group} pinned />
              ))}
            </div>
          </div>
        )}

        {/* Recent notes */}
        <div>
          <SectionHeading
            action={
              <Link
                href="/notes/all"
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                Wszystkie <ChevronRight size={11} />
              </Link>
            }
          >
            Ostatnie notatki
          </SectionHeading>
          {recentNotes.length === 0 ? (
            <EmptyState
              icon={<FileText size={28} />}
              message="Brak notatek"
              hint="Zacznij od pierwszej notatki — może być krótka"
              cta={{ label: "+ Nowa notatka", href: "/notes/all?new=1", color: "var(--accent-amber)" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  id={note.id}
                  title={note.title}
                  content={note.content}
                  group={note.group}
                  pinned={note.pinned}
                />
              ))}
            </div>
          )}
        </div>

        {/* Management */}
        <div>
          <SectionHeading>Zarządzanie</SectionHeading>
          <ManagementGrid
            items={[
              { href: "/notes/all", icon: <LayoutList size={16} />, label: "Wszystkie", color: "var(--accent-amber)" },
              { href: "/notes/groups", icon: <FolderOpen size={16} />, label: "Grupy", color: "var(--accent-amber)" },
              { href: "/notes/tags", icon: <Tag size={16} />, label: "Tagi", color: "var(--accent-amber)" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function NoteRow({
  id,
  title,
  content,
  group,
  pinned,
}: {
  id: string;
  title: string;
  content: string;
  group: { id: string; name: string } | null;
  pinned?: boolean;
}) {
  return (
    <Link
      href={`/notes/all?focus=${id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        textDecoration: "none",
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
        e.currentTarget.style.borderColor = "var(--border-focus)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
        e.currentTarget.style.borderColor = "var(--border)";
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
            minWidth: 0,
          }}
        >
          {title || "Bez tytułu"}
        </span>
        {pinned && <Pin size={12} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />}
        <ChevronRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      </div>
      {content && (
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {content.slice(0, 100)}
        </span>
      )}
      {group && (
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <FolderOpen size={10} />
          {group.name}
        </span>
      )}
    </Link>
  );
}

function pluralizePolish(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
