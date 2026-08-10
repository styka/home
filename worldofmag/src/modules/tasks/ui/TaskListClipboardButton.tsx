"use client";

import { useState } from "react";
import { ClipboardCopy, Check, AlertCircle } from "lucide-react";
import { buildOmniaPrompt, copyLazy, OMNIA_CLIPBOARD_EMPTY } from "@/lib/omniaClipboard";
import type { Task } from "@/types";

type State = "idle" | "copied" | "empty" | "error";

/**
 * Admin-only: kopiuje do schowka prompt dla Claude Code + JSON zadań **tej listy**.
 * Wcześniej funkcja żyła w panelu Admina (jeden zlepek „zadań Omnia"); teraz jest na
 * każdej liście zadań, więc admin bierze do pracy dokładnie te zadania, które ogląda.
 *
 * `tasks` to zadania już przefiltrowane przez aktywną zakładkę (status) i tagi —
 * dokładnie te widoczne na ekranie. Tu tylko składamy prompt i kopiujemy.
 */
export function TaskListClipboardButton({ tasks }: { tasks: Task[] }) {
  const [state, setState] = useState<State>("idle");

  async function handleCopy() {
    let wasEmpty = false;
    const producer = async () => {
      if (tasks.length === 0) {
        wasEmpty = true;
        throw new Error(OMNIA_CLIPBOARD_EMPTY);
      }
      return buildOmniaPrompt(tasks);
    };

    try {
      await copyLazy(producer);
      setState("copied");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState(wasEmpty ? "empty" : "error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const title: Record<State, string> = {
    idle: "Kopiuj prompt dla Claude Code — uruchamia /specify (spec-driven pipeline) z zadaniami z bieżącej zakładki",
    copied: "Skopiowano prompt uruchamiający /specify + JSON zadań",
    empty: "Brak zadań w bieżącej zakładce",
    error: "Błąd kopiowania — spróbuj ponownie",
  };

  const color: Record<State, string> = {
    idle: "var(--text-muted)",
    copied: "var(--accent-green)",
    empty: "var(--accent-amber)",
    error: "var(--accent-red)",
  };

  const Icon =
    state === "copied" ? Check : state === "error" || state === "empty" ? AlertCircle : ClipboardCopy;

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded focus:outline-none"
      style={{ color: color[state] }}
      title={title[state]}
      aria-label={title[state]}
    >
      <Icon size={15} />
    </button>
  );
}
