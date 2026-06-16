import { resolveLlm, type ResolvedLlm } from "./resolver";
import type { OperationType } from "./operationTypes";
import { cacheKeyFor, getCached, setCached } from "@/lib/ai/cache";
import { checkAiBudget, recordAiUsage } from "@/lib/ai/usage";

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
}

export type TokenUsage = { prompt: number; completion: number; total: number };

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

function parseDataUrl(url: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(url);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

/** Jednorazowa odpowiedź (bez streamingu). */
export async function chatComplete(opts: ChatOptions): Promise<ChatResult> {
  const cfg = await resolveLlm(opts.op);
  if (!cfg) return UNCONFIGURED;
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
  const res = cfg.kind === "anthropic" ? await anthropicComplete(cfg, opts) : await openAiComplete(cfg, opts);
  if (cacheKey && res.ok) setCached(cacheKey, res.content, res.model);
  if (opts.userId && res.ok) void recordAiUsage(opts.userId, res.usage?.total ?? 0).catch(() => {});
  return res;
}

async function openAiComplete(cfg: ResolvedLlm, opts: ChatOptions): Promise<ChatResult> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
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
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    return { ok: false, status: 502, message: parseErr(err).slice(0, 200) };
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
  const res = await fetch(`${cfg.baseUrl}/messages`, {
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
      ...(system ? { system } : {}),
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    return { ok: false, status: 502, message: parseErr(err).slice(0, 200) };
  }
  const data = (await res.json().catch(() => null)) as
    | { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } }
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
    usage: u ? { prompt: u.input_tokens ?? 0, completion: u.output_tokens ?? 0, total: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) } : undefined,
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

export async function chatStream(opts: ChatOptions): Promise<Response> {
  const cfg = await resolveLlm(opts.op);
  if (!cfg) return new Response(UNCONFIGURED.message, { status: 503 });

  if (cfg.kind === "anthropic") return anthropicStream(cfg, opts);

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
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
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "LLM request failed");
    return new Response(parseErr(err).slice(0, 200), { status: 502 });
  }
  return new Response(res.body, { headers: SSE_HEADERS });
}

function openAiDelta(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

async function anthropicStream(cfg: ResolvedLlm, opts: ChatOptions): Promise<Response> {
  const { system, messages } = toAnthropic(opts.messages);
  const upstream = await fetch(`${cfg.baseUrl}/messages`, {
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
      ...(system ? { system } : {}),
      messages,
      stream: true,
    }),
  });
  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text().catch(() => "LLM request failed");
    return new Response(parseErr(err).slice(0, 200), { status: 502 });
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

  return new Response(stream, { headers: SSE_HEADERS });
}
