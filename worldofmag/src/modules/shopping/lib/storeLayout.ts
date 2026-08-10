interface NodeDef { id: string; type: string }
interface EdgeDef { fromId: string; toId: string }

export function computeLayout(
  nodes: NodeDef[],
  edges: EdgeDef[],
  canvasW = 900,
  canvasH = 550,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return result;

  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.fromId)?.push(e.toId);
    adj.get(e.toId)?.push(e.fromId);
  }

  const startNode = nodes.find((n) => n.type === "START");
  const stopNode = nodes.find((n) => n.type === "STOP");

  const layers = new Map<string, number>();
  const visited = new Set<string>();

  if (startNode) {
    const queue: Array<[string, number]> = [[startNode.id, 0]];
    visited.add(startNode.id);
    while (queue.length > 0) {
      const item = queue.shift()!;
      const nodeId = item[0];
      const depth = item[1];
      layers.set(nodeId, depth);
      for (const neighbor of adj.get(nodeId) ?? []) {
        if (!visited.has(neighbor) && neighbor !== stopNode?.id) {
          visited.add(neighbor);
          queue.push([neighbor, depth + 1]);
        }
      }
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  let maxLayer = 0;
  Array.from(layers.entries()).forEach(([nodeId, layer]) => {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(nodeId);
    maxLayer = Math.max(maxLayer, layer);
  });

  const totalLayers = stopNode ? maxLayer + 2 : maxLayer + 1;

  const marginL = 80;
  const marginR = 80;
  const marginT = 60;
  const marginB = 60;
  const layerWidth = totalLayers > 1 ? (canvasW - marginL - marginR) / (totalLayers - 1) : 0;

  Array.from(layerGroups.entries()).forEach(([layer, nodeIds]) => {
    const x = marginL + layer * layerWidth;
    const usableH = canvasH - marginT - marginB;
    nodeIds.forEach((nodeId: string, i: number) => {
      const y = marginT + (usableH / nodeIds.length) * (i + 0.5);
      result.set(nodeId, { x, y });
    });
  });

  if (stopNode) {
    result.set(stopNode.id, { x: canvasW - marginR, y: canvasH / 2 });
  }

  const isolated = nodes.filter((n) => !visited.has(n.id) && n.id !== stopNode?.id);
  if (isolated.length > 0) {
    const step = (canvasW - marginL - marginR) / (isolated.length + 1);
    isolated.forEach((node, i) => {
      result.set(node.id, { x: marginL + step * (i + 1), y: canvasH - 36 });
    });
  }

  return result;
}
