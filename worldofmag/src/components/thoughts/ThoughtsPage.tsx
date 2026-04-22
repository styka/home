"use client";

import { Brain } from "lucide-react";
import { ThoughtComposer } from "./ThoughtComposer";
import { ThoughtCard } from "./ThoughtCard";
import type { ThoughtWithAttachments } from "@/types";

interface ThoughtsPageProps {
  thoughts: ThoughtWithAttachments[];
}

function pluralMysl(n: number) {
  if (n === 1) return "myśl";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "myśli";
  return "myśli";
}

export function ThoughtsPage({ thoughts }: ThoughtsPageProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 h-12 border-b flex-shrink-0"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <Brain size={16} style={{ color: "var(--accent-purple)" }} />
        <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Thoughts
        </h1>
        {thoughts.length > 0 && (
          <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
            {thoughts.length} {pluralMysl(thoughts.length)}
          </span>
        )}
      </div>

      {/* Composer */}
      <ThoughtComposer />

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {thoughts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Brain size={36} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Brak myśli. Zapisz pierwszą!
            </p>
          </div>
        ) : (
          thoughts.map((thought) => <ThoughtCard key={thought.id} thought={thought} />)
        )}
      </div>
    </div>
  );
}
