"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { MARKDOWN_STYLES } from "@/lib/markdown";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  X,
  CheckCircle2,
  CircleDashed,
  PencilLine,
  Sun,
  Moon,
  Coffee,
} from "lucide-react";

type Status = "done" | "draft" | "planned";

interface TocItem {
  slug: string;
  number: string;
  part: string;
  title: string;
  summary: string;
  status: Status;
  words: number;
}

interface Meta {
  title: string;
  subtitle: string;
  auditDate: string;
}

type ReadingTheme = "dark" | "light" | "sepia";

const READING_THEME_KEY = "audyt-reading-theme";

const READING_THEME_CSS = `
.audyt-reading[data-reading-theme="light"] {
  --bg-base: #ffffff; --bg-surface: #f6f7f8; --bg-elevated: #eceef1; --bg-hover: #e4e7ea;
  --border: #d9dde2; --text-primary: #16191d; --text-secondary: #353a40; --text-muted: #6a7178;
}
.audyt-reading[data-reading-theme="sepia"] {
  --bg-base: #f5edd9; --bg-surface: #efe6cf; --bg-elevated: #e8ddc1; --bg-hover: #e0d4b4;
  --border: #d8caa6; --text-primary: #38301d; --text-secondary: #4b4129; --text-muted: #6f6248;
}
.audyt-reading { background: var(--bg-base); color: var(--text-primary); }
.audyt-reading .md-content { max-width: 760px; margin: 0 auto; }
`;

function StatusIcon({ status }: { status: Status }) {
  if (status === "done")
    return <CheckCircle2 size={13} style={{ color: "var(--accent-green)", flexShrink: 0 }} />;
  if (status === "draft")
    return <PencilLine size={13} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />;
  return <CircleDashed size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />;
}

export function AudytBookReader({
  meta,
  toc,
  activeSlug,
  activeHtml,
  activeStatus,
  generatedAt,
  basePath = "/admin/audyt",
  sourceLabel = "content/audyt/*.md",
}: {
  meta: Meta;
  toc: TocItem[];
  activeSlug: string;
  activeHtml: string;
  activeStatus: Status;
  generatedAt: string;
  /** Bazowa trasa dla linków TOC / prev-next (druga „książka" żyje pod innym adresem). */
  basePath?: string;
  /** Etykieta źródła w stopce (skąd pochodzi treść). */
  sourceLabel?: string;
}) {
  const [theme, setTheme] = useState<ReadingTheme>("dark");
  const [tocOpen, setTocOpen] = useState(false); // mobile drawer
  const [scrollPct, setScrollPct] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  // Load persisted reading theme.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(READING_THEME_KEY) as ReadingTheme | null;
      if (saved === "light" || saved === "sepia" || saved === "dark") setTheme(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function pickTheme(t: ReadingTheme) {
    setTheme(t);
    try {
      localStorage.setItem(READING_THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }

  // Reset scroll + close mobile drawer when the chapter changes.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    setScrollPct(0);
    setTocOpen(false);
  }, [activeSlug]);

  const activeIndex = useMemo(
    () => Math.max(0, toc.findIndex((c) => c.slug === activeSlug)),
    [toc, activeSlug],
  );
  const active = toc[activeIndex];
  const prev = activeIndex > 0 ? toc[activeIndex - 1] : null;
  const next = activeIndex < toc.length - 1 ? toc[activeIndex + 1] : null;

  const doneCount = useMemo(() => toc.filter((c) => c.status === "done").length, [toc]);
  const pctDone = toc.length ? Math.round((doneCount / toc.length) * 100) : 0;

  // Group TOC by part, preserving order.
  const groups = useMemo(() => {
    const out: { part: string; items: TocItem[] }[] = [];
    for (const item of toc) {
      const last = out[out.length - 1];
      if (last && last.part === item.part) last.items.push(item);
      else out.push({ part: item.part, items: [item] });
    }
    return out;
  }, [toc]);

  function onMainScroll() {
    const el = mainRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setScrollPct(max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 0);
  }

  const tocList = (
    <nav style={{ padding: "8px 0" }}>
      {groups.map((g) => (
        <div key={g.part} style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "8px 16px 4px",
            }}
          >
            {g.part}
          </div>
          {g.items.map((item) => {
            const isActive = item.slug === activeSlug;
            return (
              <Link
                key={item.slug}
                href={`${basePath}?r=${item.slug}`}
                className="audyt-toc-link"
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  padding: "6px 16px",
                  textDecoration: "none",
                  fontSize: 12.5,
                  lineHeight: 1.35,
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  background: isActive ? "var(--bg-elevated)" : "transparent",
                  borderLeft: `2px solid ${isActive ? "var(--accent-purple)" : "transparent"}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    minWidth: 24,
                    flexShrink: 0,
                  }}
                >
                  {item.number}
                </span>
                <StatusIcon status={item.status} />
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div
      className="flex-1"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        background: "var(--bg-base)",
      }}
    >
      <style>{MARKDOWN_STYLES}</style>
      <style>{READING_THEME_CSS}</style>
      <style>{`.audyt-toc-link:hover { background: var(--bg-hover) !important; }`}</style>

      {/* Top progress bar (reading scroll) */}
      <div style={{ height: 3, background: "var(--bg-surface)", flexShrink: 0 }}>
        <div
          style={{
            height: "100%",
            width: `${scrollPct}%`,
            background: "var(--accent-purple)",
            transition: "width 0.1s linear",
          }}
        />
      </div>

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={14} /> Admin
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <BookOpen size={16} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {meta.title}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            · stan {meta.auditDate}
          </span>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
          }}
        >
          {/* progress: done chapters */}
          <span
            style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}
            title={`${doneCount} z ${toc.length} rozdziałów gotowych`}
          >
            Rozdz. {activeIndex + 1}/{toc.length} · {pctDone}% gotowe
          </span>

          {/* reading theme toggle */}
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            <ThemeButton current={theme} value="dark" onPick={pickTheme} label="Ciemny">
              <Moon size={14} />
            </ThemeButton>
            <ThemeButton current={theme} value="light" onPick={pickTheme} label="Jasny">
              <Sun size={14} />
            </ThemeButton>
            <ThemeButton current={theme} value="sepia" onPick={pickTheme} label="Sepia">
              <Coffee size={14} />
            </ThemeButton>
          </div>

          {/* mobile TOC toggle */}
          <button
            className="md:hidden"
            onClick={() => setTocOpen((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 9px",
              borderRadius: 7,
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {tocOpen ? <X size={14} /> : <List size={14} />} Spis
          </button>
        </div>
      </header>

      {/* Body: sidebar + reading pane */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Desktop TOC */}
        <aside
          className="hidden md:block"
          style={{
            width: 300,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            background: "var(--bg-surface)",
            overflowY: "auto",
          }}
        >
          {tocList}
        </aside>

        {/* Mobile TOC drawer */}
        {tocOpen && (
          <div
            className="md:hidden"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 30,
              display: "flex",
            }}
          >
            <div
              style={{
                width: "82%",
                maxWidth: 340,
                background: "var(--bg-surface)",
                borderRight: "1px solid var(--border)",
                overflowY: "auto",
              }}
            >
              {tocList}
            </div>
            <div
              onClick={() => setTocOpen(false)}
              style={{ flex: 1, background: "rgba(0,0,0,0.5)" }}
            />
          </div>
        )}

        {/* Reading pane */}
        <main
          ref={mainRef}
          onScroll={onMainScroll}
          className="audyt-reading"
          data-reading-theme={theme}
          style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "28px 24px 64px" }}
        >
          <article style={{ maxWidth: 760, margin: "0 auto" }}>
            {/* chapter eyebrow */}
            {active && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                {active.part}
                {active.number && active.number !== "—" ? ` · Rozdział ${active.number}` : ""}
              </div>
            )}

            {activeHtml ? (
              <div
                className="md-content"
                dangerouslySetInnerHTML={{ __html: activeHtml }}
                style={{ lineHeight: 1.75 }}
              />
            ) : (
              <PlannedPlaceholder title={active?.title ?? ""} summary={active?.summary ?? ""} status={activeStatus} />
            )}

            {/* Prev / next */}
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 40,
                paddingTop: 20,
                borderTop: "1px solid var(--border)",
              }}
            >
              {prev ? (
                <Link
                  href={`${basePath}?r=${prev.slug}`}
                  style={{ ...navBtnStyle, justifyContent: "flex-start" }}
                >
                  <ChevronLeft size={15} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={navBtnEyebrow}>Poprzedni</span>
                    <span style={navBtnTitle}>{prev.title}</span>
                  </span>
                </Link>
              ) : (
                <span style={{ flex: 1 }} />
              )}
              {next ? (
                <Link
                  href={`${basePath}?r=${next.slug}`}
                  style={{ ...navBtnStyle, justifyContent: "flex-end", textAlign: "right" }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={navBtnEyebrow}>Następny</span>
                    <span style={navBtnTitle}>{next.title}</span>
                  </span>
                  <ChevronRight size={15} style={{ flexShrink: 0 }} />
                </Link>
              ) : (
                <span style={{ flex: 1 }} />
              )}
            </div>

            <p style={{ marginTop: 24, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              Dokument wersjonowany w repo (<code style={{ fontFamily: "monospace" }}>{sourceLabel}</code>) ·
              upieczono przy buildzie: {fmtDate(generatedAt)}
            </p>
          </article>
        </main>
      </div>
    </div>
  );
}

function ThemeButton({
  current,
  value,
  onPick,
  label,
  children,
}: {
  current: ReadingTheme;
  value: ReadingTheme;
  onPick: (t: ReadingTheme) => void;
  label: string;
  children: ReactNode;
}) {
  const isActive = current === value;
  return (
    <button
      onClick={() => onPick(value)}
      title={`Tryb czytania: ${label}`}
      aria-label={`Tryb czytania: ${label}`}
      aria-pressed={isActive}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 26,
        borderRadius: 6,
        cursor: "pointer",
        border: `1px solid ${isActive ? "var(--border)" : "transparent"}`,
        background: isActive ? "var(--bg-elevated)" : "transparent",
        color: isActive ? "var(--accent-purple)" : "var(--text-muted)",
      }}
    >
      {children}
    </button>
  );
}

function PlannedPlaceholder({
  title,
  summary,
  status,
}: {
  title: string;
  summary: string;
  status: Status;
}) {
  return (
    <div>
      <h1 className="md-h1">{title}</h1>
      {summary && <p className="md-p">{summary}</p>}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          borderRadius: 10,
          background: "color-mix(in srgb, var(--accent-amber) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent-amber) 35%, transparent)",
          color: "var(--accent-amber)",
          fontSize: 13,
        }}
      >
        <CircleDashed size={16} style={{ flexShrink: 0 }} />
        {status === "draft"
          ? "Rozdział w wersji roboczej — treść jest uzupełniana."
          : "Rozdział w przygotowaniu — zostanie napisany w kolejnej iteracji audytu. Struktura jest już ustalona w spisie treści."}
      </div>
    </div>
  );
}

const navBtnStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "var(--text-secondary)",
  textDecoration: "none",
  minWidth: 0,
};

const navBtnEyebrow: CSSProperties = {
  display: "block",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
};

const navBtnTitle: CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
