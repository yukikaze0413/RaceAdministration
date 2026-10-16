import { expect, test } from "vitest";
import { EditorState } from "./editor-state";
const graph = () => ({ schemaVersion: "canvas" as const, stages: [], nodes: [], edges: [] });
test("async result ownership never reuses a revision after undo", () => {
  const state = new EditorState();
  const a = graph();
  state.replace(a, "one");
  const token = state.capture();
  state.commit({ ...a, nodes: [{ id: "m" }] } as any);
  state.commit(a);
  expect(state.matches(token)).toBe(false);
  state.replace(a, "two");
  expect(state.matches(state.capture())).toBe(true);
  expect(state.matches(token)).toBe(false);
});
test("dirty follows content and saved name, including undo to a saved snapshot", () => {
  const state = new EditorState();
  const a = graph();
  state.replace(a, "one");
  state.markSaved(a, "Saved");
  expect(state.dirty("Saved")).toBe(false);
  state.commit({ ...a, nodes: [{ id: "m" }] } as any);
  expect(state.dirty("Saved")).toBe(true);
  state.commit(a);
  expect(state.dirty("Saved")).toBe(false);
  expect(state.dirty("Rename")).toBe(true);
});
