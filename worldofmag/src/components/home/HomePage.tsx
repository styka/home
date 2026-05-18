"use client";

import Link from "next/link";
import { Sparkles, BookOpen } from "lucide-react";
import { QuickStats } from "@/components/home/QuickStats";
import { AISuggestions } from "@/components/home/AISuggestions";
import { AICommandSheet } from "@/components/home/AICommandSheet";

interface ActivityItem {
  module: string;
  action: string;
  createdAt: Date;
}

interface HomePageProps {
  userName: string | null;
  pendingItems: number;
  todayTasks: number;
  overdueTasks: number;
  recentActivity: ActivityItem[];
}

function getGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? "Dzień dobry" : hour < 18 ? "Cześć" : "Dobry wieczór";
  const firstName = name?.split(" ")[0] ?? null;
  return firstName ? `${prefix}, ${firstName}!` : `${prefix}!`;
}

export function HomePage({ userName, pendingItems, todayTasks, overdueTasks, recentActivity }: HomePageProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        backgroundColor: "var(--bg-base)",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Greeting */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Sparkles size={18} style={{ color: "var(--accent-purple)" }} />
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              {getGreeting(userName)}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Co możemy dziś razem zrobić?
          </p>
        </div>

        {/* Quick stats */}
        <QuickStats
          pendingItems={pendingItems}
          todayTasks={todayTasks}
          overdueTasks={overdueTasks}
        />

        {/* AI suggestions */}
        <AISuggestions recentActivity={recentActivity} overdueTasks={overdueTasks} />

        {/* Footer links */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            paddingBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/tasks"
            style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
          >
            Zadania
          </Link>
          <span style={{ color: "var(--border)" }}>·</span>
          <Link
            href="/shopping"
            style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}
          >
            Zakupy
          </Link>
          <span style={{ color: "var(--border)" }}>·</span>
          <Link
            href="/notes"
            style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}
          >
            Notatki
          </Link>
          <span style={{ color: "var(--border)" }}>·</span>
          <Link
            href="/guide"
            style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
          >
            <BookOpen size={11} />
            Jak to działa?
          </Link>
        </div>
      </div>

      <AICommandSheet context={["shopping", "tasks", "notes"]} />
    </div>
  );
}
