import { expect, test } from "vitest";
import { acceptAnalysis, beginAnalysis, invalidateAnalysis } from "./analysis-state";
test("only latest request and same graph receives analysis results", () => {
  const token = { epoch: 1, revision: 2, projectId: "one" };
  const state = beginAnalysis(null, token, 1);
  const newer = beginAnalysis(state, token, 2);
  expect(acceptAnalysis(newer, token, 1, { valid: true })).toBe(newer);
  const done = acceptAnalysis(newer, token, 2, { valid: true });
  expect(done.status).toBe("current");
  expect(invalidateAnalysis(done).status).toBe("stale");
  expect(acceptAnalysis(done, { ...token, epoch: 2 }, 2, {})).toBe(done);
});
