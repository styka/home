"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, BookOpen } from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { QuickStats } from "@/components/home/QuickStats";
import { AISuggestions } from "@/components/home/AISuggestions";
import { ContextSelector } from "@/components/home/ContextSelector";
import { ActionDrawer } from "@/components/home/ActionDrawer";
import type { AIAction } from "@/app/api/llm/home/interpret/route";
import type { ActionResult } from "@/app/api/llm/home/execute/route";

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
  const [inputText, setInputText] = useState("");
  const [context, setContext] = useState(["shopping", "tasks", "notes"]);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [pendingActions, setPendingActions] = useState<AIAction[] | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInterpret() {
    const text = inputText.trim();
    if (!text) return;
    setIsInterpreting(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/llm/home/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context, today: new Date().toISOString() }),
      });
      const data = await res.json() as { actions?: AIAction[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Błąd interpretacji");
        return;
      }
      if (!data.actions?.length) {
        setError("Nie rozpoznano żadnych akcji. Spróbuj inaczej sformułować polecenie.");
        return;
      }
      setPendingActions(data.actions);
    } catch {
      setError("Nie udało się połączyć z LLM");
    } finally {
      setIsInterpreting(false);
    }
  }

  async function handleExecute(confirmedActions: AIAction[]) {
    setIsExecuting(true);
    try {
      const res = await fetch("/api/llm/home/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: confirmedActions }),
      });
      const data = await res.json() as { results?: ActionResult[] };
      setResults(data.results ?? []);
      setInputText("");
      setPendingActions(null);
    } catch {
      setResults([]);
    } finally {
      setIsExecuting(false);
    }
  }

  function handleDrawerClose() {
    setPendingActions(null);
    setResults(null);
  }

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

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--border)" }} />

        {/* Context selector */}
        <ContextSelector selected={context} onChange={setContext} />

        {/* Main input */}
        <div>
          <SmartTextarea
            value={inputText}
            onChange={setInputText}
            placeholder={`Wpisz lub powiedz co chcesz zrobić…\nNp. "Dodaj 2x Sachol z Apteki i przesuń termin mycia uszu psa o 2 tygodnie"`}
            rows={4}
            onSubmit={handleInterpret}
          />
          <button
            onClick={handleInterpret}
            disabled={!inputText.trim() || isInterpreting}
            style={{
              marginTop: 10,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 0",
              borderRadius: 10,
              border: "none",
              background: !inputText.trim() || isInterpreting ? "var(--bg-elevated)" : "var(--accent-blue)",
              color: !inputText.trim() || isInterpreting ? "var(--text-muted)" : "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: !inputText.trim() || isInterpreting ? "not-allowed" : "pointer",
              transition: "background 0.1s",
            }}
          >
            {isInterpreting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Interpretuję…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Interpretuj i wykonaj
              </>
            )}
          </button>
          {error && (
            <p style={{ fontSize: 12, color: "var(--accent-red)", marginTop: 8, textAlign: "center" }}>
              {error}
            </p>
          )}
        </div>

        {/* Results summary (after drawer close) */}
        {results && !pendingActions && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, marginBottom: 8 }}>
              Wyniki
            </p>
            {results.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    flexShrink: 0,
                    marginTop: 1,
                    fontSize: 14,
                    color: r.success ? "var(--accent-green)" : "var(--accent-red)",
                  }}
                >
                  {r.success ? "✓" : "✗"}
                </span>
                <div>
                  <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{r.description}</p>
                  {r.error && <p style={{ fontSize: 11, color: "var(--accent-red)", margin: 0 }}>{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

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

      {/* Action Drawer */}
      {pendingActions && (
        <ActionDrawer
          actions={pendingActions}
          onConfirm={handleExecute}
          onClose={handleDrawerClose}
          isExecuting={isExecuting}
        />
      )}
    </div>
  );
}
