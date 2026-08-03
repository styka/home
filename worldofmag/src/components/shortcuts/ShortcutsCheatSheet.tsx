"use client";

import { useEffect, useMemo, useState } from "react";
import { Keyboard, X } from "lucide-react";
import {
  useShortcuts,
  useShortcutsRegistry,
  type RegisteredShortcut,
} from "@/components/shell/ShortcutsProvider";
import { compareGroups, formatKeys, type ShortcutDef } from "@/lib/shortcuts/registry";

/**
 * 043: ściągawka skrótów (AC-11) — nakładka pod klawiszem `?`.
 *
 * Lista pochodzi WYŁĄCZNIE z rejestru `ShortcutsProvider`, więc pokazuje to, co naprawdę jest
 * podpięte na bieżącej stronie. Osobna, ręcznie utrzymywana lista rozjechałaby się z kodem przy
 * pierwszej zmianie — a to właśnie brak jednego źródła prawdy dał kolizję `Alt+1` naprawianą w 043.
 *
 * `?` wymaga Shifta, dlatego reguła dopasowania w `matchShortcut` celowo NIE traktuje Shifta jako
 * modyfikatora blokującego.
 */
export function ShortcutsCheatSheet() {
  const registry = useShortcutsRegistry();
  const [open, setOpen] = useState(false);

  const entries = useMemo<RegisteredShortcut[]>(() => [
    {
      id: "cheatsheet",
      keys: "?",
      label: "Ściągawka skrótów",
      group: "Ogólne",
      scope: "global",
      handler: () => { setOpen((v) => !v); },
    },
  ], []);

  useShortcuts(entries);

  // Lista skrótów liczona PO otwarciu, a nie w trakcie renderu. Powód: strona rejestruje swoje
  // skróty w efekcie, więc otwarcie ściągawki tuż po wejściu na stronę potrafiło złapać moment,
  // w którym w rejestrze były jeszcze same skróty globalne — a raz policzona lista nigdy by się
  // nie odświeżyła. Ponowny odczyt po chwili domyka ten wyścig.
  const [list, setList] = useState<ShortcutDef[]>([]);
  useEffect(() => {
    if (!open) return;
    const read = () => setList(registry?.getShortcuts() ?? []);
    read();
    const t = setTimeout(read, 150);
    return () => clearTimeout(t);
  }, [open, registry]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const page = list.filter((s) => s.scope === "page");
  const global = list.filter((s) => s.scope === "global");

  return (
    <div
      data-omnia-overlay="shortcuts"
      role="dialog"
      aria-modal="true"
      aria-label="Ściągawka skrótów klawiszowych"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 70,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)", maxHeight: "min(72vh, 640px)", overflowY: "auto",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 12px)", padding: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Keyboard size={16} style={{ color: "var(--accent-blue)" }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, flex: 1 }}>
            Skróty klawiszowe
          </h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Zamknij"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}
          >
            <X size={15} />
          </button>
        </div>

        <ShortcutGroups
          title="Ta strona"
          emptyText="Ta strona nie ma własnych skrótów."
          shortcuts={page}
        />
        <ShortcutGroups
          title="Globalne"
          emptyText="Brak skrótów globalnych."
          shortcuts={global}
        />

        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "14px 0 0", lineHeight: 1.5 }}>
          Skróty strony mają pierwszeństwo przed globalnymi. W polach tekstowych działają tylko
          Esc i paleta poleceń — żeby nie przechwytywać pisania.
        </p>
      </div>
    </div>
  );
}

function ShortcutGroups({ title, emptyText, shortcuts }: { title: string; emptyText: string; shortcuts: ShortcutDef[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, ShortcutDef[]>();
    for (const s of shortcuts) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return Array.from(map.entries()).sort((a, b) => compareGroups(a[0], b[0]));
  }, [shortcuts]);

  return (
    <section style={{ marginBottom: 14 }}>
      <h3
        style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          color: "var(--text-muted)", margin: "0 0 6px",
        }}
      >
        {title}
      </h3>

      {shortcuts.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{emptyText}</p>
      ) : (
        groups.map(([group, list]) => (
          <div key={group} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{group}</div>
            {list.map((s) => (
              <div
                key={`${s.scope}-${s.keys}-${s.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0" }}
              >
                <kbd
                  style={{
                    fontSize: 11, fontFamily: "inherit", padding: "2px 7px", minWidth: 62, textAlign: "center",
                    background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 5,
                    color: "var(--text-primary)", flexShrink: 0,
                  }}
                >
                  {formatKeys(s.keys)}
                </kbd>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)", minWidth: 0 }} className="truncate">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
