"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X } from "lucide-react";
import {
  syncReminders,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDTO,
} from "@/actions/notifications";
import { MODULE_META, type CalendarModule } from "@/lib/calendar";

function accentFor(module: string): string {
  const m = MODULE_META[module as CalendarModule];
  if (m) return m.accent;
  if (module === "services") return "var(--accent-blue)";
  return "var(--accent-purple)";
}

/**
 * Globalny dzwonek powiadomień (NM3). Przy montażu uruchamia skan terminów pod
 * free tier (`syncReminders` — bez crona, idempotentny po dedupeKey), pokazuje
 * licznik nieprzeczytanych i listę w rozwijanym panelu. Klik pozycji oznacza ją
 * jako przeczytaną i nawiguje do źródła.
 *
 * Element chrome (nie pływający FAB) — osadzany w nawigacji:
 *  - `placement="sidebar"` → wiersz w stopce sidebara (desktop); panel rozwija się W GÓRĘ,
 *  - `placement="topbar"` → kompaktowa ikona w górnym pasku (mobile); panel rozwija się W DÓŁ.
 */
export function NotificationBell({ placement = "topbar" }: { placement?: "topbar" | "sidebar" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Skan przy wejściu (logowanie / pierwszy render powłoki).
  useEffect(() => {
    syncReminders().then(setCount).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getNotifications();
      setItems(list);
      setCount(list.filter((n) => !n.readAt).length);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (next) void load();
      return next;
    });
  }, [load]);

  // Zamykanie klikiem poza panelem i Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const onItem = useCallback(async (n: NotificationDTO) => {
    if (!n.readAt) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  }, [router]);

  const onMarkAll = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setCount(0);
  }, []);

  const isSidebar = placement === "sidebar";
  // Panel: w stopce sidebara rozwija się W GÓRĘ i w prawo (nad rzędem), w górnym pasku — W DÓŁ i w lewo.
  const panelAnchor: React.CSSProperties = isSidebar
    ? { bottom: "calc(100% + 8px)", left: 8 }
    : { top: "calc(100% + 8px)", right: 0 };

  return (
    <div ref={panelRef} className="relative" style={isSidebar ? undefined : { display: "flex" }}>
      {isSidebar ? (
        <button
          onClick={toggle}
          aria-label={`Powiadomienia${count ? ` (${count} nieprzeczytane)` : ""}`}
          className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm w-[calc(100%-1rem)]"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <Bell size={18} style={{ flexShrink: 0 }} />
          <span>Powiadomienia</span>
          {count > 0 && (
            <span style={{ marginLeft: "auto", background: "var(--accent-red)", color: "var(--on-accent, #fff)", fontSize: 11, borderRadius: 999, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={toggle}
          aria-label={`Powiadomienia${count ? ` (${count} nieprzeczytane)` : ""}`}
          className="flex items-center justify-center rounded-full"
          style={{ width: 34, height: 34, background: "transparent", border: "none", color: "var(--text-secondary)", position: "relative" }}
        >
          <Bell size={19} />
          {count > 0 && (
            <span
              style={{
                position: "absolute", top: -1, right: -1, minWidth: 16, height: 16, padding: "0 4px",
                borderRadius: 99, background: "var(--accent-red)", color: "var(--on-accent, #fff)",
                fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Powiadomienia"
          style={{
            position: "absolute", ...panelAnchor, zIndex: 60, width: "min(360px, calc(100vw - 24px))",
            maxHeight: "min(70vh, 520px)", overflowY: "auto",
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 10px)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-surface)" }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Powiadomienia</span>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button onClick={onMarkAll} title="Oznacz wszystkie jako przeczytane"
                  className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--text-muted)", padding: "3px 6px" }}>
                  <Check size={13} /> Wszystkie
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Zamknij" style={{ color: "var(--text-muted)", padding: 4 }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>Ładowanie…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
              Brak powiadomień. Przypomnienia o terminach pojawią się tutaj.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onItem(n)}
                    className="flex items-start gap-2 w-full text-left"
                    style={{
                      padding: "10px 12px", borderBottom: "1px solid var(--border)",
                      background: n.readAt ? "transparent" : "var(--bg-hover)",
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: accentFor(n.module), marginTop: 5, flexShrink: 0 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--text-primary)", fontWeight: n.readAt ? 400 : 600 }}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{n.body}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
