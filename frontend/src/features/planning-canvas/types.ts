export type Endpoint = { node: string; port: string };
export type Port = {
  id: string;
  direction: "input" | "output";
  type: string;
  label: string;
};
export type CanvasNode = {
  id: string;
  kind: string;
  name: string;
  parentId?: string;
  params: Record<string, any>;
  position: { x: number; y: number };
  display?: {
    showLoser?: boolean;
    showSeeds?: boolean;
    collapsed?: boolean;
    hideDanglingInputs?: boolean;
    hideDanglingOutputs?: boolean;
  };
  ports?: Port[];
  capacity?: number | null;
  hiddenConnectedLoser?: boolean;
};
export type CanvasGraph = {
  schemaVersion: "canvas-v1" | "canvas-v2";
  stages?: { id: string; name: string; order: number; nodeIds: string[] }[];
  nodes: CanvasNode[];
  edges: { id: string; from: Endpoint; to: Endpoint }[];
};
export type Wave = {
  id: string;
  graphId: string;
  graphName?: string;
  stageId: string;
  stageName?: string;
  number: number;
  matchIds: string[];
  roundIds: string[];
  requiresWaveIds: string[];
};
export type WavePlan = {
  graphVersion: number;
  graphDigest: string;
  plannerVersion: string;
  waves: Wave[];
  rounds: { id: string; swissNodeId: string; number: number; waveId: string }[];
};
export type PlanningSession = {
  id: string;
  name: string;
  waveIds: string[];
  timeRange?: { startAt: string; endAt: string };
};
export const labels: Record<string, string> = {
  source: "参赛来源",
  match: "Match",
  swiss: "瑞士轮",
  pool: "Pool",
  expander: "展开器",
  selector: "选择器",
  generator: "种子生成器",
  subgraph: "子图",
};
export const typeLabels: Record<string, string> = {
  seat: "单席位",
  collection: "有序集合",
  "seed-map": "种子映射",
  "seed-template": "位置模板",
  "seat-or-collection": "席位 / 集合",
  "seed-sort": "映射 / 模板",
};
