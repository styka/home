"use client";

import { useState } from "react";
import { X, ShoppingCart, CheckSquare, FileText, PawPrint, Boxes, Wallet, Fuel, ChefHat, Repeat, Wand2, CheckCircle, XCircle, Loader2, Square, CheckSquare2, ChevronDown, ChevronUp, HeartPulse, Languages, Newspaper, CloudSun } from "lucide-react";
import type { AIAction } from "@/lib/ai/aiAction";
import type { ActionResult } from "@/app/api/llm/home/execute/route";

interface ActionDrawerProps {
  actions: AIAction[];
  onConfirm: (confirmedActions: AIAction[]) => Promise<void>;
  onClose: () => void;
  isExecuting: boolean;
  results?: ActionResult[];
  /** Korekta planu przez AI: użytkownik opisuje, co poprawić, a agent przeplanowuje całość. */
  onRefine?: (feedback: string) => void;
  isRefining?: boolean;
}

// Akcje destrukcyjne — domyślnie ODZNACZONE i oznaczone na czerwono (świadomy opt-in).
const DESTRUCTIVE_TYPES = new Set([
  "delete_item",
  "delete_task",
  "delete_note",
  "archive_list",
  "delete_health_event",
  "delete_word",
  "delete_news_topic",
  "delete_weather_location",
  // Domknięcie pokrycia zapisu — wszystkie operacje usuwające/archiwizujące są opt-in.
  "delete_list",
  "delete_project",
  "delete_habit",
  "delete_wallet_element",
  "delete_recipe",
  "delete_meal_plan",
  "delete_pantry_item",
  "delete_vehicle",
  "delete_deck",
  "delete_weather_watcher",
  "delete_storage_item",
  "delete_pet",
  "delete_medication",
]);
// Surowe identyfikatory rekordów (taskId/listId/itemId/noteId…) nic nie mówią
// użytkownikowi, więc NIE pokazujemy ich w edytorze parametrów — i tak przechodzą
// dalej do backendu, który celuje po nich w konkretny rekord. Użytkownik recenzuje
// akcję po opisie i po czytelnym `searchQuery` (nazwa/tytuł rekordu).
const ID_KEY = /Id$/;

// Parametry-daty agent przesyła jako surowy string ISO z JSON-a
// (np. „2026-06-08T00:00:00.000Z"). W podglądzie akcji to nieczytelne, więc
// wykrywamy takie wartości i pokazujemy je natywnym date/datetime-pickerem,
// który prezentuje datę w formacie lokalnym (pl) i pozwala ją wygodnie edytować.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function isDateValue(value: string): boolean {
  const v = value.trim();
  return ISO_DATE_RE.test(v) && !Number.isNaN(new Date(v).getTime());
}

// Czy wartość niesie ZNACZĄCY czas (nie samą północ). Datę typu „2026-06-08"
// oraz „2026-06-08T00:00:00.000Z" traktujemy jako datę (picker dzienny), nie datę+godzinę.
function hasTime(value: string): boolean {
  const m = value.trim().match(/[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return false;
  return !(m[1] === "00" && m[2] === "00" && (m[3] === undefined || m[3] === "00"));
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// Wartość dla natywnego inputa: type=date → „YYYY-MM-DD"; type=datetime-local → „YYYY-MM-DDTHH:mm" (czas lokalny).
function toInputValue(value: string): string {
  const v = value.trim();
  if (!hasTime(v)) return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Czytelna etykieta pomocnicza obok pickera („8 czerwca 2026" / „…, 15:00").
function formatDateLabel(value: string): string {
  const v = value.trim();
  const withTime = hasTime(v);
  let d: Date;
  if (withTime) {
    d = new Date(v);
  } else {
    const [y, m, day] = v.slice(0, 10).split("-").map(Number);
    d = new Date(y, m - 1, day); // buduj lokalnie — bez przesunięcia strefy dla daty bez czasu
  }
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pl-PL", {
    day: "numeric", month: "long", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function moduleIcon(module: string) {
  if (module === "shopping") return <ShoppingCart size={15} />;
  if (module === "tasks") return <CheckSquare size={15} />;
  if (module === "pets") return <PawPrint size={15} />;
  if (module === "magazynowanie") return <Boxes size={15} />;
  if (module === "portfel") return <Wallet size={15} />;
  if (module === "flota") return <Fuel size={15} />;
  if (module === "kitchen") return <ChefHat size={15} />;
  if (module === "habits") return <Repeat size={15} />;
  if (module === "health") return <HeartPulse size={15} />;
  if (module === "languages") return <Languages size={15} />;
  if (module === "news") return <Newspaper size={15} />;
  if (module === "weather") return <CloudSun size={15} />;
  if (module === "reports") return <FileText size={15} />;
  return <FileText size={15} />;
}

function moduleColor(module: string) {
  if (module === "shopping") return "var(--accent-blue)";
  if (module === "tasks") return "var(--accent-green)";
  if (module === "pets") return "var(--accent-purple)";
  if (module === "magazynowanie") return "var(--accent-blue)";
  if (module === "portfel") return "var(--accent-green)";
  if (module === "flota") return "var(--accent-blue)";
  if (module === "kitchen") return "var(--accent-amber)";
  if (module === "habits") return "var(--accent-purple)";
  if (module === "health") return "var(--accent-red)";
  if (module === "languages") return "var(--accent-blue)";
  if (module === "news") return "var(--accent-amber)";
  if (module === "weather") return "var(--accent-blue)";
  if (module === "reports") return "var(--accent-amber)";
  return "var(--accent-amber)";
}

function moduleLabel(module: string) {
  if (module === "shopping") return "Zakupy";
  if (module === "tasks") return "Zadania";
  if (module === "pets") return "Zwierzęta";
  if (module === "magazynowanie") return "Magazyn";
  if (module === "portfel") return "Portfel";
  if (module === "flota") return "Flota";
  if (module === "kitchen") return "Kuchnia";
  if (module === "habits") return "Nawyki";
  if (module === "health") return "Zdrowie";
  if (module === "languages") return "Języki";
  if (module === "news") return "Wiadomości";
  if (module === "weather") return "Pogoda";
  if (module === "reports") return "Raport";
  return "Notatki";
}

export function ActionDrawer({ actions, onConfirm, onClose, isExecuting, results, onRefine, isRefining }: ActionDrawerProps) {
  const [refineText, setRefineText] = useState("");
  const [included, setIncluded] = useState<Set<string>>(
    new Set(actions.filter((a) => !DESTRUCTIVE_TYPES.has(a.type)).map((a) => a.id))
  );
  const [descriptions, setDescriptions] = useState<Record<string, string>>(
    Object.fromEntries(actions.map((a) => [a.id, a.description]))
  );
  const [paramsExpanded, setParamsExpanded] = useState<Set<string>>(new Set());
  const [editedParams, setEditedParams] = useState<Record<string, Record<string, string>>>(
    Object.fromEntries(actions.map((a) => [a.id, Object.fromEntries(Object.entries(a.params).map(([k, v]) => [k, String(v ?? "")]))]))
  );
  const [editedSearchQuery, setEditedSearchQuery] = useState<Record<string, string>>(
    Object.fromEntries(actions.map((a) => [a.id, a.searchQuery ?? ""]))
  );

  function toggleAction(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (included.size === actions.length) {
      setIncluded(new Set());
    } else {
      setIncluded(new Set(actions.map((a) => a.id)));
    }
  }

  function toggleParams(id: string) {
    setParamsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function updateParam(actionId: string, key: string, value: string) {
    setEditedParams((prev) => ({ ...prev, [actionId]: { ...prev[actionId], [key]: value } }));
  }

  function handleConfirm() {
    const confirmed = actions
      .filter((a) => included.has(a.id))
      .map((a) => ({
        ...a,
        description: descriptions[a.id] ?? a.description,
        params: Object.fromEntries(
          Object.entries(editedParams[a.id] ?? a.params).map(([k, v]) => {
            const orig = a.params[k];
            if (typeof orig === "number") return [k, Number(v)];
            if (typeof orig === "boolean") return [k, v === "true"];
            return [k, v];
          })
        ),
        searchQuery: editedSearchQuery[a.id] || a.searchQuery,
      }));
    void onConfirm(confirmed);
  }

  const showResults = !!results;
  const selectedCount = included.size;
  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full md:max-w-lg md:mx-4"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px 16px 0 0",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Handle bar (mobile) */}
        <div className="md:hidden" style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              {showResults ? "Wyniki" : "Wykryte akcje"}
            </h2>
            {!showResults && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>
                {selectedCount} z {actions.length} zaznaczonych
              </p>
            )}
            {showResults && (
              <p style={{ fontSize: 11, margin: 0, marginTop: 2 }}>
                <span style={{ color: "var(--accent-green)" }}>{successCount} wykonanych</span>
                {failCount > 0 && <span style={{ color: "var(--accent-red)" }}> · {failCount} błędów</span>}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!showResults && actions.map((action) => {
            const isIncluded = included.has(action.id);
            return (
              <div
                key={action.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  opacity: isIncluded ? 1 : 0.45,
                  transition: "opacity 0.1s",
                }}
              >
                <button
                  onClick={() => toggleAction(action.id)}
                  style={{
                    flexShrink: 0,
                    marginTop: 1,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: isIncluded ? "var(--accent-blue)" : "var(--text-muted)",
                    padding: 0,
                  }}
                >
                  {isIncluded ? <CheckSquare2 size={16} /> : <Square size={16} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Module badge + action type */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: moduleColor(action.module) }}>{moduleIcon(action.module)}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: moduleColor(action.module) }}>
                      {moduleLabel(action.module)}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{action.type}</span>
                    {DESTRUCTIVE_TYPES.has(action.type) && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "var(--accent-red)", border: "1px solid var(--accent-red)", borderRadius: 4, padding: "0 4px" }}>
                        USUWA
                      </span>
                    )}
                  </div>

                  {/* Editable description */}
                  <input
                    value={descriptions[action.id] ?? action.description}
                    onChange={(e) => setDescriptions((prev) => ({ ...prev, [action.id]: e.target.value }))}
                    style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)", padding: 0, marginBottom: 6 }}
                  />

                  {/* Params toggle */}
                  <button
                    onClick={() => toggleParams(action.id)}
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {paramsExpanded.has(action.id) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    Parametry
                  </button>

                  {/* Params editor (pomijamy surowe identyfikatory — patrz ID_KEY) */}
                  {paramsExpanded.has(action.id) && (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      {Object.entries(editedParams[action.id] ?? {}).filter(([key]) => !ID_KEY.test(key)).map(([key, value]) => {
                        const isDate = isDateValue(value);
                        return (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 90, flexShrink: 0, fontFamily: "monospace" }}>{key}</span>
                            {isDate ? (
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                <input
                                  type={hasTime(value) ? "datetime-local" : "date"}
                                  value={toInputValue(value)}
                                  onChange={(e) => updateParam(action.id, key, e.target.value)}
                                  style={{
                                    fontSize: 12, color: "var(--text-primary)",
                                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                                    borderRadius: 6, padding: "3px 8px", outline: "none",
                                  }}
                                />
                                <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {formatDateLabel(value)}
                                </span>
                              </div>
                            ) : (
                              <input
                                value={value}
                                onChange={(e) => updateParam(action.id, key, e.target.value)}
                                style={{
                                  flex: 1, fontSize: 12, color: "var(--text-primary)",
                                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                                  borderRadius: 6, padding: "3px 8px", outline: "none",
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                      {action.searchQuery !== undefined && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "var(--accent-amber)", width: 90, flexShrink: 0, fontFamily: "monospace" }}>searchQuery</span>
                          <input
                            value={editedSearchQuery[action.id] ?? ""}
                            onChange={(e) => setEditedSearchQuery((prev) => ({ ...prev, [action.id]: e.target.value }))}
                            style={{
                              flex: 1, fontSize: 12, color: "var(--text-primary)",
                              background: "var(--bg-surface)", border: "1px solid rgba(245,158,11,0.4)",
                              borderRadius: 6, padding: "3px 8px", outline: "none",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {showResults && results?.map((result) => (
            <div
              key={result.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ flexShrink: 0, marginTop: 1, color: result.success ? "var(--accent-green)" : "var(--accent-red)" }}>
                {result.success ? <CheckCircle size={15} /> : <XCircle size={15} />}
              </span>
              <div>
                <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>
                  {result.description}
                </p>
                {result.error && (
                  <p style={{ fontSize: 11, color: "var(--accent-red)", margin: 0, marginTop: 2 }}>
                    {result.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Korekta planu przez AI (only in pending state) */}
        {!showResults && onRefine && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              Edytuj szczegóły w „Parametry", albo opisz poniżej, co poprawić — AI ułoży plan na nowo:
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && refineText.trim() && !isRefining) {
                    e.preventDefault();
                    onRefine(refineText.trim());
                  }
                }}
                placeholder='Np. "termin na piątek, nie sobotę" lub "pomiń ostatnie zadanie"'
                disabled={isRefining || isExecuting}
                style={{
                  flex: 1, fontSize: 12, color: "var(--text-primary)",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "7px 10px", outline: "none",
                }}
              />
              <button
                onClick={() => { if (refineText.trim()) onRefine(refineText.trim()); }}
                disabled={!refineText.trim() || isRefining || isExecuting}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 8, border: "none",
                  background: !refineText.trim() || isRefining ? "var(--bg-elevated)" : "var(--accent-purple)",
                  color: !refineText.trim() || isRefining ? "var(--text-muted)" : "#fff",
                  cursor: !refineText.trim() || isRefining ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
              >
                {isRefining ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                {isRefining ? "Poprawiam…" : "Popraw"}
              </button>
            </div>
          </div>
        )}

        {/* Hint (only in pending state, when refine not available) */}
        {!showResults && !onRefine && (
          <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              Kliknij &quot;Parametry&quot; przy akcji, aby edytować szczegóły przed wykonaniem.
            </p>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {!showResults ? (
            <>
              <button
                onClick={toggleAll}
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {included.size === actions.length ? "Odznacz wszystko" : "Zaznacz wszystko"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={onClose}
                  style={{
                    fontSize: 13,
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Anuluj
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selectedCount === 0 || isExecuting || isRefining}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "7px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: selectedCount === 0 || isRefining ? "var(--bg-elevated)" : "var(--accent-blue)",
                    color: selectedCount === 0 || isRefining ? "var(--text-muted)" : "#fff",
                    cursor: selectedCount === 0 || isRefining ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isExecuting && <Loader2 size={13} className="animate-spin" />}
                  Wykonaj {selectedCount > 0 ? `(${selectedCount})` : ""}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                width: "100%",
                fontSize: 13,
                fontWeight: 600,
                padding: "9px 0",
                borderRadius: 8,
                border: "none",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Zamknij
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
