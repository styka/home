import type { StoreNodeData, StoreEdgeData } from "@/types";

export function computeOptimalCategoryOrder(
  nodes: StoreNodeData[],
  edges: StoreEdgeData[],
  presentCategories: string[]
): string[] {
  if (!nodes.length || !presentCategories.length) return presentCategories;

  const startNode = nodes.find(n => n.type === "START");
  const stopNode = nodes.find(n => n.type === "STOP");
  if (!startNode || !stopNode) return presentCategories;

  const n = nodes.length;
  const nodeIdx = new Map(nodes.map((nd, i) => [nd.id, i]));

  const dist: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity))
  );
  for (const e of edges) {
    const fi = nodeIdx.get(e.fromId);
    const ti = nodeIdx.get(e.toId);
    if (fi === undefined || ti === undefined) continue;
    const w = e.weight;
    if (w < dist[fi][ti]) { dist[fi][ti] = w; dist[ti][fi] = w; }
  }

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (!isFinite(dist[i][k])) continue;
      for (let j = 0; j < n; j++) {
        const via = dist[i][k] + dist[k][j];
        if (via < dist[i][j]) dist[i][j] = via;
      }
    }
  }

  const si = nodeIdx.get(startNode.id)!;
  const ti = nodeIdx.get(stopNode.id)!;

  const catSet = new Set(presentCategories);
  const reqNodes = nodes.filter(nd => nd.type === "CATEGORY" && nd.category && catSet.has(nd.category));
  if (!reqNodes.length) return presentCategories;

  const reqIdxs = reqNodes.map(nd => nodeIdx.get(nd.id)!);
  const k = reqIdxs.length;

  const INF = Infinity;
  const dp: number[][] = Array.from({ length: 1 << k }, () => new Array(k).fill(INF));
  const par: number[][] = Array.from({ length: 1 << k }, () => new Array(k).fill(-1));

  for (let i = 0; i < k; i++) dp[1 << i][i] = dist[si][reqIdxs[i]];

  for (let mask = 1; mask < (1 << k); mask++) {
    for (let i = 0; i < k; i++) {
      if (!(mask & (1 << i)) || !isFinite(dp[mask][i])) continue;
      for (let j = 0; j < k; j++) {
        if (mask & (1 << j)) continue;
        const nm = mask | (1 << j);
        const nc = dp[mask][i] + dist[reqIdxs[i]][reqIdxs[j]];
        if (nc < dp[nm][j]) { dp[nm][j] = nc; par[nm][j] = i; }
      }
    }
  }

  const full = (1 << k) - 1;
  let bestCost = INF, bestLast = -1;
  for (let i = 0; i < k; i++) {
    if (!isFinite(dp[full][i])) continue;
    // Include distance to STOP if reachable, otherwise just optimize path from START
    const toStop = isFinite(dist[reqIdxs[i]][ti]) ? dist[reqIdxs[i]][ti] : 0;
    const c = dp[full][i] + toStop;
    if (c < bestCost) { bestCost = c; bestLast = i; }
  }

  if (bestLast === -1) return presentCategories;

  const path: number[] = [];
  let mask = full, curr = bestLast;
  while (curr !== -1) {
    path.unshift(curr);
    const prev = par[mask][curr];
    mask ^= (1 << curr);
    curr = prev;
  }

  const ordered = path.map(i => reqNodes[i].category!);
  const unmapped = presentCategories.filter(c => !ordered.includes(c));
  return [...ordered, ...unmapped];
}
