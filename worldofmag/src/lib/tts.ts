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

/** Wypowiada tekst w danym języku (BCP-47 lub nazwa). Przerywa poprzednią wypowiedź. */
export function speak(text: string, lang?: string | null): void {
  if (!ttsSupported() || !text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const code = langToBcp47(lang);
    if (code) u.lang = code;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* środowisko bez TTS — ignorujemy */
  }
}
