import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { CanvasView } from "./view";
import type { CanvasGraph } from "./types";
afterEach(cleanup);
const initial: CanvasGraph = {
  schemaVersion: "canvas-v1",
  nodes: [
    {
      id: "m",
      kind: "match",
      name: "决赛",
      params: { bestOf: 3 },
      position: { x: 40, y: 40 },
    },
  ],
  edges: [],
};
function Harness() {
  const [g, setG] = useState(initial),
    [selected, setSelected] = useState<string[]>([]);
  return (
    <CanvasView
      graph={g}
      analysis={{
        nodes: [
          {
            ...g.nodes[0],
            ports: [
              { id: "A", direction: "input", type: "seat", label: "A" },
              { id: "B", direction: "input", type: "seat", label: "B" },
              { id: "W", direction: "output", type: "seat", label: "W · 胜者" },
              { id: "L", direction: "output", type: "seat", label: "L · 败者" },
            ],
          },
        ],
      }}
      scope={null}
      selected={selected}
      onSelect={(id) => setSelected((s) => (s.includes(id) ? [] : [id]))}
      onEnter={() => {}}
      onPort={() => {}}
      onMove={(id, x, y) =>
        setG({
          ...g,
          nodes: g.nodes.map((n) =>
            n.id === id ? { ...n, position: { x, y } } : n,
          ),
        })
      }
    />
  );
}
test("canvas keyboard movement changes actual node position and selection while preserving match port meaning", () => {
  render(<Harness />);
  const move = screen.getByRole("button", { name: "决赛" });
  fireEvent.keyDown(move, { key: "ArrowRight" });
  expect(move.closest("article")).toHaveStyle({ left: "60px" });
  fireEvent.click(move, { ctrlKey: true });
  expect(move.closest("article")).toHaveClass("canvas-selected");
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.click(move, { ctrlKey: true });
  expect(move.closest("article")).not.toHaveClass("canvas-selected");
  fireEvent.keyDown(move.closest("article")!, { key: " ", ctrlKey: true });
  expect(move.closest("article")).toHaveClass("canvas-selected");
  fireEvent.click(screen.getByRole("button", { name: "多选模式" }));
  fireEvent.click(move);
  expect(move.closest("article")).not.toHaveClass("canvas-selected");
  expect(screen.getByRole("button", { name: "决赛 A 输入" })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "决赛 W · 胜者 输出" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "决赛 L · 败者 输出" }),
  ).toBeNull();
});
test("dangling output hiding preserves a seed port connected through a derived subgraph boundary", () => {
  const source = { id: "src", kind: "source", name: "来源", parentId: "sg", params: { seats: [{ ref: "A", label: "A" }] }, position: { x: 40, y: 40 }, display: { hideDanglingOutputs: true } };
  const graph: CanvasGraph = { schemaVersion: "canvas-v1", nodes: [source,
    { id: "sg", kind: "subgraph", name: "子图", params: { boundaries: [{ id: "out", direction: "output", type: "collection", name: "集合", target: { node: "src", port: "collection" } }] }, position: { x: 0, y: 0 } },
    { id: "p", kind: "pool", name: "P", params: { inputs: ["in:1"] }, position: { x: 400, y: 0 } },
  ], edges: [{ id: "seed", from: { node: "sg", port: "out:seeds" }, to: { node: "p", port: "sort" } }] };
  render(<CanvasView graph={graph} analysis={{ nodes: [{ ...source, ports: [
    { id: "collection", direction: "output", type: "collection", label: "初始席位集合" },
    { id: "seeds", direction: "output", type: "seed-map", label: "初始种子" },
  ] }] }} scope="sg" selected={[]} onSelect={() => {}} onEnter={() => {}} onPort={() => {}} onMove={() => {}} />);
  expect(screen.getByRole("button", { name: "来源 初始种子 输出" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "来源 初始席位集合 输出" })).toBeNull();
});
