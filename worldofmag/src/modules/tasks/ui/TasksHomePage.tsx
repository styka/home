"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckSquare,
  Plus,
  ChevronRight,
  Inbox,
  CalendarClock,
  CalendarDays,
  AlertCircle,
  LayoutList,
  Loader2,
  Tag,
  Users,
  Layers,
} from "lucide-react";
import { createTaskProject } from "../actions/taskProjects";
import { createObszarProjektow } from "../actions/obszaryProjektow";
import { splaszczDrzewo } from "../lib/poddrzewoObszarow";
import { ZDARZENIE_ZMIANY_OBSZAROW } from "./FiltrObszarow";
import { ModalDodaniaZadania } from "./ModalDodaniaZadania";
import { StatTile, SectionHeading, ManagementGrid, EmptyState } from "@/components/ui/home";
import { ModuleView } from "@/components/ui/view";
import { useAkcjaZAdresu } from "@/lib/nawigacja/akcjaZAdresu";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { ObszarProjektow, TaskProject, TaskPriority } from "@/types";
import { TASK_PRIORITY_COLORS } from "@/types";

interface TodayPreviewItem {
  id: string;
  title: string;
  priority: TaskPriority;
  projectId: string | null;
  projectName: string | null;
  projectEmoji: string | null;
}

interface TasksHomePageProps {
  projects: TaskProject[];
  /** 125: drzewo obszarów-kategorii (sekcja na stronie głównej modułu). */
  obszary?: ObszarProjektow[];
  todayCount: number;
  upcomingCount: number;
  overdueCount: number;
  todayPreview: TodayPreviewItem[];
  /** 105/121: projekt ostatnio utworzonego zadania — domyślny cel w modalu dodawania. */
  ostatniProjektId?: string | null;
}

export function TasksHomePage({
  projects,
  obszary = [],
  todayCount,
  upcomingCount,
  overdueCount,
  todayPreview,
  ostatniProjektId,
}: TasksHomePageProps) {
  const t = useTranslations("modules.tasks.TasksHomePage");
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  // 125: tworzenie obszaru NAJWYŻSZEGO poziomu żyje tutaj — dropdown w widoku obszaru tworzy
  // wyłącznie pod-obszary, więc bez tego formularza pierwszy obszar nie miałby jak powstać.
  const [dodawanieObszaru, setDodawanieObszaru] = useState(false);
  const [nazwaObszaru, setNazwaObszaru] = useState("");
  const [zapisObszaru, startZapisObszaru] = useTransition();
  function utworzObszar() {
    const nazwa = nazwaObszaru.trim();
    if (!nazwa) return;
    startZapisObszaru(async () => {
      try {
        await createObszarProjektow({ name: nazwa });
        window.dispatchEvent(new Event(ZDARZENIE_ZMIANY_OBSZAROW));
        setNazwaObszaru("");
        setDodawanieObszaru(false);
        router.refresh();
      } catch { /* nazwa pusta / brak dostępu — zostawiamy formularz otwarty */ }
    });
  }
  /**
   * 121 (zgł. 2): dodawanie zadania w MODALU zamiast stałego widgetu (105) — decyzja właściciela:
   * na stronie modułu ma stać przycisk jak przy projekcie, „byle nie rozwijane inline". Ten sam
   * modal co w widoku projektu (118), tu z wyborem projektu docelowego.
   */
  const [dodawanieZadania, setDodawanieZadania] = useState(false);
  // Projekt sprzed chwili mógł zostać skasowany albo należeć do przestrzeni, której już nie
  // widzimy — wtedy domyślną jest Skrzynka, a nie martwe id, które select i tak by odrzucił.
  const domyslnyProjektId = useMemo(
    () => (ostatniProjektId && projects.some((p) => p.id === ostatniProjektId) ? ostatniProjektId : null),
    [ostatniProjektId, projects],
  );
  // `a`/`n` otwierają modal — tak jak w widoku projektu (i jak oczekują klikacze e2e).
  useKeyboardShortcuts(
    useMemo(() => ({ onQuickAdd: () => setDodawanieZadania(true) }), []),
  );
  /**
   * 103: gest w dolnym pasku umie prowadzić nie tylko do modułu, ale i do jego AKCJI — a akcję
   * niesie adres (`/tasks?akcja=nowy-projekt`), nie kod wykonywany przez powłokę. Dzięki temu ten
   * sam adres działa z wachlarza, z linku i z zapisanych ulubionych.
   */
  const akcjaNowyProjekt = useAkcjaZAdresu("nowy-projekt");
  useEffect(() => {
    if (akcjaNowyProjekt.aktywna) setIsAdding(true);
  }, [akcjaNowyProjekt.aktywna]);

  /**
   * Zamknięcie formularza czyści parametr z adresu. Bez tego zapisany w ulubionych adres z akcją
   * odtwarzałby formularz przy każdym wejściu, a adres mówiłby co innego niż to, co widać.
   */
  const zamknijDodawanie = () => {
    setIsAdding(false);
    akcjaNowyProjekt.zamknij();
  };
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();

  const inbox = projects.find((p) => p.isInbox);
  const regularProjects = projects.filter((p) => !p.isInbox);
  const totalOpenCount = todayCount + upcomingCount + overdueCount;

  const subtitle =
    overdueCount > 0
      ? `${overdueCount} ${pluralizePolish(overdueCount, "zaległe", "zaległe", "zaległych")} zadanie · ${todayCount} na dziś`
      : todayCount > 0
      ? `${todayCount} ${pluralizePolish(todayCount, "zadanie", "zadania", "zadań")} na dziś`
      : upcomingCount > 0
      ? `${upcomingCount} ${pluralizePolish(upcomingCount, "zadanie", "zadania", "zadań")} nadchodzących`
      : regularProjects.length > 0
      ? `${regularProjects.length} ${pluralizePolish(regularProjects.length, "projekt", "projekty", "projektów")}`
      : "Zacznij od utworzenia projektu";

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      await createTaskProject(name);
      setNewName("");
      zamknijDodawanie();
    });
  }

  return (
    <ModuleView
      width="narrow"
      state="ready"
      icon={<CheckSquare size={22} />}
      iconColor="var(--accent-green)"
      title="Zadania"
      subtitle={subtitle}
      headerAction={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 121 (zgł. 2): główna akcja modułu — zadanie dodaje się w modalu, nie w inline widgecie. */}
          <button
            onClick={() => setDodawanieZadania(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent-green)",
              color: "var(--on-accent)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={13} />
            {t("noweZadanie")}
          </button>
          <button
            onClick={() => (isAdding ? zamknijDodawanie() : setIsAdding(true))}
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
            Nowy projekt
          </button>
        </div>
      }
    >

      {/* 121 (zgł. 2): modal dodawania zadania — ten sam co w widoku projektu (118), z wyborem
          projektu docelowego. Po zapisie przechodzimy do szczegółów nowego zadania w jego
          projekcie (`?task=<id>` czyta `TasksRouteView`) — zachowanie 1:1 z dawnym widgetem. */}
      {dodawanieZadania && (
        <ModalDodaniaZadania
          projectId="all"
          pokazWyborProjektu
          projekty={projects}
          domyslnyProjektId={domyslnyProjektId}
          onClose={() => setDodawanieZadania(false)}
          onCreated={(task, projektId) => {
            router.push(`/tasks/${projektId ?? "all"}?task=${task.id}`);
          }}
        />
      )}

      {isAdding && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") zamknijDodawanie();
            }}
            placeholder="Nazwa projektu…"
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
            disabled={isPending || !newName.trim()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent-green)",
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
            onClick={zamknijDodawanie}
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

      {/* Stats — replaces "Widoki", each tile is clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <StatTile
          value={todayCount}
          label={t("dzis")}
          color={todayCount > 0 ? "var(--accent-blue)" : "var(--text-muted)"}
          icon={<CalendarClock size={14} />}
          href="/tasks/today"
        />
        <StatTile
          value={overdueCount}
          label={t("zalegle")}
          color={overdueCount > 0 ? "var(--accent-red)" : "var(--text-muted)"}
          icon={<AlertCircle size={14} />}
          href="/tasks/overdue"
          emphasized={overdueCount > 0}
        />
        <StatTile
          value={upcomingCount}
          label={t("nadchodzace")}
          color={upcomingCount > 0 ? "var(--accent-amber)" : "var(--text-muted)"}
          icon={<CalendarDays size={14} />}
          href="/tasks/upcoming"
        />
        <StatTile
          value={totalOpenCount}
          label="Wszystkie otwarte"
          color="var(--text-secondary)"
          icon={<LayoutList size={14} />}
          href="/tasks/all"
        />
      </div>

      {/* Today preview */}
      {todayPreview.length > 0 && (
        <div>
          <SectionHeading
            action={
              <Link
                href="/tasks/today"
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                Zobacz wszystkie <ChevronRight size={11} />
              </Link>
            }
          >
            {t("naDzis")}
          </SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayPreview.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.projectId ?? "today"}`}
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
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: TASK_PRIORITY_COLORS[task.priority],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {task.title}
                </span>
                {task.projectName && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                    {task.projectEmoji && <span>{task.projectEmoji}</span>}
                    {task.projectName}
                  </span>
                )}
                <ChevronRight size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Inbox */}
      {inbox && (
        <div>
          <SectionHeading>Skrzynka</SectionHeading>
          <ProjectCard project={inbox} />
        </div>
      )}

      {/* 125: Obszary — kategorie projektów (drzewo), z licznikami i wejściem do widoku zbiorczego. */}
      <div>
        <SectionHeading
          action={
            dodawanieObszaru ? undefined : (
              <button
                onClick={() => setDodawanieObszaru(true)}
                className="flex items-center gap-1 text-xs focus:outline-none"
                style={{ color: "var(--text-muted)" }}
              >
                <Plus size={13} /> {t("nowyObszar")}
              </button>
            )
          }
        >
          {t("obszary")}
        </SectionHeading>
        {dodawanieObszaru && (
          <div className="mb-2 flex items-center gap-2">
            <input
              autoFocus
              value={nazwaObszaru}
              onChange={(e) => setNazwaObszaru(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") utworzObszar(); if (e.key === "Escape") { setDodawanieObszaru(false); setNazwaObszaru(""); } }}
              placeholder={t("nazwaObszaru")}
              aria-label={t("nazwaObszaru")}
              className="min-w-0 flex-1 rounded border bg-transparent px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <button
              onClick={utworzObszar}
              disabled={!nazwaObszaru.trim() || zapisObszaru}
              className="flex shrink-0 items-center gap-1 rounded px-3 py-2 text-sm disabled:opacity-40 focus:outline-none"
              style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
            >
              {zapisObszaru ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("utworz")}
            </button>
          </div>
        )}
        {obszary.length === 0 ? (
          !dodawanieObszaru && (
            <EmptyState
              icon={<Layers size={28} />}
              message={t("brakObszarow")}
              hint={t("brakObszarowPodpowiedz")}
              cta={{ label: `+ ${t("nowyObszar")}`, onClick: () => setDodawanieObszaru(true), color: "var(--accent-blue)" }}
            />
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {splaszczDrzewo(obszary).map((o) => (
              <Link
                key={o.id}
                href={`/tasks/obszar/${o.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  marginLeft: o.glebokosc * 16,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontSize: 18 }}>{o.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {o.name}
                </span>
                {o.color && <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: o.color }} />}
                <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("licznikObszaru", { projekty: o.projectCount ?? 0, zadania: o.activeCount ?? 0 })}
                </span>
                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Projects */}
      <div>
        <SectionHeading>Projekty</SectionHeading>
        {regularProjects.length === 0 ? (
          <EmptyState
            icon={<CheckSquare size={28} />}
            message="Brak projektów"
            hint="Stwórz projekt, żeby grupować zadania tematycznie"
            cta={{ label: "+ Nowy projekt", onClick: () => setIsAdding(true), color: "var(--accent-green)" }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {regularProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Management */}
      <div>
        <SectionHeading>{t("zarzadzanie")}</SectionHeading>
        <ManagementGrid
          items={[
            { href: "/tasks/tags", icon: <Tag size={16} />, label: "Tagi", color: "var(--accent-green)" },
            { href: "/tasks/all", icon: <LayoutList size={16} />, label: "Wszystkie zadania", color: "var(--accent-green)" },
          ]}
        />
      </div>
    </ModuleView>
  );
}

function ProjectCard({ project }: { project: TaskProject }) {
  return (
    <Link
      href={`/tasks/${project.id}`}
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
      {project.isInbox ? (
        <Inbox size={16} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
      ) : (
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{project.emoji}</span>
      )}
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {project.name}
      </span>
      {project.workspace?.teamId && (
        <span
          style={{
            fontSize: 11,
            padding: "1px 5px",
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
          Team
        </span>
      )}
      {project._count?.tasks != null && project._count.tasks > 0 && (
        <span
          style={{
            fontSize: 12,
            color: "var(--accent-green)",
            background: "rgba(34,197,94,0.1)",
            padding: "2px 8px",
            borderRadius: 10,
            border: "1px solid rgba(34,197,94,0.2)",
            fontWeight: 600,
          }}
        >
          {project._count.tasks}
        </span>
      )}
      <ChevronRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
    </Link>
  );
}

function pluralizePolish(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
