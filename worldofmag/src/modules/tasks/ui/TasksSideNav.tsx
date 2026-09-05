"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock, CalendarDays, AlertCircle, Inbox, Tag, Plus,
  Loader2, Pencil, Check, X, LayoutList, Trash2, Layers, ChevronRight,
} from "lucide-react";
import { getTaskProjects, createTaskProject, updateTaskProject, deleteTaskProject } from "../actions/taskProjects";
import { getObszaryProjektow } from "../actions/obszaryProjektow";
import { ZDARZENIE_ZMIANY_OBSZAROW } from "./FiltrObszarow";
import { splaszczDrzewo } from "../lib/poddrzewoObszarow";
import type { TaskProject, ObszarProjektow } from "@/types";
import { useConfirm } from "@/components/ui/ConfirmProvider";

const VIRTUAL_VIEWS = [
  { id: "today", label: "Dziś", Icon: CalendarClock },
  { id: "upcoming", label: "Nadchodzące", Icon: CalendarDays },
  { id: "overdue", label: "Zaległe", Icon: AlertCircle },
  { id: "all", label: "Wszystkie", Icon: LayoutList },
] as const;

const EXPANDED_KEY = "tasks.groups.expanded"; // klucz historyczny — zwinięcia obszarów

export function TasksSideNav() {
  const t = useTranslations("modules.tasks.TasksSideNav");
  const confirmDialog = useConfirm();
  const pathname = usePathname();
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [obszary, setObszary] = useState<ObszarProjektow[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Rozwinięte grupy (folder-drzewko) — przeżywa nawigację (localStorage).
  const [expanded, setExpanded] = useState<string[]>([]);

  const reload = useCallback(() => {
    getTaskProjects().then(setProjects).catch(() => {});
    getObszaryProjektow().then(setObszary).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // 122/125: mutacje obszarów żyją w dropdownie widoku obszaru, a ta lista jest stanem
  // klienckim — `revalidatePath` jej nie odświeży. Dropdown ogłasza zmianę zdarzeniem okna,
  // a sidebar przeładowuje obszary (inaczej usunięty obszar zostawałby tu linkiem do 404).
  useEffect(() => {
    window.addEventListener(ZDARZENIE_ZMIANY_OBSZAROW, reload);
    return () => window.removeEventListener(ZDARZENIE_ZMIANY_OBSZAROW, reload);
  }, [reload]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPANDED_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) setExpanded(v.filter((x): x is string => typeof x === "string"));
      }
    } catch { /* noop */ }
  }, []);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  const inbox = projects.find((p) => p.isInbox);
  // 125: projekt przypisany do obszaru renderuje się POD obszarem; płaska lista trzyma resztę.
  const regularProjects = projects.filter((p) => !p.isInbox && !p.areaId);

  // 080 (Z3)/125: obszar ma własny adres z zakresem w ŚCIEŻCE — id czytamy z `pathname`,
  // nie z parametru zapytania (parametry potrafią nie dotrzeć przy ponownym renderze).
  const activeObszarId = pathname.startsWith("/tasks/obszar/")
    ? pathname.slice("/tasks/obszar/".length).split("/")[0] || null
    : null;

  function isActive(id: string) {
    return pathname === `/tasks/${id}`;
  }

  function itemStyle(id: string) {
    return {
      paddingLeft: 40,
      paddingTop: 5,
      paddingBottom: 5,
      paddingRight: 8,
      backgroundColor: isActive(id) ? "var(--bg-elevated)" : hovered === id ? "var(--bg-hover)" : undefined,
      color: isActive(id) ? "var(--text-primary)" : "var(--text-muted)",
    };
  }

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createTaskProject(newName.trim());
      setNewName("");
      setIsAdding(false);
      reload();
    });
  }

  function handleEdit(id: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      await updateTaskProject(id, { name: editName.trim() });
      setEditingId(null);
      reload();
    });
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const project = projects.find((p) => p.id === id);
    const count = project?._count?.tasks ?? 0;
    const name = project?.name ?? "ten projekt";
    const msg =
      count > 0
        ? `Usunąć projekt „${name}"?\n\n${count} zadań NIE zostanie usuniętych — stracą przypisanie do projektu, ale pozostaną widoczne w „Wszystkie".`
        : `Usunąć projekt „${name}"?`;
    if (!(await confirmDialog({ title: msg, destructive: true }))) return;
    startTransition(async () => {
      try {
        await deleteTaskProject(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Nie udało się usunąć projektu");
      }
      reload();
    });
  }

  /** Wiersz projektu zagnieżdżony pod rozwiniętą grupą (lekki link, bez akcji). */
  function renderNestedProject(p: TaskProject) {
    return (
      <Link
        key={`nested:${p.id}`}
        href={`/tasks/${p.id}`}
        onMouseEnter={() => setHovered(`nested:${p.id}`)}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs py-1"
        style={{
          paddingLeft: 56,
          paddingRight: 8,
          backgroundColor: isActive(p.id) ? "var(--bg-elevated)" : hovered === `nested:${p.id}` ? "var(--bg-hover)" : undefined,
          color: isActive(p.id) ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span>{p.isInbox ? "📥" : p.emoji}</span>
        <span className="flex-1 truncate">{p.name}</span>
        {(p._count?.tasks ?? 0) > 0 && <span style={{ fontSize: 10 }}>{p._count!.tasks}</span>}
      </Link>
    );
  }

  return (
    <div className="pb-2">
      {VIRTUAL_VIEWS.map(({ id, label, Icon }) => (
        <Link
          key={id}
          href={`/tasks/${id}`}
          onMouseEnter={() => setHovered(id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center gap-2 mx-2 rounded text-xs"
          style={itemStyle(id)}
        >
          <Icon size={12} />
          {label}
        </Link>
      ))}

      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      {inbox && (
        <Link
          href={`/tasks/${inbox.id}`}
          onMouseEnter={() => setHovered(inbox.id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center gap-2 mx-2 rounded text-xs"
          style={itemStyle(inbox.id)}
        >
          <Inbox size={12} />
          <span className="flex-1">Skrzynka</span>
          {(inbox._count?.tasks ?? 0) > 0 && (
            <span style={{ fontSize: 10 }}>{inbox._count!.tasks}</span>
          )}
        </Link>
      )}

      {/* ——— Obszary (kategorie projektów; drzewo — 125) ———
          Zarządzanie obszarem (projekty, nazwa, kolor, pod-obszary, usunięcie) żyje w dropdownie
          widoku obszaru — sidebar tylko prowadzi. Projekty przypisane renderują się pod obszarem. */}
      {obszary.length > 0 && (
        <div className="flex items-center justify-between mx-2 pr-1 mt-1" style={{ paddingLeft: 16 }}>
          <span className="flex items-center gap-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)", fontSize: 10 }}>
            <Layers size={11} /> Obszary
          </span>
        </div>
      )}

      {splaszczDrzewo(obszary).map((o) => {
        const active = activeObszarId === o.id;
        const isOpen = expanded.includes(o.id);
        const members = projects.filter((p) => p.areaId === o.id);
        return (
          <div key={o.id}>
            <div
              onMouseEnter={() => setHovered(`obszar:${o.id}`)}
              onMouseLeave={() => setHovered(null)}
              className="flex items-center mx-2 rounded"
              style={{ backgroundColor: active ? "var(--bg-elevated)" : hovered === `obszar:${o.id}` ? "var(--bg-hover)" : undefined }}
            >
              <button
                onClick={() => toggleExpanded(o.id)}
                className="flex items-center justify-center focus:outline-none flex-shrink-0"
                style={{ paddingLeft: 18 + o.glebokosc * 12, paddingRight: 2, color: "var(--text-muted)", height: 26 }}
                title={isOpen ? t("zwinObszar") : t("rozwinObszar")}
                aria-expanded={isOpen}
              >
                <ChevronRight size={12} style={{ transition: "transform 0.12s", transform: isOpen ? "rotate(90deg)" : "none" }} />
              </button>
              <Link
                href={`/tasks/obszar/${o.id}`}
                className="flex items-center gap-2 flex-1 text-xs py-1 min-w-0"
                style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
                title={t("otworzWidokObszaru")}
              >
                {o.color
                  ? <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: o.color }} />
                  : <span className="flex-shrink-0">{o.emoji}</span>}
                <span className="flex-1 truncate">{o.name}</span>
                {(o.activeCount ?? 0) > 0 && <span style={{ fontSize: 10 }}>{o.activeCount}</span>}
              </Link>
            </div>
            {isOpen && (
              members.length > 0
                ? members.map(renderNestedProject)
                : <div className="text-xs py-1" style={{ paddingLeft: 56, color: "var(--text-muted)" }}>{t("brakDostepnychProjektow")}</div>
            )}
          </div>
        );
      })}

      {/* ——— Projekty (płaska lista: bez obszaru; przypisane żyją pod swoimi obszarami) ——— */}
      <div className="mx-2 mt-1 mb-0.5 uppercase tracking-wide" style={{ paddingLeft: 16, color: "var(--text-muted)", fontSize: 10 }}>
        Projekty
      </div>

      {regularProjects.map((p) => {
        return (
        <div
          key={p.id}
          onMouseEnter={() => setHovered(p.id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center mx-2 rounded"
          style={{ backgroundColor: isActive(p.id) ? "var(--bg-elevated)" : hovered === p.id ? "var(--bg-hover)" : undefined }}
        >
          {editingId === p.id ? (
            <div className="flex items-center gap-1 flex-1 py-1 pr-2" style={{ paddingLeft: 40 }}>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleEdit(p.id); if (e.key === "Escape") setEditingId(null); }}
                className="flex-1 bg-transparent text-xs focus:outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              <button onClick={() => handleEdit(p.id)} className="focus:outline-none" style={{ color: "var(--accent-green)" }}>
                <Check size={11} />
              </button>
              <button onClick={() => setEditingId(null)} className="focus:outline-none" style={{ color: "var(--text-muted)" }}>
                <X size={11} />
              </button>
            </div>
          ) : (
            <>
              <Link
                href={`/tasks/${p.id}`}
                className="flex items-center gap-2 flex-1 text-xs py-1 min-w-0"
                style={{ paddingLeft: 40, color: isActive(p.id) ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                <span>{p.emoji}</span>
                <span className="flex-1 truncate">{p.name}</span>
                {(p._count?.tasks ?? 0) > 0 && (
                  <span style={{ fontSize: 10 }}>{p._count!.tasks}</span>
                )}
              </Link>
              {hovered === p.id && (
                <div className="flex items-center gap-1 mr-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => { e.preventDefault(); setEditingId(p.id); setEditName(p.name); }}
                    className="focus:outline-none hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                    title={t("zmienNazwe")}
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    className="focus:outline-none hover:opacity-70"
                    style={{ color: "var(--accent-red)" }}
                    title={t("usunProjekt")}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        );
      })}

      {isAdding ? (
        <div className="flex items-center gap-1 mx-2 py-1 pr-2" style={{ paddingLeft: 40 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setIsAdding(false); setNewName(""); } }}
            placeholder="Nazwa projektu…"
            className="flex-1 bg-transparent text-xs focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {isPending ? (
            <Loader2 size={11} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          ) : (
            <>
              <button onClick={handleAdd} className="focus:outline-none" style={{ color: "var(--accent-green)" }}>
                <Check size={11} />
              </button>
              <button onClick={() => { setIsAdding(false); setNewName(""); }} className="focus:outline-none" style={{ color: "var(--text-muted)" }}>
                <X size={11} />
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "var(--text-muted)"; }}
          className="flex items-center gap-2 mx-2 rounded text-xs w-[calc(100%-16px)]"
          style={{ paddingLeft: 40, paddingTop: 5, paddingBottom: 5, color: "var(--text-muted)" }}
        >
          <Plus size={11} />
          Nowy projekt
        </button>
      )}

      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      <Link
        href="/tasks/tags"
        onMouseEnter={() => setHovered("tags")}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs"
        style={itemStyle("tags")}
      >
        <Tag size={12} />
        Tagi
      </Link>
    </div>
  );
}
