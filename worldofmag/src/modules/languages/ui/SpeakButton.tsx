"use client";

import { useTranslations } from "next-intl";
import { Volume2 } from "lucide-react";
import { speak, ttsSupported } from "@/lib/tts";

/** L1: przycisk wymowy słówka (Web Speech API). Ukryty, gdy brak wsparcia w przeglądarce. */
export function SpeakButton({ text, lang, size = 14, title }: { text: string; lang?: string | null; size?: number; title?: string }) {
  // 097: wartość domyślna etykiety nie może być literałem w sygnaturze — wartości domyślne liczą się
  // przed wejściem do komponentu, więc nie ma tam jeszcze `t`. Domyślną wybieramy w ciele.
  const t = useTranslations("modules.languages.SpeakButton");
  const etykieta = title ?? t("wymow");
  if (!ttsSupported()) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); speak(text, lang); }}
      className="p-1 rounded"
      style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
      title={etykieta}
      aria-label={etykieta}
    >
      <Volume2 size={size} />
    </button>
  );
}
