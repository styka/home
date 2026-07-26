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

// ── Wybór głosu lektora (per-urządzenie) ──────────────────────────────────────
// Głosy Web Speech są specyficzne dla urządzenia/przeglądarki, więc zapamiętany
// wybór trzymamy lokalnie (localStorage), nie w bazie. `speak()` używa wybranego
// głosu, a gdy jest niedostępny — wraca do domyślnego (bez błędu).
const VOICE_STORAGE_KEY = "omnia.aiVoice";
// undefined = jeszcze nie odczytano z localStorage; null = świadomie „domyślny".
let preferredVoiceURI: string | null | undefined = undefined;

/** Zapamiętany identyfikator głosu (voiceURI) lub null = domyślny przeglądarki. Leniwy odczyt. */
export function getPreferredVoiceURI(): string | null {
  if (preferredVoiceURI !== undefined) return preferredVoiceURI;
  try {
    preferredVoiceURI =
      (typeof localStorage !== "undefined" ? localStorage.getItem(VOICE_STORAGE_KEY) : null) || null;
  } catch {
    preferredVoiceURI = null;
  }
  return preferredVoiceURI;
}

/** Ustawia (i zapamiętuje na tym urządzeniu) preferowany głos lektora. null = domyślny. */
export function setPreferredVoiceURI(uri: string | null): void {
  preferredVoiceURI = uri && uri.trim() ? uri : null;
  try {
    if (preferredVoiceURI) localStorage.setItem(VOICE_STORAGE_KEY, preferredVoiceURI);
    else localStorage.removeItem(VOICE_STORAGE_KEY);
  } catch {
    /* brak localStorage — ignorujemy */
  }
}

// 031: PRZYCZYNA „ZNIKAJĄCYCH GŁOSÓW". `speechSynthesis.getVoices()` na Chrome/Windows zwraca
// najpierw pełną listę (łącznie z głosami ZDALNYMI silnika, których przeglądarka nie potrafi
// odtworzyć), a po dociągnięciu silników oddaje listę KRÓTSZĄ. UI brał każdą odpowiedź jako
// prawdę, więc raz pokazywał wiele polskich głosów (z których działał jeden), a chwilę później
// tylko ten jeden. Poprawka: odsiewamy głosy niedostępne lokalnie (`localService === false`) JUŻ
// przy pierwszym odczycie, więc użytkownik od razu widzi krótką, uczciwą listę i nie ma z czego
// „znikać". Zabezpieczenie: gdyby po odsianiu nie został ŻADEN głos danego języka, przywracamy
// zdalne (część silników raportuje `localService:false` także dla działających głosów) — lepiej
// dać wybór niż puste pole. Na koniec dedup po `voiceURI` i sortowanie: polskie najpierw.

function isPolish(v: SpeechSynthesisVoice): boolean {
  return v.lang?.toLowerCase().startsWith("pl") ?? false;
}

/**
 * Głosy dostępne w przeglądarce — TYLKO te, które faktycznie da się odtworzyć.
 * Może być pusta, dopóki nie odpali „voiceschanged" (iOS/Safari ładują asynchronicznie).
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  try {
    warmVoices();
    const live = window.speechSynthesis.getVoices() ?? [];

    const local = live.filter((v) => v.localService !== false);
    const usable = local.length > 0 ? local : live;
    const polishLocal = usable.filter(isPolish);
    const result = polishLocal.length > 0 || live.filter(isPolish).length === 0
      ? usable
      : [...usable, ...live.filter(isPolish)];

    const seen = new Set<string>();
    return result
      .filter((v) => (seen.has(v.voiceURI) ? false : (seen.add(v.voiceURI), true)))
      .sort((a, b) => {
        const pa = isPolish(a) ? 0 : 1;
        const pb = isPolish(b) ? 0 : 1;
        return pa !== pb ? pa - pb : a.name.localeCompare(b.name, "pl");
      });
  } catch {
    return [];
  }
}

/**
 * Subskrypcja zmiany listy głosów (iOS/Safari ładują je ASYNCHRONICZNIE). Zwraca funkcję odpięcia.
 * Używane przez UI wyboru głosu, by odświeżyć listę, gdy głosy dopłyną.
 */
export function onVoicesChanged(cb: () => void): () => void {
  if (!ttsSupported()) return () => {};
  const handler = () => cb();
  try {
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
  } catch {
    /* ignore */
  }
  return () => {
    try {
      window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
    } catch {
      /* ignore */
    }
  };
}

/** Opcje wypowiedzi. `onEnd` odpala się po naturalnym zakończeniu lub błędzie syntezy. */
export type SpeakOptions = { onEnd?: () => void };

// ── Głos SERWEROWY (031) ──────────────────────────────────────────────────────
// Gdy użytkownik wybrał głos serwerowy, czytamy tekst przez `/api/tts` i odtwarzamy `Audio`.
// Każda awaria (brak konfiguracji, 429, sieć) po cichu SPADA na syntezę przeglądarki, więc
// „odczytaj na głos" nigdy nie przestaje działać.
let serverVoiceId: string | null = null;
let currentAudio: HTMLAudioElement | null = null;
// Znacznik „generacji" wypowiedzi: każde `stopSpeaking()`/nowe `speak()` go zwiększa. Bez tego
// odpowiedź `/api/tts`, która dotarła PO zatrzymaniu odczytu, i tak zaczynała grać — użytkownik
// widział stan „zatrzymane", a słyszał lektora.
let speechGeneration = 0;

/** Ustawia głos serwerowy (null = korzystaj z syntezy przeglądarki). */
export function setServerVoiceId(id: string | null): void {
  serverVoiceId = id && id.trim() ? id.trim() : null;
}

function stopServerAudio(): void {
  if (!currentAudio) return;
  try {
    currentAudio.pause();
    currentAudio.src = "";
  } catch {
    /* ignore */
  }
  currentAudio = null;
}

/** Czy jakakolwiek synteza jest dostępna (przeglądarka LUB serwer). */
export function speechAvailable(): boolean {
  return ttsSupported() || !!serverVoiceId;
}

async function speakViaServer(text: string, generation: number, opts?: SpeakOptions): Promise<boolean> {
  if (!serverVoiceId) return false;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 1200), voiceId: serverVoiceId }),
    });
    if (!res.ok) return false; // 501 (brak konfiguracji) / 429 / 502 → fallback na przeglądarkę
    const blob = await res.blob();
    // Odczyt zatrzymany (albo zaczęła się nowa wypowiedź) w czasie oczekiwania na dźwięk — nie graj.
    if (generation !== speechGeneration) return true;
    stopServerAudio();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    const done = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      opts?.onEnd?.();
    };
    audio.onended = done;
    audio.onerror = done;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/** Wypowiada tekst w danym języku (BCP-47 lub nazwa). Przerywa poprzednią wypowiedź. */
export function speak(text: string, lang?: string | null, opts?: SpeakOptions): void {
  if (!text.trim()) return;
  // Głos serwerowy ma pierwszeństwo; przy jakimkolwiek problemie wracamy do przeglądarki.
  if (serverVoiceId) {
    stopSpeaking(); // zwiększa `speechGeneration`
    const generation = speechGeneration;
    void speakViaServer(text, generation, opts).then((ok) => {
      if (generation !== speechGeneration) return; // w międzyczasie zatrzymano / zaczęto nową
      if (!ok) speakViaBrowser(text, lang, opts);
    });
    return;
  }
  speakViaBrowser(text, lang, opts);
}

function speakViaBrowser(text: string, lang?: string | null, opts?: SpeakOptions): void {
  if (!ttsSupported() || !text.trim()) {
    opts?.onEnd?.();
    return;
  }
  try {
    warmVoices();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const code = langToBcp47(lang);
    if (code) u.lang = code;
    // Wybrany głos lektora (jeśli ustawiony i wciąż dostępny) — inaczej głos domyślny.
    const uri = getPreferredVoiceURI();
    if (uri) {
      const match = window.speechSynthesis.getVoices().find((v) => v.voiceURI === uri);
      if (match) u.voice = match;
    }
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

/** Zatrzymuje trwającą wypowiedź (obie ścieżki: przeglądarka i głos serwerowy). */
export function stopSpeaking(): void {
  speechGeneration += 1; // unieważnia wypowiedzi „w drodze" (patrz `speakViaServer`)
  stopServerAudio();
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
