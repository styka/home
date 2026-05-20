"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShoppingCart, Plus, ChevronRight, Loader2, Package, Ruler, Tag, Map, Image, Archive, RotateCcw, Users } from "lucide-react";
import { createList, unarchiveList } from "@/actions/lists";
import { useToast } from "@/components/ui/Toast";

interface ListSummary {
  id: string;
  name: string;
  pendingCount: number;
  totalCount: number;
  teamName?: string | null;
  archived?: boolean;
}

interface ShoppingHomePageProps {
  lists: ListSummary[];
  archivedLists?: ListSummary[];
}

export function ShoppingHomePage({ lists, archivedLists = [] }: ShoppingHomePageProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  function handleCreate() {
    const name = newName.trim() || "Zakupy";
    startTransition(async () => {
      await createList(name);
      setNewName("");
      setIsAdding(false);
    });
  }

  return (
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
            <ShoppingCart size={22} style={{ color: "var(--accent-blue)" }} />
            Zakupy
          </h1>
          <button
            onClick={() => setIsAdding((v) => !v)}
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
              cursor: "pointer",
            }}
          >
            <Plus size={13} />
            Nowa lista
          </button>
        </div>

        {/* New list form */}
        {isAdding && (
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setIsAdding(false);
              }}
              placeholder="Nazwa listy…"
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-focus)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={handleCreate}
              disabled={isPending}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent-blue)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              Utwórz
            </button>
            <button
              onClick={() => setIsAdding(false)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Anuluj
            </button>
          </div>
        )}

        {/* Lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lists.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
              Brak list zakupów. Utwórz pierwszą!
            </p>
          )}
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/shopping/${list.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                textDecoration: "none",
                transition: "background 0.1s",
              }}
            >
              <ShoppingCart size={16} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text-primary)", minWidth: 0 }}>
                {list.name}
              </span>
              {list.teamName && (
                <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, backgroundColor: "rgba(139,92,246,0.15)", color: "var(--accent-purple)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <Users size={10} />
                  {list.teamName}
                </span>
              )}
              {list.pendingCount > 0 ? (
                <span style={{ fontSize: 12, color: "var(--accent-blue)", background: "rgba(59,130,246,0.1)", padding: "2px 8px", borderRadius: 10, border: "1px solid rgba(59,130,246,0.2)", flexShrink: 0 }}>
                  {list.pendingCount} do kupienia
                </span>
              ) : list.totalCount > 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
                  {list.totalCount} pozycji
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>Pusta</span>
              )}
              <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            </Link>
          ))}

          {/* Archive section */}
          {archivedLists.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowArchived((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
              >
                <Archive size={12} />
                {showArchived ? "Ukryj archiwum" : `Pokaż archiwum (${archivedLists.length})`}
              </button>
              {showArchived && archivedLists.map((list) => (
                <div
                  key={list.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", opacity: 0.6, marginTop: 6 }}
                >
                  <Archive size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{list.name}</span>
                  <button
                    onClick={() => { if (!confirm("Przywrócić listę z archiwum?")) return; startTransition(() => unarchiveList(list.id)); showToast("Lista przywrócona", "success"); }}
                    style={{ fontSize: 11, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    title="Przywróć listę"
                  >
                    <RotateCcw size={12} />
                    Przywróć
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { href: "/shopping/products", icon: <Package size={15} />, label: "Produkty" },
              { href: "/shopping/units", icon: <Ruler size={15} />, label: "Jednostki" },
              { href: "/shopping/categories", icon: <Tag size={15} />, label: "Kategorie" },
              { href: "/shopping/stores", icon: <Map size={15} />, label: "Mapy sklepów" },
              { href: "/shopping/icons", icon: <Image size={15} />, label: "Ikony" },
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
                <span style={{ color: "var(--accent-blue)" }}>{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
