"use client";

import React, { useState, useRef, useCallback, useEffect, useTransition } from "react";
import { MousePointer, Plus, GitBranch, Trash2 } from "lucide-react";
import type { StoreWithGraph, StoreNodeData, StoreEdgeData } from "@/types";
import {
  upsertStoreNode,
  deleteStoreNode,
  upsertStoreEdge,
  deleteStoreEdge,
} from "@/actions/stores";

type EditorMode = "select" | "addNode" | "addEdge" | "delete";

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  "Warzywa i owoce":     { emoji: "🥕", color: "#16a34a" },
  "Nabiał i jaja":       { emoji: "🧀", color: "#ca8a04" },
  "Mięso i ryby":        { emoji: "🥩", color: "#dc2626" },
  "Piekarnia":           { emoji: "🍞", color: "#d97706" },
  "Suche produkty":      { emoji: "🌾", color: "#92400e" },
  "Napoje":              { emoji: "🍺", color: "#2563eb" },
  "Mrożone":             { emoji: "🧊", color: "#0891b2" },
  "Przekąski i słodycze": { emoji: "🍫", color: "#c026d3" },
  "Przyprawy i oleje":   { emoji: "🫙", color: "#65a30d" },
  "Zioła i przyprawy":   { emoji: "🌿", color: "#059669" },
  "Chemia i higiena":    { emoji: "🧴", color: "#7c3aed" },
  "Konserwy i przetwory": { emoji: "🥫", color: "#b45309" },
  "Inne":                { emoji: "📦", color: "#6b7280" },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META);
const NODE_RADIUS = 24;
const CANVAS_W = 900;
const CANVAS_H = 550;

function nodeColor(node: StoreNodeData): string {
  if (node.type === "START") return "#16a34a";
  if (node.type === "STOP") return "#dc2626";
  if (node.category && CATEGORY_META[node.category]) return CATEGORY_META[node.category].color;
  return "#6b7280";
}

function nodeEmoji(node: StoreNodeData): string {
  if (node.type === "CATEGORY" && node.category && CATEGORY_META[node.category]) {
    return CATEGORY_META[node.category].emoji;
  }
  return "";
}

function nodeLabel(node: StoreNodeData): string {
  if (node.type === "START") return "Wejście";
  if (node.type === "STOP") return "Kasy";
  return node.label;
}

interface NodeDialog {
  svgX: number;
  svgY: number;
  type: "START" | "STOP" | "CATEGORY";
  category: string;
}

interface PendingEdge {
  fromId: string;
  toX: number;
  toY: number;
}

interface WeightDialog {
  fromId: string;
  toId: string;
}

interface StoreMapEditorProps {
  store: StoreWithGraph;
}

export function StoreMapEditor({ store }: StoreMapEditorProps) {
  const [nodes, setNodes] = useState<StoreNodeData[]>(store.nodes);
  const [edges, setEdges] = useState<StoreEdgeData[]>(store.edges);
  const [mode, setMode] = useState<EditorMode>("select");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [nodeDialog, setNodeDialog] = useState<NodeDialog | null>(null);
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);
  const [weightDialog, setWeightDialog] = useState<WeightDialog | null>(null);
  const [weightValue, setWeightValue] = useState("1");
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG viewBox coords → screen coords relative to the container (for dialog positioning)
  function svgToContainer(svgX: number, svgY: number): { top: number; left: number } {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return { top: 80, left: 80 };
    const svgRect = svg.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const scaleX = svgRect.width / CANVAS_W;
    const scaleY = svgRect.height / CANVAS_H;
    const x = (svgRect.left - cRect.left) + container.scrollLeft + svgX * scaleX;
    const y = (svgRect.top - cRect.top) + container.scrollTop + svgY * scaleY;
    return {
      top:  Math.min(y + 10, container.clientHeight - 260),
      left: Math.max(8, Math.min(x, container.clientWidth - 228)),
    };
  }

  function getSVGPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CANVAS_W / rect.width),
      y: (clientY - rect.top)  * (CANVAS_H / rect.height),
    };
  }

  function flash(id: string) {
    setFlashIds(prev => new Set(Array.from(prev).concat(id)));
    setTimeout(() => setFlashIds(prev => {
      const next = new Set(Array.from(prev));
      next.delete(id);
      return next;
    }), 300);
  }

  // Canvas background click — nodes and edges stop propagation, so this only fires for true background clicks
  const handleSVGPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === "addNode") {
      const pt = getSVGPoint(e.clientX, e.clientY);
      setNodeDialog({ svgX: pt.x, svgY: pt.y, type: "CATEGORY", category: ALL_CATEGORIES[0] });
    } else if (mode === "addEdge" && pendingEdge) {
      setPendingEdge(null);
    }
  }, [mode, pendingEdge]);

  const handleSVGPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const pt = getSVGPoint(e.clientX, e.clientY);
    if (draggingId) {
      setNodes(prev => prev.map(n =>
        n.id === draggingId ? { ...n, x: pt.x - dragOffset.x, y: pt.y - dragOffset.y } : n
      ));
    }
    if (pendingEdge) {
      setPendingEdge(prev => prev ? { ...prev, toX: pt.x, toY: pt.y } : null);
    }
  }, [draggingId, dragOffset, pendingEdge]);

  const handleSVGPointerUp = useCallback(() => {
    if (draggingId) {
      const node = nodes.find(n => n.id === draggingId);
      if (node) {
        startTransition(() => {
          upsertStoreNode(store.id, {
            id: node.id, label: node.label, type: node.type,
            category: node.category, x: node.x, y: node.y,
          });
        });
      }
      setDraggingId(null);
    }
  }, [draggingId, nodes, store.id]);

  function handleNodePointerDown(e: React.PointerEvent, node: StoreNodeData) {
    e.stopPropagation();
    if (mode === "select") {
      const pt = getSVGPoint(e.clientX, e.clientY);
      setDraggingId(node.id);
      setDragOffset({ x: pt.x - node.x, y: pt.y - node.y });
      // Capture on the SVG element so drag works even when pointer leaves SVG bounds
      svgRef.current?.setPointerCapture(e.pointerId);
    } else if (mode === "addEdge") {
      if (!pendingEdge) {
        const pt = getSVGPoint(e.clientX, e.clientY);
        setPendingEdge({ fromId: node.id, toX: pt.x, toY: pt.y });
      } else if (pendingEdge.fromId !== node.id) {
        setWeightDialog({ fromId: pendingEdge.fromId, toId: node.id });
        setWeightValue("1");
        setPendingEdge(null);
      }
    } else if (mode === "delete") {
      flash(node.id);
      setNodes(prev => prev.filter(n => n.id !== node.id));
      setEdges(prev => prev.filter(ed => ed.fromId !== node.id && ed.toId !== node.id));
      startTransition(() => { deleteStoreNode(node.id); });
    }
  }

  function handleEdgePointerDown(e: React.PointerEvent, edge: StoreEdgeData) {
    e.stopPropagation(); // prevent canvas from triggering addNode in addNode mode
    if (mode === "delete") {
      flash(edge.id);
      setEdges(prev => prev.filter(ed => ed.id !== edge.id));
      startTransition(() => { deleteStoreEdge(edge.id); });
    }
  }

  async function commitNode() {
    if (!nodeDialog) return;
    const { svgX, svgY, type, category } = nodeDialog;
    const label = type === "START" ? "Wejście" : type === "STOP" ? "Kasy" : category;
    const result = await upsertStoreNode(store.id, {
      label, type,
      category: type === "CATEGORY" ? category : null,
      x: svgX, y: svgY,
    });
    setNodes(prev => [...prev, {
      id: result.id, storeId: store.id, label, type,
      category: type === "CATEGORY" ? category : null,
      x: svgX, y: svgY,
    }]);
    setNodeDialog(null);
  }

  async function commitEdge() {
    if (!weightDialog) return;
    const weight = parseFloat(weightValue) || 1;
    const result = await upsertStoreEdge(store.id, {
      fromId: weightDialog.fromId,
      toId: weightDialog.toId,
      weight,
    });
    setEdges(prev => [...prev, {
      id: result.id, storeId: store.id,
      fromId: weightDialog.fromId,
      toId: weightDialog.toId,
      weight,
    }]);
    setWeightDialog(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPendingEdge(null);
        setNodeDialog(null);
        setWeightDialog(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function switchMode(m: EditorMode) {
    setMode(m);
    setPendingEdge(null);
    setNodeDialog(null);
    setWeightDialog(null);
  }

  const pendingFromNode = pendingEdge ? nodes.find(n => n.id === pendingEdge.fromId) : null;

  const toolbarHint =
    mode === "select"  ? "Przeciągnij węzeł, aby go przenieść" :
    mode === "addNode" ? "Kliknij na kanwę, aby dodać węzeł" :
    mode === "addEdge" && !pendingEdge ? "Kliknij pierwszy węzeł" :
    mode === "addEdge" ? "Kliknij drugi węzeł" :
    "Kliknij węzeł lub krawędź, aby usunąć";

  const canvasCursor =
    mode === "addNode"  ? "crosshair" :
    mode === "delete"   ? "pointer" :
    draggingId          ? "grabbing" :
    "default";

  // Compute dialog positions at render time (refs are stable)
  const nodeDialogPos  = nodeDialog   ? svgToContainer(nodeDialog.svgX, nodeDialog.svgY) : null;
  const weightToNode   = weightDialog ? nodes.find(n => n.id === weightDialog.toId) : null;
  const weightDialogPos = weightToNode ? svgToContainer(weightToNode.x, weightToNode.y) : null;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-2 flex-shrink-0 border-b"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        {([
          { m: "select"  as EditorMode, label: "Zaznacz",     icon: <MousePointer size={16} /> },
          { m: "addNode" as EditorMode, label: "Dodaj węzeł", icon: <Plus size={16} /> },
          { m: "addEdge" as EditorMode, label: "Połącz",      icon: <GitBranch size={16} /> },
          { m: "delete"  as EditorMode, label: "Usuń",        icon: <Trash2 size={16} /> },
        ]).map(btn => (
          <button
            key={btn.m}
            onClick={() => switchMode(btn.m)}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm min-h-[44px]"
            style={{
              backgroundColor: mode === btn.m ? "var(--bg-hover)" : "transparent",
              color:           mode === btn.m ? "var(--text-primary)" : "var(--text-secondary)",
              border:          mode === btn.m ? "1px solid var(--border)" : "1px solid transparent",
            }}
            title={btn.label}
          >
            {btn.icon}
            <span className="hidden sm:inline text-xs">{btn.label}</span>
          </button>
        ))}
        <span className="ml-auto text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
          {toolbarHint}
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            touchAction: "none",
            backgroundColor: "var(--bg-base)",
            cursor: canvasCursor,
            display: "block",
            maxWidth: "100%",
          }}
          onPointerDown={handleSVGPointerDown}
          onPointerMove={handleSVGPointerMove}
          onPointerUp={handleSVGPointerUp}
        >
          {/* Grid */}
          <defs>
            <pattern id="editor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="var(--border)" opacity="0.4" />
            </pattern>
          </defs>
          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#editor-grid)" />

          {/* Edges */}
          {edges.map(edge => {
            const from = nodes.find(n => n.id === edge.fromId);
            const to   = nodes.find(n => n.id === edge.toId);
            if (!from || !to) return null;
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const isFlashing = flashIds.has(edge.id);
            return (
              <g
                key={edge.id}
                onPointerDown={e => handleEdgePointerDown(e, edge)}
                style={{ cursor: mode === "delete" ? "pointer" : "default" }}
              >
                {/* Wide invisible stroke for easy touch/click */}
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={20} />
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={isFlashing ? "#ef4444" : "#555"}
                  strokeWidth={mode === "delete" ? 3 : 2}
                />
                <rect x={mx - 14} y={my - 9} width={28} height={18} rx={4}
                  fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth={1} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={10}
                  fill="var(--text-secondary)" style={{ pointerEvents: "none", userSelect: "none" }}>
                  {edge.weight}
                </text>
              </g>
            );
          })}

          {/* Pending edge preview */}
          {pendingEdge && pendingFromNode && (
            <line
              x1={pendingFromNode.x} y1={pendingFromNode.y}
              x2={pendingEdge.toX}   y2={pendingEdge.toY}
              stroke="#60a5fa" strokeWidth={2} strokeDasharray="6 4"
              style={{ pointerEvents: "none", animation: "dash 0.5s linear infinite" }}
            />
          )}

          {/* Nodes */}
          {nodes.map(node => {
            const color       = nodeColor(node);
            const emoji       = nodeEmoji(node);
            const label       = nodeLabel(node);
            const isFlashing  = flashIds.has(node.id);
            const isPendingFrom = pendingEdge?.fromId === node.id;
            return (
              <g
                key={node.id}
                onPointerDown={e => handleNodePointerDown(e, node)}
                style={{
                  cursor: mode === "select" ? (draggingId === node.id ? "grabbing" : "grab") : mode === "delete" ? "pointer" : "crosshair",
                  userSelect: "none",
                }}
              >
                {isPendingFrom && (
                  <circle cx={node.x} cy={node.y} r={NODE_RADIUS + 7}
                    fill="none" stroke="#60a5fa" strokeWidth={2} strokeDasharray="5 3" />
                )}
                <circle
                  cx={node.x} cy={node.y} r={NODE_RADIUS}
                  fill={isFlashing ? "#ef4444" : color}
                  stroke={isFlashing ? "#fff" : color}
                  strokeWidth={2}
                />
                {node.type === "START" && (
                  <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={18} fill="#fff" style={{ pointerEvents: "none" }}>🚪</text>
                )}
                {node.type === "STOP" && (
                  <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={18} fill="#fff" style={{ pointerEvents: "none" }}>🛒</text>
                )}
                {node.type === "CATEGORY" && emoji && (
                  <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={16} style={{ pointerEvents: "none" }}>{emoji}</text>
                )}
                <text
                  x={node.x} y={node.y + NODE_RADIUS + 14}
                  textAnchor="middle" fontSize={11} fill="var(--text-secondary)"
                  style={{ pointerEvents: "none", userSelect: "none" }}>
                  {label}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(10, 10)">
            <rect x={0} y={0} width={120} height={64} rx={6}
              fill="var(--bg-elevated)" fillOpacity={0.92} stroke="var(--border)" strokeWidth={1} />
            <circle cx={16} cy={18} r={7} fill="#16a34a" />
            <text x={28} y={22} fontSize={10} fill="var(--text-secondary)">Wejście (START)</text>
            <circle cx={16} cy={36} r={7} fill="#dc2626" />
            <text x={28} y={40} fontSize={10} fill="var(--text-secondary)">Kasy (STOP)</text>
            <circle cx={16} cy={54} r={7} fill="#6b7280" />
            <text x={28} y={58} fontSize={10} fill="var(--text-secondary)">Kategoria</text>
          </g>
        </svg>

        {/* Node type dialog */}
        {nodeDialog && nodeDialogPos && (
          <NodeTypeDialog
            dialog={nodeDialog}
            existingNodes={nodes}
            pos={nodeDialogPos}
            onChange={setNodeDialog}
            onConfirm={commitNode}
            onCancel={() => setNodeDialog(null)}
          />
        )}

        {/* Edge weight dialog */}
        {weightDialog && weightDialogPos && (
          <WeightInputDialog
            fromLabel={nodeLabel(nodes.find(n => n.id === weightDialog.fromId) ?? { type: "CATEGORY", label: "?", id: "", storeId: "", category: null, x: 0, y: 0 })}
            toLabel={nodeLabel(nodes.find(n => n.id === weightDialog.toId) ?? { type: "CATEGORY", label: "?", id: "", storeId: "", category: null, x: 0, y: 0 })}
            pos={weightDialogPos}
            value={weightValue}
            onChange={setWeightValue}
            onConfirm={commitEdge}
            onCancel={() => setWeightDialog(null)}
          />
        )}
      </div>

      <style>{`@keyframes dash { to { stroke-dashoffset: -20; } }`}</style>
    </div>
  );
}

// ──── Dialogs ─────────────────────────────────────────────────────────────────

interface NodeTypeDialogProps {
  dialog: NodeDialog;
  existingNodes: StoreNodeData[];
  pos: { top: number; left: number };
  onChange: (d: NodeDialog) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function NodeTypeDialog({ dialog, existingNodes, pos, onChange, onConfirm, onCancel }: NodeTypeDialogProps) {
  const hasStart = existingNodes.some(n => n.type === "START");
  const hasStop  = existingNodes.some(n => n.type === "STOP");

  return (
    <div
      className="absolute z-50 rounded-lg p-3 min-w-[210px]"
      style={{
        top:  pos.top,
        left: pos.left,
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Typ węzła</p>
      <div className="flex gap-1 mb-2">
        {(["CATEGORY", "START", "STOP"] as const).map(t => {
          const disabled = (t === "START" && hasStart) || (t === "STOP" && hasStop);
          const label    = t === "START" ? "Wejście" : t === "STOP" ? "Kasy" : "Kategoria";
          return (
            <button
              key={t}
              disabled={disabled}
              onClick={() => onChange({ ...dialog, type: t })}
              className="flex-1 py-1.5 text-xs rounded"
              style={{
                backgroundColor: dialog.type === t ? "var(--bg-hover)" : "transparent",
                color: disabled ? "var(--text-muted)" : dialog.type === t ? "var(--text-primary)" : "var(--text-secondary)",
                border: dialog.type === t ? "1px solid var(--border)" : "1px solid transparent",
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {dialog.type === "CATEGORY" && (
        <select
          value={dialog.category}
          onChange={e => onChange({ ...dialog, category: e.target.value })}
          className="w-full text-xs rounded px-2 py-1.5 mb-2"
          style={{
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          {ALL_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{CATEGORY_META[cat].emoji} {cat}</option>
          ))}
        </select>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={onConfirm}
          className="flex-1 text-xs py-1.5 rounded font-medium"
          style={{ backgroundColor: "#16a34a", color: "var(--on-accent)" }}
        >
          Dodaj
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-xs py-1.5 rounded"
          style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

interface WeightInputDialogProps {
  fromLabel: string;
  toLabel: string;
  pos: { top: number; left: number };
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function WeightInputDialog({ fromLabel, toLabel, pos, value, onChange, onConfirm, onCancel }: WeightInputDialogProps) {
  return (
    <div
      className="absolute z-50 rounded-lg p-3 min-w-[190px]"
      style={{
        top:  pos.top,
        left: pos.left,
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>Waga krawędzi</p>
      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        {fromLabel} → {toLabel}
      </p>
      <input
        type="number"
        min={0.1}
        step={0.1}
        value={value}
        autoFocus
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onCancel(); }}
        className="w-full text-xs rounded px-2 py-1.5 mb-2"
        style={{
          backgroundColor: "var(--bg-surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      />
      <div className="flex gap-1.5">
        <button
          onClick={onConfirm}
          className="flex-1 text-xs py-1.5 rounded font-medium"
          style={{ backgroundColor: "#2563eb", color: "var(--on-accent)" }}
        >
          Połącz
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-xs py-1.5 rounded"
          style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
