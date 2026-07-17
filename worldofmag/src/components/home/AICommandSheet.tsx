"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles, Loader2, CheckCircle, XCircle, X, ChevronDown, ChevronUp, ArrowRight,
  Send, History, Plus, FileText, Trash2, ListChecks, Square, RefreshCw, Copy, Check, Pencil, Wand2, RotateCcw, ImagePlus, Settings, Volume2, Mic, MicOff, AudioLines,
} from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { useDictation } from "@/hooks/useDictation";
import { ActionDrawer } from "@/components/home/ActionDrawer";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { speak, stopSpeaking, speechTextFromMarkdown, ttsSupported, primeSpeech, getAvailableVoices, onVoicesChanged, setPreferredVoiceURI, getPreferredVoiceURI } from "@/lib/tts";
import { createSpeechListener, speechRecognitionSupported, type SpeechListener } from "@/lib/speechRecognition";
import {
  listAiConversations, getAiConversation, createAiConversation, appendAiMessage,
  deleteAiConversation, renameAiConversation, type ConversationMeta,
} from "@/actions/aiConversations";
import { createUserReport } from "@/actions/reports";
import type { AIAction } from "@/lib/ai/aiAction";
import { isDestructiveAction } from "@/lib/ai/aiAction";
import type { ActionResult } from "@/lib/ai/executors/shared";
import { ASSISTANT_OPEN_EVENT, type AssistantOpenDetail } from "@/lib/ai/assistantBus";
import { useOverlayState } from "@/hooks/useOverlayState";

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
type AgentMeta = { model?: string; tokens?: number };

// Jedna „kafelka" w wątku rozmowy. `data` z DB pozwala odtworzyć kartę bez ponownego uruchamiania agenta.
type Turn =
  | { id: string; role: "user"; kind: "text"; content: string }
  | { id: string; role: "assistant"; kind: "answer"; content: string; followups?: string[]; log?: LogEntry[]; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "clarify"; content: string; options?: string[]; messages?: ChatMessage[]; log?: LogEntry[]; resolved?: boolean; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "navigate"; content: string; url: string; label: string; log?: LogEntry[]; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "plan"; content: string; actions: AIAction[]; messages?: ChatMessage[]; log?: LogEntry[]; done?: boolean; dismissed?: boolean; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "report"; content: string; title: string; savedSlug?: string; log?: LogEntry[]; meta?: AgentMeta }
  | { id: string; role: "assistant"; kind: "results"; content: string; results: ActionResult[]; undone?: boolean };

// Tryb rozmowy głosowej (magiczna ikona → hands-free). String-union, nie enum (C-12).
type VoiceState = "off" | "listening" | "thinking" | "speaking";

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

const STARTER_CHIPS = [
  "Co mam dziś najważniejszego do zrobienia?",
  "Podsumuj mój tydzień",
  "Znajdź 5 obowiązków pasujących do mojego nastroju i posortuj priorytetami",
  "Zrób raport z tej rozmowy",
];

// H3: drobny podpis pod odpowiedzią — który model i ile tokenów (transparentność).
function MetaFooter({ meta }: { meta?: AgentMeta }) {
  if (!meta?.model && !meta?.tokens) return null;
  const parts: string[] = [];
  if (meta.model) parts.push(meta.model);
  if (meta.tokens) parts.push(`${meta.tokens} tok.`);
  return (
    <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)", opacity: 0.75 }} title="Model i zużycie tokenów tej odpowiedzi">
      {parts.join(" · ")}
    </div>
  );
}

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
  // Magiczną ikonę chowamy, gdy otwarty jest modal treściowy — nie nakładamy
  // dialogu na dialog i nie odciągamy uwagi od skupionego zadania w modalu.
  const { modalOpen } = useOverlayState();
  const [inputText, setInputText] = useState("");
  // Composer: pole tekstowe (auto-rozrost) + dyktowanie mowy (mikrofon w pigułce, jak w ChatGPT).
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation((t) => setInputText((prev) => (prev.trim() ? prev.trimEnd() + " " : "") + t));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [liveThoughts, setLiveThoughts] = useState<string[]>([]); // myśli agenta na żywo (streaming)
  const [error, setError] = useState<string | null>(null);
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
  // Załącznik-zdjęcie (multimodal): rozpoznanie przedmiotów → plan akcji.
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  // Composer: menu drugorzędnych akcji („+") — odchudza pasek na mobile (zdjęcie, preferencje).
  const [showPlus, setShowPlus] = useState(false);
  // Stałe preferencje użytkownika („custom instructions") — pamięć per-urządzenie
  // (localStorage), wstrzykiwana do każdego polecenia. Ref, by uniknąć stale-closure.
  const [prefs, setPrefs] = useState("");
  const prefsRef = useRef("");
  prefsRef.current = prefs;
  const [showPrefs, setShowPrefs] = useState(false);
  // Wybór głosu lektora (per-urządzenie). Głosy iOS/Safari ładują się asynchronicznie — subskrybujemy.
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string>("");
  // Tryb zgłoszenia (admin): kontekst wskazanego miejsca; gdy ustawiony, kolejna
  // wiadomość admina staje się opisem zadania w projekcie „Omnia". Ref — bo
  // listener zdarzenia i handleSend muszą widzieć aktualną wartość bez re-bind.
  const feedbackRef = useRef<string | null>(null);

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
        if (tag !== "textarea" && tag !== "input") handleClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Zatrzymaj generowanie przy zamknięciu/unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Wczytaj zapamiętane preferencje (localStorage) raz przy montażu.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("omnia.aiPrefs");
      if (raw) setPrefs(raw);
    } catch { /* ignore */ }
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
      setShowHistory(false);
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

  function savePrefs(value: string) {
    setPrefs(value);
    try { localStorage.setItem("omnia.aiPrefs", value); } catch { /* ignore */ }
  }

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
        body: JSON.stringify({ ...payload, preferences: prefsRef.current.trim() || undefined, stream: true }),
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
    if (attachedImage) { void sendImage(attachedImage, (textArg ?? inputText).trim()); setInputText(""); return; }
    const text = (textArg ?? inputText).trim();
    if (!text || busy) return;
    setInputText("");

    // Tryb zgłoszenia: opis admina → zadanie w projekcie „Omnia" (tytuł z AI).
    const feedbackContext = feedbackRef.current;
    if (feedbackContext) {
      feedbackRef.current = null; // jednorazowo — kolejne wiadomości są zwykłe
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
        "[ZGŁOSZENIE ADMINA — TRYB WSKAZYWANIA]\n" +
        'Utwórz dokładnie JEDNO zadanie w projekcie „Omnia" (module: tasks, type: create_task, params.projectName="Omnia").\n' +
        "- params.title: wygeneruj zwięzły, konkretny tytuł po polsku podsumowujący zgłoszenie (max ~80 znaków).\n" +
        "- params.description: pełny opis admina ORAZ poniższy kontekst wskazanego miejsca.\n" +
        "Nie dopytuj i nie odpowiadaj tekstem — od razu zaproponuj plan z tym jednym zadaniem.\n\n" +
        `Opis zgłoszony przez admina:\n${text}\n\nKontekst wskazanego miejsca (UI):\n${feedbackContext}`;
      await callAgent({
        text: prompt, context: ctx("tasks"),
        routeHint: "Zgłoszenie błędu/sugestii od admina przez tryb wskazywania UI",
        today: new Date().toISOString(), history: [],
      });
      return;
    }

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
  async function undoActions(turn: Extract<Turn, { kind: "results" }>) {
    const undos = turn.results.filter((r) => r.success && r.undo).map((r) => r.undo!);
    if (!undos.length) return;
    try {
      const res = await fetch("/api/llm/home/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: [...undos].reverse(), activeListId, currentProjectId: activeProjectId }),
      });
      const data = (await res.json()) as { results?: ActionResult[] };
      const undoResults = data.results ?? [];
      setTurns((t) => t.map((x) => (x.id === turn.id && x.kind === "results" ? { ...x, undone: true } : x)));
      setTurns((t) => [...t, { id: newId(), role: "user", kind: "text", content: "Cofnij" }, { id: newId(), role: "assistant", kind: "results", content: "Cofnięto", results: undoResults, undone: true }]);
      void persist("user", "Cofnij", "text");
      void persist("assistant", "Cofnięto", "results", { results: undoResults });
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

      {/* FAB — akcja główna (najwyższy z-index wśród pływających przycisków, by
          ewentualnie zasłaniać przycisk admina, nigdy odwrotnie). Chowany, gdy
          otwarty jest modal treściowy. */}
      {!modalOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Asystent AI"
          aria-label="Otwórz asystenta AI"
          className="fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6"
          style={{ zIndex: 41, width: 52, height: 52, borderRadius: "50%", border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.35)", cursor: "pointer" }}
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
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "5px 0 0" }}>Zapisywane na tym urządzeniu. Zmiany zapisują się automatycznie.</p>

                {/* Wybór głosu lektora (odczyt na głos) */}
                {ttsSupported() && (
                  <div style={{ marginTop: 12 }}>
                    <label htmlFor="ai-voice-select" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      Głos lektora (odczyt na głos)
                    </label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        id="ai-voice-select"
                        value={voiceURI}
                        onChange={(e) => { setVoiceURIState(e.target.value); setPreferredVoiceURI(e.target.value || null); }}
                        style={{ flex: 1, minWidth: 0, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none" }}
                      >
                        <option value="">(domyślny przeglądarki)</option>
                        {voices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                        ))}
                      </select>
                      <button
                        onClick={() => speak("Testowy głos asystenta.", "pl")}
                        title="Przetestuj głos"
                        aria-label="Przetestuj głos"
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "pointer" }}
                      >
                        <Volume2 size={14} /> Test
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "5px 0 0" }}>
                      {voices.length === 0 ? "Głosy ładują się… (na iPhonie mogą pojawić się po chwili)." : "Zapisywane na tym urządzeniu."}
                    </p>
                  </div>
                )}
              </div>
            )}

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
                {/* Composer „pigułka" (styl ChatGPT): [+] · [pole flex-1] · [mikrofon dyktowania] · [kółko rozmowy głosowej / wyślij] */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, padding: "4px 6px", border: "1px solid var(--border)", background: "var(--bg-elevated)", borderRadius: 26 }}>
                  {/* „+" — drugorzędne akcje (zdjęcie, ustawienia) */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      onClick={() => setShowPlus((v) => !v)}
                      disabled={busy}
                      title="Więcej (zdjęcie, ustawienia)"
                      aria-label="Więcej akcji"
                      aria-expanded={showPlus}
                      style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: showPlus ? "var(--bg-hover)" : "transparent", color: attachedImage || prefs.trim() ? "var(--accent-blue)" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "default" : "pointer" }}
                    >
                      <Plus size={22} style={{ transform: showPlus ? "rotate(45deg)" : "none", transition: "transform 0.15s" }} />
                    </button>
                    {showPlus && (
                      <>
                        <div onClick={() => setShowPlus(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                        <div style={{ position: "absolute", bottom: 46, left: 0, zIndex: 41, minWidth: 190, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
                          <button onClick={() => { setShowPlus(false); fileRef.current?.click(); }} style={{ ...rowBtn, background: "none" }}>
                            <ImagePlus size={16} style={{ color: "var(--text-muted)" }} /> <span style={{ fontSize: 13 }}>Zdjęcie</span>
                          </button>
                          <button onClick={() => { setShowPlus(false); setShowPrefs((v) => !v); }} style={{ ...rowBtn, background: "none" }}>
                            <Settings size={16} style={{ color: prefs.trim() ? "var(--accent-blue)" : "var(--text-muted)" }} /> <span style={{ fontSize: 13 }}>Ustawienia asystenta</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Pole tekstowe — wtopione w pigułkę, auto-rozrost */}
                  <textarea
                    ref={composerRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); dictation.stop(); handleSend(); } }}
                    placeholder={attachedImage ? 'Opcjonalny opis, np. „do zakupów"' : placeholder}
                    rows={1}
                    disabled={busy}
                    aria-label="Wiadomość do asystenta"
                    style={{ flex: 1, minWidth: 0, resize: "none", background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.4, padding: "9px 6px", height: 38, maxHeight: 140, overflowY: "auto", caretColor: "var(--accent-blue)" }}
                  />
                  {/* Mikrofon dyktowania — dopisuje mowę do pola (oddzielny od trybu rozmowy głosowej) */}
                  {dictation.supported && !busy && (
                    <button
                      onClick={dictation.toggle}
                      title={dictation.recording ? "Zatrzymaj dyktowanie" : "Dyktuj (mowa → tekst)"}
                      aria-label={dictation.recording ? "Zatrzymaj dyktowanie" : "Dyktuj"}
                      className={dictation.recording ? "animate-pulse" : undefined}
                      style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "none", background: dictation.recording ? "var(--accent-red)" : "transparent", color: dictation.recording ? "var(--on-accent)" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      {dictation.recording ? <MicOff size={19} /> : <Mic size={19} />}
                    </button>
                  )}
                  {/* Prawy klaster: Stop (generowanie) · Wyślij (jest treść) · kółko rozmowy głosowej (puste) */}
                  {busy ? (
                    <button
                      onClick={stopGeneration}
                      title="Zatrzymaj"
                      aria-label="Zatrzymaj"
                      style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "none", background: "var(--accent-red)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <Square size={15} />
                    </button>
                  ) : (inputText.trim() || attachedImage) ? (
                    <button
                      onClick={() => { dictation.stop(); handleSend(); }}
                      title="Wyślij"
                      aria-label="Wyślij"
                      style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <Send size={16} />
                    </button>
                  ) : voiceSupported ? (
                    <button
                      onClick={() => { dictation.stop(); toggleVoice(); }}
                      title={voiceState !== "off" ? "Zakończ rozmowę głosową" : "Rozmowa głosowa (mów zamiast pisać)"}
                      aria-label={voiceState !== "off" ? "Zakończ rozmowę głosową" : "Rozmowa głosowa"}
                      className={voiceState !== "off" ? "animate-pulse" : undefined}
                      style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "none", background: "var(--accent-blue)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      {voiceState !== "off" ? <Square size={15} /> : <AudioLines size={18} />}
                    </button>
                  ) : null}
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
          onClose={handlePlanClose}
          isExecuting={isExecuting}
        />
      )}
    </>
  );
}

const iconBtn: React.CSSProperties = { padding: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", borderRadius: 6 };
const rowBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: "none", background: "var(--bg-elevated)", cursor: "pointer", textAlign: "left", width: "100%" };
const chipBtn: React.CSSProperties = { fontSize: 12.5, padding: "8px 12px", borderRadius: 18, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left" };
const voicePillBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" };

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

// Przycisk odczytu posta Asystenta na głos (start ↔ stop). Chowa się, gdy przeglądarka nie wspiera syntezy.
function SpeakButton({ speaking, onToggle }: { speaking: boolean; onToggle: () => void }) {
  const [supported] = useState(() => ttsSupported());
  if (!supported) return null;
  return (
    <button
      onClick={onToggle}
      title={speaking ? "Zatrzymaj odczyt" : "Odczytaj na głos"}
      aria-label={speaking ? "Zatrzymaj odczyt" : "Odczytaj na głos"}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: speaking ? "var(--accent-blue)" : "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      {speaking ? <Square size={12} /> : <Volume2 size={12} />} {speaking ? "Zatrzymaj" : "Odczytaj"}
    </button>
  );
}

function TurnView({
  turn, isLast, onBubbleClick, onClarifySubmit, onOpenPlan, onQuickConfirm, onQuickDismiss, onNavigate, onSaveReport, onRegenerate, onFollowup, onFixFailed, onUndo,
  speakingId, onToggleSpeak,
}: {
  turn: Turn;
  isLast: boolean;
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
  onUndo?: (turn: Extract<Turn, { kind: "results" }>) => void;
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
        <ReasoningLog log={turn.log} />
        <MetaFooter meta={turn.meta} />
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
          {onToggleSpeak && <SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, turn.content)} />}
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
        {onToggleSpeak && turn.content && (
          <div style={{ marginTop: 8 }}><SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, turn.content)} /></div>
        )}
        <ReasoningLog log={turn.log} />
        <MetaFooter meta={turn.meta} />
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
        {onToggleSpeak && turn.content && (
          <div style={{ marginTop: 8 }}><SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, turn.content)} /></div>
        )}
        <ReasoningLog log={turn.log} />
        <MetaFooter meta={turn.meta} />
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
        {onToggleSpeak && turn.content && (
          <div style={{ marginTop: 8 }}><SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, turn.content)} /></div>
        )}
        <ReasoningLog log={turn.log} />
        <MetaFooter meta={turn.meta} />
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
          <CopyButton text={turn.content} />
          {onToggleSpeak && <SpeakButton speaking={speaking} onToggle={() => onToggleSpeak(turn.id, `${turn.title}. ${turn.content}`)} />}
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {isLast && onFixFailed && turn.results.some((r) => !r.success) && (
          <button
            onClick={() => onFixFailed(turn.results)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--accent-amber)", background: "transparent", color: "var(--accent-amber)", fontSize: 12, cursor: "pointer" }}
          >
            <Wand2 size={12} /> Popraw nieudane ({turn.results.filter((r) => !r.success).length})
          </button>
        )}
        {isLast && onUndo && !turn.undone && turn.results.some((r) => r.success && r.undo) && (
          <button
            onClick={() => onUndo(turn)}
            title="Cofnij skutki tych akcji"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}
          >
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
  );
}
