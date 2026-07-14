"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingCart, Plus, Loader2, Pencil, Check, X, Trash2,
  LayoutList, Map, Image as ImageIcon, Users,
} from "lucide-react";
import { getListSummaries, createList, renameList, deleteList, type ListSummary } from "@/actions/lists";

export function ShoppingSideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reload() {
    getListSummaries(false).then(setLists).catch(() => {});
  }

  useEffect(() => { reload(); }, [pathname]);

  function isActive(id: string) {
    return pathname === `/shopping/${id}`;
  }

  function isSubActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function itemStyle(active: boolean, isHovered: boolean) {
    return {
      paddingLeft: 40,
      paddingTop: 5,
      paddingBottom: 5,
      paddingRight: 8,
      backgroundColor: active ? "var(--bg-elevated)" : isHovered ? "var(--bg-hover)" : undefined,
      color: active ? "var(--text-primary)" : "var(--text-muted)",
    };
  }

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const list = await createList(newName.trim());
      setNewName("");
      setIsAdding(false);
      reload();
      router.push(`/shopping/${list.id}`);
    });
  }

  function handleEdit(id: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    startTransition(async () => {
      await renameList(id, editName.trim());
      setEditingId(null);
      reload();
    });
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Usunąć tę listę i wszystkie jej pozycje?")) return;
    startTransition(async () => {
      await deleteList(id);
      const remaining = lists.filter((l) => l.id !== id);
      reload();
      if (isActive(id)) {
        router.push(remaining.length > 0 ? `/shopping/${remaining[0].id}` : "/shopping");
      }
    });
  }

  return (
    <div className="pb-2">
      {/* Virtual view: all lists catalog */}
      <Link
        href="/shopping"
        onMouseEnter={() => setHovered("__all__")}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs"
        style={itemStyle(pathname === "/shopping", hovered === "__all__")}
      >
        <LayoutList size={12} />
        Wszystkie listy
      </Link>

      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      {/* Lists */}
      {lists.map((list) => (
        <div
          key={list.id}
          onMouseEnter={() => setHovered(list.id)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center mx-2 rounded"
          style={{ backgroundColor: isActive(list.id) ? "var(--bg-elevated)" : hovered === list.id ? "var(--bg-hover)" : undefined }}
        >
          {editingId === list.id ? (
            <div className="flex items-center gap-1 flex-1 py-1 pr-2" style={{ paddingLeft: 40 }}>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleEdit(list.id); if (e.key === "Escape") setEditingId(null); }}
                className="flex-1 bg-transparent text-xs focus:outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              <button onClick={() => handleEdit(list.id)} className="focus:outline-none" style={{ color: "var(--accent-green)" }}>
                <Check size={11} />
              </button>
              <button onClick={() => setEditingId(null)} className="focus:outline-none" style={{ color: "var(--text-muted)" }}>
                <X size={11} />
              </button>
            </div>
          ) : (
            <>
              <Link
                href={`/shopping/${list.id}`}
                className="flex items-center gap-2 flex-1 text-xs py-1 min-w-0"
                style={{ paddingLeft: 40, color: isActive(list.id) ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                <ShoppingCart size={12} style={{ color: isActive(list.id) ? "var(--accent-blue)" : "var(--text-muted)", flexShrink: 0 }} />
                <span className="flex-1 truncate">{list.name}</span>
                {list.teamName && (
                  <Users size={10} style={{ color: "var(--accent-purple)", flexShrink: 0 }} aria-label={`Zespół: ${list.teamName}`} />
                )}
                {list.pendingCount > 0 && hovered !== list.id && (
                  <span style={{ fontSize: 10, color: "var(--accent-blue)", flexShrink: 0 }}>{list.pendingCount}</span>
                )}
              </Link>
              {hovered === list.id && (
                <div className="flex items-center gap-1 mr-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => { e.preventDefault(); setEditingId(list.id); setEditName(list.name); }}
                    className="focus:outline-none hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                    title="Zmień nazwę"
                  >
                    <Pencil size={10} />
                  </button>
                  {lists.length > 1 && (
                    <button
                      onClick={(e) => handleDelete(list.id, e)}
                      className="focus:outline-none hover:opacity-70"
                      style={{ color: "var(--accent-red)" }}
                      title="Usuń listę"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {isAdding ? (
        <div className="flex items-center gap-1 mx-2 py-1 pr-2" style={{ paddingLeft: 40 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setIsAdding(false); setNewName(""); } }}
            placeholder="Nazwa listy…"
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
          Nowa lista
        </button>
      )}

      <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--border)" }} />

      <Link
        href="/shopping/stores"
        onMouseEnter={() => setHovered("__stores__")}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs"
        style={itemStyle(isSubActive("/shopping/stores"), hovered === "__stores__")}
      >
        <Map size={12} />
        Mapy sklepów
      </Link>

      <Link
        href="/shopping/icons"
        onMouseEnter={() => setHovered("__icons__")}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-2 mx-2 rounded text-xs"
        style={itemStyle(isSubActive("/shopping/icons"), hovered === "__icons__")}
      >
        <ImageIcon size={12} />
        Biblioteka ikon
      </Link>
    </div>
  );
}
