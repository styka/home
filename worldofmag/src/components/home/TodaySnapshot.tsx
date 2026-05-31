"use client";

import Link from "next/link";
import { CheckSquare, ChevronRight, Users, Clock, PawPrint, Car, ShieldCheck, Wrench, AlertCircle } from "lucide-react";
import type { TaskPriority, CareAgendaItem } from "@/types";
import { TASK_PRIORITY_COLORS } from "@/types";

interface VehicleAlert {
  id: string;
  name: string;
  type: "inspection" | "insurance";
  dueAt: string;
  daysLeft: number;
}

interface TodayTaskPreview {
  id: string;
  title: string;
  priority: TaskPriority;
  projectId: string | null;
  projectName: string | null;
  projectEmoji: string | null;
}

interface TodayMealPreview {
  id: string;
  slot: string;
  title: string;
  recipeSlug: string | null;
  servings: number;
}

interface TodaySnapshotProps {
  tasks: TodayTaskPreview[];
  meals: TodayMealPreview[];
  petAgenda: CareAgendaItem[];
  vehicleAlerts: VehicleAlert[];
  hasTasksAccess: boolean;
  hasKitchenAccess: boolean;
  hasPetsAccess: boolean;
  hasFlotaAccess: boolean;
}

const SLOT_EMOJI: Record<string, string> = {
  breakfast: "☕",
  lunch: "🍽",
  dinner: "🌙",
  snack: "🍪",
};

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

const SPECIES_EMOJI: Record<string, string> = {
  DOG: "🐕",
  CAT: "🐈",
  REPTILE: "🦎",
  SNAKE: "🐍",
  BIRD: "🦜",
  FISH: "🐟",
  RODENT: "🐹",
  RABBIT: "🐰",
};

const BUCKET_COLOR: Record<CareAgendaItem["bucket"], string> = {
  OVERDUE: "var(--accent-red)",
  TODAY: "var(--accent-orange)",
  UPCOMING: "var(--text-muted)",
};

export function TodaySnapshot({
  tasks,
  meals,
  petAgenda,
  vehicleAlerts,
  hasTasksAccess,
  hasKitchenAccess,
  hasPetsAccess,
  hasFlotaAccess,
}: TodaySnapshotProps) {
  const showTasks = hasTasksAccess && tasks.length > 0;
  const showMeals = hasKitchenAccess && meals.length > 0;
  const showPets = hasPetsAccess && petAgenda.length > 0;
  const showVehicles = hasFlotaAccess && vehicleAlerts.length > 0;

  if (!showTasks && !showMeals && !showPets && !showVehicles) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
      {showTasks && <TasksColumn tasks={tasks} />}
      {showPets && <PetsColumn agenda={petAgenda} />}
      {showVehicles && <VehiclesColumn alerts={vehicleAlerts} />}
      {showMeals && <MealsColumn meals={meals} />}
    </div>
  );
}

function TasksColumn({ tasks }: { tasks: TodayTaskPreview[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent-green)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <CheckSquare size={13} /> Zadania
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginLeft: 4 }}>
            {tasks.length}
          </span>
        </h3>
        <Link
          href="/tasks/today"
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          Wszystkie <ChevronRight size={11} />
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={`/tasks/${task.projectId ?? "today"}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              background: "var(--bg-elevated)",
              textDecoration: "none",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
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
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                {task.projectEmoji && <span>{task.projectEmoji}</span>}
                {task.projectName}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function PetsColumn({ agenda }: { agenda: CareAgendaItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent-orange)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <PawPrint size={13} /> Opieka
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginLeft: 4 }}>
            {agenda.length}
          </span>
        </h3>
        <Link
          href="/pets/calendar"
          style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}
        >
          Kalendarz <ChevronRight size={11} />
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {agenda.map((item) => (
          <Link
            key={item.id}
            href={`/pets/${item.petId}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              background: "var(--bg-elevated)",
              textDecoration: "none",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: BUCKET_COLOR[item.bucket],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, flexShrink: 0 }}>{SPECIES_EMOJI[item.petSpecies] ?? "🐾"}</span>
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
              {item.title}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{item.petName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function VehiclesColumn({ alerts }: { alerts: VehicleAlert[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent-blue)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <Car size={13} /> Flota
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginLeft: 4 }}>
            {alerts.length}
          </span>
        </h3>
        <Link
          href="/flota"
          style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}
        >
          Pojazdy <ChevronRight size={11} />
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {alerts.map((alert) => {
          const overdue = alert.daysLeft < 0;
          const Icon = alert.type === "inspection" ? Wrench : ShieldCheck;
          const color = overdue ? "var(--accent-red)" : alert.daysLeft <= 7 ? "var(--accent-orange)" : "var(--text-muted)";
          return (
            <Link
              key={`${alert.id}-${alert.type}`}
              href={`/flota/${alert.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--bg-elevated)",
                textDecoration: "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--bg-elevated)";
              }}
            >
              {overdue ? (
                <AlertCircle size={13} style={{ color, flexShrink: 0 }} />
              ) : (
                <Icon size={13} style={{ color, flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 54, flexShrink: 0 }}>
                {alert.type === "inspection" ? "Przegląd" : "OC/AC"}
              </span>
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
                {alert.name}
              </span>
              <span style={{ fontSize: 11, color, flexShrink: 0, fontWeight: overdue ? 600 : 400 }}>
                {dueLabel(alert.daysLeft)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function dueLabel(daysLeft: number): string {
  if (daysLeft < 0) {
    const d = Math.abs(daysLeft);
    return `${d} dni temu`;
  }
  if (daysLeft === 0) return "dziś";
  if (daysLeft === 1) return "jutro";
  return `za ${daysLeft} dni`;
}

function MealsColumn({ meals }: { meals: TodayMealPreview[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent-orange)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <Clock size={13} /> Posiłki
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginLeft: 4 }}>
            {meals.length}
          </span>
        </h3>
        <Link
          href="/kitchen/plan"
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          Plan <ChevronRight size={11} />
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {meals.map((meal) => {
          const Wrapper: React.ElementType = meal.recipeSlug ? Link : "div";
          const wrapperProps = meal.recipeSlug
            ? {
                href: `/kitchen/recipes/${meal.recipeSlug}`,
                onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                },
                onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.background = "var(--bg-elevated)";
                },
              }
            : {};
          return (
            <Wrapper
              key={meal.id}
              {...wrapperProps}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--bg-elevated)",
                textDecoration: "none",
                transition: "background 0.1s",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{SLOT_EMOJI[meal.slot] ?? "🍽"}</span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  minWidth: 54,
                  flexShrink: 0,
                }}
              >
                {SLOT_LABELS[meal.slot] ?? meal.slot}
              </span>
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
                {meal.title}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  flexShrink: 0,
                }}
              >
                <Users size={9} /> {meal.servings}
              </span>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
