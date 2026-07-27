"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles, Loader2, CheckCircle, XCircle, X, ChevronDown, ChevronUp, ArrowRight, ArrowUp,
  History, Plus, FileText, Trash2, ListChecks, Square, RefreshCw, Copy, Check, Pencil, Wand2, RotateCcw, ImagePlus, Camera, Settings, Volume2, Mic, MicOff, AudioLines, Bug, Gauge, Zap, Rocket, CornerUpLeft, SlidersHorizontal,
} from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { useDictation } from "@/hooks/useDictation";
import { ActionDrawer } from "@/components/home/ActionDrawer";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { withPln, DEFAULT_USD_PLN_RATE } from "@/lib/usdPln";
import { speak, stopSpeaking, speechTextFromMarkdown, ttsSupported, primeSpeech, getAvailableVoices, onVoicesChanged, setPreferredVoiceURI, getPreferredVoiceURI, setServerVoiceId, speechAvailable } from "@/lib/tts";
import { createSpeechListener, speechRecognitionSupported, type SpeechListener } from "@/lib/speechRecognition";
import {
  listAiConversations, getAiConversation, createAiConversation, appendAiMessage,
  deleteAiConversation, renameAiConversation, saveConversationDraft, type ConversationMeta,
} from "@/actions/aiConversations";
import { createUserReport } from "@/actions/reports";
import { getRecentAiCalls, type AiCallLogRow } from "@/actions/llmConfig";
import { aiCallsToText } from "@/lib/ai/aiCallLog";
import { submitFeedbackTask } from "@/actions/feedback";
import { getAssistantPrefs, getSpeechOptions, updateAssistantPrefs } from "@/actions/assistantPrefs";
import { parseServerVoiceValue, toServerVoiceValue, type ServerVoice } from "@/lib/tts/serverVoices";
import { ASSISTANT_LEVEL_DESCRIPTIONS, ASSISTANT_LEVEL_LABELS, ASSISTANT_LEVELS, type AssistantLevel } from "@/types";
import type { AIAction } from "@/lib/ai/aiAction";
import { isDestructiveAction } from "@/lib/ai/aiAction";
import type { ActionResult } from "@/lib/ai/executors/shared";
import { ASSISTANT_OPEN_EVENT, type AssistantOpenDetail } from "@/lib/ai/assistantBus";
import { useOverlayState } from "@/hooks/useOverlayState";
import { AiCostBadge, type AiCostUsage } from "@/components/ui/AiCostBadge";

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
  meta?: AgentMeta;
}

// H3: transparentność — który model odpowiedział i ile tokenów zużyto.
// 034: kształt zużycia = `AiCostUsage` ze WSPÓLNEGO komponentu kosztu (`ui/AiCostBadge`), używanego
// docelowo także poza asystentem. Lekki mirror `UsageMeter` z `@/lib/ai/usage` — nie importujemy
// modułu server-only do komponentu klienckiego.
type AgentMeta = AiCostUsage;

// Jedna „kafelka" w wątku rozmowy. `data` z DB pozwala odtworzyć kartę bez ponownego uruchamiania agenta.
type Turn =
  | { id: string; role: "user"; kind: "text"; content: string }
  | { id: string; role: "assistant"; kind: "answer"; content: string; followups?: string[]; log?: LogEntry[]; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "clarify"; content: string; options?: string[]; messages?: ChatMessage[]; log?: LogEntry[]; resolved?: boolean; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "navigate"; content: string; url: string; label: string; log?: LogEntry[]; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "plan"; content: string; actions: AIAction[]; messages?: ChatMessage[]; log?: LogEntry[]; done?: boolean; dismissed?: boolean; results?: ActionResult[]; undone?: boolean; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "report"; content: string; title: string; savedSlug?: string; log?: LogEntry[]; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "results"; content: string; results: ActionResult[]; undone?: boolean };

// Tryb rozmowy głosowej (magiczna ikona → hands-free). String-union, nie enum (C-12).
type VoiceState = "off" | "listening" | "thinking" | "speaking";

/** 034: sekcje nagłówka asystenta — otwarta może być najwyżej JEDNA naraz. */
type HeaderPanel = "none" | "prefs" | "report" | "history";

// Wąskie, jednoznaczne frazy głosowe do sterowania kartą akcji (gdy jest aktywna, niepotwierdzona).
// Wszystko inne = zwykła rozmowa/korekta (idzie do agenta).
const VOICE_CONFIRM_RE = /^(zatwierdź|zatwierdz|wykonaj|potwierdzam|potwierdź|potwierdz|zrób to|zrob to|tak zrób|tak zrob|dobra rób|dobra rob|wykonaj to|zatwierdzam)\b/i;
const VOICE_CANCEL_RE = /^(odrzuć|odrzuc|anuluj|nie rób|nie rob|zostaw to|odrzuć to|odrzuc to|skasuj to|nie wykonuj)\b/i;

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

// Składa czytelny markdown-owy raport z bieżącej rozmowy asystenta do zadania w projekcie „Omnia":
// opcjonalny opis problemu, ostatni błąd z backendu, pełny zrzut rozmowy, logi połączeń (kroki agenta:
// iter/step/thought/narzędzia/wyniki + model i tokeny) oraz serwerowy log diagnostyki AI (te same
// wywołania modelu, które admin widzi w /admin/ai-calls). Admin zgłasza tym problem z czatem.
function buildChatProblemReport(opts: {
  turns: Turn[];
  error: string | null;
  description: string;
  route: string;
  conversationId: string | null;
  aiCalls?: AiCallLogRow[];
  aiCallsError?: boolean;
  usdPlnRate?: number;
}): string {
  const { turns, error, description, route, conversationId, aiCalls, aiCallsError, usdPlnRate = DEFAULT_USD_PLN_RATE } = opts;
  const roleLabel = (r: "user" | "assistant") => (r === "user" ? "Użytkownik" : "Asystent");
  const trunc = (s: string, max = 4000) => (s.length > max ? s.slice(0, max) + "\n…(ucięto)" : s);
  const json = (v: unknown) => {
    try { return trunc(JSON.stringify(v, null, 2)); } catch { return String(v); }
  };
  const out: string[] = [];

  out.push("## Opis problemu");
  out.push(description.trim() ? description.trim() : "_(brak opisu)_");

  if (error) {
    out.push("\n## Ostatni błąd (backend)");
    out.push("```\n" + trunc(error) + "\n```");
  }

  out.push("\n## Zrzut rozmowy");
  if (turns.length === 0) {
    out.push("_(rozmowa pusta)_");
  } else {
    turns.forEach((t, i) => {
      out.push(`\n### ${i + 1}. ${roleLabel(t.role)} (${t.kind})`);
      out.push(trunc(t.content || "_(brak treści)_"));
    });
  }

  out.push("\n## Logi połączeń z backendem");
  const hasAnyLog = turns.some((t) => t.role === "assistant" && (("log" in t && (t.log?.length ?? 0) > 0) || ("meta" in t && !!t.meta)));
  if (!hasAnyLog) {
    out.push("_(brak logów agenta dla tej rozmowy)_");
  } else {
    turns.forEach((t, i) => {
      if (t.role !== "assistant") return;
      const log = "log" in t ? t.log : undefined;
      const meta = "meta" in t ? t.meta : undefined;
      if (!(log?.length) && !meta) return;
      const costStr = meta?.costUsd && meta.costUsd > 0 ? `, koszt: ${withPln(`~$${meta.costUsd.toFixed(4)}`, meta.costUsd, usdPlnRate)}` : "";
      const metaStr = meta ? ` — model: ${meta.model ?? "?"}, tokeny: ${meta.tokens ?? "?"}${costStr}` : "";
      out.push(`\n#### Tura ${i + 1}${metaStr}`);
      (log ?? []).forEach((l) => {
        out.push(`- **[iter ${l.iter} · ${l.step}]** ${l.thought ?? ""}`.trim());
        if (l.tools?.length) out.push("  - narzędzia:\n```json\n" + json(l.tools) + "\n```");
        if (l.results !== undefined) out.push("  - wyniki:\n```json\n" + json(l.results) + "\n```");
      });
    });
  }

  // Serwerowy log diagnostyki AI — to samo, co panel /admin/ai-calls po odfiltrowaniu tej rozmowy
  // (wywołania modelu, w tym NIEUDANE: status dostawcy, treść błędu, liczba prób, tokeny, latencja).
  out.push("\n## Diagnostyka AI (log wywołań modelu)");
  if (aiCallsError) {
    out.push("_(nie udało się pobrać logu diagnostyki)_");
  } else if (!conversationId) {
    out.push("_(rozmowa niezapisana — brak identyfikatora; log diagnostyki niedostępny)_");
  } else if (!aiCalls?.length) {
    out.push("_(brak zarejestrowanych wywołań modelu dla tej rozmowy)_");
  } else {
    out.push("```\n" + trunc(aiCallsToText(aiCalls), 8000) + "\n```");
  }

  out.push("\n---");
  out.push(`- **route:** \`${route}\``);
  out.push(`- **conversationId:** \`${conversationId ?? "(brak)"}\``);
  out.push(`- **czas zgłoszenia:** ${new Date().toISOString()}`);

  return out.join("\n");
}

const STARTER_CHIPS = [
  "Co mam dziś najważniejszego do zrobienia?",
  "Podsumuj mój tydzień",
  "Znajdź 5 obowiązków pasujących do mojego nastroju i posortuj priorytetami",
  "Zrób raport z tej rozmowy",
];

// 031: log rozumowania w DWÓCH warstwach.
//  • „Pokaż log rozumowania" (dla wszystkich) — kroki opisane po ludzku, ZWINIĘTE. Wcześniej cała
//    lista myśli wisiała pod każdą odpowiedzią i zaśmiecała czat („Pobieram zadania…", „Mam listę…").
//  • „Pokaż techniczny log rozumowania (admin)" — dawny surowy zrzut z nazwami narzędzi i JSON-ami;
//    widoczny WYŁĄCZNIE dla administratora (zwykły użytkownik nie ma po co widzieć wnętrza).
// Stare rozmowy bez logu renderują się bez żadnego przełącznika (wsteczna zgodność).
function ReasoningLog({ log, isAdmin = false }: { log?: LogEntry[]; isAdmin?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [techExpanded, setTechExpanded] = useState(false);
  if (!log?.length) return null;
  const thoughts = log.filter((l) => l.thought);
  const toggleStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)",
    background: "none", border: "none", cursor: "pointer", padding: 0,
  };
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      {thoughts.length > 0 && (
        <>
          <button onClick={() => setExpanded((v) => !v)} style={toggleStyle} aria-expanded={expanded}>
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? "Ukryj log rozumowania" : "Pokaż log rozumowania"}
          </button>
          {expanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {thoughts.map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <Sparkles size={11} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.thought}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {isAdmin && (
        <>
          <button onClick={() => setTechExpanded((v) => !v)} style={toggleStyle} aria-expanded={techExpanded}>
            {techExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {techExpanded ? "Ukryj techniczny log rozumowania (admin)" : "Pokaż techniczny log rozumowania (admin)"}
          </button>
          {techExpanded && (
            <pre style={{ padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 10.5, lineHeight: 1.5, color: "var(--text-secondary)", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 240, overflowY: "auto" }}>
              {log.map((l) => {
                const head = `#${l.iter} [${l.step}] ${l.thought}`;
                if (l.step === "query") return `${head}\n  narzędzia: ${JSON.stringify(l.tools)}\n  wyniki: ${JSON.stringify(l.results)}`;
                if (l.step === "clarify") return `${head}\n  pytanie: ${l.question}`;
                if (l.step === "plan") return `${head}\n  akcje: ${l.actionsCount}`;
                return head;
              }).join("\n\n")}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

let TURN_SEQ = 0;
function newId(): string {
  TURN_SEQ += 1;
  return `t${Date.now()}_${TURN_SEQ}`;
}

export function AICommandSheet({ isAdmin = false, usdPlnRate = DEFAULT_USD_PLN_RATE }: { isAdmin?: boolean; usdPlnRate?: number } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { context, placeholder, routeHint, activeListId, activeProjectId } = deriveContextFromPath(pathname);

  const [isOpen, setIsOpen] = useState(false);
  // Magiczną ikonę chowamy, gdy otwarty jest modal treściowy — nie nakładamy
  // dialogu na dialog i nie odciągamy uwagi od skupionego zadania w modalu.
  const { modalOpen, panelOpen } = useOverlayState();
  const [inputText, setInputText] = useState("");
  // Composer: pole tekstowe (auto-rozrost) + dyktowanie mowy (mikrofon w pigułce, jak w ChatGPT).
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation((t) => setInputText((prev) => (prev.trim() ? prev.trimEnd() + " " : "") + t));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [liveThoughts, setLiveThoughts] = useState<string[]>([]); // myśli agenta na żywo (streaming)
  const [error, setError] = useState<string | null>(null);
  // Czy pole kompozytora ma fokus (klawiatura ekranowa otwarta). Gdy piszesz, NIE
  // dokładamy dolnego marginesu safe-area — dodatkowy padding pod fokusowanym polem
  // w bottom-sheecie iOS rozjeżdża karetkę (kursor „nad polem"). Margines na kreskę
  // iPhone potrzebny jest tylko przy ZAMKNIĘTEJ klawiaturze (pole u samego dołu).
  const [composerFocused, setComposerFocused] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  // Odczyt postów Asystenta na głos — id posta aktualnie czytanego (jeden głos naraz).
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Tryb rozmowy głosowej (hands-free): słucham → myślę → mówię → (podgląd planu) → słucham.
  const [voiceState, setVoiceState] = useState<VoiceState>("off");
  const [interimText, setInterimText] = useState(""); // częściowy transkrypt na żywo
  const [voiceSupported] = useState(() => ttsSupported() && speechRecognitionSupported());
  const voiceStateRef = useRef<VoiceState>("off");
  voiceStateRef.current = voiceState;
  const listenerRef = useRef<SpeechListener | null>(null);
  const spokenIdRef = useRef<string | null>(null); // id ostatnio wypowiedzianej tury (anty-dubel)
  const prevConvoIdRef = useRef<string | null>(null); // do rozróżnienia „utworzenie" vs „przełączenie" rozmowy
  const pendingClarifyRef = useRef<Extract<Turn, { kind: "clarify" }> | null>(null);
  const pendingPlanIdRef = useRef<string | null>(null); // id aktywnej, niepotwierdzonej karty planu (tryb głosowy)
  // Refy na najświeższe wersje funkcji pętli — omija stale-closure w callbackach listenera/lektora.
  const startListeningRef = useRef<() => void>(() => {});
  const handleSendRef = useRef<(t?: string) => void | Promise<void>>(() => {});
  const submitClarifyRef = useRef<(turn: Extract<Turn, { kind: "clarify" }>, value: string) => void>(() => {});
  const quickConfirmPlanRef = useRef<(turn: Extract<Turn, { kind: "plan" }>) => void>(() => {});
  const turnsRef = useRef<Turn[]>([]);

  // Przegląd planu (ActionDrawer)
  const [planTurnId, setPlanTurnId] = useState<string | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  const [isRefining, setIsRefining] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // 032: ostatnia zakończona rozmowa — do jednodotknięciowego powrotu w nagłówku. Etykietę
  // wyprowadzamy z pierwszej wypowiedzi użytkownika (tak samo jak serwer tworzy tytuł rozmowy),
  // więc nie potrzebujemy dodatkowego zapytania do bazy tylko po tytuł.
  const [lastConversationId, setLastConversationId] = useState<string | null>(null);
  const [lastConversationLabel, setLastConversationLabel] = useState<string>("");

  /**
   * 034: sekcje nagłówka (ustawienia / zgłoszenie problemu / historia) trzymamy w JEDNYM stanie,
   * a nie w trzech niezależnych flagach. Dzięki temu z definicji nie da się otworzyć dwóch naraz,
   * a każda ikona działa tak samo: klik otwiera, ponowny klik zamyka i wraca do rozmowy.
   */
  const [headerPanel, setHeaderPanel] = useState<HeaderPanel>("none");
  const showPrefs = headerPanel === "prefs";
  const showReport = headerPanel === "report";
  const showHistory = headerPanel === "history";
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
  // Załącznik-zdjęcie (multimodal): rozpoznanie przedmiotów → plan akcji.
  // Dwa ukryte inputy: galeria (bez capture) i aparat (`capture="environment"`).
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  // Stałe preferencje użytkownika („custom instructions") — pamięć per-urządzenie
  // (localStorage), wstrzykiwana do każdego polecenia. Ref, by uniknąć stale-closure.
  const [prefs, setPrefs] = useState("");
  const prefsRef = useRef("");
  prefsRef.current = prefs;
  // 031: poziom pracy asystenta — zapisywany w BAZIE per użytkownik (widoczny na każdym
  // urządzeniu), nie w pamięci przeglądarki. Serwer i tak czyta go z bazy; ten stan służy UI.
  const [level, setLevel] = useState<AssistantLevel>("standard");
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  // Zgłaszanie problemu z czatem (admin-only): panel z opcjonalnym opisem → zadanie w projekcie „Omnia".
  const [reportDesc, setReportDesc] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState<{ projectId: string; canRead: boolean } | null>(null);
  // Wybór głosu lektora (per-urządzenie). Głosy iOS/Safari ładują się asynchronicznie — subskrybujemy.
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string>("");
  // 031: głosy SERWEROWE (niezależne od przeglądarki) — dostępne tylko, gdy administrator
  // przypisał dostawcę dla syntezy mowy. Wybór głosu serwerowego zapisujemy na koncie.
  const [serverVoices, setServerVoices] = useState<ServerVoice[]>([]);
  // Tryb zgłoszenia (admin): kontekst wskazanego miejsca; gdy ustawiony, kolejna
  // wiadomość admina staje się opisem zadania w projekcie „Omnia". Ref — bo
  // listener zdarzenia i handleSend muszą widzieć aktualną wartość bez re-bind.
  const feedbackRef = useRef<string | null>(null);
  // 029: gdy ustawiony (tryb głównego robaczka), tytuły akcji create_task w powstałym planie
  // dostają deterministycznie prefiks 🐛 przy wykonaniu (nawet gdy model pominie emoji).
  const feedbackPrefixRef = useRef<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, busy]);

  // Odczyt na głos: klik na czytanym poście → stop; klik na innym → przerwij poprzedni i czytaj nowy.
  const toggleSpeak = useCallback((id: string, text: string) => {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    stopSpeaking();
    const clean = speechTextFromMarkdown(text);
    if (!clean) return;
    speak(clean, "pl", { onEnd: () => setSpeakingId((cur) => (cur === id ? null : cur)) });
    setSpeakingId(id);
  }, [speakingId]);

  // ── Tryb rozmowy głosowej (hands-free) ─────────────────────────────────────
  // Treść tury do wypowiedzenia (jak SpeakButton). Plan/results/tury użytkownika → nie czytamy.
  function voiceSpeakText(turn: Turn): string {
    if (turn.role !== "assistant") return "";
    if (turn.kind === "report") return speechTextFromMarkdown(`${turn.title}. ${turn.content}`);
    if (turn.kind === "answer" || turn.kind === "clarify" || turn.kind === "navigate") return speechTextFromMarkdown(turn.content);
    return "";
  }

  // Twarde wyłączenie trybu: zwolnij mikrofon i zatrzymaj lektora.
  function stopVoice() {
    listenerRef.current?.abort();
    listenerRef.current = null;
    stopSpeaking();
    pendingClarifyRef.current = null;
    setInterimText("");
    voiceStateRef.current = "off";
    setVoiceState("off");
  }

  // Rozpocznij nasłuch pojedynczej wypowiedzi. Startuje TYLKO gdy tryb jest włączony (anty-echo:
  // nigdy nie słuchamy w trakcie mowy — lektor jest już zatrzymany zanim tu wejdziemy).
  function startListening() {
    if (voiceStateRef.current === "off") return;
    stopSpeaking();
    listenerRef.current?.abort();
    listenerRef.current = null;
    setInterimText("");
    voiceStateRef.current = "listening";
    setVoiceState("listening");
    const listener = createSpeechListener({
      lang: "pl-PL",
      onInterim: (t) => setInterimText(t),
      onFinal: (text) => {
        setInterimText("");
        listenerRef.current = null;
        if (voiceStateRef.current === "off") return;
        const trimmed = text.trim();
        if (!trimmed) { startListeningRef.current(); return; } // nic nie powiedziano → słuchaj dalej

        // Aktywna, niepotwierdzona karta planu → komendy głosowe zatwierdź/odrzuć; inaczej rozmowa/korekta.
        const pendingId = pendingPlanIdRef.current;
        if (pendingId) {
          const planTurn = turnsRef.current.find(
            (t) => t.id === pendingId && t.kind === "plan" && !t.done && !t.dismissed,
          ) as Extract<Turn, { kind: "plan" }> | undefined;
          if (planTurn) {
            if (VOICE_CONFIRM_RE.test(trimmed)) {
              pendingPlanIdRef.current = null;
              quickConfirmPlanRef.current(planTurn);
              return;
            }
            if (VOICE_CANCEL_RE.test(trimmed)) {
              pendingPlanIdRef.current = null;
              dismissPlanTurn(planTurn.id);
              startListeningRef.current();
              return;
            }
            // inaczej → rozmowa/korekta: idzie do agenta (kontekst zawiera treść akcji, patrz buildHistory)
          } else {
            pendingPlanIdRef.current = null; // karta zniknęła / już rozstrzygnięta
          }
        }

        voiceStateRef.current = "thinking";
        setVoiceState("thinking");
        const clarify = pendingClarifyRef.current;
        if (clarify) { pendingClarifyRef.current = null; submitClarifyRef.current(clarify, trimmed); }
        else { void handleSendRef.current(trimmed); }
      },
      onError: (err) => {
        listenerRef.current = null;
        setError(`Mikrofon: ${err}`);
        stopVoice();
      },
    });
    listenerRef.current = listener;
    listener.start();
  }

  // Restart nasłuchu z drobnym opóźnieniem — iOS/Safari bywa wrażliwy na natychmiastowy ponowny
  // `recognition.start()` po zakończeniu poprzedniej tury (zacięcie / „already started"). Na Chrome
  // opóźnienie jest niewyczuwalne. UŻYWAMY tego dla programowych restartów (po mowie/pustej turze);
  // pierwszy start i barge-in idą synchronicznie w geście użytkownika (wymóg iOS na mikrofon).
  function scheduleListen() {
    if (voiceStateRef.current === "off") return;
    window.setTimeout(() => { if (voiceStateRef.current !== "off") startListening(); }, 250);
  }
  // Programowe restarty (onEnd mowy, pusta wypowiedź, powrót po akcji/błędzie) → z opóźnieniem.
  startListeningRef.current = scheduleListen;
  handleSendRef.current = handleSend;
  submitClarifyRef.current = submitClarify;
  quickConfirmPlanRef.current = quickConfirmPlan;
  turnsRef.current = turns;

  // Przełącznik trybu. Włączając, zapamiętaj ostatnią turę jako „już wypowiedzianą",
  // by pętla nie odczytała jej ponownie na starcie.
  function toggleVoice() {
    if (voiceStateRef.current !== "off") { stopVoice(); return; }
    if (!voiceSupported) return;
    // KRYTYCZNE dla iOS/Safari: „odblokuj" syntezę mowy TERAZ, w geście dotknięcia — inaczej WebKit
    // wycisza późniejsze (programowe) wypowiedzi Asystenta. Pierwszy nasłuch też startuje w geście.
    primeSpeech();
    spokenIdRef.current = turns.length ? turns[turns.length - 1].id : null;
    voiceStateRef.current = "listening";
    startListening();
  }

  // Zamknięcie podglądu planu (drawer) w trybie głosowym → wróć do nasłuchu.
  function handlePlanClose() {
    setPlanTurnId(null);
    if (voiceStateRef.current !== "off") startListeningRef.current();
  }

  // Wypowiedz krótki komunikat, po czym (jeśli tryb wciąż on) wróć do nasłuchu.
  function voiceAnnounce(text: string) {
    if (voiceStateRef.current === "off") return;
    voiceStateRef.current = "speaking";
    setVoiceState("speaking");
    speak(speechTextFromMarkdown(text), "pl", {
      // Wróć do nasłuchu TYLKO gdy nadal „mówię" — jeśli użytkownik przerwał (barge-in „Przerwij"),
      // nasłuch już wystartował synchronicznie i nie chcemy go ubić opóźnionym restartem.
      onEnd: () => { if (voiceStateRef.current === "speaking") startListeningRef.current(); },
    });
  }

  // Szybkie „Zatwierdź": wykonaj akcje NIE-niszczące karty (destructive opt-in zostaje — wymaga
  // świadomego zaznaczenia w ActionDrawer). Wspólne dla dotyku i komendy głosowej.
  function quickConfirmPlan(turn: Extract<Turn, { kind: "plan" }>) {
    if (turn.done || turn.dismissed) return;
    pendingPlanIdRef.current = null;
    const safe = turn.actions.filter((a) => !isDestructiveAction(a));
    if (!safe.length) {
      // Sama akcja niszcząca — nie wykonujemy „samo"; poproś o świadome potwierdzenie na karcie.
      if (voiceStateRef.current !== "off") voiceAnnounce("Te akcje są nieodwracalne — potwierdź je na karcie.");
      return;
    }
    if (voiceStateRef.current !== "off") { voiceStateRef.current = "thinking"; setVoiceState("thinking"); }
    void handleExecute(turn, safe);
  }

  // Odrzucenie karty planu (bez wykonywania).
  function dismissPlanTurn(id: string) {
    feedbackPrefixRef.current = null; // 029: porzucony plan zgłoszenia nie może „przenieść" prefiksu 🐛 dalej
    setTurns((t) => t.map((x) => (x.id === id && x.kind === "plan" ? { ...x, dismissed: true } : x)));
  }

  // Sterownik pętli: po odpowiedzi agenta wypowiedz ją i wróć do nasłuchu. Plan NIE pauzuje pętli —
  // karta zostaje w wątku, Asystent zapowiada ją głosem i słucha dalej (potwierdzenie/korekta głosem).
  useEffect(() => {
    if (voiceState === "off" || busy) return;
    const last = turns[turns.length - 1];
    // Brak (jeszcze) odpowiedzi asystenta — nie ruszaj pętli (np. luka async przy tworzeniu rozmowy).
    if (!last || last.role !== "assistant") return;
    if (spokenIdRef.current === last.id) return;
    if (last.kind === "results") { spokenIdRef.current = last.id; return; } // powrót po execute obsłużony osobno
    if (last.kind === "plan") {
      spokenIdRef.current = last.id;
      // Korekta głosem tworzy nową kartę — poprzednią, niepotwierdzoną, uznaj za zastąpioną,
      // by w wątku nie zostały dwie „żywe" karty do potwierdzenia.
      const prevId = pendingPlanIdRef.current;
      if (prevId && prevId !== last.id) dismissPlanTurn(prevId);
      pendingPlanIdRef.current = last.id;
      const n = last.actions.length;
      // Krótko — bez recytowania obsługi karty (przyciski/instrukcje są widoczne w czacie).
      voiceAnnounce(`Przygotowałem ${n} ${n === 1 ? "akcję" : "akcji"}.`);
      return;
    }
    spokenIdRef.current = last.id;
    const text = voiceSpeakText(last);
    if (!text) { startListeningRef.current(); return; }
    voiceStateRef.current = "speaking";
    setVoiceState("speaking");
    const clarifyTurn = last.kind === "clarify" ? last : null;
    speak(text, "pl", {
      onEnd: () => {
        if (voiceStateRef.current === "off") return;
        if (clarifyTurn) pendingClarifyRef.current = clarifyTurn; // kontekst clarify zachowaj także po barge-in
        // Wróć do nasłuchu TYLKO gdy nadal „mówię" — po barge-in nasłuch już wystartował synchronicznie.
        if (voiceStateRef.current === "speaking") startListeningRef.current();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, busy, voiceState]);

  // Tryb głosowy: gdy agent zwróci błąd w trakcie „myślę", wróć do nasłuchu (rozmowa się nie wiesza).
  useEffect(() => {
    if (error && voiceStateRef.current === "thinking") startListeningRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Sprzątanie: zatrzymaj lektora + tryb głosowy przy zamknięciu arkusza, zmianie konwersacji i odmontowaniu.
  useEffect(() => {
    if (!isOpen) { stopSpeaking(); setSpeakingId(null); stopVoice(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  useEffect(() => {
    const prev = prevConvoIdRef.current;
    prevConvoIdRef.current = conversationId;
    stopSpeaking(); setSpeakingId(null);
    // Zatrzymaj tryb głosowy przy PRZEŁĄCZENIU/zresetowaniu rozmowy (prev było niepuste), ale NIE
    // przy pierwszym utworzeniu rozmowy w trakcie trwającej rozmowy głosowej (null → id) — wtedy
    // pętla ma płynnie trwać (pierwsza wypowiedź tworzy AiConversation i zmienia conversationId).
    if (prev !== null) stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
  useEffect(() => () => { stopSpeaking(); listenerRef.current?.abort(); }, []);

  // Esc zamyka sheet (gdy nie piszemy w polu — pozwalamy textarea obsłużyć własny Esc).
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        if (tag === "textarea" || tag === "input") return;
        // 034: Esc domyka najpierw rozwiniętą sekcję nagłówka (powrót do rozmowy), a dopiero
        // gdy żadnej nie ma — cały arkusz. Bez tego jedyne wyjście z historii było przez X.
        if (showLevelMenu) { setShowLevelMenu(false); return; }
        if (headerPanel !== "none") { setHeaderPanel("none"); return; }
        handleClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, headerPanel, showLevelMenu]);

  // Zatrzymaj generowanie przy zamknięciu/unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  // 031: ustawienia asystenta wczytujemy z BAZY (per użytkownik). Jeśli baza jest pusta, a w
  // przeglądarce siedzą stare preferencje per-urządzenie — przenosimy je JEDNORAZOWO na konto i
  // czyścimy klucz lokalny, żeby nikt nie stracił tego, co już wpisał.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getAssistantPrefs();
        if (cancelled) return;
        setLevel(p.level);
        if (p.voiceKind === "server" && p.voiceId) {
          setServerVoiceId(p.voiceId);
          setVoiceURIState(toServerVoiceValue(p.voiceId));
        }
        void getSpeechOptions()
          .then((o) => { if (!cancelled) setServerVoices(o.voices); })
          .catch(() => {});
        let legacy = "";
        try { legacy = localStorage.getItem("omnia.aiPrefs") ?? ""; } catch { /* ignore */ }
        if (!p.instructions && legacy.trim()) {
          setPrefs(legacy);
          try { await updateAssistantPrefs({ instructions: legacy }); } catch { /* ignore */ }
          try { localStorage.removeItem("omnia.aiPrefs"); } catch { /* ignore */ }
        } else {
          setPrefs(p.instructions);
          if (legacy) { try { localStorage.removeItem("omnia.aiPrefs"); } catch { /* ignore */ } }
        }
      } catch { /* brak sesji / offline — zostajemy z domyślnymi */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Wczytaj listę głosów lektora + zapamiętany wybór; subskrybuj „voiceschanged" (async na iOS/Safari).
  useEffect(() => {
    if (!ttsSupported()) return;
    const refresh = () => setVoices(getAvailableVoices());
    refresh();
    setVoiceURIState(getPreferredVoiceURI() ?? "");
    return onVoicesChanged(refresh);
  }, []);

  // Auto-rozrost pola composera — rośnie z treścią do maksimum, potem przewija (jak w ChatGPT).
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [inputText]);

  // Globalny skrót Ctrl/Cmd+J — otwórz asystenta (działa też gdy jest zamknięty).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Otwarcie asystenta z zewnątrz (magistrala zdarzeń). W trybie zgłoszenia
  // zaczynamy świeżą rozmowę z kartą informującą, co trafiło do kontekstu.
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<AssistantOpenDetail>).detail ?? {};
      setIsOpen(true);
      setHeaderPanel("none");
      if (detail.feedbackContext) {
        setConversationId(null);
        convoIdRef.current = null;
        setPlanTurnId(null);
        setError(null);
        setInputText("");
        feedbackRef.current = detail.feedbackContext;
        const info =
          "📍 **Tryb zgłoszenia błędu / sugestii**\n\n" +
          "Do kontekstu rozmowy trafiło wskazane miejsce:\n\n" +
          detail.feedbackContext +
          "\n\nOpisz teraz **błąd lub sugestię** — utworzę na tej podstawie zadanie w projekcie **Omnia** (tytuł wygeneruję automatycznie z opisu).";
        setTurns([{ id: newId(), role: "assistant", kind: "answer", content: info }]);
      }
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen);
  }, []);

  // ── 032: brudnopis pola wiadomości ────────────────────────────────────────
  // Zapis jest RZADKI i zbiorczy (debounce + jawne zapisy przy zmianie/zamknięciu wątku), a nie na
  // każdy wpisany znak — inaczej każde uderzenie w klawiaturę leciałoby do serwera.
  const draftSaveTimer = useRef<number | null>(null);
  const lastSavedDraftRef = useRef<string>("");
  const inputTextRef = useRef("");
  inputTextRef.current = inputText;

  /**
   * Zapisuje brudnopis natychmiast. `explicit` podajemy tam, gdzie nie możemy czekać na re-render
   * (np. wyczyszczenie po wysłaniu wiadomości — `inputTextRef` jeszcze trzyma starą treść).
   */
  function saveDraftNow(explicit?: string) {
    if (draftSaveTimer.current) {
      window.clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }
    const cid = convoIdRef.current;
    // Brudnopis należy do ROZMOWY. Gdy rozmowa jeszcze nie istnieje (pierwsza wiadomość nigdy nie
    // wysłana), nie ma do czego go przypiąć — świadome ograniczenie: nie tworzymy pustych rozmów.
    if (!cid) return;
    const value = explicit ?? inputTextRef.current;
    if (value === lastSavedDraftRef.current) return;
    lastSavedDraftRef.current = value;
    void saveConversationDraft(cid, value).catch(() => {});
  }

  useEffect(() => {
    if (!convoIdRef.current) return;
    if (inputText === lastSavedDraftRef.current) return;
    if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = window.setTimeout(() => saveDraftNow(), 2000);
    return () => {
      if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText]);

  // Zapis stałych preferencji na konto użytkownika (debounce — pole zapisuje się „samo").
  const prefsSaveTimer = useRef<number | null>(null);
  function savePrefs(value: string) {
    setPrefs(value);
    if (prefsSaveTimer.current) window.clearTimeout(prefsSaveTimer.current);
    prefsSaveTimer.current = window.setTimeout(() => {
      void updateAssistantPrefs({ instructions: value }).catch(() => {});
    }, 600);
  }

  /**
   * 031: wybór głosu lektora. Głos SERWEROWY zapisujemy na koncie (brzmi tak samo na każdym
   * urządzeniu), a głos SYSTEMOWY zostaje lokalnie — jest właściwością konkretnego urządzenia
   * i na innym telefonie po prostu nie istnieje.
   */
  function changeVoice(value: string) {
    setVoiceURIState(value);
    const serverId = parseServerVoiceValue(value);
    if (serverId) {
      setServerVoiceId(serverId);
      setPreferredVoiceURI(null);
      void updateAssistantPrefs({ voiceKind: "server", voiceId: serverId }).catch(() => {});
      return;
    }
    setServerVoiceId(null);
    setPreferredVoiceURI(value || null);
    void updateAssistantPrefs({ voiceKind: "browser", voiceId: null }).catch(() => {});
  }

  // Zmiana poziomu pracy asystenta — zapis natychmiastowy (to jedno kliknięcie, nie pisanie).
  function changeLevel(next: AssistantLevel) {
    setLevel(next);
    setShowLevelMenu(false);
    void updateAssistantPrefs({ level: next }).catch(() => {});
  }

  // Autofokus pola wejścia po otwarciu (desktop) — natychmiast piszesz.
  // 034: gdy wraca zapamiętany brudnopis, kursor musi stanąć na KOŃCU tekstu. Samo `focus()` na
  // świeżo zamontowanym polu ustawia zaznaczenie na pozycji 0, więc dopisywanie zaczynało się
  // przed tym, co użytkownik już napisał. Zależność od `conversationId` domyka przypadek wczytania
  // rozmowy z historii (brudnopis dojeżdża asynchronicznie, już po pierwszym fokusie).
  useEffect(() => {
    if (!isOpen || showHistory) return;
    const t = setTimeout(() => {
      const ta = composerRef.current;
      if (!ta) return;
      ta.focus();
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    }, 80);
    return () => clearTimeout(t);
  }, [isOpen, showHistory, conversationId]);

  // Zapis wiadomości do DB (best-effort, nie blokuje UI).
  const persist = useCallback(async (role: "user" | "assistant", content: string, kind: string, data?: unknown) => {
    const cid = convoIdRef.current;
    if (!cid) return;
    try {
      await appendAiMessage(cid, { role, content, kind, data });
    } catch { /* ignore */ }
  }, []);

  /**
   * 032: rozwinięte sekcje (ustawienia, zgłoszenie problemu, menu poziomu) należą do KONKRETNEJ
   * rozmowy — przy zmianie wątku albo zamknięciu asystenta muszą się zwinąć, żeby nowa rozmowa
   * startowała z czystym ekranem.
   */
  function collapseSections() {
    setHeaderPanel("none");
    setReportDone(null);
    setShowLevelMenu(false);
  }

  /** 034: klik w ikonę nagłówka otwiera sekcję, ponowny klik ją zamyka; inne sekcje się chowają. */
  function togglePanel(panel: Exclude<HeaderPanel, "none">) {
    setReportDone(null);
    setShowLevelMenu(false);
    setHeaderPanel((current) => (current === panel ? "none" : panel));
    if (panel === "history") {
      void listAiConversations().then(setConversations).catch(() => { /* ignore */ });
    }
  }

  function resetConversation() {
    saveDraftNow();
    collapseSections();
    // 032: świadome „Nowa rozmowa" też czyni poprzednią historyczną — udostępniamy do niej powrót
    // jednym dotknięciem (ta sama ścieżka co po zamknięciu asystenta).
    if (convoIdRef.current && turnsRef.current.length > 0) {
      setLastConversationId(convoIdRef.current);
      setLastConversationLabel(conversationLabelFrom(turnsRef.current));
    }
    setTurns([]);
    setConversationId(null);
    convoIdRef.current = null;
    setPlanTurnId(null);
    setError(null);
    setInputText("");
  }

  /**
   * 032: zamknięcie asystenta KOŃCZY rozmowę — po ponownym otwarciu użytkownik dostaje nowy wątek, a
   * poprzedni jest jedno dotknięcie dalej („Wróć do…" w nagłówku) i w historii. Wyjątek: rozmowa bez
   * ani jednej tury zostaje, żeby nie zaśmiecać historii pustymi wpisami (i tak nie istnieje jeszcze
   * w bazie — `AiConversation` powstaje przy pierwszej wiadomości).
   */
  function handleClose() {
    saveDraftNow();
    collapseSections();
    setIsOpen(false);
    if (turnsRef.current.length > 0) {
      // 032: PRZERWIJ trwające generowanie, zanim wyczyścimy wątek. Komponent siedzi w `AppShell` i
      // nigdy się nie odmontowuje, więc bez tego żądanie leci dalej i dopisuje odpowiedź do już
      // wyczyszczonego wątku — przy `convoIdRef === null`, czyli bez zapisu w historii. Efekt:
      // osierocona wypowiedź asystenta w rzekomo nowej rozmowie. Nie wracamy tu do nasłuchu
      // głosowego (inaczej niż w `stopGeneration`) — asystent się zamyka, a `stopVoice` i tak
      // odpala efekt na `isOpen`.
      abortRef.current?.abort();
      abortRef.current = null;
      setBusy(false);
      if (convoIdRef.current) {
        setLastConversationId(convoIdRef.current);
        setLastConversationLabel(conversationLabelFrom(turnsRef.current));
      }
      setTurns([]);
      setConversationId(null);
      convoIdRef.current = null;
      setPlanTurnId(null);
      setError(null);
      setInputText("");
    }
  }

  // Zgłoszenie problemu z czatem (admin): składa raport (opis + zrzut rozmowy + logi + błąd) i tworzy
  // z niego zadanie w projekcie „Omnia" — jak główne zgłaszanie błędów, ale bezpośrednio (nie przez agenta).
  const canReport = turns.length > 0 || !!error || reportDesc.trim().length > 0;
  async function submitProblemReport() {
    if (!canReport || reportBusy) return;
    setReportBusy(true);
    try {
      // Dołącz serwerowy log diagnostyki AI dla tej rozmowy (admin-gated). Brak/awaria pobrania nie
      // wywraca zgłoszenia — do raportu trafi wtedy tylko adnotacja.
      let aiCalls: AiCallLogRow[] = [];
      let aiCallsError = false;
      try {
        if (conversationId) aiCalls = await getRecentAiCalls({ conversationId, limit: 200 });
      } catch {
        aiCallsError = true;
      }
      const description = buildChatProblemReport({ turns, error, description: reportDesc, route: pathname, conversationId, aiCalls, aiCallsError, usdPlnRate });
      // 029: rozpoznawalny prefiks (🐛✨ = zgłoszenie z robaczka Asystenta AI) + krótki tytuł z opisu,
      // bez prefiksu z datą (data jest w treści raportu).
      const firstLine = reportDesc.trim().split("\n")[0]?.slice(0, 80);
      const title = `🐛✨ ${firstLine || "Problem z Asystentem AI"}`;
      // 031: zgłoszenie idzie do SKRZYNKI ADMINISTRATORA (jeden wąski wyjątek dostępowy w
      // `submitFeedbackTask`) — wcześniej `ensureOmniaProject()` tworzyło projekt „Omnia" u
      // zgłaszającego, więc zgłoszenia zwykłych użytkowników nigdy nie docierały do admina.
      const res = await submitFeedbackTask({ title, description });
      setReportDone({ projectId: res.projectId, canRead: res.canRead });
      setReportDesc("");
    } catch {
      setError("Nie udało się utworzyć zgłoszenia.");
    } finally {
      setReportBusy(false);
    }
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
      else if (t.kind === "plan") {
        // Niesiemy treść proponowanych akcji, aby korekta głosem/tekstem („nie, do listy Apteka")
        // była dla agenta zrozumiała.
        const list = t.actions.slice(0, 8).map((a) => a.description).join("; ");
        out.push({ role: "assistant", content: `(zaproponowane akcje: ${list}${t.actions.length > 8 ? "; …" : ""})` });
      }
      else if (t.kind === "clarify") out.push({ role: "assistant", content: `(pytanie: ${t.content})` });
    }
    return out;
  }

  function applyResponse(data: AgentResponse, log?: LogEntry[]) {
    if (data.error) { setError(data.error); return; }
    const id = newId();
    const meta = data.meta;
    if (data.step === "clarify") {
      const content = data.question ?? "Doprecyzuj polecenie.";
      setTurns((t) => [...t, { id, role: "assistant", kind: "clarify", content, options: data.options, messages: data.messages, log: data.log ?? log, meta }]);
      void persist("assistant", content, "clarify", { options: data.options });
      return;
    }
    if (data.step === "answer") {
      const content = data.answer ?? "";
      setTurns((t) => [...t, { id, role: "assistant", kind: "answer", content, followups: data.followups, log: data.log ?? log, meta }]);
      void persist("assistant", content, "answer", { log: data.log ?? log, followups: data.followups });
      return;
    }
    if (data.step === "navigate" && data.url) {
      const label = data.label ?? "Otwórz widok";
      setTurns((t) => [...t, { id, role: "assistant", kind: "navigate", content: `Przejść do: ${label}?`, url: data.url!, label, log: data.log ?? log, meta }]);
      void persist("assistant", `Propozycja przejścia: ${label}`, "navigate", { url: data.url, label });
      return;
    }
    if (data.step === "report") {
      const title = data.title ?? "Raport";
      const content = data.content ?? "";
      setTurns((t) => [...t, { id, role: "assistant", kind: "report", title, content, log: data.log ?? log, meta }]);
      void persist("assistant", content, "report", { title });
      return;
    }
    if (data.step === "plan") {
      const actions = data.actions ?? [];
      setTurns((t) => [...t, { id, role: "assistant", kind: "plan", content: `Zaproponowano ${actions.length} ${actions.length === 1 ? "akcję" : "akcji"}`, actions, messages: data.messages, log: data.log ?? log, meta }]);
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
        body: JSON.stringify({ ...payload, preferences: prefsRef.current.trim() || undefined, stream: true, conversationId: convoIdRef.current ?? undefined }),
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
    // Tryb głosowy: anulowanie generowania → wróć do nasłuchu zamiast utknąć na „myślę".
    if (voiceStateRef.current === "thinking") startListeningRef.current();
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

  // Wczytaj plik graficzny jako data URL (z prostym ograniczeniem rozmiaru).
  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // pozwól wybrać ten sam plik ponownie
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError("Wybierz plik graficzny."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Zdjęcie za duże (max 8 MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError("Nie udało się wczytać zdjęcia.");
    reader.readAsDataURL(file);
  }

  // Multimodal: zdjęcie → rozpoznanie przedmiotów (reużywa /magazynowanie/scan)
  // → plan akcji (magazyn lub zakupy, zależnie od kontekstu/podpisu) do przeglądu.
  async function sendImage(dataUrl: string, caption: string) {
    if (busy) return;
    setAttachedImage(null);
    setError(null);
    setBusy(true);
    const userLabel = caption ? `${caption} (📷 zdjęcie)` : "📷 Zdjęcie do rozpoznania";
    setTurns((t) => [...t, { id: newId(), role: "user", kind: "text", content: userLabel }]);
    void persist("user", userLabel, "text");
    if (!convoIdRef.current) {
      try { const convo = await createAiConversation(userLabel); setConversationId(convo.id); convoIdRef.current = convo.id; } catch { /* ignore */ }
    }
    try {
      // Intencja „zadania" (kontekst lub podpis) → parsuj zdjęcie na zadania.
      const toTasks = context[0] === "tasks" || /zadani|task|to.?do|lista zada/i.test(caption);
      if (toTasks) {
        const res = await fetch("/api/llm/tasks/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, today: new Date().toISOString() }),
        });
        const data = (await res.json()) as { tasks?: { title: string; description: string | null; priority: string; dueDate: string | null }[]; error?: string };
        if (!res.ok) { setError(data.error ?? "Nie udało się przetworzyć zdjęcia"); return; }
        const parsed = data.tasks ?? [];
        if (!parsed.length) { setError("Nie rozpoznano zadań na zdjęciu. Spróbuj wyraźniejszego ujęcia."); return; }
        const actions: AIAction[] = parsed.map((t, i) => {
          const params: Record<string, unknown> = { title: t.title };
          if (t.description) params.description = t.description;
          if (t.priority) params.priority = t.priority;
          if (t.dueDate) params.dueDate = t.dueDate;
          return { id: `tsk${i}`, module: "tasks", type: "create_task", params, description: `Dodaj zadanie: ${t.title}` };
        });
        const content = `Rozpoznano ${actions.length} ${actions.length === 1 ? "zadanie" : "zadań"} ze zdjęcia`;
        setTurns((t) => [...t, { id: newId(), role: "assistant", kind: "plan", content, actions }]);
        void persist("assistant", content, "plan", { actions });
        return;
      }
      const res = await fetch("/api/llm/magazynowanie/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = (await res.json()) as { items?: { name: string; quantity: number | null; unit: string | null; category: string | null }[]; error?: string };
      if (!res.ok) { setError(data.error ?? "Nie udało się przetworzyć zdjęcia"); return; }
      const items = data.items ?? [];
      if (!items.length) { setError("Nie rozpoznano przedmiotów na zdjęciu. Spróbuj wyraźniejszego ujęcia."); return; }
      const toShopping = context[0] === "shopping" || /zakup|lista|kup/i.test(caption);
      const actions: AIAction[] = items.map((it, i) => {
        if (toShopping) {
          return {
            id: `img${i}`, module: "shopping", type: "add_item",
            params: { rawText: it.quantity ? `${it.quantity} ${it.name}` : it.name },
            description: `Dodaj „${it.name}" do zakupów`,
          };
        }
        const params: Record<string, unknown> = { name: it.name };
        if (it.quantity != null) params.quantity = it.quantity;
        if (it.unit) params.unit = it.unit;
        if (it.category) params.category = it.category;
        return {
          id: `img${i}`, module: "magazynowanie", type: "add_storage_item", params,
          description: `Dodaj do magazynu: ${it.name}${it.quantity != null ? ` (${it.quantity}${it.unit ? ` ${it.unit}` : ""})` : ""}`,
        };
      });
      const content = `Rozpoznano ${actions.length} ${actions.length === 1 ? "pozycję" : "pozycji"} ze zdjęcia`;
      setTurns((t) => [...t, { id: newId(), role: "assistant", kind: "plan", content, actions }]);
      void persist("assistant", content, "plan", { actions });
    } catch {
      setError("Nie udało się przetworzyć zdjęcia");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(textArg?: string) {
    // Wysyłka ze zdjęciem ma własną ścieżkę (vision → plan).
    if (attachedImage) { void sendImage(attachedImage, (textArg ?? inputText).trim()); setInputText(""); saveDraftNow(""); return; }
    const text = (textArg ?? inputText).trim();
    if (!text || busy) return;
    setInputText("");
    // 032: wysłana treść przestaje być brudnopisem — po powrocie do rozmowy pole ma być puste.
    saveDraftNow("");

    // Tryb zgłoszenia: opis admina → zadanie w projekcie „Omnia" (tytuł z AI).
    const feedbackContext = feedbackRef.current;
    if (feedbackContext) {
      feedbackRef.current = null; // jednorazowo — kolejne wiadomości są zwykłe
      feedbackPrefixRef.current = "🐛 "; // 029: tytuł zadania z głównego robaczka dostaje prefiks 🐛 (domknięcie na kliencie)
      if (!convoIdRef.current) {
        try {
          const convo = await createAiConversation(`Zgłoszenie: ${text.slice(0, 48)}`);
          setConversationId(convo.id);
          convoIdRef.current = convo.id;
        } catch { /* działamy dalej bez persystencji */ }
      }
      setTurns((t) => [...t, { id: newId(), role: "user", kind: "text", content: text }]);
      void persist("user", text, "text");
      const prompt =
        "[ZGŁOSZENIE — TRYB WSKAZYWANIA]\n" +
        // 031: zgłoszenie idzie akcją `submit_feedback` (skrzynka administratora), NIE `create_task` —
        // zwykły użytkownik nie ma dostępu do projektu-skrzynki.
        "Zaproponuj dokładnie JEDNO zgłoszenie (module: tasks, type: submit_feedback).\n" +
        '- params.title: wygeneruj zwięzły, konkretny tytuł po polsku podsumowujący zgłoszenie (max ~80 znaków), ZACZYNAJĄCY SIĘ od "🐛 " (emoji robaka + spacja).\n' +
        "- params.description: NAJPIERW oryginalny opis zgłaszającego wstawiony DOKŁADNIE, słowo w słowo (VERBATIM) — NIE przeredagowuj go, NIE poprawiaj gramatyki/interpunkcji, NIE streszczaj; zachowaj oryginalne słowa i ton. NASTĘPNIE dołącz poniższy kontekst wskazanego miejsca (UI).\n" +
        "Nie dopytuj i nie odpowiadaj tekstem — od razu zaproponuj plan z tym jednym zgłoszeniem.\n\n" +
        `Opis zgłoszony przez użytkownika:\n${text}\n\nKontekst wskazanego miejsca (UI):\n${feedbackContext}`;
      await callAgent({
        text: prompt, context: ctx("tasks"),
        routeHint: "Zgłoszenie błędu/sugestii przez tryb wskazywania UI",
        today: new Date().toISOString(), history: [],
      });
      return;
    }

    // 029: normalna (nie-zgłoszeniowa) wiadomość — porzuć ewentualny nieużyty prefiks 🐛,
    // by nie trafił omyłkowo do niezwiązanego zadania utworzonego później.
    feedbackPrefixRef.current = null;

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
        body: JSON.stringify({ messages: turn.messages, refine: fb, context, routeHint, activeListId, currentProjectId: activeProjectId, today: new Date().toISOString(), conversationId: convoIdRef.current ?? undefined }),
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
    // 029: tryb głównego robaczka — deterministycznie zapewnij prefiks 🐛 w tytule tworzonego zadania.
    const prefix = feedbackPrefixRef.current;
    const actionsToRun = prefix
      ? confirmedActions.map((a) => {
          if (a.type !== "create_task") return a;
          const title = String(a.params.title ?? "");
          if (title.startsWith("🐛")) return a;
          return { ...a, params: { ...a.params, title: `${prefix}${title}` } };
        })
      : confirmedActions;
    feedbackPrefixRef.current = null;
    try {
      const res = await fetch("/api/llm/home/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: actionsToRun, activeListId, currentProjectId: activeProjectId }),
      });
      const data = (await res.json()) as { results?: ActionResult[] };
      const results = data.results ?? [];
      // 029: wynik wchodzi do TEJ SAMEJ tury planu (jedna dynamiczna sekcja: propozycja→wykonano→cofnij),
      // bez pushowania osobnej tury „results". Zapis do DB (append-only) scalamy przy hydratacji.
      setTurns((t) => t.map((x) => (x.id === turn.id && x.kind === "plan" ? { ...x, done: true, results } : x)));
      void persist("assistant", "Wykonano akcje", "results", { results });
      setPlanTurnId(null);
      router.refresh();
      // Tryb głosowy: po wykonaniu akcji wróć do nasłuchu.
      if (voiceStateRef.current !== "off") startListeningRef.current();
    } catch {
      setError("Nie udało się wykonać akcji");
    } finally {
      setIsExecuting(false);
    }
  }

  // Cofnij: wykonaj akcje odwracające (delete utworzonego / przeciwna korekta)
  // w odwrotnej kolejności, przez ten sam /execute (te same asercje dostępu).
  async function undoActions(turn: Extract<Turn, { kind: "plan" }>) {
    const undos = (turn.results ?? []).filter((r) => r.success && r.undo).map((r) => r.undo!);
    if (!undos.length) return;
    try {
      const res = await fetch("/api/llm/home/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: [...undos].reverse(), activeListId, currentProjectId: activeProjectId }),
      });
      await res.json();
      // 029: cofnięcie oznaczamy na TEJ SAMEJ turze planu (bez osobnej tury „Cofnięto").
      // Do DB (append-only) dokładamy lekki znacznik scalany przy hydratacji.
      setTurns((t) => t.map((x) => (x.id === turn.id && x.kind === "plan" ? { ...x, undone: true } : x)));
      void persist("assistant", "Cofnięto", "results", { undo: true });
      router.refresh();
    } catch {
      setError("Nie udało się cofnąć akcji");
    }
  }

  // Autokorekta: oddaj nieudane akcje agentowi, by zaproponował poprawiony plan.
  function fixFailedActions(results: ActionResult[]) {
    const failed = results.filter((r) => !r.success);
    if (!failed.length || busy) return;
    const lines = failed.map((r) => `- ${r.description}${r.error ? ` — błąd: ${r.error}` : ""}`).join("\n");
    const text =
      `Poprzednia próba wykonania akcji częściowo się nie powiodła. Nieudane pozycje i błędy:\n${lines}\n\n` +
      `Zaproponuj POPRAWIONY plan naprawiający te niepowodzenia (np. doprecyzuj nazwę/utwórz brakujący zasób/popraw parametry). ` +
      `Nie powtarzaj akcji, które się powiodły. Jeśli przyczyna jest niejednoznaczna — dopytaj.`;
    const history = buildHistory();
    setTurns((t) => [...t, { id: newId(), role: "user", kind: "text", content: "Popraw nieudane akcje" }]);
    void persist("user", "Popraw nieudane akcje", "text");
    void callAgent({ text, context, routeHint, activeListId, currentProjectId: activeProjectId, today: new Date().toISOString(), history });
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
  async function loadConversation(id: string) {
    // 032: zapisz brudnopis STAREGO wątku, zanim go opuścimy, i zwiń rozwinięte sekcje.
    saveDraftNow();
    collapseSections();
    try {
      const convo = await getAiConversation(id);
      if (!convo) return;
      // 029: wiadomość „results" scalamy w poprzedzającą turę planu (jedna sekcja), zamiast tworzyć
      // osobną turę. Znacznik { undo:true } oznacza cofnięcie tego planu. Bardzo stare rozmowy bez
      // poprzedzającego planu renderują się jako samodzielna tura „results" (wsteczna zgodność).
      const rehydrated: Turn[] = [];
      let lastPlan: Extract<Turn, { kind: "plan" }> | null = null;
      for (const m of convo.messages) {
        const data = (m.data ?? {}) as Record<string, unknown>;
        if (m.role === "user") { rehydrated.push({ id: m.id, role: "user", kind: "text", content: m.content }); continue; }
        switch (m.kind) {
          case "report": rehydrated.push({ id: m.id, role: "assistant", kind: "report", title: (data.title as string) ?? "Raport", content: m.content }); lastPlan = null; break;
          case "navigate": rehydrated.push({ id: m.id, role: "assistant", kind: "navigate", content: m.content, url: (data.url as string) ?? "/", label: (data.label as string) ?? "Otwórz" }); lastPlan = null; break;
          case "plan": {
            const planTurn: Extract<Turn, { kind: "plan" }> = { id: m.id, role: "assistant", kind: "plan", content: m.content, actions: (data.actions as AIAction[]) ?? [], done: true };
            rehydrated.push(planTurn);
            lastPlan = planTurn;
            break;
          }
          case "results": {
            if (data.undo === true) {
              if (lastPlan) lastPlan.undone = true;
            } else if (lastPlan && !lastPlan.results) {
              lastPlan.results = (data.results as ActionResult[]) ?? [];
              lastPlan.done = true;
            } else {
              rehydrated.push({ id: m.id, role: "assistant", kind: "results", content: m.content, results: (data.results as ActionResult[]) ?? [] });
            }
            break;
          }
          case "clarify": rehydrated.push({ id: m.id, role: "assistant", kind: "clarify", content: m.content, resolved: true }); lastPlan = null; break;
          default: rehydrated.push({ id: m.id, role: "assistant", kind: "answer", content: m.content, followups: Array.isArray(data.followups) ? (data.followups as string[]) : undefined }); lastPlan = null; break;
        }
      }
      setTurns(rehydrated);
      setConversationId(convo.id);
      convoIdRef.current = convo.id;
      // 032: przywróć niewysłany tekst tej rozmowy, żeby można było dokończyć to, co się pisało
      // (także po przejściu na inne urządzenie — brudnopis siedzi na koncie).
      setInputText(convo.draft ?? "");
      lastSavedDraftRef.current = convo.draft ?? "";
      // Wróciliśmy do tej rozmowy, więc „poprzednia" przestaje być nią samą.
      if (lastConversationId === convo.id) {
        setLastConversationId(null);
        setLastConversationLabel("");
      }
      setHeaderPanel("none");
    } catch { /* ignore */ }
  }

  async function removeConversation(id: string) {
    try {
      await deleteAiConversation(id);
      setConversations((c) => c.filter((x) => x.id !== id));
      // 032: nie proponuj powrotu do rozmowy, której już nie ma.
      if (lastConversationId === id) { setLastConversationId(null); setLastConversationLabel(""); }
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

      {/* FAB — akcja główna (najwyższy z-index wśród pływających przycisków, by
          ewentualnie zasłaniać przycisk admina, nigdy odwrotnie). Chowany, gdy
          otwarty jest modal treściowy. */}
      {!modalOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Asystent AI"
          aria-label="Otwórz asystenta AI"
          className="fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6"
          // Nad pełnoekranowym panelem roboczym (mobilny podgląd zadania, z-50) FAB musi
          // stać wyżej niż panel, ale niżej niż toasty (z-60). Poza panelem zostaje na 41.
          style={{ zIndex: panelOpen ? 55 : 41, width: 52, height: 52, borderRadius: "50%", border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.35)", cursor: "pointer" }}
        >
          <Sparkles size={22} />
        </button>
      )}

      {isOpen && (
        <div
          data-omnia-overlay="assistant"
          className="fixed inset-0 flex items-end md:items-center md:justify-center"
          style={{ zIndex: 9990, backgroundColor: "rgba(0,0,0,0.6)" }}
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
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", minWidth: 0, gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Sparkles size={15} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Asystent AI</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <button onClick={resetConversation} title="Nowa rozmowa" aria-label="Nowa rozmowa" style={iconBtn}><Plus size={16} /></button>
                <button onClick={() => togglePanel("prefs")} title="Ustawienia asystenta" aria-label="Ustawienia asystenta" aria-expanded={showPrefs} style={{ ...iconBtn, color: showPrefs || prefs.trim() ? "var(--accent-blue)" : "var(--text-muted)" }}><Settings size={16} /></button>
                <button onClick={() => togglePanel("report")} title="Zgłoś problem z Asystentem AI" aria-label="Zgłoś problem z Asystentem AI" aria-expanded={showReport} style={{ ...iconBtn, color: showReport ? "var(--accent-purple)" : "var(--text-muted)" }}><Bug size={16} /></button>
                <button onClick={() => togglePanel("history")} title={showHistory ? "Zamknij historię (wróć do rozmowy)" : "Historia rozmów"} aria-label="Historia rozmów" aria-expanded={showHistory} style={{ ...iconBtn, color: showHistory ? "var(--accent-blue)" : "var(--text-muted)" }}><History size={16} /></button>
                <button onClick={handleClose} title="Zamknij" aria-label="Zamknij asystenta" style={iconBtn}><X size={16} /></button>
              </div>
            </div>

            {/* 034: powrót do poprzedniej rozmowy dostaje WŁASNY wiersz pod nagłówkiem. Wcześniej
                siedział w rzędzie ikon i na telefonie rozpychał nagłówek poza ekran (tytuł rozmowy
                bywa długi). Pokazujemy go tylko wtedy, gdy jest po co wracać, a bieżący wątek jest
                pusty. `minWidth: 0` + ellipsis gwarantują, że długi tytuł się przycina zamiast
                rozciągać arkusz. */}
            {lastConversationId && turns.length === 0 && headerPanel === "none" && (
              <button
                onClick={() => loadConversation(lastConversationId)}
                title={`Wróć do rozmowy: ${lastConversationLabel}`}
                aria-label={`Wróć do poprzedniej rozmowy: ${lastConversationLabel}`}
                className="flex-shrink-0"
                style={{
                  display: "flex", alignItems: "center", gap: 6, width: "100%", minWidth: 0, minHeight: 40,
                  padding: "0 20px", border: "none", borderBottom: "1px solid var(--border)",
                  background: "var(--bg-base)", color: "var(--text-secondary)", cursor: "pointer",
                  fontSize: 12, textAlign: "left",
                }}
              >
                <CornerUpLeft size={13} style={{ flexShrink: 0 }} />
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>Wróć do:</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastConversationLabel}</span>
              </button>
            )}

            {/* Panel zgłaszania problemu z Asystentem AI — dostępny dla każdego usera; tworzy zadanie w projekcie „Omnia" */}
            {showReport && (
              <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-base)" }}>
                {reportDone ? (
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <CheckCircle size={15} style={{ color: "var(--accent-green)" }} />{" "}
                      {reportDone.canRead ? "Utworzono zgłoszenie w skrzynce zgłoszeń." : "Dziękujemy — zgłoszenie trafiło do administratora."}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* 031: przejście do zadania proponujemy TYLKO, gdy użytkownik ma dostęp do skrzynki. */}
                      {reportDone.canRead && (
                        <button onClick={() => goTo(`/tasks/${reportDone.projectId}`)} style={{ fontSize: 12.5, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--accent-blue)", cursor: "pointer" }}>Otwórz w zadaniach</button>
                      )}
                      <button onClick={() => setHeaderPanel("none")} style={{ fontSize: 12.5, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>Zamknij</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      Zgłoś problem z Asystentem AI (opis opcjonalny)
                    </label>
                    <textarea
                      value={reportDesc}
                      onChange={(e) => setReportDesc(e.target.value)}
                      rows={2}
                      placeholder={'Np. „spodziewałem się odpowiedzi: …" (możesz zostawić puste — dołączymy sam błąd i zrzut rozmowy)'}
                      style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none", resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <button
                        onClick={submitProblemReport}
                        disabled={!canReport || reportBusy}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--accent-purple)", color: "var(--on-accent)", cursor: !canReport || reportBusy ? "default" : "pointer", opacity: !canReport || reportBusy ? 0.6 : 1 }}
                      >
                        {reportBusy ? <Loader2 size={14} className="animate-spin" /> : <Bug size={14} />} Zgłoś problem
                      </button>
                      <button onClick={() => { setHeaderPanel("none"); setReportDesc(""); }} style={{ fontSize: 12.5, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>Anuluj</button>
                      {!canReport && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Brak treści do zgłoszenia.</span>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Panel ustawień asystenta (custom instructions + głos lektora) */}
            {showPrefs && (
              <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-base)" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Stałe preferencje (asystent uwzględnia je w każdym poleceniu)
                </label>
                <textarea
                  value={prefs}
                  onChange={(e) => savePrefs(e.target.value)}
                  rows={3}
                  placeholder={'Np. „Domyślnie dodawaj do listy Tygodniowe. Kwoty w PLN. Pisz zwięźle."'}
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none", resize: "vertical" }}
                />

                {/* 031: wybór głosu lektora — jedna lista: głosy SERWEROWE (jeśli administrator je
                    włączył; działają w każdej przeglądarce) + głosy systemu użytkownika. Lista
                    głosów systemowych jest przefiltrowana do tych, które faktycznie da się
                    odtworzyć (patrz `getAvailableVoices` w lib/tts.ts). */}
                {(ttsSupported() || serverVoices.length > 0) && (
                  <div style={{ marginTop: 12 }}>
                    <label htmlFor="ai-voice-select" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      Głos lektora (odczyt na głos)
                    </label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        id="ai-voice-select"
                        value={voiceURI}
                        onChange={(e) => changeVoice(e.target.value)}
                        style={{ flex: 1, minWidth: 0, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none" }}
                      >
                        <option value="">(domyślny przeglądarki)</option>
                        {serverVoices.length > 0 && (
                          <optgroup label="Głosy Omnii (działają wszędzie)">
                            {serverVoices.map((v) => (
                              <option key={v.id} value={toServerVoiceValue(v.id)}>{v.label} — {v.description}</option>
                            ))}
                          </optgroup>
                        )}
                        {voices.length > 0 && (
                          <optgroup label="Głosy tego urządzenia">
                            {voices.map((v) => (
                              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <button
                        onClick={() => speak("Dzień dobry, Wielki Magu. Tak brzmi wybrany głos lektora.", "pl")}
                        title="Posłuchaj próbki"
                        aria-label="Posłuchaj próbki głosu"
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "pointer" }}
                      >
                        <Volume2 size={14} /> Próbka
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "5px 0 0", lineHeight: 1.5 }}>
                      {voices.length === 0 && serverVoices.length === 0
                        ? "Głosy ładują się… (na iPhonie mogą pojawić się po chwili)."
                        : serverVoices.length > 0
                          ? "Głosy Omnii zapisujemy na Twoim koncie i brzmią tak samo na każdym urządzeniu. Głosy tego urządzenia pochodzą z systemu — ich lista zależy od komputera lub telefonu."
                          : "Lista pochodzi z Twojego systemu — pokazujemy tylko głosy, które faktycznie działają. Więcej polskich głosów można doinstalować w ustawieniach systemu."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Body: historia LUB wątek */}
            {showHistory ? (
              <div className="flex-1 overflow-y-auto px-3 py-3" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {conversations.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 16 }}>Brak zapisanych rozmów.</p>}
                {conversations.map((c) => (
                  // 031: `minWidth: 0` na wierszu ORAZ na przycisku tytułu — bez tego dziecko flexboxa
                  // ma domyślnie `min-width: auto` i długi tytuł rozpycha wiersz poza szerokość ekranu
                  // (na telefonie objawiało się to przewijaniem w poziomie w historii rozmów).
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
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
                      <button onClick={() => loadConversation(c.id)} style={{ ...rowBtn, flex: 1, minWidth: 0, overflow: "hidden", justifyContent: "flex-start" }}>
                        <span style={{ fontSize: 13, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", overflowWrap: "anywhere" }}>{c.title}</span>
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
                    isAdmin={isAdmin}
                    usdPlnRate={usdPlnRate}
                    onBubbleClick={handleBubbleClick}
                    onClarifySubmit={submitClarify}
                    onOpenPlan={(t) => { pendingPlanIdRef.current = null; setPlanTurnId(t.id); setPlanVersion((v) => v + 1); }}
                    onQuickConfirm={(t) => quickConfirmPlan(t)}
                    onQuickDismiss={(t) => { if (pendingPlanIdRef.current === t.id) pendingPlanIdRef.current = null; dismissPlanTurn(t.id); }}
                    onNavigate={goTo}
                    onSaveReport={saveReport}
                    onRegenerate={lastPayloadRef.current ? regenerate : undefined}
                    onFollowup={(txt) => handleSend(txt)}
                    onFixFailed={fixFailedActions}
                    onUndo={undoActions}
                    speakingId={speakingId}
                    onToggleSpeak={toggleSpeak}
                  />
                ))}

                {busy && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* 031: myśl agenta na żywo — POJEDYNCZY, aktualny krok zastępowany przez
                        następny (wcześniej narastała lista, której użytkownik nie potrzebuje).
                        Pełny przebieg jest po zakończeniu pod „Pokaż log rozumowania". */}
                    {liveThoughts.length > 0 && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }} aria-live="polite">
                        <Sparkles size={11} style={{ color: "var(--accent-blue)", flexShrink: 0, marginTop: 3 }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {liveThoughts[liveThoughts.length - 1]}
                        </span>
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
              <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)", paddingBottom: composerFocused ? undefined : "max(0.75rem, env(safe-area-inset-bottom))" }}>
                {/* Pasek stanu rozmowy głosowej — nie-zasłaniający (nad composerem, wątek/karty widoczne) */}
                {voiceState !== "off" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", borderRadius: 10, border: `1px solid ${voiceState === "speaking" ? "var(--accent-green)" : "var(--accent-blue)"}`, background: "var(--bg-elevated)" }}>
                    <span aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, minWidth: 0, color: voiceState === "speaking" ? "var(--accent-green)" : voiceState === "thinking" ? "var(--text-secondary)" : "var(--accent-blue)" }}>
                      {/* Subtelny, pulsujący wskaźnik trybu głosowego (bez bibliotek) */}
                      {voiceState === "thinking" ? (
                        <Loader2 size={13} className="animate-spin" style={{ flexShrink: 0 }} />
                      ) : (
                        <span className="animate-pulse" style={{ flexShrink: 0, width: 9, height: 9, borderRadius: "50%", background: voiceState === "speaking" ? "var(--accent-green)" : "var(--accent-blue)" }} />
                      )}
                      <span style={{ whiteSpace: "nowrap", fontWeight: 500 }}>
                        {voiceState === "listening" ? "Słucham…" : voiceState === "thinking" ? "Myślę…" : "Mówię…"}
                      </span>
                      {voiceState === "listening" && interimText && (
                        <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>„{interimText}”</span>
                      )}
                    </span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexShrink: 0 }}>
                      {voiceState === "speaking" && (
                        <button onClick={() => startListening()} title="Przerwij i mów" style={voicePillBtn}>
                          <Square size={11} /> Przerwij
                        </button>
                      )}
                      <button onClick={stopVoice} title="Zakończ rozmowę głosową" style={voicePillBtn}>
                        <MicOff size={11} /> Zakończ
                      </button>
                    </div>
                  </div>
                )}
                {attachedImage && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachedImage} alt="załącznik" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Zdjęcie gotowe — opisz (np. „do zakupów”) i wyślij, by rozpoznać przedmioty.</span>
                    <button onClick={() => setAttachedImage(null)} title="Usuń zdjęcie" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
                      <X size={14} />
                    </button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPickImage} style={{ display: "none" }} />
                {/* Karta kompozytora (styl „Chat with Claude"): pole u góry (auto-rozrost) + dolny
                    wiersz akcji. Pole NIE jest przy dolnej krawędzi karty (pod nim wiersz akcji), a
                    margines na kreskę iPhone siedzi na ZEWNĘTRZNEJ stopce warunkowo od fokusu (patrz
                    div wyżej) — dzięki temu karetka na iOS nie „ucieka" nad pole. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px", border: "1px solid var(--border)", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)" }}>
                  {/* Wiersz 1 — pole tekstowe (pełna szerokość, auto-rozrost przez useEffect na scrollHeight) */}
                  <textarea
                    ref={composerRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onFocus={() => setComposerFocused(true)}
                    onBlur={() => setComposerFocused(false)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); dictation.stop(); handleSend(); } }}
                    placeholder={attachedImage ? 'Opcjonalny opis, np. „do zakupów"' : placeholder}
                    rows={1}
                    disabled={busy}
                    aria-label="Wiadomość do asystenta"
                    style={{
                      width: "100%", resize: "none", background: "transparent", border: "none", outline: "none",
                      color: "var(--text-primary)", fontSize: 16, lineHeight: 1.4, padding: "6px 4px",
                      minHeight: 36, maxHeight: 160, overflowY: "auto",
                      // 034: przy ROZWINIĘTYM menu poziomu chowamy karetkę. Przyciski kompozytora
                      // celowo zatrzymują fokus w polu (`keepKeyboardOpen`, żeby na telefonie nie
                      // znikała klawiatura), więc przeglądarka dalej rysuje migający kursor — a
                      // robi to w warstwie ponad HTML-em, której NIE da się przykryć z-indexem.
                      // Fokus i klawiatura zostają; znika tylko kursor przebijający się przez menu.
                      caretColor: showLevelMenu ? "transparent" : "var(--accent-blue)",
                    }}
                  />
                  {/* Wiersz 2 — akcje: lewo (aparat, galeria) · prawo (mikrofon, główny przycisk) */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <button onPointerDown={keepKeyboardOpen} onClick={() => cameraRef.current?.click()} disabled={busy} title="Zrób zdjęcie" aria-label="Zrób zdjęcie" style={composerActionBtn}>
                        <Camera size={20} />
                      </button>
                      <button onPointerDown={keepKeyboardOpen} onClick={() => fileRef.current?.click()} disabled={busy} title="Dodaj zdjęcie" aria-label="Dodaj zdjęcie" style={{ ...composerActionBtn, color: attachedImage ? "var(--accent-blue)" : "var(--text-muted)" }}>
                        <ImagePlus size={20} />
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {/* 031: poziom pracy asystenta — NA LEWO od mikrofonu. Wybór zapisuje się na
                          koncie użytkownika, więc jest ten sam na każdym urządzeniu. */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <button
                          onPointerDown={keepKeyboardOpen}
                          onClick={() => setShowLevelMenu((v) => !v)}
                          disabled={busy}
                          title={`Poziom pracy asystenta: ${ASSISTANT_LEVEL_LABELS[level]}`}
                          aria-label={`Poziom pracy asystenta: ${ASSISTANT_LEVEL_LABELS[level]}`}
                          aria-expanded={showLevelMenu}
                          style={{ ...composerActionBtn, color: LEVEL_COLORS[level] }}
                        >
                          {levelIcon(level, 19)}
                        </button>
                        {showLevelMenu && (
                          <div
                            role="menu"
                            style={{
                              // 032: przycisk poziomu siedzi w PRAWEJ grupie akcji kompozytora, więc
                              // menu musi być kotwiczone prawą krawędzią (rozwija się w stronę środka).
                              // Przy `left: 0` szerokie menu wychodziło poza prawą krawędź telefonu.
                              position: "absolute", bottom: "calc(100% + 6px)", right: 0, left: "auto", zIndex: 6,
                              minWidth: 240, maxWidth: "min(300px, calc(100vw - 40px))",
                              padding: 4, background: "var(--bg-elevated)", border: "1px solid var(--border)",
                              borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                            }}
                          >
                            {ASSISTANT_LEVELS.map((lvl) => (
                              <button
                                key={lvl}
                                role="menuitemradio"
                                aria-checked={level === lvl}
                                onClick={() => changeLevel(lvl)}
                                style={{
                                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                                  width: "100%", padding: "8px 10px", borderRadius: 8, border: "none",
                                  background: level === lvl ? "var(--bg-hover)" : "transparent",
                                  cursor: "pointer", textAlign: "left",
                                }}
                              >
                                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-primary)" }}>
                                  {levelIcon(lvl, 13)}
                                  {ASSISTANT_LEVEL_LABELS[lvl]}
                                  {level === lvl && <Check size={12} style={{ color: "var(--accent-green)" }} />}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                                  {ASSISTANT_LEVEL_DESCRIPTIONS[lvl]}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Mikrofon dyktowania — dopisuje mowę do pola (oddzielny od trybu rozmowy głosowej) */}
                      {dictation.supported && !busy && (
                        <button
                          onPointerDown={keepKeyboardOpen}
                          onClick={dictation.toggle}
                          title={dictation.recording ? "Zatrzymaj dyktowanie" : "Dyktuj (mowa → tekst)"}
                          aria-label={dictation.recording ? "Zatrzymaj dyktowanie" : "Dyktuj"}
                          className={dictation.recording ? "animate-pulse" : undefined}
                          style={{ ...composerActionBtn, background: dictation.recording ? "var(--accent-red)" : "transparent", color: dictation.recording ? "var(--on-accent)" : "var(--text-muted)" }}
                        >
                          {dictation.recording ? <MicOff size={19} /> : <Mic size={19} />}
                        </button>
                      )}
                      {/* Główny przycisk: Stop (generowanie) · Wyślij (jest treść) · rozmowa głosowa (puste) */}
                      {busy ? (
                        <button onClick={stopGeneration} title="Zatrzymaj" aria-label="Zatrzymaj" style={{ ...composerPrimaryBtn, background: "var(--accent-red)" }}>
                          <Square size={15} />
                        </button>
                      ) : (inputText.trim() || attachedImage) ? (
                        // 032: jedno dotknięcie ma WYSŁAĆ i zamknąć klawiaturę. `preventDefault` na
                        // pointerdown chroni przed zgubieniem dotknięcia (klawiatura zwija się,
                        // układ skacze), a klawiaturę zamykamy jawnym `blur()` po wysłaniu.
                        <button onPointerDown={keepKeyboardOpen} onClick={() => { dictation.stop(); handleSend(); composerRef.current?.blur(); }} title="Wyślij" aria-label="Wyślij" style={composerPrimaryBtn}>
                          <ArrowUp size={18} />
                        </button>
                      ) : voiceSupported ? (
                        <button
                          onClick={() => { dictation.stop(); toggleVoice(); }}
                          title={voiceState !== "off" ? "Zakończ rozmowę głosową" : "Rozmowa głosowa (mów zamiast pisać)"}
                          aria-label={voiceState !== "off" ? "Zakończ rozmowę głosową" : "Rozmowa głosowa"}
                          className={voiceState !== "off" ? "animate-pulse" : undefined}
                          style={composerPrimaryBtn}
                        >
                          {voiceState !== "off" ? <Square size={15} /> : <AudioLines size={18} />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                {/* 031: podpowiedź skrótu wysyłania. Tylko desktop (`hidden md:block`) — na telefonie
                    nie ma klawiatury sprzętowej, a wiersz zabierałby miejsce nad klawiaturą ekranową. */}
                <p className="hidden md:block" style={{ margin: "4px 2px 0", fontSize: 10.5, color: "var(--text-muted)" }}>
                  <kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>Ctrl</kbd>+<kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>Enter</kbd> wysyła wiadomość
                </p>
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
          onClose={handlePlanClose}
          isExecuting={isExecuting}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}

/**
 * 032: przyciski leżące BEZPOŚREDNIO pod polem wiadomości nie mogą odbierać mu fokusu. Na telefonie
 * pierwsze dotknięcie zwijało klawiaturę, układ podskakiwał i dotknięcie nie trafiało w przycisk —
 * akcję trzeba było wywołać dwa razy. `preventDefault` na `pointerdown` blokuje domyślne
 * przeniesienie fokusu (klawiatura zostaje otwarta), a `onClick` odpala się normalnie, więc na
 * desktopie nic się nie zmienia.
 *
 * NIE stosujemy tego do przycisku wysyłania (tam klawiatura ma się zamknąć — jawne `blur()`) ani do
 * rozmowy głosowej (użytkownik przechodzi z pisania na mówienie).
 */
const keepKeyboardOpen = (e: React.PointerEvent<HTMLButtonElement>) => e.preventDefault();

/**
 * 032: etykieta ostatniej rozmowy dla przycisku powrotu w nagłówku — z pierwszej wypowiedzi
 * użytkownika, tak jak serwer tworzy tytuł rozmowy (`deriveTitle`). Dzięki temu nie potrzebujemy
 * osobnego zapytania tylko po tytuł.
 */
function conversationLabelFrom(turns: Turn[]): string {
  const first = turns.find((t) => t.role === "user");
  const raw = first && "content" in first ? first.content : "";
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return "poprzednia rozmowa";
  return clean.length > 28 ? `${clean.slice(0, 28)}…` : clean;
}

const iconBtn: React.CSSProperties = { padding: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", borderRadius: 6 };
const rowBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: "none", background: "var(--bg-elevated)", cursor: "pointer", textAlign: "left", width: "100%" };
const chipBtn: React.CSSProperties = { fontSize: 12.5, padding: "8px 12px", borderRadius: 18, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left" };
const voicePillBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" };
// Kompozytor (karta „Chat with Claude"): okrągłe przyciski w dolnym wierszu akcji.
const composerActionBtn: React.CSSProperties = { flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "none", background: "transparent", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const composerPrimaryBtn: React.CSSProperties = { flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

// 033: ikona i kolor poziomu pracy asystenta. Oszczędny = błyskawica (szybko/tanio),
// standardowy = wskaźnik, maksymalny = rakieta (drożej, ale najlepsza jakość).
const LEVEL_COLORS: Record<AssistantLevel, string> = {
  economy: "var(--accent-amber)",
  standard: "var(--text-muted)",
  max: "var(--accent-purple)",
  // 034: własny poziom — ustawienia użytkownika, nie administratora.
  custom: "var(--accent-blue)",
};

function levelIcon(level: AssistantLevel, size: number) {
  if (level === "economy") return <Zap size={size} />;
  if (level === "max") return <Rocket size={size} />;
  if (level === "custom") return <SlidersHorizontal size={size} />;
  return <Gauge size={size} />;
}

// ── Widok pojedynczej tury ──────────────────────────────────────────────────
// 031: stopka odpowiedzi to WYŁĄCZNIE ikony (bez labelek) — każda z `title` (tooltip) i
// `aria-label`. Kolejność w stopce: 1. odczytaj na głos, 2. kopiuj, 3. ponów.
const footerIconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, background: "none", border: "none", cursor: "pointer", padding: 0,
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const label = copied ? "Skopiowano" : "Kopiuj";
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      title={label}
      aria-label={label}
      style={{ ...footerIconBtn, color: copied ? "var(--accent-green)" : "var(--text-muted)" }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function RegenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Generuj ponownie" aria-label="Generuj ponownie" style={{ ...footerIconBtn, color: "var(--text-muted)" }}>
      <RefreshCw size={13} />
    </button>
  );
}

// Przycisk odczytu posta Asystenta na głos (start ↔ stop). Chowa się, gdy przeglądarka nie wspiera syntezy.
// 029: wariant icon-only (bez labelki) — trafia do jednego wiersza stopki obok kwoty kosztu.
function SpeakButton({ speaking, onToggle }: { speaking: boolean; onToggle: () => void }) {
  // 031: liczy się KTÓRAKOLWIEK ścieżka syntezy — przeglądarka albo wybrany głos serwerowy
  // (ten działa nawet tam, gdzie przeglądarka nie ma własnej syntezy). Sprawdzamy przy każdym
  // renderze, bo głos serwerowy dochodzi asynchronicznie po wczytaniu ustawień.
  if (!speechAvailable()) return null;
  return (
    <button
      onClick={onToggle}
      title={speaking ? "Zatrzymaj odczyt" : "Odczytaj na głos"}
      aria-label={speaking ? "Zatrzymaj odczyt" : "Odczytaj na głos"}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, color: speaking ? "var(--accent-blue)" : "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      {speaking ? <Square size={13} /> : <Volume2 size={13} />}
    </button>
  );
}

// 029: lista wyników wykonania (ikona ✓/✗ + opis + „Przejdź") — współdzielona przez
// scaloną sekcję planu i (wsteczna zgodność) samodzielną turę „results".
function ResultRows({ results, onNavigate }: { results: ActionResult[]; onNavigate: (url: string) => void }) {
  return (
    <>
      {results.map((r) => (
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
    </>
  );
}

function TurnView({
  turn, isLast, isAdmin, onBubbleClick, onClarifySubmit, onOpenPlan, onQuickConfirm, onQuickDismiss, onNavigate, onSaveReport, onRegenerate, onFollowup, onFixFailed, onUndo,
  speakingId, onToggleSpeak, usdPlnRate,
}: {
  turn: Turn;
  isLast: boolean;
  isAdmin?: boolean;
  usdPlnRate: number;
  onBubbleClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClarifySubmit: (turn: Extract<Turn, { kind: "clarify" }>, value: string) => void;
  onOpenPlan: (turn: Extract<Turn, { kind: "plan" }>) => void;
  onQuickConfirm?: (turn: Extract<Turn, { kind: "plan" }>) => void;
  onQuickDismiss?: (turn: Extract<Turn, { kind: "plan" }>) => void;
  onNavigate: (url: string) => void;
  onSaveReport: (turn: Extract<Turn, { kind: "report" }>) => void;
  onRegenerate?: () => void;
  onFollowup?: (text: string) => void;
  onFixFailed?: (results: ActionResult[]) => void;
  onUndo?: (turn: Extract<Turn, { kind: "plan" }>) => void;
  speakingId?: string | null;
  onToggleSpeak?: (id: string, text: string) => void;
}) {
  const [clarifyInput, setClarifyInput] = useState("");
  const speaking = speakingId === turn.id;

  if (turn.role === "user") {
    return (
      <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--accent-blue)", color: "var(--on-accent)", padding: "8px 12px", borderRadius: "12px 12px 2px 12px", fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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
        <ReasoningLog log={turn.log} isAdmin={isAdmin} />
        {isLast && turn.followups && turn.followups.length > 0 && onFollowup && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {turn.followups.map((f) => (
              <button key={f} onClick={() => onFollowup(f)} style={{ fontSize: 12, padding: "6px 11px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--accent-blue)", cursor: "pointer", textAlign: "left" }}>
                {f}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
          {onToggleSpeak && <SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, turn.content)} />}
          <CopyButton text={turn.content} />
          {isLast && onRegenerate && <RegenerateButton onClick={onRegenerate} />}
          <AiCostBadge usage={turn.meta} rate={usdPlnRate} />
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
            {/* 025: widoczny przycisk wysyłki — na mobile brak skrótu klawiszowego, więc
                bez tego przycisku nie dało się zatwierdzić odpowiedzi na pytanie clarify. */}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => onClarifySubmit(turn, clarifyInput)}
                disabled={!clarifyInput.trim()}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10,
                  border: "none", background: "var(--accent-blue)", color: "var(--on-accent)",
                  fontSize: 13, fontWeight: 600, cursor: clarifyInput.trim() ? "pointer" : "not-allowed",
                  opacity: clarifyInput.trim() ? 1 : 0.5,
                }}
              >
                <ArrowUp size={15} /> Wyślij
              </button>
            </div>
          </>
        )}
        <ReasoningLog log={turn.log} isAdmin={isAdmin} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {onToggleSpeak && turn.content && <SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, turn.content)} />}
          <AiCostBadge usage={turn.meta} rate={usdPlnRate} />
        </div>
      </div>
    );
  }

  if (turn.kind === "navigate") {
    return (
      <div style={bubble}>
        <p style={{ margin: 0 }}>{turn.content}</p>
        <button onClick={() => onNavigate(turn.url)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <ArrowRight size={15} /> {turn.label}
        </button>
        <ReasoningLog log={turn.log} isAdmin={isAdmin} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {onToggleSpeak && turn.content && <SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, turn.content)} />}
          <AiCostBadge usage={turn.meta} rate={usdPlnRate} />
        </div>
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
          turn.results && turn.results.length ? (
            // 029: jedna dynamiczna sekcja — wyniki wykonania + Cofnij/Popraw w tej samej karcie planu.
            <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-green)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle size={13} /> {turn.undone ? "Wykonano (cofnięte)" : "Wykonano"}</p>
              <ResultRows results={turn.results} onNavigate={onNavigate} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {isLast && onFixFailed && turn.results.some((r) => !r.success) && (
                  <button onClick={() => onFixFailed(turn.results!)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--accent-amber)", background: "transparent", color: "var(--accent-amber)", fontSize: 12, cursor: "pointer" }}>
                    <Wand2 size={12} /> Popraw nieudane ({turn.results.filter((r) => !r.success).length})
                  </button>
                )}
                {isLast && onUndo && !turn.undone && turn.results.some((r) => r.success && r.undo) && (
                  <button onClick={() => onUndo(turn)} title="Cofnij skutki tych akcji" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
                    <RotateCcw size={12} /> Cofnij ({turn.results.filter((r) => r.success && r.undo).length})
                  </button>
                )}
                {turn.undone && (
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <RotateCcw size={11} /> cofnięte
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle size={13} /> Wykonano</p>
          )
        ) : turn.dismissed ? (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}><XCircle size={13} /> Odrzucono</p>
        ) : (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {onQuickConfirm && turn.actions.some((a) => !isDestructiveAction(a)) && (
              <button onClick={() => onQuickConfirm(turn)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent-green)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <CheckCircle size={14} /> Zatwierdź
              </button>
            )}
            <button onClick={() => onOpenPlan(turn)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              Przejrzyj / popraw
            </button>
            {onQuickDismiss && (
              <button onClick={() => onQuickDismiss(turn)} title="Odrzuć akcje" aria-label="Odrzuć akcje" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: "none", background: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
                <X size={14} /> Odrzuć
              </button>
            )}
          </div>
        )}
        <ReasoningLog log={turn.log} isAdmin={isAdmin} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {onToggleSpeak && turn.content && <SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, turn.content)} />}
          <AiCostBadge usage={turn.meta} rate={usdPlnRate} />
        </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          {onToggleSpeak && <SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, `${turn.title}. ${turn.content}`)} />}
          <CopyButton text={turn.content} />
          <AiCostBadge usage={turn.meta} rate={usdPlnRate} />
        </div>
        {turn.savedSlug ? (
          <button onClick={() => onNavigate(`/reports/${turn.savedSlug}`)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent-green)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ArrowRight size={15} /> Otwórz raport
          </button>
        ) : (
          <button onClick={() => onSaveReport(turn)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <FileText size={15} /> Zapisz jako raport
          </button>
        )}
      </div>
    );
  }

  // results — tylko dla wstecznej zgodności hydratowanych starych rozmów (nowy przepływ
  // scala wynik w turę planu). Read-only lista + ewentualna „Popraw nieudane".
  return (
    <div style={bubble}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 6px" }}>{turn.undone ? "Wykonano (cofnięte)" : "Wykonano"}</p>
      <ResultRows results={turn.results} onNavigate={onNavigate} />
      {isLast && onFixFailed && turn.results.some((r) => !r.success) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => onFixFailed(turn.results)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--accent-amber)", background: "transparent", color: "var(--accent-amber)", fontSize: 12, cursor: "pointer" }}
          >
            <Wand2 size={12} /> Popraw nieudane ({turn.results.filter((r) => !r.success).length})
          </button>
        </div>
      )}
    </div>
  );
}
