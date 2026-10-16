export type Endpoint = { node: string; port: string };
export type Port = {
  id: string;
  direction: "input" | "output";
  type: string;
  label: string;
};
export interface CanvasNodeBase {
  id: string;
  name: string;
  parentId?: string;
  position: { x: number; y: number };
  display?: {
    showLoser?: boolean;
    showSeeds?: boolean;
    collapsed?: boolean;
    hideDanglingInputs?: boolean;
    hideDanglingOutputs?: boolean;
  };
}
export interface CanvasNode<
  Kind extends string = string,
  Parameters extends Record<string, any> = Record<string, any>,
> extends CanvasNodeBase {
  kind: Kind;
  params: Parameters;
  ports?: Port[];
  capacity?: number | null;
  hiddenConnectedLoser?: boolean;
  readOnlyProperties?: import("./readonly-properties").ReadOnlyProperty[];
}
export type CanvasGraph = {
  schemaVersion: "canvas";
  stages?: { id: string; name: string; order: number; nodeIds: string[] }[];
  stageNumbering?: { latest: number };
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
  rounds: {
    id: string;
    nodeId?: string;
    kind?: "swiss" | "round-robin";
    number: number;
    waveId: string;
  }[];
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
  "round-robin": "小组循环赛",
  pool: "Pool",
  expander: "展开器",
  "selector-top": "取前 K 名",
  "selector-random": "随机 K 名",
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
