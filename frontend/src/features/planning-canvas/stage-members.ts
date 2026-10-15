import type { CanvasGraph, CanvasNode } from "./types";

export function visibleNode(
  graph: CanvasGraph,
  id: string,
  scope: string | null = null,
) {
  let node = graph.nodes.find((n) => n.id === id);
  while (node?.parentId && node.parentId !== scope) {
    const parent = graph.nodes.find((n) => n.id === node!.parentId);
    if (!parent) break;
    node = parent;
  }
  return node;
}

export function expandStageMembers(
  graph: CanvasGraph,
  ids: string[],
): string[] {
  const included = new Set(ids);
  for (let changed = true; changed;) {
    changed = false;
    for (const n of graph.nodes) {
      if (n.parentId && included.has(n.parentId) && !included.has(n.id)) {
        included.add(n.id);
        changed = true;
      }
    }
  }
  return graph.nodes.filter((n) => included.has(n.id)).map((n) => n.id);
}

export function stageMemberSummary(graph: CanvasGraph, ids: string[]) {
  const entries = new Map<string, { node: CanvasNode; memberIds: string[] }>();
  for (const id of expandStageMembers(graph, ids)) {
    const node = visibleNode(graph, id)!;
    const entry = entries.get(node.id) ?? { node, memberIds: [] };
    entry.memberIds.push(id);
    entries.set(node.id, entry);
  }
  return [...entries.values()];
}
