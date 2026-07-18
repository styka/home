"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShoppingCart, Plus, ChevronRight, Loader2, Package, Ruler, Tag, Map, Image as ImageIcon, Archive, RotateCcw, Users, Clock } from "lucide-react";
import { createList, unarchiveList } from "@/actions/lists";
import { useToast } from "@/components/ui/Toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { PageHeader, StatTile, SectionHeading, ManagementGrid, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";

// 009-shopping-offline-sync: offline wchodzimy w listę TWARDĄ nawigacją (<a>) zamiast SPA (<Link>),
// bo nawigacja SPA offline pobiera payload RSC z sieci i się wywala. Twarda nawigacja pozwala
// service workerowi zserwować zbuforowany dokument HTML listy (prefetchowany podczas warm-upu).
function CardLink({
  href,
  online,
  children,
  ...rest
}: { href: string; online: boolean } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (online) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

interface ListSummary {
  id: string;
  name: string;
  pendingCount: number;
  totalCount: number;
  teamName?: string | null;
  archived?: boolean;
}

interface RecentItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  listId: string;
  listName: string;
}

interface ShoppingHomePageProps {
  lists: ListSummary[];
  archivedLists?: ListSummary[];
  totalPending: number;
  recentItems: RecentItem[];
}

export function ShoppingHomePage({ lists, archivedLists = [], totalPending, recentItems }: ShoppingHomePageProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const online = useOnlineStatus();

  const teamListsCount = lists.filter((l) => l.teamName).length;
  const subtitle =
    lists.length === 0
      ? "Zacznij od utworzenia pierwszej listy"
      : totalPending > 0
      ? `${totalPending} ${pluralizePolish(totalPending, "pozycja", "pozycje", "pozycji")} do kupienia`
      : `${lists.length} ${pluralizePolish(lists.length, "lista", "listy", "list")}`;

  function handleCreate() {
    const name = newName.trim() || "Zakupy";
    startTransition(async () => {
      await createList(name);
      setNewName("");
      setIsAdding(false);
      showToast("Lista utworzona", "success");
    });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<ShoppingCart size={22} />}
          iconColor="var(--accent-blue)"
          title="Zakupy"
          subtitle={subtitle}
          action={
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
          }
        />

        {isAdding && (
          <div style={{ display: "flex", gap: 8 }}>
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
                color: "var(--on-accent)",
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

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <StatTile value={lists.length} label="Aktywne listy" color="var(--accent-blue)" />
          <StatTile
            value={totalPending}
            label="Do kupienia"
            color={totalPending > 0 ? "var(--accent-amber)" : "var(--text-muted)"}
          />
          <StatTile value={teamListsCount} label="Zespołowe" color="var(--accent-purple)" />
          <StatTile
            value={archivedLists.length}
            label="Archiwum"
            color="var(--text-muted)"
          />
        </div>

        {/* Lists */}
        <div>
          <SectionHeading>Listy</SectionHeading>
          {lists.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={28} />}
              message="Brak list zakupów"
              hint="Utwórz pierwszą, żeby zacząć robić zakupy"
              cta={{ label: "+ Nowa lista", onClick: () => setIsAdding(true), color: "var(--accent-blue)" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {lists.map((list) => (
                <ListCard key={list.id} list={list} online={online} />
              ))}
            </div>
          )}
        </div>

        {/* Recent items */}
        {recentItems.length > 0 && (
          <div>
            <SectionHeading>Ostatnio dodane</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentItems.map((item) => (
                <CardLink
                  key={item.id}
                  href={`/shopping/${item.listId}`}
                  online={online}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
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
                  <Clock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.quantity ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""} ` : ""}
                    {item.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                    {item.listName}
                  </span>
                  <ChevronRight size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                </CardLink>
              ))}
            </div>
          </div>
        )}

        {/* Archive */}
        {archivedLists.length > 0 && (
          <div>
            <SectionHeading
              action={
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Archive size={11} />
                  {showArchived ? "Ukryj" : `Pokaż (${archivedLists.length})`}
                </button>
              }
            >
              Archiwum
            </SectionHeading>
            {showArchived && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {archivedLists.map((list) => (
                  <div
                    key={list.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--bg-surface)",
                      opacity: 0.65,
                    }}
                  >
                    <Archive size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{list.name}</span>
                    <button
                      onClick={() => {
                        if (!confirm("Przywrócić listę z archiwum?")) return;
                        startTransition(() => unarchiveList(list.id));
                        showToast("Lista przywrócona", "success");
                      }}
                      style={{
                        fontSize: 11,
                        color: "var(--accent-blue)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
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
        )}

        {/* Management */}
        <div>
          <SectionHeading>Zarządzanie</SectionHeading>
          <ManagementGrid
            items={[
              { href: "/shopping/products", icon: <Package size={16} />, label: "Produkty", color: "var(--accent-blue)" },
              { href: "/shopping/units", icon: <Ruler size={16} />, label: "Jednostki", color: "var(--accent-blue)" },
              { href: "/shopping/categories", icon: <Tag size={16} />, label: "Kategorie", color: "var(--accent-blue)" },
              { href: "/shopping/stores", icon: <Map size={16} />, label: "Mapy sklepów", color: "var(--accent-blue)" },
              { href: "/shopping/icons", icon: <ImageIcon size={16} />, label: "Ikony", color: "var(--accent-blue)" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ListCard({ list, online }: { list: ListSummary; online: boolean }) {
  return (
    <CardLink
      href={`/shopping/${list.id}`}
      online={online}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
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
      <ShoppingCart size={16} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {list.name}
      </span>
      {list.teamName && (
        <span
          style={{
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 10,
            backgroundColor: "rgba(168,85,247,0.15)",
            color: "var(--accent-purple)",
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexShrink: 0,
          }}
        >
          <Users size={10} />
          {list.teamName}
        </span>
      )}
      {list.pendingCount > 0 ? (
        <span
          style={{
            fontSize: 12,
            color: "var(--accent-blue)",
            background: "rgba(59,130,246,0.1)",
            padding: "2px 8px",
            borderRadius: 10,
            border: "1px solid rgba(59,130,246,0.2)",
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          {list.pendingCount}
        </span>
      ) : list.totalCount > 0 ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
          {list.totalCount}
        </span>
      ) : (
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, fontStyle: "italic" }}>
          pusta
        </span>
      )}
      <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
    </CardLink>
  );
}

function pluralizePolish(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
