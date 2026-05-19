"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, RotateCcw, Check, Loader2 } from "lucide-react";
import { saveStoreGraph } from "@/actions/stores";
import { computeLayout } from "@/lib/storeLayout";
import { llm } from "@/lib/llm-client";
import { StoreGraphView } from "./StoreGraphView";
import type { StoreWithGraph, StoreNodeData, StoreEdgeData } from "@/types";

const ALL_CATEGORIES: Array<{ key: string; emoji: string; label: string }> = [
  { key: "Produce",            emoji: "🥕", label: "Warzywa i owoce" },
  { key: "Dairy & Eggs",       emoji: "🧀", label: "Nabiał i jaja" },
  { key: "Meat & Fish",        emoji: "🥩", label: "Mięso i ryby" },
  { key: "Bakery",             emoji: "🍞", label: "Piekarnia" },
  { key: "Dry Goods & Pasta",  emoji: "🌾", label: "Suche i makarony" },
  { key: "Drinks",             emoji: "🍺", label: "Napoje" },
  { key: "Frozen",             emoji: "🧊", label: "Mrożonki" },
  { key: "Snacks & Sweets",    emoji: "🍫", label: "Przekąski i słodycze" },
  { key: "Condiments & Oils",  emoji: "🫙", label: "Sosy i oleje" },
  { key: "Spices & Herbs",     emoji: "🌿", label: "Przyprawy i zioła" },
  { key: "Cleaning & Hygiene", emoji: "🧴", label: "Chemia i higiena" },
  { key: "Canned & Preserved", emoji: "🥫", label: "Przetwory" },
  { key: "Other",              emoji: "📦", label: "Inne" },
];

// ─── Wizard state ─────────────────────────────────────────────────────────────

interface WizardNode {
  tempId: string;
  type: "START" | "STOP" | "CATEGORY";
  category: string | null;
  label: string;
}

interface WizardEdge {
  fromTempId: string;
  toTempId: string;
  weight: number;
}

interface WizardState {
  nodes: Map<string, WizardNode>;
  edges: WizardEdge[];
  explored: Set<string>;       // tempIds already asked about
  queue: string[];             // tempIds of CATEGORY nodes waiting to be explored
}

type Phase =
  | "intro"
  | "ai-input"
  | "ai-loading"
  | "ai-review"
  | "wizard-first"
  | "wizard-neighbors"
  | "wizard-done";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStorePreview(
  nodes: Map<string, WizardNode>,
  edges: WizardEdge[],
  storeId: string,
  storeName: string,
): StoreWithGraph {
  const nodeArr: StoreNodeData[] = Array.from(nodes.values()).map((n) => ({
    id: n.tempId,
    storeId,
    label: n.label,
    type: n.type,
    category: n.category,
    x: 0,
    y: 0,
  }));
  const edgeArr: StoreEdgeData[] = edges.map((e, i) => ({
    id: `e${i}`,
    storeId,
    fromId: e.fromTempId,
    toId: e.toTempId,
    weight: e.weight,
  }));

  // Compute layout for preview
  const positions = computeLayout(
    nodeArr.map((n) => ({ id: n.id, type: n.type })),
    edgeArr.map((e) => ({ fromId: e.fromId, toId: e.toId })),
  );
  nodeArr.forEach((n) => {
    const pos = positions.get(n.id);
    if (pos) { n.x = pos.x; n.y = pos.y; }
  });

  return { id: storeId, name: storeName, ownerId: "", nodes: nodeArr, edges: edgeArr, createdAt: new Date(), updatedAt: new Date() };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CategoryGrid({
  selected,
  weights,
  onToggle,
  onWeightChange,
  single = false,
}: {
  selected: Set<string>;
  weights: Map<string, number>;
  onToggle: (key: string) => void;
  onWeightChange: (key: string, w: number) => void;
  single?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* STOP row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {[{ key: "STOP", emoji: "🛒", label: "Kasy" }, ...ALL_CATEGORIES].map(({ key, emoji, label }) => {
          const isSelected = selected.has(key);
          return (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button
                onClick={() => {
                  if (single && selected.size > 0 && !isSelected) {
                    // deselect all first
                    Array.from(selected).forEach((k) => onToggle(k));
                  }
                  onToggle(key);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: isSelected ? "2px solid var(--accent-blue)" : "1px solid var(--border)",
                  background: isSelected ? "rgba(59,130,246,0.12)" : "var(--bg-surface)",
                  color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 400,
                  textAlign: "left",
                  minHeight: 48,
                  width: "100%",
                  transition: "all 0.1s",
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
                <span style={{ lineHeight: 1.2 }}>{label}</span>
              </button>
              {isSelected && !single && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Odległość:</span>
                  <input
                    type="number"
                    min={1} max={20}
                    value={weights.get(key) ?? 1}
                    onChange={(e) => onWeightChange(key, Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    style={{
                      width: 52,
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>
              )}
              {isSelected && single && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Odległość od wejścia:</span>
                  <input
                    type="number"
                    min={1} max={20}
                    value={weights.get(key) ?? 1}
                    onChange={(e) => onWeightChange(key, Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    style={{
                      width: 52,
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

interface StoreWizardProps {
  storeId: string;
  storeName: string;
  initialStore?: StoreWithGraph;
}

export function StoreWizard({ storeId, storeName, initialStore }: StoreWizardProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(initialStore ? "intro" : "intro");
  const [aiStoreName, setAiStoreName] = useState(storeName);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Wizard BFS state
  const [wizState, setWizState] = useState<WizardState>({
    nodes: new Map([
      ["start", { tempId: "start", type: "START", category: null, label: "Wejście" }],
      ["stop", { tempId: "stop", type: "STOP", category: null, label: "Kasy" }],
    ]),
    edges: [],
    explored: new Set(["start"]),
    queue: [],
  });
  const [currentNode, setCurrentNode] = useState<string>("start");

  // Category selection state (for current question)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Map<string, number>>(new Map());
  const [noConnections, setNoConnections] = useState(false);

  // AI-generated preview
  const [aiPreview, setAiPreview] = useState<StoreWithGraph | null>(null);

  // ── Wizard helpers ──────────────────────────────────────────────────────────

  function toggleCategory(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setWeights((w) => { const nw = new Map(w); nw.delete(key); return nw; });
      } else {
        next.add(key);
        if (!weights.has(key)) setWeights((w) => new Map(w).set(key, 1));
      }
      return next;
    });
  }

  function setWeight(key: string, value: number) {
    setWeights((w) => new Map(w).set(key, value));
  }

  function advanceWizard(newState: WizardState): void {
    const next = newState.queue[0];
    if (!next) {
      setWizState(newState);
      setPhase("wizard-done");
      return;
    }
    const remaining = { ...newState, queue: newState.queue.slice(1) };
    setWizState(remaining);
    setCurrentNode(next);
    setSelected(new Set());
    setWeights(new Map());
    setNoConnections(false);
    setPhase("wizard-neighbors");
  }

  // Commit first-category answer
  function commitFirst() {
    if (selected.size !== 1) return;
    const [catKey] = Array.from(selected.values());
    const weight = weights.get(catKey) ?? 1;

    if (catKey === "STOP") {
      // START → STOP directly (tiny store!)
      const newState: WizardState = {
        ...wizState,
        edges: [{ fromTempId: "start", toTempId: "stop", weight }],
        explored: new Set(["start"]),
        queue: [],
      };
      setWizState(newState);
      setPhase("wizard-done");
      return;
    }

    const tempId = `cat_${catKey.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
    const catMeta = ALL_CATEGORIES.find((c) => c.key === catKey);
    const newNode: WizardNode = { tempId, type: "CATEGORY", category: catKey, label: catMeta?.label ?? catKey };
    const newNodes = new Map(wizState.nodes).set(tempId, newNode);
    const newEdges = [...wizState.edges, { fromTempId: "start", toTempId: tempId, weight }];

    advanceWizard({
      nodes: newNodes,
      edges: newEdges,
      explored: new Set(["start"]),
      queue: [tempId],
    });
  }

  // Commit neighbors answer
  function commitNeighbors() {
    if (noConnections) {
      const newExplored = new Set(wizState.explored).add(currentNode);
      advanceWizard({ ...wizState, explored: newExplored });
      return;
    }

    const newNodes = new Map(wizState.nodes);
    const newEdges = [...wizState.edges];
    const newQueue = [...wizState.queue];

    for (const catKey of Array.from(selected)) {
      const weight = weights.get(catKey) ?? 1;

      if (catKey === "STOP") {
        newEdges.push({ fromTempId: currentNode, toTempId: "stop", weight });
        continue;
      }

      const tempId = `cat_${catKey.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
      if (!newNodes.has(tempId)) {
        const catMeta = ALL_CATEGORIES.find((c) => c.key === catKey);
        newNodes.set(tempId, { tempId, type: "CATEGORY", category: catKey, label: catMeta?.label ?? catKey });
      }
      newEdges.push({ fromTempId: currentNode, toTempId: tempId, weight });
      if (!wizState.explored.has(tempId) && !newQueue.includes(tempId)) {
        newQueue.push(tempId);
      }
    }

    const newExplored = new Set(wizState.explored).add(currentNode);
    advanceWizard({ nodes: newNodes, edges: newEdges, explored: newExplored, queue: newQueue });
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function saveWizard() {
    setIsSaving(true);
    const nodesArr = Array.from(wizState.nodes.values()).map((n) => ({
      tempId: n.tempId,
      label: n.label,
      type: n.type,
      category: n.category,
      x: 0,
      y: 0,
    }));
    const edgesArr = wizState.edges;

    const positions = computeLayout(
      nodesArr.map((n) => ({ id: n.tempId, type: n.type })),
      edgesArr.map((e) => ({ fromId: e.fromTempId, toId: e.toTempId })),
    );
    nodesArr.forEach((n) => {
      const pos = positions.get(n.tempId);
      if (pos) { n.x = pos.x; n.y = pos.y; }
    });

    await saveStoreGraph(storeId, nodesArr, edgesArr);
    router.refresh();
    setIsSaving(false);
  }

  async function saveAi() {
    if (!aiPreview) return;
    setIsSaving(true);
    const nodesArr = (aiPreview.nodes as StoreNodeData[]).map((n) => ({
      tempId: n.id,
      label: n.label,
      type: n.type,
      category: n.category,
      x: n.x,
      y: n.y,
    }));
    const edgesArr = (aiPreview.edges as StoreEdgeData[]).map((e) => ({
      fromTempId: e.fromId,
      toTempId: e.toId,
      weight: e.weight,
    }));
    await saveStoreGraph(storeId, nodesArr, edgesArr);
    router.refresh();
    setIsSaving(false);
  }

  // ── AI generation ───────────────────────────────────────────────────────────

  async function generateAI() {
    if (!aiStoreName.trim()) return;
    setPhase("ai-loading");
    setAiError(null);
    try {
      const result = await llm.stores.generate(aiStoreName.trim());
      // Build preview with layout
      const nodeArr: StoreNodeData[] = result.nodes.map((n) => ({
        id: n.id, storeId, label: n.label, type: n.type, category: n.category, x: 0, y: 0,
      }));
      const edgeArr: StoreEdgeData[] = result.edges.map((e, i) => ({
        id: `e${i}`, storeId, fromId: e.fromId, toId: e.toId, weight: e.weight,
      }));
      const positions = computeLayout(
        nodeArr.map((n) => ({ id: n.id, type: n.type })),
        edgeArr.map((e) => ({ fromId: e.fromId, toId: e.toId })),
      );
      nodeArr.forEach((n) => {
        const pos = positions.get(n.id);
        if (pos) { n.x = pos.x; n.y = pos.y; }
      });
      setAiPreview({ id: storeId, name: aiStoreName, ownerId: "", nodes: nodeArr, edges: edgeArr, createdAt: new Date(), updatedAt: new Date() });
      setPhase("ai-review");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Nieznany błąd");
      setPhase("ai-input");
    }
  }

  // ── Wizard done preview ────────────────────────────────────────────────────

  const wizardPreview = phase === "wizard-done"
    ? makeStorePreview(wizState.nodes, wizState.edges, storeId, storeName)
    : null;

  const currentNodeMeta = phase === "wizard-neighbors"
    ? wizState.nodes.get(currentNode)
    : null;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── INTRO ─────────────────────────────────────────────────────────── */}
      {phase === "intro" && (
        <>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
              Skonfiguruj mapę sklepu
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              Mapa sklepu pozwala sortować listę zakupów zgodnie z układem regałów,
              żebyś szedł przez sklep w optymalnej kolejności.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => { setPhase("wizard-first"); setSelected(new Set()); setWeights(new Map()); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 20px",
                borderRadius: 12,
                border: "2px solid var(--accent-blue)",
                background: "rgba(59,130,246,0.06)",
                color: "var(--text-primary)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 28 }}>🧭</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Kreator krok po kroku</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                  Odpowiedz na kilka pytań o układzie sklepu
                </p>
              </div>
              <ArrowRight size={16} style={{ marginLeft: "auto", color: "var(--text-muted)", flexShrink: 0 }} />
            </button>

            <button
              onClick={() => setPhase("ai-input")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 20px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 28 }}>✨</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Generuj przez AI</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                  AI zna układy popularnych polskich sklepów (Biedronka, Lidl, Żabka…)
                </p>
              </div>
              <Sparkles size={16} style={{ marginLeft: "auto", color: "var(--accent-purple)", flexShrink: 0 }} />
            </button>
          </div>

          {initialStore && initialStore.nodes.length > 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Aktualna mapa ma {initialStore.nodes.length} węzłów.
              Przebudowanie zastąpi ją nową.
            </p>
          )}
        </>
      )}

      {/* ── AI INPUT ──────────────────────────────────────────────────────── */}
      {phase === "ai-input" && (
        <>
          <div>
            <button onClick={() => setPhase("intro")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 12 }}>
              ← Wróć
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
              Generuj mapę przez AI
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
              Podaj nazwę sieci handlowej — AI wygeneruje typowy układ.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              value={aiStoreName}
              onChange={(e) => setAiStoreName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") generateAI(); }}
              placeholder="np. Biedronka, Lidl, Żabka…"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border-focus)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={generateAI}
              disabled={!aiStoreName.trim()}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: aiStoreName.trim() ? "var(--accent-purple)" : "var(--bg-elevated)",
                color: aiStoreName.trim() ? "#fff" : "var(--text-muted)",
                fontSize: 14,
                fontWeight: 600,
                cursor: aiStoreName.trim() ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sparkles size={15} /> Generuj
            </button>
          </div>

          {aiError && (
            <p style={{ fontSize: 13, color: "#f87171", background: "rgba(239,68,68,0.1)", padding: "10px 14px", borderRadius: 8, margin: 0 }}>
              {aiError}
            </p>
          )}
        </>
      )}

      {/* ── AI LOADING ────────────────────────────────────────────────────── */}
      {phase === "ai-loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "48px 0" }}>
          <Loader2 size={36} style={{ color: "var(--accent-purple)", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>
            AI analizuje układ sklepu…
          </p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── AI REVIEW ─────────────────────────────────────────────────────── */}
      {phase === "ai-review" && aiPreview && (
        <>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
              Wygenerowana mapa
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              Sprawdź czy układ wygląda poprawnie.
            </p>
          </div>

          <StoreGraphView store={aiPreview} />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setPhase("ai-input"); setAiPreview(null); }}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <RotateCcw size={14} /> Generuj ponownie
            </button>
            <button
              onClick={saveAi}
              disabled={isSaving}
              style={{
                flex: 2,
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: "#16a34a",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {isSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />}
              Zapisz mapę
            </button>
          </div>
        </>
      )}

      {/* ── WIZARD FIRST ──────────────────────────────────────────────────── */}
      {phase === "wizard-first" && (
        <>
          <div>
            <button onClick={() => setPhase("intro")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 12 }}>
              ← Wróć
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
              Pierwsza kategoria
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
              Wchodząc do sklepu, którą kategorię mijasz jako pierwszą?
            </p>
          </div>

          <CategoryGrid
            selected={selected}
            weights={weights}
            onToggle={toggleCategory}
            onWeightChange={setWeight}
            single
          />

          <button
            onClick={commitFirst}
            disabled={selected.size !== 1}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: selected.size === 1 ? "var(--accent-blue)" : "var(--bg-elevated)",
              color: selected.size === 1 ? "#fff" : "var(--text-muted)",
              fontSize: 14,
              fontWeight: 600,
              cursor: selected.size === 1 ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            Dalej <ArrowRight size={15} />
          </button>
        </>
      )}

      {/* ── WIZARD NEIGHBORS ──────────────────────────────────────────────── */}
      {phase === "wizard-neighbors" && currentNodeMeta && (
        <>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Odkryte obszary: {wizState.nodes.size - 2}
              </span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
              Z &ldquo;{currentNodeMeta.label}&rdquo;…
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
              Do jakich kategorii możesz przejść bezpośrednio? Podaj odległości (1 = obok, 10 = drugi koniec sklepu).
            </p>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={noConnections}
              onChange={(e) => { setNoConnections(e.target.checked); if (e.target.checked) setSelected(new Set()); }}
              style={{ width: 16, height: 16 }}
            />
            Brak połączeń z tego miejsca (ślepy zaułek)
          </label>

          {!noConnections && (
            <CategoryGrid
              selected={selected}
              weights={weights}
              onToggle={toggleCategory}
              onWeightChange={setWeight}
            />
          )}

          <button
            onClick={commitNeighbors}
            disabled={!noConnections && selected.size === 0}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: (noConnections || selected.size > 0) ? "var(--accent-blue)" : "var(--bg-elevated)",
              color: (noConnections || selected.size > 0) ? "#fff" : "var(--text-muted)",
              fontSize: 14,
              fontWeight: 600,
              cursor: (noConnections || selected.size > 0) ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {wizState.queue.length === 0 ? "Zakończ" : "Dalej"} <ArrowRight size={15} />
          </button>
        </>
      )}

      {/* ── WIZARD DONE ───────────────────────────────────────────────────── */}
      {phase === "wizard-done" && wizardPreview && (
        <>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
              Mapa gotowa!
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
              Sprawdź podgląd i zapisz.
            </p>
          </div>

          <StoreGraphView store={wizardPreview} />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setWizState({
                  nodes: new Map([
                    ["start", { tempId: "start", type: "START", category: null, label: "Wejście" }],
                    ["stop", { tempId: "stop", type: "STOP", category: null, label: "Kasy" }],
                  ]),
                  edges: [],
                  explored: new Set(["start"]),
                  queue: [],
                });
                setCurrentNode("start");
                setSelected(new Set());
                setWeights(new Map());
                setNoConnections(false);
                setPhase("wizard-first");
              }}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <RotateCcw size={14} /> Od nowa
            </button>
            <button
              onClick={saveWizard}
              disabled={isSaving}
              style={{
                flex: 2,
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: "#16a34a",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {isSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />}
              Zapisz mapę
            </button>
          </div>
        </>
      )}
    </div>
  );
}
