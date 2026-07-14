"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, FlaskConical, FileText, Layers, ExternalLink } from "lucide-react";
import { deleteEpic, deleteStory, deleteScenario } from "@/actions/qa";
import { QA_MODULES, getModuleInfo } from "@/lib/qaModules";
import { getScenarioTypeColor, getPriorityColor } from "@/lib/qaConstants";

interface AdminScenario {
  id: string;
  slug: string;
  title: string;
  type: string;
  priority: string;
  order: number;
}

interface AdminStory {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  order: number;
  scenarios: AdminScenario[];
}

interface AdminEpic {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  module: string;
  order: number;
  stories: AdminStory[];
}

interface QaAdminTreeProps {
  epics: AdminEpic[];
}

export function QaAdminTree({ epics }: QaAdminTreeProps) {
  // Group epics by module
  const byModule = new Map<string, AdminEpic[]>();
  for (const e of epics) {
    if (!byModule.has(e.module)) byModule.set(e.module, []);
    byModule.get(e.module)!.push(e);
  }

  // All modules — even empty ones — show them
  const modulesToRender = [...QA_MODULES.map((m) => m.slug)];
  Array.from(byModule.keys()).forEach((k) => {
    if (!modulesToRender.includes(k)) modulesToRender.push(k);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {modulesToRender.map((m) => (
        <ModuleSection key={m} module={m} epics={byModule.get(m) ?? []} />
      ))}
    </div>
  );
}

function ModuleSection({ module, epics }: { module: string; epics: AdminEpic[] }) {
  const info = getModuleInfo(module);
  const [open, setOpen] = useState(epics.length > 0);
  const scenarioCount = epics.reduce(
    (s, e) => s + e.stories.reduce((sm, st) => sm + st.scenarios.length, 0),
    0,
  );

  return (
    <div style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          borderBottom: open ? "1px solid var(--border)" : "none",
          borderRadius: open ? "10px 10px 0 0" : 10,
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span style={{ fontSize: 14, fontWeight: 600, color: info.color }}>{info.label}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {epics.length} epików · {scenarioCount} scenariuszy
          </span>
        </button>
        <Link
          href={`/qa/${module}`}
          target="_blank"
          style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
        >
          podgląd <ExternalLink size={10} />
        </Link>
        <Link
          href={`/admin/qa/epic/new?module=${module}`}
          style={{
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 4,
            background: "var(--accent-red)",
            color: "var(--on-accent)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Plus size={10} /> Epic
        </Link>
      </div>
      {open && (
        <div style={{ padding: "8px 12px 12px" }}>
          {epics.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 4px", margin: 0 }}>
              Brak epików — kliknij „+ Epic” by dodać.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {epics.map((epic) => (
                <EpicRow key={epic.id} epic={epic} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EpicRow({ epic }: { epic: AdminEpic }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Usunąć epic „${epic.title}"? Wszystkie user stories i scenariusze zostaną usunięte.`)) return;
    startTransition(async () => {
      try {
        await deleteEpic(epic.slug);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Błąd");
      }
    });
  }

  return (
    <div style={{ borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Layers size={12} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {epic.title}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {epic.stories.length} stories
          </span>
        </button>
        <Link href={`/admin/qa/story/new?epicSlug=${epic.slug}`} title="Dodaj user story" style={iconBtn}>
          <Plus size={11} />
        </Link>
        <Link href={`/admin/qa/epic/${epic.slug}/edit`} title="Edytuj epic" style={iconBtn}>
          <Pencil size={11} />
        </Link>
        <button onClick={handleDelete} disabled={isPending} title="Usuń epic" style={{ ...iconBtn, color: "var(--accent-red)", cursor: isPending ? "wait" : "pointer" }}>
          <Trash2 size={11} />
        </button>
      </div>
      {open && (
        <div style={{ padding: "0 10px 10px 24px" }}>
          {epic.description && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.4 }}>
              {epic.description}
            </p>
          )}
          {epic.stories.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Brak user stories</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {epic.stories.map((s) => (
                <StoryRow key={s.id} story={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StoryRow({ story }: { story: AdminStory }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Usunąć user story „${story.title}"? Wszystkie scenariusze zostaną usunięte.`)) return;
    startTransition(async () => {
      try {
        await deleteStory(story.slug);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Błąd");
      }
    });
  }

  return (
    <div style={{ borderRadius: 4, background: "var(--bg-elevated)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <FileText size={11} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {story.title}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {story.scenarios.length}
          </span>
        </button>
        <Link href={`/admin/qa/scenario/new?storySlug=${story.slug}`} title="Dodaj scenariusz" style={iconBtn}>
          <Plus size={10} />
        </Link>
        <Link href={`/admin/qa/story/${story.slug}/edit`} title="Edytuj story" style={iconBtn}>
          <Pencil size={10} />
        </Link>
        <button onClick={handleDelete} disabled={isPending} title="Usuń story" style={{ ...iconBtn, color: "var(--accent-red)", cursor: isPending ? "wait" : "pointer" }}>
          <Trash2 size={10} />
        </button>
      </div>
      {open && (
        <div style={{ padding: "0 8px 8px 24px", display: "flex", flexDirection: "column", gap: 2 }}>
          {story.scenarios.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Brak scenariuszy</p>
          ) : (
            story.scenarios.map((sc) => <ScenarioRow key={sc.id} scenario={sc} />)
          )}
        </div>
      )}
    </div>
  );
}

function ScenarioRow({ scenario }: { scenario: AdminScenario }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const typeColor = getScenarioTypeColor(scenario.type);
  const priorityColor = getPriorityColor(scenario.priority);

  function handleDelete() {
    if (!confirm(`Usunąć scenariusz „${scenario.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteScenario(scenario.slug);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Błąd");
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px" }}>
      <FlaskConical size={10} style={{ color: typeColor, flexShrink: 0 }} />
      <Link
        href={`/admin/qa/scenario/${scenario.slug}/edit`}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 11,
          color: "var(--text-secondary)",
          textDecoration: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {scenario.title}
      </Link>
      <Badge color={priorityColor}>{scenario.priority}</Badge>
      <Link
        href={`/qa/scenariusz/${scenario.slug}`}
        target="_blank"
        title="Podgląd"
        style={iconBtn}
      >
        <ExternalLink size={10} />
      </Link>
      <button onClick={handleDelete} disabled={isPending} title="Usuń" style={{ ...iconBtn, color: "var(--accent-red)", cursor: isPending ? "wait" : "pointer" }}>
        <Trash2 size={10} />
      </button>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: "1px 4px",
        borderRadius: 3,
        background: `${color}22`,
        color,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 4,
  border: "none",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
  textDecoration: "none",
};
