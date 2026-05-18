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

interface StoreMapEditorProps {
  store: StoreWithGraph;
}

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  "Produce":             { emoji: "🥕", color: "#16a34a" },
  "Dairy & Eggs":        { emoji: "🧀", color: "#ca8a04" },
  "Meat & Fish":         { emoji: "🥩", color: "#dc2626" },
  "Bakery":              { emoji: "🍞", color: "#d97706" },
  "Dry Goods & Pasta":   { emoji: "🌾", color: "#92400e" },
  "Drinks":              { emoji: "🍺", color: "#2563eb" },
  "Frozen":              { emoji: "🧊", color: "#0891b2" },
  "Snacks & Sweets":     { emoji: "🍫", color: "#c026d3" },
  "Condiments & Oils":   { emoji: "🫙", color: "#65a30d" },
  "Spices & Herbs":      { emoji: "🌿", color: "#059669" },
  "Cleaning & Hygiene":  { emoji: "🧴", color: "#7c3aed" },
  "Canned & Preserved":  { emoji: "🥫", color: "#b45309" },
  "Other":               { emoji: "📦", color: "#6b7280" },
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

interface PendingNode {
  x: number;
  y: number;
}

interface PendingEdge {
  fromId: string;
  toX: number;
  toY: number;
}

interface WeightDialog {
  fromId: string;
  toId: string;
  x: number;
  y: number;
}

interface NodeDialog {
  x: number;
  y: number;
  type: "START" | "STOP" | "CATEGORY";
  category: string;
}

export function StoreMapEditor({ store }: StoreMapEditorProps) {
  const [nodes, setNodes] = useState<StoreNodeData[]>(store.nodes);
  const [edges, setEdges] = useState<StoreEdgeData[]>(store.edges);
  const [mode, setMode] = useState<EditorMode>("select");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pendingNode, setPendingNode] = useState<PendingNode | null>(null);
  const [nodeDialog, setNodeDialog] = useState<NodeDialog | null>(null);
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);
  const [weightDialog, setWeightDialog] = useState<WeightDialog | null>(null);
  const [weightValue, setWeightValue] = useState("1");
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [, startTransition] = useTransition();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function getSVGPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function flash(id: string) {
    setFlashIds((prev: Set<string>) => new Set(Array.from(prev).concat(id)));
    setTimeout(() => setFlashIds((prev: Set<string>) => {
      const next = new Set(Array.from(prev));
      next.delete(id);
      return next;
    }), 300);
  }

  const handleSVGPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === "svg") {
      if (mode === "addNode") {
        const pt = getSVGPoint(e.clientX, e.clientY);
        setPendingNode({ x: pt.x, y: pt.y });
        setNodeDialog({ x: pt.x, y: pt.y, type: "CATEGORY", category: ALL_CATEGORIES[0] });
      } else if (mode === "addEdge" && pendingEdge) {
        setPendingEdge(null);
      }
    }
  }, [mode, pendingEdge]);

  const handleSVGPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const pt = getSVGPoint(e.clientX, e.clientY);
    setCursorPos(pt);

    if (draggingId) {
      setNodes(prev => prev.map(n =>
        n.id === draggingId
          ? { ...n, x: pt.x - dragOffset.x, y: pt.y - dragOffset.y }
          : n
      ));
    }
    if (pendingEdge) {
      setPendingEdge(prev => prev ? { ...prev, toX: pt.x, toY: pt.y } : null);
    }
  }, [draggingId, dragOffset, pendingEdge]);

  const handleSVGPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingId) {
      const node = nodes.find(n => n.id === draggingId);
      if (node) {
        startTransition(() => {
          upsertStoreNode(store.id, {
            id: node.id,
            label: node.label,
            type: node.type,
            category: node.category,
            x: node.x,
            y: node.y,
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
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } else if (mode === "addEdge") {
      if (!pendingEdge) {
        const pt = getSVGPoint(e.clientX, e.clientY);
        setPendingEdge({ fromId: node.id, toX: pt.x, toY: pt.y });
      } else {
        if (pendingEdge.fromId !== node.id) {
          setWeightDialog({ fromId: pendingEdge.fromId, toId: node.id, x: node.x, y: node.y });
          setWeightValue("1");
          setPendingEdge(null);
        }
      }
    } else if (mode === "delete") {
      flash(node.id);
      startTransition(() => { deleteStoreNode(node.id); });
      setNodes(prev => prev.filter(n => n.id !== node.id));
      setEdges(prev => prev.filter(ed => ed.fromId !== node.id && ed.toId !== node.id));
    }
  }

  function handleEdgeClick(edge: StoreEdgeData) {
    if (mode === "delete") {
      flash(edge.id);
      startTransition(() => { deleteStoreEdge(edge.id); });
      setEdges(prev => prev.filter(ed => ed.id !== edge.id));
    }
  }

  async function commitNode() {
    if (!nodeDialog) return;
    const { x, y, type, category } = nodeDialog;
    const label = type === "START" ? "Wejście" : type === "STOP" ? "Kasy" : category;
    const result = await upsertStoreNode(store.id, {
      label,
      type,
      category: type === "CATEGORY" ? category : null,
      x,
      y,
    });
    const newNode: StoreNodeData = {
      id: result.id,
      storeId: store.id,
      label,
      type,
      category: type === "CATEGORY" ? category : null,
      x,
      y,
    };
    setNodes(prev => [...prev, newNode]);
    setNodeDialog(null);
    setPendingNode(null);
  }

  async function commitEdge() {
    if (!weightDialog) return;
    const weight = parseFloat(weightValue) || 1;
    const result = await upsertStoreEdge(store.id, {
      fromId: weightDialog.fromId,
      toId: weightDialog.toId,
      weight,
    });
    const newEdge: StoreEdgeData = {
      id: result.id,
      storeId: store.id,
      fromId: weightDialog.fromId,
      toId: weightDialog.toId,
      weight,
    };
    setEdges(prev => [...prev, newEdge]);
    setWeightDialog(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPendingEdge(null);
        setNodeDialog(null);
        setPendingNode(null);
        setWeightDialog(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toolbarButtons: Array<{ mode: EditorMode; label: string; icon: ReturnType<typeof MousePointer> }> = [
    { mode: "select",  label: "Zaznacz",     icon: <MousePointer size={16} /> },
    { mode: "addNode", label: "Dodaj węzeł", icon: <Plus size={16} /> },
    { mode: "addEdge", label: "Połącz",      icon: <GitBranch size={16} /> },
    { mode: "delete",  label: "Usuń",        icon: <Trash2 size={16} /> },
  ];

  const pendingFromNode = pendingEdge ? nodes.find(n => n.id === pendingEdge.fromId) : null;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-2 flex-shrink-0 border-b"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        {toolbarButtons.map(btn => (
          <button
            key={btn.mode}
            onClick={() => { setMode(btn.mode); setPendingEdge(null); setNodeDialog(null); setWeightDialog(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm min-w-[44px] min-h-[44px]"
            style={{
              backgroundColor: mode === btn.mode ? "var(--bg-hover)" : "transparent",
              color: mode === btn.mode ? "var(--text-primary)" : "var(--text-secondary)",
              border: mode === btn.mode ? "1px solid var(--border)" : "1px solid transparent",
            }}
            title={btn.label}
          >
            {btn.icon}
            <span className="hidden sm:inline text-xs">{btn.label}</span>
          </button>
        ))}
        <div className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          {mode === "select" && "Przeciągnij węzeł, aby go przenieść"}
          {mode === "addNode" && "Kliknij na mapę, aby dodać węzeł"}
          {mode === "addEdge" && !pendingEdge && "Kliknij pierwszy węzeł"}
          {mode === "addEdge" && pendingEdge && "Kliknij drugi węzeł"}
          {mode === "delete" && "Kliknij węzeł lub krawędź, aby usunąć"}
        </div>
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
            cursor: mode === "addNode" ? "crosshair" : mode === "delete" ? "pointer" : "default",
            display: "block",
            maxWidth: "100%",
          }}
          onPointerDown={handleSVGPointerDown}
          onPointerMove={handleSVGPointerMove}
          onPointerUp={handleSVGPointerUp}
        >
          {/* Grid dots */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="var(--border)" opacity="0.4" />
            </pattern>
          </defs>
          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />

          {/* Edges */}
          {edges.map(edge => {
            const from = nodes.find(n => n.id === edge.fromId);
            const to = nodes.find(n => n.id === edge.toId);
            if (!from || !to) return null;
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const isFlashing = flashIds.has(edge.id);
            return (
              <g key={edge.id} onClick={() => handleEdgeClick(edge)} style={{ cursor: mode === "delete" ? "pointer" : "default" }}>
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={isFlashing ? "#ef4444" : "#555"}
                  strokeWidth={mode === "delete" ? 6 : 2}
                  strokeOpacity={isFlashing ? 1 : 0.8}
                />
                <rect
                  x={mx - 14} y={my - 9} width={28} height={18}
                  rx={4} fill="var(--bg-elevated)"
                  stroke="var(--border)" strokeWidth={1}
                />
                <text
                  x={mx} y={my + 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--text-secondary)"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {edge.weight}
                </text>
              </g>
            );
          })}

          {/* Pending edge dashed line */}
          {pendingEdge && pendingFromNode && (
            <line
              x1={pendingFromNode.x} y1={pendingFromNode.y}
              x2={pendingEdge.toX} y2={pendingEdge.toY}
              stroke="#60a5fa"
              strokeWidth={2}
              strokeDasharray="6 4"
              style={{ animation: "dash 0.5s linear infinite", pointerEvents: "none" }}
            />
          )}

          {/* Nodes */}
          {nodes.map(node => {
            const color = nodeColor(node);
            const emoji = nodeEmoji(node);
            const label = nodeLabel(node);
            const isFlashing = flashIds.has(node.id);
            const isPendingFrom = pendingEdge?.fromId === node.id;

            return (
              <g
                key={node.id}
                onPointerDown={e => handleNodePointerDown(e, node)}
                style={{ cursor: mode === "select" ? "grab" : mode === "delete" ? "pointer" : "crosshair", userSelect: "none" }}
              >
                {isPendingFrom && (
                  <circle
                    cx={node.x} cy={node.y} r={NODE_RADIUS + 6}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                  />
                )}
                <circle
                  cx={node.x} cy={node.y} r={NODE_RADIUS}
                  fill={isFlashing ? "#ef4444" : color}
                  fillOpacity={isFlashing ? 1 : 0.9}
                  stroke={isFlashing ? "#ffffff" : color}
                  strokeWidth={2}
                />
                {node.type === "START" && (
                  <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={18} fill="#fff" style={{ pointerEvents: "none", userSelect: "none" }}>🚪</text>
                )}
                {node.type === "STOP" && (
                  <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={18} fill="#fff" style={{ pointerEvents: "none", userSelect: "none" }}>🛒</text>
                )}
                {node.type === "CATEGORY" && emoji && (
                  <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={16} style={{ pointerEvents: "none", userSelect: "none" }}>{emoji}</text>
                )}
                <text
                  x={node.x} y={node.y + NODE_RADIUS + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text-secondary)"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(10, 10)">
            <rect x={0} y={0} width={110} height={64} rx={6} fill="var(--bg-elevated)" fillOpacity={0.9} stroke="var(--border)" strokeWidth={1} />
            <circle cx={16} cy={18} r={7} fill="#16a34a" />
            <text x={28} y={22} fontSize={10} fill="var(--text-secondary)">Wejście (START)</text>
            <circle cx={16} cy={36} r={7} fill="#dc2626" />
            <text x={28} y={40} fontSize={10} fill="var(--text-secondary)">Kasy (STOP)</text>
            <circle cx={16} cy={54} r={7} fill="#6b7280" />
            <text x={28} y={58} fontSize={10} fill="var(--text-secondary)">Kategoria</text>
          </g>
        </svg>

        {/* Node type dialog */}
        {nodeDialog && (
          <NodeTypeDialog
            dialog={nodeDialog}
            existingNodes={nodes}
            onChange={setNodeDialog}
            onConfirm={commitNode}
            onCancel={() => { setNodeDialog(null); setPendingNode(null); }}
          />
        )}

        {/* Weight dialog */}
        {weightDialog && (
          <WeightInputDialog
            dialog={weightDialog}
            nodes={nodes}
            value={weightValue}
            onChange={setWeightValue}
            onConfirm={commitEdge}
            onCancel={() => setWeightDialog(null)}
          />
        )}
      </div>

      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
      `}</style>
    </div>
  );
}

interface NodeTypeDialogProps {
  dialog: NodeDialog;
  existingNodes: StoreNodeData[];
  onChange: (d: NodeDialog) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function NodeTypeDialog({ dialog, existingNodes, onChange, onConfirm, onCancel }: NodeTypeDialogProps) {
  const hasStart = existingNodes.some(n => n.type === "START");
  const hasStop = existingNodes.some(n => n.type === "STOP");

  return (
    <div
      className="absolute z-50 rounded-lg p-3 min-w-[200px]"
      style={{
        top: Math.min(dialog.y * 0.8 + 60, window.innerHeight - 250),
        left: Math.min(dialog.x * 0.8 + 10, window.innerWidth - 220),
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-primary)" }}>Typ węzła</p>
      <div className="flex gap-1 mb-2">
        {(["CATEGORY", "START", "STOP"] as const).map(t => {
          const disabled = (t === "START" && hasStart) || (t === "STOP" && hasStop);
          const label = t === "START" ? "Wejście" : t === "STOP" ? "Kasy" : "Kategoria";
          return (
            <button
              key={t}
              disabled={disabled}
              onClick={() => onChange({ ...dialog, type: t })}
              className="flex-1 py-1 text-xs rounded"
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
          className="w-full text-xs rounded px-2 py-1 mb-2"
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
      <div className="flex gap-1">
        <button
          onClick={onConfirm}
          className="flex-1 text-xs py-1 rounded"
          style={{ backgroundColor: "#16a34a", color: "#fff" }}
        >
          Dodaj
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-xs py-1 rounded"
          style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

interface WeightInputDialogProps {
  dialog: WeightDialog;
  nodes: StoreNodeData[];
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function WeightInputDialog({ dialog, nodes, value, onChange, onConfirm, onCancel }: WeightInputDialogProps) {
  const toNode = nodes.find(n => n.id === dialog.toId);
  const fromNode = nodes.find(n => n.id === dialog.fromId);

  return (
    <div
      className="absolute z-50 rounded-lg p-3 min-w-[180px]"
      style={{
        top: Math.min((toNode?.y ?? dialog.y) * 0.8 + 60, window.innerHeight - 180),
        left: Math.min((toNode?.x ?? dialog.x) * 0.8 + 10, window.innerWidth - 200),
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-primary)" }}>Waga krawędzi</p>
      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        {nodeLabel(fromNode!) || "?"} → {nodeLabel(toNode!) || "?"}
      </p>
      <input
        type="number"
        min={0.1}
        step={0.1}
        value={value}
        autoFocus
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onCancel(); }}
        className="w-full text-xs rounded px-2 py-1 mb-2"
        style={{
          backgroundColor: "var(--bg-surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      />
      <div className="flex gap-1">
        <button
          onClick={onConfirm}
          className="flex-1 text-xs py-1 rounded"
          style={{ backgroundColor: "#2563eb", color: "#fff" }}
        >
          Połącz
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-xs py-1 rounded"
          style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
