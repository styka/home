// L1: wymowa słówek przez Web Speech API (SpeechSynthesis) — bez sieci/zależności.

// Mapowanie nazw języków (polskie/angielskie/kody) → kod BCP-47 dla syntezatora.
const LANG_MAP: Record<string, string> = {
  pl: "pl-PL", polski: "pl-PL", polish: "pl-PL",
  en: "en-US", angielski: "en-US", english: "en-US",
  de: "de-DE", niemiecki: "de-DE", german: "de-DE",
  fr: "fr-FR", francuski: "fr-FR", french: "fr-FR",
  es: "es-ES", hiszpanski: "es-ES", "hiszpański": "es-ES", spanish: "es-ES",
  it: "it-IT", wloski: "it-IT", "włoski": "it-IT", italian: "it-IT",
  pt: "pt-PT", portugalski: "pt-PT", portuguese: "pt-PT",
  ru: "ru-RU", rosyjski: "ru-RU", russian: "ru-RU",
  uk: "uk-UA", ukrainski: "uk-UA", "ukraiński": "uk-UA", ukrainian: "uk-UA",
  cs: "cs-CZ", czeski: "cs-CZ", czech: "cs-CZ",
  nl: "nl-NL", niderlandzki: "nl-NL", holenderski: "nl-NL", dutch: "nl-NL",
  sv: "sv-SE", szwedzki: "sv-SE", swedish: "sv-SE",
  ja: "ja-JP", japonski: "ja-JP", "japoński": "ja-JP", japanese: "ja-JP",
  zh: "zh-CN", chinski: "zh-CN", "chiński": "zh-CN", chinese: "zh-CN",
};

/** Zamienia dowolny opis języka na kod BCP-47 (lub przepuszcza, gdy już wygląda na kod). */
export function langToBcp47(lang: string | null | undefined): string | undefined {
  if (!lang) return undefined;
  const raw = lang.trim().toLowerCase();
  if (LANG_MAP[raw]) return LANG_MAP[raw];
  // Już kod typu "en" / "en-US"?
  if (/^[a-z]{2}(-[a-z]{2})?$/i.test(raw)) return LANG_MAP[raw.slice(0, 2)] ?? raw;
  return undefined;
}

/** Czy synteza mowy jest dostępna w tej przeglądarce. */
export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Głosy na iOS/Safari ładują się ASYNCHRONICZNIE — pierwszy `getVoices()` bywa pusty, dopóki nie
// wypełni ich zdarzenie `voiceschanged`. Rozgrzewamy je raz, żeby `speak()` nie startował „w próżni".
let voicesWarmed = false;
function warmVoices(): void {
  if (voicesWarmed || !ttsSupported()) return;
  voicesWarmed = true;
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {
      try { window.speechSynthesis.getVoices(); } catch { /* ignore */ }
    });
  } catch {
    /* środowisko bez TTS — ignorujemy */
  }
}

/**
 * „Odblokowuje" syntezę mowy na iOS/Safari. **Musi być wywołana w geście użytkownika** (klik/dotknięcie),
 * bo WebKit po cichu odrzuca `speak()` wywołane poza gestem. Wypowiada cichą (volume=0) wypowiedź, żeby
 * dalsze programowe `speak()` (np. w pętli rozmowy) były już słyszalne. Idempotentna, bezpieczna bez
 * wsparcia. Wywołaj przy włączaniu trybu rozmowy głosowej.
 */
export function primeSpeech(): void {
  if (!ttsSupported()) return;
  try {
    warmVoices();
    window.speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* środowisko bez TTS — ignorujemy */
  }
}

/** Opcje wypowiedzi. `onEnd` odpala się po naturalnym zakończeniu lub błędzie syntezy. */
export type SpeakOptions = { onEnd?: () => void };

/** Wypowiada tekst w danym języku (BCP-47 lub nazwa). Przerywa poprzednią wypowiedź. */
export function speak(text: string, lang?: string | null, opts?: SpeakOptions): void {
  if (!ttsSupported() || !text.trim()) return;
  try {
    warmVoices();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const code = langToBcp47(lang);
    if (code) u.lang = code;
    u.rate = 0.95;
    if (opts?.onEnd) {
      u.onend = () => opts.onEnd!();
      u.onerror = () => opts.onEnd!();
    }
    window.speechSynthesis.speak(u);
    // iOS/Safari (i Chrome) potrafią wejść w stan „paused" — resume() gwarantuje, że mowa ruszy.
    window.speechSynthesis.resume();
  } catch {
    /* środowisko bez TTS — ignorujemy */
  }
}

/** Zatrzymuje trwającą wypowiedź (jeśli jakakolwiek trwa). Bezpieczne bez wsparcia syntezy. */
export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* środowisko bez TTS — ignorujemy */
  }
}

/**
 * Zamienia markdown na czytelny tekst mowy — zdejmuje znaczniki, żeby lektor nie czytał symboli
 * (nagłówki, pogrubienia, kod, linki, obrazki, tabele, cytaty, poziome linie).
 */
export function speechTextFromMarkdown(md: string): string {
  if (!md) return "";
  return md
    .replace(/```[\s\S]*?```/g, " ")            // bloki kodu
    .replace(/`([^`]+)`/g, "$1")                // kod inline
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")      // obrazki ![alt](url)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")    // linki [tekst](url) → tekst
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")          // nagłówki #..######
    .replace(/^\s{0,3}>\s?/gm, "")               // cytaty >
    .replace(/^\s{0,3}[-*_]{3,}\s*$/gm, " ")     // poziome linie --- / ***
    .replace(/^\s*[-*+]\s+/gm, "")               // punktory list
    .replace(/\*\*([^*]+)\*\*/g, "$1")           // **pogrubienie**
    .replace(/\*([^*]+)\*/g, "$1")               // *kursywa*
    .replace(/\|/g, " ")                          // separatory tabel
    .replace(/[ \t]+/g, " ")                      // wielokrotne spacje
    .replace(/\n{2,}/g, ". ")                     // podwójne nowe linie → pauza zdaniowa
    .replace(/\n/g, " ")
    .trim();
}
