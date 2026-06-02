"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { updateTaskProject, deleteTaskProject } from "@/actions/taskProjects";
import type { TaskProject } from "@/types";

/**
 * Akcje projektu (zmiana nazwy + usunięcie) dostępne z nagłówka listy zadań.
 * Świadomie oparte na zwykłym przycisku + menu (nie hover), żeby działało
 * identycznie na dotyku (mobile) i myszą (desktop). Skrzynki nie da się usunąć.
 */
export function ProjectActionsMenu({ project }: { project: TaskProject }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [isPending, startTransition] = useTransition();

  if (project.isInbox) return null;

  function close() {
    setOpen(false);
    setRenaming(false);
  }

  function handleRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) { close(); return; }
    startTransition(async () => {
      try {
        await updateTaskProject(project.id, { name: trimmed });
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Nie udało się zmienić nazwy");
      }
      close();
    });
  }

  function handleDelete() {
    const count = project._count?.tasks ?? 0;
    const msg =
      count > 0
        ? `Usunąć projekt „${project.name}"?\n\n${count} zadań NIE zostanie usuniętych — stracą przypisanie do projektu, ale pozostaną widoczne w „Wszystkie".`
        : `Usunąć projekt „${project.name}"?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteTaskProject(project.id);
        close();
        router.push("/tasks/today");
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Nie udało się usunąć projektu");
        close();
      }
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setName(project.name); setOpen((v) => !v); setRenaming(false); }}
        className="p-1.5 rounded focus:outline-none"
        style={{ color: open ? "var(--text-secondary)" : "var(--text-muted)" }}
        title="Akcje projektu"
        aria-label="Akcje projektu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={15} />}
      </button>

      {open && (
        <>
          {/* Klik poza menu zamyka (działa też na dotyku) */}
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div
            className="absolute right-0 mt-1 z-50 rounded-md border shadow-lg overflow-hidden"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", minWidth: 200 }}
            role="menu"
          >
            {renaming ? (
              <div className="flex items-center gap-1 p-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") close(); }}
                  className="flex-1 bg-transparent text-sm focus:outline-none border rounded px-2 py-1"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  placeholder="Nazwa projektu…"
                />
                <button onClick={handleRename} className="p-1 focus:outline-none" style={{ color: "var(--accent-green)" }} aria-label="Zapisz nazwę">
                  <Check size={15} />
                </button>
                <button onClick={close} className="p-1 focus:outline-none" style={{ color: "var(--text-muted)" }} aria-label="Anuluj">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setRenaming(true)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm focus:outline-none"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  role="menuitem"
                >
                  <Pencil size={14} /> Zmień nazwę
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm focus:outline-none"
                  style={{ color: "var(--accent-red)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  role="menuitem"
                >
                  <Trash2 size={14} /> Usuń projekt
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
