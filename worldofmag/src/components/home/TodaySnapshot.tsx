"use client";

import Link from "next/link";
import { CheckSquare, ChevronRight, Users, Clock } from "lucide-react";
import type { TaskPriority } from "@/types";
import { TASK_PRIORITY_COLORS } from "@/types";

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
  hasTasksAccess: boolean;
  hasKitchenAccess: boolean;
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

export function TodaySnapshot({ tasks, meals, hasTasksAccess, hasKitchenAccess }: TodaySnapshotProps) {
  const showTasks = hasTasksAccess && tasks.length > 0;
  const showMeals = hasKitchenAccess && meals.length > 0;

  if (!showTasks && !showMeals) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
      {showTasks && <TasksColumn tasks={tasks} />}
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
