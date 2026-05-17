"use client";

import { useState, useRef } from "react";
import { Mic, MicOff, Wand2, Loader2 } from "lucide-react";

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

type TextareaState = "idle" | "recording" | "voice_modify" | "processing_modify";

export interface SmartTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  onSubmit?: () => void;
  disabled?: boolean;
  className?: string;
}

export function SmartTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  onSubmit,
  disabled = false,
}: SmartTextareaProps) {
  const [state, setState] = useState<TextareaState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const modifyTranscriptRef = useRef("");

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }

  function startRecording(mode: "add" | "modify") {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
      return;
    }
    setError(null);
    transcriptRef.current = "";
    modifyTranscriptRef.current = "";

    const rec = new SR();
    rec.lang = "pl-PL";
    rec.continuous = true;
    rec.interimResults = true;

    if (mode === "add") {
      rec.onresult = (e) => {
        let newFinal = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) newFinal += e.results[i][0].transcript + " ";
          else interim += e.results[i][0].transcript;
        }
        transcriptRef.current += newFinal;
        const newValue = value + (value && !value.endsWith(" ") && transcriptRef.current ? " " : "") + transcriptRef.current + interim;
        onChange(newValue.trimStart());
      };
      rec.onend = () => {
        setState("idle");
      };
    } else {
      rec.onresult = (e) => {
        let newFinal = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) newFinal += e.results[i][0].transcript + " ";
        }
        modifyTranscriptRef.current += newFinal;
      };
      rec.onend = () => {
        void submitModifyInstruction();
      };
    }

    rec.onerror = (e) => {
      setError(`Błąd mikrofonu: ${e.error}`);
      setState("idle");
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    rec.start();
    setState(mode === "add" ? "recording" : "voice_modify");
  }

  async function submitModifyInstruction() {
    const instruction = modifyTranscriptRef.current.trim();
    recognitionRef.current = null;
    if (!instruction || !value.trim()) {
      setState("idle");
      return;
    }
    setState("processing_modify");
    try {
      const res = await fetch("/api/llm/notes/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value, mode: "voice_edit", instruction }),
      });
      const data = await res.json() as { result?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Błąd modyfikacji");
      } else if (data.result) {
        onChange(data.result);
      }
    } catch {
      setError("Nie udało się połączyć z LLM");
    } finally {
      setState("idle");
    }
  }

  function handleMicClick() {
    if (state === "recording") {
      stopRecording();
      setState("idle");
    } else if (state === "idle") {
      startRecording("add");
    }
  }

  function handleModifyClick() {
    if (state === "voice_modify") {
      stopRecording();
      void submitModifyInstruction();
    } else if (state === "idle") {
      if (!value.trim()) {
        setError("Wpisz tekst do modyfikacji");
        return;
      }
      startRecording("modify");
    }
  }

  const isDisabled = disabled || state === "processing_modify";

  return (
    <div style={{ position: "relative" }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        disabled={isDisabled}
        rows={rows}
        placeholder={placeholder}
        style={{
          width: "100%",
          resize: "vertical",
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
          border: `1px solid ${state !== "idle" ? "var(--border-focus)" : "var(--border)"}`,
          borderRadius: 10,
          padding: "12px 14px",
          paddingBottom: 44,
          fontSize: 14,
          lineHeight: 1.6,
          outline: "none",
          transition: "border-color 0.1s",
          caretColor: "var(--accent-blue)",
          boxSizing: "border-box",
        }}
      />

      {/* State indicator bar */}
      {state !== "idle" && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 14,
            right: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          {state === "recording" && (
            <span
              className="animate-pulse"
              style={{ fontSize: 11, color: "var(--accent-red)", display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent-red)",
                }}
              />
              Dyktowanie…
            </span>
          )}
          {state === "voice_modify" && (
            <span
              className="animate-pulse"
              style={{ fontSize: 11, color: "var(--accent-amber)", display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent-amber)",
                }}
              />
              Opisz modyfikację…
            </span>
          )}
          {state === "processing_modify" && (
            <span style={{ fontSize: 11, color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: 4 }}>
              <Loader2 size={11} className="animate-spin" />
              Modyfikuję…
            </span>
          )}
        </div>
      )}

      {/* Bottom toolbar */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          right: 10,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {/* Voice-modify button */}
        {(state === "idle" || state === "voice_modify") && (
          <button
            onClick={handleModifyClick}
            title={state === "voice_modify" ? "Zatrzymaj i zastosuj modyfikację" : "Modyfikuj tekst głosem"}
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `1px solid ${state === "voice_modify" ? "var(--accent-amber)" : "var(--border)"}`,
              background: state === "voice_modify" ? "rgba(245,158,11,0.12)" : "var(--bg-elevated)",
              color: state === "voice_modify" ? "var(--accent-amber)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {state === "voice_modify" ? <MicOff size={13} /> : <Wand2 size={13} />}
          </button>
        )}

        {/* Voice-add / stop button */}
        {(state === "idle" || state === "recording") && (
          <button
            onClick={handleMicClick}
            title={state === "recording" ? "Zatrzymaj dyktowanie" : "Dyktuj tekst"}
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `1px solid ${state === "recording" ? "var(--accent-red)" : "var(--border)"}`,
              background: state === "recording" ? "rgba(239,68,68,0.12)" : "var(--bg-elevated)",
              color: state === "recording" ? "var(--accent-red)" : "var(--text-muted)",
              cursor: "pointer",
            }}
            className={state === "recording" ? "animate-pulse" : undefined}
          >
            {state === "recording" ? <MicOff size={13} /> : <Mic size={13} />}
          </button>
        )}

        {state === "processing_modify" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
            }}
          >
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
          </div>
        )}
      </div>

      {/* Help text */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          fontSize: 11,
          pointerEvents: "none",
        }}
      >
        {state === "idle" && (
          <span style={{ color: "var(--text-muted)" }}>Ctrl+Enter aby wysłać</span>
        )}
        {state === "recording" && (
          <span style={{ color: "var(--accent-red)" }}>Kliknij 🎙 aby zatrzymać</span>
        )}
        {state === "voice_modify" && (
          <span style={{ color: "var(--accent-amber)" }}>Kliknij 🪄 aby zastosować</span>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}
