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
 * „Odblokowuje" odczyt na głos na iOS/Safari. **Musi być wywołana w geście użytkownika**
 * (klik/dotknięcie), bo WebKit po cichu odrzuca zarówno `speechSynthesis.speak()`, jak i
 * `audio.play()` wywołane poza gestem.
 *
 * 036: odblokowuje OBIE ścieżki naraz — syntezę przeglądarki (cicha wypowiedź) i współdzielony
 * element audio głosu serwerowego. Wcześniej odblokowywana była tylko przeglądarka, więc w trybie
 * rozmowy na telefonie lektor serwerowy milkł i odzywał się głos systemowy. Jedno wywołanie w
 * jednym miejscu = nie da się zapomnieć o którejś ścieżce.
 *
 * Idempotentna, bezpieczna bez wsparcia. Wywołaj przy włączaniu trybu rozmowy głosowej.
 */
export function primeSpeech(): void {
  // Głos serwerowy nie zależy od `speechSynthesis`, więc odblokowujemy go ZAWSZE — także tam,
  // gdzie przeglądarka nie ma własnej syntezy.
  primeSpeechPlayback();
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
export type SpeakOptions = {
  onEnd?: () => void;
  /**
   * 084 (AC-2): CZUJKA CISZY — „minęło tyle czasu, a mowa nie ruszyła".
   *
   * Powód, dla którego to musi istnieć: iOS odrzuca `speechSynthesis.speak()` wywołane poza gestem
   * użytkownika **bez żadnego zdarzenia** — nie przychodzi ani `onstart`, ani `onend`, ani
   * `onerror`. Lektor łańcuchuje zdania po `onEnd`, więc łańcuch po prostu ZAMIERA, a interfejs
   * dalej pokazuje „wiadomość 1/10 · zdanie 2/4". Dokładnie to zgłosił właściciel: „niby leci
   * a nie słyszę".
   *
   * Czujka nie zna przyczyny i to jest jej wartość: łapie także te powody milczenia, których nie
   * przewidzieliśmy. Wywoływana NAJWYŻEJ RAZ na wypowiedź i nigdy razem z `onEnd`.
   */
  onSilent?: () => void;
};

/**
 * Ile czekamy na dowód, że mowa faktycznie ruszyła. 1,5 s to z zapasem więcej niż start syntezy
 * systemowej (dziesiątki milisekund) i mniej, niż użytkownik jest gotów wpatrywać się w licznik,
 * który nic nie robi.
 */
const CZAS_NA_START_MS = 1500;

// ── Głos SERWEROWY (031) ──────────────────────────────────────────────────────
// Gdy użytkownik wybrał głos serwerowy, czytamy tekst przez `/api/tts` i odtwarzamy `Audio`.
// Każda awaria (brak konfiguracji, 429, sieć) po cichu SPADA na syntezę przeglądarki, więc
// „odczytaj na głos" nigdy nie przestaje działać.
let serverVoiceId: string | null = null;
/**
 * 036: JEDEN, współdzielony element audio zamiast `new Audio()` przy każdej wypowiedzi.
 *
 * Dlaczego: iOS pozwala odtwarzać dźwięk tylko elementowi, który został „odblokowany" w geście
 * użytkownika. Przy przycisku „czytaj" gest jest tuż obok, więc świeży `Audio` przechodził — ale
 * w TRYBIE ROZMOWY mowa startuje długo po ostatnim dotknięciu (użytkownik mówił, potem szło
 * żądanie), więc `play()` było odrzucane, `catch` zwracał `false` i lektor serwerowy po cichu
 * spadał na głos systemowy. Element odblokowany raz (`primeSpeechPlayback`) gra już zawsze.
 */
let sharedAudio: HTMLAudioElement | null = null;
/** URL bieżącego dźwięku — zwalniany po zakończeniu/zatrzymaniu (element zostaje). */
let currentObjectUrl: string | null = null;
let audioUnlocked = false;
// Znacznik „generacji" wypowiedzi: każde `stopSpeaking()`/nowe `speak()` go zwiększa. Bez tego
// odpowiedź `/api/tts`, która dotarła PO zatrzymaniu odczytu, i tak zaczynała grać — użytkownik
// widział stan „zatrzymane", a słyszał lektora.
let speechGeneration = 0;

/**
 * 080 (Z4): ZATRZASK PORAŻKI GŁOSU SERWEROWEGO.
 *
 * Ścieżka zapasowa istniała już wcześniej, ale była **per wypowiedź i asynchroniczna**, przez co
 * w praktyce nie działała wcale. Zgłoszenie właściciela: „jak włączy się czytaj to nic nie słychać".
 * Mechanizm był taki: każde zdanie szło do `/api/tts`, dostawało odmowę, a dopiero POTEM wołało
 * syntezę przeglądarki — czyli już poza gestem użytkownika. WebKit takie wywołanie odrzuca po cichu
 * (patrz `primeSpeech`), więc zamiast przełączenia głosu była cisza. Lektor Wiadomości łańcuchuje
 * zdania z `onEnd`, więc żadne zdanie poza pierwszym i tak nie było w geście.
 *
 * Po pierwszej odmowie schodzimy na przeglądarkę OD RAZU i SYNCHRONICZNIE — w tym samym geście,
 * bez żądania sieciowego. Zatrzask jest na sesję strony (nie zapisujemy go nigdzie), więc
 * przeładowanie albo zmiana konfiguracji daje dostawcy kolejną szansę.
 */
let serverVoiceFailed = false;
/** Wołane raz, przy pierwszym zejściu na głos systemowy — UI ma o tym POWIEDZIEĆ, nie milczeć. */
let onFallbackNotice: ((reason: string | null) => void) | null = null;

/** Ustawia głos serwerowy (null = korzystaj z syntezy przeglądarki). */
export function setServerVoiceId(id: string | null): void {
  const next = id && id.trim() ? id.trim() : null;
  // Zmiana głosu albo konfiguracji kasuje zatrzask: to jest dokładnie ta sytuacja, w której
  // warto spróbować jeszcze raz (administrator mógł właśnie poprawić klucz albo model).
  if (next !== serverVoiceId) serverVoiceFailed = false;
  serverVoiceId = next;
}

/**
 * Rejestruje odbiorcę jednorazowej informacji „czytam głosem systemowym".
 * Bez tego przejście byłoby niewidoczne, a użytkownik słyszałby inny głos bez wyjaśnienia.
 */
export function setSpeechFallbackNotice(fn: ((reason: string | null) => void) | null): void {
  onFallbackNotice = fn;
}

/** Czy głos serwerowy został w tej sesji zatrzaśnięty jako niedziałający (do testów i UI). */
export function serverVoiceLatchedOff(): boolean {
  return serverVoiceFailed;
}

/**
 * 080 (Z12): prędkość czytania, wspólna dla OBU ścieżek.
 *
 * Do tej pory `u.rate` było zaszyte jako 0.95 i dotyczyło wyłącznie syntezy przeglądarki — głos
 * serwerowy nie miał żadnej regulacji. Skoro użytkownik ma jeden suwak, obie ścieżki muszą go
 * słuchać, inaczej „prędkość" znaczyłaby co innego zależnie od tego, kto akurat czyta.
 * Serwerowa ścieżka realizuje ją przez `playbackRate` odtwarzacza — dostawcy syntezy albo nie
 * przyjmują prędkości, albo każdy inaczej, a odtwarzacz robi to samo za darmo i natychmiast.
 */
let speechRate = 0.95;

export function setSpeechRate(rate: number): void {
  if (!Number.isFinite(rate)) return;
  speechRate = Math.min(2, Math.max(0.5, rate));
  // Zmiana w trakcie czytania działa od razu — czekanie do następnego zdania wyglądałoby
  // na zepsuty suwak.
  if (sharedAudio) sharedAudio.playbackRate = speechRate;
}

export function getSpeechRate(): number {
  return speechRate;
}

/** Współdzielony element audio (tworzony leniwie, NIGDY nie niszczony — patrz komentarz wyżej). */
function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

/**
 * 036: „Odblokowuje" odtwarzanie dźwięku — wołaj SYNCHRONICZNIE w geście użytkownika (kliknięcie
 * przycisku trybu rozmowy), przed jakimkolwiek `await`. Po tym element może grać także później,
 * gdy gestu już nie ma. Bezpieczne do wielokrotnego wywołania.
 */
export function primeSpeechPlayback(): void {
  if (audioUnlocked) return;
  const audio = getSharedAudio();
  if (!audio) return;
  try {
    // Najkrótszy poprawny plik WAV (cisza) — nie wymaga sieci, więc odtworzy się w tym samym geście.
    audio.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    const played = audio.play();
    if (played && typeof played.then === "function") {
      void played.then(() => { audio.pause(); audioUnlocked = true; }).catch(() => { /* zostaje zablokowane */ });
    } else {
      audio.pause();
      audioUnlocked = true;
    }
  } catch {
    /* ignore — przy niepowodzeniu zostaje głos przeglądarki */
  }
}

function releaseObjectUrl(): void {
  if (!currentObjectUrl) return;
  URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = null;
}

function stopServerAudio(): void {
  const audio = sharedAudio;
  if (!audio) return;
  try {
    // Element jest WSPÓŁDZIELONY, więc uchwyty poprzedniej wypowiedzi wiszą na nim dalej. Zdejmujemy
    // je PRZED `load()`, bo przeładowanie bez źródła potrafi wywołać zdarzenie `error` — a to
    // uruchomiłoby `onEnd` już zatrzymanej wypowiedzi (w trybie rozmowy: przedwczesny powrót do
    // nasłuchu). Nowa wypowiedź i tak ustawia własne uchwyty tuż po tym wywołaniu.
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    // `removeAttribute` zamiast `src = ""` — pusty `src` bywa interpretowany jako adres strony
    // i generuje błąd sieci w konsoli.
    audio.removeAttribute("src");
    audio.load();
  } catch {
    /* ignore */
  }
  releaseObjectUrl();
}

/** Czy jakakolwiek synteza jest dostępna (przeglądarka LUB serwer). */
export function speechAvailable(): boolean {
  return ttsSupported() || !!serverVoiceId;
}

async function speakViaServer(
  text: string,
  generation: number,
  opts?: SpeakOptions,
  potwierdzStart?: () => void
): Promise<boolean> {
  if (!serverVoiceId || serverVoiceFailed) return false;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 1200), voiceId: serverVoiceId }),
    });
    if (!res.ok) {
      // 501 (brak konfiguracji) / 429 / 502 → fallback na przeglądarkę, ale JUŻ NA STAŁE:
      // kolejne zdania nie mają po co powtarzać tego samego nieudanego obiegu.
      const reason = await odczytajPowod(res);
      zatrzasnijGlosSerwerowy(reason);
      return false;
    }
    const blob = await res.blob();
    // Odczyt zatrzymany (albo zaczęła się nowa wypowiedź) w czasie oczekiwania na dźwięk — nie graj.
    if (generation !== speechGeneration) return true;
    const audio = getSharedAudio();
    if (!audio) return false;
    stopServerAudio();
    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;
    const done = () => {
      if (currentObjectUrl === url) releaseObjectUrl();
      opts?.onEnd?.();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.src = url;
    audio.playbackRate = speechRate;
    await audio.play();
    audioUnlocked = true; // udane odtworzenie też odblokowuje element na przyszłość
    potwierdzStart?.(); // dźwięk faktycznie ruszył — czujka nie ma czego pilnować
    return true;
  } catch {
    // Awaria sieci albo odrzucone `play()` — tak samo nie ma sensu ponawiać przy każdym zdaniu.
    zatrzasnijGlosSerwerowy(null);
    return false;
  }
}

/** Odczytuje kod powodu z odpowiedzi trasy. Brak powodu nie jest błędem — bywa 501/429. */
async function odczytajPowod(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { reason?: string };
    return typeof body.reason === "string" ? body.reason : null;
  } catch {
    return null;
  }
}

function zatrzasnijGlosSerwerowy(reason: string | null): void {
  if (serverVoiceFailed) return; // informujemy RAZ, nie przy każdym zdaniu
  serverVoiceFailed = true;
  onFallbackNotice?.(reason);
}

/**
 * Uzbraja czujkę ciszy wokół opcji wypowiedzi.
 *
 * Zwraca opakowane `opts` (rozbrajające czujkę przy `onEnd`) i funkcję potwierdzającą start.
 * Kluczowe: czujka i `onEnd` wykluczają się wzajemnie — wypowiedź kończy się albo dźwiękiem,
 * albo ciszą, nigdy jednym i drugim.
 */
function uzbrojCzujke(opts?: SpeakOptions): { opts: SpeakOptions | undefined; potwierdzStart: () => void } {
  if (!opts?.onSilent) return { opts, potwierdzStart: () => {} };
  let rozbrojona = false;
  const rozbroj = () => {
    if (rozbrojona) return true;
    rozbrojona = true;
    clearTimeout(timer);
    return false;
  };
  const timer = setTimeout(() => {
    if (rozbrojona) return;
    rozbrojona = true;
    opts.onSilent!();
  }, CZAS_NA_START_MS);

  return {
    opts: {
      ...opts,
      onEnd: () => {
        if (rozbroj()) return; // czujka już orzekła ciszę — nie wołamy obu
        opts.onEnd?.();
      },
    },
    potwierdzStart: () => {
      // Start rozbraja czujkę, ale NIE kończy wypowiedzi — `onEnd` przyjdzie własną drogą.
      if (!rozbrojona) clearTimeout(timer);
    },
  };
}

/** Wypowiada tekst w danym języku (BCP-47 lub nazwa). Przerywa poprzednią wypowiedź. */
export function speak(text: string, lang?: string | null, opts?: SpeakOptions): void {
  if (!text.trim()) return;
  // Głos serwerowy ma pierwszeństwo; przy jakimkolwiek problemie wracamy do przeglądarki.
  // Po zatrzaśnięciu (080/Z4) omijamy go BEZ żądania — dzięki temu synteza przeglądarki startuje
  // synchronicznie, wciąż w geście użytkownika. To jest cała różnica między „inny głos" a ciszą.
  // 084 (AC-2): czujka uzbraja się RAZ, dla całej wypowiedzi — także wtedy, gdy po drodze zmienimy
  // ścieżkę z serwerowej na przeglądarkową. Inaczej fallback gubiłby jedyne zabezpieczenie
  // dokładnie w tym momencie, w którym jest najbardziej potrzebne.
  const { opts: strzezone, potwierdzStart } = uzbrojCzujke(opts);

  if (serverVoiceId && !serverVoiceFailed) {
    stopSpeaking(); // zwiększa `speechGeneration`
    const generation = speechGeneration;
    void speakViaServer(text, generation, strzezone, potwierdzStart).then((ok) => {
      if (generation !== speechGeneration) return; // w międzyczasie zatrzymano / zaczęto nową
      if (!ok) speakViaBrowser(text, lang, strzezone, potwierdzStart);
    });
    return;
  }
  speakViaBrowser(text, lang, strzezone, potwierdzStart);
}

function speakViaBrowser(
  text: string,
  lang?: string | null,
  opts?: SpeakOptions,
  potwierdzStart?: () => void
): void {
  if (!ttsSupported() || !text.trim()) {
    /**
     * 084: brak syntezy to CISZA, a nie „przeczytane".
     *
     * Wołanie `onEnd` w tym miejscu było trzecią, niezależną drogą do zgłoszonego objawu: lektor
     * łańcuchuje zdania po `onEnd`, więc na urządzeniu bez syntezy przelatywał **całą porcję
     * w milczeniu**, pokazując rosnący licznik „wiadomość 3/10 · zdanie 2/4". Użytkownik widział
     * postęp i nie słyszał nic — dokładnie to zgłosił właściciel.
     *
     * Gdy nikt nie pyta o ciszę (`onSilent` nie podane), zachowujemy stare zachowanie: dla
     * konsumentów, którzy tylko chcą wiedzieć „skończone", nagła zmiana byłaby regresją.
     */
    if (opts?.onSilent) opts.onSilent();
    else opts?.onEnd?.();
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
    u.rate = speechRate;
    // `onstart` jest JEDYNYM dowodem, że WebKit przyjął wypowiedź. Jego brak (przy odrzuceniu poza
    // gestem użytkownika nie przychodzi żadne zdarzenie) jest tym, co wykrywa czujka ciszy.
    u.onstart = () => potwierdzStart?.();
    if (opts?.onEnd) {
      u.onend = () => opts.onEnd!();
      u.onerror = () => opts.onEnd!();
    }
    window.speechSynthesis.speak(u);
    // iOS/Safari (i Chrome) potrafią wejść w stan „paused" — resume() gwarantuje, że mowa ruszy.
    window.speechSynthesis.resume();
  } catch {
    /**
     * 084: wyjątek z syntezy to CISZA, a nie „nic się nie stało".
     *
     * Dawny pusty `catch` był czwartą drogą do zgłoszonego objawu: przy niesprawnej syntezie lektor
     * nie dostawał ani `onEnd`, ani `onerror`, więc łańcuch zamierał w milczeniu przy pokazanym
     * postępie. Czujka ciszy złapałaby to po sekundzie i pół — ale skoro wiemy TERAZ, nie ma powodu
     * kazać użytkownikowi czekać.
     */
    opts?.onSilent?.();
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
