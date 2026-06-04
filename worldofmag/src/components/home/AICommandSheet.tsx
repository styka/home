"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles, Loader2, CheckCircle, XCircle, X, ChevronDown, ChevronUp, ArrowRight,
  Send, History, Plus, FileText, Trash2, ListChecks, Square, RefreshCw, Copy, Check, Pencil,
} from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { ActionDrawer } from "@/components/home/ActionDrawer";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import {
  listAiConversations, getAiConversation, createAiConversation, appendAiMessage,
  deleteAiConversation, renameAiConversation, type ConversationMeta,
} from "@/actions/aiConversations";
import { createUserReport } from "@/actions/reports";
import type { AIAction } from "@/lib/ai/aiAction";
import type { ActionResult } from "@/app/api/llm/home/execute/route";

interface RouteContext {
  context: string[];
  placeholder: string;
  routeHint: string;
  activeListId?: string;
  activeProjectId?: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LogEntry {
  iter: number;
  step: string;
  thought: string;
  tools?: { tool: string; args: Record<string, unknown> }[];
  results?: unknown;
  question?: string;
  options?: string[];
  actionsCount?: number;
}

interface AgentResponse {
  step?: "clarify" | "answer" | "plan" | "navigate" | "report";
  question?: string;
  options?: string[];
  answer?: string;
  actions?: AIAction[];
  url?: string;
  label?: string;
  title?: string;
  content?: string;
  followups?: string[];
  log?: LogEntry[];
  messages?: ChatMessage[];
  error?: string;
}

// Jedna „kafelka" w wątku rozmowy. `data` z DB pozwala odtworzyć kartę bez ponownego uruchamiania agenta.
type Turn =
  | { id: string; role: "user"; kind: "text"; content: string }
  | { id: string; role: "assistant"; kind: "answer"; content: string; followups?: string[]; log?: LogEntry[] }
  | { id: string; role: "assistant"; kind: "clarify"; content: string; options?: string[]; messages?: ChatMessage[]; log?: LogEntry[]; resolved?: boolean }
  | { id: string; role: "assistant"; kind: "navigate"; content: string; url: string; label: string; log?: LogEntry[] }
  | { id: string; role: "assistant"; kind: "plan"; content: string; actions: AIAction[]; messages?: ChatMessage[]; log?: LogEntry[]; done?: boolean }
  | { id: string; role: "assistant"; kind: "report"; content: string; title: string; savedSlug?: string; log?: LogEntry[] }
  | { id: string; role: "assistant"; kind: "results"; content: string; results: ActionResult[] };

const LIST_SUB_PAGES = ["products", "units", "categories", "icons", "stores"];

// Wszystkie moduły, na których asystent potrafi WYKONYWAĆ akcje (zgodne z agentem + execute).
const ACTIONABLE_MODULES = [
  "shopping", "tasks", "notes", "pets", "habits", "portfel", "kitchen", "flota",
  "magazynowanie", "health", "languages", "news", "weather",
] as const;

function ctx(primary: string): string[] {
  return [primary, ...ACTIONABLE_MODULES.filter((m) => m !== primary)];
}

function deriveContextFromPath(pathname: string): RouteContext {
  if (pathname.startsWith("/shopping/")) {
    const seg = pathname.split("/")[2] ?? "";
    const isListView = seg && !LIST_SUB_PAGES.includes(seg);
    return {
      context: ctx("shopping"),
      placeholder: 'Np. "Dodaj mleko i chleb" lub "Co jeszcze muszę kupić?"',
      routeHint: isListView ? "Użytkownik ogląda konkretną listę zakupów" : "Użytkownik jest na stronie głównej zakupów",
      activeListId: isListView ? seg : undefined,
    };
  }
  if (pathname === "/shopping") return { context: ctx("shopping"), placeholder: 'Np. "Dodaj mleko do zakupów"', routeHint: "Strona główna modułu Zakupy" };
  if (pathname.startsWith("/tasks/")) {
    const seg = pathname.split("/")[2] ?? "";
    const viewNames: Record<string, string> = { today: "widok zadań na dziś", upcoming: "widok nadchodzących zadań", overdue: "widok zaległych zadań", all: "widok wszystkich zadań" };
    const isVirtualView = seg in viewNames;
    return { context: ctx("tasks"), placeholder: 'Np. "Które zadanie jest najważniejsze?"', routeHint: `Użytkownik jest na ${viewNames[seg] ?? "widoku projektu zadań"}`, activeProjectId: !isVirtualView && seg ? seg : undefined };
  }
  if (pathname === "/tasks") return { context: ctx("tasks"), placeholder: 'Np. "Dodaj zadanie kupić leki na jutro"', routeHint: "Strona główna modułu Zadania" };
  if (pathname.startsWith("/notes")) return { context: ctx("notes"), placeholder: 'Np. "Dodaj notatkę o..." lub "Znajdź notatkę o..."', routeHint: "Moduł Notatki" };
  if (pathname.startsWith("/pets")) return { context: ctx("pets"), placeholder: 'Np. "Zważ Reksia 12 kg"', routeHint: "Moduł Zwierzęta" };
  if (pathname.startsWith("/habits")) return { context: ctx("habits"), placeholder: 'Np. "Odhacz bieganie"', routeHint: "Moduł Nawyki" };
  if (pathname.startsWith("/portfel")) return { context: ctx("portfel"), placeholder: 'Np. "Wydałem 45 zł na jedzenie"', routeHint: "Moduł Portfel (finanse)" };
  if (pathname.startsWith("/flota")) return { context: ctx("flota"), placeholder: 'Np. "Zatankowałem 40 litrów za 260 zł"', routeHint: "Moduł Flota (pojazdy)" };
  if (pathname.startsWith("/kitchen")) return { context: ctx("kitchen"), placeholder: 'Np. "Zaplanuj makaron na obiad"', routeHint: "Moduł Kuchnia" };
  if (pathname.startsWith("/magazynowanie")) return { context: ctx("magazynowanie"), placeholder: 'Np. "Dodaj 5 wkrętarek do garażu"', routeHint: "Moduł Magazynowanie" };
  if (pathname.startsWith("/health")) return { context: ctx("health"), placeholder: 'Np. "Dodaj wizytę u dentysty w piątek 15:00"', routeHint: "Moduł Zdrowie" };
  if (pathname.startsWith("/languages")) return { context: ctx("languages"), placeholder: 'Np. "Dodaj fiszkę dog = pies"', routeHint: "Moduł Języki" };
  if (pathname.startsWith("/wiadomosci")) return { context: ctx("news"), placeholder: 'Np. "Dodaj temat: sztuczna inteligencja"', routeHint: "Moduł Wiadomości" };
  if (pathname.startsWith("/pogoda")) return { context: ctx("weather"), placeholder: 'Np. "Dodaj lokalizację Kraków"', routeHint: "Moduł Pogoda" };
  return { context: ctx("shopping"), placeholder: "Zapytaj o cokolwiek lub wydaj polecenie…", routeHint: "Strona główna aplikacji" };
}

const STARTER_CHIPS = [
  "Co mam dziś najważniejszego do zrobienia?",
  "Podsumuj mój tydzień",
  "Znajdź 5 obowiązków pasujących do mojego nastroju i posortuj priorytetami",
  "Zrób raport z tej rozmowy",
];

function ReasoningLog({ log }: { log?: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!log?.length) return null;
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {log.filter((l) => l.thought).map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <Sparkles size={11} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 3 }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.thought}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {expanded ? "Ukryj log rozumowania" : "Pokaż log rozumowania"}
      </button>
      {expanded && (
        <pre style={{ marginTop: 6, padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 10.5, lineHeight: 1.5, color: "var(--text-secondary)", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 240, overflowY: "auto" }}>
          {log.map((l) => {
            const head = `#${l.iter} [${l.step}] ${l.thought}`;
            if (l.step === "query") return `${head}\n  narzędzia: ${JSON.stringify(l.tools)}\n  wyniki: ${JSON.stringify(l.results)}`;
            if (l.step === "clarify") return `${head}\n  pytanie: ${l.question}`;
            if (l.step === "plan") return `${head}\n  akcje: ${l.actionsCount}`;
            return head;
          }).join("\n\n")}
        </pre>
      )}
    </div>
  );
}

let TURN_SEQ = 0;
function newId(): string {
  TURN_SEQ += 1;
  return `t${Date.now()}_${TURN_SEQ}`;
}

export function AICommandSheet() {
  const pathname = usePathname();
  const router = useRouter();
  const { context, placeholder, routeHint, activeListId, activeProjectId } = deriveContextFromPath(pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [liveThoughts, setLiveThoughts] = useState<string[]>([]); // myśli agenta na żywo (streaming)
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Przegląd planu (ActionDrawer)
  const [planTurnId, setPlanTurnId] = useState<string | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  const [isRefining, setIsRefining] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Historia rozmów
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const convoIdRef = useRef<string | null>(null);
  convoIdRef.current = conversationId;
  // Anulowanie generowania (Stop) + ostatni payload do „Generuj ponownie".
  const abortRef = useRef<AbortController | null>(null);
  const lastPayloadRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, busy]);

  // Esc zamyka sheet (gdy nie piszemy w polu — pozwalamy textarea obsłużyć własny Esc).
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        if (tag !== "textarea" && tag !== "input") handleClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Zatrzymaj generowanie przy zamknięciu/unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Autofokus pola wejścia po otwarciu (desktop) — natychmiast piszesz.
  useEffect(() => {
    if (!isOpen || showHistory) return;
    const t = setTimeout(() => {
      const ta = sheetRef.current?.querySelector("textarea") as HTMLTextAreaElement | null;
      ta?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [isOpen, showHistory]);

  // Zapis wiadomości do DB (best-effort, nie blokuje UI).
  const persist = useCallback(async (role: "user" | "assistant", content: string, kind: string, data?: unknown) => {
    const cid = convoIdRef.current;
    if (!cid) return;
    try {
      await appendAiMessage(cid, { role, content, kind, data });
    } catch { /* ignore */ }
  }, []);

  function resetConversation() {
    setTurns([]);
    setConversationId(null);
    convoIdRef.current = null;
    setPlanTurnId(null);
    setError(null);
    setInputText("");
  }

  function handleClose() {
    setIsOpen(false);
    setShowHistory(false);
  }

  function goTo(url: string) {
    handleClose();
    router.push(url);
  }

  // Klik w link w treści markdown: wewnętrzny ("/…") → nawigacja SPA (zamyka sheet);
  // zewnętrzny (http/https, np. wyniki web_search) → nowa karta, żeby nie wyrzucić z aplikacji.
  function handleBubbleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;
    const href = target.getAttribute("href") ?? "";
    if (href.startsWith("/") && !href.startsWith("//")) {
      e.preventDefault();
      goTo(href);
    } else if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  // Mapuje wątek na zwięzłą historię (poziom wyświetlania) dla kontekstu wielo-turowego.
  function buildHistory(): ChatMessage[] {
    const out: ChatMessage[] = [];
    for (const t of turns) {
      if (t.role === "user") out.push({ role: "user", content: t.content });
      else if (t.kind === "answer") out.push({ role: "assistant", content: t.content });
      else if (t.kind === "report") out.push({ role: "assistant", content: `(raport: ${t.title})` });
      else if (t.kind === "navigate") out.push({ role: "assistant", content: `(propozycja przejścia: ${t.label})` });
      else if (t.kind === "plan") out.push({ role: "assistant", content: `(zaproponowano ${t.actions.length} akcji)` });
      else if (t.kind === "clarify") out.push({ role: "assistant", content: `(pytanie: ${t.content})` });
    }
    return out;
  }

  function applyResponse(data: AgentResponse, log?: LogEntry[]) {
    if (data.error) { setError(data.error); return; }
    const id = newId();
    if (data.step === "clarify") {
      const content = data.question ?? "Doprecyzuj polecenie.";
      setTurns((t) => [...t, { id, role: "assistant", kind: "clarify", content, options: data.options, messages: data.messages, log: data.log ?? log }]);
      void persist("assistant", content, "clarify", { options: data.options });
      return;
    }
    if (data.step === "answer") {
      const content = data.answer ?? "";
      setTurns((t) => [...t, { id, role: "assistant", kind: "answer", content, followups: data.followups, log: data.log ?? log }]);
      void persist("assistant", content, "answer", { log: data.log ?? log, followups: data.followups });
      return;
    }
    if (data.step === "navigate" && data.url) {
      const label = data.label ?? "Otwórz widok";
      setTurns((t) => [...t, { id, role: "assistant", kind: "navigate", content: `Przejść do: ${label}?`, url: data.url!, label, log: data.log ?? log }]);
      void persist("assistant", `Propozycja przejścia: ${label}`, "navigate", { url: data.url, label });
      return;
    }
    if (data.step === "report") {
      const title = data.title ?? "Raport";
      const content = data.content ?? "";
      setTurns((t) => [...t, { id, role: "assistant", kind: "report", title, content, log: data.log ?? log }]);
      void persist("assistant", content, "report", { title });
      return;
    }
    if (data.step === "plan") {
      const actions = data.actions ?? [];
      setTurns((t) => [...t, { id, role: "assistant", kind: "plan", content: `Zaproponowano ${actions.length} ${actions.length === 1 ? "akcję" : "akcji"}`, actions, messages: data.messages, log: data.log ?? log }]);
      void persist("assistant", `Zaproponowano ${actions.length} akcji`, "plan", { actions });
      return;
    }
    setError("Nieoczekiwana odpowiedź asystenta.");
  }

  async function callAgent(payload: Record<string, unknown>, opts?: { isRetry?: boolean }) {
    setError(null);
    setBusy(true);
    setLiveThoughts([]);
    if (!opts?.isRetry) lastPayloadRef.current = payload; // do „Generuj ponownie"
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/llm/home/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: controller.signal,
      });

      const ctype = res.headers.get("content-type") ?? "";
      if (ctype.includes("text/event-stream") && res.body) {
        // Streaming (SSE): myśli na żywo + finalny wynik.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let finalApplied = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            let evt: { type?: string; text?: string; status?: number; body?: AgentResponse };
            try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
            if (evt.type === "thought" && evt.text) {
              setLiveThoughts((prev) => [...prev, evt.text!]);
            } else if (evt.type === "final" && evt.body) {
              finalApplied = true;
              if ((evt.status ?? 200) >= 400 && !evt.body.step) setError(evt.body.error ?? "Błąd asystenta");
              else applyResponse(evt.body);
            }
          }
        }
        if (!finalApplied) setError("Połączenie przerwane przed odpowiedzią.");
      } else {
        // Fallback bez streamingu.
        const data = (await res.json()) as AgentResponse;
        if (!res.ok && !data.step) { setError(data.error ?? "Błąd asystenta"); return; }
        applyResponse(data);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // świadome zatrzymanie — bez błędu
      setError("Nie udało się połączyć z asystentem");
    } finally {
      abortRef.current = null;
      setBusy(false);
      setLiveThoughts([]);
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  // Generuj ponownie: usuń ostatnią odpowiedź asystenta i powtórz ostatnie zapytanie.
  function regenerate() {
    const payload = lastPayloadRef.current;
    if (!payload || busy) return;
    setTurns((t) => {
      const copy = [...t];
      while (copy.length && copy[copy.length - 1].role === "assistant") copy.pop();
      return copy;
    });
    void callAgent(payload, { isRetry: true });
  }

  function retryLast() {
    if (lastPayloadRef.current) void callAgent(lastPayloadRef.current, { isRetry: true });
  }

  async function handleSend(textArg?: string) {
    const text = (textArg ?? inputText).trim();
    if (!text || busy) return;
    setInputText("");

    // Utwórz rozmowę przy pierwszej wiadomości.
    if (!convoIdRef.current) {
      try {
        const convo = await createAiConversation(text);
        setConversationId(convo.id);
        convoIdRef.current = convo.id;
      } catch { /* działamy dalej bez persystencji */ }
    }

    const history = buildHistory();
    setTurns((t) => [...t, { id: newId(), role: "user", kind: "text", content: text }]);
    void persist("user", text, "text");

    await callAgent({
      text, context, routeHint, activeListId, currentProjectId: activeProjectId,
      today: new Date().toISOString(), history,
    });
  }

  function submitClarify(turn: Extract<Turn, { kind: "clarify" }>, value: string) {
    const v = value.trim();
    if (!v || !turn.messages) return;
    setTurns((t) => t.map((x) => (x.id === turn.id ? { ...x, resolved: true } : x)));
    setTurns((t) => [...t, { id: newId(), role: "user", kind: "text", content: v }]);
    void persist("user", v, "text");
    void callAgent({
      messages: turn.messages, clarifyAnswer: v, context, routeHint, activeListId,
      currentProjectId: activeProjectId, today: new Date().toISOString(),
    });
  }

  // „Popraw przez AI" — agent przeplanowuje cały plan.
  async function handleRefine(turn: Extract<Turn, { kind: "plan" }>, feedback: string) {
    const fb = feedback.trim();
    if (!fb || !turn.messages) return;
    setError(null);
    setIsRefining(true);
    try {
      const res = await fetch("/api/llm/home/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: turn.messages, refine: fb, context, routeHint, activeListId, currentProjectId: activeProjectId, today: new Date().toISOString() }),
      });
      const data = (await res.json()) as AgentResponse;
      if (!res.ok && !data.step) { setError(data.error ?? "Błąd asystenta"); return; }
      // Zaktualizuj kartę planu w miejscu (nowy zestaw akcji).
      if (data.step === "plan") {
        setTurns((t) => t.map((x) => (x.id === turn.id && x.kind === "plan" ? { ...x, actions: data.actions ?? [], messages: data.messages, content: `Zaproponowano ${(data.actions ?? []).length} akcji` } : x)));
        setPlanVersion((v) => v + 1);
      } else {
        applyResponse(data);
        setPlanTurnId(null);
      }
    } catch {
      setError("Nie udało się połączyć z asystentem");
    } finally {
      setIsRefining(false);
    }
  }

  async function handleExecute(turn: Extract<Turn, { kind: "plan" }>, confirmedActions: AIAction[]) {
    setIsExecuting(true);
    try {
      const res = await fetch("/api/llm/home/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: confirmedActions, activeListId, currentProjectId: activeProjectId }),
      });
      const data = (await res.json()) as { results?: ActionResult[] };
      const results = data.results ?? [];
      setTurns((t) => t.map((x) => (x.id === turn.id && x.kind === "plan" ? { ...x, done: true } : x)));
      setTurns((t) => [...t, { id: newId(), role: "assistant", kind: "results", content: "Wykonano akcje", results }]);
      void persist("assistant", "Wykonano akcje", "results", { results });
      setPlanTurnId(null);
      router.refresh();
    } catch {
      setError("Nie udało się wykonać akcji");
    } finally {
      setIsExecuting(false);
    }
  }

  async function saveReport(turn: Extract<Turn, { kind: "report" }>) {
    try {
      const report = await createUserReport({ title: turn.title, content: turn.content });
      setTurns((t) => t.map((x) => (x.id === turn.id && x.kind === "report" ? { ...x, savedSlug: report.slug } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać raportu");
    }
  }

  // ── Historia rozmów ─────────────────────────────────────────────────────────
  async function openHistory() {
    setShowHistory(true);
    try { setConversations(await listAiConversations()); } catch { /* ignore */ }
  }

  async function loadConversation(id: string) {
    try {
      const convo = await getAiConversation(id);
      if (!convo) return;
      const rehydrated: Turn[] = convo.messages.map((m) => {
        const data = (m.data ?? {}) as Record<string, unknown>;
        if (m.role === "user") return { id: m.id, role: "user", kind: "text", content: m.content };
        switch (m.kind) {
          case "report": return { id: m.id, role: "assistant", kind: "report", title: (data.title as string) ?? "Raport", content: m.content };
          case "navigate": return { id: m.id, role: "assistant", kind: "navigate", content: m.content, url: (data.url as string) ?? "/", label: (data.label as string) ?? "Otwórz" };
          case "plan": return { id: m.id, role: "assistant", kind: "plan", content: m.content, actions: (data.actions as AIAction[]) ?? [], done: true };
          case "results": return { id: m.id, role: "assistant", kind: "results", content: m.content, results: (data.results as ActionResult[]) ?? [] };
          case "clarify": return { id: m.id, role: "assistant", kind: "clarify", content: m.content, resolved: true };
          default: return { id: m.id, role: "assistant", kind: "answer", content: m.content, followups: Array.isArray(data.followups) ? (data.followups as string[]) : undefined };
        }
      });
      setTurns(rehydrated);
      setConversationId(convo.id);
      convoIdRef.current = convo.id;
      setShowHistory(false);
    } catch { /* ignore */ }
  }

  async function removeConversation(id: string) {
    try {
      await deleteAiConversation(id);
      setConversations((c) => c.filter((x) => x.id !== id));
      if (convoIdRef.current === id) resetConversation();
    } catch { /* ignore */ }
  }

  async function commitRename(id: string) {
    const title = renameText.trim();
    setRenamingId(null);
    if (!title) return;
    setConversations((c) => c.map((x) => (x.id === id ? { ...x, title } : x)));
    try { await renameAiConversation(id, title); } catch { /* ignore */ }
  }

  const planTurn = planTurnId ? (turns.find((t) => t.id === planTurnId && t.kind === "plan") as Extract<Turn, { kind: "plan" }> | undefined) : undefined;

  return (
    <>
      <style>{MARKDOWN_STYLES}</style>

      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        title="Asystent AI"
        aria-label="Otwórz asystenta AI"
        className="fixed right-5 z-40 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6"
        style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: "var(--accent-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.35)", cursor: "pointer" }}
      >
        <Sparkles size={22} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Asystent AI"
            className="w-full md:max-w-lg md:mx-4"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "16px 16px 0 0", height: "85vh", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            {/* Handle bar (mobile) */}
            <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={15} style={{ color: "var(--accent-blue)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Asystent AI</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={resetConversation} title="Nowa rozmowa" aria-label="Nowa rozmowa" style={iconBtn}><Plus size={16} /></button>
                <button onClick={openHistory} title="Historia rozmów" aria-label="Historia rozmów" style={iconBtn}><History size={16} /></button>
                <button onClick={handleClose} title="Zamknij" aria-label="Zamknij asystenta" style={iconBtn}><X size={16} /></button>
              </div>
            </div>

            {/* Body: historia LUB wątek */}
            {showHistory ? (
              <div className="flex-1 overflow-y-auto px-3 py-3" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={() => { resetConversation(); setShowHistory(false); }} style={{ ...rowBtn, color: "var(--accent-blue)" }}>
                  <Plus size={15} /> Nowa rozmowa
                </button>
                {conversations.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 16 }}>Brak zapisanych rozmów.</p>}
                {conversations.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {renamingId === c.id ? (
                      <input
                        autoFocus
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename(c.id); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => commitRename(c.id)}
                        style={{ flex: 1, fontSize: 13, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--accent-blue)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }}
                      />
                    ) : (
                      <button onClick={() => loadConversation(c.id)} style={{ ...rowBtn, flex: 1, justifyContent: "flex-start" }}>
                        <span style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                      </button>
                    )}
                    <button onClick={() => { setRenamingId(c.id); setRenameText(c.title); }} title="Zmień nazwę" aria-label="Zmień nazwę rozmowy" style={{ ...iconBtn, color: "var(--text-muted)" }}><Pencil size={13} /></button>
                    <button onClick={() => removeConversation(c.id)} title="Usuń" aria-label="Usuń rozmowę" style={{ ...iconBtn, color: "var(--text-muted)" }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div ref={scrollRef} aria-live="polite" className="flex-1 overflow-y-auto px-4 py-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Pusty wątek → sugestie startowe */}
                {turns.length === 0 && !busy && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                      Cześć! Mam dostęp do wszystkich Twoich danych i internetu. Zapytaj o cokolwiek, wydaj polecenie albo poproś o raport.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {STARTER_CHIPS.map((chip) => (
                        <button key={chip} onClick={() => handleSend(chip)} style={chipBtn}>{chip}</button>
                      ))}
                    </div>
                  </div>
                )}

                {turns.map((turn, i) => (
                  <TurnView
                    key={turn.id}
                    turn={turn}
                    isLast={i === turns.length - 1}
                    onBubbleClick={handleBubbleClick}
                    onClarifySubmit={submitClarify}
                    onOpenPlan={(t) => { setPlanTurnId(t.id); setPlanVersion((v) => v + 1); }}
                    onNavigate={goTo}
                    onSaveReport={saveReport}
                    onRegenerate={lastPayloadRef.current ? regenerate : undefined}
                    onFollowup={(txt) => handleSend(txt)}
                  />
                ))}

                {busy && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* Myśli agenta na żywo (streaming) */}
                    {liveThoughts.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {liveThoughts.map((t, i) => {
                          const last = i === liveThoughts.length - 1;
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, opacity: last ? 1 : 0.5 }}>
                              <Sparkles size={11} style={{ color: "var(--accent-blue)", flexShrink: 0, marginTop: 3 }} />
                              <span style={{ fontSize: 12, color: last ? "var(--text-secondary)" : "var(--text-muted)" }}>{t}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
                      <Loader2 size={14} className="animate-spin" /> {liveThoughts.length ? "Pracuję…" : "Myślę…"}
                      <button onClick={stopGeneration} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                        <Square size={11} /> Zatrzymaj
                      </button>
                    </div>
                  </div>
                )}
                {error && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <p style={{ fontSize: 12, color: "var(--accent-red)", margin: 0 }}>{error}</p>
                    {lastPayloadRef.current && (
                      <button onClick={retryLast} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-blue)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                        <RefreshCw size={11} /> Ponów
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Composer */}
            {!showHistory && (
              <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <SmartTextarea value={inputText} onChange={setInputText} placeholder={placeholder} rows={2} onSubmit={() => handleSend()} disabled={busy} />
                  </div>
                  {busy ? (
                    <button
                      onClick={stopGeneration}
                      title="Zatrzymaj"
                      style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 10, border: "none", background: "var(--accent-red)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <Square size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSend()}
                      disabled={!inputText.trim()}
                      title="Wyślij"
                      style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 10, border: "none", background: !inputText.trim() ? "var(--bg-elevated)" : "var(--accent-blue)", color: !inputText.trim() ? "var(--text-muted)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: !inputText.trim() ? "not-allowed" : "pointer" }}
                    >
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ActionDrawer (przegląd planu) */}
      {planTurn && (
        <ActionDrawer
          key={planVersion}
          actions={planTurn.actions}
          onConfirm={(confirmed) => handleExecute(planTurn, confirmed)}
          onRefine={planTurn.messages ? (fb) => handleRefine(planTurn, fb) : undefined}
          isRefining={isRefining}
          onClose={() => setPlanTurnId(null)}
          isExecuting={isExecuting}
        />
      )}
    </>
  );
}

const iconBtn: React.CSSProperties = { padding: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", borderRadius: 6 };
const rowBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: "none", background: "var(--bg-elevated)", cursor: "pointer", textAlign: "left", width: "100%" };
const chipBtn: React.CSSProperties = { fontSize: 12.5, padding: "8px 12px", borderRadius: 18, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left" };

// ── Widok pojedynczej tury ──────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      title="Kopiuj"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: copied ? "var(--accent-green)" : "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Skopiowano" : "Kopiuj"}
    </button>
  );
}

function TurnView({
  turn, isLast, onBubbleClick, onClarifySubmit, onOpenPlan, onNavigate, onSaveReport, onRegenerate, onFollowup,
}: {
  turn: Turn;
  isLast: boolean;
  onBubbleClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClarifySubmit: (turn: Extract<Turn, { kind: "clarify" }>, value: string) => void;
  onOpenPlan: (turn: Extract<Turn, { kind: "plan" }>) => void;
  onNavigate: (url: string) => void;
  onSaveReport: (turn: Extract<Turn, { kind: "report" }>) => void;
  onRegenerate?: () => void;
  onFollowup?: (text: string) => void;
}) {
  const [clarifyInput, setClarifyInput] = useState("");

  if (turn.role === "user") {
    return (
      <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--accent-blue)", color: "#fff", padding: "8px 12px", borderRadius: "12px 12px 2px 12px", fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {turn.content}
      </div>
    );
  }

  // Asystent
  const bubble: React.CSSProperties = { alignSelf: "flex-start", maxWidth: "92%", background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: "12px 12px 12px 2px", fontSize: 14, color: "var(--text-primary)" };

  if (turn.kind === "answer") {
    return (
      <div style={bubble}>
        <div onClick={onBubbleClick} dangerouslySetInnerHTML={{ __html: markdownToHtml(turn.content) }} />
        <ReasoningLog log={turn.log} />
        {isLast && turn.followups && turn.followups.length > 0 && onFollowup && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {turn.followups.map((f) => (
              <button key={f} onClick={() => onFollowup(f)} style={{ fontSize: 12, padding: "6px 11px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--accent-blue)", cursor: "pointer", textAlign: "left" }}>
                {f}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
          <CopyButton text={turn.content} />
          {isLast && onRegenerate && (
            <button onClick={onRegenerate} title="Generuj ponownie" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <RefreshCw size={12} /> Ponów
            </button>
          )}
        </div>
      </div>
    );
  }

  if (turn.kind === "clarify") {
    return (
      <div style={bubble}>
        <p style={{ margin: 0, fontWeight: 500 }}>{turn.content}</p>
        {!turn.resolved && (
          <>
            {turn.options && turn.options.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {turn.options.map((opt) => (
                  <button key={opt} onClick={() => onClarifySubmit(turn, opt)} style={chipBtn}>{opt}</button>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <SmartTextarea value={clarifyInput} onChange={setClarifyInput} placeholder="Twoja odpowiedź…" rows={2} onSubmit={() => onClarifySubmit(turn, clarifyInput)} />
            </div>
          </>
        )}
        <ReasoningLog log={turn.log} />
      </div>
    );
  }

  if (turn.kind === "navigate") {
    return (
      <div style={bubble}>
        <p style={{ margin: 0 }}>{turn.content}</p>
        <button onClick={() => onNavigate(turn.url)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent-blue)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <ArrowRight size={15} /> {turn.label}
        </button>
        <ReasoningLog log={turn.log} />
      </div>
    );
  }

  if (turn.kind === "plan") {
    return (
      <div style={bubble}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ListChecks size={15} style={{ color: "var(--accent-blue)" }} />
          <span style={{ fontWeight: 500 }}>{turn.content}</span>
        </div>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)" }}>
          {turn.actions.slice(0, 5).map((a) => <li key={a.id}>{a.description}</li>)}
          {turn.actions.length > 5 && <li>…i {turn.actions.length - 5} więcej</li>}
        </ul>
        {turn.done ? (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle size={13} /> Wykonano</p>
        ) : (
          <button onClick={() => onOpenPlan(turn)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent-blue)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Przejrzyj i wykonaj
          </button>
        )}
        <ReasoningLog log={turn.log} />
      </div>
    );
  }

  if (turn.kind === "report") {
    return (
      <div style={bubble}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <FileText size={15} style={{ color: "var(--accent-amber)" }} />
          <span style={{ fontWeight: 600 }}>{turn.title}</span>
        </div>
        <div onClick={onBubbleClick} style={{ maxHeight: 280, overflowY: "auto", borderTop: "1px solid var(--border)", paddingTop: 8 }} dangerouslySetInnerHTML={{ __html: markdownToHtml(turn.content) }} />
        <div style={{ marginTop: 6 }}><CopyButton text={turn.content} /></div>
        {turn.savedSlug ? (
          <button onClick={() => onNavigate(`/reports/${turn.savedSlug}`)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent-green)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ArrowRight size={15} /> Otwórz raport
          </button>
        ) : (
          <button onClick={() => onSaveReport(turn)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent-blue)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <FileText size={15} /> Zapisz jako raport
          </button>
        )}
      </div>
    );
  }

  // results
  return (
    <div style={bubble}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 6px" }}>Wykonano</p>
      {turn.results.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
          <span style={{ flexShrink: 0, marginTop: 1, color: r.success ? "var(--accent-green)" : "var(--accent-red)" }}>
            {r.success ? <CheckCircle size={13} /> : <XCircle size={13} />}
          </span>
          <div>
            <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{r.description}</p>
            {r.error && <p style={{ fontSize: 11, color: "var(--accent-red)", margin: 0 }}>{r.error}</p>}
            {r.success && r.navigateTo && (
              <button onClick={() => onNavigate(r.navigateTo!)} style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--accent-blue)", fontSize: 12, cursor: "pointer" }}>
                <ArrowRight size={12} /> {r.navigateLabel ?? "Przejdź"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
