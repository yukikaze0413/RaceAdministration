import { afterEach, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  ConfigurationSession,
  useSessionState,
  useSessionAccess,
} from "./session";
afterEach(cleanup);
function VisibleDraft() {
  const [value] = useSessionState("test-draft", 1);
  return <p role="status">{value}</p>;
}
function RecoverDraft() {
  const cache = useSessionAccess();
  return (
    <button onClick={() => cache.set("test-draft", 2)}>恢复服务器版本</button>
  );
}
it("reflects a shared session update in an already mounted draft", () => {
  render(
    <ConfigurationSession>
      <VisibleDraft />
      <RecoverDraft />
    </ConfigurationSession>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "恢复服务器版本" }));
  expect(screen.getByRole("status")).toHaveTextContent("2");
});
import { sameConfiguration } from "./session";
import { saveSessionLayout, structurePayload } from "./session";
it("save before leaving retains compiled child positions and removes obsolete nodes", async () => {
  const configuration = {
    id: "c",
    version: 2,
    structureVersion: "structure-v2",
    stages: [{ id: "s", groups: [{ id: "g" }] }],
    pools: [],
    routes: [],
  };
  const cache = new Map<string, any>([
    [
      "graph-layout",
      {
        version: 1,
        positions: {
          g: { x: 1, y: 2 },
          match: { x: 20, y: 40 },
          obsolete: { x: 9, y: 9 },
        },
        zoom: 1,
        pan: { x: 0, y: 0 },
      },
    ],
    ["graph-node-ids", ["match"]],
    ["graph-node-structure", JSON.stringify(structurePayload(configuration))],
  ]);
  let body: any;
  const write = {
    run: async (_url: string, _method: string, value: any) => {
      body = value;
      return { ...value, version: 2 };
    },
  };
  expect(
    await saveSessionLayout(cache, write, "/configuration", configuration),
  ).toBe(true);
  expect(body.positions).toEqual({
    g: { x: 1, y: 2 },
    match: { x: 20, y: 40 },
  });
});
it("only keeps recognized editor subpages within the same configuration", () => {
  expect(
    sameConfiguration(
      "/manage/t1/configurations/c1/stages",
      "/manage/t1/configurations/c1/graph",
    ),
  ).toBe(true);
  expect(
    sameConfiguration(
      "/manage/t1/configurations/c1/stages",
      "/manage/t1/configurations/c1/not-a-page",
    ),
  ).toBe(false);
  expect(
    sameConfiguration(
      "/manage/t1/configurations/c1/stages",
      "/manage/t2/configurations/c1/graph",
    ),
  ).toBe(false);
  expect(
    sameConfiguration(
      "/manage/t1/configurations/c1/stages",
      "/manage/t1/configurations/c2/graph",
    ),
  ).toBe(false);
});
