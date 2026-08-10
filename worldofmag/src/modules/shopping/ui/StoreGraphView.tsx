"use client";

import { useState } from "react";
import type { StoreWithGraph, StoreNodeData, StoreEdgeData } from "@/types";

const CATEGORY_META: Record<string, { emoji: string }> = {
  "Warzywa i owoce":     { emoji: "🥕" },
  "Nabiał i jaja":       { emoji: "🧀" },
  "Mięso i ryby":        { emoji: "🥩" },
  "Piekarnia":           { emoji: "🍞" },
  "Suche produkty":      { emoji: "🌾" },
  "Napoje":              { emoji: "🍺" },
  "Mrożone":             { emoji: "🧊" },
  "Przekąski i słodycze": { emoji: "🍫" },
  "Przyprawy i oleje":   { emoji: "🫙" },
  "Zioła i przyprawy":   { emoji: "🌿" },
  "Chemia i higiena":    { emoji: "🧴" },
  "Konserwy i przetwory": { emoji: "🥫" },
  "Inne":                { emoji: "📦" },
};

function nodeEmoji(node: StoreNodeData): string {
  if (node.type === "START") return "🚪";
  if (node.type === "STOP") return "🛒";
  if (node.category && CATEGORY_META[node.category]) return CATEGORY_META[node.category].emoji;
  return "📦";
}

function nodeLabel(node: StoreNodeData): string {
  if (node.type === "START") return "Wejście";
  if (node.type === "STOP") return "Kasy";
  return node.label;
}

function nodeFill(node: StoreNodeData): string {
  if (node.type === "START") return "#166534";
  if (node.type === "STOP") return "#991b1b";
  return "#1e293b";
}

function nodeStroke(node: StoreNodeData): string {
  if (node.type === "START") return "#22c55e";
  if (node.type === "STOP") return "#ef4444";
  return "#475569";
}

interface EdgeMidpoint { x: number; y: number; dx: number; dy: number }

function edgeMidpoint(from: StoreNodeData, to: StoreNodeData): EdgeMidpoint {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { x: mx, y: my, dx, dy };
}

interface StoreGraphViewProps {
  store: StoreWithGraph;
  onRebuild?: () => void;
  canvasW?: number;
  canvasH?: number;
}

export function StoreGraphView({ store, onRebuild, canvasW = 900, canvasH = 550 }: StoreGraphViewProps) {
  const [editingEdge, setEditingEdge] = useState<{ id: string; weight: number } | null>(null);

  const nodeById = new Map<string, StoreNodeData>(
    (store.nodes as StoreNodeData[]).map((n) => [n.id, n])
  );

  const edges = store.edges as StoreEdgeData[];
  const nodes = store.nodes as StoreNodeData[];

  const NODE_R = 36;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <svg
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          style={{ width: "100%", minWidth: 320, display: "block" }}
          aria-label={`Mapa sklepu ${store.name}`}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
            </marker>
          </defs>

          {/* Background */}
          <rect width={canvasW} height={canvasH} fill="#0d1117" rx={12} />

          {/* Grid */}
          {Array.from({ length: 18 }, (_, i) => (
            <line key={`gx${i}`} x1={i * 50} y1={0} x2={i * 50} y2={canvasH} stroke="#1c2333" strokeWidth={1} />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <line key={`gy${i}`} x1={0} y1={i * 50} x2={canvasW} y2={i * 50} stroke="#1c2333" strokeWidth={1} />
          ))}

          {/* Edges */}
          {edges.map((edge) => {
            const from = nodeById.get(edge.fromId);
            const to = nodeById.get(edge.toId);
            if (!from || !to) return null;
            const mid = edgeMidpoint(from, to);
            const len = Math.sqrt(mid.dx * mid.dx + mid.dy * mid.dy);
            const ux = len > 0 ? mid.dx / len : 0;
            const uy = len > 0 ? mid.dy / len : 0;
            const x1 = from.x + ux * NODE_R;
            const y1 = from.y + uy * NODE_R;
            const x2 = to.x - ux * (NODE_R + 8);
            const y2 = to.y - uy * (NODE_R + 8);

            return (
              <g key={edge.id}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#334155"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
                {/* Weight label */}
                <rect
                  x={mid.x - 14} y={mid.y - 10}
                  width={28} height={20}
                  rx={4}
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth={1}
                />
                <text
                  x={mid.x} y={mid.y + 5}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#94a3b8"
                  fontFamily="monospace"
                >
                  {edge.weight}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x} cy={node.y} r={NODE_R}
                fill={nodeFill(node)}
                stroke={nodeStroke(node)}
                strokeWidth={2}
              />
              <text
                x={node.x} y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={26}
              >
                {nodeEmoji(node)}
              </text>
              <text
                x={node.x} y={node.y + NODE_R + 14}
                textAnchor="middle"
                fontSize={10}
                fill="#94a3b8"
                fontFamily="system-ui, sans-serif"
              >
                {nodeLabel(node)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Actions */}
      {onRebuild && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onRebuild}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🔄 Przebuduj mapę
          </button>
        </div>
      )}

      {/* Stats */}
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
        {nodes.length} węzłów · {edges.length} połączeń
      </p>
    </div>
  );
}
