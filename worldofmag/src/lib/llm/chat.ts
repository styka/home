import { resolveLlmChain, type ResolvedLlm } from "./resolver";
import type { OperationType } from "./operationTypes";
import { cacheKeyFor, getCached, setCached } from "@/lib/ai/cache";
import { checkAiBudget, recordAiUsage, recordAiCall } from "@/lib/ai/usage";

/**
 * Z-133: czy błąd jest przejściowy (warto spróbować fallbacku na inny model/dostawcę).
 * 429 (limit) i 5xx/sieć (503) — tak; 4xx (np. zły request, brak autoryzacji) — nie,
 * bo ten sam request u zapasowego dostawcy też zawiedzie.
 */
export function isRetryableLlmStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

// Wspólny interfejs do rozmów z LLM. Trasy budują wiadomości w stylu OpenAI,
// a dispatcher tłumaczy je na format konkretnego dostawcy (OpenAI-compatible
// albo Anthropic Messages API). Dzięki temu przełączenie dostawcy/modelu w
// panelu admina nie wymaga zmian w trasach.

export type ChatRole = "system" | "user" | "assistant";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[];
}

export interface ChatOptions {
  op: OperationType;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Wymuś odpowiedź w formacie JSON (tylko OpenAI-compatible; Anthropic polega na prompcie). */
  json?: boolean;
  /** Z-511: cache odpowiedzi dla identycznego wejścia (operacje deterministyczne). */
  cache?: boolean;
  /** Z-130: gdy podane — egzekwuj dzienny budżet AND zalicz tokeny do `AiUsage`.
   * Cache-hit nie kosztuje tokenów, więc nie jest blokowany budżetem. */
  userId?: string;
  /** 002-ai-architecture: etykieta źródła wywołania do logu `AiCall` (np. "home_agent", "fast_path"). */
  source?: string;
}

export type TokenUsage = {
  prompt: number;
  completion: number;
  total: number;
  /** Tokeny odczytane z cache promptu (Anthropic prompt caching); 0/undefined dla innych. */
  cacheRead?: number;
  /** Tokeny zapisane do cache promptu (Anthropic); 0/undefined dla innych. */
  cacheWrite?: number;
};

export type ChatResult =
  | { ok: true; content: string; model?: string; usage?: TokenUsage }
  | { ok: false; status: number; message: string };

const UNCONFIGURED = {
  ok: false as const,
  status: 503,
  message: "LLM nie jest skonfigurowany. Ustaw dostawcę i model w panelu admina (Admin → LLM).",
};

function parseErr(raw: string): string {
  try {
    const j = JSON.parse(raw);
    return j?.error?.message ?? j?.error ?? raw;
  } catch {
    return raw;
  }
}

// 010-ai-chat-rate-limit: ponawianie z backoffem dla PRZEJŚCIOWYCH błędów dostawcy
// (429 limit szybkości / 5xx / błąd sieci). Groq narzuca limit tokenów-na-minutę
// (TPM), który zwalnia się po chwili — zamiast oddawać użytkownikowi surowy błąd,
// odczekujemy (respektując nagłówek `Retry-After`) i próbujemy ten sam model ponownie.
// Retry jest zagnieżdżony WEWNĄTRZ pojedynczego wywołania modelu; łańcuch fallbacku
// (Z-133) w chatComplete/chatStream działa bez zmian (retry → dopiero potem next model).
const LLM_MAX_RETRIES = 2; // do 3 prób łącznie na jeden model
const LLM_RETRY_CAP_MS = 8000; // twardy cap na pojedyncze oczekiwanie

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Zwraca czas oczekiwania w ms z nagłówka `Retry-After` (sekundy albo data HTTP),
// tylko dla rozsądnej, dodatniej wartości; inaczej null (→ backoff wykładniczy).
function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after");
  if (!raw) return null;
  const secs = Number(raw.trim());
  if (Number.isFinite(secs)) {
    if (secs <= 0 || secs > 300) return null; // NaN wykluczone; ujemne/olbrzymie → ignoruj
    return secs * 1000;
  }
  const when = Date.parse(raw);
  if (!Number.isNaN(when)) {
    const delta = when - Date.now();
    if (delta > 0 && delta <= 300_000) return delta;
  }
  return null;
}

// Backoff wykładniczy z jitterem (~600ms → ~1500ms), capowany.
function backoffMs(attempt: number): number {
  const base = 600 * 2 ** attempt; // 600, 1200
  const jitter = Math.random() * 300;
  return Math.min(LLM_RETRY_CAP_MS, base + jitter);
}

// Owija `fetch`: przy błędzie przejściowym odczekuje i ponawia ten sam request.
// Ponawiamy TYLKO statusy przejściowe (isRetryableLlmStatus: 429/≥500) oraz rzucony
// fetch (sieć). Zwraca ostatnią odpowiedź (ok albo nie-ok) — wywołujący obsługuje
// `!res.ok` jak dotąd. Rzuca tylko, gdy sieć zawiodła we WSZYSTKICH próbach.
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let netErr: unknown = null;
  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      netErr = e;
      if (attempt < LLM_MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw e;
    }
    if (res.ok || !isRetryableLlmStatus(res.status) || attempt === LLM_MAX_RETRIES) {
      return res;
    }
    // Status przejściowy i mamy jeszcze próby: policz oczekiwanie i ponów.
    const wait = retryAfterMs(res) ?? backoffMs(attempt);
    if (wait > LLM_RETRY_CAP_MS) return res; // dostawca każe czekać za długo → oddaj fallbackowi
    res.body?.cancel().catch(() => {}); // zwolnij ciało odrzuconej odpowiedzi
    await sleep(wait);
  }
  // Nieosiągalne (pętla zawsze zwraca/rzuca), ale TS wymaga domknięcia.
  if (netErr) throw netErr;
  return fetch(url, init);
}

function parseDataUrl(url: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(url);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

/** Jednorazowa odpowiedź (bez streamingu). */
export async function chatComplete(opts: ChatOptions): Promise<ChatResult> {
  // Z-133: łańcuch [model admina → fallback Groq]. Próbujemy po kolei.
  const chain = await resolveLlmChain(opts.op);
  if (chain.length === 0) return UNCONFIGURED;
  // Z-511: opcjonalny cache (identyczne wejście → identyczne wyjście).
  const cacheKey = opts.cache
    ? cacheKeyFor({ op: opts.op, messages: opts.messages, temperature: opts.temperature, maxTokens: opts.maxTokens, json: opts.json })
    : null;
  if (cacheKey) {
    const hit = getCached(cacheKey);
    if (hit) return { ok: true, content: hit.value, model: hit.model }; // free — bez budżetu
  }
  // Z-130: egzekwuj dzienny budżet AI (po cache-hit, przed realnym wywołaniem LLM).
  if (opts.userId) {
    const budget = await checkAiBudget(opts.userId);
    if (!budget.ok) return { ok: false, status: 429, message: budget.message };
  }

  let last: Extract<ChatResult, { ok: false }> = { ok: false, status: 502, message: "LLM request failed" };
  for (let i = 0; i < chain.length; i++) {
    const cfg = chain[i];
    const started = Date.now();
    const res = cfg.kind === "anthropic" ? await anthropicComplete(cfg, opts) : await openAiComplete(cfg, opts);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      if (cacheKey) setCached(cacheKey, res.content, res.model);
      if (opts.userId) void recordAiUsage(opts.userId, res.usage?.total ?? 0).catch(() => {});
      // 002-ai-architecture: log per-wywołanie (koszt/tokeny/czas). Fire-and-forget.
      void recordAiCall({
        userId: opts.userId ?? null,
        operationType: opts.op,
        providerKind: cfg.kind,
        model: res.model ?? cfg.model,
        usage: res.usage,
        latencyMs,
        ok: true,
        source: opts.source,
      }).catch(() => {});
      return res;
    }
    last = res;
    // Błąd nieprzejściowy (4xx poza 429) → fallback nie pomoże, przerywamy.
    if (!isRetryableLlmStatus(res.status)) break;
    if (i < chain.length - 1) {
      console.warn(`[llm] ${opts.op}: model ${cfg.model} niedostępny (status ${res.status}) — próbuję fallback`);
    }
  }
  return last;
}

async function openAiComplete(cfg: ResolvedLlm, opts: ChatOptions): Promise<ChatResult> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: opts.messages,
        temperature: opts.temperature ?? cfg.temperature ?? undefined,
        max_tokens: opts.maxTokens ?? cfg.maxTokens ?? undefined,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (e) {
    // Z-133: błąd sieci → status przejściowy (503), by zadziałał fallback.
    return { ok: false, status: 503, message: `Błąd sieci LLM: ${(e as Error).message}`.slice(0, 200) };
  }
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    return { ok: false, status: res.status, message: parseErr(err).slice(0, 200) };
  }
  const data = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
    | null;
  const u = data?.usage;
  return {
    ok: true,
    content: data?.choices?.[0]?.message?.content ?? "",
    model: cfg.model,
    usage: u ? { prompt: u.prompt_tokens ?? 0, completion: u.completion_tokens ?? 0, total: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0) } : undefined,
  };
}

// --- Anthropic (Messages API) ---

interface AnthropicContent {
  type: "text" | "image";
  text?: string;
  source?: { type: "base64" | "url"; media_type?: string; data?: string; url?: string };
}

// Buduje pole `system` dla Anthropic Messages API. Gdy jest treść — zwraca ją
// jako pojedynczy blok tekstu z `cache_control: ephemeral`, żeby stały prefiks
// promptu (instrukcja systemowa + katalog narzędzi) był cache'owany (niższy koszt
// i szybsza odpowiedź). To GA — bez beta-headera; działa na `anthropic-version`.
// Dla poprawnego trafienia w cache prefiks musi być stabilny między wywołaniami —
// trasy wstrzykują zmienne (data/kontekst) do wiadomości user, nie do `system`.
function toAnthropicSystem(
  system: string | undefined
): Array<{ type: "text"; text: string; cache_control: { type: "ephemeral" } }> | undefined {
  if (!system) return undefined;
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

function toAnthropic(messages: ChatMessage[]): {
  system: string | undefined;
  messages: Array<{ role: "user" | "assistant"; content: AnthropicContent[] | string }>;
} {
  const systemParts: string[] = [];
  const out: Array<{ role: "user" | "assistant"; content: AnthropicContent[] | string }> = [];

  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string") systemParts.push(m.content);
      continue;
    }
    const role = m.role === "assistant" ? "assistant" : "user";
    if (typeof m.content === "string") {
      out.push({ role, content: m.content });
      continue;
    }
    const parts: AnthropicContent[] = m.content.map((p) => {
      if (p.type === "text") return { type: "text", text: p.text };
      const url = p.image_url.url;
      const data = parseDataUrl(url);
      if (data) {
        return { type: "image", source: { type: "base64", media_type: data.mediaType, data: data.data } };
      }
      return { type: "image", source: { type: "url", url } };
    });
    out.push({ role, content: parts });
  }

  return { system: systemParts.length ? systemParts.join("\n\n") : undefined, messages: out };
}

async function anthropicComplete(cfg: ResolvedLlm, opts: ChatOptions): Promise<ChatResult> {
  const { system, messages } = toAnthropic(opts.messages);
  let res: Response;
  try {
    res = await fetchWithRetry(`${cfg.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: opts.maxTokens ?? cfg.maxTokens ?? 1024,
        temperature: opts.temperature ?? cfg.temperature ?? undefined,
        ...(system ? { system: toAnthropicSystem(system) } : {}),
        messages,
      }),
    });
  } catch (e) {
    return { ok: false, status: 503, message: `Błąd sieci LLM: ${(e as Error).message}`.slice(0, 200) };
  }
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    return { ok: false, status: res.status, message: parseErr(err).slice(0, 200) };
  }
  const data = (await res.json().catch(() => null)) as
    | {
        content?: Array<{ type: string; text?: string }>;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        };
      }
    | null;
  const text = (data?.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  const u = data?.usage;
  return {
    ok: true,
    content: text,
    model: cfg.model,
    usage: u
      ? {
          prompt: u.input_tokens ?? 0,
          completion: u.output_tokens ?? 0,
          total: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
          cacheRead: u.cache_read_input_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
        }
      : undefined,
  };
}

// --- Streaming ---
// Zwraca strumień SSE w formacie OpenAI (`data: {choices:[{delta:{content}}]}`),
// niezależnie od dostawcy — front (NotesQA) nie wymaga zmian.

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

/** Wynik próby otwarcia strumienia od jednego dostawcy (Z-133 fallback). */
type StreamAttempt =
  | { ok: true; response: Response }
  | { ok: false; status: number; message: string };

export async function chatStream(opts: ChatOptions): Promise<Response> {
  // Z-133: ten sam łańcuch fallbacku co w chatComplete — przy błędzie przejściowym
  // (429/5xx/sieć) próbujemy kolejnego modelu, ZANIM strumień ruszy do klienta.
  const chain = await resolveLlmChain(opts.op);
  if (chain.length === 0) return new Response(UNCONFIGURED.message, { status: 503 });

  let lastStatus = 502;
  let lastMsg = "LLM request failed";
  for (let i = 0; i < chain.length; i++) {
    const cfg = chain[i];
    const attempt = cfg.kind === "anthropic" ? await anthropicStream(cfg, opts) : await openAiStream(cfg, opts);
    if (attempt.ok) return attempt.response;
    lastStatus = attempt.status;
    lastMsg = attempt.message;
    if (!isRetryableLlmStatus(attempt.status)) break;
    if (i < chain.length - 1) {
      console.warn(`[llm] stream ${opts.op}: model ${cfg.model} niedostępny (status ${attempt.status}) — próbuję fallback`);
    }
  }
  return new Response(lastMsg, { status: lastStatus });
}

async function openAiStream(cfg: ResolvedLlm, opts: ChatOptions): Promise<StreamAttempt> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: opts.messages,
        temperature: opts.temperature ?? cfg.temperature ?? undefined,
        max_tokens: opts.maxTokens ?? cfg.maxTokens ?? undefined,
        stream: true,
      }),
    });
  } catch (e) {
    return { ok: false, status: 503, message: `Błąd sieci LLM: ${(e as Error).message}`.slice(0, 200) };
  }
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "LLM request failed");
    return { ok: false, status: res.ok ? 502 : res.status, message: parseErr(err).slice(0, 200) };
  }
  return { ok: true, response: new Response(res.body, { headers: SSE_HEADERS }) };
}

function openAiDelta(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

async function anthropicStream(cfg: ResolvedLlm, opts: ChatOptions): Promise<StreamAttempt> {
  const { system, messages } = toAnthropic(opts.messages);
  let upstream: Response;
  try {
    upstream = await fetchWithRetry(`${cfg.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: opts.maxTokens ?? cfg.maxTokens ?? 1024,
        temperature: opts.temperature ?? cfg.temperature ?? undefined,
        ...(system ? { system: toAnthropicSystem(system) } : {}),
        messages,
        stream: true,
      }),
    });
  } catch (e) {
    return { ok: false, status: 503, message: `Błąd sieci LLM: ${(e as Error).message}`.slice(0, 200) };
  }
  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text().catch(() => "LLM request failed");
    return { ok: false, status: upstream.ok ? 502 : upstream.status, message: parseErr(err).slice(0, 200) };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (evt.type === "content_block_delta" && evt.delta?.text) {
            controller.enqueue(encoder.encode(openAiDelta(evt.delta.text)));
          }
        } catch {
          // pomiń niepełne/nieznane zdarzenia
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return { ok: true, response: new Response(stream, { headers: SSE_HEADERS }) };
}
