"use client";

import { Volume2 } from "lucide-react";
import { speak, ttsSupported } from "@/lib/tts";

/** L1: przycisk wymowy słówka (Web Speech API). Ukryty, gdy brak wsparcia w przeglądarce. */
export function SpeakButton({ text, lang, size = 14, title = "Wymów" }: { text: string; lang?: string | null; size?: number; title?: string }) {
  if (!ttsSupported()) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); speak(text, lang); }}
      className="p-1 rounded"
      style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
      title={title}
      aria-label={title}
    >
      <Volume2 size={size} />
    </button>
  );
}
