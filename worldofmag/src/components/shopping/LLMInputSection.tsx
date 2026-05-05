"use client";

import { useState, useRef, useEffect, useTransition, useId } from "react";
import { Mic, MicOff, Loader2, Plus, CheckSquare, Square, Sparkles } from "lucide-react";
import { UNITS } from "@/types";
import { addItemStructured } from "@/actions/items";
import { upsertUserProduct, getProductSuggestions } from "@/actions/products";
import { categorize } from "@/lib/categorize";
import { cn } from "@/lib/cn";

interface ParsedRow {
  name: string;
  quantity: number | null;
  unit: string;
  category: string;
  selected: boolean;
  addToCatalog: boolean;
  isNew: boolean;
}

interface LLMInputSectionProps {
  listId: string;
  categoryNames: string[];
}

interface ISpeechResult {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
}
interface ISpeechError { error: string }
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: ISpeechResult) => void) | null;
  onerror: ((e: ISpeechError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface ISpeechRecognitionCtor { new(): ISpeechRecognition }
declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionCtor;
    webkitSpeechRecognition?: ISpeechRecognitionCtor;
  }
}

export function LLMInputSection({ listId, categoryNames }: LLMInputSectionProps) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isPending, startTransition] = useTransition();
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const unitDatalistId = useId();
  const categoryDatalistId = useId();
  const showResults = rows.length > 0;

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setRecording(false);
  }

  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
      return;
    }
    const rec = new SR();
    rec.lang = "pl-PL";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: ISpeechResult) => {
      let newFinal = "";
      let currentInterim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newFinal += e.results[i][0].transcript + " ";
        } else {
          currentInterim += e.results[i][0].transcript;
        }
      }
      setTranscript((prev) => {
        const updated = prev + newFinal;
        setText(updated + currentInterim);
        return updated;
      });
    };

    rec.onerror = (e: ISpeechError) => {
      setError(`Błąd mikrofonu: ${e.error}`);
      stopRecording();
    };

    rec.onend = () => setRecording(false);

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
    setError(null);
  }

  function toggleRecording() {
    recording ? stopRecording() : startRecording();
  }

  async function processText() {
    const input = text.trim();
    if (!input) return;
    stopRecording();
    setLoading(true);
    setError(null);
    setRows([]);

    try {
      const res = await fetch("/api/llm/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Błąd przetwarzania");
        return;
      }

      const parsed: Array<{ name: string; quantity: number | null; unit: string | null }> = data.items;

      const withNew: ParsedRow[] = await Promise.all(
        parsed.map(async (p) => {
          const suggestions = await getProductSuggestions(p.name);
          const isNew = suggestions.length === 0 || !suggestions.some(
            (s) => s.name.toLowerCase() === p.name.toLowerCase()
          );
          const suggestedCategory = categorize(p.name);
          return {
            name: p.name,
            quantity: p.quantity,
            unit: p.unit ?? "",
            category: suggestedCategory === "Other" ? "" : suggestedCategory,
            selected: true,
            addToCatalog: isNew,
            isNew,
          };
        })
      );

      setRows(withNew);
    } catch {
      setError("Nie udało się połączyć z LLM");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(i: number, patch: Partial<ParsedRow>) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addToList() {
    const toAdd = rows.filter((r) => r.selected);
    if (toAdd.length === 0) return;

    startTransition(async () => {
      for (const row of toAdd) {
        await addItemStructured(listId, row.name, row.quantity, row.unit || null, row.category || undefined);
        if (row.addToCatalog) {
          await upsertUserProduct(row.name, row.unit || null, row.category || undefined);
        }
      }
    });

    reset();
  }

  function reset() {
    setRows([]);
    setText("");
    setTranscript("");
    setError(null);
    stopRecording();
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div
      className="border-b flex-shrink-0"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-elevated)",
        borderLeft: "3px solid var(--accent-blue)",
      }}
    >
      {/* Header label */}
      <div
        className="flex items-center gap-1.5 px-4 pt-2 pb-1"
        style={{ color: "var(--accent-blue)" }}
      >
        <Sparkles size={11} />
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>
          Dodaj przez AI
        </span>
      </div>

      {/* Input area — hidden when results are shown */}
      {!showResults && (
        <div className="px-4 pb-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Wpisz listę zakupów lub powiedz co kupić…\nNp. \"2 kg jabłek, mleko, chleb pszenny\""}
            rows={2}
            className="w-full bg-transparent mono text-sm focus:outline-none resize-none"
            style={{
              color: "var(--text-primary)",
              caretColor: "var(--accent-blue)",
              lineHeight: 1.5,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) processText();
            }}
          />

          <div className="flex items-center gap-2 mt-2">
            {/* Recording indicator pushes buttons to the right */}
            <div className="flex-1">
              {recording && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--accent-red)" }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "var(--accent-red)", animation: "pulse 1s infinite" }}
                  />
                  Słucham…
                </span>
              )}
            </div>

            <button
              onClick={toggleRecording}
              type="button"
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium focus:outline-none",
                recording && "animate-pulse"
              )}
              style={{
                backgroundColor: recording ? "rgba(239,68,68,0.15)" : "var(--bg-surface)",
                color: recording ? "var(--accent-red)" : "var(--text-secondary)",
                border: `1px solid ${recording ? "var(--accent-red)" : "var(--border)"}`,
              }}
              title={recording ? "Zatrzymaj nagrywanie" : "Nagraj głosowo"}
            >
              {recording ? <MicOff size={13} /> : <Mic size={13} />}
              <span>{recording ? "Stop" : "Mów"}</span>
            </button>

            <button
              onClick={processText}
              disabled={!text.trim() || loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium focus:outline-none disabled:opacity-40"
              style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              title="Przetwórz przez AI (Ctrl+Enter)"
            >
              {loading
                ? <Loader2 size={13} className="animate-spin" />
                : <Sparkles size={13} />
              }
              Przetwórz
            </button>
          </div>

          {error && (
            <p className="text-xs mt-1.5" style={{ color: "var(--accent-red)" }}>{error}</p>
          )}
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Ctrl+Enter aby przetworzyć
          </p>
        </div>
      )}

      {/* Results preview */}
      {showResults && (
        <>
          <div className="px-4 pb-1">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Rozpoznane produkty — zaznacz które dodać
            </p>
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-1.5 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  onClick={() => updateRow(i, { selected: !row.selected })}
                  className="flex-shrink-0 focus:outline-none"
                  style={{ color: row.selected ? "var(--accent-blue)" : "var(--text-muted)" }}
                >
                  {row.selected ? <CheckSquare size={15} /> : <Square size={15} />}
                </button>

                <span
                  className="mono text-sm flex-1 min-w-0 truncate"
                  style={{ color: row.selected ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  {row.isNew && (
                    <span className="mr-1 text-xs" style={{ color: "var(--accent-blue)" }}>+</span>
                  )}
                  {row.name}
                </span>

                <input
                  type="number"
                  value={row.quantity ?? ""}
                  onChange={(e) => updateRow(i, { quantity: e.target.value ? parseFloat(e.target.value) : null })}
                  className="bg-transparent mono text-xs text-right focus:outline-none"
                  style={{ width: 38, color: "var(--text-secondary)", border: `1px solid var(--border)`, borderRadius: 4, padding: "1px 4px" }}
                  placeholder="qty"
                />

                <input
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateRow(i, { unit: e.target.value })}
                  list={unitDatalistId}
                  placeholder="jedn."
                  autoComplete="off"
                  className="bg-transparent mono text-xs focus:outline-none"
                  style={{ width: 52, color: "var(--text-secondary)", border: `1px solid var(--border)`, borderRadius: 4, padding: "1px 4px", backgroundColor: "var(--bg-surface)" }}
                />

                <input
                  type="text"
                  value={row.category}
                  onChange={(e) => updateRow(i, { category: e.target.value })}
                  list={categoryDatalistId}
                  placeholder="kat."
                  autoComplete="off"
                  className="bg-transparent mono text-xs focus:outline-none"
                  style={{ width: 68, color: row.category ? "var(--text-secondary)" : "var(--text-muted)", border: `1px solid var(--border)`, borderRadius: 4, padding: "1px 4px", backgroundColor: "var(--bg-surface)" }}
                />

                {row.isNew && (
                  <button
                    onClick={() => updateRow(i, { addToCatalog: !row.addToCatalog })}
                    className="flex-shrink-0 px-1.5 py-0.5 rounded focus:outline-none"
                    title="Dodaj do katalogu produktów"
                    style={{
                      backgroundColor: row.addToCatalog ? "rgba(59,130,246,0.15)" : "var(--bg-surface)",
                      color: row.addToCatalog ? "var(--accent-blue)" : "var(--text-muted)",
                      border: `1px solid ${row.addToCatalog ? "var(--accent-blue)" : "var(--border)"}`,
                      fontSize: 10,
                    }}
                  >
                    📚
                  </button>
                )}
              </div>
            ))}
          </div>

          <datalist id={unitDatalistId}>
            {UNITS.map((u) => <option key={u.value} value={u.value} />)}
          </datalist>
          <datalist id={categoryDatalistId}>
            {categoryNames.map((c) => <option key={c} value={c} />)}
          </datalist>

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-2 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={reset}
              className="text-xs focus:outline-none"
              style={{ color: "var(--text-muted)" }}
            >
              ← Wróć
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {selectedCount} z {rows.length} zaznaczonych
              </span>
              <button
                onClick={addToList}
                disabled={selectedCount === 0 || isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Dodaj do listy
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
