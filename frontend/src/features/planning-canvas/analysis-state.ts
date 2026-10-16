import type { EditToken } from "./editor-state";
export type AnalysisState = { status: "unanalysed" | "pending" | "current" | "stale" | "failed"; token?: EditToken; requestId?: number; result?: any; error?: unknown };
export function beginAnalysis(previous: AnalysisState | null, token: EditToken, requestId: number): AnalysisState {
  return { ...previous, status: "pending", token, requestId, error: undefined };
}
export function acceptAnalysis(state: AnalysisState, token: EditToken, requestId: number, result: any): AnalysisState {
  if (state.requestId !== requestId || JSON.stringify(state.token) !== JSON.stringify(token)) return state;
  return { ...state, status: "current", result };
}
export function invalidateAnalysis(state: AnalysisState): AnalysisState {
  return { ...state, status: state.result ? "stale" : "unanalysed", requestId: undefined };
}
