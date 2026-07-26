// 032: KATALOG DOSTAWCÓW SYNTEZY MOWY (lektor asystenta).
//
// Problem, który rozwiązuje: w `/admin/llm` administrator musiał WPISAĆ Z PAMIĘCI nazwę modelu
// syntezy mowy, bez żadnej informacji, który dostawca jest darmowy, który wymaga klucza i który w
// ogóle mówi dobrze po polsku. Funkcja była w aplikacji, ale praktycznie niekonfigurowalna.
//
// Ten plik jest STATYCZNYM SŁOWNIKIEM PODPOWIEDZI — nie konfiguracją. Konfiguracja (który dostawca,
// który model, jaki klucz) mieszka nadal w bazie: `LlmProvider` + `LlmAssignment` dla typu operacji
// `speech`, rozwiązywane przez `resolveLlmChain` (C-40 — zero hardcodowania dostawcy w kodzie, który
// woła syntezę). Wzorzec: `src/lib/warsztat/catalog.ts` (katalog wyposażenia w kodzie, nie w DB).
//
// Głosy są tu wpisane, bo dostawcy nie udostępniają ich w jednolity sposób, a lista musi być znana
// PRZED pierwszym wywołaniem (użytkownik wybiera głos w ustawieniach asystenta).

import type { ProviderKind } from "@/lib/llm/resolver";
import { SERVER_VOICES, type ServerVoice } from "@/lib/tts/serverVoices";

export interface TtsModelSpec {
  /** Identyfikator wysyłany dostawcy (albo znacznik wariantu, gdy dostawca nie ma pojęcia „model"). */
  id: string;
  label: string;
}

export interface TtsProviderSpec {
  /** Stabilny identyfikator pozycji katalogu (używany w panelu admina jako wybór z listy). */
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  models: TtsModelSpec[];
  voices: ServerVoice[];
  /** Czy korzystanie jest płatne (po ewentualnym darmowym limicie). */
  paid: boolean;
  /** Orientacyjny koszt — po polsku, dla administratora. */
  costHint: string;
  /** Czy trzeba podać klucz API. Dziś: wszyscy wymagają, ale pole zostaje jawne dla UI. */
  requiresKey: boolean;
  /** Jak dostawca radzi sobie z polskim — uczciwie, także gdy odpowiedź brzmi „słabo". */
  polishHint: string;
  /** Co zrobić, żeby zadziałało (skąd wziąć klucz). */
  setupHint: string;
}

// ── Głosy ────────────────────────────────────────────────────────────────────
// Rodzina zgodna z OpenAI (`/audio/speech`) — głosy NIEZALEŻNE OD JĘZYKA, opisane barwą.
// Reeksport z `serverVoices.ts`, żeby nie dublować listy (C-53).

const ELEVENLABS_VOICES: ServerVoice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", description: "Kobiecy, spokojny — dobry domyślny lektor." },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", description: "Kobiecy, ciepły i miękki." },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", description: "Kobiecy, niższy, z wyraźną dykcją." },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", description: "Męski, spokojny, „lektorski”." },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", description: "Męski, głębszy." },
];

// Google Cloud TTS: głosy są JAWNIE polskie (językowe), więc opisujemy je po polsku i z płcią.
const GOOGLE_VOICES: ServerVoice[] = [
  { id: "pl-PL-Standard-A", label: "Standard A (kobiecy)", description: "Najtańszy wariant, brzmi syntetycznie." },
  { id: "pl-PL-Wavenet-A", label: "Wavenet A (kobiecy)", description: "Naturalniejszy, dobry kompromis ceny i jakości." },
  { id: "pl-PL-Wavenet-B", label: "Wavenet B (męski)", description: "Męski, naturalny." },
  { id: "pl-PL-Neural2-A", label: "Neural2 A (kobiecy)", description: "Najlepsza jakość w tej rodzinie." },
  { id: "pl-PL-Neural2-C", label: "Neural2 C (męski)", description: "Męski, najlepsza jakość w tej rodzinie." },
];

const AZURE_VOICES: ServerVoice[] = [
  { id: "pl-PL-ZofiaNeural", label: "Zofia (kobiecy)", description: "Naturalny, uniwersalny — dobry domyślny lektor." },
  { id: "pl-PL-AgnieszkaNeural", label: "Agnieszka (kobiecy)", description: "Cieplejszy, spokojniejszy." },
  { id: "pl-PL-MarekNeural", label: "Marek (męski)", description: "Męski, wyraźny." },
];

// Groq PlayAI: głosy ANGIELSKIE. Nie ukrywamy tego — polski tekst przeczytany angielskim głosem
// brzmi źle, a administrator ma o tym wiedzieć PRZED wyborem.
const GROQ_VOICES: ServerVoice[] = [
  { id: "Fritz-PlayAI", label: "Fritz", description: "Męski, angielski głos." },
  { id: "Arista-PlayAI", label: "Arista", description: "Kobiecy, angielski głos." },
  { id: "Atlas-PlayAI", label: "Atlas", description: "Męski, niski, angielski głos." },
];

// ── Katalog ──────────────────────────────────────────────────────────────────

export const TTS_CATALOG: TtsProviderSpec[] = [
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai_compat",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o-mini-tts", label: "gpt-4o-mini-tts — najnowszy, najtańszy" },
      { id: "tts-1", label: "tts-1 — szybki, standardowa jakość" },
      { id: "tts-1-hd", label: "tts-1-hd — wyższa jakość, wolniejszy i droższy" },
    ],
    voices: SERVER_VOICES,
    paid: true,
    costHint: "Płatny od pierwszego znaku, ale bardzo tani — rzędu $0,015 za 1000 znaków (kilka groszy za odpowiedź asystenta).",
    requiresKey: true,
    polishHint: "Bardzo dobry polski — głosy są wielojęzyczne, ten sam głos czyta po polsku i po angielsku.",
    setupHint: "Klucz z platform.openai.com → API keys. Wymaga konta z opłaconym kredytem.",
  },
  {
    id: "groq-playai",
    label: "Groq (PlayAI)",
    kind: "openai_compat",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [{ id: "playai-tts", label: "playai-tts — szybki i tani" }],
    voices: GROQ_VOICES,
    paid: true,
    costHint: "Bardzo tani, rozliczany za znaki. Zwykle korzystamy z tego samego klucza Groq, co reszta modeli.",
    requiresKey: true,
    polishHint:
      "SŁABY do polskiego — dostępne głosy są angielskie i czytają polski tekst z angielską wymową. Wybieraj tylko do testów.",
    setupHint: "Klucz z console.groq.com → API keys (ten sam, którego Omnia używa do modeli tekstowych).",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    kind: "elevenlabs",
    baseUrl: "https://api.elevenlabs.io/v1",
    models: [
      { id: "eleven_multilingual_v2", label: "multilingual v2 — najlepsza jakość" },
      { id: "eleven_turbo_v2_5", label: "turbo v2.5 — szybszy, tańszy" },
      { id: "eleven_flash_v2_5", label: "flash v2.5 — najszybszy, najtańszy" },
    ],
    voices: ELEVENLABS_VOICES,
    paid: true,
    costHint: "Płatny abonament — darmowy pułap ~10 tys. znaków/mies., dalej plany od ok. $5/mies.",
    requiresKey: true,
    polishHint: "Najlepszy polski na rynku — brzmi najbardziej naturalnie z całej listy.",
    setupHint: "Klucz z elevenlabs.io → Profile → API Keys.",
  },
  {
    id: "google-tts",
    label: "Google Cloud Text-to-Speech",
    kind: "google_tts",
    baseUrl: "https://texttospeech.googleapis.com/v1",
    models: [{ id: "pl-PL", label: "polski (głos wybierasz z listy niżej)" }],
    voices: GOOGLE_VOICES,
    paid: true,
    costHint:
      "Darmowy limit miesięczny (ok. 1 mln znaków dla głosów Standard, 1 mln dla Wavenet/Neural2 liczonych osobno), potem płatny.",
    requiresKey: true,
    polishHint: "Dobry polski — głosy są jawnie polskie (Neural2 najlepsze, Standard brzmi syntetycznie).",
    setupHint:
      "Klucz API z Google Cloud Console (włącz Cloud Text-to-Speech API → Credentials → API key). Wymaga konta z rozliczeniami, nawet w ramach darmowego limitu.",
  },
  {
    id: "azure-speech",
    label: "Microsoft Azure Speech",
    kind: "azure_tts",
    // Adres zależy od regionu — administrator podmienia „westeurope" na swój region.
    baseUrl: "https://westeurope.tts.speech.microsoft.com",
    models: [{ id: "neural", label: "głosy neuronowe (jeden wariant)" }],
    voices: AZURE_VOICES,
    paid: true,
    costHint: "Darmowy limit ok. 500 tys. znaków/mies. dla głosów neuronowych, potem płatny.",
    requiresKey: true,
    polishHint: "Dobry polski — trzy naturalne głosy neuronowe (Zofia, Agnieszka, Marek).",
    setupHint:
      "Klucz z Azure Portal → zasób Speech → Keys and Endpoint. UWAGA: adres bazowy musi zawierać Twój region (domyślnie westeurope).",
  },
];

// ── Helpery ──────────────────────────────────────────────────────────────────

export function findTtsProviderById(id: string): TtsProviderSpec | undefined {
  return TTS_CATALOG.find((p) => p.id === id);
}

/**
 * Dopasowuje skonfigurowanego dostawcę (`LlmProvider`) do pozycji katalogu. Najpierw po adresie
 * bazowym (jednoznacznie), potem po samym rodzaju — dzięki temu administrator może zmienić region w
 * adresie Azure albo użyć proxy zgodnego z OpenAI, a katalog nadal poda właściwe głosy.
 */
export function findTtsProvider(kind: string, baseUrl: string): TtsProviderSpec | undefined {
  const normalized = baseUrl.replace(/\/+$/, "");
  return (
    TTS_CATALOG.find((p) => p.kind === kind && p.baseUrl.replace(/\/+$/, "") === normalized) ??
    TTS_CATALOG.find((p) => p.kind === kind)
  );
}

/** Głosy dostawcy o danym rodzaju (pierwsza pasująca pozycja katalogu). */
export function voicesForKind(kind: string): ServerVoice[] {
  return TTS_CATALOG.find((p) => p.kind === kind)?.voices ?? [];
}

export function isVoiceOfKind(kind: string, voiceId: string | null | undefined): boolean {
  return !!voiceId && voicesForKind(kind).some((v) => v.id === voiceId);
}

/** Domyślny głos dostawcy — pierwszy z listy (kolejność w katalogu jest celowa). */
export function defaultVoiceForKind(kind: string): string | null {
  return voicesForKind(kind)[0]?.id ?? null;
}
