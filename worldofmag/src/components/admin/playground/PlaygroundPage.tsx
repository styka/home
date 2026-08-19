"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, X, Palette } from "lucide-react";
import {
  PLAYGROUND_ENTRIES,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  defaultControlValues,
  type ControlValues,
  type PlaygroundEntryDef,
} from "@/lib/ui/playground/registry";
import { resolveTokens, tokensToStyle, type SkinTokens } from "@/lib/skins";
import { PlaygroundControls } from "./PlaygroundControls";
import { CodeBlock } from "./CodeBlock";

/**
 * 045 — playground komponentów napisany od zera.
 *
 * Poprzednia wersja pokazywała sześć komponentów, bo dodanie kolejnego wymagało zmian
 * w trzech miejscach naraz. Ta wywodzi całą zawartość z rejestru
 * (`lib/ui/playground/registry.tsx`) — komponent dopisany do rejestru pojawia się tu sam.
 *
 * MOBILE (C-31): nawigacja jest szufladą, nie drugim panelem bocznym. Aplikacja ma już
 * jeden panel na telefonie (menu powłoki) i dwa naraz są zawsze błędem.
 */

interface SkinOption {
  id: string;
  name: string;
  tokens: SkinTokens;
}

export function PlaygroundPage({ skins }: { skins: SkinOption[] }) {
  const t = useTranslations("components.admin.playground.PlaygroundPage");
  const router = useRouter();
  const pathname = usePathname();

  const [activeId, setActiveId] = useState(PLAYGROUND_ENTRIES[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [skinId, setSkinId] = useState<string>("");
  const [values, setValues] = useState<ControlValues>({});

  // Wybór w adresie — link do konkretnego komponentu ma działać (zasada „stan widoku
  // w adresie", 043). Adres czytamy z `window`, NIE przez `useSearchParams`: ten wymusza
  // granicę Suspense i potrafi zepchnąć stronę w renderowanie po stronie klienta.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c && PLAYGROUND_ENTRIES.some((e) => e.id === c)) setActiveId(c);
  }, []);

  const active = useMemo(
    () => PLAYGROUND_ENTRIES.find((e) => e.id === activeId) ?? PLAYGROUND_ENTRIES[0],
    [activeId],
  );

  // Wartości kontrolek resetują się przy zmianie komponentu — inaczej `variant` z Buttona
  // przeciekłby do następnego wpisu i demonstracja pokazywałaby bzdurę.
  useEffect(() => {
    if (active) setValues(defaultControlValues(active));
  }, [active]);

  function select(id: string) {
    setActiveId(id);
    setNavOpen(false);
    router.replace(`${pathname}?c=${id}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PLAYGROUND_ENTRIES;
    return PLAYGROUND_ENTRIES.filter(
      (e) => e.name.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q),
    );
  }, [query]);

  const previewStyle = useMemo(() => {
    const skin = skins.find((s) => s.id === skinId);
    return skin ? tokensToStyle(resolveTokens(skin.tokens)) : undefined;
  }, [skinId, skins]);

  if (!active) return null;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Nawigacja — desktop */}
      <div
        className="hidden md:flex flex-col"
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "var(--border-width) var(--border-style) var(--border)",
          background: "var(--bg-surface)",
          overflowY: "auto",
        }}
      >
        <NavContent entries={filtered} activeId={active.id} onSelect={select} query={query} onQuery={setQuery} />
      </div>

      {/* Nawigacja — telefon: szuflada, nie drugi panel boczny (C-31). */}
      {navOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setNavOpen(false)}
        >
          <div
            className="flex flex-col"
            style={{
              width: "82%",
              maxWidth: 320,
              background: "var(--bg-surface)",
              borderRight: "var(--border-width) var(--border-style) var(--border)",
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", padding: 8 }}>
              <button
                onClick={() => setNavOpen(false)}
                aria-label={t("zamknijNawigacje")}
                style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "var(--text-secondary)" }}
              >
                <X size={18} />
              </button>
            </div>
            <NavContent entries={filtered} activeId={active.id} onSelect={select} query={query} onQuery={setQuery} />
          </div>
        </div>
      )}

      {/* Treść */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "var(--view-padding)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <button
            className="md:hidden"
            onClick={() => setNavOpen(true)}
            aria-label={t("pokazListeKomponentow")}
            style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "var(--text-secondary)" }}
          >
            <Menu size={18} />
          </button>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{active.name}</h2>

          <span
            style={{
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: "var(--radius-pill)",
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {CATEGORY_LABELS[active.category]}
          </span>

          {/* Przełącznik skórki — LOKALNY. Zmienia tylko obszar demonstracji, nie skórkę konta. */}
          <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
            <Palette size={14} />
            <select
              value={skinId}
              onChange={(e) => setSkinId(e.target.value)}
              style={{
                background: "var(--bg-elevated)",
                border: "var(--border-width) var(--border-style) var(--border)",
                borderRadius: "var(--radius-control)",
                color: "var(--text-primary)",
                padding: "6px 8px",
                fontSize: 12,
                minHeight: 36,
              }}
            >
              <option value="">{t("biezacaSkorka")}</option>
              {skins.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", maxWidth: 680, lineHeight: 1.6 }}>
          {active.summary}
        </p>

        <PlaygroundBody entry={active} values={values} onValues={setValues} previewStyle={previewStyle} />
      </div>
    </div>
  );
}

function PlaygroundBody({
  entry,
  values,
  onValues,
  previewStyle,
}: {
  entry: PlaygroundEntryDef;
  values: ControlValues;
  onValues: (v: ControlValues) => void;
  previewStyle?: React.CSSProperties;
}) {
  const t = useTranslations("components.admin.playground.PlaygroundPage");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 900 }}>
      {entry.controls && entry.controls.length > 0 && (
        <section>
          <SectionLabel>{t("wlasciwosci")}</SectionLabel>
          <PlaygroundControls controls={entry.controls} values={values} onChange={onValues} />
        </section>
      )}

      <section>
        <SectionLabel>Demonstracja</SectionLabel>
        <DemoSurface previewStyle={previewStyle}>{entry.render(values)}</DemoSurface>
      </section>

      {entry.variants?.map((variant) => (
        <section key={variant.label}>
          <SectionLabel>{variant.label}</SectionLabel>
          <DemoSurface previewStyle={previewStyle}>{variant.render()}</DemoSurface>
        </section>
      ))}

      <section>
        <SectionLabel>Import</SectionLabel>
        <CodeBlock code={entry.importPath} />
      </section>
    </div>
  );
}

/** Obszar demonstracji — tokeny skórki nadpisane LOKALNIE, więc reszta strony zostaje. */
function DemoSurface({ children, previewStyle }: { children: React.ReactNode; previewStyle?: React.CSSProperties }) {
  return (
    <div
      style={{
        ...previewStyle,
        position: "relative",
        padding: 18,
        borderRadius: "var(--radius-lg)",
        border: "var(--border-width) var(--border-style) var(--border)",
        background: "var(--bg-surface)",
        backgroundImage: "var(--bg-image-surface)",
        color: "var(--text-primary)",
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        margin: "0 0 8px",
      }}
    >
      {children}
    </h3>
  );
}

function NavContent({
  entries,
  activeId,
  onSelect,
  query,
  onQuery,
}: {
  entries: PlaygroundEntryDef[];
  activeId: string;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
}) {
  const t = useTranslations("components.admin.playground.PlaygroundPage");
  return (
    <>
      <div style={{ padding: "10px 12px", position: "sticky", top: 0, background: "var(--bg-surface)", zIndex: 1 }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Szukaj komponentu…"
            style={{
              width: "100%",
              minHeight: 36,
              paddingLeft: 28,
              paddingRight: 8,
              borderRadius: "var(--radius-control)",
              border: "var(--border-width) var(--border-style) var(--border)",
              background: "var(--bg-base)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {entries.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 16px" }}>Nic nie pasuje do zapytania.</p>
      )}

      {CATEGORY_ORDER.map((category) => {
        const inCategory = entries.filter((e) => e.category === category);
        if (inCategory.length === 0) return null;
        return (
          <div key={category} style={{ paddingBottom: 4 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "10px 16px 4px",
                margin: 0,
              }}
            >
              {CATEGORY_LABELS[category]}
            </p>
            {inCategory.map((entry) => {
              const isActive = entry.id === activeId;
              return (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    minHeight: 44,
                    padding: "0 16px",
                    background: isActive ? "var(--bg-elevated)" : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${isActive ? "var(--accent-purple)" : "transparent"}`,
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {entry.name}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
