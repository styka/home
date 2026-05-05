"use client";

import { useState, useRef, useTransition } from "react";
import { Mic, MicOff, Loader2, Plus, CheckSquare, Square, Sparkles, X } from "lucide-react";
import { createTask } from "@/actions/tasks";
import { createTaskTag } from "@/actions/taskTags";
import type { TaskPriority, TaskTagDef, RecurringRule } from "@/types";
import { TASK_PRIORITY_LABELS } from "@/types";
import { cn } from "@/lib/cn";

interface ParsedTask {
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  estimatedMins: number | null;
  tags: string[];
  recurring: RecurringRule | null;
  selected: boolean;
}

interface AITaskInputProps {
  projectId: string;
  allTags: TaskTagDef[];
}

interface ISpeechResult {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
}
interface ISpeechError { error: string }
interface ISpeechRecognition extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: ISpeechResult) => void) | null;
  onerror: ((e: ISpeechError) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}
interface ISpeechRecognitionCtor { new(): ISpeechRecognition }
declare global {
  interface Window { SpeechRecognition?: ISpeechRecognitionCtor; webkitSpeechRecognition?: ISpeechRecognitionCtor; }
}

export function AITaskInput({ projectId, allTags }: AITaskInputProps) {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isPending, startTransition] = useTransition();
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const showResults = tasks.length > 0;

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }

  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Twoja przeglądarka nie obsługuje rozpoznawania mowy."); return; }
    const rec = new SR();
    rec.lang = "pl-PL";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let newFinal = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) newFinal += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setTranscript((prev: string) => {
        const updated = prev + newFinal;
        setText(updated + interim);
        return updated;
      });
    };
    rec.onerror = (e) => { setError(`Błąd mikrofonu: ${e.error}`); stopRecording(); };
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
    setError(null);
  }

  async function processText() {
    const input = text.trim();
    if (!input) return;
    stopRecording();
    setLoading(true);
    setError(null);
    setTasks([]);

    try {
      const res = await fetch("/api/llm/tasks/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, today: new Date().toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Błąd przetwarzania"); return; }

      const parsed = (data.tasks as ParsedTask[]).map((t) => ({ ...t, selected: true }));
      setTasks(parsed);
    } catch {
      setError("Nie udało się połączyć z LLM");
    } finally {
      setLoading(false);
    }
  }

  function updateTask(i: number, patch: Partial<ParsedTask>) {
    setTasks((prev: ParsedTask[]) => prev.map((t: ParsedTask, idx: number) => idx === i ? { ...t, ...patch } : t));
  }

  function addTasks() {
    const toAdd = tasks.filter((t) => t.selected);
    if (toAdd.length === 0) return;

    startTransition(async () => {
      for (const t of toAdd) {
        const tagIds: string[] = [];
        for (const tagName of t.tags) {
          const existing = allTags.find((tag) => tag.name === tagName.toLowerCase());
          if (existing) {
            tagIds.push(existing.id);
          } else {
            const newTag = await createTaskTag(tagName);
            tagIds.push(newTag.id);
          }
        }

        await createTask({
          title: t.title,
          description: t.description,
          priority: t.priority,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          estimatedMins: t.estimatedMins,
          recurring: t.recurring,
          projectId: ["today", "upcoming", "overdue"].includes(projectId) ? null : projectId,
          tagIds,
        });
      }
      reset();
    });
  }

  function reset() {
    setTasks([]); setText(""); setTranscript(""); setError(null); stopRecording();
  }

  const selectedCount = tasks.filter((t: ParsedTask) => t.selected).length;

  return (
    <div
      className="border-b flex-shrink-0"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)", borderLeft: "3px solid var(--accent-blue)" }}
    >
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-1" style={{ color: "var(--accent-blue)" }}>
        <Sparkles size={11} />
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Dodaj przez AI</span>
      </div>

      {!showResults && (
        <div className="px-4 pb-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Opisz zadanie lub powiedz co masz do zrobienia…\nNp. \"Zadzwoń do klienta w piątek, pilne, 30 minut\""}
            rows={2}
            className="w-full bg-transparent text-sm focus:outline-none resize-none mono"
            style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)", lineHeight: 1.5 }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) processText(); }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => recording ? stopRecording() : startRecording()}
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium focus:outline-none", recording && "animate-pulse")}
              style={{
                backgroundColor: recording ? "rgba(239,68,68,0.15)" : "var(--bg-surface)",
                color: recording ? "var(--accent-red)" : "var(--text-secondary)",
                border: `1px solid ${recording ? "var(--accent-red)" : "var(--border)"}`,
              }}
            >
              {recording ? <MicOff size={13} /> : <Mic size={13} />}
              {recording ? "Stop" : "Mów"}
            </button>
            <button
              onClick={processText}
              disabled={!text.trim() || loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium focus:outline-none disabled:opacity-40"
              style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Przetwórz
            </button>
            {recording && (
              <span className="text-xs" style={{ color: "var(--accent-red)" }}>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "var(--accent-red)", animation: "pulse 1s infinite" }} />
                Słucham…
              </span>
            )}
          </div>
          {error && <p className="text-xs mt-1.5" style={{ color: "var(--accent-red)" }}>{error}</p>}
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Ctrl+Enter aby przetworzyć</p>
        </div>
      )}

      {showResults && (
        <>
          <div className="px-4 pb-1">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Rozpoznane zadania — zaznacz które dodać</p>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => updateTask(i, { selected: !task.selected })} className="flex-shrink-0 mt-0.5 focus:outline-none" style={{ color: task.selected ? "var(--accent-blue)" : "var(--text-muted)" }}>
                  {task.selected ? <CheckSquare size={15} /> : <Square size={15} />}
                </button>
                <div className="flex-1 min-w-0">
                  <input
                    value={task.title}
                    onChange={(e) => updateTask(i, { title: e.target.value })}
                    className="w-full bg-transparent text-sm focus:outline-none"
                    style={{ color: task.selected ? "var(--text-primary)" : "var(--text-muted)" }}
                  />
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <select
                      value={task.priority}
                      onChange={(e) => updateTask(i, { priority: e.target.value as TaskPriority })}
                      className="bg-transparent text-xs focus:outline-none border rounded px-1"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      {(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as TaskPriority[]).map((p) => (
                        <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                      onChange={(e) => updateTask(i, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="bg-transparent text-xs focus:outline-none border rounded px-1"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    />
                    {task.estimatedMins && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{task.estimatedMins}m</span>
                    )}
                    {task.tags.map((tag) => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>#{tag}</span>
                    ))}
                    {task.recurring && (
                      <span className="text-xs" style={{ color: "var(--accent-purple)" }}>↻ {task.recurring.type.toLowerCase()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={reset} className="text-xs focus:outline-none" style={{ color: "var(--text-muted)" }}>← Wróć</button>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selectedCount} z {tasks.length}</span>
              <button
                onClick={addTasks}
                disabled={selectedCount === 0 || isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Dodaj zadania
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
