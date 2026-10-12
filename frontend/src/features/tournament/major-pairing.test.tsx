import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PairingDecision } from "./competition";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const rows = Array.from({ length: 6 }, (_, i) => ({
  entrantId: String(i + 1),
  wins: 2,
  losses: 2,
  opponents: [String(i < 3 ? i + 4 : i - 2)],
}));
function show(
  code = "MAJOR_PRIORITY_EXHAUSTED",
  ruleVersion = "major-cologne-2026-v1",
) {
  const onSaved = vi.fn();
  render(
    <PairingDecision
      u={{
        id: "g",
        ruleVersion,
        format: "threshold-swiss",
        standings: rows,
        plan: { parameters: { winsToQualify: 3, lossesToEliminate: 3 } },
        pairingBlock: { code },
        pairingInputVersion: 4,
        pairingInputHash: "current",
      }}
      data={{
        version: 7,
        runtime: { roster: rows.map((r) => ({ ...r, name: r.entrantId })) },
      }}
      base="/tournaments/t"
      onSaved={onSaved}
    />,
  );
  return onSaved;
}
it("Major rematch requires explicit confirmation and reason before sending the current input", async () => {
  let sent: any;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      sent = JSON.parse(options.body);
      return new Response(
        JSON.stringify({ data: { version: 8 }, requestId: "test" }),
      );
    }),
  );
  const onSaved = show();
  for (let i = 0; i < 3; i++) {
    fireEvent.change(screen.getByLabelText(`第${i + 1}场左方`), {
      target: { value: String(i + 1) },
    });
    fireEvent.change(screen.getByLabelText(`第${i + 1}场右方`), {
      target: { value: String(i + 4) },
    });
  }
  fireEvent.change(screen.getByLabelText("配对裁定原因"), {
    target: { value: "已核验无重赛方案不可行" },
  });
  const submit = screen.getByRole("button", { name: "确认完整人工配对" });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByLabelText("确认 Major 重赛例外"));
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(sent).toMatchObject({
    expectedVersion: 7,
    inputVersion: 4,
    inputHash: "current",
    allowRematch: true,
    reason: "已核验无重赛方案不可行",
    bye: null,
  });
});
it("solver budget and generic Swiss never offer the Major rematch exception", () => {
  show("PAIRING_SOLVER_LIMIT");
  expect(
    screen.queryByLabelText("确认 Major 重赛例外"),
  ).not.toBeInTheDocument();
  cleanup();
  show("PAIRING_UNSAT", "swiss-threshold-v1");
  expect(
    screen.queryByLabelText("确认 Major 重赛例外"),
  ).not.toBeInTheDocument();
});
