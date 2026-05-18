"use client";

import { useState } from "react";
import { Mic, Wand2, ChevronRight, Tag, RefreshCw, ShoppingCart, Filter } from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { StatusBadge } from "@/components/shopping/StatusBadge";
import { TagChip, TAG_COLOR_OPTIONS } from "@/components/notes/TagChip";
import { TaskTagBadge } from "@/components/tasks/TaskTagBadge";
import { RecurringBadge } from "@/components/tasks/RecurringBadge";
import { FilterTabs } from "@/components/shopping/FilterTabs";
import type { FilterTab } from "@/types";

interface ComponentDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  module: string;
}

const COMPONENTS: ComponentDef[] = [
  {
    id: "smart-textarea",
    name: "SmartTextarea",
    description: "Textarea z rozpoznawaniem mowy i modyfikacją głosową przez LLM",
    icon: <Mic size={14} />,
    module: "ui",
  },
  {
    id: "status-badge",
    name: "StatusBadge",
    description: "Badge statusu pozycji na liście zakupów",
    icon: <ShoppingCart size={14} />,
    module: "shopping",
  },
  {
    id: "tag-chip",
    name: "TagChip",
    description: "Chip tagu notatki z kolorem i opcjonalnym usunięciem",
    icon: <Tag size={14} />,
    module: "notes",
  },
  {
    id: "task-tag-badge",
    name: "TaskTagBadge",
    description: "Badge tagu zadania z dynamicznym kolorem",
    icon: <Tag size={14} />,
    module: "tasks",
  },
  {
    id: "recurring-badge",
    name: "RecurringBadge",
    description: "Badge cykliczności zadania z formatowaniem reguły",
    icon: <RefreshCw size={14} />,
    module: "tasks",
  },
  {
    id: "filter-tabs",
    name: "FilterTabs",
    description: "Zakładki filtrowania statusu na liście zakupów",
    icon: <Filter size={14} />,
    module: "shopping",
  },
];

const MODULE_LABELS: Record<string, string> = {
  ui: "Ogólne UI",
  shopping: "Zakupy",
  tasks: "Zadania",
  notes: "Notatki",
};

type PropDef = { name: string; type: string; required: boolean; description: string };

function PropsTable({ props }: { props: PropDef[] }) {
  return (
    <div style={{ borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 8 }}>
      {props.map((prop, i) => (
        <div
          key={prop.name}
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr 1fr",
            gap: 12,
            padding: "9px 14px",
            borderBottom: i < props.length - 1 ? "1px solid var(--border)" : undefined,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <code style={{ fontSize: 12, color: "var(--accent-blue)" }}>{prop.name}</code>
            {prop.required && <span style={{ fontSize: 9, color: "var(--accent-red)", fontWeight: 700 }}>*</span>}
          </div>
          <code style={{ fontSize: 11, color: "var(--text-secondary)" }}>{prop.type}</code>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{prop.description}</span>
        </div>
      ))}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px",
        fontSize: 12,
        color: "var(--text-secondary)",
        overflowX: "auto",
        lineHeight: 1.7,
        margin: 0,
      }}
    >
      <code>{code}</code>
    </pre>
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
        marginBottom: 10,
        marginTop: 0,
      }}
    >
      {children}
    </h3>
  );
}

function DemoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  );
}

// ─── Individual component docs ────────────────────────────────────────────────

function SmartTextareaDoc() {
  const [val, setVal] = useState("");
  return (
    <div style={{ maxWidth: 680 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 20 }}>
        Textarea z wbudowanym rozpoznawaniem mowy (Web Speech API) i modyfikacją tekstu głosową przez LLM
        (<code>/api/llm/normalize</code>). Obsługuje 4 stany UX.
      </p>

      <SectionLabel>Stany UX</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {[
          { state: "idle", label: "Spoczynek — przyciski 🎙 i 🪄 widoczne", color: "var(--text-muted)" },
          { state: "recording", label: "Dyktowanie — czerwony pulsujący MicOff, podgląd transkrypcji", color: "var(--accent-red)" },
          { state: "voice_modify", label: "Modyfikacja głosowa — bursztynowy pulsujący, użytkownik mówi instrukcję", color: "var(--accent-amber)" },
          { state: "processing_modify", label: "Przetwarzanie LLM — niebieska animacja ładowania", color: "var(--accent-blue)" },
        ].map((s) => (
          <div key={s.state} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{ fontSize: 11, background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4, color: s.color, flexShrink: 0 }}>{s.state}</code>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      <SectionLabel>Demo interaktywne</SectionLabel>
      <DemoBox>
        <SmartTextarea value={val} onChange={setVal} placeholder="Wpisz lub dyktuj…" rows={4} />
        {val && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>Długość: {val.length} znaków</p>}
      </DemoBox>

      <SectionLabel>Props</SectionLabel>
      <PropsTable props={[
        { name: "value", type: "string", required: true, description: "Aktualna wartość" },
        { name: "onChange", type: "(v: string) => void", required: true, description: "Callback zmiany" },
        { name: "placeholder", type: "string", required: false, description: "Placeholder" },
        { name: "rows", type: "number", required: false, description: "Liczba wierszy (domyślnie 4)" },
        { name: "onSubmit", type: "() => void", required: false, description: "Ctrl+Enter" },
        { name: "disabled", type: "boolean", required: false, description: "Wyłączenie" },
      ]} />

      <SectionLabel>Kod przykładowy</SectionLabel>
      <CodeBlock code={`import { SmartTextarea } from "@/components/ui/SmartTextarea";

function MyComp() {
  const [text, setText] = useState("");
  return (
    <SmartTextarea
      value={text}
      onChange={setText}
      placeholder="Wpisz lub dyktuj…"
      rows={4}
      onSubmit={() => console.log(text)}
    />
  );
}`} />
    </div>
  );
}

function StatusBadgeDoc() {
  const statuses = ["NEEDED", "IN_CART", "DONE", "MISSING"] as const;
  return (
    <div style={{ maxWidth: 680 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 20 }}>
        Badge wyświetlający status pozycji na liście zakupów. Używa CSS variables dla kolorów i jest czysto wizualny (brak interakcji).
      </p>

      <SectionLabel>Wszystkie warianty</SectionLabel>
      <DemoBox>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {statuses.map((s) => <StatusBadge key={s} status={s} />)}
        </div>
      </DemoBox>

      <SectionLabel>Props</SectionLabel>
      <PropsTable props={[
        { name: "status", type: '"NEEDED" | "IN_CART" | "DONE" | "MISSING"', required: true, description: "Status pozycji" },
        { name: "className", type: "string", required: false, description: "Dodatkowe klasy Tailwind" },
      ]} />

      <SectionLabel>Kod przykładowy</SectionLabel>
      <CodeBlock code={`import { StatusBadge } from "@/components/shopping/StatusBadge";

<StatusBadge status="IN_CART" />
<StatusBadge status="DONE" className="ml-2" />`} />
    </div>
  );
}

function TagChipDoc() {
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const mockTags = TAG_COLOR_OPTIONS.slice(0, 5).map((color, i) => ({
    id: `t${i}`,
    name: ["react", "typescript", "zakupy", "praca", "dom"][i],
    color,
    createdAt: new Date(),
  }));
  const visible = mockTags.filter((t) => !removedIds.includes(t.id));

  return (
    <div style={{ maxWidth: 680 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 20 }}>
        Chip tagu notatki z dynamicznym kolorem. Obsługuje tryb tylko-do-odczytu, klikalny oraz z możliwością usunięcia.
      </p>

      <SectionLabel>Demo — usuwalne tagi</SectionLabel>
      <DemoBox>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {visible.map((t) => (
            <TagChip key={t.id} tag={t} onRemove={() => setRemovedIds((p) => [...p, t.id])} />
          ))}
          {visible.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Wszystkie usunięte — odśwież stronę by przywrócić</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", width: "100%", marginBottom: 4 }}>Rozmiar sm (większy):</span>
          {mockTags.slice(0, 3).map((t) => <TagChip key={t.id} tag={t} size="sm" />)}
        </div>
      </DemoBox>

      <SectionLabel>Props</SectionLabel>
      <PropsTable props={[
        { name: "tag", type: "Tag", required: true, description: "Obiekt tagu (id, name, color)" },
        { name: "onRemove", type: "() => void", required: false, description: "Pokazuje przycisk × do usunięcia" },
        { name: "onClick", type: "() => void", required: false, description: "Czyni chip klikalnym" },
        { name: "active", type: "boolean", required: false, description: "Stan aktywny (border)" },
        { name: "size", type: '"sm" | "xs"', required: false, description: "Rozmiar (domyślnie xs)" },
      ]} />

      <SectionLabel>Dostępne kolory</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
        {TAG_COLOR_OPTIONS.map((color) => (
          <span key={color} style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: color, border: "1px solid rgba(255,255,255,0.1)" }} title={color} />
        ))}
      </div>

      <SectionLabel>Kod przykładowy</SectionLabel>
      <CodeBlock code={`import { TagChip } from "@/components/notes/TagChip";

// Tylko wyświetlanie
<TagChip tag={tag} />

// Z usunięciem
<TagChip tag={tag} onRemove={() => removeTag(tag.id)} />

// Klikalny, z aktywnym stanem
<TagChip tag={tag} onClick={() => toggleTag(tag.id)} active={selectedIds.includes(tag.id)} />`} />
    </div>
  );
}

function TaskTagBadgeDoc() {
  const mockTags = [
    { id: "1", name: "bug", color: "#ef4444" },
    { id: "2", name: "feature", color: "#3b82f6" },
    { id: "3", name: "refactor", color: "#8b5cf6" },
    { id: "4", name: "docs", color: "#10b981" },
    { id: "5", name: "urgent", color: "#f59e0b" },
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 20 }}>
        Badge tagu zadania. Kolor jest definiowany per-tag jako HEX i jest używany do generowania tła (15% opacity) i obramowania.
      </p>

      <SectionLabel>Demo — wszystkie rozmiary</SectionLabel>
      <DemoBox>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", width: "100%", marginBottom: 2 }}>Rozmiar sm:</span>
          {mockTags.map((t) => <TaskTagBadge key={t.id} tag={t as never} size="sm" />)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", width: "100%", marginBottom: 2 }}>Rozmiar xs:</span>
          {mockTags.map((t) => <TaskTagBadge key={t.id} tag={t as never} size="xs" />)}
        </div>
      </DemoBox>

      <SectionLabel>Props</SectionLabel>
      <PropsTable props={[
        { name: "tag", type: "TaskTagDef", required: true, description: "Definicja tagu zadania (id, name, color?)" },
        { name: "onRemove", type: "() => void", required: false, description: "Przycisk × do usunięcia" },
        { name: "size", type: '"sm" | "xs"', required: false, description: "Rozmiar (domyślnie sm)" },
      ]} />

      <SectionLabel>Kod przykładowy</SectionLabel>
      <CodeBlock code={`import { TaskTagBadge } from "@/components/tasks/TaskTagBadge";

<TaskTagBadge tag={tag} />
<TaskTagBadge tag={tag} size="xs" onRemove={() => removeTag(tag.id)} />`} />
    </div>
  );
}

function RecurringBadgeDoc() {
  const examples = [
    { recurring: JSON.stringify({ type: "DAILY", interval: 1 }), label: "codziennie" },
    { recurring: JSON.stringify({ type: "WEEKLY", interval: 1, daysOfWeek: [1, 3, 5] }), label: "Pn, Śr, Pt" },
    { recurring: JSON.stringify({ type: "MONTHLY", interval: 2 }), label: "co 2 miesiące" },
    { recurring: JSON.stringify({ type: "YEARLY", interval: 1 }), label: "co rok" },
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 20 }}>
        Badge wyświetlający regułę cykliczności zadania. Przyjmuje JSON-serialized <code>RecurringRule</code> i formatuje go jako czytelny tekst.
      </p>

      <SectionLabel>Demo — przykłady reguł</SectionLabel>
      <DemoBox>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {examples.map((ex) => (
            <div key={ex.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <RecurringBadge recurring={ex.recurring} />
              <code style={{ fontSize: 11, color: "var(--text-muted)" }}>{ex.recurring}</code>
            </div>
          ))}
        </div>
      </DemoBox>

      <SectionLabel>Typ RecurringRule</SectionLabel>
      <CodeBlock code={`type RecurringRule = {
  type: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;        // co ile jednostek
  daysOfWeek?: number[];   // [0-6], tylko dla WEEKLY
  endDate?: string;        // ISO — kiedy kończyć
}`} />

      <SectionLabel>Props</SectionLabel>
      <PropsTable props={[
        { name: "recurring", type: "string", required: true, description: "JSON-serialized RecurringRule (z pola task.recurring)" },
      ]} />

      <SectionLabel>Kod przykładowy</SectionLabel>
      <CodeBlock code={`import { RecurringBadge } from "@/components/tasks/RecurringBadge";

// task.recurring to string JSON z bazy danych
{task.recurring && <RecurringBadge recurring={task.recurring} />}`} />
    </div>
  );
}

function FilterTabsDoc() {
  const [active, setActive] = useState<FilterTab>("ALL");
  const mockCounts = { ALL: 12, NEEDED: 5, IN_CART: 3, DONE: 3, MISSING: 1 };

  return (
    <div style={{ maxWidth: 680 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 20 }}>
        Zakładki filtrowania listy zakupów według statusu. Zawiera liczniki i skróty klawiaturowe (1–5).
      </p>

      <SectionLabel>Demo interaktywne</SectionLabel>
      <div style={{ marginBottom: 24, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <FilterTabs active={active} counts={mockCounts} onChange={setActive} />
        <div style={{ padding: "12px 16px" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Aktywny filtr: </span>
          <code style={{ fontSize: 12, color: "var(--accent-blue)" }}>{active}</code>
        </div>
      </div>

      <SectionLabel>Props</SectionLabel>
      <PropsTable props={[
        { name: "active", type: "FilterTab", required: true, description: 'Aktywna zakładka ("ALL" | "NEEDED" | "IN_CART" | "DONE" | "MISSING")' },
        { name: "counts", type: "Record<FilterTab, number>", required: true, description: "Liczniki dla każdej zakładki" },
        { name: "onChange", type: "(tab: FilterTab) => void", required: true, description: "Callback zmiany zakładki" },
      ]} />

      <SectionLabel>Kod przykładowy</SectionLabel>
      <CodeBlock code={`import { FilterTabs } from "@/components/shopping/FilterTabs";
import type { FilterTab } from "@/types";

const [active, setActive] = useState<FilterTab>("ALL");
const counts = { ALL: 10, NEEDED: 5, IN_CART: 2, DONE: 2, MISSING: 1 };

<FilterTabs active={active} counts={counts} onChange={setActive} />`} />
    </div>
  );
}

// ─── Main playground ──────────────────────────────────────────────────────────

const MODULE_ORDER = ["ui", "shopping", "notes", "tasks"];

export function ComponentPlayground() {
  const [activeId, setActiveId] = useState("smart-textarea");

  const activeComp = COMPONENTS.find((c) => c.id === activeId);

  const grouped = MODULE_ORDER.map((mod) => ({
    module: mod,
    label: MODULE_LABELS[mod],
    components: COMPONENTS.filter((c) => c.module === mod),
  }));

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Sidebar */}
      <div
        className="hidden md:flex flex-col"
        style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", overflowY: "auto", padding: "8px 0" }}
      >
        {grouped.map((group) => (
          <div key={group.module}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "10px 16px 4px" }}>
              {group.label}
            </p>
            {group.components.map((comp) => {
              const isActive = activeId === comp.id;
              return (
                <button
                  key={comp.id}
                  onClick={() => setActiveId(comp.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 16px",
                    background: isActive ? "var(--bg-elevated)" : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${isActive ? "var(--accent-purple)" : "transparent"}`,
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{comp.icon}</span>
                  <span style={{ flex: 1 }}>{comp.name}</span>
                  {isActive && <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Mobile: component select */}
      <div className="md:hidden px-4 py-2 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <select
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none"
          style={{ color: "var(--text-primary)" }}
        >
          {COMPONENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {activeComp && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: "var(--accent-purple)" }}>{activeComp.icon}</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{activeComp.name}</h2>
              <span
                style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
              >
                {MODULE_LABELS[activeComp.module]}
              </span>
            </div>
          </div>
        )}

        {activeId === "smart-textarea" && <SmartTextareaDoc />}
        {activeId === "status-badge" && <StatusBadgeDoc />}
        {activeId === "tag-chip" && <TagChipDoc />}
        {activeId === "task-tag-badge" && <TaskTagBadgeDoc />}
        {activeId === "recurring-badge" && <RecurringBadgeDoc />}
        {activeId === "filter-tabs" && <FilterTabsDoc />}
      </div>
    </div>
  );
}
