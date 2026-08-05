"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Trash2, Check, Pencil, Star } from "lucide-react";
import { removeFavoriteView, reorderFavoriteViews, updateFavoriteView } from "@/actions/favoriteViews";
import {
  FAVORITE_COLORS,
  MAX_FAVORITE_LABEL_LENGTH,
  MAX_FAVORITE_VIEWS,
  type FavoriteViewDTO,
} from "@/platform/favorites/favoriteViews";

const ICON_CHOICES = ["⭐", "📌", "🔥", "✅", "📝", "🛒", "💡", "📊", "🐾", "🍳"];

/**
 * 042: zarządzanie ulubionymi widokami (AC-7) — kolejność, nazwa, ikona, kolor, usunięcie.
 * Wzorzec 1:1 z `MenuPrefsEditor`: strzałki góra/dół i natychmiastowy zapis przez Server Action.
 *
 * Kolejność ma znaczenie funkcjonalne, nie tylko estetyczne — pierwsze dziewięć pozycji dostaje
 * skróty `Alt+1..9`, więc przestawienie listy to zarazem przypisanie skrótów.
 */
export function FavoriteViewsEditor({ favorites }: { favorites: FavoriteViewDTO[] }) {
  const [rows, setRows] = useState<FavoriteViewDTO[]>(favorites);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function persistOrder(next: FavoriteViewDTO[]) {
    setRows(next);
    startTransition(async () => {
      await reorderFavoriteViews(next.map((r) => r.id));
      router.refresh();
    });
  }

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= rows.length) return;
    const copy = [...rows];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    persistOrder(copy);
  }

  function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    startTransition(async () => {
      await removeFavoriteView(id);
      router.refresh();
    });
  }

  function patch(id: string, data: { label?: string; icon?: string; color?: string | null }) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...data } as FavoriteViewDTO : x)));
    startTransition(async () => {
      await updateFavoriteView(id, data);
      router.refresh();
    });
  }

  function saveLabel(id: string) {
    const value = draftLabel.trim();
    setEditingId(null);
    if (value) patch(id, { label: value });
  }

  return (
    <section>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}>
        <Star size={15} style={{ color: "var(--accent-amber)" }} />
        Ulubione widoki
      </h2>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Miejsca zapisane gwiazdką w pasku. Kolejność decyduje o skrótach — pierwsze dziewięć
        pozycji otwierasz skrótami <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>9</kbd>, a całą listę przez{" "}
        <kbd>Alt</kbd>+<kbd>0</kbd>. Limit: {MAX_FAVORITE_VIEWS}.
      </p>

      {rows.length === 0 ? (
        <p
          style={{
            fontSize: 12.5, color: "var(--text-muted)", margin: 0, padding: "14px 12px",
            border: "1px dashed var(--border)", borderRadius: "var(--radius, 8px)", background: "var(--bg-surface)",
          }}
        >
          Nie masz jeszcze ulubionych widoków. Wejdź w dowolne miejsce aplikacji — także z ustawionymi
          filtrami — i kliknij gwiazdkę w pasku, żeby je tu zapisać.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((f, idx) => (
            <div
              key={f.id}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                border: "1px solid var(--border)", borderRadius: "var(--radius, 8px)",
                background: "var(--bg-surface)", opacity: isPending ? 0.75 : 1,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)", width: 26, flexShrink: 0 }}>
                {idx < 9 ? `⌥${idx + 1}` : "—"}
              </span>

              <select
                value={f.icon}
                onChange={(e) => patch(f.id, { icon: e.target.value })}
                aria-label={`Ikona dla „${f.label}"`}
                style={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6,
                  color: "var(--text-primary)", padding: "2px 4px", fontSize: 14, flexShrink: 0, cursor: "pointer",
                }}
              >
                {(ICON_CHOICES.includes(f.icon) ? ICON_CHOICES : [f.icon, ...ICON_CHOICES]).map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>

              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === f.id ? (
                  <input
                    autoFocus
                    value={draftLabel}
                    maxLength={MAX_FAVORITE_LABEL_LENGTH}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={() => saveLabel(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveLabel(f.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="w-full text-sm focus:outline-none"
                    style={{
                      background: "var(--bg-elevated)", border: "1px solid var(--accent-blue)",
                      borderRadius: 6, padding: "3px 6px", color: "var(--text-primary)",
                    }}
                  />
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.path}
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                {FAVORITE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => patch(f.id, { color: c })}
                    aria-label={`Kolor ${c} dla „${f.label}"`}
                    title="Kolor akcentu"
                    style={{
                      width: 14, height: 14, borderRadius: "50%", background: c, cursor: "pointer",
                      border: f.color === c ? "2px solid var(--text-primary)" : "1px solid var(--border)",
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => { setEditingId(f.id); setDraftLabel(f.label); }}
                title="Zmień nazwę"
                aria-label={`Zmień nazwę „${f.label}"`}
                style={ctlBtn()}
              >
                {editingId === f.id ? <Check size={13} /> : <Pencil size={13} />}
              </button>
              <button onClick={() => move(idx, -1)} disabled={idx === 0} title="W górę" aria-label="W górę" style={ctlBtn(idx === 0)}>
                <ChevronUp size={13} />
              </button>
              <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} title="W dół" aria-label="W dół" style={ctlBtn(idx === rows.length - 1)}>
                <ChevronDown size={13} />
              </button>
              <button
                onClick={() => remove(f.id)}
                title="Usuń z ulubionych"
                aria-label={`Usuń „${f.label}" z ulubionych`}
                style={{ ...ctlBtn(), color: "var(--accent-red)" }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ctlBtn(disabled = false): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 26, height: 26, borderRadius: 6, flexShrink: 0,
    border: "1px solid var(--border)", background: "var(--bg-elevated)",
    color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
  };
}
