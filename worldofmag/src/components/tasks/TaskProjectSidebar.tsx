"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Inbox, CalendarClock, AlertCircle, CalendarDays, Loader2, Pencil, Trash2 } from "lucide-react";
import { createTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import type { TaskProject } from "@/types";

interface TaskProjectSidebarProps {
  projects: TaskProject[];
  currentProjectId: string;
}

const VIRTUAL_VIEWS = [
  { id: "today", label: "Dziś", icon: <CalendarClock size={15} /> },
  { id: "upcoming", label: "Nadchodzące", icon: <CalendarDays size={15} /> },
  { id: "overdue", label: "Zaległe", icon: <AlertCircle size={15} /> },
];

export function TaskProjectSidebar({ projects, currentProjectId }: TaskProjectSidebarProps) {
  const pathname = usePathname();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [hovered, setHovered] = useState<string | null>(null);

  const inbox = projects.find((p) => p.isInbox);
  const regularProjects = projects.filter((p) => !p.isInbox);

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createTaskProject(newName.trim());
      setNewName("");
      setIsAdding(false);
    });
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Usunąć projekt i wszystkie zadania?")) return;
    startTransition(() => deleteTaskProject(id));
  }

  function NavItem({ id, label, icon, count }: { id: string; label: string; icon?: React.ReactNode; count?: number }) {
    const isActive = currentProjectId === id || pathname === `/tasks/${id}`;
    return (
      <Link
        href={`/tasks/${id}`}
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded text-sm group"
        style={{
          backgroundColor: isActive ? "var(--bg-elevated)" : hovered === id ? "var(--bg-hover)" : undefined,
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        <span style={{ flexShrink: 0 }}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{count}</span>
        )}
        {!VIRTUAL_VIEWS.find((v) => v.id === id) && id !== inbox?.id && hovered === id && (
          <button
            onClick={(e) => handleDelete(id, e)}
            className="opacity-60 hover:opacity-100 focus:outline-none"
            style={{ color: "var(--accent-red)" }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </Link>
    );
  }

  return (
    <aside
      className="hidden md:flex flex-col h-full border-r flex-shrink-0"
      style={{ width: 200, backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="px-3 pt-3 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Zadania
        </span>
      </div>

      <nav className="flex-1 py-1 overflow-y-auto">
        {/* Virtual views */}
        {VIRTUAL_VIEWS.map((v) => (
          <NavItem key={v.id} id={v.id} label={v.label} icon={v.icon} />
        ))}

        {/* Inbox */}
        {inbox && (
          <NavItem
            id={inbox.id}
            label="Skrzynka"
            icon={<Inbox size={15} />}
            count={(inbox._count?.tasks ?? 0) || undefined}
          />
        )}

        {/* Separator */}
        {regularProjects.length > 0 && (
          <div className="mx-3 my-2 border-t" style={{ borderColor: "var(--border)" }} />
        )}

        {/* Projects */}
        {regularProjects.map((p) => (
          <NavItem
            key={p.id}
            id={p.id}
            label={`${p.emoji} ${p.name}`}
            count={(p._count?.tasks ?? 0) || undefined}
          />
        ))}

        {/* Add project */}
        {isAdding ? (
          <div className="mx-1 mt-1 px-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setIsAdding(false); setNewName(""); }
              }}
              placeholder="Nazwa projektu…"
              className="w-full bg-transparent text-sm focus:outline-none border-b pb-1"
              style={{ borderColor: "var(--accent-blue)", color: "var(--text-primary)" }}
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleAdd}
                disabled={isPending || !newName.trim()}
                className="text-xs px-2 py-0.5 rounded focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              >
                {isPending ? <Loader2 size={11} className="animate-spin" /> : "Dodaj"}
              </button>
              <button onClick={() => { setIsAdding(false); setNewName(""); }} className="text-xs" style={{ color: "var(--text-muted)" }}>
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded text-sm w-full text-left"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = ""; }}
          >
            <Plus size={13} />
            Nowy projekt
          </button>
        )}
      </nav>
    </aside>
  );
}
