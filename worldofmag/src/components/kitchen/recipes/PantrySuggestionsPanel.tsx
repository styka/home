"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, ChefHat } from "lucide-react";
import { llm } from "@/lib/llm-client";

interface Suggestion {
  recipeId: string;
  slug: string;
  title: string;
  reason: string;
  matchedIngredients: string[];
}

const DISMISS_KEY = "kitchen.pantrySuggestions.dismissedAt";
const DISMISS_HOURS = 4;

export function PantrySuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const ts = localStorage.getItem(DISMISS_KEY);
      if (ts && Date.now() - Number(ts) < DISMISS_HOURS * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    } catch {
      /* noop */
    }
    let cancelled = false;
    llm.kitchen.suggestFromPantry().then((res) => {
      if (cancelled) return;
      setSuggestions(res.suggestions ?? []);
    }).catch(() => {
      if (!cancelled) setSuggestions([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setDismissed(true);
  }

  if (dismissed || !suggestions || suggestions.length === 0) return null;

  return (
    <section
      className="rounded border p-3"
      style={{
        borderColor: "var(--accent-purple)",
        backgroundColor: "rgba(168, 85, 247, 0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h2
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--accent-purple)" }}
        >
          <Sparkles size={12} /> Z tego co masz w spiżarni
        </h2>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Ukryj propozycje"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {suggestions.map((s) => (
          <Link
            key={s.recipeId}
            href={`/kitchen/recipes/${s.slug}`}
            className="flex-shrink-0 w-48 rounded border p-2.5"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ChefHat size={12} style={{ color: "var(--accent-orange)" }} />
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {s.title}
              </span>
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {s.reason}
            </div>
            {s.matchedIngredients.length > 0 ? (
              <div
                className="text-[10px] mt-1 truncate"
                style={{ color: "var(--text-secondary)" }}
                title={s.matchedIngredients.join(", ")}
              >
                {s.matchedIngredients.slice(0, 3).join(", ")}
                {s.matchedIngredients.length > 3 ? "…" : ""}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
