import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StageProperties } from "./stages";
import type { CanvasGraph } from "./types";
afterEach(cleanup);
test("stage properties summarize packaged children and allow processing components", () => {
  const graph: CanvasGraph = {
    schemaVersion: "canvas",
    edges: [],
    nodes: [
      {
        id: "src",
        name: "参赛来源",
        kind: "source",
        params: {},
        position: { x: 0, y: 0 },
      },
      {
        id: "group",
        name: "八强子图",
        kind: "subgraph",
        params: {},
        position: { x: 0, y: 0 },
      },
      {
        id: "m",
        parentId: "group",
        name: "内部决赛",
        kind: "match",
        params: {},
        position: { x: 0, y: 0 },
      },
    ],
    stages: [{ id: "s", name: "阶段", order: 1, nodeIds: ["m"] }],
  };
  const action = vi.fn(async () => {});
  render(
    <StageProperties
      graph={graph}
      stage={graph.stages![0]}
      disabled={false}
      onAction={action}
    />,
  );
  fireEvent.change(screen.getByLabelText("阶段名称"), {
    target: { value: "自动阶段" },
  });
  expect(action).toHaveBeenLastCalledWith({
    type: "updateStage",
    id: "s",
    name: "自动阶段",
  });
  expect(screen.queryByRole("button", { name: "应用阶段属性" })).toBeNull();
  expect(screen.queryByText(/内部决赛/)).toBeNull();
  expect(screen.getByText(/八强子图/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("添加阶段成员"), {
    target: { value: "src" },
  });
  fireEvent.click(screen.getByRole("button", { name: "添加成员" }));
  expect(action).toHaveBeenCalledWith({
    type: "updateStage",
    id: "s",
    selected: ["m", "src"],
  });
  fireEvent.click(screen.getByRole("button", { name: "移除 group" }));
  expect(action).toHaveBeenCalledWith({
    type: "updateStage",
    id: "s",
    selected: [],
  });
});
