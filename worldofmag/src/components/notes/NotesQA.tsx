"use client";

import { useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import type { Note } from "@/types";

interface QAMessage {
  question: string;
  answer: string;
  sourceIndices: number[];
}

interface NotesQAProps {
  allNotes: Note[];
  filteredNotes: Note[];
  onScrollToNote?: (noteId: string) => void;
}

function parseAnswer(raw: string): { clean: string; indices: number[] } {
  const match = raw.match(/<!--\s*sources:\s*\[([^\]]*)\]\s*-->/);
  const indices = match
    ? match[1].split(",").map((s) => parseInt(s.trim()) - 1).filter((n) => !isNaN(n) && n >= 0)
    : [];
  const clean = raw.replace(/<!--\s*sources:\s*\[[^\]]*\]\s*-->/, "").trim();
  return { clean, indices };
}

export function NotesQA({ allNotes, filteredNotes, onScrollToNote }: NotesQAProps) {
  const [useFiltered, setUseFiltered] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const answerRef = useRef<HTMLDivElement>(null);

  const contextNotes = useFiltered ? filteredNotes : allNotes;

  async function ask() {
    if (!question.trim() || streaming) return;
    const q = question.trim();
    setQuestion("");
    setStreaming(true);
    setCurrentAnswer("");

    const notes = contextNotes.map((n) => ({ title: n.title, content: n.content }));

    try {
      const res = await fetch("/api/llm/notes/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, notes }),
      });

      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { question: q, answer: "Błąd: nie można połączyć z AI.", sourceIndices: [] }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as { choices: Array<{ delta: { content?: string } }> };
            const token = parsed.choices[0]?.delta?.content ?? "";
            fullAnswer += token;
            setCurrentAnswer(fullAnswer);
            answerRef.current?.scrollTo({ top: answerRef.current.scrollHeight });
          } catch {
            // ignore parse errors for SSE chunks
          }
        }
      }

      const { clean, indices } = parseAnswer(fullAnswer);
      setMessages((m) => [...m, { question: q, answer: clean, sourceIndices: indices }]);
    } finally {
      setStreaming(false);
      setCurrentAnswer("");
    }
  }

  return (
    <div
      className="flex flex-col border-t"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", maxHeight: 400 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Pytaj notatki
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={useFiltered}
              onChange={(e) => setUseFiltered(e.target.checked)}
              className="w-3 h-3"
            />
            Tylko odfiltrowane ({filteredNotes.length})
          </label>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {contextNotes.length} notatek w kontekście
          </span>
        </div>
      </div>

      {/* History */}
      <div ref={answerRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-4" style={{ minHeight: 80, maxHeight: 240 }}>
        {messages.length === 0 && !streaming && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Zadaj pytanie, a AI odpowie na podstawie Twoich notatek.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              → {msg.question}
            </p>
            <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
              {msg.answer}
            </p>
            {msg.sourceIndices.length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Źródła: </span>
                {msg.sourceIndices.map((idx) => {
                  const note = contextNotes[idx];
                  if (!note) return null;
                  return (
                    <button
                      key={idx}
                      onClick={() => onScrollToNote?.(note.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded mr-1 mt-0.5 inline-block text-left"
                      style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                      title={note.content.slice(0, 80)}
                    >
                      {note.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {streaming && (
          <div className="space-y-1">
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              → {question || "..."}
            </p>
            <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
              {parseAnswer(currentAnswer).clean}
              <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse" style={{ backgroundColor: "var(--text-primary)" }} />
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-2 border-t" style={{ borderColor: "var(--border)" }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          placeholder="Zadaj pytanie dotyczące notatek..."
          className="flex-1 bg-transparent text-sm focus:outline-none"
          style={{ color: "var(--text-primary)" }}
          disabled={streaming}
        />
        <button
          onClick={ask}
          disabled={!question.trim() || streaming}
          className="flex items-center justify-center w-7 h-7 rounded"
          style={{
            backgroundColor: question.trim() && !streaming ? "var(--accent-blue)" : "var(--bg-hover)",
            color: question.trim() && !streaming ? "#fff" : "var(--text-muted)",
          }}
        >
          {streaming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}
