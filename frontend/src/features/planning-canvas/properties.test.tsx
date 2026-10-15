import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Properties } from "./properties";
import { catalog } from "../configuration/format-catalog.fixture";
import type { CanvasNode, CanvasGraph } from "./types";

afterEach(cleanup);
test.each(["selector-top", "selector-random"])(
  "%s has a fixed mode and optional complement",
  (kind) => {
    const { action } = setup(kind, {
      count: 2,
      showComplement: false,
      ...(kind === "selector-random"
        ? { seed: 42, algorithm: "mulberry32-v1" }
        : {}),
    });
    expect(screen.queryByLabelText("模式")).toBeNull();
    expect(screen.getByLabelText("数量 K")).toHaveValue(2);
    fireEvent.click(screen.getByLabelText("展示补集"));
    expect(action).toHaveBeenLastCalledWith({
      type: "update",
      id: "internal-node",
      params: { showComplement: true },
    });
    if (kind === "selector-random")
      expect(screen.getByLabelText("随机数种子")).toHaveValue(42);
    else expect(screen.queryByLabelText("随机数种子")).toBeNull();
  },
);
test("expander presents complete readonly derived properties and no count input", () => {
  const { props, rerender } = setup("expander");
  expect(screen.getByLabelText("展开数量")).toHaveTextContent("待解析");
  expect(screen.queryByRole("spinbutton")).toBeNull();
  expect(screen.getByLabelText("状态")).toHaveTextContent("等待集合输入");
  const readOnlyProperties = ["展开数量", "来源集合数量", "输出席位数"].map(
    (label, i) => ({ key: String(i), label, value: 5 }),
  );
  rerender(
    <Properties
      {...props}
      analysis={{ nodes: [{ ...props.node, capacity: 5, readOnlyProperties }] }}
    />,
  );
  expect(screen.getByLabelText("展开数量")).toHaveTextContent("5");
  expect(screen.getByLabelText("来源集合数量")).toHaveTextContent("5");
  expect(screen.getByLabelText("输出席位数")).toHaveTextContent("5");
});
test("elimination Match edits only its match format without result or time controls", () => {
  const { action } = setup("match", {
    matchFormat: "bo3",
  });
  fireEvent.change(screen.getByLabelText("单场赛制"), {
    target: { value: "bo1" },
  });
  expect(action).toHaveBeenLastCalledWith({
    type: "update",
    id: "internal-node",
    params: { matchFormat: "bo1" },
  });
  expect(screen.queryByText("赛果列表")).toBeNull();
  expect(screen.queryByLabelText("平")).toBeNull();
  expect(screen.queryByLabelText("双败")).toBeNull();
  expect(screen.queryByLabelText("预计开始时间")).toBeNull();
  expect(screen.queryByLabelText("BO")).toBeNull();
  expect(screen.queryByLabelText("胜败来源规则")).toBeNull();
});
function setup(kind = "swiss", params: Record<string, any> = {}) {
  const node: CanvasNode = {
    id: "internal-node",
    name: "测试组件",
    kind,
    position: { x: 123, y: 456 },
    parentId: "parent",
    params:
      kind === "swiss"
        ? {
            ruleVersion: "swiss-fixed-v1",
            parameters: {},
            ranking: "complete-v1",
            ...params,
          }
        : params,
  };
  const graph: CanvasGraph = {
    schemaVersion: "canvas-v2",
    nodes: [node],
    edges: [],
  };
  const action = vi.fn(async () => {});
  const props = {
    node,
    graph,
    formats: catalog.formats,
    matchFormats: [
      { id: "bo1", label: "BO1", bestOf: 1 },
      { id: "bo3", label: "BO3", bestOf: 3 },
    ],
    analysis: { nodes: [node] },
    onAction: action,
    disabled: false,
  };
  return { ...render(<Properties {...props} />), node, action, props };
}

test("common name editor hides internal identity and applies without changing position", () => {
  const { action, node } = setup();
  expect(screen.queryByText(/稳定标识/)).toBeNull();
  fireEvent.change(screen.getByLabelText("名称"), {
    target: { value: "新名称" },
  });
  expect(action).toHaveBeenCalledWith({
    type: "update",
    id: node.id,
    name: "新名称",
  });
  expect(node.position).toEqual({ x: 123, y: 456 });
});

test("Swiss opens only common settings with advanced rules collapsed", () => {
  const { container } = setup();
  expect(screen.getByLabelText("轮数")).toBeVisible();
  expect(screen.getByLabelText("人数")).toBeVisible();
  expect(screen.queryByLabelText("晋级胜场阈值")).toBeNull();
  expect(screen.getByText("高级规则").closest("details")).not.toHaveAttribute(
    "open",
  );
  expect(
    screen.getByRole("list", { name: "同分顺序", hidden: true }),
  ).not.toBeVisible();
  expect(container.querySelectorAll('select[aria-label^="第 "]')).toHaveLength(
    0,
  );
  expect(screen.queryByRole("button", { name: /^应用属性$/ })).toBeNull();
});

test("Swiss capacity applies independently and keeps round overrides", () => {
  const { action } = setup("swiss", {
    parameters: { roundCount: 4, overrides: { rounds: { "2": 3 } } },
  });
  fireEvent.change(screen.getByLabelText("人数"), { target: { value: "12" } });
  expect(action).toHaveBeenLastCalledWith({
    type: "update",
    id: "internal-node",
    params: { participantCount: 12 },
  });
});

test("round-robin properties expose cycle choice and ordered Chinese tiebreakers", () => {
  const { action } = setup("round-robin", {
    ruleVersion: "round-robin-v2",
    ranking: "complete-v1",
    parameters: {},
  });
  fireEvent.change(screen.getByLabelText("循环方式"), {
    target: { value: "double-round-robin-v2" },
  });
  expect(action).toHaveBeenLastCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({ ruleVersion: "double-round-robin-v2" }),
    }),
  );
  fireEvent.click(screen.getByText("高级规则"));
  const order = screen.getByRole("list", { name: "同分顺序" });
  expect(within(order).getByText("相互战绩")).toBeVisible();
  expect(
    screen.queryByDisplayValue(
      "points, head-to-head-v1, netGames, manual-with-reason",
    ),
  ).toBeNull();
  fireEvent.click(within(order).getByRole("button", { name: "下移相互战绩" }));
  expect(
    (action.mock.calls.at(-1) as any)[0].params.parameters.tiebreakers,
  ).toEqual(["points", "netGames", "head-to-head-v1", "manual-with-reason"]);
});

test("draw score is hidden while disabled and restored when enabled", () => {
  setup();
  fireEvent.click(screen.getByText("高级规则"));
  expect(screen.queryByLabelText("平", { exact: true })).toBeNull();
  fireEvent.click(screen.getByLabelText("允许平局"));
  expect(screen.getByLabelText("平", { exact: true })).toHaveValue(1);
});

test("switching to a fixed-capacity Swiss rule replaces an incompatible planned count", () => {
  const { action } = setup("swiss", { participantCount: 12 });
  fireEvent.click(screen.getByText("高级规则"));
  fireEvent.change(screen.getByLabelText("瑞士规则版本"), {
    target: { value: "major-cologne-2026-v1" },
  });
  expect((action.mock.calls.at(-1) as any)[0].params.participantCount).toBe(16);
  expect(screen.queryByLabelText("人数")).toBeNull();
});

test("incomplete ranking can adopt the complete ranking contract", () => {
  const { action } = setup("swiss", { ranking: "" });
  fireEvent.click(screen.getByRole("button", { name: "采用完整排名" }));
  expect(action).toHaveBeenLastCalledWith({
    type: "update",
    id: "internal-node",
    params: { ranking: "complete-v1" },
  });
});

test("round overrides add only requested rounds and can be removed without losing other parameters", () => {
  const { action } = setup("swiss", {
    parameters: { roundCount: 5, overrides: { rounds: { "2": 3 } } },
  });
  fireEvent.click(screen.getByText("高级规则"));
  fireEvent.click(screen.getByText("逐轮覆盖"));
  expect(screen.getByLabelText("第 2 轮 BO")).toHaveValue("3");
  expect(screen.queryByLabelText("第 64 轮 BO")).toBeNull();
  fireEvent.change(screen.getByLabelText("覆盖轮次"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "添加轮次覆盖" }));
  fireEvent.change(screen.getByLabelText("第 4 轮 BO"), {
    target: { value: "5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "移除第 2 轮覆盖" }));
  const update = action.mock.calls.at(-1) as any;
  expect(update[0].params.parameters.roundCount).toBe(5);
  expect(update[0].params.parameters.overrides.rounds).toEqual({ "4": 5 });
});

test("nested default scores survive a partial score edit", () => {
  const { action } = setup("swiss", {
    parameters: { allowDraw: true, points: { win: 2 } },
  });
  fireEvent.click(screen.getByText("高级规则"));
  const points = screen.getByText("计分", { exact: true }).closest("fieldset")!;
  expect(within(points).getByLabelText("平")).toHaveValue(1);
  fireEvent.change(within(points).getByLabelText("负"), {
    target: { value: "1" },
  });
  expect((action.mock.calls.at(-1) as any)[0].params.parameters.points).toEqual(
    { win: 2, draw: 1, loss: 1, doubleLoss: 0 },
  );
});

test("rule changes clear old overrides and honor fixed boolean values", () => {
  const { action } = setup("swiss", {
    parameters: { roundCount: 8, overrides: { rounds: { "2": 5 } } },
  });
  fireEvent.change(screen.getByLabelText("瑞士规则版本"), {
    target: { value: "major-cologne-2026-v1" },
  });
  fireEvent.click(screen.getByText("高级规则"));
  expect(screen.queryByLabelText("允许平局")).toBeNull();
  expect(screen.getByText("允许平局：不允许（规则固定）")).toBeVisible();
  expect((action.mock.calls.at(-1) as any)[0].params.parameters).toEqual({});
});

test.each(["generator"])(
  "%s only exposes random settings in random mode while preserving the seed",
  (kind) => {
    const { action } = setup(kind, {
      count: 4,
      mode: kind === "selector" ? "top" : "reverse",
      seed: 42,
      algorithm: "mulberry32-v1",
    });
    expect(screen.queryByLabelText("随机数种子")).toBeNull();
    fireEvent.change(screen.getByLabelText("模式"), {
      target: { value: "random" },
    });
    expect(screen.getByLabelText("随机数种子")).toHaveValue(42);
    expect((action.mock.calls.at(-1) as any)[0].params).toEqual({
      mode: "random",
    });
    expect(screen.getByLabelText("随机数种子")).toHaveValue(42);
  },
);

test.each([
  ["source", { seats: [{ ref: "A", label: "选手 A" }] }],
  ["match", { matchFormat: "bo3" }],
  ["pool", { inputs: ["in:1", "in:2"] }],
  ["expander", {}],
  ["subgraph", { boundaries: [], custom: true }],
])(
  "%s inherits the name editor and preserves its business properties",
  (kind, params) => {
    const { node, action } = setup(kind as string, params);
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "改名" },
    });
    const update = (action.mock.calls.at(-1) as any)[0];
    expect(update.name).toBe("改名");
    expect(update).not.toHaveProperty("position");
    expect(update).not.toHaveProperty("parentId");
    expect(update.params).toBeUndefined();
  },
);

test("a locked panel disables common and advanced inputs", () => {
  const { props, rerender } = setup();
  rerender(<Properties {...props} disabled />);
  expect(screen.queryByRole("button", { name: /^应用属性$/ })).toBeNull();
  expect(screen.getByLabelText("名称")).toBeDisabled();
  expect(screen.getByLabelText("轮数")).toBeDisabled();
  expect(
    screen
      .getByRole("list", { name: "同分顺序", hidden: true })
      .closest("fieldset"),
  ).toBeDisabled();
});
