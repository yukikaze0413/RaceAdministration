import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StageForms, RouteForms } from "./forms";
afterEach(cleanup);
it("stage form keeps stable IDs and incomplete draft capacities", () => {
  const payload = {
    stages: [
      {
        id: "stage-a",
        order: 1,
        capacity: null,
        formatIntent: null,
        groups: [],
      },
    ],
    pools: [],
    routes: [],
  };
  const onChange = vi.fn();
  render(<StageForms payload={payload} onChange={onChange} disabled={false} />);
  fireEvent.change(screen.getByLabelText("阶段容量"), {
    target: { value: "8" },
  });
  expect(onChange.mock.lastCall?.[0].stages[0]).toMatchObject({
    id: "stage-a",
    capacity: 8,
  });
});
it("route selector switches cleanly to record equality without carrying rank fields", () => {
  const payload = {
    stages: [
      { id: "a", groups: [] },
      { id: "b", groups: [] },
    ],
    pools: [],
    routes: [
      {
        id: "r",
        source: { stageId: "a" },
        target: { stageId: "b" },
        selector: { kind: "rankRange", from: 1, to: 2 },
        quota: 2,
        sort: [],
        placement: { kind: "seed", positions: [1, 2] },
      },
    ],
  };
  const onChange = vi.fn();
  render(<RouteForms payload={payload} onChange={onChange} disabled={false} />);
  fireEvent.change(screen.getByLabelText("筛选方式"), {
    target: { value: "recordEquals" },
  });
  expect(onChange.mock.lastCall?.[0].routes[0].selector).toEqual({
    kind: "recordEquals",
    wins: null,
    losses: null,
    draws: null,
  });
});
it("four hand-authored routes preserve source, target, sort order and positions when editing quotas", () => {
  const routes = ["a", "b", "c", "d"].map((id, i) => ({
    id: "r" + id,
    source: { stageId: "A", groupId: id },
    target: i < 2 ? { stageId: "B", groupId: "X" } : { stageId: "C" },
    selector: { kind: "rankRange", from: 1, to: 1 },
    quota: 1,
    sort: [{ field: "initialSeed", direction: "asc" }],
    placement: {
      kind: i < 2 ? "seed" : "slot",
      positions: [i < 2 ? i + 1 : i === 2 ? 1 : 8],
    },
  }));
  const payload = {
      stages: [
        {
          id: "A",
          groups: ["a", "b", "c", "d"].map((id) => ({ id, stageId: "A" })),
        },
        { id: "B", groups: [{ id: "X", stageId: "B" }] },
        { id: "C", groups: [] },
      ],
      pools: [],
      routes,
    },
    onChange = vi.fn();
  render(<RouteForms payload={payload} onChange={onChange} disabled={false} />);
  fireEvent.change(screen.getAllByLabelText("晋级名额")[2], {
    target: { value: "2" },
  });
  expect(onChange.mock.lastCall?.[0]).toEqual({
    ...payload,
    routes: routes.map((r, i) => (i === 2 ? { ...r, quota: 2 } : r)),
  });
});

it("positions can be typed naturally without converting a trailing comma into zero", async () => {
  const { useState } = await import("react"),
    { default: userEvent } = await import("@testing-library/user-event");
  let latest: any;
  const original = {
    stages: [
      { id: "a", groups: [] },
      { id: "b", groups: [] },
    ],
    pools: [],
    routes: [
      {
        id: "r",
        source: { stageId: "a" },
        target: { stageId: "b" },
        selector: { kind: "all" },
        quota: 2,
        sort: [],
        placement: { kind: "slot", positions: [1] },
      },
    ],
  };
  function Controlled() {
    const [payload, setPayload] = useState(original);
    return (
      <RouteForms
        payload={payload}
        disabled={false}
        onChange={(next) => {
          latest = next;
          setPayload(next);
        }}
      />
    );
  }
  render(<Controlled />);
  const input = screen.getByLabelText("位置序列（逗号分隔正整数）"),
    user = userEvent.setup();
  await user.clear(input);
  await user.type(input, "1,8");
  expect(input).toHaveValue("1,8");
  expect(latest.routes[0].placement.positions).toEqual([1, 8]);
});
