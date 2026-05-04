"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Mic, MicOff, Loader2, X, Plus, CheckSquare, Square } from "lucide-react";
import { UNITS } from "@/types";
import { addItemStructured } from "@/actions/items";
import { upsertUserProduct, getProductSuggestions } from "@/actions/products";
import { cn } from "@/lib/cn";

interface ParsedRow {
  name: string;
  quantity: number | null;
  unit: string;
  selected: boolean;
  addToCatalog: boolean;
  isNew: boolean;
}

interface VoiceLLMModalProps {
  open: boolean;
  onClose: () => void;
  listId: string;
}

// Web Speech API types (not in TS lib.dom.d.ts for all browsers)
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

export function VoiceLLMModal({ open, onClose, listId }: VoiceLLMModalProps) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isPending, startTransition] = useTransition();
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setRows([]);
      setError(null);
      setTranscript("");
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      stopRecording();
    }
  }, [open]);

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
      setError("Twoja przeglądarka nie obsługuje rozpoznawania mowy. Wpisz tekst ręcznie.");
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

    rec.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
    setError(null);
  }

  function toggleRecording() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
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
          return {
            name: p.name,
            quantity: p.quantity,
            unit: p.unit ?? "",
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
        await addItemStructured(listId, row.name, row.quantity, row.unit || null);
        if (row.addToCatalog) {
          await upsertUserProduct(row.name, row.unit || null);
        }
      }
    });

    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full md:max-w-lg rounded-t-xl md:rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Mic size={16} style={{ color: "var(--accent-blue)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Dodaj głosem / przez LLM
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Input area */}
        {rows.length === 0 && (
          <div className="p-4 flex-shrink-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Wpisz lub powiedz co chcesz kupić…&#10;Np. 'pół kilo jabłek, 2 litry mleka i chleb'"
              className="w-full bg-transparent mono text-sm focus:outline-none resize-none"
              style={{
                color: "var(--text-primary)",
                caretColor: "var(--accent-blue)",
                minHeight: 80,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) processText();
              }}
            />
            {recording && (
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: "var(--accent-red)", animation: "pulse 1s infinite" }}
                />
                <span className="text-xs" style={{ color: "var(--accent-red)" }}>Nasłuchuję…</span>
              </div>
            )}
            {error && (
              <p className="text-xs mt-2" style={{ color: "var(--accent-red)" }}>{error}</p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={toggleRecording}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium focus:outline-none",
                  recording && "animate-pulse"
                )}
                style={{
                  backgroundColor: recording ? "rgba(239,68,68,0.2)" : "var(--bg-elevated)",
                  color: recording ? "var(--accent-red)" : "var(--text-secondary)",
                  border: `1px solid ${recording ? "var(--accent-red)" : "var(--border)"}`,
                }}
              >
                {recording ? <MicOff size={14} /> : <Mic size={14} />}
                {recording ? "Zatrzymaj" : "Nagraj"}
              </button>

              <button
                onClick={processText}
                disabled={!text.trim() || loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium focus:outline-none disabled:opacity-40 ml-auto"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Przetwórz
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Ctrl+Enter aby przetworzyć
            </p>
          </div>
        )}

        {/* Results preview */}
        {rows.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Rozpoznane produkty — zaznacz które dodać do listy
              </p>
            </div>

            {rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Selected checkbox */}
                <button
                  onClick={() => updateRow(i, { selected: !row.selected })}
                  className="flex-shrink-0 focus:outline-none"
                  style={{ color: row.selected ? "var(--accent-blue)" : "var(--text-muted)" }}
                >
                  {row.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {/* Product name */}
                <span
                  className="mono text-sm flex-1 min-w-0 truncate"
                  style={{ color: row.selected ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  {row.isNew && (
                    <span className="mr-1 text-xs" style={{ color: "var(--accent-blue)" }}>+</span>
                  )}
                  {row.name}
                </span>

                {/* Qty */}
                <input
                  type="number"
                  value={row.quantity ?? ""}
                  onChange={(e) => updateRow(i, { quantity: e.target.value ? parseFloat(e.target.value) : null })}
                  className="bg-transparent mono text-xs text-right focus:outline-none"
                  style={{ width: 48, color: "var(--text-secondary)", border: `1px solid var(--border)`, borderRadius: 4, padding: "1px 4px" }}
                  placeholder="qty"
                />

                {/* Unit */}
                <select
                  value={UNITS.find((u) => u.value === row.unit) ? row.unit : (row.unit ? "__other__" : "")}
                  onChange={(e) => updateRow(i, { unit: e.target.value === "__other__" ? row.unit : e.target.value })}
                  className="bg-transparent mono text-xs focus:outline-none"
                  style={{
                    color: "var(--text-secondary)",
                    width: 64,
                    border: `1px solid var(--border)`,
                    borderRadius: 4,
                    padding: "1px 4px",
                    backgroundColor: "var(--bg-elevated)",
                  }}
                >
                  <option value="">—</option>
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.value}</option>
                  ))}
                </select>

                {/* Add to catalog toggle (new products only) */}
                {row.isNew && (
                  <button
                    onClick={() => updateRow(i, { addToCatalog: !row.addToCatalog })}
                    className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded focus:outline-none"
                    style={{
                      backgroundColor: row.addToCatalog ? "rgba(59,130,246,0.15)" : "var(--bg-elevated)",
                      color: row.addToCatalog ? "var(--accent-blue)" : "var(--text-muted)",
                      border: `1px solid ${row.addToCatalog ? "var(--accent-blue)" : "var(--border)"}`,
                      fontSize: 10,
                    }}
                    title="Dodaj do katalogu produktów"
                  >
                    📚
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {rows.length > 0 && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 border-t flex-shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={() => { setRows([]); setText(""); }}
              className="text-xs focus:outline-none"
              style={{ color: "var(--text-muted)" }}
            >
              ← Wróć
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {rows.filter((r) => r.selected).length} z {rows.length} zaznaczonych
              </span>
              <button
                onClick={addToList}
                disabled={rows.filter((r) => r.selected).length === 0 || isPending}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Dodaj do listy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
